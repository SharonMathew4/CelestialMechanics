/**
 * Cosmic Fabric - Top Bar Component
 * 
 * Application header with mode toggle and global controls.
 */

import React from 'react';
import { useSimulationStore, useAppMode } from '@/store';
import { AppMode } from '@/store/simulationStore';

/**
 * Mode toggle button
 */
interface ModeButtonProps {
    mode: AppMode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

function ModeButton({ mode, label, isActive, onClick }: ModeButtonProps) {
    return (
        <button
            className={`mode-toggle__btn ${isActive ? 'mode-toggle__btn--active' : ''}`}
            onClick={onClick}
            aria-pressed={isActive}
        >
            {label}
        </button>
    );
}

/**
 * Top bar component
 */
export function TopBar() {
    const mode = useAppMode();
    const setMode = useSimulationStore((s) => s.setMode);

    return (
        <header className="topbar">
            {/* Logo and title */}
            <div className="topbar__logo">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#4a9eff" strokeWidth="2" />
                    <circle cx="12" cy="12" r="4" fill="#4a9eff" />
                    <circle cx="12" cy="4" r="2" fill="#7c5cff" />
                    <circle cx="20" cy="12" r="1.5" fill="#34d399" />
                </svg>
                <h1 className="topbar__title">StellarForge-Enhanced</h1>
            </div>

            {/* Mode switch */}
            <div className="mode-toggle">
                <ModeButton
                    mode="observation"
                    label="Observation"
                    isActive={mode === 'observation'}
                    onClick={() => setMode('observation')}
                />
                <ModeButton
                    mode="simulation"
                    label="Simulation"
                    isActive={mode === 'simulation'}
                    onClick={() => setMode('simulation')}
                />
            </div>

            {/* Right controls */}
            <div className="topbar__controls">
                <button className="btn btn--ghost btn--icon" title="Settings">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                </button>
                <button className="btn btn--ghost btn--icon" title="Help">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </button>
            </div>
        </header>
    );
}

export default TopBar;
