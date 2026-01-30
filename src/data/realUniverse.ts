import { CosmicObject, CosmicObjectType } from '../engine/physics/types';
import { Vector3 } from '../engine/physics/vector';
import { AstronomicalUnits } from '../engine/physics/constants';

const { M_sun, R_sun, AU, ly } = AstronomicalUnits;

const DEFAULT_METADATA = {
    isRealObject: true,
    tags: ['real-universe'],
    createdAt: Date.now(),
    modifiedAt: Date.now()
};

const DEFAULT_PROPS = {
    charge: 0,
    magneticField: 0
};

export const RealUniverseData: Partial<CosmicObject>[] = [
    // --- SOL SYSTEM ---
    {
        metadata: { ...DEFAULT_METADATA, name: 'Sun' },
        type: CosmicObjectType.STAR,
        properties: { ...DEFAULT_PROPS, mass: 1.0 * M_sun, radius: 1.0 * R_sun, temperature: 5778, luminosity: 1.0, density: 1400 },
        visual: { color: '#FDB813', emissive: 1, opacity: 1 },
        state: { position: new Vector3(0, 0, 0), velocity: Vector3.zero(), acceleration: Vector3.zero(), angularVelocity: Vector3.zero(), orientation: [0, 0, 0, 1] }
    },
    {
        metadata: { ...DEFAULT_METADATA, name: 'Mercury' },
        type: CosmicObjectType.PLANET,
        properties: { ...DEFAULT_PROPS, mass: 0.000000165 * M_sun, radius: 0.0035 * R_sun, temperature: 440, luminosity: 0, density: 5427 },
        visual: { color: '#A5A5A5', emissive: 0, opacity: 1 },
        state: { position: new Vector3(0.4 * AU, 0, 0), velocity: new Vector3(0, 0, 47000), acceleration: Vector3.zero(), angularVelocity: Vector3.zero(), orientation: [0, 0, 0, 1] }
    },
    {
        metadata: { ...DEFAULT_METADATA, name: 'Venus' },
        type: CosmicObjectType.PLANET,
        properties: { ...DEFAULT_PROPS, mass: 0.00000245 * M_sun, radius: 0.0086 * R_sun, temperature: 737, luminosity: 0, density: 5243 },
        visual: { color: '#E3BB76', emissive: 0, opacity: 1 },
        state: { position: new Vector3(0.7 * AU, 0, 0), velocity: new Vector3(0, 0, 35000), acceleration: Vector3.zero(), angularVelocity: Vector3.zero(), orientation: [0, 0, 0, 1] }
    },
    {
        metadata: { ...DEFAULT_METADATA, name: 'Earth' },
        type: CosmicObjectType.PLANET,
        properties: { ...DEFAULT_PROPS, mass: 0.000003 * M_sun, radius: 0.0091 * R_sun, temperature: 288, luminosity: 0, density: 5514 },
        visual: { color: '#4F4CB0', emissive: 0, opacity: 1 },
        state: { position: new Vector3(1.0 * AU, 0, 0), velocity: new Vector3(0, 0, 29780), acceleration: Vector3.zero(), angularVelocity: Vector3.zero(), orientation: [0, 0, 0, 1] }
    },
    {
        metadata: { ...DEFAULT_METADATA, name: 'Mars' },
        type: CosmicObjectType.PLANET,
        properties: { ...DEFAULT_PROPS, mass: 0.00000032 * M_sun, radius: 0.0048 * R_sun, temperature: 210, luminosity: 0, density: 3933 },
        visual: { color: '#E27B58', emissive: 0, opacity: 1 },
        state: { position: new Vector3(1.5 * AU, 0, 0), velocity: new Vector3(0, 0, 24000), acceleration: Vector3.zero(), angularVelocity: Vector3.zero(), orientation: [0, 0, 0, 1] }
    },

    // --- NEAREST STARS ---
    {
        metadata: { ...DEFAULT_METADATA, name: 'Proxima Centauri' },
        type: CosmicObjectType.STAR,
        properties: { ...DEFAULT_PROPS, mass: 0.12 * M_sun, radius: 0.15 * R_sun, temperature: 3042, luminosity: 0.0017, density: 5000 },
        visual: { color: '#FF4400', emissive: 1, opacity: 1 },
        state: { position: new Vector3(30 * ly, -25 * ly, 10 * ly), velocity: Vector3.zero(), acceleration: Vector3.zero(), angularVelocity: Vector3.zero(), orientation: [0, 0, 0, 1] }
    },
    {
        metadata: { ...DEFAULT_METADATA, name: 'Alpha Centauri A' },
        type: CosmicObjectType.STAR,
        properties: { ...DEFAULT_PROPS, mass: 1.1 * M_sun, radius: 1.2 * R_sun, temperature: 5790, luminosity: 1.5, density: 1000 },
        visual: { color: '#FFF4E8', emissive: 1, opacity: 1 },
        state: { position: new Vector3(32 * ly, -26 * ly, 12 * ly), velocity: Vector3.zero(), acceleration: Vector3.zero(), angularVelocity: Vector3.zero(), orientation: [0, 0, 0, 1] }
    },
    {
        metadata: { ...DEFAULT_METADATA, name: 'Sirius A' },
        type: CosmicObjectType.STAR,
        properties: { ...DEFAULT_PROPS, mass: 2.0 * M_sun, radius: 1.7 * R_sun, temperature: 9940, luminosity: 25.4, density: 500 },
        visual: { color: '#AABDFF', emissive: 1, opacity: 1 },
        state: { position: new Vector3(-50 * ly, 60 * ly, -20 * ly), velocity: Vector3.zero(), acceleration: Vector3.zero(), angularVelocity: Vector3.zero(), orientation: [0, 0, 0, 1] }
    },
    {
        metadata: { ...DEFAULT_METADATA, name: 'Betelgeuse' },
        type: CosmicObjectType.STAR,
        properties: { ...DEFAULT_PROPS, mass: 11.6 * M_sun, radius: 887 * R_sun, temperature: 3500, luminosity: 126000, density: 0.0001 },
        visual: { color: '#FF3300', emissive: 1, opacity: 1 },
        state: { position: new Vector3(500 * ly, 800 * ly, -200 * ly), velocity: Vector3.zero(), acceleration: Vector3.zero(), angularVelocity: Vector3.zero(), orientation: [0, 0, 0, 1] }
    },
    {
        metadata: { ...DEFAULT_METADATA, name: 'Rigel' },
        type: CosmicObjectType.STAR,
        properties: { ...DEFAULT_PROPS, mass: 21 * M_sun, radius: 78 * R_sun, temperature: 12100, luminosity: 120000, density: 0.1 },
        visual: { color: '#99CCFF', emissive: 1, opacity: 1 },
        state: { position: new Vector3(-400 * ly, -600 * ly, 500 * ly), velocity: Vector3.zero(), acceleration: Vector3.zero(), angularVelocity: Vector3.zero(), orientation: [0, 0, 0, 1] }
    }
];
