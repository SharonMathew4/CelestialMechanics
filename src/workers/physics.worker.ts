import { NBodyEngine } from '../engine/physics/nbody';
import { CosmicObject } from '../engine/physics/types';
import { Vector3 } from '../engine/physics/vector';

// Singleton engine instance in the worker
let engine: NBodyEngine;
let running = false;
let timeScale = 1;
const DEBUG = false; // Disable spammy debug logging

// Track previous object IDs to detect collision changes
let previousObjectIds = new Set<string>();

/**
 * Reconstruct Vector3 instances from plain objects
 * (postMessage structured clone strips class prototypes)
 */
function reconstructVectors(obj: CosmicObject): CosmicObject {
    const s = obj.state;
    const pos = s.position as any;
    const vel = s.velocity as any;
    const acc = s.acceleration as any;
    const ang = s.angularVelocity as any;

    obj.state = {
        position: new Vector3(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0),
        velocity: new Vector3(vel.x ?? 0, vel.y ?? 0, vel.z ?? 0),
        acceleration: new Vector3(acc.x ?? 0, acc.y ?? 0, acc.z ?? 0),
        angularVelocity: new Vector3(ang.x ?? 0, ang.y ?? 0, ang.z ?? 0),
        orientation: s.orientation ?? [1, 0, 0, 0],
    };

    return obj;
}

// Initialize engine
function init() {
    engine = new NBodyEngine({
        gravityStrength: 50,
        gravityRange: 5,
        dt: 1 / 60,
        enableCollisions: true,
        enableDebugLogging: DEBUG,
    });
    previousObjectIds = new Set();
    if (DEBUG) console.log('[Worker] Physics engine initialized');
}

// Main loop configuration
const FPS = 60;
const INTERVAL = 1000 / FPS;
const MAX_SUB_STEP_DT = 0.02; // Max dt per sub-step for stability
let lastTime = performance.now();

function step() {
    if (!running || !engine) return;

    const now = performance.now();
    const wallDt = (now - lastTime) / 1000;
    lastTime = now;

    // Compute effective dt with timeScale
    const clampedWallDt = Math.min(wallDt, 0.1); // Clamp wall delta
    const effectiveDt = clampedWallDt * timeScale;

    // Sub-stepping for stability at high time scales
    const numSteps = Math.max(1, Math.ceil(effectiveDt / MAX_SUB_STEP_DT));
    const subDt = effectiveDt / numSteps;

    for (let i = 0; i < numSteps; i++) {
        engine.step(subDt);
    }

    // Get optimized binary state
    const { ids, buffer } = engine.getPhysicsState();

    // Detect collision changes (objects added/removed by physics)
    const currentIds = new Set(ids);
    const allEngineObjects = engine.getAllObjects();
    const allEngineIds = new Set(allEngineObjects.map(o => o.id));

    const removedIds: string[] = [];
    for (const prevId of previousObjectIds) {
        if (!allEngineIds.has(prevId)) {
            removedIds.push(prevId);
        }
    }

    const addedObjects: CosmicObject[] = [];
    for (const obj of allEngineObjects) {
        if (!previousObjectIds.has(obj.id)) {
            // New object (debris from collision)
            addedObjects.push(obj);
        }
    }

    previousObjectIds = allEngineIds;

    // Send physics update
    const message: any = {
        type: 'physicsUpdate',
        ids,
        buffer,
        stats: engine.getStats(),
        effectiveDt,
    };

    // If collisions happened, include collision data
    if (removedIds.length > 0 || addedObjects.length > 0) {
        // Serialize added objects (convert Vector3 to plain for transfer)
        const serializedAdded = addedObjects.map(obj => ({
            ...obj,
            state: {
                ...obj.state,
                position: { x: obj.state.position.x, y: obj.state.position.y, z: obj.state.position.z },
                velocity: { x: obj.state.velocity.x, y: obj.state.velocity.y, z: obj.state.velocity.z },
                acceleration: { x: obj.state.acceleration.x, y: obj.state.acceleration.y, z: obj.state.acceleration.z },
                angularVelocity: { x: obj.state.angularVelocity.x, y: obj.state.angularVelocity.y, z: obj.state.angularVelocity.z },
            }
        }));

        message.collisionUpdate = {
            removed: removedIds,
            added: serializedAdded,
        };

        if (DEBUG) console.log(`[Worker] Collision: removed=${removedIds.length}, added=${addedObjects.length}`);
    }

    (self as any).postMessage(message, [buffer.buffer]);

    // Schedule next
    if (running) {
        setTimeout(step, INTERVAL);
    }
}

// Message Handler
self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (DEBUG) console.log(`[Worker] Received message: ${type}`, payload ? '(with payload)' : '');

    switch (type) {
        case 'init':
            init();
            self.postMessage({ type: 'ready' });
            break;

        case 'start':
            if (!engine) init();
            running = true;
            lastTime = performance.now();
            if (DEBUG) console.log('[Worker] Physics simulation started');
            step();
            break;

        case 'stop':
            running = false;
            break;

        case 'addObject':
            if (engine && payload) {
                const obj = reconstructVectors(payload as CosmicObject);
                engine.addObject(obj);
                previousObjectIds.add(obj.id);
                if (DEBUG) console.log(`[Worker] Added object: ${obj.metadata.name}`);
            }
            break;

        case 'removeObject':
            if (engine && payload) {
                engine.removeObject(payload as string);
                previousObjectIds.delete(payload as string);
            }
            break;

        case 'updateConfig':
            if (engine && payload) {
                engine.updateConfig(payload);
            }
            break;

        case 'setTimeScale':
            if (typeof payload === 'number') {
                timeScale = payload;
                if (DEBUG) console.log(`[Worker] TimeScale set to ${timeScale}`);
            }
            break;

        case 'singleStep':
            if (engine) {
                const baseDt = engine.getConfig().dt;
                const singleStepDt = baseDt * timeScale;
                engine.step(singleStepDt);

                const { ids, buffer } = engine.getPhysicsState();
                (self as any).postMessage({
                    type: 'physicsUpdate',
                    ids,
                    buffer,
                    stats: engine.getStats(),
                    effectiveDt: singleStepDt,
                }, [buffer.buffer]);
            }
            break;
    }
};
