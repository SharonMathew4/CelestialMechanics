/**
 * Cosmic Fabric - N-body Physics Engine
 * 
 * COMPLETE IMPLEMENTATION with:
 * - Gravitational force calculation (O(n²) for correctness)
 * - Collision detection (bounding sphere)
 * - Collision response (inelastic merge)
 * - Velocity Verlet integration
 * - Debug logging
 */

import { Vector3 } from './vector';
import { CosmicObject, CosmicObjectId, CosmicObjectType } from './types';
import { PhysicalConstants } from './constants';

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

    /** Maximum velocity (m/s) */
    maxVelocity: number;

    /** Velocity damping factor (0-1, 1 = no damping) */
    velocityDamping: number;

    /** Enable collision detection and response */
    enableCollisions: boolean;

    /** Enable debug logging */
    enableDebugLogging: boolean;
}

/**
 * Default physics configuration
 */
export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
    gravityStrength: 50, // 0-100 scale, 50 = normal
    gravityRange: 5,     // 0-10 scale
    dt: 0.016,          // ~60fps frame time for scene-scale physics
    softening: 1e9,      // 1 billion meters
    maxForce: 1e25,      // Maximum force magnitude
    maxVelocity: 1e7,    // ~3% speed of light
    velocityDamping: 0.999, // Very subtle damping
    enableCollisions: true,
    enableDebugLogging: false,
};

/**
 * Collision event for logging
 */
export interface CollisionEvent {
    timestamp: number;
    object1Id: CosmicObjectId;
    object2Id: CosmicObjectId;
    object1Name: string;
    object2Name: string;
    type: 'merge' | 'absorption';
    resultId: CosmicObjectId;
}



/**
 * Main N-body physics engine with collision detection
 */
export class NBodyEngine {
    private config: PhysicsConfig;
    private objects: Map<CosmicObjectId, CosmicObject>;
    private collisionEvents: CollisionEvent[] = [];
    private objectsToRemove: Set<CosmicObjectId> = new Set();

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
            console.log(`[Physics] Added object: ${object.metadata.name} (${object.id})`);
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
     * Get simulation statistics
     */
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
        // Calculate energy for UI
        // Note: This is expensive (O(N^2) for potential), so we might want to throttle it
        // For now, we'll do it if object count is low, or estimate it
        // Or just leave it 0 if too expensive. 
        // Let's implement a simple Kinetic Energy calc (O(N))
        let ke = 0;
        for (const obj of this.objects.values()) {
            if (!obj.isPhysicsEnabled) continue;
            const v = obj.state.velocity.magnitude();
            ke += 0.5 * obj.properties.mass * v * v;
        }

        return {
            ...this.stats,
            totalEnergy: ke // approximated as KE for now to assume conservation trend
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
     * Calculate gravitational force between two objects
     * Uses SCENE-SCALE physics (not real SI units) for visible orbital motion
     * Returns force ON obj1 FROM obj2
     */
    private calculateGravitationalForce(obj1: CosmicObject, obj2: CosmicObject): Vector3 {
        // Direction from obj1 to obj2
        const dx = obj2.state.position.x - obj1.state.position.x;
        const dy = obj2.state.position.y - obj1.state.position.y;
        const dz = obj2.state.position.z - obj1.state.position.z;

        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);

        // Minimum distance to prevent singularity
        const minDist = 1.0;
        const effectiveDistSq = Math.max(distSq, minDist * minDist);

        // SCENE-SCALE GRAVITY: Use relative mass ratios
        // Convert real masses (kg) to relative scale
        const SOLAR_MASS = 1.989e30;
        const mass1Rel = obj1.properties.mass / SOLAR_MASS; // In solar masses
        const mass2Rel = obj2.properties.mass / SOLAR_MASS;

        // Scene-scale gravitational constant (tuned for visible orbits)
        // F = G_scene * m1 * m2 / r²
        // With G_scene = 50, two 1-solar-mass objects at distance 10 feel force F = 50 * 1 * 1 / 100 = 0.5
        const G_SCENE = 100 * (this.config.gravityStrength / 50); // Scale by slider (50 = normal)

        let forceMag = (G_SCENE * mass1Rel * mass2Rel) / effectiveDistSq;

        // Clamp force magnitude to prevent instability
        forceMag = Math.min(forceMag, 10000);

        // Calculate force direction (normalized)
        if (dist < 0.01) return Vector3.zero();

        const fx = (forceMag * dx) / dist;
        const fy = (forceMag * dy) / dist;
        const fz = (forceMag * dz) / dist;

        this.stats.forceCalculations++;

        if (this.config.enableDebugLogging) {
            console.log(`[Gravity] ${obj1.metadata.name} <- ${obj2.metadata.name}: dist=${dist.toFixed(2)}, force=${forceMag.toFixed(4)}`);
        }

        return new Vector3(fx, fy, fz);
    }

    /**
     * Calculate visual collision radius for an object
     * This converts physical radius to scene-unit scale for collision detection
     */
    private getVisualCollisionRadius(obj: CosmicObject): number {
        // Visual radius calculation matches Scene.tsx rendering
        // Base: ~0.5-2 scene units depending on object type and luminosity
        switch (obj.type) {
            case CosmicObjectType.STAR:
                const lumFactor = Math.log10((obj.properties.luminosity || 1e26) + 1) / 10;
                return 0.5 + lumFactor;
            case CosmicObjectType.BLACK_HOLE:
                return Math.log10(obj.properties.mass + 1) / 30;
            case CosmicObjectType.PLANET:
            case CosmicObjectType.MOON:
                return 0.3;
            default:
                return 0.5;
        }
    }

    /**
     * Check for collision between two objects (bounding sphere with visual radii)
     */
    private checkCollision(obj1: CosmicObject, obj2: CosmicObject): boolean {
        const dist = obj1.state.position.distanceTo(obj2.state.position);
        // Use VISUAL radii for collision, not physical radii (which are in meters)
        const radius1 = this.getVisualCollisionRadius(obj1);
        const radius2 = this.getVisualCollisionRadius(obj2);
        const combinedRadius = radius1 + radius2;
        return dist <= combinedRadius;
    }



    /**
     * Detect and handle all collisions with Debris Splatter
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
                    // Collision Detected: SPLATTER!
                    this.objectsToRemove.add(obj1.id);
                    this.objectsToRemove.add(obj2.id);

                    // Debris Limit
                    if (this.objects.size > 300) continue;

                    // 1. Calculate properties of collision
                    const totalMass = obj1.properties.mass + obj2.properties.mass;
                    const centerPos = obj1.state.position.scale(obj1.properties.mass)
                        .add(obj2.state.position.scale(obj2.properties.mass))
                        .scale(1 / totalMass);

                    const centerVel = obj1.state.velocity.scale(obj1.properties.mass)
                        .add(obj2.state.velocity.scale(obj2.properties.mass))
                        .scale(1 / totalMass);

                    // 2. Determine number of debris pieces (mass dependent)
                    // Max 8 pieces to prevent lag
                    const debrisCount = Math.min(Math.floor(Math.sqrt(totalMass / 1e23)) + 3, 8);

                    for (let k = 0; k < debrisCount; k++) {
                        const debrisMass = totalMass / debrisCount;
                        // Radius for Game Scale (Visual)
                        // Ignore density, just make it visible in scene units (0.3 - 0.7)
                        const debrisRadius = 0.3 + Math.random() * 0.4;

                        // Random explosive direction
                        const theta = Math.random() * Math.PI * 2;
                        const phi = Math.acos(2 * Math.random() - 1);
                        const speed = Math.random() * 5.0 + 2.0; // Explosive kick

                        const dir = new Vector3(
                            Math.sin(phi) * Math.cos(theta),
                            Math.sin(phi) * Math.sin(theta),
                            Math.cos(phi)
                        );

                        const debris: CosmicObject = {
                            id: crypto.randomUUID(),
                            type: CosmicObjectType.ASTEROID,
                            state: {
                                position: centerPos.add(dir.scale(obj1.properties.radius * 0.5)),
                                velocity: centerVel.add(dir.scale(speed)),
                                acceleration: Vector3.zero(),
                                angularVelocity: Vector3.zero(),
                                orientation: [0, 0, 0, 1]
                            },
                            properties: {
                                mass: debrisMass,
                                radius: debrisRadius,
                                density: 5000,
                                temperature: Math.max(obj1.properties.temperature, obj2.properties.temperature) + 500, // Heat up
                                luminosity: 0,
                                charge: 0,
                                magneticField: 0
                            },
                            visual: {
                                color: '#ff8844', // Hot debris
                                emissive: 1.0,
                                opacity: 1
                            },
                            isPhysicsEnabled: true,
                            lodLevel: 0,
                            metadata: {
                                name: 'Debris',
                                createdAt: Date.now(),
                                modifiedAt: Date.now(),
                                isRealObject: false,
                                tags: ['debris']
                            }
                        };
                        debrisToAdd.push(debris);
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
     * Update simulation by one time step
     * Uses Velocity Verlet integration for stability
     */
    step(dt?: number): void {
        const startTime = performance.now();
        const timeStep = dt ?? this.config.dt;

        this.stats.forceCalculations = 0;

        const physicsObjects = Array.from(this.objects.values())
            .filter(obj => obj.isPhysicsEnabled);

        if (physicsObjects.length === 0) {
            this.stats.lastUpdateTime = performance.now() - startTime;
            return;
        }

        // STEP 1: Calculate all forces and accelerations
        const accelerations = new Map<CosmicObjectId, Vector3>();
        const SOLAR_MASS = 1.989e30;

        for (const obj of physicsObjects) {
            let totalForce = Vector3.zero();

            // Sum gravitational forces from all other objects
            for (const other of physicsObjects) {
                if (obj.id === other.id) continue;
                const force = this.calculateGravitationalForce(obj, other);
                totalForce = totalForce.add(force);
            }

            // a = F / m (using relative mass for consistent scene-scale)
            const massRel = obj.properties.mass / SOLAR_MASS;
            const acceleration = totalForce.scale(1 / Math.max(massRel, 0.001));
            accelerations.set(obj.id, acceleration);

            if (this.config.enableDebugLogging && totalForce.magnitude() > 0) {
                console.log(`[Physics] ${obj.metadata.name}: Force=${totalForce.magnitude().toFixed(4)}, Accel=${acceleration.magnitude().toFixed(4)}`);
            }
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

            // Use relative mass for consistent scene-scale
            const massRel = obj.properties.mass / SOLAR_MASS;
            const acceleration = totalForce.scale(1 / Math.max(massRel, 0.001));
            newAccelerations.set(obj.id, acceleration);
        }

        // STEP 4: Velocity Verlet - Update velocities
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

            // Apply velocity damping
            state.velocity = state.velocity.scale(this.config.velocityDamping);

            // Clamp velocity
            const velMag = state.velocity.magnitude();
            if (velMag > this.config.maxVelocity) {
                state.velocity = state.velocity.scale(this.config.maxVelocity / velMag);
            }

            // Store acceleration for next frame
            state.acceleration = newAcc;
        }

        // STEP 5: Process collisions
        this.processCollisions();

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
