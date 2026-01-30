/**
 * Cosmic Fabric - Main Application Component
 * 
 * Root component that assembles the full application layout.
 */

import React, { useEffect, useState } from 'react';
import { Scene, TopBar, LeftPanel, RightPanel, BottomPanel } from '@/components';
import { useSimulationStore, usePanels } from '@/store';
import MobileBlocker from '@/components/ui/MobileBlocker';
import { shouldBlockAccess, getDeviceType } from '@/utils/deviceDetection';

/**
 * Keyboard shortcut handler
 */
function useKeyboardShortcuts() {
    const togglePause = useSimulationStore((s) => s.togglePause);
    const setTimeScale = useSimulationStore((s) => s.setTimeScale);
    const timeScale = useSimulationStore((s) => s.time.timeScale);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    togglePause();
                    break;
                case 'BracketRight':
                    // Speed up
                    setTimeScale(Math.min(timeScale * 2, 100000));
                    break;
                case 'BracketLeft':
                    // Slow down
                    setTimeScale(Math.max(timeScale / 2, 0.01));
                    break;
                case 'Backquote':
                    // Reset speed
                    setTimeScale(1);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePause, setTimeScale, timeScale]);
}

/**
 * Main application component
 */
export function App() {
    const panels = usePanels();
    const [isBlocked, setIsBlocked] = useState(false);
    const [deviceType, setDeviceType] = useState<'mobile' | 'tablet'>('mobile');

    // Check for mobile device on mount
    useEffect(() => {
        const blocked = shouldBlockAccess();
        setIsBlocked(blocked);
        if (blocked) {
            setDeviceType(getDeviceType() === 'tablet' ? 'tablet' : 'mobile');
        }
    }, []);

    // Set up keyboard shortcuts
    useKeyboardShortcuts();

    // If mobile device, show blocker
    if (isBlocked) {
        return <MobileBlocker deviceType={deviceType} />;
    }

    // Build layout class based on panel visibility
    const layoutClasses = [
        'app-layout',
        !panels.left && 'app-layout--left-closed',
        !panels.right && 'app-layout--right-closed',
        !panels.bottom && 'app-layout--bottom-closed',
    ].filter(Boolean).join(' ');

    return (
        <div className={layoutClasses}>
            <TopBar />

            {panels.left && <LeftPanel />}

            <main className="canvas-container">
                <Scene />
            </main>

            {panels.right && <RightPanel />}

            {panels.bottom && <BottomPanel />}
        </div>
    );
}

export default App;
