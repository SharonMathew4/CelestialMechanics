/**
 * Cosmic Fabric - Placement Store
 * 
 * Manages the object placement interaction flow.
 * TWO-PHASE PLACEMENT:
 * 1. Click to place object position
 * 2. Drag to set initial velocity vector
 */

import { create } from 'zustand';
import { CosmicObjectType } from '@/engine/physics/types';
import { Vector3 } from '@/engine/physics/vector';

/**
 * Placement phase
 */
export type PlacementPhase = 'positioning' | 'velocity';

/**
 * Placement state
 */
export interface PlacementState {
    /** Whether we're currently in placement mode */
    isPlacing: boolean;

    /** Current placement phase */
    phase: PlacementPhase;

    /** Type of object being placed */
    objectType: CosmicObjectType | null;

    /** Fixed position after first click */
    fixedPosition: Vector3 | null;

    /** Current cursor position in world space */
    cursorPosition: Vector3;

    /** Initial velocity vector (from drag) */
    velocityVector: Vector3;

    /** Whether grid snapping is enabled */
    gridSnappingEnabled: boolean;

    /** Grid snap size in simulation units */
    gridSnapSize: number;

    /** Velocity scale (how much cursor distance = velocity) */
    velocityScale: number;

    /** Y-axis offset for mouse wheel control during placement */
    yOffset: number;

    /** Placement preview configuration */
    previewConfig: {
        /** Spectral class for stars */
        spectralClass?: string;
        /** Custom name */
        name?: string;
        /** Mass multiplier */
        massMultiplier?: number;
    };

    // Actions
    startPlacement: (objectType: CosmicObjectType, config?: PlacementState['previewConfig']) => void;
    cancelPlacement: () => void;
    updateCursorPosition: (position: Vector3) => void;
    setYOffset: (offset: number) => void;

    /** Phase 1: Click to set position, enter velocity phase */
    confirmPosition: () => void;

    /** Phase 2: Click to confirm velocity and create object */
    confirmPlacement: () => {
        type: CosmicObjectType;
        position: Vector3;
        velocity: Vector3;
        config: PlacementState['previewConfig']
    } | null;

    setGridSnapping: (enabled: boolean) => void;
    setGridSnapSize: (size: number) => void;
    setVelocityScale: (scale: number) => void;
}

/**
 * Snap position to grid
 */
function snapToGrid(position: Vector3, gridSize: number): Vector3 {
    return new Vector3(
        Math.round(position.x / gridSize) * gridSize,
        Math.round(position.y / gridSize) * gridSize,
        Math.round(position.z / gridSize) * gridSize
    );
}

/**
 * Placement store
 */
export const usePlacementStore = create<PlacementState>()((set, get) => ({
    // Initial state
    isPlacing: false,
    phase: 'positioning',
    objectType: null,
    fixedPosition: null,
    cursorPosition: Vector3.zero(),
    velocityVector: Vector3.zero(),
    gridSnappingEnabled: true,
    gridSnapSize: 5,
    velocityScale: 0.5, // Cursor movement to velocity ratio
    yOffset: 0, // Y-axis offset from mouse wheel
    previewConfig: {},

    // Start placement mode
    startPlacement: (objectType, config = {}) => set({
        isPlacing: true,
        phase: 'positioning',
        objectType,
        fixedPosition: null,
        velocityVector: Vector3.zero(),
        yOffset: 0, // Reset Y offset
        previewConfig: config,
    }),

    // Cancel placement
    cancelPlacement: () => set({
        isPlacing: false,
        phase: 'positioning',
        objectType: null,
        fixedPosition: null,
        velocityVector: Vector3.zero(),
        yOffset: 0,
        previewConfig: {},
    }),

    // Update cursor position (with Y offset applied)
    updateCursorPosition: (position) => {
        const state = get();

        // Apply Y offset from mouse wheel
        const positionWithY = new Vector3(
            position.x,
            state.yOffset,
            position.z
        );

        const finalPosition = state.gridSnappingEnabled
            ? snapToGrid(positionWithY, state.gridSnapSize)
            : positionWithY;

        if (state.phase === 'velocity' && state.fixedPosition) {
            // Calculate velocity vector from fixed position to cursor
            const velocity = new Vector3(
                (finalPosition.x - state.fixedPosition.x) * state.velocityScale,
                (finalPosition.y - state.fixedPosition.y) * state.velocityScale,
                (finalPosition.z - state.fixedPosition.z) * state.velocityScale
            );
            set({ cursorPosition: finalPosition, velocityVector: velocity });
        } else {
            set({ cursorPosition: finalPosition });
        }
    },

    // Set Y offset from mouse wheel
    setYOffset: (offset) => {
        set({ yOffset: offset });
        // Re-update cursor position with new offset
        const state = get();
        get().updateCursorPosition(new Vector3(state.cursorPosition.x, 0, state.cursorPosition.z));
    },

    // Phase 1: Confirm position, enter velocity phase
    confirmPosition: () => {
        const state = get();
        if (state.phase === 'positioning') {
            set({
                phase: 'velocity',
                fixedPosition: state.cursorPosition,
            });
        }
    },

    // Phase 2: Confirm velocity and return placement data
    confirmPlacement: () => {
        const state = get();
        if (!state.isPlacing || !state.objectType || !state.fixedPosition) {
            return null;
        }

        const result = {
            type: state.objectType,
            position: state.fixedPosition,
            velocity: state.velocityVector,
            config: { ...state.previewConfig },
        };

        // Reset placement state
        set({
            isPlacing: false,
            phase: 'positioning',
            objectType: null,
            fixedPosition: null,
            velocityVector: Vector3.zero(),
            yOffset: 0,
            previewConfig: {},
        });

        return result;
    },

    // Toggle grid snapping
    setGridSnapping: (enabled) => set({ gridSnappingEnabled: enabled }),

    // Set grid snap size
    setGridSnapSize: (size) => set({ gridSnapSize: Math.max(0.1, size) }),

    // Set velocity scale
    setVelocityScale: (scale) => set({ velocityScale: Math.max(0.1, scale) }),
}));

/**
 * Selector hooks
 */
export const useIsPlacing = () => usePlacementStore((s) => s.isPlacing);
export const usePlacementType = () => usePlacementStore((s) => s.objectType);
export const useCursorPosition = () => usePlacementStore((s) => s.cursorPosition);
export const usePlacementPhase = () => usePlacementStore((s) => s.phase);
export const useVelocityVector = () => usePlacementStore((s) => s.velocityVector);

export default usePlacementStore;
