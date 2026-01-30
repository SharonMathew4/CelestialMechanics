/**
 * Cosmic Fabric - Right Panel Component
 * 
 * Data readouts, logs, and scientific overlays.
 */

import React from 'react';
import { useSimulationStore, usePerformance, useTimeState, useUIStore, useOverlays } from '@/store';

/**
 * Simulation statistics section
 */
function SimulationStats() {
    const performance = usePerformance();
    const timeState = useTimeState();
    const objects = useSimulationStore((s) => s.objects);

    const formatTime = (seconds: number): string => {
        if (seconds < 60) return `${seconds.toFixed(1)} s`;
        if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
        if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} hrs`;
        if (seconds < 31536000) return `${(seconds / 86400).toFixed(1)} days`;
        return `${(seconds / 31536000).toFixed(2)} yrs`;
    };

    return (
        <div className="panel-section">
            <div className="panel-section__title">Simulation</div>

            <div className="data-readout">
                <div className="data-row">
                    <span className="data-row__label">Status</span>
                    <span className="data-row__value" style={{ color: timeState.isPaused ? 'var(--color-accent-warning)' : 'var(--color-accent-success)' }}>
                        {timeState.isPaused ? 'Paused' : 'Running'}
                    </span>
                </div>
                <div className="data-row">
                    <span className="data-row__label">Sim Time</span>
                    <span className="data-row__value">{formatTime(timeState.simulationTime)}</span>
                </div>
                <div className="data-row">
                    <span className="data-row__label">Time Scale</span>
                    <span className="data-row__value">{timeState.timeScale}x</span>
                </div>
                <div className="data-row">
                    <span className="data-row__label">Objects</span>
                    <span className="data-row__value">{objects.size}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Performance statistics section
 */
function PerformanceStats() {
    const performance = usePerformance();

    const fpsColor = performance.fps >= 50 ? 'var(--color-accent-success)' :
        performance.fps >= 30 ? 'var(--color-accent-warning)' :
            'var(--color-accent-danger)';

    return (
        <div className="panel-section">
            <div className="panel-section__title">Performance</div>

            <div className="data-readout">
                <div className="data-row">
                    <span className="data-row__label">FPS</span>
                    <span className="data-row__value" style={{ color: fpsColor }}>
                        {performance.fps.toFixed(0)}
                    </span>
                </div>
                <div className="data-row">
                    <span className="data-row__label">Physics</span>
                    <span className="data-row__value">
                        {performance.physicsTime.toFixed(2)}
                        <span className="data-row__unit">ms</span>
                    </span>
                </div>
                <div className="data-row">
                    <span className="data-row__label">Render</span>
                    <span className="data-row__value">
                        {performance.renderTime.toFixed(2)}
                        <span className="data-row__unit">ms</span>
                    </span>
                </div>
                <div className="data-row">
                    <span className="data-row__label">Force Calc</span>
                    <span className="data-row__value">{performance.forceCalculations}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Physics controls section
 */
function PhysicsControls() {
    const physicsConfig = useSimulationStore((s) => s.physicsConfig);
    const updatePhysicsConfig = useSimulationStore((s) => s.updatePhysicsConfig);

    return (
        <div className="panel-section">
            <div className="panel-section__title">Physics Settings</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                {/* Gravity Strength (0-100 scale) */}
                <div className="control-group">
                    <label className="control-group__label">
                        Gravity Strength: {physicsConfig.gravityStrength}
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={physicsConfig.gravityStrength}
                        onChange={(e) => updatePhysicsConfig({
                            gravityStrength: parseInt(e.target.value)
                        })}
                        className="slider"
                    />
                </div>

                {/* Timestep */}
                <div className="control-group">
                    <label className="control-group__label">
                        Timestep: {(physicsConfig.dt / 3600).toFixed(1)} hrs
                    </label>
                    <input
                        type="range"
                        min="60"
                        max="86400"
                        step="60"
                        value={physicsConfig.dt}
                        onChange={(e) => updatePhysicsConfig({
                            dt: parseFloat(e.target.value)
                        })}
                        className="slider"
                    />
                </div>

                {/* Velocity Damping */}
                <div className="control-group">
                    <label className="control-group__label">
                        Velocity Damping: {((1 - physicsConfig.velocityDamping) * 1000).toFixed(1)}‰
                    </label>
                    <input
                        type="range"
                        min="0.99"
                        max="1"
                        step="0.001"
                        value={physicsConfig.velocityDamping}
                        onChange={(e) => updatePhysicsConfig({
                            velocityDamping: parseFloat(e.target.value)
                        })}
                        className="slider"
                    />
                </div>

                {/* Toggles */}
                <label className="checkbox">
                    <input
                        type="checkbox"
                        className="checkbox__input"
                        checked={physicsConfig.enableCollisions}
                        onChange={(e) => updatePhysicsConfig({
                            enableCollisions: e.target.checked
                        })}
                    />
                    <span className="checkbox__label">Enable Collisions</span>
                </label>

                <label className="checkbox">
                    <input
                        type="checkbox"
                        className="checkbox__input"
                        checked={physicsConfig.enableDebugLogging}
                        onChange={(e) => updatePhysicsConfig({
                            enableDebugLogging: e.target.checked
                        })}
                    />
                    <span className="checkbox__label">Debug Logging (Console)</span>
                </label>
            </div>
        </div>
    );
}

/**
 * Scientific overlays toggle section
 */
function OverlayToggles() {
    const overlays = useOverlays();
    const toggleOverlay = useUIStore((s) => s.toggleOverlay);

    const overlayOptions: { key: keyof typeof overlays; label: string }[] = [
        { key: 'objectLabels', label: 'Object Labels' },
        { key: 'distanceScale', label: 'Distance Scale' },
        { key: 'velocityVectors', label: 'Velocity Vectors' },
        { key: 'orbitalPaths', label: 'Orbital Paths' },
        { key: 'gravitationalFields', label: 'Gravity Fields' },
        { key: 'grid', label: 'Grid' },
        { key: 'axes', label: 'Axes' },
    ];

    return (
        <div className="panel-section">
            <div className="panel-section__title">Overlays</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                {overlayOptions.map(({ key, label }) => (
                    <label key={key} className="checkbox">
                        <input
                            type="checkbox"
                            className="checkbox__input"
                            checked={overlays[key]}
                            onChange={() => toggleOverlay(key)}
                        />
                        <span className="checkbox__label">{label}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}

/**
 * Energy readout section
 */
function EnergyReadout() {
    const stats = usePerformance();

    // Energy is now calculated in the worker and synced via stats
    const totalEnergy = stats.totalEnergy;
    const kineticEnergy = 0; // Breakdown not currently synced, using total
    const potentialEnergy = 0;

    const formatEnergy = (energy: number): string => {
        const absEnergy = Math.abs(energy);
        if (absEnergy === 0) return '0';
        if (absEnergy < 1e3) return energy.toFixed(2);
        return energy.toExponential(2);
    };

    return (
        <div className="panel-section">
            <div className="panel-section__title">Energy</div>

            <div className="data-readout">
                <div className="data-row">
                    <span className="data-row__label">Kinetic</span>
                    <span className="data-row__value">
                        {formatEnergy(kineticEnergy)}
                        <span className="data-row__unit">J</span>
                    </span>
                </div>
                <div className="data-row">
                    <span className="data-row__label">Potential</span>
                    <span className="data-row__value">
                        {formatEnergy(potentialEnergy)}
                        <span className="data-row__unit">J</span>
                    </span>
                </div>
                <div className="data-row">
                    <span className="data-row__label">Total</span>
                    <span className="data-row__value" style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                        {formatEnergy(totalEnergy)}
                        <span className="data-row__unit">J</span>
                    </span>
                </div>
            </div>
        </div>
    );
}

/**
 * Right panel component
 */
export function RightPanel() {
    return (
        <aside className="panel panel-right">
            <div className="panel__header">
                <h2 className="panel__title">Data</h2>
            </div>

            <div className="panel__content">
                <SimulationStats />
                <PhysicsControls />
                <PerformanceStats />
                <EnergyReadout />
                <OverlayToggles />
            </div>
        </aside>
    );
}

export default RightPanel;
