/**
 * Mobile Blocker Component
 * 
 * Displays a full-screen overlay on mobile devices preventing access.
 * Recommends users switch to desktop mode or use a PC.
 */

import React from 'react';
import './MobileBlocker.css';

interface MobileBlockerProps {
    deviceType: 'mobile' | 'tablet';
}

const MobileBlocker: React.FC<MobileBlockerProps> = ({ deviceType }) => {
    return (
        <div className="mobile-blocker">
            <div className="mobile-blocker__content">
                {/* Desktop Icon */}
                <svg
                    className="mobile-blocker__icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                </svg>

                <h1 className="mobile-blocker__title">Desktop Required</h1>

                <p className="mobile-blocker__message">
                    <strong>CelestialMechanics</strong> is a high-performance cosmic simulation platform
                    designed for desktop environments with dedicated GPUs.
                </p>

                {deviceType === 'mobile' && (
                    <div className="mobile-blocker__suggestion">
                        <p>Please access this application from:</p>
                        <ul>
                            <li>A desktop or laptop computer</li>
                            <li>Switch to <strong>Desktop Mode</strong> in your browser (if supported)</li>
                        </ul>
                    </div>
                )}

                {deviceType === 'tablet' && (
                    <div className="mobile-blocker__suggestion">
                        <p>Tablets are not officially supported, but you can try:</p>
                        <ul>
                            <li>Rotating to landscape mode</li>
                            <li>Requesting desktop site in browser settings</li>
                            <li>Using an external keyboard and mouse</li>
                        </ul>
                        <p className="mobile-blocker__warning">
                            <strong>Warning:</strong> Performance may be limited.
                        </p>
                    </div>
                )}

                <div className="mobile-blocker__footer">
                    <p>System Requirements:</p>
                    <ul>
                        <li>Windows/macOS/Linux Desktop</li>
                        <li>Dedicated GPU (NVIDIA RTX/GTX or AMD Radeon)</li>
                        <li>Minimum 1920×1080 resolution</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default MobileBlocker;
