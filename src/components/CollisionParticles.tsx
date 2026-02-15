/**
 * Collision Particle Effects — Type-Based Visual System
 * 
 * Renders GPU-instanced particle bursts at collision points.
 * Each collision type spawns up to 10,000 particles with distinct
 * colors, speeds, patterns, and lifetimes.
 * 
 * Collision types:
 *   rocky_collision    → White→orange→red spherical explosion
 *   gas_collision      → Blue/purple/white, slow expansion, semi-transparent
 *   stellar_collision  → White/blue/orange, very fast/wide spread, bright
 *   kilonova           → Phase 1: explosive outward, Phase 2: collapse inward
 *   blackhole_merger   → Dim purple/blue expanding ring, very fast fade
 *   tidal_disruption   → Spiral/orbital pattern around center
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCollisionEvents } from '@/store';
import { CollisionType } from '@/engine/physics/types';

const PARTICLES_PER_BURST = 10000;
const MAX_ACTIVE_BURSTS = 10;

// Per-type configuration
interface TypeConfig {
    lifetime: number;
    baseSpeed: number;
    speedVariance: number;
    baseScale: number;
    colors: string[];          // Color gradient stages
    gravity: number;           // Downward pull
    fadeRate: number;           // How fast opacity drops (multiplier on t)
    pattern: 'sphere' | 'ring' | 'spiral';
    collapsePhase?: number;    // Time fraction where particles reverse (kilonova)
}

const TYPE_CONFIGS: Record<CollisionType, TypeConfig> = {
    rocky_collision: {
        lifetime: 3.5,
        baseSpeed: 2.0,
        speedVariance: 8.0,
        baseScale: 0.08,
        colors: ['#ffffff', '#ffaa44', '#ff4400', '#330000'],
        gravity: -2.0,
        fadeRate: 1.2,
        pattern: 'sphere',
    },
    gas_collision: {
        lifetime: 4.5,
        baseSpeed: 0.5,
        speedVariance: 2.5,
        baseScale: 0.15,
        colors: ['#4488ff', '#8866cc', '#aaccff', '#221144'],
        gravity: -0.3,
        fadeRate: 0.8,
        pattern: 'sphere',
    },
    stellar_collision: {
        lifetime: 4.0,
        baseSpeed: 4.0,
        speedVariance: 14.0,
        baseScale: 0.1,
        colors: ['#ffffff', '#88bbff', '#ffaa44', '#ff3300'],
        gravity: -0.5,
        fadeRate: 1.0,
        pattern: 'sphere',
    },
    kilonova: {
        lifetime: 6.0,
        baseSpeed: 5.0,
        speedVariance: 18.0,
        baseScale: 0.07,
        colors: ['#ffffff', '#aaccff', '#6688ff', '#000044'],
        gravity: 0,
        fadeRate: 0.7,
        pattern: 'sphere',
        collapsePhase: 0.45,  // At 45% of lifetime, particles reverse inward
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
    },
    tidal_disruption: {
        lifetime: 5.0,
        baseSpeed: 2.0,
        speedVariance: 6.0,
        baseScale: 0.08,
        colors: ['#ffffff', '#ffdd66', '#88aaff', '#222244'],
        gravity: 0,
        fadeRate: 0.9,
        pattern: 'spiral',
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

function CollisionBurst({ burst, onComplete }: { burst: BurstProps; onComplete: (id: string) => void }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const startTimeRef = useRef(Date.now());
    const velocitiesRef = useRef<Float32Array>(new Float32Array(0));
    const initialized = useRef(false);

    const config = TYPE_CONFIGS[burst.collisionType] || TYPE_CONFIGS.rocky_collision;

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        startTimeRef.current = burst.timestamp;

        // Generate velocities based on collision type pattern
        const vels = new Float32Array(PARTICLES_PER_BURST * 3);

        for (let i = 0; i < PARTICLES_PER_BURST; i++) {
            const idx = i * 3;

            if (config.pattern === 'ring') {
                // Ring pattern: particles expand in XZ plane
                const angle = (i / PARTICLES_PER_BURST) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
                const speed = config.baseSpeed + Math.random() * config.speedVariance;
                const ySpread = (Math.random() - 0.5) * 1.5; // Slight Y variation
                vels[idx + 0] = Math.cos(angle) * speed;
                vels[idx + 1] = ySpread;
                vels[idx + 2] = Math.sin(angle) * speed;

            } else if (config.pattern === 'spiral') {
                // Spiral pattern: tangential + slight outward velocity
                const angle = (i / PARTICLES_PER_BURST) * Math.PI * 6 + Math.random() * 0.5; // 3 full turns
                const r = 0.5 + (i / PARTICLES_PER_BURST) * 3.0; // Increasing radius
                const speed = config.baseSpeed + Math.random() * config.speedVariance;

                // Tangential velocity
                const tangentX = -Math.sin(angle) * speed * 0.8;
                const tangentZ = Math.cos(angle) * speed * 0.8;
                // Slight outward
                const outX = Math.cos(angle) * speed * 0.3;
                const outZ = Math.sin(angle) * speed * 0.3;

                vels[idx + 0] = tangentX + outX;
                vels[idx + 1] = (Math.random() - 0.5) * 0.5;
                vels[idx + 2] = tangentZ + outZ;

            } else {
                // Sphere pattern: uniform random direction
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const speed = config.baseSpeed + Math.random() * config.speedVariance;
                vels[idx + 0] = Math.sin(phi) * Math.cos(theta) * speed;
                vels[idx + 1] = Math.sin(phi) * Math.sin(theta) * speed;
                vels[idx + 2] = Math.cos(phi) * speed;
            }
        }

        velocitiesRef.current = vels;

        // Set initial instance matrices
        if (meshRef.current) {
            for (let i = 0; i < PARTICLES_PER_BURST; i++) {
                _dummy.position.set(burst.position[0], burst.position[1], burst.position[2]);
                _dummy.scale.set(config.baseScale, config.baseScale, config.baseScale);
                _dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, _dummy.matrix);
                meshRef.current.setColorAt(i, new THREE.Color(config.colors[0]));
            }
            meshRef.current.instanceMatrix.needsUpdate = true;
            if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
        }
    }, [burst]);

    useFrame(() => {
        if (!meshRef.current || velocitiesRef.current.length === 0) return;

        const elapsed = (Date.now() - startTimeRef.current) / 1000;

        if (elapsed > config.lifetime) {
            onComplete(burst.id);
            return;
        }

        const t = elapsed / config.lifetime; // 0 → 1
        const vels = velocitiesRef.current;

        // Kilonova collapse: reverse direction after collapse phase
        let timeMultiplier = 1.0;
        let collapseForce = 0;
        if (config.collapsePhase && t > config.collapsePhase) {
            const collapseT = (t - config.collapsePhase) / (1 - config.collapsePhase);
            collapseForce = -collapseT * 15.0; // Pull back toward origin
        }

        // Determine color gradient position (4 colors = 3 segments)
        const colors = config.colors;
        let segIdx: number;
        let segT: number;
        if (t < 0.25) {
            segIdx = 0; segT = t / 0.25;
        } else if (t < 0.55) {
            segIdx = 1; segT = (t - 0.25) / 0.3;
        } else {
            segIdx = 2; segT = Math.min(1, (t - 0.55) / 0.45);
        }
        _colorA.set(colors[segIdx]);
        _colorB.set(colors[Math.min(segIdx + 1, colors.length - 1)]);

        for (let i = 0; i < PARTICLES_PER_BURST; i++) {
            const idx = i * 3;
            const vx = vels[idx + 0];
            const vy = vels[idx + 1];
            const vz = vels[idx + 2];

            // Position: origin + vel*t + 0.5*gravity*t² + collapse force
            let px = burst.position[0] + vx * elapsed;
            let py = burst.position[1] + vy * elapsed + 0.5 * config.gravity * elapsed * elapsed;
            let pz = burst.position[2] + vz * elapsed;

            // Kilonova collapse: add force pulling back toward origin
            if (collapseForce !== 0) {
                const dx = px - burst.position[0];
                const dy = py - burst.position[1];
                const dz = pz - burst.position[2];
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
                px += (dx / dist) * collapseForce * elapsed * 0.1;
                py += (dy / dist) * collapseForce * elapsed * 0.1;
                pz += (dz / dist) * collapseForce * elapsed * 0.1;
            }

            // Scale: shrink over time, type-specific base scale
            const scale = Math.max(0.005, config.baseScale * (1 - t * 0.65));

            _dummy.position.set(px, py, pz);
            _dummy.scale.set(scale, scale, scale);
            _dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, _dummy.matrix);

            // Color: interpolate with slight per-particle variation
            const variation = ((i * 31) % 100) / 100 * 0.15; // Deterministic variation
            _color.lerpColors(_colorA, _colorB, Math.min(1, segT + variation));
            meshRef.current!.setColorAt(i, _color);
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

        // Fade material opacity
        const mat = meshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 1 - t * config.fadeRate);
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, PARTICLES_PER_BURST]}
            frustumCulled={false}
        >
            <sphereGeometry args={[1, 4, 4]} />
            <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={1}
                depthWrite={false}
                toneMapped={false}
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
                // Use max lifetime of any type since we don't know type in filter
                return age < 6.0 && !handledRef.current.has(e.id);
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
                <CollisionBurst
                    key={burst.id}
                    burst={burst}
                    onComplete={handleComplete}
                />
            ))}
        </>
    );
}

export default CollisionParticles;
