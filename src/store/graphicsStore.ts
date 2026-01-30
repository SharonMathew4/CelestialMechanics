/**
 * Graphics Settings Store
 * 
 * Manages graphics quality presets and individual effect toggles.
 * Uses Zustand for state management.
 */

import { create } from 'zustand';

export type GraphicsQuality = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

interface GraphicsSettings {
    // Global quality preset
    quality: GraphicsQuality;

    // Individual effect toggles
    bloom: boolean;
    chromaticAberration: boolean;
    vignette: boolean;
    antialiasing: boolean;
    shadows: boolean;

    // Effect intensities (0-1)
    bloomIntensity: number;
    vignetteIntensity: number;

    // Actions
    setQuality: (quality: GraphicsQuality) => void;
    toggleBloom: () => void;
    toggleChromaticAberration: () => void;
    toggleVignette: () => void;
    toggleAntialiasing: () => void;
    toggleShadows: () => void;
    setBloomIntensity: (value: number) => void;
    setVignetteIntensity: (value: number) => void;
}

const QUALITY_PRESETS: Record<GraphicsQuality, Partial<GraphicsSettings>> = {
    LOW: {
        bloom: false,
        chromaticAberration: false,
        vignette: false,
        antialiasing: false,
        shadows: false,
        bloomIntensity: 0.5,
        vignetteIntensity: 0.3,
    },
    MEDIUM: {
        bloom: true,
        chromaticAberration: false,
        vignette: true,
        antialiasing: true,
        shadows: false,
        bloomIntensity: 1.0,
        vignetteIntensity: 0.4,
    },
    HIGH: {
        bloom: true,
        chromaticAberration: true,
        vignette: true,
        antialiasing: true,
        shadows: true,
        bloomIntensity: 1.5,
        vignetteIntensity: 0.5,
    },
    ULTRA: {
        bloom: true,
        chromaticAberration: true,
        vignette: true,
        antialiasing: true,
        shadows: true,
        bloomIntensity: 2.0,
        vignetteIntensity: 0.6,
    },
};

export const useGraphicsSettings = create<GraphicsSettings>((set) => ({
    // Default to HIGH quality
    quality: 'HIGH' as GraphicsQuality,
    bloom: true,
    chromaticAberration: true,
    vignette: true,
    antialiasing: true,
    shadows: true,
    bloomIntensity: 1.5,
    vignetteIntensity: 0.5,

    setQuality: (quality) => set({ quality, ...QUALITY_PRESETS[quality] }),

    toggleBloom: () => set((state) => ({ bloom: !state.bloom })),
    toggleChromaticAberration: () => set((state) => ({ chromaticAberration: !state.chromaticAberration })),
    toggleVignette: () => set((state) => ({ vignette: !state.vignette })),
    toggleAntialiasing: () => set((state) => ({ antialiasing: !state.antialiasing })),
    toggleShadows: () => set((state) => ({ shadows: !state.shadows })),

    setBloomIntensity: (value) => set({ bloomIntensity: value }),
    setVignetteIntensity: (value) => set({ vignetteIntensity: value }),
}));
