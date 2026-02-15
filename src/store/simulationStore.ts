/**
 * Cosmic Fabric - Simulation Store
 * 
 * Central state management for the simulation using Zustand.
 * Handles simulation objects, time control, and physics configuration.
 * 
 * Design: Physics runs in a Web Worker to ensure 60fps rendering.
 * This store bridges the UI/Renderer (Main Thread) and the Physics Engine (Worker).
 */

import { create } from 'zustand';
import {
    CosmicObject,
    CosmicObjectId,
    CollisionType,
} from '@/engine/physics/types';
import {
    PhysicsConfig,
    DEFAULT_PHYSICS_CONFIG
} from '@/engine/physics/nbody';
import PhysicsWorker from '@/workers/physics.worker?worker';
import { Vector3 } from '../engine/physics/vector';
import { RealUniverseData } from '@/data/realUniverse';

/**
 * Application mode
 */
export type AppMode = 'observation' | 'simulation';

/**
 * Time control state
 */
export interface TimeState {
    isPaused: boolean;
    timeScale: number;
    simulationTime: number;
    elapsedRealTime: number;
    targetStepsPerSecond: number;
}

/**
 * Camera state
 */
export interface CameraState {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    near: number;
    far: number;
    mode: 'free' | 'orbital' | 'locked';
    focusObjectId: CosmicObjectId | null;
}

/**
 * Selection state
 */
export interface SelectionState {
    selectedIds: CosmicObjectId[];
    hoveredId: CosmicObjectId | null;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
    fps: number;
    physicsTime: number;
    renderTime: number;
    objectCount: number;
    forceCalculations: number;
    totalEnergy: number;
}

/**
 * Collision event for visual effects
 */
export interface VisualCollisionEvent {
    id: string;
    position: [number, number, number];
    timestamp: number;
    energy: number;
    collisionType: CollisionType;
}

/**
 * Simulation Store Interface
 */
export interface SimulationState {
    // Core state
    mode: AppMode;
    objects: Map<CosmicObjectId, CosmicObject>;

    // Worker reference
    worker: Worker | null;

    // Time control
    time: TimeState;

    // Camera
    camera: CameraState;

    // Selection
    selection: SelectionState;

    // Physics config
    physicsConfig: PhysicsConfig;

    // Performance
    performance: PerformanceMetrics;

    // Collision events for visual effects
    collisionEvents: VisualCollisionEvent[];

    // Actions
    init: () => void;

    setMode: (mode: AppMode) => void;

    // Object actions
    addObject: (object: CosmicObject) => void;
    removeObject: (id: CosmicObjectId) => void;
    updateObject: (id: CosmicObjectId, updates: Partial<CosmicObject>) => void;
    clearObjects: () => void;

    // Time actions
    play: () => void;
    pause: () => void;
    togglePause: () => void;
    setTimeScale: (scale: number) => void;
    resetTime: () => void;

    // Camera actions
    setCameraPosition: (position: [number, number, number]) => void;
    setCameraTarget: (target: [number, number, number]) => void;
    setCameraMode: (mode: CameraState['mode']) => void;
    focusOnObject: (id: CosmicObjectId) => void;
    resetCamera: () => void;

    // Selection actions
    select: (ids: CosmicObjectId[]) => void;
    addToSelection: (id: CosmicObjectId) => void;
    removeFromSelection: (id: CosmicObjectId) => void;
    clearSelection: () => void;
    setHovered: (id: CosmicObjectId | null) => void;

    // Physics actions
    updatePhysicsConfig: (updates: Partial<PhysicsConfig>) => void;
    resetPhysicsConfig: () => void;

    // Step (sends singleStep to worker)
    step: (dt?: number) => void;

    // Performance
    updatePerformance: (metrics: Partial<PerformanceMetrics>) => void;

    // Collision events
    clearCollisionEvents: () => void;
}

const DEFAULT_CAMERA: CameraState = {
    position: [0, 50, 100],
    target: [0, 0, 0],
    fov: 60,
    near: 0.1,
    far: 1e15,
    mode: 'orbital',
    focusObjectId: null,
};

const DEFAULT_TIME: TimeState = {
    isPaused: true,
    timeScale: 1,
    simulationTime: 0,
    elapsedRealTime: 0,
    targetStepsPerSecond: 60,
};

/**
 * Reconstruct Vector3 instances from plain data received from worker
 */
function reconstructVector3(data: any): Vector3 {
    if (data instanceof Vector3) return data;
    return new Vector3(data?.x ?? 0, data?.y ?? 0, data?.z ?? 0);
}

export const useSimulationStore = create<SimulationState>()((set, get) => ({
    // Initial State
    mode: 'simulation',
    objects: new Map(),
    worker: null,
    collisionEvents: [],

    time: { ...DEFAULT_TIME },
    camera: { ...DEFAULT_CAMERA },
    selection: { selectedIds: [], hoveredId: null },
    physicsConfig: { ...DEFAULT_PHYSICS_CONFIG },
    performance: {
        fps: 0,
        physicsTime: 0,
        renderTime: 0,
        objectCount: 0,
        forceCalculations: 0,
        totalEnergy: 0,
    },

    // Initialization
    init: () => {
        if (get().worker) return;

        const worker = new PhysicsWorker();

        worker.onmessage = (e) => {
            const { type, ids, buffer, stats, collisionUpdate, effectiveDt } = e.data;
            if (type === 'physicsUpdate') {
                set((state) => {
                    const stride = 10;

                    // Create NEW Map with NEW object references for React reactivity
                    const newObjects = new Map(state.objects);
                    let hasUpdates = false;

                    for (let i = 0; i < ids.length; i++) {
                        const id = ids[i];
                        const existingObj = newObjects.get(id);
                        if (existingObj) {
                            const offset = i * stride;

                            // Create new object with new state (triggers React re-render)
                            const updatedObj: CosmicObject = {
                                ...existingObj,
                                state: {
                                    ...existingObj.state,
                                    position: new Vector3(
                                        buffer[offset + 0],
                                        buffer[offset + 1],
                                        buffer[offset + 2]
                                    ),
                                    velocity: new Vector3(
                                        buffer[offset + 3],
                                        buffer[offset + 4],
                                        buffer[offset + 5]
                                    ),
                                    orientation: [
                                        buffer[offset + 6],
                                        buffer[offset + 7],
                                        buffer[offset + 8],
                                        buffer[offset + 9]
                                    ],
                                }
                            };

                            newObjects.set(id, updatedObj);
                            hasUpdates = true;
                        }
                    }

                    // Handle collision sync: remove destroyed objects, add debris
                    const newCollisionEvents = [...state.collisionEvents];

                    if (collisionUpdate) {
                        const { removed, added, collisionEvents: engineCollisionEvents } = collisionUpdate;

                        // Remove destroyed objects
                        for (const removedId of removed) {
                            newObjects.delete(removedId);
                        }

                        // Add debris objects (reconstruct Vector3 instances)
                        for (const addedObj of added) {
                            const obj: CosmicObject = {
                                ...addedObj,
                                state: {
                                    position: reconstructVector3(addedObj.state.position),
                                    velocity: reconstructVector3(addedObj.state.velocity),
                                    acceleration: reconstructVector3(addedObj.state.acceleration),
                                    angularVelocity: reconstructVector3(addedObj.state.angularVelocity),
                                    orientation: addedObj.state.orientation ?? [0, 0, 0, 1],
                                }
                            };
                            newObjects.set(obj.id, obj);
                        }

                        // Generate visual collision events for particle effects
                        // Use engine collision events if available, otherwise approximate
                        if (engineCollisionEvents && engineCollisionEvents.length > 0) {
                            for (const evt of engineCollisionEvents) {
                                newCollisionEvents.push({
                                    id: crypto.randomUUID(),
                                    position: [evt.position.x, evt.position.y, evt.position.z],
                                    timestamp: Date.now(),
                                    energy: evt.energy,
                                    collisionType: evt.collisionType || 'rocky_collision',
                                });
                            }
                        } else if (removed.length >= 2) {
                            // Fallback: approximate collision position as midpoint
                            const pos1 = state.objects.get(removed[0])?.state.position;
                            const pos2 = state.objects.get(removed[1])?.state.position;
                            if (pos1 && pos2) {
                                const midX = (pos1.x + pos2.x) / 2;
                                const midY = (pos1.y + pos2.y) / 2;
                                const midZ = (pos1.z + pos2.z) / 2;
                                newCollisionEvents.push({
                                    id: crypto.randomUUID(),
                                    position: [midX, midY, midZ],
                                    timestamp: Date.now(),
                                    energy: 1.0,
                                    collisionType: 'rocky_collision',
                                });
                            }
                        }

                        hasUpdates = true;
                    }

                    // Clean up old collision events (> 5 seconds old)
                    const now = Date.now();
                    const filteredEvents = newCollisionEvents.filter(e => now - e.timestamp < 5000);

                    if (hasUpdates) {
                        return {
                            objects: newObjects,
                            collisionEvents: filteredEvents,
                            performance: stats ? {
                                ...state.performance,
                                forceCalculations: stats.forceCalculations,
                                physicsTime: stats.lastUpdateTime,
                                totalEnergy: stats.totalEnergy,
                                objectCount: newObjects.size,
                            } : state.performance,
                            time: {
                                ...state.time,
                                simulationTime: state.time.simulationTime + (effectiveDt || 0),
                            },
                        };
                    }
                    return {};
                });
            } else if (type === 'ready') {
                console.log('Physics Worker Ready');
            }
        };

        worker.postMessage({ type: 'init' });
        set({ worker });
    },

    // Mode
    setMode: (mode: AppMode) => {
        const { worker, objects } = get();

        if (mode === 'observation') {
            if (objects.size === 0) {
                // Load sample universe
                for (const data of RealUniverseData) {
                    const obj = {
                        ...data,
                        id: crypto.randomUUID(),
                        parentId: undefined,
                        lodLevel: 0,
                        isPhysicsEnabled: true
                    } as CosmicObject;
                    get().addObject(obj);
                }
            }
            worker?.postMessage({ type: 'stop' });
            set({ mode, time: { ...get().time, isPaused: true } });
        } else {
            set({ mode });
        }
    },

    // Object Actions
    addObject: (object: CosmicObject) => {
        set((state) => {
            const newObjects = new Map(state.objects);
            newObjects.set(object.id, object);
            state.worker?.postMessage({ type: 'addObject', payload: object });

            return {
                objects: newObjects,
                performance: { ...state.performance, objectCount: newObjects.size }
            };
        });
    },

    removeObject: (id: CosmicObjectId) => {
        set((state) => {
            const newObjects = new Map(state.objects);
            newObjects.delete(id);
            state.worker?.postMessage({ type: 'removeObject', payload: id });

            return {
                objects: newObjects,
                selection: {
                    ...state.selection,
                    selectedIds: state.selection.selectedIds.filter(sid => sid !== id)
                },
                performance: { ...state.performance, objectCount: newObjects.size }
            };
        });
    },

    updateObject: (id, updates) => {
        set((state) => {
            const obj = state.objects.get(id);
            if (!obj) return {};
            const newObj = { ...obj, ...updates } as CosmicObject;

            const newObjects = new Map(state.objects);
            newObjects.set(id, newObj);

            state.worker?.postMessage({ type: 'removeObject', payload: id });
            state.worker?.postMessage({ type: 'addObject', payload: newObj });

            return { objects: newObjects };
        });
    },

    clearObjects: () => {
        const { worker } = get();
        worker?.terminate();

        set({
            objects: new Map(),
            selection: { selectedIds: [], hoveredId: null },
            performance: { ...get().performance, objectCount: 0 },
            worker: null,
            collisionEvents: [],
        });

        // Re-initialize worker
        get().init();
    },

    // Time Actions
    play: () => {
        set((state) => {
            state.worker?.postMessage({ type: 'start' });
            return { time: { ...state.time, isPaused: false } };
        });
    },

    pause: () => {
        set((state) => {
            state.worker?.postMessage({ type: 'stop' });
            return { time: { ...state.time, isPaused: true } };
        });
    },

    togglePause: () => {
        set((state) => {
            const isPaused = !state.time.isPaused;
            state.worker?.postMessage({ type: isPaused ? 'stop' : 'start' });
            return { time: { ...state.time, isPaused } };
        });
    },

    // FIXED: setTimeScale no longer modifies dt. Sends timeScale to worker separately.
    setTimeScale: (scale) => {
        const newScale = Math.max(0.001, Math.min(1e6, scale));
        set((state) => {
            state.worker?.postMessage({ type: 'setTimeScale', payload: newScale });
            return { time: { ...state.time, timeScale: newScale } };
        });
    },

    resetTime: () => set((state) => ({
        time: { ...state.time, simulationTime: 0, elapsedRealTime: 0 }
    })),

    // Camera Actions
    setCameraPosition: (position) => set((state) => ({ camera: { ...state.camera, position } })),
    setCameraTarget: (target) => set((state) => ({ camera: { ...state.camera, target } })),
    setCameraMode: (mode) => set((state) => ({ camera: { ...state.camera, mode } })),
    focusOnObject: (id) => {
        const obj = get().objects.get(id);
        if (obj) {
            set((state) => ({
                camera: { ...state.camera, focusObjectId: id, mode: 'locked', target: obj.state.position.toArray() }
            }));
        }
    },
    resetCamera: () => set({ camera: { ...DEFAULT_CAMERA } }),

    // Selection Actions
    select: (ids) => set((state) => ({ selection: { ...state.selection, selectedIds: ids } })),
    addToSelection: (id) => set((state) => {
        if (state.selection.selectedIds.includes(id)) return state;
        return { selection: { ...state.selection, selectedIds: [...state.selection.selectedIds, id] } };
    }),
    removeFromSelection: (id) => set((state) => ({
        selection: { ...state.selection, selectedIds: state.selection.selectedIds.filter(sid => sid !== id) }
    })),
    clearSelection: () => set((state) => ({ selection: { ...state.selection, selectedIds: [] } })),
    setHovered: (id) => set((state) => ({ selection: { ...state.selection, hoveredId: id } })),

    // Physics Actions
    updatePhysicsConfig: (updates) => {
        set((state) => {
            const newConfig = { ...state.physicsConfig, ...updates };
            state.worker?.postMessage({ type: 'updateConfig', payload: newConfig });
            return { physicsConfig: newConfig };
        });
    },

    resetPhysicsConfig: () => {
        set((state) => {
            state.worker?.postMessage({ type: 'updateConfig', payload: DEFAULT_PHYSICS_CONFIG });
            return { physicsConfig: { ...DEFAULT_PHYSICS_CONFIG } };
        });
    },

    // FIXED: step now sends singleStep to worker instead of being a no-op
    step: (_dt) => {
        const { worker } = get();
        worker?.postMessage({ type: 'singleStep' });
    },

    updatePerformance: (metrics) => set((state) => ({
        performance: { ...state.performance, ...metrics }
    })),

    clearCollisionEvents: () => set({ collisionEvents: [] }),
}));

// Export selectors
export const useObjects = () => useSimulationStore((s) => s.objects);
export const useTimeState = () => useSimulationStore((s) => s.time);
export const useCameraState = () => useSimulationStore((s) => s.camera);
export const useSelectionState = () => useSimulationStore((s) => s.selection);
export const usePerformance = () => useSimulationStore((s) => s.performance);
export const useAppMode = () => useSimulationStore((s) => s.mode);
export const useCollisionEvents = () => useSimulationStore((s) => s.collisionEvents);

export default useSimulationStore;
