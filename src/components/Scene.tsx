/**
 * Cosmic Fabric - 3D Scene Component
 * 
 * Main Three.js canvas using React Three Fiber.
 * Handles the 3D rendering of all cosmic objects.
 */

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import {
    PerspectiveCamera,
    OrbitControls,
    AdaptiveDpr,
    AdaptiveEvents,
    Environment,
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
 * Simulation stepper - runs physics each frame
 * DISABLED in observation mode
 */
function SimulationLoop() {
    const timeState = useTimeState();
    const mode = useSimulationStore((s) => s.mode);

    // Physics step is now handled by Web Worker
    // We can use this loop for frame-dependent visual updates if needed
    // or syncing time state

    return null;
}

/**
 * Star mesh component
 */
interface StarMeshProps {
    object: CosmicObject;
    isSelected: boolean;
    isHovered: boolean;
    onSelect: (e: ThreeEvent<MouseEvent>) => void;
    onHover: (hovering: boolean) => void;
}

function StarMesh({ object, isSelected, isHovered, onSelect, onHover }: StarMeshProps) {
    const meshRef = useRef<THREE.Mesh>(null);

    // Calculate visual size based on luminosity (logarithmic scale)
    const visualRadius = useMemo(() => {
        const baseRadius = 0.5;
        const lumFactor = Math.log10(object.properties.luminosity + 1) / 10;
        return baseRadius + lumFactor;
    }, [object.properties.luminosity]);

    // Corona glow color
    const color = useMemo(() => new THREE.Color(object.visual.color), [object.visual.color]);

    return (
        <group position={object.state.position.toArray()}>
            {/* Main star body */}
            {/* Main star body - Emissive for glow */}
            <mesh
                ref={meshRef}
                onClick={onSelect}
                onPointerOver={() => onHover(true)}
                onPointerOut={() => onHover(false)}
            >
                <sphereGeometry args={[visualRadius, 32, 32]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={2.0}
                    toneMapped={false}
                />
            </mesh>

            {/* Real light source */}
            <pointLight
                color={color}
                intensity={1.5}
                distance={50}
                decay={2}
            />

            {/* Glow effect (Billboard-like sphere) */}
            <mesh scale={2.0}>
                <sphereGeometry args={[visualRadius, 16, 16]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.15}
                    side={THREE.BackSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Selection indicator */}
            {isSelected && (
                <mesh scale={2}>
                    <ringGeometry args={[visualRadius * 1.2, visualRadius * 1.3, 32]} />
                    <meshBasicMaterial color="#4a9eff" side={THREE.DoubleSide} />
                </mesh>
            )}
        </group>
    );
}

/**
 * Planet mesh component
 */
function PlanetMesh({ object, isSelected, isHovered, onSelect, onHover }: StarMeshProps) {
    const meshRef = useRef<THREE.Mesh>(null);

    // Calculate visual size
    const visualRadius = useMemo(() => {
        // Scale radius for visibility (logarithmic)
        const baseRadius = 0.2;
        const radiusFactor = Math.log10(object.properties.radius / 6.371e6 + 1);
        return baseRadius + radiusFactor * 0.1;
    }, [object.properties.radius]);

    const color = useMemo(() => new THREE.Color(object.visual.color), [object.visual.color]);

    return (
        <group position={object.state.position.toArray()}>
            <mesh
                ref={meshRef}
                onClick={onSelect}
                onPointerOver={() => onHover(true)}
                onPointerOut={() => onHover(false)}
            >
                <sphereGeometry args={[visualRadius, 24, 24]} />
                <meshStandardMaterial color={color} roughness={0.8} metalness={0.2} />
            </mesh>

            {/* Selection indicator */}
            {isSelected && (
                <mesh>
                    <ringGeometry args={[visualRadius * 1.3, visualRadius * 1.4, 32]} />
                    <meshBasicMaterial color="#4a9eff" side={THREE.DoubleSide} />
                </mesh>
            )}
        </group>
    );
}

/**
 * Black hole mesh component
 */
function BlackHoleMesh({ object, isSelected, isHovered, onSelect, onHover }: StarMeshProps) {
    const groupRef = useRef<THREE.Group>(null);

    // Animation for gravitational distortion effect
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.z = state.clock.elapsedTime * 0.1;
        }
    });

    const visualRadius = 0.8;

    return (
        <group
            ref={groupRef}
            position={object.state.position.toArray()}
            onClick={onSelect}
            onPointerOver={() => onHover(true)}
            onPointerOut={() => onHover(false)}
        >
            {/* Event horizon (black) */}
            <mesh>
                <sphereGeometry args={[visualRadius, 32, 32]} />
                <meshBasicMaterial color="#000000" />
            </mesh>

            {/* Accretion disk */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[visualRadius * 1.5, visualRadius * 4, 64]} />
                <meshBasicMaterial
                    color="#ff6600"
                    transparent
                    opacity={0.7}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Outer glow */}
            <mesh>
                <sphereGeometry args={[visualRadius * 1.2, 16, 16]} />
                <meshBasicMaterial
                    color="#330011"
                    transparent
                    opacity={0.5}
                    side={THREE.BackSide}
                />
            </mesh>

            {isSelected && (
                <mesh>
                    <ringGeometry args={[visualRadius * 4.5, visualRadius * 4.7, 32]} />
                    <meshBasicMaterial color="#4a9eff" side={THREE.DoubleSide} />
                </mesh>
            )}
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

    // Prevent placement triggering when clicking object
    const handleSelect = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation(); // CRITICAL: prevent event from reaching placement plane
        select([object.id]);
    };
    const handleHover = (hovering: boolean) => setHovered(hovering ? object.id : null);

    const props = { object, isSelected, isHovered, onSelect: handleSelect, onHover: handleHover };

    switch (object.type) {
        case CosmicObjectType.STAR:
            return <StarMesh {...props} />;
        case CosmicObjectType.PLANET:
        case CosmicObjectType.MOON:
            return <PlanetMesh {...props} />;
        case CosmicObjectType.BLACK_HOLE:
            return <BlackHoleMesh {...props} />;
        default:
            return <PlanetMesh {...props} />;
    }
}

/**
 * Grid and Axes overlay - hidden in observation mode
 */
function GridAndAxesOverlay() {
    const mode = useSimulationStore((s) => s.mode);

    // Hide in observation mode
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
 * Placement preview - ghost object with TWO-PHASE PLACEMENT:
 * 1. Click to set position
 * 2. Drag to set velocity (shown as arrow with curved trajectory)
 */
function PlacementPreview() {
    const isPlacing = usePlacementStore((s) => s.isPlacing);
    const phase = usePlacementStore((s) => s.phase);
    const objectType = usePlacementStore((s) => s.objectType);
    const cursorPosition = usePlacementStore((s) => s.cursorPosition);
    const fixedPosition = usePlacementStore((s) => s.fixedPosition);
    const velocityVector = usePlacementStore((s) => s.velocityVector);
    const updateCursorPosition = usePlacementStore((s) => s.updateCursorPosition);
    const confirmPosition = usePlacementStore((s) => s.confirmPosition);
    const confirmPlacement = usePlacementStore((s) => s.confirmPlacement);
    const cancelPlacement = usePlacementStore((s) => s.cancelPlacement);
    const addObject = useSimulationStore((s) => s.addObject);
    const objects = useSimulationStore((s) => s.objects);

    const { camera, raycaster, pointer } = useThree();
    const planeRef = useRef<THREE.Mesh>(null);

    // Track mouse position and update cursor
    useFrame(() => {
        if (!isPlacing) return;

        // Raycast to an invisible plane at y=0
        raycaster.setFromCamera(pointer, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersection);

        if (intersection) {
            updateCursorPosition(new Vector3(intersection.x, 0, intersection.z));
        }
    });

    // Calculate trajectory points based on initial velocity and nearby gravity
    const trajectoryPoints = useMemo(() => {
        if (phase !== 'velocity' || !fixedPosition) return [];

        const points: THREE.Vector3[] = [];
        let pos = new Vector3(fixedPosition.x, fixedPosition.y, fixedPosition.z);
        let vel = new Vector3(velocityVector.x, velocityVector.y, velocityVector.z);

        const dt = 0.1; // Time step for trajectory simulation
        const steps = 50; // Number of trajectory points

        // Simple trajectory simulation considering gravity from existing objects
        for (let i = 0; i < steps; i++) {
            points.push(new THREE.Vector3(pos.x, pos.y, pos.z));

            // Calculate gravitational acceleration from all existing objects
            let accX = 0, accY = 0, accZ = 0;
            for (const obj of objects.values()) {
                const dx = obj.state.position.x - pos.x;
                const dy = obj.state.position.y - pos.y;
                const dz = obj.state.position.z - pos.z;
                const distSq = dx * dx + dy * dy + dz * dz + 1; // +1 softening
                const dist = Math.sqrt(distSq);

                // Match Physics Engine constants:
                // G_SCENE = 100 for default gravity strength
                // massRel = mass / 1.989e30 (Solar Mass)
                const massRel = obj.properties.mass / 1.989e30;

                // a = G * m / r^2
                // We use 100 as the base scene gravity constant
                const accMag = (100 * massRel) / Math.max(distSq, 1.0);

                if (dist > 0.1) {
                    accX += (accMag * dx) / dist;
                    accY += (accMag * dy) / dist;
                    accZ += (accMag * dz) / dist;
                }
            }

            // Update velocity and position
            vel = new Vector3(vel.x + accX * dt, vel.y + accY * dt, vel.z + accZ * dt);
            pos = new Vector3(pos.x + vel.x * dt, pos.y + vel.y * dt, pos.z + vel.z * dt);
        }

        return points;
    }, [phase, fixedPosition, velocityVector, objects]);

    // Handle click based on current phase
    const handleClick = () => {
        if (!isPlacing || !objectType) return;

        if (phase === 'positioning') {
            // Phase 1: Set position, enter velocity phase
            confirmPosition();
        } else if (phase === 'velocity') {
            // Phase 2: Confirm and create object with velocity
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

    // Handle right-click to cancel
    const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
        if (isPlacing) {
            e.stopPropagation();
            cancelPlacement();
        }
    };

    if (!isPlacing || !objectType) return null;

    // Get preview color based on object type  
    const colorMap: Record<string, string> = {
        [CosmicObjectType.STAR]: '#fff4ea',
        [CosmicObjectType.PLANET]: '#8b7355',
        [CosmicObjectType.BLACK_HOLE]: '#7c5cff',
        [CosmicObjectType.NEUTRON_STAR]: '#aaccff',
    };
    const previewColor = colorMap[objectType] ?? '#ffffff';

    // Display position: fixed during velocity phase, cursor during positioning
    const displayPosition = phase === 'velocity' && fixedPosition
        ? fixedPosition.toArray()
        : cursorPosition.toArray();

    return (
        <>
            {/* Invisible click plane for placement */}
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

            {/* Ghost preview sphere at display position */}
            <group position={displayPosition}>
                <mesh>
                    <sphereGeometry args={[1, 16, 16]} />
                    <meshBasicMaterial
                        color={previewColor}
                        transparent
                        opacity={0.5}
                        wireframe
                    />
                </mesh>
                {/* Outer glow */}
                <mesh scale={1.5}>
                    <sphereGeometry args={[1, 8, 8]} />
                    <meshBasicMaterial
                        color={previewColor}
                        transparent
                        opacity={0.2}
                    />
                </mesh>
                {/* Position indicator ring */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[1.5, 2, 32]} />
                    <meshBasicMaterial
                        color={previewColor}
                        transparent
                        opacity={0.6}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            </group>

            {/* Velocity arrow during velocity phase */}
            {phase === 'velocity' && fixedPosition && velocityVector.length() > 0.01 && (
                <group position={fixedPosition.toArray()}>
                    {/* Arrow line */}
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
                        <lineBasicMaterial color="#00ff88" linewidth={3} />
                    </line>

                    {/* Arrowhead */}
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
                        <meshBasicMaterial color="#00ff88" />
                    </mesh>
                </group>
            )}

            {/* Trajectory curve during velocity phase */}
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
                    <lineBasicMaterial color="#ffaa00" transparent opacity={0.7} />
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

            {/* Physics simulation loop */}
            <SimulationLoop />

            {/* Placement preview */}
            <PlacementPreview />

            {/* Ambient light */}
            {/* Realistic Environment Lighting - Component only, no background */}
            <Environment preset="night" blur={0.5} />
            <color attach="background" args={['#000000']} />

            <ambientLight intensity={0.1} />

            {/* Point light at origin (can be moved to sun position) */}
            <pointLight position={[0, 0, 0]} intensity={1} />

            {/* No background stars - removed particle sphere */}

            {/* Grid and Axes - HIDE in observation mode */}
            <GridAndAxesOverlay />

            {/* Render all cosmic objects */}
            {Array.from(objects.values()).map((obj) => (
                <CosmicObjectRenderer key={obj.id} object={obj} />
            ))}

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
                antialias: false,
                powerPreference: 'high-performance',
                alpha: false,
                stencil: false,
                depth: true,
            }}
            dpr={[1, 1.5]} // Cap DPR for performance
            style={{ background: '#000' }}
        >
            {/* Adaptive performance */}
            < AdaptiveDpr pixelated />
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
        </Canvas >
    );
}

export default Scene;
