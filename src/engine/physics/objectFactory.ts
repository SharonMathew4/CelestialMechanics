/**
 * Cosmic Fabric - Object Factory
 * 
 * Factory functions for creating cosmic objects with sensible defaults.
 * All values derived from real astronomical data where possible.
 */

import { Vector3 } from './vector';
import {
    CosmicObjectId,
    CosmicObjectType,
    Star,
    Planet,
    BlackHole,
    NeutronStar,
    Galaxy,
    Nebula,
    PhysicalState,
    VisualProperties,
    ObjectMetadata,
    SpectralClass,
    GalaxyType,
} from './types';
import { AstronomicalUnits } from './constants';

/**
 * Generate unique ID for cosmic objects
 */
export function generateId(): CosmicObjectId {
    return `cosmic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create default physical state
 */
export function createDefaultState(
    position?: Vector3,
    velocity?: Vector3
): PhysicalState {
    return {
        position: position ?? Vector3.zero(),
        velocity: velocity ?? Vector3.zero(),
        acceleration: Vector3.zero(),
        angularVelocity: Vector3.zero(),
        orientation: [1, 0, 0, 0], // Identity quaternion
    };
}

/**
 * Create default metadata
 */
export function createDefaultMetadata(name: string): ObjectMetadata {
    const now = Date.now();
    return {
        name,
        isRealObject: false,
        tags: [],
        createdAt: now,
        modifiedAt: now,
    };
}

/**
 * Create default visual properties
 */
export function createDefaultVisual(color: string = '#ffffff'): VisualProperties {
    return {
        color,
        emissive: 0,
        opacity: 1,
    };
}

/**
 * Stellar data for spectral classes
 */
const STELLAR_DATA: Record<SpectralClass, {
    tempRange: [number, number];
    massRange: [number, number]; // Solar masses
    radiusRange: [number, number]; // Solar radii
    color: string;
    luminosityRange: [number, number]; // Solar luminosities
}> = {
    [SpectralClass.O]: {
        tempRange: [30000, 50000],
        massRange: [16, 150],
        radiusRange: [6.6, 20],
        color: '#9bb0ff',
        luminosityRange: [30000, 1000000],
    },
    [SpectralClass.B]: {
        tempRange: [10000, 30000],
        massRange: [2.1, 16],
        radiusRange: [1.8, 6.6],
        color: '#aabfff',
        luminosityRange: [25, 30000],
    },
    [SpectralClass.A]: {
        tempRange: [7500, 10000],
        massRange: [1.4, 2.1],
        radiusRange: [1.4, 1.8],
        color: '#cad7ff',
        luminosityRange: [5, 25],
    },
    [SpectralClass.F]: {
        tempRange: [6000, 7500],
        massRange: [1.04, 1.4],
        radiusRange: [1.15, 1.4],
        color: '#f8f7ff',
        luminosityRange: [1.5, 5],
    },
    [SpectralClass.G]: {
        tempRange: [5200, 6000],
        massRange: [0.8, 1.04],
        radiusRange: [0.96, 1.15],
        color: '#fff4ea',
        luminosityRange: [0.6, 1.5],
    },
    [SpectralClass.K]: {
        tempRange: [3700, 5200],
        massRange: [0.45, 0.8],
        radiusRange: [0.7, 0.96],
        color: '#ffd2a1',
        luminosityRange: [0.08, 0.6],
    },
    [SpectralClass.M]: {
        tempRange: [2400, 3700],
        massRange: [0.08, 0.45],
        radiusRange: [0.1, 0.7],
        color: '#ffcc6f',
        luminosityRange: [0.0001, 0.08],
    },
};

/**
 * Create a star with physically accurate defaults
 */
export function createStar(options: {
    name?: string;
    position?: Vector3;
    velocity?: Vector3;
    spectralClass?: SpectralClass;
    massSolarUnits?: number;
    radiusSolarUnits?: number;
    temperature?: number;
    luminositySolarUnits?: number;
    age?: number;
    metallicity?: number;
}): Star {
    const spectralClass = options.spectralClass ?? SpectralClass.G;
    const data = STELLAR_DATA[spectralClass];

    // Calculate mass (default to middle of range)
    const massSolar = options.massSolarUnits ??
        (data.massRange[0] + data.massRange[1]) / 2;
    const mass = massSolar * AstronomicalUnits.M_sun;

    // Calculate radius
    const radiusSolar = options.radiusSolarUnits ??
        (data.radiusRange[0] + data.radiusRange[1]) / 2;
    const radius = radiusSolar * AstronomicalUnits.R_sun;

    // Calculate temperature
    const temperature = options.temperature ??
        (data.tempRange[0] + data.tempRange[1]) / 2;

    // Calculate luminosity
    const luminositySolar = options.luminositySolarUnits ??
        (data.luminosityRange[0] + data.luminosityRange[1]) / 2;
    const luminosity = luminositySolar * AstronomicalUnits.L_sun;

    // Calculate density
    const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
    const density = mass / volume;

    return {
        id: generateId(),
        type: CosmicObjectType.STAR,
        state: createDefaultState(options.position, options.velocity),
        properties: {
            mass,
            radius,
            temperature,
            density,
            charge: 0,
            luminosity,
            magneticField: 0.0001, // ~0.1 mT typical
        },
        visual: {
            color: data.color,
            emissive: 1,
            opacity: 1,
        },
        metadata: createDefaultMetadata(options.name ?? `Star-${spectralClass}`),
        isPhysicsEnabled: true,
        lodLevel: 0,
        spectralClass,
        spectralSubclass: 5, // Middle of subclass range
        luminosityClass: 'V', // Main sequence
        age: options.age ?? 4.6e9, // Solar age default
        metallicity: options.metallicity ?? 0, // Solar metallicity
    };
}

/**
 * Create a planet with sensible defaults
 */
export function createPlanet(options: {
    name?: string;
    position?: Vector3;
    velocity?: Vector3;
    massEarthUnits?: number;
    radiusEarthUnits?: number;
    temperature?: number;
    isRocky?: boolean;
    parentId?: CosmicObjectId;
    orbitalRadius?: number;
}): Planet {
    const massEarth = options.massEarthUnits ?? 1;
    const mass = massEarth * AstronomicalUnits.M_earth;

    const radiusEarth = options.radiusEarthUnits ?? 1;
    const radius = radiusEarth * AstronomicalUnits.R_earth;

    const isRocky = options.isRocky ?? (massEarth < 10);

    // Calculate density
    const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
    const density = mass / volume;

    // Estimate orbital period using Kepler's 3rd law if orbital radius provided
    const orbitalRadius = options.orbitalRadius ?? AstronomicalUnits.AU;
    const orbitalPeriod = 2 * Math.PI * Math.sqrt(
        Math.pow(orbitalRadius, 3) / (6.67430e-11 * AstronomicalUnits.M_sun)
    );

    return {
        id: generateId(),
        type: CosmicObjectType.PLANET,
        state: createDefaultState(options.position, options.velocity),
        properties: {
            mass,
            radius,
            temperature: options.temperature ?? 288, // Earth-like
            density,
            charge: 0,
            luminosity: 0,
            magneticField: 0.00005, // ~50 μT like Earth
        },
        visual: {
            color: isRocky ? '#8b7355' : '#c4a574',
            emissive: 0,
            opacity: 1,
        },
        metadata: createDefaultMetadata(options.name ?? 'Planet'),
        parentId: options.parentId,
        isPhysicsEnabled: true,
        lodLevel: 0,
        isRocky,
        atmosphericPressure: isRocky ? 101325 : 0, // 1 atm for rocky
        hasRings: false,
        orbitalRadius,
        orbitalEccentricity: 0.02,
        orbitalPeriod,
        axialTilt: 0.41, // ~23.5° like Earth
    };
}

/**
 * Create a black hole
 */
export function createBlackHole(options: {
    name?: string;
    position?: Vector3;
    velocity?: Vector3;
    massSolarUnits?: number;
    spin?: number;
    isAccreting?: boolean;
}): BlackHole {
    const massSolar = options.massSolarUnits ?? 10;
    const mass = massSolar * AstronomicalUnits.M_sun;

    // Schwarzschild radius: Rs = 2GM/c²
    const c = 299792458;
    const G = 6.67430e-11;
    const schwarzschildRadius = (2 * G * mass) / (c * c);

    return {
        id: generateId(),
        type: CosmicObjectType.BLACK_HOLE,
        state: createDefaultState(options.position, options.velocity),
        properties: {
            mass,
            radius: schwarzschildRadius,
            temperature: 0, // Hawking radiation negligible for stellar mass
            density: mass / ((4 / 3) * Math.PI * Math.pow(schwarzschildRadius, 3)),
            charge: 0,
            luminosity: 0,
            magneticField: 0,
        },
        visual: {
            color: '#000000',
            secondaryColor: '#ff6600', // Accretion disk
            emissive: 0,
            opacity: 1,
        },
        metadata: createDefaultMetadata(options.name ?? 'Black Hole'),
        isPhysicsEnabled: true,
        lodLevel: 0,
        schwarzschildRadius,
        spin: options.spin ?? 0,
        isAccreting: options.isAccreting ?? false,
        accretionDiskInnerRadius: 3, // 3 Rs (ISCO for non-rotating)
        accretionDiskOuterRadius: 100,
    };
}

/**
 * Create a neutron star
 */
export function createNeutronStar(options: {
    name?: string;
    position?: Vector3;
    velocity?: Vector3;
    massSolarUnits?: number;
    rotationPeriod?: number;
    isPulsar?: boolean;
    isMagnetar?: boolean;
}): NeutronStar {
    const massSolar = options.massSolarUnits ?? 1.4;
    const mass = massSolar * AstronomicalUnits.M_sun;
    const radius = 10000; // ~10 km typical

    return {
        id: generateId(),
        type: CosmicObjectType.NEUTRON_STAR,
        state: createDefaultState(options.position, options.velocity),
        properties: {
            mass,
            radius,
            temperature: 1e6, // ~1 million K surface
            density: mass / ((4 / 3) * Math.PI * Math.pow(radius, 3)),
            charge: 0,
            luminosity: 1e26, // Rough estimate
            magneticField: options.isMagnetar ? 1e11 : 1e8, // Tesla
        },
        visual: {
            color: '#aaccff',
            emissive: 0.8,
            opacity: 1,
        },
        metadata: createDefaultMetadata(options.name ?? 'Neutron Star'),
        isPhysicsEnabled: true,
        lodLevel: 0,
        rotationPeriod: options.rotationPeriod ?? 0.033, // ~33ms like Crab pulsar
        isPulsar: options.isPulsar ?? true,
        isMagnetar: options.isMagnetar ?? false,
        beamHalfAngle: 0.1, // ~6°
    };
}

/**
 * Create a galaxy
 */
export function createGalaxy(options: {
    name?: string;
    position?: Vector3;
    velocity?: Vector3;
    galaxyType?: GalaxyType;
    massSolarUnits?: number;
    diskRadiusParsecs?: number;
    starCount?: number;
}): Galaxy {
    const galaxyType = options.galaxyType ?? GalaxyType.SPIRAL;
    const massSolar = options.massSolarUnits ?? 1e11; // 100 billion solar masses
    const mass = massSolar * AstronomicalUnits.M_sun;
    const diskRadius = (options.diskRadiusParsecs ?? 30000) * AstronomicalUnits.pc;

    return {
        id: generateId(),
        type: CosmicObjectType.GALAXY,
        state: createDefaultState(options.position, options.velocity),
        properties: {
            mass,
            radius: diskRadius,
            temperature: 10000, // Characteristic stellar temperature
            density: 1e-21, // Very low average density
            charge: 0,
            luminosity: 1e36, // Rough galaxy luminosity
            magneticField: 1e-10, // ~0.1 nT interstellar
        },
        visual: {
            color: '#ffe4c4',
            secondaryColor: '#4169e1',
            emissive: 0.3,
            opacity: 0.9,
        },
        metadata: createDefaultMetadata(options.name ?? 'Galaxy'),
        isPhysicsEnabled: true,
        lodLevel: 0,
        galaxyType,
        starCount: options.starCount ?? 1e11,
        diskRadius,
        diskHeight: diskRadius * 0.01, // 1% of radius
        bulgeRadius: diskRadius * 0.1,
        spiralArmCount: galaxyType === GalaxyType.SPIRAL ? 2 : 0,
        spiralPitchAngle: 0.21, // ~12°
        barLengthFraction: galaxyType === GalaxyType.BARRED_SPIRAL ? 0.4 : 0,
    };
}

/**
 * Create a nebula
 */
export function createNebula(options: {
    name?: string;
    position?: Vector3;
    velocity?: Vector3;
    nebulaType?: 'emission' | 'reflection' | 'dark' | 'planetary' | 'supernova_remnant';
    sizeParsecs?: number;
    mass?: number;
}): Nebula {
    const nebulaType = options.nebulaType ?? 'emission';
    const size = (options.sizeParsecs ?? 10) * AstronomicalUnits.pc;

    const colors: Record<string, string> = {
        emission: '#ff6b6b',
        reflection: '#4dabf7',
        dark: '#2d2d2d',
        planetary: '#66d9e8',
        supernova_remnant: '#ff8c42',
    };

    return {
        id: generateId(),
        type: CosmicObjectType.NEBULA,
        state: createDefaultState(options.position, options.velocity),
        properties: {
            mass: options.mass ?? 1e30, // Rough nebula mass
            radius: size,
            temperature: nebulaType === 'emission' ? 10000 : 100,
            density: 1e-21,
            charge: 0,
            luminosity: nebulaType === 'dark' ? 0 : 1e30,
            magneticField: 1e-10,
        },
        visual: {
            color: colors[nebulaType],
            emissive: nebulaType === 'dark' ? 0 : 0.5,
            opacity: 0.6,
        },
        metadata: createDefaultMetadata(options.name ?? 'Nebula'),
        isPhysicsEnabled: false,
        lodLevel: 0,
        nebulaType,
        extent: new Vector3(size, size, size),
        particleDensity: 100, // particles per cm³
        ionizationFraction: nebulaType === 'emission' ? 0.9 : 0.1,
    };
}

/**
 * Create Sun (our star)
 */
export function createSun(position?: Vector3): Star {
    return createStar({
        name: 'Sun',
        position,
        spectralClass: SpectralClass.G,
        massSolarUnits: 1,
        radiusSolarUnits: 1,
        temperature: 5778,
        luminositySolarUnits: 1,
        age: 4.6e9,
        metallicity: 0,
    });
}

/**
 * Create Earth
 */
export function createEarth(options?: {
    position?: Vector3;
    velocity?: Vector3;
    parentId?: CosmicObjectId;
}): Planet {
    const planet = createPlanet({
        name: 'Earth',
        position: options?.position,
        velocity: options?.velocity,
        massEarthUnits: 1,
        radiusEarthUnits: 1,
        temperature: 288,
        isRocky: true,
        parentId: options?.parentId,
        orbitalRadius: AstronomicalUnits.AU,
    });

    planet.metadata.isRealObject = true;
    planet.visual.color = '#4a7c59';
    planet.visual.secondaryColor = '#4169e1';

    return planet;
}

export default {
    generateId,
    createStar,
    createPlanet,
    createBlackHole,
    createNeutronStar,
    createGalaxy,
    createNebula,
    createSun,
    createEarth,
};
