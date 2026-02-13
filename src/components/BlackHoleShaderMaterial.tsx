/**
 * Black Hole Shader with Gravitational Lensing
 * 
 * Creates realistic black hole visualization featuring:
 * - Event horizon (schwarzschild radius)
 * - Photon sphere / Einstein ring
 * - Accretion disk with gravitational lensing
 * - Doppler beaming (approaching side brighter)
 * - Turbulent plasma texture
 * 
 * Based on physics of rotating (Kerr) black holes and
 * general relativistic ray-tracing principles.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Vertex shader - spherical coordinate system
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
 * Fragment shader - gravitational lensing + accretion disk
 */
const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform float uEventHorizonRadius;  // Schwarzschild radius (Rs = 2GM/c²)
    uniform float uPhotonSphereRadius;  // 1.5 * Rs for non-rotating BH
    uniform float uDiskInnerRadius;     // ISCO (innermost stable circular orbit)
    uniform float uDiskOuterRadius;     // Outer edge of accretion disk
    uniform vec3 uDiskColor1;           // Hot inner disk
    uniform vec3 uDiskColor2;           // Mid disk
    uniform vec3 uDiskColor3;           // Outer disk
    uniform float uSpinSpeed;           // Angular velocity
    uniform float uDopplerFactor;       // Doppler beaming strength
    uniform float uLensingStrength;     // Gravitational lensing intensity
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;

    // Simplex 3D noise (same as star shader)
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

    // FBM for disk turbulence
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
        // Normalize position on sphere
        vec3 spherePos = normalize(vPosition);
        
        // Distance from center in normalized coordinates
        float dist = length(vPosition);
        
        // View direction
        vec3 viewDir = normalize(vViewPosition);
        float ndotv = abs(dot(vNormal, viewDir));

        // === EVENT HORIZON ===
        // Pure black sphere at the center
        if (dist < uEventHorizonRadius) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
        }

        // === PHOTON SPHERE / EINSTEIN RING ===
        // Bright ring at 1.5 Rs where photons orbit
        float photonDist = abs(dist - uPhotonSphereRadius);
        float photonRing = smoothstep(0.15, 0.05, photonDist) * 0.8;

        // === ACCRETION DISK ===
        // Convert to cylindrical coordinates for disk
        // Disk is in XZ plane (Y is axis of rotation)
        float diskRadius = length(vec2(spherePos.x, spherePos.z));
        float diskHeight = abs(spherePos.y);
        
        // Disk thickness (thin disk, ~0.1 scale units)
        float diskThickness = 0.12;
        
        // Check if we're in the disk region
        bool inDisk = diskRadius >= uDiskInnerRadius && 
                      diskRadius <= uDiskOuterRadius && 
                      diskHeight < diskThickness;

        vec3 finalColor = vec3(0.0);
        
        if (inDisk) {
            // === DISK TEXTURE ===
            // Azimuthal angle for rotation
            float angle = atan(spherePos.z, spherePos.x);
            
            // Rotational motion
            float rotationSpeed = uSpinSpeed / (diskRadius * diskRadius); // Keplerian rotation
            float animatedAngle = angle + uTime * rotationSpeed;
            
            // Turbulence noise for disk texture
            vec3 noiseCoord = vec3(
                cos(animatedAngle) * diskRadius * 8.0,
                sin(animatedAngle) * diskRadius * 8.0,
                uTime * 0.2
            );
            
            float turbulence = fbm(noiseCoord, 4);
            turbulence = turbulence * 0.5 + 0.5; // Remap to 0-1
            
            // === COLOR GRADIENT ===
            // Hot inner disk → cooler outer disk
            float diskNorm = (diskRadius - uDiskInnerRadius) / (uDiskOuterRadius - uDiskInnerRadius);
            vec3 diskColor;
            if (diskNorm < 0.3) {
                diskColor = mix(uDiskColor1, uDiskColor2, diskNorm / 0.3);
            } else {
                diskColor = mix(uDiskColor2, uDiskColor3, (diskNorm - 0.3) / 0.7);
            }
            
            // Modulate by turbulence
            diskColor = mix(diskColor * 0.6, diskColor * 1.4, turbulence);
            
            // === DOPPLER BEAMING ===
            // Approaching side (moving toward camera) is brighter
            // Receding side (moving away) is dimmer and redshifted
            float dopplerShift = cos(animatedAngle) * uDopplerFactor;
            float brightness = 1.0 + dopplerShift * 0.8;
            diskColor *= brightness;
            
            // === DISK FALLOFF ===
            // Fade at edges of disk (height)
            float heightFalloff = smoothstep(diskThickness, diskThickness * 0.5, diskHeight);
            
            // Inner edge glow
            float innerGlow = smoothstep(uDiskInnerRadius + 0.15, uDiskInnerRadius, diskRadius) * 2.0;
            diskColor += uDiskColor1 * innerGlow;
            
            finalColor = diskColor * heightFalloff;
        }
        
        // === GRAVITATIONAL LENSING ===
        // Secondary image of disk behind black hole (simplified)
        if (!inDisk && dist > uPhotonSphereRadius && dist < uDiskOuterRadius * 1.3) {
            // Approximate lensing: sample disk on opposite side
            vec3 lensedPos = -spherePos; // Mirror across BH
            float lensedDiskRadius = length(vec2(lensedPos.x, lensedPos.z));
            float lensedDiskHeight = abs(lensedPos.y);
            
            bool inLensedDisk = lensedDiskRadius >= uDiskInnerRadius && 
                                lensedDiskRadius <= uDiskOuterRadius && 
                                lensedDiskHeight < diskThickness * 1.5;
            
            if (inLensedDisk) {
                // Dimmed and distorted secondary image
                float lensStrength = uLensingStrength * smoothstep(uDiskOuterRadius * 1.3, uPhotonSphereRadius, dist);
                
                float lensedAngle = atan(lensedPos.z, lensedPos.x);
                float lensedRotationSpeed = uSpinSpeed / (lensedDiskRadius * lensedDiskRadius);
                float lensedAnimatedAngle = lensedAngle + uTime * lensedRotationSpeed;
                
                vec3 lensedNoiseCoord = vec3(
                    cos(lensedAnimatedAngle) * lensedDiskRadius * 8.0,
                    sin(lensedAnimatedAngle) * lensedDiskRadius * 8.0,
                    uTime * 0.2
                );
                
                float lensedTurbulence = fbm(lensedNoiseCoord, 3) * 0.5 + 0.5;
                
                float lensedDiskNorm = (lensedDiskRadius - uDiskInnerRadius) / (uDiskOuterRadius - uDiskInnerRadius);
                vec3 lensedColor = mix(uDiskColor2, uDiskColor3, lensedDiskNorm);
                lensedColor = mix(lensedColor * 0.5, lensedColor, lensedTurbulence);
                
                float lensedHeightFalloff = smoothstep(diskThickness * 1.5, diskThickness * 0.8, lensedDiskHeight);
                
                finalColor += lensedColor * lensedHeightFalloff * lensStrength * 0.4;
            }
        }
        
        // === PHOTON RING ===
        // Add the bright Einstein ring
        finalColor += vec3(1.0, 0.95, 0.85) * photonRing;
        
        // === EDGE GLOW ===
        // Subtle atmospheric glow near event horizon
        float horizonGlow = smoothstep(uEventHorizonRadius + 0.3, uEventHorizonRadius, dist) * 0.4;
        finalColor += vec3(0.6, 0.4, 0.2) * horizonGlow;
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

/**
 * Black hole shader configuration
 */
export interface BlackHoleConfig {
    mass: number; // Solar masses
    spinParameter: number; // a* (0 = Schwarzschild, ~1 = extreme Kerr)
    diskInnerRadiusMultiplier: number; // Multiple of Schwarzschild radius
    diskOuterRadiusMultiplier: number;
    diskColor1: THREE.Color; // Inner hot disk
    diskColor2: THREE.Color; // Mid disk
    diskColor3: THREE.Color; // Outer disk
    spinSpeed: number;
    dopplerFactor: number;
    lensingStrength: number;
}

/**
 * Get black hole shader configuration based on mass
 */
export function getBlackHoleConfig(mass: number): BlackHoleConfig {
    // Larger black holes have cooler, less turbulent disks
    if (mass > 100) {
        // Supermassive black hole (like Gargantua or Sgr A*)
        return {
            mass,
            spinParameter: 0.9,
            diskInnerRadiusMultiplier: 3.0,
            diskOuterRadiusMultiplier: 15.0,
            diskColor1: new THREE.Color('#fff8e0'),
            diskColor2: new THREE.Color('#ffcc66'),
            diskColor3: new THREE.Color('#cc6622'),
            spinSpeed: 0.15,
            dopplerFactor: 0.6,
            lensingStrength: 0.7,
        };
    } else {
        // Stellar-mass black hole
        return {
            mass,
            spinParameter: 0.7,
            diskInnerRadiusMultiplier: 2.5,
            diskOuterRadiusMultiplier: 10.0,
            diskColor1: new THREE.Color('#ffffee'),
            diskColor2: new THREE.Color('#ffaa44'),
            diskColor3: new THREE.Color('#ff6622'),
            spinSpeed: 0.3,
            dopplerFactor: 0.8,
            lensingStrength: 0.5,
        };
    }
}

/**
 * Use black hole shader material hook
 */
export function useBlackHoleShaderMaterial(config: BlackHoleConfig, visualRadius: number) {
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    // Schwarzschild radius in visual units (normalized)
    const eventHorizonRadius = visualRadius * 0.5;
    const photonSphereRadius = eventHorizonRadius * 1.5;
    const diskInnerRadius = eventHorizonRadius * config.diskInnerRadiusMultiplier;
    const diskOuterRadius = eventHorizonRadius * config.diskOuterRadiusMultiplier;

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uEventHorizonRadius: { value: eventHorizonRadius },
        uPhotonSphereRadius: { value: photonSphereRadius },
        uDiskInnerRadius: { value: diskInnerRadius },
        uDiskOuterRadius: { value: diskOuterRadius },
        uDiskColor1: { value: config.diskColor1 },
        uDiskColor2: { value: config.diskColor2 },
        uDiskColor3: { value: config.diskColor3 },
        uSpinSpeed: { value: config.spinSpeed },
        uDopplerFactor: { value: config.dopplerFactor },
        uLensingStrength: { value: config.lensingStrength },
    }), [config, eventHorizonRadius, photonSphereRadius, diskInnerRadius, diskOuterRadius]);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return { materialRef, uniforms };
}

export { vertexShader, fragmentShader };
