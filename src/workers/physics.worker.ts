import { NBodyEngine } from '../engine/physics/nbody';
import { CosmicObject } from '../engine/physics/types';

// Singleton engine instance in the worker
let engine: NBodyEngine;
let running = false;
const DEBUG = true; // Enable debug logging

// Initialize engine
function init() {
    engine = new NBodyEngine({
        gravityStrength: 50,
        gravityRange: 5,
        dt: 1 / 60,
        enableCollisions: true,
        enableDebugLogging: DEBUG, // Enable physics debug logging
    });
    if (DEBUG) console.log('[Worker] Physics engine initialized');
}

// Main loop configuration
const FPS = 60;
const INTERVAL = 1000 / FPS;
let lastTime = performance.now();

function step() {
    if (!running || !engine) return;

    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    // Run physics step
    // Clamp dt to prevent explosions if lag occurs
    const safeDt = Math.min(dt, 0.1);

    const objectCount = engine.getAllObjects().length;
    if (DEBUG && objectCount > 0) {
        console.log(`[Worker] Step: ${objectCount} objects, dt=${safeDt.toFixed(4)}s`);
    }

    engine.step(safeDt);

    // Get optimized binary state
    const { ids, buffer } = engine.getPhysicsState();

    // Check for collision events (removed objects)
    // We send full objects for adds/removes, but buffer for updates

    // Send update back to main thread
    // Transfer the buffer to avoid copy
    (self as any).postMessage({
        type: 'physicsUpdate',
        ids,
        buffer,
        stats: engine.getStats()
    }, [buffer.buffer]); // Transferable

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
            if (DEBUG) console.log('[Worker] Sent ready signal');
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
            if (DEBUG) console.log('[Worker] Physics simulation stopped');
            break;

        case 'addObject':
            if (engine && payload) {
                engine.addObject(payload as CosmicObject);
                if (DEBUG) console.log(`[Worker] Added object: ${(payload as CosmicObject).metadata.name}`);
            }
            break;

        case 'removeObject':
            if (engine && payload) {
                engine.removeObject(payload as string);
                if (DEBUG) console.log(`[Worker] Removed object: ${payload}`);
            }
            break;

        case 'updateConfig':
            if (engine && payload) {
                engine.updateConfig(payload);
                if (DEBUG) console.log('[Worker] Updated config:', payload);
            }
            break;
    }
};
