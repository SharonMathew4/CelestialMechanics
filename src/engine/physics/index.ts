/**
 * Cosmic Fabric - Physics Module Index
 * 
 * Central export point for all physics-related functionality.
 */

// Core types and constants
export * from './constants';
export * from './types';
export * from './vector';
export * from './config';

// Factory functions
export * from './objectFactory';

// Physics engine
export { NBodyEngine, type PhysicsConfig, DEFAULT_PHYSICS_CONFIG } from './nbody';
