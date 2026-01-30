/**
 * Cosmic Fabric - Bottom Panel Component
 * 
 * Timeline controls and simulation time management.
 */

import React from 'react';
import { useSimulationStore, useTimeState } from '@/store';

/**
 * Play/Pause button
 */
function PlayPauseButton() {
    const isPaused = useTimeState().isPaused;
    const togglePause = useSimulationStore((s) => s.togglePause);

    return (
        <button
            className="btn btn--primary btn--icon"
            onClick={togglePause}
            title={isPaused ? 'Play (Space)' : 'Pause (Space)'}
        >
            {isPaused ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
            ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                </svg>
            )}
        </button>
    );
}

/**
 * Time scale controls
 */
function TimeScaleControls() {
    const timeScale = useTimeState().timeScale;
    const setTimeScale = useSimulationStore((s) => s.setTimeScale);

    const presets = [0.1, 0.5, 1, 10, 100, 1000, 10000];

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <span className="text-secondary" style={{ fontSize: 'var(--font-size-xs)' }}>Speed:</span>
            <div className="btn-group">
                {presets.map((preset) => (
                    <button
                        key={preset}
                        className={`btn btn--ghost ${timeScale === preset ? 'btn--primary' : ''}`}
                        onClick={() => setTimeScale(preset)}
                        style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)' }}
                    >
                        {preset < 1 ? `${preset}x` : preset >= 1000 ? `${preset / 1000}k` : `${preset}x`}
                    </button>
                ))}
            </div>
        </div>
    );
}

/**
 * Time display
 */
function TimeDisplay() {
    const timeState = useTimeState();

    const formatDetailedTime = (seconds: number): { value: string; unit: string } => {
        if (seconds < 60) return { value: seconds.toFixed(1), unit: 'seconds' };
        if (seconds < 3600) return { value: (seconds / 60).toFixed(1), unit: 'minutes' };
        if (seconds < 86400) return { value: (seconds / 3600).toFixed(2), unit: 'hours' };
        if (seconds < 31536000) return { value: (seconds / 86400).toFixed(2), unit: 'days' };
        if (seconds < 31536000 * 1000) return { value: (seconds / 31536000).toFixed(2), unit: 'years' };
        if (seconds < 31536000 * 1e6) return { value: (seconds / 31536000 / 1000).toFixed(2), unit: 'kyr' };
        return { value: (seconds / 31536000 / 1e6).toFixed(2), unit: 'Myr' };
    };

    const time = formatDetailedTime(timeState.simulationTime);

    return (
        <div className="time-display">
            <span className="text-secondary" style={{ fontSize: 'var(--font-size-xs)' }}>T:</span>
            <span className="time-display__value">{time.value}</span>
            <span className="time-display__unit">{time.unit}</span>
        </div>
    );
}

/**
 * Reset button
 */
function ResetButton() {
    const clearObjects = useSimulationStore((s) => s.clearObjects);
    const resetTime = useSimulationStore((s) => s.resetTime);
    const pause = useSimulationStore((s) => s.pause);

    const handleReset = () => {
        if (window.confirm('Reset simulation? This will clear all objects.')) {
            pause();
            clearObjects();
            resetTime();
        }
    };

    return (
        <button
            className="btn btn--ghost"
            onClick={handleReset}
            title="Reset Simulation"
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Reset
        </button>
    );
}

/**
 * Step forward button (manual stepping when paused)
 */
function StepButton() {
    const isPaused = useTimeState().isPaused;
    const step = useSimulationStore((s) => s.step);
    const physicsConfig = useSimulationStore((s) => s.physicsConfig);

    const handleStep = () => {
        step(physicsConfig.dt);
    };

    return (
        <button
            className="btn btn--ghost btn--icon"
            onClick={handleStep}
            disabled={!isPaused}
            title="Step Forward"
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 4 15 12 5 20 5 4" />
                <rect x="17" y="4" width="2" height="16" />
            </svg>
        </button>
    );
}

/**
 * Bottom panel component
 */
export function BottomPanel() {
    return (
        <footer className="panel panel-bottom">
            <div className="timeline">
                {/* Controls row */}
                <div className="timeline__controls">
                    <PlayPauseButton />
                    <StepButton />
                    <TimeDisplay />

                    <div style={{ flex: 1 }} />

                    <TimeScaleControls />

                    <div style={{ flex: 1 }} />

                    <ResetButton />
                </div>

                {/* Info row */}
                <div className="timeline__info">
                    <span>Press Space to play/pause</span>
                    <span>Use mouse wheel to zoom, drag to rotate</span>
                </div>
            </div>
        </footer>
    );
}

export default BottomPanel;
