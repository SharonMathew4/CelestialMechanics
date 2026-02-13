/**
 * Neutron Star Shader with Magnetic Field Visualization
 * 
 * Creates realistic neutron star visualization featuring:
 * - Ultra-bright blue/white surface
 * - Magnetic dipole field lines
 * - Rotating pulsar beams from magnetic poles
 * - Intense corona glow
 * - Crustal texture showing extreme density
 * 
 * Based on physics of rotating magnetars and radio pulsars.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Vertex shader
 */
const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        
        gl_Position = projectionMatrix * mvPosition;
    }
`;

/**
 * Fragment shader - neutron star surface + magnetic field
 */
const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uSurfaceColor;      // Primary surface color (blue-white)
    uniform vec3 uHotspotColor;      // Hotspot color (bright white)
    uniform vec3 uCrustColor;        // Cooler crust regions
    uniform float uRotationSpeed;    // Rotation rate
    uniform float uMagneticAxis;     // Angle between rotation and magnetic axis
    uniform float uSurfaceDetail;    // Surface texture detail
    uniform float uGlowIntensity;    // Corona glow strength
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;

    // Simplex noise
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

    // FBM
    float fbm(vec3 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < 5; i++) {
            if (i >= octaves) break;
            value += amplitude * snoise(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    void main() {
        vec3 spherePos = normalize(vPosition);
        
        // Rotation over time
        float rotTime = uTime * uRotationSpeed;
        
        // Rotate position for surface animation
        float cosRot = cos(rotTime);
        float sinRot = sin(rotTime);
        vec3 rotatedPos = vec3(
            spherePos.x * cosRot - spherePos.z * sinRot,
            spherePos.y,
            spherePos.x * sinRot + spherePos.z * cosRot
        );

        // === SURFACE TEXTURE ===
        // Crustal density variations
        float crustalNoise = fbm(rotatedPos * uSurfaceDetail, 4);
        crustalNoise = crustalNoise * 0.5 + 0.5;
        
        // Fine surface detail
        float surfaceDetail = fbm(rotatedPos * uSurfaceDetail * 3.0, 5);
        surfaceDetail = surfaceDetail * 0.5 + 0.5;
        
        // Combine for texture
        float surfaceBrightness = mix(crustalNoise, surfaceDetail, 0.4);
        
        // === MAGNETIC HOTSPOTS ===
        // Magnetic poles create hotspots (misaligned from rotation axis)
        vec3 magneticNorth = vec3(sin(uMagneticAxis), cos(uMagneticAxis), 0.0);
        vec3 magneticSouth = -magneticNorth;
        
        // Rotate magnetic axis with star
        float cosMag = cos(rotTime);
        float sinMag = sin(rotTime);
        magneticNorth = vec3(
            magneticNorth.x * cosMag - magneticNorth.z * sinMag,
            magneticNorth.y,
            magneticNorth.x * sinMag + magneticNorth.z * cosMag
       );
        magneticSouth = -magneticNorth;
        
        // Hotspots at magnetic poles
        float northHotspot = pow(max(dot(spherePos, magneticNorth), 0.0), 8.0);
        float southHotspot = pow(max(dot(spherePos, magneticSouth), 0.0), 8.0);
        float magneticHeat = (northHotspot + southHotspot) * 2.0;
        
        // === COLOR MAPPING ===
        vec3 surfaceColor = mix(uCrustColor, uSurfaceColor, surfaceBrightness);
        surfaceColor = mix(surfaceColor, uHotspotColor, magneticHeat);
        
        // === LIMB BRIGHTENING ===
        // Neutron stars have limb *brightening* due to gravitational light bending
        vec3 viewDir = normalize(vViewPosition);
        float ndotv = abs(dot(vNormal, viewDir));
        float limbBright = pow(1.0 - ndotv, 0.8) * 0.6;
        surfaceColor += uSurfaceColor * limbBright;
        
        // === INTENSE GLOW ===
        vec3 finalColor = surfaceColor * uGlowIntensity;
        
        // Add edge corona
        float edgeGlow = pow(1.0 - ndotv, 2.0) * 1.5;
        finalColor += uHotspotColor * edgeGlow;
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

/**
 * Neutron star configuration
 */
export interface NeutronStarConfig {
    surfaceColor: THREE.Color;
    hotspotColor: THREE.Color;
    crustColor: THREE.Color;
    rotationSpeed: number; // Radians per second
    magneticAxisAngle: number; // Radians (misalignment from rotation axis)
    surfaceDetail: number;
    glowIntensity: number;
}

/**
 * Get neutron star shader configuration
 */
export function getNeutronStarConfig(): NeutronStarConfig {
    return {
        surfaceColor: new THREE.Color('#a0d0ff'), // Bright blue-white
        hotspotColor: new THREE.Color('#ffffff'), // Pure white hotspots
        crustColor: new THREE.Color('#6090dd'), // Slightly cooler blue
        rotationSpeed: 2.0, // Fast rotation (pulsars rotate very fast)
        magneticAxisAngle: 0.5, // ~30 degrees misalignment
        surfaceDetail: 8.0,
        glowIntensity: 3.0,
    };
}

/**
 * Use neutron star shader material hook
 */
export function useNeutronStarShaderMaterial(config: NeutronStarConfig) {
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uSurfaceColor: { value: config.surfaceColor },
        uHotspotColor: { value: config.hotspotColor },
        uCrustColor: { value: config.crustColor },
        uRotationSpeed: { value: config.rotationSpeed },
        uMagneticAxis: { value: config.magneticAxisAngle },
        uSurfaceDetail: { value: config.surfaceDetail },
        uGlowIntensity: { value: config.glowIntensity },
    }), [config]);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return { materialRef, uniforms };
}

export { vertexShader, fragmentShader };
