/**
 * Cosmic Fabric - N-body Physics Engine
 * 
 * COMPLETE IMPLEMENTATION with:
 * - Proper scene-scale gravitational force calculation (O(n²))
 * - Adaptive softening based on visual radii
 * - Collision detection (bounding sphere)
 * - Collision response (debris splatter with particle events)
 * - Velocity Verlet integration (energy-conserving, no damping)
 */

import { Vector3 } from './vector';
import { CosmicObject, CosmicObjectId, CosmicObjectType, CollisionType, Planet, Nebula } from './types';
import { PhysicalConstants, AstronomicalUnits } from './constants';
import { createBlackHole, createNebula, createStar, generateId, createDefaultState, createDefaultMetadata } from './objectFactory';

/**
 * Physics configuration
 */
export interface PhysicsConfig {
    /** Gravitational constant multiplier (1.0 = real G) */
    gravityStrength: number;

    /** Gravitational range multiplier (affects falloff) */
    gravityRange: number;

    /** Time step for integration (seconds) */
    dt: number;

    /** Softening parameter to prevent singularities */
    softening: number;

    /** Maximum force magnitude to prevent instability */
    maxForce: number;

    /** Maximum velocity (scene units/s) */
    maxVelocity: number;

    /** Enable collision detection and response */
    enableCollisions: boolean;

    /** Enable debug logging */
    enableDebugLogging: boolean;

    /** Velocity damping factor (0.99-1.0, where 1.0 = no damping) */
    velocityDamping: number;
}

/**
 * Default physics configuration
 */
export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
    gravityStrength: 50,    // 0-100 scale, 50 = normal
    gravityRange: 5,        // 0-10 scale
    dt: 1 / 60,            // ~60fps frame time
    softening: 0.3,         // Scene-scale softening (will be combined with visual radii)
    maxForce: 1e6,          // High but finite limit
    maxVelocity: 200,       // Scene units per second
    enableCollisions: true,
    enableDebugLogging: false,
    velocityDamping: 1.0,   // No damping by default
};

/**
 * Collision event for syncing to main thread
 */
export interface CollisionEvent {
    timestamp: number;
    object1Id: CosmicObjectId;
    object2Id: CosmicObjectId;
    object1Name: string;
    object2Name: string;
    type: 'merge' | 'absorption';
    collisionType: CollisionType;
    resultId: CosmicObjectId;
    position: { x: number; y: number; z: number };
    energy: number; // Relative collision energy for particle intensity
}

/**
 * Convert real mass (kg) to scene-scale mass
 * Uses log-scale to keep mass ratios meaningful while keeping numbers workable
 * Sun (~2e30 kg) → ~30, Earth (~6e24 kg) → ~24.8, Asteroid (~1e15 kg) → ~15
 */
function toSceneMass(realMass: number): number {
    return Math.max(Math.log10(Math.max(realMass, 1)), 1);
}

/**
 * Main N-body physics engine with collision detection
 */
export class NBodyEngine {
    private config: PhysicsConfig;
    private objects: Map<CosmicObjectId, CosmicObject>;
    private collisionEvents: CollisionEvent[] = [];
    private objectsToRemove: Set<CosmicObjectId> = new Set();

    // Kilonova collapse tracking: center position + timestamp
    private kilonovaCollapses: Array<{
        centerPos: Vector3;
        centerVel: Vector3;
        combinedMass: number;
        timestamp: number;
        debrisIds: string[];
    }> = [];

    // Statistics
    private stats = {
        objectCount: 0,
        forceCalculations: 0,
        collisions: 0,
        lastUpdateTime: 0,
    };

    constructor(config: Partial<PhysicsConfig> = {}) {
        this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
        this.objects = new Map();
    }

    /**
     * Get current configuration
     */
    getConfig(): Readonly<PhysicsConfig> {
        return this.config;
    }

    /**
     * Update configuration
     */
    updateConfig(updates: Partial<PhysicsConfig>): void {
        this.config = { ...this.config, ...updates };
    }

    /**
     * Add an object to the simulation
     */
    addObject(object: CosmicObject): void {
        this.objects.set(object.id, object);
        this.stats.objectCount = this.objects.size;

        if (this.config.enableDebugLogging) {
            console.log(`[Physics] Added object: ${object.metadata.name} (${object.id}), mass=${object.properties.mass}`);
        }
    }

    /**
     * Remove an object from the simulation
     */
    removeObject(id: CosmicObjectId): boolean {
        const result = this.objects.delete(id);
        this.stats.objectCount = this.objects.size;
        return result;
    }

    /**
     * Get an object by ID
     */
    getObject(id: CosmicObjectId): CosmicObject | undefined {
        return this.objects.get(id);
    }

    /**
     * Get all objects
     */
    getAllObjects(): CosmicObject[] {
        return Array.from(this.objects.values());
    }

    /**
     * Get physics state as binary buffer for worker transfer
     */
    getPhysicsState(): { ids: string[]; buffer: Float32Array } {
        const objects = Array.from(this.objects.values()).filter(o => o.isPhysicsEnabled);
        const stride = 10;
        const buffer = new Float32Array(objects.length * stride);
        const ids: string[] = [];

        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            ids.push(obj.id);
            const offset = i * stride;

            // Position
            buffer[offset + 0] = obj.state.position.x;
            buffer[offset + 1] = obj.state.position.y;
            buffer[offset + 2] = obj.state.position.z;

            // Velocity
            buffer[offset + 3] = obj.state.velocity.x;
            buffer[offset + 4] = obj.state.velocity.y;
            buffer[offset + 5] = obj.state.velocity.z;

            // Orientation
            buffer[offset + 6] = obj.state.orientation[0];
            buffer[offset + 7] = obj.state.orientation[1];
            buffer[offset + 8] = obj.state.orientation[2];
            buffer[offset + 9] = obj.state.orientation[3];
        }

        return { ids, buffer };
    }

    /**
     * Get simulation statistics
     */
    getStats() {
        let ke = 0;
        for (const obj of this.objects.values()) {
            if (!obj.isPhysicsEnabled) continue;
            const v = obj.state.velocity.magnitude();
            ke += 0.5 * obj.properties.mass * v * v;
        }

        return {
            ...this.stats,
            totalEnergy: ke,
        };
    }

    /**
     * Get recent collision events
     */
    getCollisionEvents(): CollisionEvent[] {
        return [...this.collisionEvents];
    }

    /**
     * Clear collision event log
     */
    clearCollisionEvents(): void {
        this.collisionEvents = [];
    }

    /**
     * Calculate visual collision radius for an object
     * Used for both collision detection and softening
     */
    getVisualRadius(obj: CosmicObject): number {
        switch (obj.type) {
            case CosmicObjectType.STAR: {
                const lumFactor = Math.log10((obj.properties.luminosity || 1e26) + 1) / 10;
                return 0.5 + lumFactor;
            }
            case CosmicObjectType.BLACK_HOLE:
                return Math.max(0.8, Math.log10(obj.properties.mass + 1) / 30);
            case CosmicObjectType.PLANET:
            case CosmicObjectType.MOON: {
                const baseRadius = 0.2;
                const radiusFactor = Math.log10(obj.properties.radius / 6.371e6 + 1);
                return baseRadius + radiusFactor * 0.1;
            }
            case CosmicObjectType.NEUTRON_STAR:
                return 0.4;
            default:
                return 0.3;
        }
    }

    /**
     * Calculate gravitational force between two objects
     * Uses scene-scale masses (log10 of real mass) for balanced interactions
     * Returns force ON obj1 FROM obj2
     */
    private calculateGravitationalForce(obj1: CosmicObject, obj2: CosmicObject): Vector3 {
        // Direction from obj1 to obj2
        const dx = obj2.state.position.x - obj1.state.position.x;
        const dy = obj2.state.position.y - obj1.state.position.y;
        const dz = obj2.state.position.z - obj1.state.position.z;

        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);

        // Adaptive softening based on visual radii to prevent singularities
        const r1 = this.getVisualRadius(obj1);
        const r2 = this.getVisualRadius(obj2);
        const softeningLen = this.config.softening + 0.3 * (r1 + r2);
        const effectiveDistSq = distSq + softeningLen * softeningLen;

        // Scene-scale gravity:
        // mass1, mass2 are log10(real_mass) giving values ~15-30
        // G_scene is tuned so two stars at distance 10 produce visible acceleration
        const mass1 = toSceneMass(obj1.properties.mass);
        const mass2 = toSceneMass(obj2.properties.mass);

        // gravityStrength: 0-100 slider, 50 = normal
        const G_SCENE = 20.0 * (this.config.gravityStrength / 50);

        let forceMag = (G_SCENE * mass1 * mass2) / effectiveDistSq;

        // Smooth distance falloff using gravityRange config
        // gravityRange: 0-10 scale, determines effective range of gravity
        // Objects beyond maxRange experience exponentially decaying force
        const maxRange = this.config.gravityRange * 100; // e.g., 5 * 100 = 500 units
        if (dist > maxRange * 0.5) {
            const falloff = Math.exp(-2.0 * (dist - maxRange * 0.5) / maxRange);
            forceMag *= falloff;
        }

        // Safety clamp (very high, just prevents numerical explosions)
        forceMag = Math.min(forceMag, this.config.maxForce);

        // Calculate force direction
        if (dist < 1e-8) return Vector3.zero();

        const fx = (forceMag * dx) / dist;
        const fy = (forceMag * dy) / dist;
        const fz = (forceMag * dz) / dist;

        this.stats.forceCalculations++;

        return new Vector3(fx, fy, fz);
    }

    /**
     * Check for collision between two objects (bounding sphere)
     */
    private checkCollision(obj1: CosmicObject, obj2: CosmicObject): boolean {
        const dist = obj1.state.position.distanceTo(obj2.state.position);
        const radius1 = this.getVisualRadius(obj1);
        const radius2 = this.getVisualRadius(obj2);
        const combinedRadius = radius1 + radius2;
        return dist <= combinedRadius;
    }

    /**
     * Classify the collision type based on the two colliding objects
     */
    private classifyCollision(obj1: CosmicObject, obj2: CosmicObject): CollisionType {
        const t1 = obj1.type;
        const t2 = obj2.type;

        // Black hole collisions take highest priority
        if (t1 === CosmicObjectType.BLACK_HOLE && t2 === CosmicObjectType.BLACK_HOLE) {
            return 'blackhole_merger';
        }
        if (t1 === CosmicObjectType.BLACK_HOLE || t2 === CosmicObjectType.BLACK_HOLE) {
            return 'tidal_disruption';
        }

        // Neutron star mergers
        if (t1 === CosmicObjectType.NEUTRON_STAR && t2 === CosmicObjectType.NEUTRON_STAR) {
            return 'kilonova';
        }

        // Stellar collisions (star+star or star+neutron star)
        if (t1 === CosmicObjectType.STAR && t2 === CosmicObjectType.STAR) {
            return 'stellar_collision';
        }
        if ((t1 === CosmicObjectType.STAR && t2 === CosmicObjectType.NEUTRON_STAR) ||
            (t1 === CosmicObjectType.NEUTRON_STAR && t2 === CosmicObjectType.STAR)) {
            return 'stellar_collision';
        }

        // Gas giant collisions
        const isGasGiant1 = t1 === CosmicObjectType.PLANET && (obj1 as Planet).isRocky === false;
        const isGasGiant2 = t2 === CosmicObjectType.PLANET && (obj2 as Planet).isRocky === false;
        if (isGasGiant1 && isGasGiant2) {
            return 'gas_collision';
        }
        // One gas giant + smaller object
        if (isGasGiant1 || isGasGiant2) {
            return 'gas_collision';
        }

        // Star absorbing smaller objects
        if (t1 === CosmicObjectType.STAR || t2 === CosmicObjectType.STAR) {
            return 'stellar_collision';
        }

        // Neutron star absorbing smaller objects
        if (t1 === CosmicObjectType.NEUTRON_STAR || t2 === CosmicObjectType.NEUTRON_STAR) {
            return 'tidal_disruption';
        }

        // Default: rocky collision
        return 'rocky_collision';
    }

    /**
     * Detect and handle all collisions with type-based physics
     */
    private processCollisions(): void {
        if (!this.config.enableCollisions) return;

        const objects = Array.from(this.objects.values())
            .filter(obj => obj.isPhysicsEnabled && !this.objectsToRemove.has(obj.id));

        const debrisToAdd: CosmicObject[] = [];

        // O(n²) collision detection
        for (let i = 0; i < objects.length; i++) {
            for (let j = i + 1; j < objects.length; j++) {
                const obj1 = objects[i];
                const obj2 = objects[j];

                if (this.objectsToRemove.has(obj1.id) || this.objectsToRemove.has(obj2.id)) continue;

                if (this.checkCollision(obj1, obj2)) {
                    this.stats.collisions++;

                    // Debris limit
                    if (this.objects.size > 300) {
                        // Just merge without debris
                        this.objectsToRemove.add(obj1.id);
                        this.objectsToRemove.add(obj2.id);
                        continue;
                    }

                    const collisionType = this.classifyCollision(obj1, obj2);

                    switch (collisionType) {
                        case 'rocky_collision':
                            this.handleRockyCollision(obj1, obj2, debrisToAdd);
                            break;
                        case 'gas_collision':
                            this.handleGasCollision(obj1, obj2, debrisToAdd);
                            break;
                        case 'stellar_collision':
                            this.handleStellarCollision(obj1, obj2, debrisToAdd);
                            break;
                        case 'kilonova':
                            this.handleKilonovaCollision(obj1, obj2, debrisToAdd);
                            break;
                        case 'blackhole_merger':
                            this.handleBlackHoleMerger(obj1, obj2, debrisToAdd);
                            break;
                        case 'tidal_disruption':
                            this.handleTidalDisruption(obj1, obj2, debrisToAdd);
                            break;
                    }
                }
            }
        }

        // Apply removals
        for (const id of this.objectsToRemove) {
            this.objects.delete(id);
        }
        this.objectsToRemove.clear();

        // Add debris
        for (const debris of debrisToAdd) {
            this.objects.set(debris.id, debris);
        }

        this.stats.objectCount = this.objects.size;
    }

    /**
     * Helper: compute collision center and velocity
     */
    private getCollisionCenter(obj1: CosmicObject, obj2: CosmicObject) {
        const totalMass = obj1.properties.mass + obj2.properties.mass;
        const m1 = obj1.properties.mass;
        const m2 = obj2.properties.mass;

        const centerPos = obj1.state.position.scale(m1)
            .add(obj2.state.position.scale(m2))
            .scale(1 / totalMass);

        const centerVel = obj1.state.velocity.scale(m1)
            .add(obj2.state.velocity.scale(m2))
            .scale(1 / totalMass);

        const relVel = obj1.state.velocity.subtract(obj2.state.velocity).magnitude();
        const energy = 0.5 * (m1 * m2 / totalMass) * relVel * relVel;

        return { centerPos, centerVel, totalMass, m1, m2, relVel, energy };
    }

    /**
     * Helper: generate random spherical direction
     */
    private randomSphereDir(): Vector3 {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        return new Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        );
    }

    /**
     * Helper: record a collision event
     */
    private recordCollisionEvent(
        obj1: CosmicObject, obj2: CosmicObject,
        collisionType: CollisionType, type: 'merge' | 'absorption',
        centerPos: Vector3, energy: number, resultId: string = ''
    ) {
        this.collisionEvents.push({
            timestamp: Date.now(),
            object1Id: obj1.id,
            object2Id: obj2.id,
            object1Name: obj1.metadata.name,
            object2Name: obj2.metadata.name,
            type,
            collisionType,
            resultId,
            position: { x: centerPos.x, y: centerPos.y, z: centerPos.z },
            energy,
        });
    }

    // ─── Category 1: Rocky/Normal Collisions ────────────────────────────
    private handleRockyCollision(obj1: CosmicObject, obj2: CosmicObject, debrisToAdd: CosmicObject[]): void {
        const { centerPos, centerVel, totalMass, m1, m2, energy } = this.getCollisionCenter(obj1, obj2);
        const r1 = this.getVisualRadius(obj1);
        const r2 = this.getVisualRadius(obj2);
        const massRatio = Math.max(m1, m2) / Math.min(m1, m2);

        if (massRatio >= 3) {
            // Asymmetric: smaller splatters, larger absorbs
            const [larger, smaller] = m1 > m2 ? [obj1, obj2] : [obj2, obj1];
            this.objectsToRemove.add(smaller.id);

            // Increase larger object's mass
            larger.properties.mass += smaller.properties.mass;

            // Brief temperature boost on larger
            larger.properties.temperature = Math.max(larger.properties.temperature, smaller.properties.temperature) + 200;

            const debrisCount = Math.min(Math.floor(Math.sqrt(toSceneMass(smaller.properties.mass))) + 2, 6);
            const spawnOffset = (r1 + r2) * 0.5;

            for (let k = 0; k < debrisCount; k++) {
                const dir = this.randomSphereDir();
                const speed = Math.random() * 4.0 + 1.5;
                debrisToAdd.push({
                    id: crypto.randomUUID(),
                    type: CosmicObjectType.ASTEROID,
                    state: {
                        position: larger.state.position.add(dir.scale(spawnOffset)),
                        velocity: larger.state.velocity.add(dir.scale(speed)),
                        acceleration: Vector3.zero(),
                        angularVelocity: Vector3.zero(),
                        orientation: [0, 0, 0, 1]
                    },
                    properties: {
                        mass: smaller.properties.mass / debrisCount,
                        radius: 0.1 + Math.random() * 0.2,
                        density: 5000,
                        temperature: Math.max(smaller.properties.temperature, 1500) + 500,
                        luminosity: 0, charge: 0, magneticField: 0
                    },
                    visual: { color: '#ff8844', emissive: 1.0, opacity: 1 },
                    isPhysicsEnabled: true, lodLevel: 0,
                    metadata: { name: 'Debris', createdAt: Date.now(), modifiedAt: Date.now(), isRealObject: false, tags: ['debris', 'rocky'] }
                });
            }

            this.recordCollisionEvent(obj1, obj2, 'rocky_collision', 'absorption', larger.state.position, energy);
        } else {
            // Symmetric: both destroyed, debris + merged body
            this.objectsToRemove.add(obj1.id);
            this.objectsToRemove.add(obj2.id);

            const debrisCount = Math.min(Math.floor(Math.sqrt(toSceneMass(totalMass))) + 3, 8);
            const spawnOffset = (r1 + r2) * 0.5;

            for (let k = 0; k < debrisCount; k++) {
                const dir = this.randomSphereDir();
                const speed = Math.random() * 5.0 + 2.0;
                debrisToAdd.push({
                    id: crypto.randomUUID(),
                    type: CosmicObjectType.ASTEROID,
                    state: {
                        position: centerPos.add(dir.scale(spawnOffset)),
                        velocity: centerVel.add(dir.scale(speed)),
                        acceleration: Vector3.zero(),
                        angularVelocity: Vector3.zero(),
                        orientation: [0, 0, 0, 1]
                    },
                    properties: {
                        mass: totalMass / debrisCount,
                        radius: 0.15 + Math.random() * 0.25,
                        density: 5000,
                        temperature: Math.max(obj1.properties.temperature, obj2.properties.temperature) + 500,
                        luminosity: 0, charge: 0, magneticField: 0
                    },
                    visual: { color: '#ff8844', emissive: 1.0, opacity: 1 },
                    isPhysicsEnabled: true, lodLevel: 0,
                    metadata: { name: 'Debris', createdAt: Date.now(), modifiedAt: Date.now(), isRealObject: false, tags: ['debris', 'rocky'] }
                });
            }

            this.recordCollisionEvent(obj1, obj2, 'rocky_collision', 'merge', centerPos, energy);
        }
    }

    // ─── Category 2: Gas Giant Collisions ────────────────────────────────
    private handleGasCollision(obj1: CosmicObject, obj2: CosmicObject, debrisToAdd: CosmicObject[]): void {
        const { centerPos, centerVel, totalMass, m1, m2, energy } = this.getCollisionCenter(obj1, obj2);
        const r1 = this.getVisualRadius(obj1);
        const r2 = this.getVisualRadius(obj2);
        const massRatio = Math.max(m1, m2) / Math.min(m1, m2);

        const gasColors = ['#4488ff', '#8866cc', '#aaccff', '#6644aa', '#ffffff'];

        if (massRatio >= 3) {
            // Smaller absorbed by gas giant
            const [larger, smaller] = m1 > m2 ? [obj1, obj2] : [obj2, obj1];
            this.objectsToRemove.add(smaller.id);
            larger.properties.mass += smaller.properties.mass;

            // Spawn a few gas cloud puffs that dissipate
            for (let k = 0; k < 4; k++) {
                const dir = this.randomSphereDir();
                const speed = Math.random() * 2 + 0.5;
                debrisToAdd.push({
                    id: crypto.randomUUID(),
                    type: CosmicObjectType.GAS_CLOUD,
                    state: {
                        position: larger.state.position.add(dir.scale((r1 + r2) * 0.4)),
                        velocity: larger.state.velocity.add(dir.scale(speed)),
                        acceleration: Vector3.zero(),
                        angularVelocity: Vector3.zero(),
                        orientation: [0, 0, 0, 1]
                    },
                    properties: {
                        mass: smaller.properties.mass * 0.1 / 4,
                        radius: 0.3 + Math.random() * 0.4,
                        density: 5,
                        temperature: 200,
                        luminosity: 0, charge: 0, magneticField: 0
                    },
                    visual: { color: gasColors[k % gasColors.length], emissive: 0.2, opacity: 0.6 },
                    isPhysicsEnabled: true, lodLevel: 0,
                    metadata: { name: 'Gas Puff', createdAt: Date.now(), modifiedAt: Date.now(), isRealObject: false, tags: ['debris', 'gas'] }
                });
            }

            this.recordCollisionEvent(obj1, obj2, 'gas_collision', 'absorption', larger.state.position, energy);
        } else {
            // Both destroyed, gas cloud debris
            this.objectsToRemove.add(obj1.id);
            this.objectsToRemove.add(obj2.id);

            const debrisCount = Math.min(Math.floor(Math.sqrt(toSceneMass(totalMass))) + 4, 12);
            const spawnOffset = (r1 + r2) * 0.6;

            for (let k = 0; k < debrisCount; k++) {
                const dir = this.randomSphereDir();
                const speed = Math.random() * 3.0 + 1.0;
                debrisToAdd.push({
                    id: crypto.randomUUID(),
                    type: CosmicObjectType.GAS_CLOUD,
                    state: {
                        position: centerPos.add(dir.scale(spawnOffset)),
                        velocity: centerVel.add(dir.scale(speed)),
                        acceleration: Vector3.zero(),
                        angularVelocity: Vector3.zero(),
                        orientation: [0, 0, 0, 1]
                    },
                    properties: {
                        mass: totalMass / debrisCount,
                        radius: 0.3 + Math.random() * 0.5,
                        density: 1 + Math.random() * 9,
                        temperature: 150 + Math.random() * 100,
                        luminosity: 0, charge: 0, magneticField: 0
                    },
                    visual: {
                        color: gasColors[k % gasColors.length],
                        emissive: 0.15,
                        opacity: 0.5 + Math.random() * 0.2
                    },
                    isPhysicsEnabled: true, lodLevel: 0,
                    metadata: { name: 'Gas Cloud', createdAt: Date.now(), modifiedAt: Date.now(), isRealObject: false, tags: ['debris', 'gas'] }
                });
            }

            this.recordCollisionEvent(obj1, obj2, 'gas_collision', 'merge', centerPos, energy);
        }
    }

    // ─── Category 3: Stellar Collision → Nebula ─────────────────────────
    private handleStellarCollision(obj1: CosmicObject, obj2: CosmicObject, debrisToAdd: CosmicObject[]): void {
        const { centerPos, centerVel, totalMass, m1, m2, energy } = this.getCollisionCenter(obj1, obj2);
        const r1 = this.getVisualRadius(obj1);
        const r2 = this.getVisualRadius(obj2);
        const massRatio = Math.max(m1, m2) / Math.min(m1, m2);

        // If one is a STAR and the other is a small non-star, star absorbs it
        const isStar1 = obj1.type === CosmicObjectType.STAR;
        const isStar2 = obj2.type === CosmicObjectType.STAR;
        const isNS1 = obj1.type === CosmicObjectType.NEUTRON_STAR;
        const isNS2 = obj2.type === CosmicObjectType.NEUTRON_STAR;

        if ((isStar1 && !isStar2 && !isNS2) || (isStar2 && !isStar1 && !isNS1)) {
            // Star absorbs smaller non-star/non-NS object
            const [star, other] = isStar1 ? [obj1, obj2] : [obj2, obj1];
            this.objectsToRemove.add(other.id);
            star.properties.mass += other.properties.mass;
            star.properties.temperature += 500; // Brief flare

            // Spawn a few flare particles
            for (let k = 0; k < 5; k++) {
                const dir = this.randomSphereDir();
                const speed = Math.random() * 6 + 2;
                debrisToAdd.push({
                    id: crypto.randomUUID(),
                    type: CosmicObjectType.GAS_CLOUD,
                    state: {
                        position: star.state.position.add(dir.scale(r1 * 0.8)),
                        velocity: star.state.velocity.add(dir.scale(speed)),
                        acceleration: Vector3.zero(),
                        angularVelocity: Vector3.zero(),
                        orientation: [0, 0, 0, 1]
                    },
                    properties: {
                        mass: other.properties.mass * 0.05,
                        radius: 0.15, density: 100,
                        temperature: 8000, luminosity: 1e24,
                        charge: 0, magneticField: 0
                    },
                    visual: { color: '#ffcc44', emissive: 1.0, opacity: 0.9 },
                    isPhysicsEnabled: true, lodLevel: 0,
                    metadata: { name: 'Stellar Flare', createdAt: Date.now(), modifiedAt: Date.now(), isRealObject: false, tags: ['debris', 'stellar_flare'] }
                });
            }

            this.recordCollisionEvent(obj1, obj2, 'stellar_collision', 'absorption', star.state.position, energy);
            return;
        }

        // Star+Star or Star+NeutronStar: massive explosion + nebula
        this.objectsToRemove.add(obj1.id);
        this.objectsToRemove.add(obj2.id);

        // For Star+NS: check if result should be a black hole (combined mass > 3 solar masses)
        if ((isStar1 && isNS2) || (isStar2 && isNS1)) {
            const TOV_LIMIT = 3 * AstronomicalUnits.M_sun;
            if (totalMass > TOV_LIMIT) {
                // Forms a black hole
                const bh = createBlackHole({
                    name: 'Collision Black Hole',
                    position: centerPos,
                    velocity: centerVel,
                    massSolarUnits: totalMass / AstronomicalUnits.M_sun,
                    isAccreting: true,
                });
                debrisToAdd.push(bh);
                this.recordCollisionEvent(obj1, obj2, 'stellar_collision', 'merge', centerPos, energy * 10, bh.id);
                return;
            }
        }

        // Spawn 15-30 high-velocity debris
        const debrisCount = 15 + Math.floor(Math.random() * 16);
        const stellarColors = ['#ffffff', '#aaccff', '#ffaa44', '#ff6633', '#88bbff'];
        const spawnOffset = (r1 + r2) * 0.6;

        for (let k = 0; k < debrisCount; k++) {
            const dir = this.randomSphereDir();
            const speed = Math.random() * 12 + 5;
            const isGas = Math.random() > 0.3;
            debrisToAdd.push({
                id: crypto.randomUUID(),
                type: isGas ? CosmicObjectType.GAS_CLOUD : CosmicObjectType.ASTEROID,
                state: {
                    position: centerPos.add(dir.scale(spawnOffset)),
                    velocity: centerVel.add(dir.scale(speed)),
                    acceleration: Vector3.zero(),
                    angularVelocity: Vector3.zero(),
                    orientation: [0, 0, 0, 1]
                },
                properties: {
                    mass: totalMass * 0.01,
                    radius: isGas ? 0.2 + Math.random() * 0.4 : 0.1 + Math.random() * 0.15,
                    density: isGas ? 10 : 3000,
                    temperature: 15000 + Math.random() * 10000,
                    luminosity: 1e25, charge: 0, magneticField: 0
                },
                visual: {
                    color: stellarColors[k % stellarColors.length],
                    emissive: 1.0,
                    opacity: isGas ? 0.7 : 1.0
                },
                isPhysicsEnabled: true, lodLevel: 0,
                metadata: { name: 'Stellar Debris', createdAt: Date.now(), modifiedAt: Date.now(), isRealObject: false, tags: ['debris', 'stellar'] }
            });
        }

        // Spawn nebula at collision center
        const massSolar = totalMass / AstronomicalUnits.M_sun;
        const nebulaExtent = Math.min(Math.max(2 + massSolar * 0.5, 2), 30);

        const nebula = createNebula({
            name: 'Collision Nebula',
            position: centerPos,
            nebulaType: 'supernova_remnant',
            sizeParsecs: 0.001, // Small in parsecs, we override extent below
        });
        // Override properties for collision-spawned nebula
        nebula.properties.mass = totalMass * 0.7; // 70% of mass stays in nebula
        nebula.isPhysicsEnabled = true;
        nebula.state.velocity = centerVel;
        (nebula as Nebula).extent = new Vector3(nebulaExtent, nebulaExtent, nebulaExtent);
        (nebula as Nebula).nebulaOriginMass = totalMass;
        debrisToAdd.push(nebula);

        this.recordCollisionEvent(obj1, obj2, 'stellar_collision', 'merge', centerPos, energy * 5, nebula.id);
    }

    // ─── Category 4: Kilonova (NS + NS → Black Hole) ────────────────────
    private handleKilonovaCollision(obj1: CosmicObject, obj2: CosmicObject, debrisToAdd: CosmicObject[]): void {
        const { centerPos, centerVel, totalMass, energy } = this.getCollisionCenter(obj1, obj2);
        const r1 = this.getVisualRadius(obj1);
        const r2 = this.getVisualRadius(obj2);

        this.objectsToRemove.add(obj1.id);
        this.objectsToRemove.add(obj2.id);

        // Phase 1: Massive particle explosion (30-50 debris pieces)
        const debrisCount = 30 + Math.floor(Math.random() * 21);
        const debrisIds: string[] = [];
        const spawnOffset = (r1 + r2) * 0.5;

        for (let k = 0; k < debrisCount; k++) {
            const dir = this.randomSphereDir();
            const speed = Math.random() * 20 + 8; // Very high velocity
            const debrisId = crypto.randomUUID();
            debrisIds.push(debrisId);

            debrisToAdd.push({
                id: debrisId,
                type: CosmicObjectType.ASTEROID,
                state: {
                    position: centerPos.add(dir.scale(spawnOffset)),
                    velocity: centerVel.add(dir.scale(speed)),
                    acceleration: Vector3.zero(),
                    angularVelocity: Vector3.zero(),
                    orientation: [0, 0, 0, 1]
                },
                properties: {
                    mass: totalMass / debrisCount,
                    radius: 0.08 + Math.random() * 0.12,
                    density: 1e17, // Neutron degenerate matter
                    temperature: 50000 + Math.random() * 50000,
                    luminosity: 1e28, charge: 0, magneticField: 1e9
                },
                visual: { color: '#ccddff', emissive: 1.0, opacity: 1 },
                isPhysicsEnabled: true, lodLevel: 0,
                metadata: { name: 'Kilonova Ejecta', createdAt: Date.now(), modifiedAt: Date.now(), isRealObject: false, tags: ['debris', 'kilonova_debris'] }
            });
        }

        // Register kilonova collapse event (black hole forms after 5s)
        this.kilonovaCollapses.push({
            centerPos: centerPos.clone(),
            centerVel: centerVel.clone(),
            combinedMass: totalMass,
            timestamp: Date.now(),
            debrisIds,
        });

        this.recordCollisionEvent(obj1, obj2, 'kilonova', 'merge', centerPos, energy * 20);
    }

    // ─── Category 5A: Black Hole Merger ──────────────────────────────────
    private handleBlackHoleMerger(obj1: CosmicObject, obj2: CosmicObject, debrisToAdd: CosmicObject[]): void {
        const { centerPos, centerVel, totalMass, energy } = this.getCollisionCenter(obj1, obj2);

        this.objectsToRemove.add(obj1.id);
        this.objectsToRemove.add(obj2.id);

        // Clean merger: new larger black hole
        const bh1 = obj1 as any;
        const bh2 = obj2 as any;
        const avgSpin = ((bh1.spin ?? 0) + (bh2.spin ?? 0)) / 2;
        const isAccreting = (bh1.isAccreting || bh2.isAccreting) ?? false;

        const newBH = createBlackHole({
            name: 'Merged Black Hole',
            position: centerPos,
            velocity: centerVel,
            massSolarUnits: totalMass / AstronomicalUnits.M_sun,
            spin: avgSpin,
            isAccreting,
        });
        debrisToAdd.push(newBH);

        this.recordCollisionEvent(obj1, obj2, 'blackhole_merger', 'merge', centerPos, energy * 0.05, newBH.id);
    }

    // ─── Category 5B: Tidal Disruption / Spaghettification ──────────────
    private handleTidalDisruption(obj1: CosmicObject, obj2: CosmicObject, debrisToAdd: CosmicObject[]): void {
        // Determine which is the black hole / neutron star and which is the victim
        const isBH1 = obj1.type === CosmicObjectType.BLACK_HOLE;
        const isBH2 = obj2.type === CosmicObjectType.BLACK_HOLE;
        const isNS1 = obj1.type === CosmicObjectType.NEUTRON_STAR;
        const isNS2 = obj2.type === CosmicObjectType.NEUTRON_STAR;

        let attractor: CosmicObject;
        let victim: CosmicObject;

        if (isBH1) { attractor = obj1; victim = obj2; }
        else if (isBH2) { attractor = obj2; victim = obj1; }
        else if (isNS1) { attractor = obj1; victim = obj2; }
        else { attractor = obj2; victim = obj1; }

        // Victim is destroyed, attractor persists
        this.objectsToRemove.add(victim.id);
        attractor.properties.mass += victim.properties.mass;

        // Set accreting if it's a black hole
        if (attractor.type === CosmicObjectType.BLACK_HOLE) {
            (attractor as any).isAccreting = true;
        }

        const { energy } = this.getCollisionCenter(obj1, obj2);

        // Spawn 10-20 debris in a spiral/orbital pattern around the attractor
        const debrisCount = 10 + Math.floor(Math.random() * 11);
        const attractorR = this.getVisualRadius(attractor);
        const orbitRadius = attractorR * 2.5;

        // Pick an arbitrary orbital plane (mostly XZ with slight Y)
        for (let k = 0; k < debrisCount; k++) {
            const angle = (k / debrisCount) * Math.PI * 2 + Math.random() * 0.3;
            const r = orbitRadius * (1.0 + Math.random() * 1.5);
            const yOffset = (Math.random() - 0.5) * 0.3; // Slight out-of-plane

            // Position in orbit around attractor
            const px = attractor.state.position.x + Math.cos(angle) * r;
            const py = attractor.state.position.y + yOffset;
            const pz = attractor.state.position.z + Math.sin(angle) * r;

            // Tangential velocity for orbital motion
            const orbitalSpeed = 4 + Math.random() * 6;
            const vx = attractor.state.velocity.x + (-Math.sin(angle)) * orbitalSpeed;
            const vy = attractor.state.velocity.y;
            const vz = attractor.state.velocity.z + Math.cos(angle) * orbitalSpeed;

            debrisToAdd.push({
                id: crypto.randomUUID(),
                type: CosmicObjectType.GAS_CLOUD,
                state: {
                    position: new Vector3(px, py, pz),
                    velocity: new Vector3(vx, vy, vz),
                    acceleration: Vector3.zero(),
                    angularVelocity: Vector3.zero(),
                    orientation: [0, 0, 0, 1]
                },
                properties: {
                    mass: victim.properties.mass / debrisCount,
                    radius: 0.1 + Math.random() * 0.15,
                    density: 100,
                    temperature: 30000 + Math.random() * 30000,
                    luminosity: 1e27, charge: 0, magneticField: 0
                },
                visual: {
                    color: k % 3 === 0 ? '#ffffff' : k % 3 === 1 ? '#ffdd66' : '#88aaff',
                    emissive: 1.0,
                    opacity: 0.9
                },
                isPhysicsEnabled: true, lodLevel: 0,
                metadata: { name: 'Accretion Stream', createdAt: Date.now(), modifiedAt: Date.now(), isRealObject: false, tags: ['debris', 'tidal'] }
            });
        }

        this.recordCollisionEvent(obj1, obj2, 'tidal_disruption', 'absorption', attractor.state.position, energy * 8);
    }

    /**
     * Process nebula evolution: check for star formation and dissipation
     */
    private processNebulaEvolution(): void {
        const STAR_FORMATION_AGE_MS = 30000; // 30 seconds real time
        const STAR_FORMATION_MASS_THRESHOLD = 5 * AstronomicalUnits.M_sun;
        const STAR_MASS_FRACTION = 0.2; // Each star takes 20% of remaining mass
        const DISSIPATION_MASS = 0.5 * AstronomicalUnits.M_sun; // Remove when below this
        const now = Date.now();

        const nebulae = Array.from(this.objects.values())
            .filter(obj => obj.type === CosmicObjectType.NEBULA) as Nebula[];

        for (const nebula of nebulae) {
            const age = now - nebula.metadata.createdAt;

            // Check for star formation
            if (age > STAR_FORMATION_AGE_MS &&
                nebula.properties.mass > STAR_FORMATION_MASS_THRESHOLD &&
                nebula.nebulaOriginMass !== undefined) {

                // Spawn 1-3 baby stars
                const starCount = 1 + Math.floor(Math.random() * 3);
                const extent = nebula.extent;

                for (let i = 0; i < starCount; i++) {
                    if (nebula.properties.mass <= STAR_FORMATION_MASS_THRESHOLD) break;

                    const starMass = nebula.properties.mass * STAR_MASS_FRACTION;
                    nebula.properties.mass -= starMass;

                    // Random position within nebula extent
                    const offset = new Vector3(
                        (Math.random() - 0.5) * extent.x * 0.8,
                        (Math.random() - 0.5) * extent.y * 0.8,
                        (Math.random() - 0.5) * extent.z * 0.8
                    );

                    const babyStar = createStar({
                        name: `Baby Star ${i + 1}`,
                        position: nebula.state.position.add(offset),
                        velocity: nebula.state.velocity.add(new Vector3(
                            (Math.random() - 0.5) * 0.5,
                            (Math.random() - 0.5) * 0.5,
                            (Math.random() - 0.5) * 0.5
                        )),
                        massSolarUnits: starMass / AstronomicalUnits.M_sun,
                    });

                    this.objects.set(babyStar.id, babyStar);
                }

                // Push forward the creation time to delay next star formation cycle
                nebula.metadata.createdAt = now;
            }

            // Dissipate nebula when mass is too low
            if (nebula.properties.mass < DISSIPATION_MASS) {
                this.objects.delete(nebula.id);
            }
        }

        this.stats.objectCount = this.objects.size;
    }

    /**
     * Process kilonova collapses: after 5 seconds, debris collapses into black hole
     */
    private processKilonovaCollapse(): void {
        const COLLAPSE_DELAY_MS = 5000; // 5 seconds real time
        const now = Date.now();

        const completed: number[] = [];

        for (let i = 0; i < this.kilonovaCollapses.length; i++) {
            const kn = this.kilonovaCollapses[i];
            if (now - kn.timestamp >= COLLAPSE_DELAY_MS) {
                // Remove all kilonova debris
                for (const debrisId of kn.debrisIds) {
                    this.objects.delete(debrisId);
                }

                // Spawn black hole at center
                const bh = createBlackHole({
                    name: 'Kilonova Black Hole',
                    position: kn.centerPos,
                    velocity: kn.centerVel,
                    massSolarUnits: kn.combinedMass / AstronomicalUnits.M_sun,
                    isAccreting: true,
                    spin: 0.7, // High spin from angular momentum
                });
                this.objects.set(bh.id, bh);

                completed.push(i);
            }
        }

        // Remove completed collapses (reverse order to keep indices valid)
        for (let i = completed.length - 1; i >= 0; i--) {
            this.kilonovaCollapses.splice(completed[i], 1);
        }

        if (completed.length > 0) {
            this.stats.objectCount = this.objects.size;
        }
    }

    /**
     * Update simulation by one time step
     * Uses Velocity Verlet integration for stability (energy-conserving)
     */
    step(dt?: number): void {
        const startTime = performance.now();
        const timeStep = dt ?? this.config.dt;

        // Skip extremely tiny or zero timesteps
        if (timeStep < 1e-10) {
            this.stats.lastUpdateTime = 0;
            return;
        }

        this.stats.forceCalculations = 0;

        const physicsObjects = Array.from(this.objects.values())
            .filter(obj => obj.isPhysicsEnabled);

        if (physicsObjects.length === 0) {
            this.stats.lastUpdateTime = performance.now() - startTime;
            return;
        }

        // STEP 1: Calculate all forces and accelerations at current positions
        const accelerations = new Map<CosmicObjectId, Vector3>();

        for (const obj of physicsObjects) {
            let totalForce = Vector3.zero();

            for (const other of physicsObjects) {
                if (obj.id === other.id) continue;
                const force = this.calculateGravitationalForce(obj, other);
                totalForce = totalForce.add(force);
            }

            // a = F / m (using scene-scale mass for consistency)
            const sceneMass = toSceneMass(obj.properties.mass);
            const acceleration = totalForce.scale(1 / Math.max(sceneMass, 0.1));
            accelerations.set(obj.id, acceleration);
        }

        // STEP 2: Velocity Verlet - Update positions
        // x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt²
        for (const obj of physicsObjects) {
            const state = obj.state;
            const acc = accelerations.get(obj.id) ?? Vector3.zero();
            const halfDtSq = 0.5 * timeStep * timeStep;

            state.position = new Vector3(
                state.position.x + state.velocity.x * timeStep + acc.x * halfDtSq,
                state.position.y + state.velocity.y * timeStep + acc.y * halfDtSq,
                state.position.z + state.velocity.z * timeStep + acc.z * halfDtSq
            );
        }

        // STEP 3: Recalculate accelerations at new positions
        const newAccelerations = new Map<CosmicObjectId, Vector3>();

        for (const obj of physicsObjects) {
            let totalForce = Vector3.zero();

            for (const other of physicsObjects) {
                if (obj.id === other.id) continue;
                const force = this.calculateGravitationalForce(obj, other);
                totalForce = totalForce.add(force);
            }

            const sceneMass = toSceneMass(obj.properties.mass);
            const acceleration = totalForce.scale(1 / Math.max(sceneMass, 0.1));
            newAccelerations.set(obj.id, acceleration);
        }

        // STEP 4: Velocity Verlet - Update velocities (NO DAMPING — energy conservation)
        // v(t+dt) = v(t) + 0.5*(a(t) + a(t+dt))*dt
        for (const obj of physicsObjects) {
            const state = obj.state;
            const oldAcc = accelerations.get(obj.id) ?? Vector3.zero();
            const newAcc = newAccelerations.get(obj.id) ?? Vector3.zero();
            const halfDt = 0.5 * timeStep;

            state.velocity = new Vector3(
                state.velocity.x + (oldAcc.x + newAcc.x) * halfDt,
                state.velocity.y + (oldAcc.y + newAcc.y) * halfDt,
                state.velocity.z + (oldAcc.z + newAcc.z) * halfDt
            );

            // Clamp velocity (safety, not damping)
            const velMag = state.velocity.magnitude();
            if (velMag > this.config.maxVelocity) {
                state.velocity = state.velocity.scale(this.config.maxVelocity / velMag);
            }

            // Store acceleration for reference
            state.acceleration = newAcc;
        }

        // STEP 5: Process collisions
        this.processCollisions();

        // STEP 6: Process nebula evolution (star formation)
        this.processNebulaEvolution();

        // STEP 7: Process kilonova collapses (delayed black hole formation)
        this.processKilonovaCollapse();

        this.stats.lastUpdateTime = performance.now() - startTime;
    }

    /**
     * Calculate total kinetic energy of the system
     */
    getKineticEnergy(): number {
        let kineticEnergy = 0;
        for (const obj of this.objects.values()) {
            if (obj.isPhysicsEnabled) {
                const vSq = obj.state.velocity.magnitudeSquared();
                kineticEnergy += 0.5 * obj.properties.mass * vSq;
            }
        }
        return kineticEnergy;
    }

    /**
     * Calculate total potential energy of the system
     */
    getPotentialEnergy(): number {
        let potentialEnergy = 0;
        const objs = Array.from(this.objects.values())
            .filter(obj => obj.isPhysicsEnabled);

        for (let i = 0; i < objs.length; i++) {
            for (let j = i + 1; j < objs.length; j++) {
                const dist = objs[i].state.position.distanceTo(objs[j].state.position);
                if (dist > 0) {
                    potentialEnergy -= (PhysicalConstants.G * objs[i].properties.mass * objs[j].properties.mass) / dist;
                }
            }
        }
        return potentialEnergy;
    }

    /**
     * Get total mechanical energy (for conservation checking)
     */
    getTotalEnergy(): number {
        return this.getKineticEnergy() + this.getPotentialEnergy();
    }

    /**
     * Get center of mass of the system
     */
    getCenterOfMass(): Vector3 {
        let totalMass = 0;
        let comX = 0, comY = 0, comZ = 0;

        for (const obj of this.objects.values()) {
            if (obj.isPhysicsEnabled) {
                totalMass += obj.properties.mass;
                comX += obj.state.position.x * obj.properties.mass;
                comY += obj.state.position.y * obj.properties.mass;
                comZ += obj.state.position.z * obj.properties.mass;
            }
        }

        if (totalMass === 0) return Vector3.zero();
        return new Vector3(comX / totalMass, comY / totalMass, comZ / totalMass);
    }

    /**
     * Clear all objects
     */
    clear(): void {
        this.objects.clear();
        this.stats.objectCount = 0;
        this.stats.collisions = 0;
        this.collisionEvents = [];
    }
}

export default NBodyEngine;
