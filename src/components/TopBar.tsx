/**
 * Cosmic Fabric - Top Bar Component
 * 
 * Simplified application header with logo and minimal controls.
 */

import React from 'react';

/**
 * Top bar component - Simplified
 */
export function TopBar() {
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
                <h1 className="topbar__title">CelestialMechanics</h1>
            </div>

            {/* Right controls - Essential only */}
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
