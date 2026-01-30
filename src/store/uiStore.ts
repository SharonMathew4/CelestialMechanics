/**
 * Cosmic Fabric - UI Store
 * 
 * State management for UI panels, overlays, and user preferences.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Panel visibility state
 */
export interface PanelState {
    left: boolean;
    right: boolean;
    bottom: boolean;
    top: boolean;
}

/**
 * Scientific overlay options
 */
export interface OverlayOptions {
    /** Show distance scale */
    distanceScale: boolean;

    /** Show velocity vectors */
    velocityVectors: boolean;

    /** Show gravitational influence fields */
    gravitationalFields: boolean;

    /** Show object labels */
    objectLabels: boolean;

    /** Show mass indicators */
    massIndicators: boolean;

    /** Show orbital paths */
    orbitalPaths: boolean;

    /** Show grid */
    grid: boolean;

    /** Show coordinate axes */
    axes: boolean;
}

/**
 * User preference mode
 */
export type UserExperienceLevel = 'beginner' | 'professional';

/**
 * Theme preference
 */
export type ThemeMode = 'dark' | 'light';

/**
 * UI State
 */
export interface UIState {
    // Panel visibility
    panels: PanelState;

    // Overlay options
    overlays: OverlayOptions;

    // User preferences
    experienceLevel: UserExperienceLevel;
    theme: ThemeMode;

    // Performance overlay
    showPerformanceMonitor: boolean;

    // Tooltips
    showTooltips: boolean;

    // Object spawner
    isSpawnerOpen: boolean;
    spawnerCategory: string | null;

    // Actions
    togglePanel: (panel: keyof PanelState) => void;
    setPanel: (panel: keyof PanelState, visible: boolean) => void;

    toggleOverlay: (overlay: keyof OverlayOptions) => void;
    setOverlay: (overlay: keyof OverlayOptions, enabled: boolean) => void;
    resetOverlays: () => void;

    setExperienceLevel: (level: UserExperienceLevel) => void;
    setTheme: (theme: ThemeMode) => void;

    togglePerformanceMonitor: () => void;
    toggleTooltips: () => void;

    openSpawner: (category?: string) => void;
    closeSpawner: () => void;
}

/**
 * Default panel state
 */
const DEFAULT_PANELS: PanelState = {
    left: true,
    right: true,
    bottom: true,
    top: true,
};

/**
 * Default overlay options
 */
const DEFAULT_OVERLAYS: OverlayOptions = {
    distanceScale: true,
    velocityVectors: false,
    gravitationalFields: false,
    objectLabels: true,
    massIndicators: false,
    orbitalPaths: true,
    grid: false,
    axes: true,
};

/**
 * Create the UI store with persistence
 */
export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            // Initial state
            panels: { ...DEFAULT_PANELS },
            overlays: { ...DEFAULT_OVERLAYS },
            experienceLevel: 'beginner',
            theme: 'dark',
            showPerformanceMonitor: false,
            showTooltips: true,
            isSpawnerOpen: false,
            spawnerCategory: null,

            // Panel actions
            togglePanel: (panel) => set((state) => ({
                panels: { ...state.panels, [panel]: !state.panels[panel] },
            })),

            setPanel: (panel, visible) => set((state) => ({
                panels: { ...state.panels, [panel]: visible },
            })),

            // Overlay actions
            toggleOverlay: (overlay) => set((state) => ({
                overlays: { ...state.overlays, [overlay]: !state.overlays[overlay] },
            })),

            setOverlay: (overlay, enabled) => set((state) => ({
                overlays: { ...state.overlays, [overlay]: enabled },
            })),

            resetOverlays: () => set({ overlays: { ...DEFAULT_OVERLAYS } }),

            // Preference actions
            setExperienceLevel: (level) => set({ experienceLevel: level }),
            setTheme: (theme) => set({ theme }),

            // Performance monitor
            togglePerformanceMonitor: () => set((state) => ({
                showPerformanceMonitor: !state.showPerformanceMonitor,
            })),

            // Tooltips
            toggleTooltips: () => set((state) => ({
                showTooltips: !state.showTooltips,
            })),

            // Spawner
            openSpawner: (category) => set({
                isSpawnerOpen: true,
                spawnerCategory: category ?? null,
            }),

            closeSpawner: () => set({
                isSpawnerOpen: false,
                spawnerCategory: null,
            }),
        }),
        {
            name: 'cosmic-fabric-ui',
            partialize: (state) => ({
                panels: state.panels,
                overlays: state.overlays,
                experienceLevel: state.experienceLevel,
                theme: state.theme,
                showTooltips: state.showTooltips,
                showPerformanceMonitor: state.showPerformanceMonitor,
            }),
        }
    )
);

/**
 * Selector hooks
 */
export const usePanels = () => useUIStore((s) => s.panels);
export const useOverlays = () => useUIStore((s) => s.overlays);
export const useExperienceLevel = () => useUIStore((s) => s.experienceLevel);
export const useTheme = () => useUIStore((s) => s.theme);

export default useUIStore;
