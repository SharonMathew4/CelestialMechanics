/**
 * Cosmic Fabric - Configuration System
 * 
 * Central configuration for all simulation parameters.
 * All values are PROVISIONAL and can be modified at runtime.
 * 
 * Design principle: Configuration-driven, not hardcoded.
 */

import { PhysicalConstants } from './constants';

/**
 * Physics engine configuration
 * All parameters can be modified in Simulation Mode
 */
export interface PhysicsConfiguration {
    /** Gravitational constant - can be modified for experiments */
    gravitationalConstant: number;

    /** Speed of light - for relativistic corrections */
    speedOfLight: number;

    /** Simulation time step (seconds) */
    timeStep: number;

    /** Softening parameter to prevent singularities */
    softeningLength: number;

    /** Barnes-Hut theta (accuracy vs performance) */
    barnesHutTheta: number;

    /** Maximum allowed velocity as fraction of c */
    maxVelocityFraction: number;

    /** Enable relativistic corrections */
    enableRelativisticCorrections: boolean;

    /** Enable collision detection */
    enableCollisionDetection: boolean;

    /** Collision merge threshold (multiple of combined radii) */
    collisionMergeThreshold: number;
}

/**
 * Rendering configuration
 */
export interface RenderConfiguration {
    /** Base scale factor for object rendering */
    objectScaleFactor: number;

    /** Minimum render distance (culling) */
    minRenderDistance: number;

    /** Maximum render distance */
    maxRenderDistance: number;

    /** LOD distance thresholds [near, medium, far] */
    lodThresholds: [number, number, number];

    /** Star glow intensity multiplier */
    starGlowIntensity: number;

    /** Enable bloom post-processing */
    enableBloom: boolean;

    /** Bloom intensity */
    bloomIntensity: number;

    /** Background star count */
    backgroundStarCount: number;

    /** Enable anti-aliasing */
    enableAntialiasing: boolean;

    /** Shadow map resolution */
    shadowMapResolution: number;
}

/**
 * Simulation time configuration
 */
export interface TimeConfiguration {
    /** Target physics steps per second */
    targetPhysicsRate: number;

    /** Maximum accumulated time before frame skip */
    maxAccumulatedTime: number;

    /** Minimum time scale */
    minTimeScale: number;

    /** Maximum time scale */
    maxTimeScale: number;

    /** Default time scale */
    defaultTimeScale: number;
}

/**
 * Performance configuration
 */
export interface PerformanceConfiguration {
    /** Maximum objects before LOD degradation */
    maxObjectsHighDetail: number;

    /** Maximum objects before physics simplification */
    maxObjectsFullPhysics: number;

    /** Target frame time (ms) */
    targetFrameTime: number;

    /** Enable adaptive quality */
    enableAdaptiveQuality: boolean;

    /** Minimum acceptable FPS */
    minAcceptableFps: number;
}

/**
 * UI configuration
 */
export interface UIConfiguration {
    /** Default panel widths */
    panelWidths: {
        left: number;
        right: number;
        bottom: number;
    };

    /** Tooltip delay (ms) */
    tooltipDelay: number;

    /** Scientific notation threshold */
    scientificNotationThreshold: number;

    /** Decimal places for display */
    displayPrecision: number;
}

/**
 * Master configuration object
 */
export interface CosmicFabricConfiguration {
    physics: PhysicsConfiguration;
    render: RenderConfiguration;
    time: TimeConfiguration;
    performance: PerformanceConfiguration;
    ui: UIConfiguration;
}

/**
 * Default physics configuration - uses real physical constants
 */
export const DEFAULT_PHYSICS_CONFIGURATION: PhysicsConfiguration = {
    gravitationalConstant: PhysicalConstants.G,
    speedOfLight: PhysicalConstants.c,
    timeStep: 3600, // 1 hour
    softeningLength: 1e9, // 1 billion meters
    barnesHutTheta: 0.5,
    maxVelocityFraction: 0.1,
    enableRelativisticCorrections: false,
    enableCollisionDetection: true,
    collisionMergeThreshold: 1.5,
};

/**
 * Default render configuration - optimized for RTX 3050
 */
export const DEFAULT_RENDER_CONFIG: RenderConfiguration = {
    objectScaleFactor: 1.0,
    minRenderDistance: 0.001,
    maxRenderDistance: 1e12,
    lodThresholds: [100, 500, 2000],
    starGlowIntensity: 0.5,
    enableBloom: false, // Disabled for performance
    bloomIntensity: 0.3,
    backgroundStarCount: 5000,
    enableAntialiasing: true,
    shadowMapResolution: 1024,
};

/**
 * Default time configuration
 */
export const DEFAULT_TIME_CONFIG: TimeConfiguration = {
    targetPhysicsRate: 60,
    maxAccumulatedTime: 1,
    minTimeScale: 0.001,
    maxTimeScale: 1e6,
    defaultTimeScale: 1,
};

/**
 * Default performance configuration - tuned for RTX 3050
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfiguration = {
    maxObjectsHighDetail: 100,
    maxObjectsFullPhysics: 500,
    targetFrameTime: 16.67, // 60 FPS
    enableAdaptiveQuality: true,
    minAcceptableFps: 30,
};

/**
 * Default UI configuration
 */
export const DEFAULT_UI_CONFIG: UIConfiguration = {
    panelWidths: {
        left: 280,
        right: 280,
        bottom: 180,
    },
    tooltipDelay: 500,
    scientificNotationThreshold: 1e6,
    displayPrecision: 4,
};

/**
 * Create complete default configuration
 */
export function createDefaultConfiguration(): CosmicFabricConfiguration {
    return {
        physics: { ...DEFAULT_PHYSICS_CONFIGURATION },
        render: { ...DEFAULT_RENDER_CONFIG },
        time: { ...DEFAULT_TIME_CONFIG },
        performance: { ...DEFAULT_PERFORMANCE_CONFIG },
        ui: { ...DEFAULT_UI_CONFIG },
    };
}

/**
 * Merge partial configuration with defaults safely
 */
export function mergeConfiguration(
    partial: Partial<CosmicFabricConfiguration>
): CosmicFabricConfiguration {
    const defaults = createDefaultConfiguration();

    return {
        physics: partial.physics ? { ...defaults.physics, ...partial.physics } : defaults.physics,
        render: partial.render ? { ...defaults.render, ...partial.render } : defaults.render,
        time: partial.time ? { ...defaults.time, ...partial.time } : defaults.time,
        performance: partial.performance ? { ...defaults.performance, ...partial.performance } : defaults.performance,
        ui: partial.ui ? { ...defaults.ui, ...partial.ui } : defaults.ui,
    };
}

/**
 * Validate configuration values
 * Returns array of warning messages for invalid values
 */
export function validateConfiguration(config: CosmicFabricConfiguration): string[] {
    const warnings: string[] = [];

    // Physics validation
    if (config.physics.gravitationalConstant <= 0) {
        warnings.push('Gravitational constant must be positive');
    }
    if (config.physics.timeStep <= 0) {
        warnings.push('Time step must be positive');
    }
    if (config.physics.barnesHutTheta < 0 || config.physics.barnesHutTheta > 1) {
        warnings.push('Barnes-Hut theta should be between 0 and 1');
    }

    // Performance validation
    if (config.performance.maxObjectsFullPhysics < config.performance.maxObjectsHighDetail) {
        warnings.push('maxObjectsFullPhysics should be >= maxObjectsHighDetail');
    }

    return warnings;
}

/**
 * Preset configurations for different scenarios
 */
export const CONFIG_PRESETS = {
    /** High accuracy for research */
    highAccuracy: mergeConfiguration({
        physics: {
            ...DEFAULT_PHYSICS_CONFIGURATION,
            barnesHutTheta: 0.3,
            enableRelativisticCorrections: true,
            timeStep: 60,
        },
        performance: {
            ...DEFAULT_PERFORMANCE_CONFIG,
            maxObjectsFullPhysics: 200,
            enableAdaptiveQuality: false,
        },
    }),

    /** High performance for large simulations */
    highPerformance: mergeConfiguration({
        physics: {
            ...DEFAULT_PHYSICS_CONFIGURATION,
            barnesHutTheta: 0.8,
            enableRelativisticCorrections: false,
            timeStep: 86400,
        },
        render: {
            ...DEFAULT_RENDER_CONFIG,
            enableBloom: false,
            backgroundStarCount: 2000,
            lodThresholds: [50, 200, 800] as [number, number, number],
        },
        performance: {
            ...DEFAULT_PERFORMANCE_CONFIG,
            maxObjectsFullPhysics: 1000,
            enableAdaptiveQuality: true,
        },
    }),

    /** Balanced for general use */
    balanced: createDefaultConfiguration(),

    /** Educational mode with simplified physics */
    educational: mergeConfiguration({
        physics: {
            ...DEFAULT_PHYSICS_CONFIGURATION,
            timeStep: 3600,
            enableRelativisticCorrections: false,
        },
        ui: {
            ...DEFAULT_UI_CONFIG,
            displayPrecision: 2,
        },
    }),
};

export type ConfigPresetName = keyof typeof CONFIG_PRESETS;

export default createDefaultConfiguration;
