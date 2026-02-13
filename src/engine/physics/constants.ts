/**
 * Cosmic Fabric - Physical Constants
 * 
 * This module defines the fundamental physical constants used throughout
 * the simulation. All values are in SI units unless otherwise noted.
 * 
 * These constants can be overridden in Simulation Mode for hypothetical
 * physics experiments.
 */

/**
 * Fundamental physical constants in SI units
 */
export const PhysicalConstants = {
    /** Gravitational constant (m³ kg⁻¹ s⁻²) */
    G: 6.67430e-11,

    /** Speed of light in vacuum (m/s) */
    c: 299792458,

    /** Planck constant (J·s) */
    h: 6.62607015e-34,

    /** Reduced Planck constant (J·s) */
    hbar: 1.054571817e-34,

    /** Boltzmann constant (J/K) */
    k_B: 1.380649e-23,

    /** Stefan-Boltzmann constant (W m⁻² K⁻⁴) */
    sigma: 5.670374419e-8,

    /** Elementary charge (C) */
    e: 1.602176634e-19,

    /** Electron mass (kg) */
    m_e: 9.1093837015e-31,

    /** Proton mass (kg) */
    m_p: 1.67262192369e-27,

    /**
     * Black Hole & General Relativity Constants
     */

    /**
     * Calculate Schwarzschild radius (event horizon) for a given mass
     * Rs = 2GM/c²
     * @param mass - Mass in kg
     * @returns Schwarzschild radius in meters
     */
    schwarzschildRadius: (mass: number): number => {
        return (2 * 6.67430e-11 * mass) / (299792458 ** 2);
    },

    /**
     * Photon sphere radius for non-rotating (Schwarzschild) black hole
     * Rph = 1.5 * Rs
     * @param mass - Mass in kg
     * @returns Photon sphere radius in meters
     */
    photonSphereRadius: (mass: number): number => {
        const Rs = (2 * 6.67430e-11 * mass) / (299792458 ** 2);
        return 1.5 * Rs;
    },

    /**
     * Innermost Stable Circular Orbit (ISCO) for Schwarzschild black hole
     * RISCO = 3 * Rs
     * @param mass - Mass in kg
     * @returns ISCO radius in meters
     */
    iscoRadius: (mass: number): number => {
        const Rs = (2 * 6.67430e-11 * mass) / (299792458 ** 2);
        return 3 * Rs;
    },

    /**
     * Gravitational time dilation factor at radius r from black hole
     * τ = t * sqrt(1 - Rs/r)
     * @param mass - Mass in kg
     * @param radius - Distance from center in meters
     * @returns Time dilation factor (proper time / coordinate time)
     */
    timeDilation: (mass: number, radius: number): number => {
        const Rs = (2 * 6.67430e-11 * mass) / (299792458 ** 2);
        if (radius <= Rs) return 0; // Inside event horizon
        return Math.sqrt(1 - Rs / radius);
    },
} as const;

/**
 * Cosmological constants
 */
export const CosmologicalConstants = {
    /** Hubble constant (km/s/Mpc) */
    H_0: 67.4,

    /** Hubble constant in SI units (s⁻¹) */
    H_0_SI: 2.184e-18,

    /** Dark matter density parameter */
    Omega_dm: 0.265,

    /** Baryonic matter density parameter */
    Omega_b: 0.049,

    /** Dark energy density parameter */
    Omega_Lambda: 0.685,

    /** Cosmic microwave background temperature (K) */
    T_CMB: 2.7255,

    /** Age of the universe (seconds) */
    t_universe: 4.35e17,

    /** Age of the universe (years) */
    t_universe_years: 13.8e9,
} as const;

/**
 * Astronomical unit conversions
 */
export const AstronomicalUnits = {
    /** Astronomical Unit in meters */
    AU: 1.495978707e11,

    /** Parsec in meters */
    pc: 3.0857e16,

    /** Light-year in meters */
    ly: 9.4607e15,

    /** Kiloparsec in meters */
    kpc: 3.0857e19,

    /** Megaparsec in meters */
    Mpc: 3.0857e22,

    /** Solar mass in kg */
    M_sun: 1.989e30,

    /** Solar radius in meters */
    R_sun: 6.9634e8,

    /** Solar luminosity in watts */
    L_sun: 3.828e26,

    /** Earth mass in kg */
    M_earth: 5.972e24,

    /** Earth radius in meters */
    R_earth: 6.371e6,
} as const;

/**
 * Simulation scale factors for rendering
 * These help translate real astronomical distances to renderable scales
 */
export const SimulationScales = {
    /** Base distance scale (1 unit = this many meters) */
    DISTANCE_SCALE: 1e9, // 1 unit = 1 billion meters

    /** Time scale factor (simulation seconds per real second at 1x speed) */
    TIME_SCALE: 1,

    /** Mass scale for physics calculations */
    MASS_SCALE: 1e24, // 1 unit = 10^24 kg

    /** Minimum render distance (units) */
    MIN_RENDER_DISTANCE: 0.001,

    /** Maximum render distance (units) */
    MAX_RENDER_DISTANCE: 1e12,
} as const;

/**
 * Type-safe access to all constants
 */
export type PhysicalConstantsType = typeof PhysicalConstants;
export type CosmologicalConstantsType = typeof CosmologicalConstants;
export type AstronomicalUnitsType = typeof AstronomicalUnits;
export type SimulationScalesType = typeof SimulationScales;

/**
 * Combined constants object for convenience
 */
export const Constants = {
    physical: PhysicalConstants,
    cosmological: CosmologicalConstants,
    astronomical: AstronomicalUnits,
    simulation: SimulationScales,
} as const;

export default Constants;
