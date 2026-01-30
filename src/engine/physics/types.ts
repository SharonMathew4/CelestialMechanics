/**
 * Cosmic Fabric - Cosmic Object Types
 * 
 * Type definitions for all cosmic objects in the simulation.
 * Designed for scientific accuracy and extensibility.
 */

import { Vector3 } from './vector';

/**
 * Unique identifier for cosmic objects
 */
export type CosmicObjectId = string;

/**
 * Base classification of cosmic objects
 */
export enum CosmicObjectType {
    STAR = 'STAR',
    PLANET = 'PLANET',
    MOON = 'MOON',
    ASTEROID = 'ASTEROID',
    COMET = 'COMET',
    BLACK_HOLE = 'BLACK_HOLE',
    NEUTRON_STAR = 'NEUTRON_STAR',
    WHITE_DWARF = 'WHITE_DWARF',
    NEBULA = 'NEBULA',
    GALAXY = 'GALAXY',
    STAR_CLUSTER = 'STAR_CLUSTER',
    GAS_CLOUD = 'GAS_CLOUD',
    DARK_MATTER_HALO = 'DARK_MATTER_HALO',
}

/**
 * Stellar classification (spectral type)
 */
export enum SpectralClass {
    O = 'O', // Blue, hottest
    B = 'B', // Blue-white
    A = 'A', // White
    F = 'F', // Yellow-white
    G = 'G', // Yellow (like Sun)
    K = 'K', // Orange
    M = 'M', // Red, coolest
}

/**
 * Galaxy morphological classification (Hubble sequence)
 */
export enum GalaxyType {
    ELLIPTICAL = 'ELLIPTICAL',
    SPIRAL = 'SPIRAL',
    BARRED_SPIRAL = 'BARRED_SPIRAL',
    LENTICULAR = 'LENTICULAR',
    IRREGULAR = 'IRREGULAR',
}

/**
 * Physical state for dynamic simulation
 */
export interface PhysicalState {
    /** Position in simulation space (simulation units) */
    position: Vector3;

    /** Velocity vector (simulation units/s) */
    velocity: Vector3;

    /** Acceleration vector (current frame) */
    acceleration: Vector3;

    /** Angular velocity (rad/s) for each axis */
    angularVelocity: Vector3;

    /** Orientation quaternion [w, x, y, z] */
    orientation: [number, number, number, number];
}

/**
 * Core physical properties shared by all cosmic objects
 */
export interface PhysicalProperties {
    /** Mass in kg */
    mass: number;

    /** Radius in meters (characteristic radius) */
    radius: number;

    /** Surface/effective temperature in Kelvin */
    temperature: number;

    /** Mean density in kg/m³ */
    density: number;

    /** Net electric charge in Coulombs (usually 0 for celestial bodies) */
    charge: number;

    /** Luminosity in Watts (for luminous objects) */
    luminosity: number;

    /** Magnetic field strength at surface in Tesla */
    magneticField: number;
}

/**
 * Visual properties for rendering
 */
export interface VisualProperties {
    /** Primary color (hex) */
    color: string;

    /** Secondary color for gradients/effects */
    secondaryColor?: string;

    /** Emissive intensity (0-1) */
    emissive: number;

    /** Opacity (0-1) */
    opacity: number;

    /** Custom texture path if any */
    texturePath?: string;
}

/**
 * Metadata and labeling
 */
export interface ObjectMetadata {
    /** Display name */
    name: string;

    /** Scientific designation if any */
    designation?: string;

    /** Brief description */
    description?: string;

    /** Whether this is a real astronomical object */
    isRealObject: boolean;

    /** Data source/reference */
    source?: string;

    /** User-defined tags */
    tags: string[];

    /** Creation timestamp */
    createdAt: number;

    /** Last modified timestamp */
    modifiedAt: number;
}

/**
 * Base interface for all cosmic objects
 */
export interface CosmicObject {
    /** Unique identifier */
    id: CosmicObjectId;

    /** Object classification */
    type: CosmicObjectType;

    /** Current physical state (position, velocity, etc.) */
    state: PhysicalState;

    /** Intrinsic physical properties */
    properties: PhysicalProperties;

    /** Visual rendering properties */
    visual: VisualProperties;

    /** Metadata and labeling */
    metadata: ObjectMetadata;

    /** Parent object ID (e.g., planet's parent star) */
    parentId?: CosmicObjectId;

    /** Whether object participates in physics simulation */
    isPhysicsEnabled: boolean;

    /** Level of detail for rendering (0 = highest) */
    lodLevel: number;
}

/**
 * Star-specific properties
 */
export interface Star extends CosmicObject {
    type: CosmicObjectType.STAR;

    /** Spectral classification */
    spectralClass: SpectralClass;

    /** Spectral subclass (0-9) */
    spectralSubclass: number;

    /** Luminosity class (I-VII) */
    luminosityClass: string;

    /** Age in years */
    age: number;

    /** Metallicity [Fe/H] */
    metallicity: number;
}

/**
 * Planet-specific properties
 */
export interface Planet extends CosmicObject {
    type: CosmicObjectType.PLANET;

    /** Whether planet is rocky or gaseous */
    isRocky: boolean;

    /** Atmospheric pressure in Pa */
    atmosphericPressure: number;

    /** Whether planet has rings */
    hasRings: boolean;

    /** Orbital semi-major axis in meters */
    orbitalRadius: number;

    /** Orbital eccentricity */
    orbitalEccentricity: number;

    /** Orbital period in seconds */
    orbitalPeriod: number;

    /** Axial tilt in radians */
    axialTilt: number;
}

/**
 * Black hole properties
 */
export interface BlackHole extends CosmicObject {
    type: CosmicObjectType.BLACK_HOLE;

    /** Schwarzschild radius in meters */
    schwarzschildRadius: number;

    /** Angular momentum parameter (0-1) */
    spin: number;

    /** Whether it's actively accreting */
    isAccreting: boolean;

    /** Accretion disk inner radius (as multiple of Rs) */
    accretionDiskInnerRadius: number;

    /** Accretion disk outer radius (as multiple of Rs) */
    accretionDiskOuterRadius: number;
}

/**
 * Neutron star properties
 */
export interface NeutronStar extends CosmicObject {
    type: CosmicObjectType.NEUTRON_STAR;

    /** Rotation period in seconds */
    rotationPeriod: number;

    /** Whether it's a pulsar */
    isPulsar: boolean;

    /** Whether it's a magnetar */
    isMagnetar: boolean;

    /** Beam half-angle in radians (for pulsars) */
    beamHalfAngle: number;
}

/**
 * Galaxy properties
 */
export interface Galaxy extends CosmicObject {
    type: CosmicObjectType.GALAXY;

    /** Morphological type */
    galaxyType: GalaxyType;

    /** Number of stars (approximate) */
    starCount: number;

    /** Disk radius in meters (for disk galaxies) */
    diskRadius: number;

    /** Disk scale height in meters */
    diskHeight: number;

    /** Bulge radius in meters */
    bulgeRadius: number;

    /** Spiral arm count (for spiral galaxies) */
    spiralArmCount: number;

    /** Spiral arm pitch angle in radians */
    spiralPitchAngle: number;

    /** Bar length as fraction of disk radius (for barred spirals) */
    barLengthFraction: number;
}

/**
 * Nebula properties
 */
export interface Nebula extends CosmicObject {
    type: CosmicObjectType.NEBULA;

    /** Nebula subtype */
    nebulaType: 'emission' | 'reflection' | 'dark' | 'planetary' | 'supernova_remnant';

    /** Characteristic size in meters */
    extent: Vector3;

    /** Gas density in particles per cm³ */
    particleDensity: number;

    /** Ionization fraction (0-1) */
    ionizationFraction: number;
}

/**
 * Type guard functions
 */
export function isStar(obj: CosmicObject): obj is Star {
    return obj.type === CosmicObjectType.STAR;
}

export function isPlanet(obj: CosmicObject): obj is Planet {
    return obj.type === CosmicObjectType.PLANET;
}

export function isBlackHole(obj: CosmicObject): obj is BlackHole {
    return obj.type === CosmicObjectType.BLACK_HOLE;
}

export function isNeutronStar(obj: CosmicObject): obj is NeutronStar {
    return obj.type === CosmicObjectType.NEUTRON_STAR;
}

export function isGalaxy(obj: CosmicObject): obj is Galaxy {
    return obj.type === CosmicObjectType.GALAXY;
}

export function isNebula(obj: CosmicObject): obj is Nebula {
    return obj.type === CosmicObjectType.NEBULA;
}

/**
 * Union type for all specific cosmic object types
 */
export type SpecificCosmicObject =
    | Star
    | Planet
    | BlackHole
    | NeutronStar
    | Galaxy
    | Nebula
    | CosmicObject; // Fallback for generic objects
