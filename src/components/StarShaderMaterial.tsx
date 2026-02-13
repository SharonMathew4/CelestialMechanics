/**
 * Procedural Star Shader Material
 * 
 * Creates realistic star surface textures using GLSL shaders with:
 * - Simplex noise for convection cell granulation
 * - Animated plasma turbulence
 * - Limb darkening (realistic edge falloff)
 * - Spectral-class color mapping (O/B/A/F/G/K/M)
 * - Hot spots and dark regions
 */

import { useRef, useMemo } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';

/**
 * GLSL vertex shader
 */
const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

/**
 * GLSL fragment shader — procedural star surface
 */
const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uColorHot;       // Brightest color (center of convection)
    uniform vec3 uColorMid;       // Mid-tone surface color
    uniform vec3 uColorCool;      // Coolest color (cell boundaries)
    uniform vec3 uColorSpot;      // Dark spot color
    uniform float uTurbulence;    // Turbulence intensity (0-1)
    uniform float uGranulation;   // Granulation scale
    uniform float uLimbDarkening; // Limb darkening strength
    uniform float uEmissiveBoost; // Emissive intensity multiplier
    uniform float uSpotFrequency; // Dark spot frequency

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;

    //
    // Simplex 3D Noise (by Ian McEwan, Ashima Arts)
    //
    vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod(i, 289.0);
        vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        float n_ = 1.0/7.0;
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);

        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    // Fractional Brownian Motion — layered noise for realistic turbulence
    float fbm(vec3 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < 6; i++) {
            if (i >= octaves) break;
            value += amplitude * snoise(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    void main() {
        // Normalized position on sphere for noise sampling
        vec3 noisePos = normalize(vPosition);

        // Slow time for animation
        float t = uTime * 0.08;

        // === LAYER 1: Large convection cells (granulation) ===
        float gran = fbm(noisePos * uGranulation + vec3(t * 0.3, t * 0.1, -t * 0.2), 4);
        gran = gran * 0.5 + 0.5; // Remap to 0-1

        // === LAYER 2: Fine surface detail ===
        float detail = fbm(noisePos * uGranulation * 3.0 + vec3(-t * 0.5, t * 0.4, t * 0.15), 5);
        detail = detail * 0.5 + 0.5;

        // === LAYER 3: Hot plasma flows ===
        float plasma = fbm(noisePos * uGranulation * 1.5 + vec3(t * 0.7, -t * 0.3, t * 0.5), 3);
        plasma = plasma * 0.5 + 0.5;
        plasma = pow(plasma, 1.5); // Make hot spots brighter

        // === LAYER 4: Dark spots (sunspots) ===
        float spots = snoise(noisePos * uSpotFrequency + vec3(t * 0.05));
        spots = smoothstep(0.55, 0.65, spots); // Threshold to create isolated spots

        // === LAYER 5: Very large-scale variation ===
        float largescale = snoise(noisePos * 1.5 + vec3(t * 0.02, 0.0, t * 0.01));
        largescale = largescale * 0.5 + 0.5;

        // === Combine layers ===
        // Surface brightness: mix of granulation and detail
        float brightness = mix(gran, detail, 0.35);
        brightness = mix(brightness, plasma, uTurbulence * 0.4);
        brightness = mix(brightness, largescale, 0.15);

        // Apply dark spots
        brightness = mix(brightness, 0.15, spots * 0.7);

        // === Color mapping ===
        // Map brightness to star colors: cool → mid → hot
        vec3 surfaceColor;
        if (brightness < 0.45) {
            surfaceColor = mix(uColorCool, uColorMid, brightness / 0.45);
        } else if (brightness < 0.7) {
            surfaceColor = mix(uColorMid, uColorHot, (brightness - 0.45) / 0.25);
        } else {
            surfaceColor = mix(uColorHot, vec3(1.0), (brightness - 0.7) / 0.3 * 0.3);
        }

        // Dark spots get spot color
        surfaceColor = mix(surfaceColor, uColorSpot, spots * 0.6);

        // === Limb darkening ===
        // View-dependent darkening at the edges (realistic stellar effect)
        float ndotv = max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
        float limb = pow(ndotv, uLimbDarkening);
        
        // Slight color shift at limb (cooler at edges)
        vec3 limbColor = mix(uColorCool * 0.5, surfaceColor, limb);

        // Final color with emissive boost
        vec3 finalColor = limbColor * uEmissiveBoost;

        // Add subtle corona glow at edges
        float edge = 1.0 - ndotv;
        float corona = pow(edge, 3.0) * 0.3;
        finalColor += uColorHot * corona;

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

/**
 * Star color palettes by spectral class
 * Matching the reference image: Yellow Dwarf, Red Dwarf, Red Giant, etc.
 */
export interface StarColors {
    hot: THREE.Color;
    mid: THREE.Color;
    cool: THREE.Color;
    spot: THREE.Color;
}

export function getStarColors(spectralClass: string, temperature?: number): StarColors {
    switch (spectralClass) {
        case 'O': // Blue, hottest (Blue Giant in reference)
            return {
                hot: new THREE.Color('#e8f0ff'),
                mid: new THREE.Color('#a0c4ff'),
                cool: new THREE.Color('#6090dd'),
                spot: new THREE.Color('#3060aa'),
            };
        case 'B': // Blue-white (White Dwarf-like in reference)
            return {
                hot: new THREE.Color('#f0f4ff'),
                mid: new THREE.Color('#c0d8ff'),
                cool: new THREE.Color('#88aaee'),
                spot: new THREE.Color('#5577bb'),
            };
        case 'A': // White
            return {
                hot: new THREE.Color('#ffffff'),
                mid: new THREE.Color('#fff8f0'),
                cool: new THREE.Color('#ddc8a0'),
                spot: new THREE.Color('#aa9060'),
            };
        case 'F': // Yellow-white
            return {
                hot: new THREE.Color('#fffde8'),
                mid: new THREE.Color('#ffe4a0'),
                cool: new THREE.Color('#ddaa50'),
                spot: new THREE.Color('#aa7020'),
            };
        case 'G': // Yellow (Sun-like = Yellow Dwarf in reference)
            return {
                hot: new THREE.Color('#fff8d0'),
                mid: new THREE.Color('#ffcc40'),
                cool: new THREE.Color('#ee8800'),
                spot: new THREE.Color('#882200'),
            };
        case 'K': // Orange (Red Dwarf in reference)
            return {
                hot: new THREE.Color('#ffbb44'),
                mid: new THREE.Color('#ff7722'),
                cool: new THREE.Color('#cc3300'),
                spot: new THREE.Color('#661100'),
            };
        case 'M': // Red (Red Giant / Red Supergiant in reference)
            return {
                hot: new THREE.Color('#ff8833'),
                mid: new THREE.Color('#ee4411'),
                cool: new THREE.Color('#aa1100'),
                spot: new THREE.Color('#440000'),
            };
        default: // Brown Dwarf / unknown
            return {
                hot: new THREE.Color('#cc77dd'),
                mid: new THREE.Color('#9944aa'),
                cool: new THREE.Color('#552266'),
                spot: new THREE.Color('#220033'),
            };
    }
}

/**
 * Shader configuration by spectral class
 */
export function getStarShaderConfig(spectralClass: string) {
    switch (spectralClass) {
        case 'O':
            return { turbulence: 0.3, granulation: 3.0, limbDarkening: 0.6, emissiveBoost: 2.5, spotFrequency: 4.0 };
        case 'B':
            return { turbulence: 0.25, granulation: 3.5, limbDarkening: 0.5, emissiveBoost: 2.2, spotFrequency: 5.0 };
        case 'A':
            return { turbulence: 0.35, granulation: 4.0, limbDarkening: 0.5, emissiveBoost: 2.0, spotFrequency: 4.5 };
        case 'F':
            return { turbulence: 0.5, granulation: 4.5, limbDarkening: 0.55, emissiveBoost: 1.8, spotFrequency: 3.5 };
        case 'G': // Sun-like — most granulation / sunspots
            return { turbulence: 0.7, granulation: 5.0, limbDarkening: 0.65, emissiveBoost: 1.6, spotFrequency: 3.0 };
        case 'K':
            return { turbulence: 0.8, granulation: 4.5, limbDarkening: 0.7, emissiveBoost: 1.5, spotFrequency: 2.5 };
        case 'M': // Red — heavy turbulence, prominent convection
            return { turbulence: 0.9, granulation: 4.0, limbDarkening: 0.75, emissiveBoost: 1.4, spotFrequency: 2.0 };
        default:
            return { turbulence: 0.6, granulation: 3.5, limbDarkening: 0.6, emissiveBoost: 1.2, spotFrequency: 3.0 };
    }
}

/**
 * React Three Fiber star shader material hook
 */
export function useStarShaderMaterial(spectralClass: string) {
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    const colors = useMemo(() => getStarColors(spectralClass), [spectralClass]);
    const config = useMemo(() => getStarShaderConfig(spectralClass), [spectralClass]);

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uColorHot: { value: colors.hot },
        uColorMid: { value: colors.mid },
        uColorCool: { value: colors.cool },
        uColorSpot: { value: colors.spot },
        uTurbulence: { value: config.turbulence },
        uGranulation: { value: config.granulation },
        uLimbDarkening: { value: config.limbDarkening },
        uEmissiveBoost: { value: config.emissiveBoost },
        uSpotFrequency: { value: config.spotFrequency },
    }), [colors, config]);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return { materialRef, uniforms };
}

/**
 * Star Shader Material component for JSX usage
 */
export function StarShaderMaterialComponent({
    spectralClass,
    materialRef,
}: {
    spectralClass: string;
    materialRef: React.RefObject<THREE.ShaderMaterial>;
}) {
    const colors = useMemo(() => getStarColors(spectralClass), [spectralClass]);
    const config = useMemo(() => getStarShaderConfig(spectralClass), [spectralClass]);

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uColorHot: { value: colors.hot },
        uColorMid: { value: colors.mid },
        uColorCool: { value: colors.cool },
        uColorSpot: { value: colors.spot },
        uTurbulence: { value: config.turbulence },
        uGranulation: { value: config.granulation },
        uLimbDarkening: { value: config.limbDarkening },
        uEmissiveBoost: { value: config.emissiveBoost },
        uSpotFrequency: { value: config.spotFrequency },
    }), [colors, config]);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return (
        <shaderMaterial
            ref={materialRef}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            uniforms={uniforms}
            toneMapped={false}
        />
    );
}

export { vertexShader, fragmentShader };
