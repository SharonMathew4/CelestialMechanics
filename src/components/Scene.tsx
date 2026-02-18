/**
 * Cosmic Fabric - 3D Scene Component
 * 
 * Main Three.js canvas using React Three Fiber.
 * Handles the 3D rendering of all cosmic objects,
 * post-processing effects, collision particles, and background stars.
 */

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import {
    PerspectiveCamera,
    OrbitControls,
    AdaptiveDpr,
    AdaptiveEvents,
    Environment,
    Stars,
} from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore, useCameraState, useTimeState } from '@/store';
import { usePlacementStore } from '@/store/placementStore';
import { CosmicObject, CosmicObjectType, SpectralClass } from '@/engine/physics/types';
import { Vector3 } from '@/engine/physics/vector';
import {
    createStar,
    createPlanet,
    createBlackHole,
    createNeutronStar,
} from '@/engine/physics/objectFactory';
import PostProcessing from '@/components/PostProcessing';
import CollisionParticles from '@/components/CollisionParticles';
import {
    vertexShader as starVertexShader,
    fragmentShader as starFragmentShader,
    getStarColors,
    getStarShaderConfig,
} from '@/components/StarShaderMaterial';
import {
    vertexShader as blackHoleVertexShader,
    fragmentShader as blackHoleFragmentShader,
    getBlackHoleConfig,
} from '@/components/BlackHoleShaderMaterial';
import {
    vertexShader as neutronStarVertexShader,
    fragmentShader as neutronStarFragmentShader,
    getNeutronStarConfig,
} from '@/components/NeutronStarShaderMaterial';
import { MagneticFieldLines, PulsarBeams } from '@/components/MagneticFieldComponents';

/**
 * Performance stats overlay
 */
interface PerformanceStatsProps {
    onUpdate: (fps: number, renderTime: number) => void;
}

function PerformanceStats({ onUpdate }: PerformanceStatsProps) {
    const frameCount = useRef(0);
    const lastTime = useRef(performance.now());

    useFrame(() => {
        frameCount.current++;
        const now = performance.now();
        const delta = now - lastTime.current;

        if (delta >= 1000) {
            const fps = Math.round((frameCount.current * 1000) / delta);
            onUpdate(fps, delta / frameCount.current);
            frameCount.current = 0;
            lastTime.current = now;
        }
    });

    return null;
}

/**
 * Camera controller that syncs with store
 */
function CameraController() {
    const { camera } = useThree();
    const cameraState = useCameraState();

    useEffect(() => {
        camera.position.set(...cameraState.position);
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.fov = cameraState.fov;
            camera.near = cameraState.near;
            camera.far = cameraState.far;
            camera.updateProjectionMatrix();
        }
    }, [camera, cameraState]);

    return null;
}

/**
 * Star mesh component with glow
 */
interface ObjectMeshProps {
    object: CosmicObject;
    isSelected: boolean;
    isHovered: boolean;
    onSelect: (e: ThreeEvent<MouseEvent>) => void;
    onHover: (hovering: boolean) => void;
}

function StarMesh({ object, isSelected, isHovered, onSelect, onHover }: ObjectMeshProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const shaderRef = useRef<THREE.ShaderMaterial>(null);

    const visualRadius = useMemo(() => {
        const baseRadius = 0.5;
        const lumFactor = Math.log10(object.properties.luminosity + 1) / 10;
        return baseRadius + lumFactor;
    }, [object.properties.luminosity]);

    // Determine spectral class from object (Star interface has it, fallback by color/temperature)
    const spectralClass = useMemo(() => {
        const starObj = object as any;
        if (starObj.spectralClass) return starObj.spectralClass;
        // Fallback: infer from temperature
        const temp = object.properties.temperature || 5778;
        if (temp > 30000) return 'O';
        if (temp > 10000) return 'B';
        if (temp > 7500) return 'A';
        if (temp > 6000) return 'F';
        if (temp > 5200) return 'G';
        if (temp > 3700) return 'K';
        return 'M';
    }, [object]);

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

    // Animate shader time
    useFrame((state) => {
        if (shaderRef.current) {
            shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    const baseColor = useMemo(() => new THREE.Color(object.visual.color), [object.visual.color]);
    const pos = object.state.position;

    return (
        <group position={[pos.x, pos.y, pos.z]}>
            {/* Main star body with procedural shader */}
            <mesh
                ref={meshRef}
                onClick={onSelect}
                onPointerOver={() => onHover(true)}
                onPointerOut={() => onHover(false)}
            >
                <sphereGeometry args={[visualRadius, 64, 64]} />
                <shaderMaterial
                    ref={shaderRef}
                    vertexShader={starVertexShader}
                    fragmentShader={starFragmentShader}
                    uniforms={uniforms}
                    toneMapped={false}
                />
            </mesh>

            {/* Real light source */}
            <pointLight
                color={baseColor}
                intensity={1.5}
                distance={50}
                decay={2}
            />

            {/* Glow effect (outer bloom halo) */}
            <mesh scale={2.2}>
                <sphereGeometry args={[visualRadius, 16, 16]} />
                <meshBasicMaterial
                    color={colors.hot}
                    transparent
                    opacity={0.12}
                    side={THREE.BackSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Inner glow corona */}
            <mesh scale={1.4}>
                <sphereGeometry args={[visualRadius, 16, 16]} />
                <meshBasicMaterial
                    color={colors.mid}
                    transparent
                    opacity={0.08}
                    side={THREE.BackSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Selection ring */}
            {isSelected && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[visualRadius * 1.5, visualRadius * 1.6, 32]} />
                    <meshBasicMaterial
                        color="#44aaff"
                        transparent
                        opacity={0.8}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}
        </group>
    );
}

/**
 * Planet mesh component
 */
function PlanetMesh({ object, isSelected, isHovered, onSelect, onHover }: ObjectMeshProps) {
    const meshRef = useRef<THREE.Mesh>(null);

    const visualRadius = useMemo(() => {
        const baseRadius = 0.2;
        const radiusFactor = Math.log10(object.properties.radius / 6.371e6 + 1);
        return baseRadius + radiusFactor * 0.1;
    }, [object.properties.radius]);

    const color = useMemo(() => new THREE.Color(object.visual.color), [object.visual.color]);
    const pos = object.state.position;

    return (
        <group position={[pos.x, pos.y, pos.z]}>
            <mesh
                ref={meshRef}
                onClick={onSelect}
                onPointerOver={() => onHover(true)}
                onPointerOut={() => onHover(false)}
            >
                <sphereGeometry args={[visualRadius, 24, 24]} />
                <meshStandardMaterial color={color} roughness={0.8} metalness={0.2} />
            </mesh>

            {isSelected && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[visualRadius * 1.5, visualRadius * 1.6, 32]} />
                    <meshBasicMaterial color="#44aaff" transparent opacity={0.8} side={THREE.DoubleSide} />
                </mesh>
            )}
        </group>
    );
}

/**
 * Black hole mesh component with animated accretion disk
 */
function BlackHoleMesh({ object, isSelected, isHovered, onSelect, onHover }: ObjectMeshProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const shaderRef = useRef<THREE.ShaderMaterial>(null);

    // Visual radius based on mass (log scale)
    const visualRadius = useMemo(() => {
        return Math.max(0.8, Math.log10(object.properties.mass + 1) / 30);
    }, [object.properties.mass]);

    // Get mass in solar masses (assuming mass is in kg)
    const solarMass = 1.989e30; // kg
    const massInSolarMasses = object.properties.mass / solarMass;

    // Get config based on mass
    const config = useMemo(() => getBlackHoleConfig(massInSolarMasses), [massInSolarMasses]);

    // Schwarzschild radius in visual units
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

    // Animate shader
    useFrame((state) => {
        if (shaderRef.current) {
            shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    const pos = object.state.position;

    return (
        <group
            position={[pos.x, pos.y, pos.z]}
            onClick={onSelect}
            onPointerOver={() => onHover(true)}
            onPointerOut={() => onHover(false)}
        >
            {/* Main black hole sphere with shader */}
            <mesh ref={meshRef}>
                <sphereGeometry args={[diskOuterRadius * 1.2, 128, 128]} />
                <shaderMaterial
                    ref={shaderRef}
                    vertexShader={blackHoleVertexShader}
                    fragmentShader={blackHoleFragmentShader}
                    uniforms={uniforms}
                    toneMapped={false}
                    transparent
                    depthWrite={false}
                />
            </mesh>

            {/* Selection ring */}
            {isSelected && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[diskOuterRadius * 1.3, diskOuterRadius * 1.35, 32]} />
                    <meshBasicMaterial color="#44aaff" transparent opacity={0.8} side={THREE.DoubleSide} />
                </mesh>
            )}
        </group>
    );
}

/**
 * Neutron star mesh with magnetic field and pulsar beams
 */
function NeutronStarMesh({ object, isSelected, isHovered, onSelect, onHover }: ObjectMeshProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const shaderRef = useRef<THREE.ShaderMaterial>(null);

    const visualRadius = useMemo(() => {
        return Math.max(0.6, Math.log10(object.properties.mass + 1) / 40);
    }, [object.properties.mass]);

    const config = useMemo(() => getNeutronStarConfig(), []);

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

    // Animate shader
    useFrame((state) => {
        if (shaderRef.current) {
            shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    const pos = object.state.position;

    return (
        <group
            position={[pos.x, pos.y, pos.z]}
            onClick={onSelect}
            onPointerOver={() => onHover(true)}
            onPointerOut={() => onHover(false)}
        >
            {/* Neutron star surface with shader */}
            <mesh ref={meshRef}>
                <sphereGeometry args={[visualRadius, 64, 64]} />
                <shaderMaterial
                    ref={shaderRef}
                    vertexShader={neutronStarVertexShader}
                    fragmentShader={neutronStarFragmentShader}
                    uniforms={uniforms}
                    toneMapped={false}
                />
            </mesh>

            {/* Magnetic field lines */}
            <MagneticFieldLines
                rotationSpeed={config.rotationSpeed}
                magneticAxisAngle={config.magneticAxisAngle}
                fieldStrength={0.8 * (visualRadius / 0.6)}
            />

            {/* Pulsar beams */}
            <PulsarBeams
                rotationSpeed={config.rotationSpeed}
                magneticAxisAngle={config.magneticAxisAngle}
                beamLength={visualRadius * 25}
                beamWidth={visualRadius * 0.5}
            />

            {/* Outer glow sphere */}
            <mesh scale={2.5}>
                <sphereGeometry args={[visualRadius, 16, 16]} />
                <meshBasicMaterial
                    color={config.surfaceColor}
                    transparent
                    opacity={0.08}
                    side={THREE.BackSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Selection ring */}
            {isSelected && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[visualRadius * 1.8, visualRadius * 1.85, 32]} />
                    <meshBasicMaterial color="#44aaff" transparent opacity={0.8} side={THREE.DoubleSide} />
                </mesh>
            )}
        </group>
    );
}

/**
 * Debris/Asteroid mesh (used for collision debris)
 */
function DebrisMesh({ object, isSelected, isHovered, onSelect, onHover }: ObjectMeshProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const pos = object.state.position;

    const color = useMemo(() => new THREE.Color(object.visual.color || '#ff8844'), [object.visual.color]);

    return (
        <group position={[pos.x, pos.y, pos.z]}>
            <mesh
                ref={meshRef}
                onClick={onSelect}
                onPointerOver={() => onHover(true)}
                onPointerOut={() => onHover(false)}
            >
                <sphereGeometry args={[0.15, 8, 8]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={object.visual.emissive || 0.5}
                    toneMapped={false}
                />
            </mesh>
        </group>
    );
}

/**
 * Nebula mesh — procedural GLSL shader for realistic post-collision nebulae
 * Features: FBM noise clouds, shell falloff, 4 visual styles, multi-color zones
 * References: Cassiopeia A, Ring Nebula, Crab Nebula, Blue Ring Nebula
 */

const nebulaVertexShader = `
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const nebulaFragmentShader = `
uniform float uTime;
uniform float uRadius;
uniform int uStyle;    // 0=ring, 1=supernova_remnant, 2=emission, 3=blue_bubble
uniform vec3 uColor1;  // Primary color
uniform vec3 uColor2;  // Secondary color
uniform vec3 uColor3;  // Tertiary (filament) color

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

// Simplex-style hash
vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
}

// 3D noise
float noise3d(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);

    float n000 = dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0));
    float n100 = dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0));
    float n010 = dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0));
    float n110 = dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0));
    float n001 = dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1));
    float n101 = dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1));
    float n011 = dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1));
    float n111 = dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1));

    float nx00 = mix(n000, n100, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx11 = mix(n011, n111, u.x);
    float nxy0 = mix(nx00, nx10, u.y);
    float nxy1 = mix(nx01, nx11, u.y);
    return mix(nxy0, nxy1, u.z) * 0.5 + 0.5;
}

// FBM — fractal Brownian motion
float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        value += amplitude * noise3d(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec3 pos = vPosition / uRadius;
    float dist = length(pos);

    // Animated slow rotation via noise offset
    float t = uTime * 0.02;
    vec3 animPos = pos + vec3(sin(t * 0.3) * 0.1, cos(t * 0.2) * 0.05, t * 0.05);

    float density = 0.0;
    vec3 finalColor = vec3(0.0);

    if (uStyle == 0) {
        // === RING / BUBBLE NEBULA ===
        // Torus-like shell: bright at mid-radius, hollow interior
        float ringDist = length(vec2(length(pos.xz) - 0.55, pos.y * 1.5));
        float shell = smoothstep(0.35, 0.2, ringDist) * smoothstep(0.0, 0.05, ringDist);
        float clouds = fbm(animPos * 4.0, 5);
        density = shell * (0.5 + clouds * 0.8);

        // Color: blue core, pink/red filaments at edge
        float edgeFactor = smoothstep(0.15, 0.3, ringDist);
        finalColor = mix(uColor1, uColor3, edgeFactor * clouds);
        finalColor = mix(finalColor, uColor2, (1.0 - dist) * 0.3);

    } else if (uStyle == 1) {
        // === SUPERNOVA REMNANT ===
        // Asymmetric filamentary shell
        float innerR = 0.5;
        float outerR = 0.85;
        float shell = smoothstep(innerR - 0.1, innerR, dist) * (1.0 - smoothstep(outerR, outerR + 0.15, dist));
        float filaments = fbm(animPos * 6.0 + vec3(0.0, t, 0.0), 6);
        float wisps = pow(filaments, 2.0) * 1.5;
        density = shell * (0.2 + wisps * 1.2);

        // Multi-color zones: inner hot white, mid blue, outer red filaments
        float innerGlow = smoothstep(0.6, 0.3, dist);
        vec3 hotCore = vec3(1.0, 0.95, 0.85) * innerGlow;
        vec3 midShell = uColor1 * shell;
        vec3 outerFilament = uColor3 * wisps * smoothstep(0.5, 0.8, dist);
        finalColor = hotCore + midShell + outerFilament;

    } else if (uStyle == 2) {
        // === EMISSION NEBULA ===
        // Filled cloud with bright knots
        float falloff = 1.0 - smoothstep(0.0, 0.9, dist);
        float clouds = fbm(animPos * 3.0, 5);
        float knots = pow(fbm(animPos * 8.0 + 10.0, 4), 3.0) * 3.0;
        density = falloff * (clouds * 0.6 + knots * 0.4);

        // Color: warm red/orange with bright white knots
        finalColor = mix(uColor3, uColor1, clouds);
        finalColor = mix(finalColor, vec3(1.5, 1.3, 1.0), knots * 0.5);
        finalColor += uColor2 * falloff * 0.15;

    } else {
        // === BLUE BUBBLE ===
        // Smooth expanding shell in blue-white
        float innerR = 0.55;
        float outerR = 0.75;
        float shell = smoothstep(innerR - 0.1, innerR, dist) * (1.0 - smoothstep(outerR, outerR + 0.2, dist));
        float surface = fbm(animPos * 5.0, 4) * 0.6 + 0.4;
        density = shell * surface;

        // Bright edge glow
        float edgeBright = smoothstep(innerR, outerR, dist) * (1.0 - smoothstep(outerR, outerR + 0.1, dist));
        finalColor = uColor1 * shell + vec3(0.8, 0.9, 1.0) * edgeBright * 2.0;
        finalColor += uColor2 * 0.1 * (1.0 - dist);
    }

    // Center glow for all styles
    float centerGlow = exp(-dist * dist * 8.0) * 0.4;
    finalColor += vec3(1.0, 0.9, 0.8) * centerGlow;

    // Clamp density
    density = clamp(density, 0.0, 1.0);

    // Viewing angle: fresnel-like edge brightening
    float viewDot = abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)));
    float fresnel = pow(1.0 - viewDot, 1.5) * 0.3 + 0.7;
    density *= fresnel;

    // Alpha from density
    float alpha = density * 0.65;

    // Discard fully transparent fragments
    if (alpha < 0.005) discard;

    gl_FragColor = vec4(finalColor * (1.0 + density * 0.5), alpha);
}
`;

function NebulaMesh({ object, isSelected, isHovered, onSelect, onHover }: ObjectMeshProps) {
    const groupRef = useRef<THREE.Group>(null);
    const shaderRef = useRef<THREE.ShaderMaterial>(null);
    const pos = object.state.position;

    // Nebula extent determines visual size
    const nebulaObj = object as any;
    const extent = nebulaObj.extent || { x: 50, y: 50, z: 50 };
    const baseRadius = Math.max(extent.x, extent.y, extent.z);

    // Parse nebula style from metadata tags (nebulaStyle_0 through nebulaStyle_3)
    const nebulaStyle = useMemo(() => {
        const tags = object.metadata?.tags || [];
        for (const tag of tags) {
            const match = tag.match(/nebulaStyle_(\d)/);
            if (match) return parseInt(match[1], 10);
        }
        return Math.floor(Math.random() * 4); // Fallback random
    }, [object.metadata?.tags]);

    // Style-based color palettes
    const colors = useMemo(() => {
        switch (nebulaStyle) {
            case 0: // Ring nebula: blue core, green-blue mid, pink filaments
                return {
                    c1: new THREE.Color('#4488ff'),
                    c2: new THREE.Color('#66ddcc'),
                    c3: new THREE.Color('#ff4488'),
                };
            case 1: // Supernova remnant: blue shell, orange-gold, red filaments
                return {
                    c1: new THREE.Color('#4499ff'),
                    c2: new THREE.Color('#ffaa33'),
                    c3: new THREE.Color('#ff3344'),
                };
            case 2: // Emission nebula: red dominant, blue knots, white hot
                return {
                    c1: new THREE.Color('#ff6644'),
                    c2: new THREE.Color('#4488ff'),
                    c3: new THREE.Color('#ff3366'),
                };
            case 3: // Blue bubble: blue-white shell
            default:
                return {
                    c1: new THREE.Color('#4488ff'),
                    c2: new THREE.Color('#88ccff'),
                    c3: new THREE.Color('#aaddff'),
                };
        }
    }, [nebulaStyle]);

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uRadius: { value: baseRadius },
        uStyle: { value: nebulaStyle },
        uColor1: { value: colors.c1 },
        uColor2: { value: colors.c2 },
        uColor3: { value: colors.c3 },
    }), [baseRadius, nebulaStyle, colors]);

    // Animate shader time
    useFrame((state) => {
        if (shaderRef.current) {
            shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return (
        <group ref={groupRef} position={[pos.x, pos.y, pos.z]}>
            {/* Main nebula sphere with procedural shader */}
            <mesh
                onClick={onSelect}
                onPointerOver={() => onHover(true)}
                onPointerOut={() => onHover(false)}
            >
                <sphereGeometry args={[baseRadius, 64, 64]} />
                <shaderMaterial
                    ref={shaderRef}
                    vertexShader={nebulaVertexShader}
                    fragmentShader={nebulaFragmentShader}
                    uniforms={uniforms}
                    transparent
                    depthWrite={false}
                    side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending}
                    toneMapped={false}
                />
            </mesh>

            {/* Center point light */}
            <pointLight
                color={colors.c1}
                intensity={1.5}
                distance={baseRadius * 3}
                decay={2}
            />

            {/* Selection ring */}
            {isSelected && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[baseRadius * 1.1, baseRadius * 1.12, 64]} />
                    <meshBasicMaterial color="#44aaff" transparent opacity={0.8} side={THREE.DoubleSide} />
                </mesh>
            )}
        </group>
    );
}

/**
 * Gas cloud mesh — semi-transparent glowing sphere for gas debris
 */
function GasCloudMesh({ object, isSelected, isHovered, onSelect, onHover }: ObjectMeshProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const pos = object.state.position;

    const color = useMemo(() => new THREE.Color(object.visual.color || '#4488ff'), [object.visual.color]);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.y = state.clock.elapsedTime * 0.05;
        }
    });

    return (
        <group position={[pos.x, pos.y, pos.z]}>
            <mesh
                ref={meshRef}
                onClick={onSelect}
                onPointerOver={() => onHover(true)}
                onPointerOut={() => onHover(false)}
            >
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.2}
                    depthWrite={false}
                    toneMapped={false}
                    blending={THREE.AdditiveBlending}
                    side={THREE.DoubleSide}
                />
            </mesh>
            {/* Outer halo */}
            <mesh scale={1.6}>
                <sphereGeometry args={[0.5, 12, 12]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.06}
                    depthWrite={false}
                    toneMapped={false}
                    blending={THREE.AdditiveBlending}
                    side={THREE.BackSide}
                />
            </mesh>
        </group>
    );
}

/**
 * Generic cosmic object renderer
 */
function CosmicObjectRenderer({ object }: { object: CosmicObject }) {
    const selectedIds = useSimulationStore((s) => s.selection.selectedIds);
    const hoveredId = useSimulationStore((s) => s.selection.hoveredId);
    const select = useSimulationStore((s) => s.select);
    const setHovered = useSimulationStore((s) => s.setHovered);

    const isSelected = selectedIds.includes(object.id);
    const isHovered = hoveredId === object.id;

    const handleSelect = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        select([object.id]);
    };
    const handleHover = (hovering: boolean) => setHovered(hovering ? object.id : null);

    const props = { object, isSelected, isHovered, onSelect: handleSelect, onHover: handleHover };

    // Check if this is debris
    if (object.metadata?.tags?.includes('debris')) {
        return <DebrisMesh {...props} />;
    }

    switch (object.type) {
        case CosmicObjectType.STAR:
            return <StarMesh {...props} />;
        case CosmicObjectType.PLANET:
        case CosmicObjectType.MOON:
            return <PlanetMesh {...props} />;
        case CosmicObjectType.BLACK_HOLE:
            return <BlackHoleMesh {...props} />;
        case CosmicObjectType.NEUTRON_STAR:
            return <NeutronStarMesh {...props} />;
        case CosmicObjectType.NEBULA:
            return <NebulaMesh {...props} />;
        case CosmicObjectType.GAS_CLOUD:
            return <GasCloudMesh {...props} />;
        default:
            return <PlanetMesh {...props} />;
    }
}

/**
 * Grid and Axes overlay - hidden in observation mode
 */
function GridAndAxesOverlay() {
    const mode = useSimulationStore((s) => s.mode);
    if (mode === 'observation') return null;

    return (
        <>
            <gridHelper
                args={[1000, 100, '#1a1a25', '#12121a']}
                position={[0, 0, 0]}
                rotation={[Math.PI / 2, 0, 0]}
            />
            <axesHelper args={[50]} />
        </>
    );
}

/**
 * Placement preview - ghost object with TWO-PHASE PLACEMENT
 */
function PlacementPreview() {
    const isPlacing = usePlacementStore((s) => s.isPlacing);
    const phase = usePlacementStore((s) => s.phase);
    const objectType = usePlacementStore((s) => s.objectType);
    const cursorPosition = usePlacementStore((s) => s.cursorPosition);
    const fixedPosition = usePlacementStore((s) => s.fixedPosition);
    const velocityVector = usePlacementStore((s) => s.velocityVector);
    const yOffset = usePlacementStore((s) => s.yOffset);
    const updateCursorPosition = usePlacementStore((s) => s.updateCursorPosition);
    const setYOffset = usePlacementStore((s) => s.setYOffset);
    const confirmPosition = usePlacementStore((s) => s.confirmPosition);
    const confirmPlacement = usePlacementStore((s) => s.confirmPlacement);
    const cancelPlacement = usePlacementStore((s) => s.cancelPlacement);
    const addObject = useSimulationStore((s) => s.addObject);
    const objects = useSimulationStore((s) => s.objects);

    const { camera, raycaster, pointer } = useThree();
    const planeRef = useRef<THREE.Mesh>(null);

    // Mouse wheel handler for Y-axis control
    useEffect(() => {
        if (!isPlacing) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.5 : 0.5;
            setYOffset(yOffset + delta);
        };

        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, [isPlacing, yOffset, setYOffset]);

    // Track mouse position
    useFrame(() => {
        if (!isPlacing) return;
        raycaster.setFromCamera(pointer, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersection);

        if (intersection) {
            updateCursorPosition(new Vector3(intersection.x, 0, intersection.z));
        }
    });

    // Trajectory prediction
    const trajectoryPoints = useMemo(() => {
        if (phase !== 'velocity' || !fixedPosition) return [];

        const points: THREE.Vector3[] = [];
        let pos = new Vector3(fixedPosition.x, fixedPosition.y, fixedPosition.z);
        let vel = new Vector3(velocityVector.x, velocityVector.y, velocityVector.z);

        const dt = 0.05;
        const steps = 100;

        for (let i = 0; i < steps; i++) {
            points.push(new THREE.Vector3(pos.x, pos.y, pos.z));

            let accX = 0, accY = 0, accZ = 0;
            for (const obj of objects.values()) {
                const dx = obj.state.position.x - pos.x;
                const dy = obj.state.position.y - pos.y;
                const dz = obj.state.position.z - pos.z;
                const distSq = dx * dx + dy * dy + dz * dz + 1;
                const dist = Math.sqrt(distSq);

                // Match scene-scale gravity from nbody.ts
                const mass1 = Math.max(Math.log10(Math.max(obj.properties.mass, 1)), 1);
                const G = 20.0;
                const accMag = (G * mass1) / Math.max(distSq, 1.0);

                if (dist > 0.1) {
                    accX += (accMag * dx) / dist;
                    accY += (accMag * dy) / dist;
                    accZ += (accMag * dz) / dist;
                }
            }

            vel = new Vector3(vel.x + accX * dt, vel.y + accY * dt, vel.z + accZ * dt);
            pos = new Vector3(pos.x + vel.x * dt, pos.y + vel.y * dt, pos.z + vel.z * dt);
        }

        return points;
    }, [phase, fixedPosition, velocityVector, objects]);

    const handleClick = () => {
        if (!isPlacing || !objectType) return;

        if (phase === 'positioning') {
            confirmPosition();
        } else if (phase === 'velocity') {
            const placement = confirmPlacement();
            if (placement) {
                let newObject;
                const config = placement.config as Record<string, unknown>;

                switch (placement.type) {
                    case CosmicObjectType.STAR:
                        newObject = createStar({
                            position: placement.position,
                            velocity: placement.velocity,
                            spectralClass: (config.spectralClass as SpectralClass) ?? SpectralClass.G,
                        });
                        break;
                    case CosmicObjectType.PLANET:
                        newObject = createPlanet({
                            position: placement.position,
                            velocity: placement.velocity,
                        });
                        break;
                    case CosmicObjectType.BLACK_HOLE:
                        newObject = createBlackHole({
                            position: placement.position,
                            velocity: placement.velocity,
                            massSolarUnits: 10 + Math.random() * 40,
                        });
                        break;
                    case CosmicObjectType.NEUTRON_STAR:
                        newObject = createNeutronStar({
                            position: placement.position,
                            velocity: placement.velocity,
                        });
                        break;
                    default:
                        newObject = createPlanet({
                            position: placement.position,
                            velocity: placement.velocity,
                        });
                }

                addObject(newObject);
                console.log(`[Placement] Created ${newObject.metadata.name} with velocity`, placement.velocity.toArray());
            }
        }
    };

    const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
        if (isPlacing) {
            e.stopPropagation();
            cancelPlacement();
        }
    };

    if (!isPlacing || !objectType) return null;

    const colorMap: Record<string, string> = {
        [CosmicObjectType.STAR]: '#fff4ea',
        [CosmicObjectType.PLANET]: '#8b7355',
        [CosmicObjectType.BLACK_HOLE]: '#7c5cff',
        [CosmicObjectType.NEUTRON_STAR]: '#aaccff',
    };
    const previewColor = colorMap[objectType] ?? '#ffffff';

    const displayPosition = phase === 'velocity' && fixedPosition
        ? fixedPosition.toArray()
        : cursorPosition.toArray();

    return (
        <>
            {/* Invisible click plane */}
            <mesh
                ref={planeRef}
                position={[0, 0, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                visible={false}
            >
                <planeGeometry args={[10000, 10000]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            {/* Ghost preview */}
            <group position={displayPosition}>
                <mesh>
                    <sphereGeometry args={[1, 32, 32]} />
                    <meshStandardMaterial
                        color={previewColor}
                        transparent
                        opacity={0.35}
                        emissive={previewColor}
                        emissiveIntensity={0.4}
                        roughness={0.4}
                        metalness={0.1}
                    />
                </mesh>
                <mesh scale={1.3}>
                    <sphereGeometry args={[1, 16, 16]} />
                    <meshBasicMaterial
                        color={previewColor}
                        transparent
                        opacity={0.15}
                        side={THREE.BackSide}
                        depthWrite={false}
                    />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[1.5, 1.6, 32]} />
                    <meshBasicMaterial
                        color={previewColor}
                        transparent
                        opacity={0.6}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            </group>

            {/* Velocity arrow */}
            {phase === 'velocity' && fixedPosition && velocityVector.length() > 0.01 && (
                <group position={fixedPosition.toArray()}>
                    <line>
                        <bufferGeometry>
                            <bufferAttribute
                                attach="attributes-position"
                                count={2}
                                array={new Float32Array([
                                    0, 0, 0,
                                    velocityVector.x * 5, velocityVector.y * 5, velocityVector.z * 5
                                ])}
                                itemSize={3}
                            />
                        </bufferGeometry>
                        <lineBasicMaterial color="#ffffff" linewidth={3} />
                    </line>

                    <mesh
                        position={[
                            velocityVector.x * 5,
                            velocityVector.y * 5,
                            velocityVector.z * 5
                        ]}
                        rotation={[
                            Math.PI / 2,
                            0,
                            Math.atan2(velocityVector.x, velocityVector.z)
                        ]}
                    >
                        <coneGeometry args={[0.3, 0.8, 8]} />
                        <meshBasicMaterial color="#ffffff" />
                    </mesh>
                </group>
            )}

            {/* Trajectory curve */}
            {phase === 'velocity' && trajectoryPoints.length > 1 && (
                <line>
                    <bufferGeometry>
                        <bufferAttribute
                            attach="attributes-position"
                            count={trajectoryPoints.length}
                            array={new Float32Array(trajectoryPoints.flatMap(p => [p.x, p.y, p.z]))}
                            itemSize={3}
                        />
                    </bufferGeometry>
                    <lineBasicMaterial color="#ffffff" transparent opacity={0.8} />
                </line>
            )}
        </>
    );
}

/**
 * Main scene content
 */
function SceneContent() {
    const objects = useSimulationStore((s) => s.objects);
    const updatePerformance = useSimulationStore((s) => s.updatePerformance);

    return (
        <>
            {/* Performance tracking */}
            <PerformanceStats
                onUpdate={(fps, renderTime) => updatePerformance({ fps, renderTime })}
            />

            {/* Camera sync */}
            <CameraController />

            {/* Placement preview */}
            <PlacementPreview />

            {/* Environment & Lighting */}
            <Environment preset="night" blur={0.5} />
            <color attach="background" args={['#000005']} />
            <ambientLight intensity={0.08} />
            <pointLight position={[0, 0, 0]} intensity={0.5} />

            {/* Background stars using drei Stars (GPU-efficient points) */}
            <Stars
                radius={500}
                depth={200}
                count={5000}
                factor={3}
                saturation={0.1}
                fade
                speed={0.3}
            />

            {/* Grid and Axes */}
            <GridAndAxesOverlay />

            {/* Render all cosmic objects */}
            {Array.from(objects.values()).map((obj) => (
                <CosmicObjectRenderer key={obj.id} object={obj} />
            ))}

            {/* Collision particle effects */}
            <CollisionParticles />

            {/* Orbit controls */}
            <OrbitControls
                makeDefault
                enablePan
                enableZoom
                enableRotate
                minDistance={1}
                maxDistance={10000}
                zoomSpeed={1.5}
            />

            {/* Post-processing effects (bloom, vignette, SMAA) */}
            <PostProcessing />
        </>
    );
}

/**
 * Main 3D Scene component
 */
export function Scene() {
    const cameraState = useCameraState();

    return (
        <Canvas
            gl={{
                antialias: false, // Handled by SMAA post-processing
                powerPreference: 'high-performance',
                alpha: false,
                stencil: false,
                depth: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.0,
                outputColorSpace: THREE.SRGBColorSpace,
            }}
            dpr={[1, 1.5]}
            style={{ background: '#000' }}
        >
            {/* Adaptive performance */}
            <AdaptiveDpr pixelated />
            <AdaptiveEvents />

            {/* Camera */}
            <PerspectiveCamera
                makeDefault
                position={cameraState.position}
                fov={cameraState.fov}
                near={cameraState.near}
                far={cameraState.far}
            />

            {/* Scene content */}
            <SceneContent />
        </Canvas>
    );
}

export default Scene;
