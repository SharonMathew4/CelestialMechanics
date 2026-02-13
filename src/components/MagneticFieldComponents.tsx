/**
 * Neutron Star Magnetic Field Lines and Pulsar Beams
 * 
 * Renders:
 * - Magnetic dipole field lines emanating from poles
 * - Rotating pulsar beams (lighthouse effect)
 * - Animated field line geometry
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Magnetic Field Lines Component
 * Creates curved lines following dipole field geometry
 */
export function MagneticFieldLines({
    rotationSpeed = 2.0,
    magneticAxisAngle = 0.5,
    fieldStrength = 1.0
}: {
    rotationSpeed?: number;
    magneticAxisAngle?: number;
    fieldStrength?: number;
}) {
    const groupRef = useRef<THREE.Group>(null);

    // Animate rotation
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = state.clock.elapsedTime * rotationSpeed;
        }
    });

    // Generate magnetic dipole field line geometry
    const fieldLines = useMemo(() => {
        const lines: THREE.BufferGeometry[] = [];
        const numLines = 8; // Lines per hemisphere

        for (let i = 0; i < numLines; i++) {
            const phi = (i / numLines) * Math.PI * 2; // Azimuthal angle

            // Create field line from north pole to south pole
            // Magnetic dipole field: r(θ) = r0 * sin²(θ)
            const points: THREE.Vector3[] = [];
            const steps = 50;

            for (let j = 0; j <= steps; j++) {
                const t = j / steps;
                const theta = t * Math.PI; // From 0 (north) to π (south)

                // Dipole field line equation
                const r = 1.5 + fieldStrength * Math.sin(theta) ** 2 * 2.0;

                const x = r * Math.sin(theta) * Math.cos(phi);
                const y = r * Math.cos(theta);
                const z = r * Math.sin(theta) * Math.sin(phi);

                points.push(new THREE.Vector3(x, y, z));
            }

            const curve = new THREE.CatmullRomCurve3(points);
            const geometry = new THREE.TubeGeometry(curve, steps, 0.01, 8, false);
            lines.push(geometry);
        }

        return lines;
    }, [fieldStrength]);

    return (
        <group ref={groupRef} rotation={[magneticAxisAngle, 0, 0]}>
            {fieldLines.map((geometry, i) => (
                <mesh key={i} geometry={geometry}>
                    <meshBasicMaterial
                        color="#60a0ff"
                        transparent
                        opacity={0.3}
                        depthWrite={false}
                    />
                </mesh>
            ))}
        </group>
    );
}

/**
 * Pulsar Beams Component
 * Creates two bright beams from magnetic poles
 */
export function PulsarBeams({
    rotationSpeed = 2.0,
    magneticAxisAngle = 0.5,
    beamLength = 15.0,
    beamWidth = 0.3
}: {
    rotationSpeed?: number;
    magneticAxisAngle?: number;
    beamLength?: number;
    beamWidth?: number;
}) {
    const groupRef = useRef<THREE.Group>(null);

    // Animate rotation
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = state.clock.elapsedTime * rotationSpeed;
        }
    });

    // Create beam geometry (cone)
    const beamGeometry = useMemo(() => {
        return new THREE.CylinderGeometry(beamWidth * 0.1, beamWidth, beamLength, 16, 1, true);
    }, [beamLength, beamWidth]);

    return (
        <group ref={groupRef} rotation={[magneticAxisAngle, 0, 0]}>
            {/* North pole beam */}
            <mesh
                geometry={beamGeometry}
                position={[0, beamLength / 2, 0]}
            >
                <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.6}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>

            {/* South pole beam */}
            <mesh
                geometry={beamGeometry}
                position={[0, -beamLength / 2, 0]}
                rotation={[Math.PI, 0, 0]}
            >
                <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.6}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>

            {/* Bright point lights at poles for dramatic effect */}
            <pointLight
                position={[0, 1.2, 0]}
                color="#a0d0ff"
                intensity={3.0}
                distance={10}
            />
            <pointLight
                position={[0, -1.2, 0]}
                color="#a0d0ff"
                intensity={3.0}
                distance={10}
            />
        </group>
    );
}
