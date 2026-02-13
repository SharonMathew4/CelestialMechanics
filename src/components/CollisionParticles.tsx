/**
 * Collision Particle Effects
 * 
 * Renders GPU-instanced particle bursts at collision points.
 * Each collision spawns ~150 particles that explode outward,
 * change color from hot white/orange to red, and fade out.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCollisionEvents } from '@/store';

const PARTICLES_PER_BURST = 150;
const PARTICLE_LIFETIME = 3.0; // seconds
const MAX_ACTIVE_BURSTS = 10;

interface ParticleBurst {
    id: string;
    startTime: number;
    origin: THREE.Vector3;
    velocities: THREE.Vector3[];
    mesh: THREE.InstancedMesh | null;
}

// Temp objects to avoid GC
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _color = new THREE.Color();
const _dummy = new THREE.Object3D();

function CollisionBurst({ burst, onComplete }: { burst: { id: string; position: [number, number, number]; timestamp: number; energy: number }; onComplete: (id: string) => void }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const startTimeRef = useRef(Date.now());
    const velocitiesRef = useRef<THREE.Vector3[]>([]);

    // Initialize particle velocities once
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        startTimeRef.current = burst.timestamp;

        // Generate random velocities for explosion
        const vels: THREE.Vector3[] = [];
        for (let i = 0; i < PARTICLES_PER_BURST; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = 1.5 + Math.random() * 8;
            vels.push(new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.sin(phi) * Math.sin(theta) * speed,
                Math.cos(phi) * speed
            ));
        }
        velocitiesRef.current = vels;

        // Set initial instance matrices
        if (meshRef.current) {
            for (let i = 0; i < PARTICLES_PER_BURST; i++) {
                _dummy.position.set(burst.position[0], burst.position[1], burst.position[2]);
                _dummy.scale.set(0.08, 0.08, 0.08);
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

        if (elapsed > PARTICLE_LIFETIME) {
            onComplete(burst.id);
            return;
        }

        const t = elapsed / PARTICLE_LIFETIME; // 0 → 1
        const gravity = -2.0; // Subtle downward pull

        for (let i = 0; i < PARTICLES_PER_BURST; i++) {
            const vel = velocitiesRef.current[i];

            // Position: origin + vel*t + 0.5*gravity*t² (only Y for gravity)
            const px = burst.position[0] + vel.x * elapsed;
            const py = burst.position[1] + vel.y * elapsed + 0.5 * gravity * elapsed * elapsed;
            const pz = burst.position[2] + vel.z * elapsed;

            // Scale: shrink over time
            const scale = Math.max(0.01, 0.1 * (1 - t * 0.7));

            _dummy.position.set(px, py, pz);
            _dummy.scale.set(scale, scale, scale);
            _dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, _dummy.matrix);

            // Color: white → orange → red → fade
            if (t < 0.2) {
                _color.lerpColors(new THREE.Color('#ffffff'), new THREE.Color('#ffaa44'), t / 0.2);
            } else if (t < 0.5) {
                _color.lerpColors(new THREE.Color('#ffaa44'), new THREE.Color('#ff4400'), (t - 0.2) / 0.3);
            } else {
                _color.lerpColors(new THREE.Color('#ff4400'), new THREE.Color('#330000'), (t - 0.5) / 0.5);
            }
            meshRef.current.setColorAt(i, _color);
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

        // Fade material opacity
        const mat = meshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 1 - t * 1.2);
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
                return age < PARTICLE_LIFETIME && !handledRef.current.has(e.id);
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
