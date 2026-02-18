/**
 * Collision Particle Effects — Type-Based Visual System
 * 
 * Renders GPU-instanced particle bursts at collision points.
 * Each collision type spawns up to 10,000 particles with distinct
 * colors, speeds, patterns, and lifetimes.
 * 
 * Features:
 *   - Massive bright flash sphere at collision center (bloom-triggering)
 *   - Hot plasma, ionized gas, and debris particles with additive blending
 *   - Slow, grand expansion simulating real stellar collision timescales
 *   - Single explosion per collision (no cascading sub-explosions)
 * 
 * Collision types:
 *   rocky_collision    → White→orange→red spherical explosion
 *   gas_collision      → Blue/purple/white, slow expansion, semi-transparent
 *   stellar_collision  → Blindingly bright white→pink→blue→purple, slow expansion
 *   kilonova           → Phase 1: explosive outward, Phase 2: collapse inward
 *   blackhole_merger   → Dim purple/blue expanding ring, very fast fade
 *   tidal_disruption   → Spiral/orbital pattern around center
 */

import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCollisionEvents } from '@/store';
import { CollisionType } from '@/engine/physics/types';

const PARTICLES_PER_BURST = 10000;
const MAX_ACTIVE_BURSTS = 1;

// Per-type configuration
interface TypeConfig {
    lifetime: number;
    baseSpeed: number;
    speedVariance: number;
    baseScale: number;
    colors: string[];          // Color gradient stages (hot plasma → cooling gas)
    gravity: number;           // Downward pull
    fadeRate: number;           // How fast opacity drops (multiplier on t)
    pattern: 'sphere' | 'ring' | 'spiral';
    collapsePhase?: number;    // Time fraction where particles reverse (kilonova)
    flashRadius: number;       // Initial radius of the bright flash sphere
    flashDuration: number;     // How long the flash lasts (seconds)
    flashIntensity: number;    // Peak emissive intensity for bloom (values > 1 trigger bloom)
}

const TYPE_CONFIGS: Record<CollisionType, TypeConfig> = {
    rocky_collision: {
        lifetime: 10.0,
        baseSpeed: 0.6,
        speedVariance: 2.5,
        baseScale: 0.15,
        colors: ['#ffffff', '#ffcc88', '#ff6622', '#441100'],
        gravity: -0.3,
        fadeRate: 0.5,
        pattern: 'sphere',
        flashRadius: 3.0,
        flashDuration: 4.0,
        flashIntensity: 8.0,
    },
    gas_collision: {
        lifetime: 12.0,
        baseSpeed: 0.3,
        speedVariance: 1.5,
        baseScale: 0.25,
        colors: ['#ffffff', '#aaccff', '#6688ff', '#221144'],
        gravity: -0.1,
        fadeRate: 0.4,
        pattern: 'sphere',
        flashRadius: 4.0,
        flashDuration: 5.0,
        flashIntensity: 10.0,
    },
    stellar_collision: {
        lifetime: 15.0,
        baseSpeed: 0.8,
        speedVariance: 3.0,
        baseScale: 0.2,
        colors: ['#ffffff', '#ffddff', '#cc88ff', '#4422aa'],
        gravity: -0.05,
        fadeRate: 0.35,
        pattern: 'sphere',
        flashRadius: 10.0,
        flashDuration: 8.0,
        flashIntensity: 150.0,  // Blindingly bright — saturates bloom for total white-out
    },
    kilonova: {
        lifetime: 20.0,
        baseSpeed: 1.0,
        speedVariance: 4.0,
        baseScale: 0.18,
        colors: ['#ffffff', '#ddccff', '#8866ff', '#220044'],
        gravity: 0,
        fadeRate: 0.3,
        pattern: 'sphere',
        collapsePhase: 0.45,
        flashRadius: 10.0,
        flashDuration: 8.0,
        flashIntensity: 80.0,
    },
    blackhole_merger: {
        lifetime: 2.0,
        baseSpeed: 3.0,
        speedVariance: 10.0,
        baseScale: 0.06,
        colors: ['#6644aa', '#4422aa', '#220066', '#000000'],
        gravity: 0,
        fadeRate: 2.5,
        pattern: 'ring',
        flashRadius: 2.0,
        flashDuration: 1.0,
        flashIntensity: 5.0,
    },
    tidal_disruption: {
        lifetime: 5.0,
        baseSpeed: 2.0,
        speedVariance: 6.0,
        baseScale: 0.12,
        colors: ['#ffffff', '#ffdd66', '#88aaff', '#222244'],
        gravity: 0,
        fadeRate: 0.9,
        pattern: 'spiral',
        flashRadius: 3.0,
        flashDuration: 3.0,
        flashIntensity: 15.0,
    },
};

// Temp objects to avoid GC
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();

interface BurstProps {
    id: string;
    position: [number, number, number];
    timestamp: number;
    energy: number;
    collisionType: CollisionType;
}

/**
 * Bright flash sphere that masks the disappearance of colliding objects
 * Uses additive blending and high emissive values to trigger bloom
 */
function CollisionFlash({ burst }: { burst: BurstProps }) {
    const outerRef = useRef<THREE.Mesh>(null);
    const innerRef = useRef<THREE.Mesh>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const startTimeRef = useRef(Date.now());
    const [visible, setVisible] = useState(true);

    const config = TYPE_CONFIGS[burst.collisionType] || TYPE_CONFIGS.rocky_collision;

    useEffect(() => {
        startTimeRef.current = burst.timestamp;
    }, [burst.timestamp]);

    useFrame(() => {
        if (!visible) return;
        const elapsed = (Date.now() - startTimeRef.current) / 1000;

        // Extended flash duration for dramatic effect
        const totalDuration = Math.max(config.flashDuration, 8.0);
        if (elapsed > totalDuration) {
            setVisible(false);
            return;
        }

        const t = elapsed / totalDuration; // 0→1

        // Flash expansion: radius 0 → flashRadius in first 0.5 seconds (ease-out)
        const expandT = Math.min(elapsed / 0.5, 1.0);
        const expandEase = 1 - Math.pow(1 - expandT, 3); // Cubic ease-out
        const baseScale = config.flashRadius * expandEase;

        // After expansion, slowly shrink over remaining time
        const shrinkPhase = t > 0.06 ? (t - 0.06) / 0.94 : 0;
        const scale = baseScale * (1 - shrinkPhase * 0.4);

        // Opacity: full white-out for first 0.3s, then quadratic fade
        const whiteoutPhase = Math.min(elapsed / 0.3, 1.0);
        const fadePhase = elapsed > 0.3 ? (elapsed - 0.3) / (totalDuration - 0.3) : 0;
        const opacity = whiteoutPhase * (1 - fadePhase * fadePhase) * 0.98;

        // Extreme emissive intensity for bloom saturation (150+ peak)
        const peakIntensity = Math.max(config.flashIntensity, 100);
        const emissiveIntensity = peakIntensity * (1 - fadePhase * fadePhase);

        // Core: pure white, most intense
        if (coreRef.current) {
            const coreScale = scale * 0.4;
            coreRef.current.scale.setScalar(Math.max(coreScale, 0.01));
            const coreMat = coreRef.current.material as THREE.MeshBasicMaterial;
            coreMat.opacity = opacity;
            coreMat.color.setRGB(
                emissiveIntensity * 2,
                emissiveIntensity * 2,
                emissiveIntensity * 2
            );
        }

        // Inner glow: white-pink, slightly larger
        if (innerRef.current) {
            const innerScale = scale * 0.8;
            innerRef.current.scale.setScalar(Math.max(innerScale, 0.01));
            const innerMat = innerRef.current.material as THREE.MeshBasicMaterial;
            innerMat.opacity = opacity * 0.8;
            innerMat.color.setRGB(
                emissiveIntensity * 1.5,
                emissiveIntensity * 1.2,
                emissiveIntensity * 1.8
            );
        }

        // Outer halo: pink-purple, largest, more transparent
        if (outerRef.current) {
            outerRef.current.scale.setScalar(Math.max(scale, 0.01));
            const outerMat = outerRef.current.material as THREE.MeshBasicMaterial;
            outerMat.opacity = opacity * 0.5;
            outerMat.color.setRGB(
                emissiveIntensity * 0.8,
                emissiveIntensity * 0.4,
                emissiveIntensity * 1.2
            );
        }
    });

    if (!visible) return null;

    return (
        <group position={burst.position}>
            {/* Core white flash */}
            <mesh ref={coreRef}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={1}
                    depthWrite={false}
                    toneMapped={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>
            {/* Inner glow */}
            <mesh ref={innerRef}>
                <sphereGeometry args={[1, 24, 24]} />
                <meshBasicMaterial
                    color="#ffccff"
                    transparent
                    opacity={0.8}
                    depthWrite={false}
                    toneMapped={false}
                    blending={THREE.AdditiveBlending}
                    side={THREE.DoubleSide}
                />
            </mesh>
            {/* Outer halo */}
            <mesh ref={outerRef}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial
                    color="#8844ff"
                    transparent
                    opacity={0.4}
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
 * Particle burst — hot plasma, ionized gas, and debris
 * Uses additive blending for intense brightness
 */
function CollisionBurst({ burst, onComplete }: { burst: BurstProps; onComplete: (id: string) => void }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const startTimeRef = useRef(Date.now());
    const velocitiesRef = useRef<Float32Array>(new Float32Array(0));
    const particleTypesRef = useRef<Uint8Array>(new Uint8Array(0));
    const initialized = useRef(false);

    const config = TYPE_CONFIGS[burst.collisionType] || TYPE_CONFIGS.rocky_collision;

    // Plasma/gas color palettes
    const plasmaColors = useMemo(() => [
        new THREE.Color('#ffffff'),  // White hot
        new THREE.Color('#ffddff'),  // Pink-white
        new THREE.Color('#ff88cc'),  // Hot pink
        new THREE.Color('#cc44ff'),  // Violet
    ], []);

    const gasColors = useMemo(() => [
        new THREE.Color('#aaccff'),  // Blue-white
        new THREE.Color('#6688ff'),  // Blue
        new THREE.Color('#8844cc'),  // Purple
        new THREE.Color('#331166'),  // Dark purple
    ], []);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        startTimeRef.current = burst.timestamp;

        // Generate velocities and particle types
        const vels = new Float32Array(PARTICLES_PER_BURST * 3);
        const types = new Uint8Array(PARTICLES_PER_BURST); // 0=plasma, 1=gas, 2=debris

        for (let i = 0; i < PARTICLES_PER_BURST; i++) {
            const idx = i * 3;
            const rand = Math.random();

            // Assign particle type: 40% plasma, 35% gas, 25% debris
            if (rand < 0.4) types[i] = 0; // hot plasma
            else if (rand < 0.75) types[i] = 1; // ionized gas
            else types[i] = 2; // debris

            // Speed varies by particle type
            const typeSpeedMul = types[i] === 0 ? 1.2 : types[i] === 1 ? 0.7 : 1.0;

            if (config.pattern === 'ring') {
                const angle = (i / PARTICLES_PER_BURST) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
                const speed = (config.baseSpeed + Math.random() * config.speedVariance) * typeSpeedMul;
                const ySpread = (Math.random() - 0.5) * 1.5;
                vels[idx + 0] = Math.cos(angle) * speed;
                vels[idx + 1] = ySpread;
                vels[idx + 2] = Math.sin(angle) * speed;
            } else if (config.pattern === 'spiral') {
                const angle = (i / PARTICLES_PER_BURST) * Math.PI * 6 + Math.random() * 0.5;
                const speed = (config.baseSpeed + Math.random() * config.speedVariance) * typeSpeedMul;
                const tangentX = -Math.sin(angle) * speed * 0.8;
                const tangentZ = Math.cos(angle) * speed * 0.8;
                const outX = Math.cos(angle) * speed * 0.3;
                const outZ = Math.sin(angle) * speed * 0.3;
                vels[idx + 0] = tangentX + outX;
                vels[idx + 1] = (Math.random() - 0.5) * 0.5;
                vels[idx + 2] = tangentZ + outZ;
            } else {
                // Sphere pattern
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const speed = (config.baseSpeed + Math.random() * config.speedVariance) * typeSpeedMul;
                vels[idx + 0] = Math.sin(phi) * Math.cos(theta) * speed;
                vels[idx + 1] = Math.sin(phi) * Math.sin(theta) * speed;
                vels[idx + 2] = Math.cos(phi) * speed;
            }
        }

        velocitiesRef.current = vels;
        particleTypesRef.current = types;

        // Set initial instance matrices
        if (meshRef.current) {
            for (let i = 0; i < PARTICLES_PER_BURST; i++) {
                _dummy.position.set(burst.position[0], burst.position[1], burst.position[2]);
                const s = config.baseScale * (types[i] === 1 ? 1.8 : 1.0); // Gas particles are larger
                _dummy.scale.set(s, s, s);
                _dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, _dummy.matrix);
                meshRef.current.setColorAt(i, new THREE.Color('#ffffff'));
            }
            meshRef.current.instanceMatrix.needsUpdate = true;
            if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
        }
    }, [burst]);

    useFrame(() => {
        if (!meshRef.current || velocitiesRef.current.length === 0) return;

        const elapsed = (Date.now() - startTimeRef.current) / 1000;

        // After lifetime, particles persist as nebular remnant — never call onComplete
        // t is clamped so particles decelerate and stay in place
        const t = Math.min(elapsed / config.lifetime, 1.0);
        // Deceleration factor: particles slow down as t approaches 1
        const speedFactor = Math.max(0, 1 - t * t);
        const vels = velocitiesRef.current;
        const types = particleTypesRef.current;

        // Kilonova collapse: reverse direction after collapse phase
        let collapseForce = 0;
        if (config.collapsePhase && t > config.collapsePhase) {
            const collapseT = (t - config.collapsePhase) / (1 - config.collapsePhase);
            collapseForce = -collapseT * 15.0;
        }

        for (let i = 0; i < PARTICLES_PER_BURST; i++) {
            const idx = i * 3;
            const vx = vels[idx + 0];
            const vy = vels[idx + 1];
            const vz = vels[idx + 2];
            const pType = types[i];

            // Position: origin + vel*t with deceleration
            // Use effectiveElapsed that slows down as t approaches 1
            const effectiveElapsed = elapsed * speedFactor + config.lifetime * (1 - speedFactor);
            let px = burst.position[0] + vx * effectiveElapsed;
            let py = burst.position[1] + vy * effectiveElapsed + 0.5 * config.gravity * effectiveElapsed * effectiveElapsed;
            let pz = burst.position[2] + vz * effectiveElapsed;

            // Kilonova collapse
            if (collapseForce !== 0) {
                const dx = px - burst.position[0];
                const dy = py - burst.position[1];
                const dz = pz - burst.position[2];
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
                px += (dx / dist) * collapseForce * elapsed * 0.1;
                py += (dy / dist) * collapseForce * elapsed * 0.1;
                pz += (dz / dist) * collapseForce * elapsed * 0.1;
            }

            // Scale: gas particles stay larger, plasma shrinks faster
            const typeSizeMultiplier = pType === 1 ? 1.8 : pType === 0 ? 1.2 : 1.0;
            const scale = Math.max(0.01, config.baseScale * typeSizeMultiplier * (1 - t * 0.5));

            _dummy.position.set(px, py, pz);
            _dummy.scale.set(scale, scale, scale);
            _dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, _dummy.matrix);

            // Color based on particle type
            const variation = ((i * 31) % 100) / 100 * 0.2;

            // Color progression through time
            let segIdx: number;
            let segT: number;
            if (t < 0.15) {
                segIdx = 0; segT = t / 0.15;
            } else if (t < 0.45) {
                segIdx = 1; segT = (t - 0.15) / 0.3;
            } else {
                segIdx = 2; segT = Math.min(1, (t - 0.45) / 0.55);
            }

            if (pType === 0) {
                // Hot plasma: white → pink → violet → dark
                _colorA.copy(plasmaColors[segIdx]);
                _colorB.copy(plasmaColors[Math.min(segIdx + 1, 3)]);
            } else if (pType === 1) {
                // Ionized gas: blue-white → blue → purple → dark purple
                _colorA.copy(gasColors[segIdx]);
                _colorB.copy(gasColors[Math.min(segIdx + 1, 3)]);
            } else {
                // Debris: follows config colors
                const colors = config.colors;
                _colorA.set(colors[segIdx]);
                _colorB.set(colors[Math.min(segIdx + 1, colors.length - 1)]);
            }

            _color.lerpColors(_colorA, _colorB, Math.min(1, segT + variation));

            // Boost brightness for early particles (emissive boost)
            const brightnessBoost = pType === 0 ? 3.0 : pType === 1 ? 2.0 : 1.5;
            const earlyBoost = t < 0.3 ? (1 - t / 0.3) * brightnessBoost : 0;
            _color.r = Math.min(_color.r * (1 + earlyBoost), 10);
            _color.g = Math.min(_color.g * (1 + earlyBoost), 10);
            _color.b = Math.min(_color.b * (1 + earlyBoost), 10);

            meshRef.current!.setColorAt(i, _color);
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

        // Fade material opacity — never go below 0.08 so particles stay visible as nebular remnant
        const mat = meshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0.08, 1 - t * config.fadeRate);
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, PARTICLES_PER_BURST]}
            frustumCulled={false}
        >
            <sphereGeometry args={[1, 6, 6]} />
            <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={1}
                depthWrite={false}
                toneMapped={false}
                blending={THREE.AdditiveBlending}
            />
        </instancedMesh>
    );
}

export function CollisionParticles() {
    const collisionEvents = useCollisionEvents();
    const activeRef = useRef<Set<string>>(new Set());
    const handledRef = useRef<Set<string>>(new Set());

    // Only show recent events that haven't been fully handled
    const activeBursts = useMemo(() => {
        const now = Date.now();
        return collisionEvents
            .filter(e => {
                const age = (now - e.timestamp) / 1000;
                return age < 999999 && !handledRef.current.has(e.id);
            })
            .slice(-MAX_ACTIVE_BURSTS);
    }, [collisionEvents]);

    const handleComplete = (id: string) => {
        handledRef.current.add(id);
        activeRef.current.delete(id);
    };

    return (
        <>
            {activeBursts.map((burst) => (
                <group key={burst.id}>
                    {/* Massive bright flash sphere — masks disappearance of objects */}
                    <CollisionFlash burst={burst} />
                    {/* Particle burst — plasma, gas, debris */}
                    <CollisionBurst
                        burst={burst}
                        onComplete={handleComplete}
                    />
                </group>
            ))}
        </>
    );
}

export default CollisionParticles;
