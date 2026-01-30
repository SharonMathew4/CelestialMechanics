/**
 * Cosmic Fabric - Left Panel Component
 * 
 * Object spawning tools with PLACEMENT MODE.
 * Objects are NOT created on click - they enter placement mode first.
 */

import { useEffect } from 'react';
import { useSimulationStore, useAppMode, useSelectionState } from '@/store';
import { usePlacementStore } from '@/store/placementStore';
import { CosmicObjectType, SpectralClass } from '@/engine/physics/types';

/**
 * Object type button - starts placement mode
 */
interface PlacementButtonProps {
    label: string;
    color: string;
    objectType: CosmicObjectType;
    config?: Record<string, unknown>;
    disabled?: boolean;
}

function PlacementButton({ label, color, objectType, config, disabled }: PlacementButtonProps) {
    const startPlacement = usePlacementStore((s) => s.startPlacement);
    const isPlacing = usePlacementStore((s) => s.isPlacing);
    const currentType = usePlacementStore((s) => s.objectType);

    const isActive = isPlacing && currentType === objectType;

    return (
        <button
            className={`btn ${isActive ? 'btn--active' : ''}`}
            onClick={() => startPlacement(objectType, config)}
            disabled={disabled || (isPlacing && !isActive)}
            style={{
                '--btn-accent': color,
                borderLeftColor: color,
                borderLeftWidth: '3px',
                backgroundColor: isActive ? 'rgba(74, 158, 255, 0.2)' : undefined,
            } as React.CSSProperties}
        >
            {isActive ? `Placing ${label}...` : label}
        </button>
    );
}

/**
 * Property editor for selected object
 */
function PropertyEditor() {
    const selection = useSelectionState();
    const objects = useSimulationStore((s) => s.objects);

    if (selection.selectedIds.length === 0) {
        return (
            <div className="panel-section">
                <p className="text-secondary" style={{ fontSize: 'var(--font-size-xs)' }}>
                    Select an object to view its properties.
                </p>
            </div>
        );
    }

    const selectedId = selection.selectedIds[0];
    const obj = objects.get(selectedId);

    if (!obj) return null;

    const formatScientific = (value: number) => {
        if (Math.abs(value) < 0.001 || Math.abs(value) > 1e6) {
            return value.toExponential(2);
        }
        return value.toFixed(2);
    };

    return (
        <div className="panel-section">
            <div className="panel-section__title">Selected Object</div>

            <div className="data-readout">
                <div className="data-row">
                    <span className="data-row__label">Name</span>
                    <span className="data-row__value">{obj.metadata.name}</span>
                </div>
                <div className="data-row">
                    <span className="data-row__label">Type</span>
                    <span className="data-row__value">{obj.type}</span>
                </div>
                <div className="data-row">
                    <span className="data-row__label">Mass</span>
                    <span className="data-row__value">
                        {formatScientific(obj.properties.mass)}
                        <span className="data-row__unit">kg</span>
                    </span>
                </div>
                <div className="data-row">
                    <span className="data-row__label">Radius</span>
                    <span className="data-row__value">
                        {formatScientific(obj.properties.radius)}
                        <span className="data-row__unit">m</span>
                    </span>
                </div>
                <div className="data-row">
                    <span className="data-row__label">Velocity</span>
                    <span className="data-row__value">
                        {formatScientific(obj.state.velocity.magnitude())}
                        <span className="data-row__unit">m/s</span>
                    </span>
                </div>
            </div>
        </div>
    );
}

/**
 * Placement instructions
 */
function PlacementInstructions() {
    const isPlacing = usePlacementStore((s) => s.isPlacing);
    const objectType = usePlacementStore((s) => s.objectType);
    const cancelPlacement = usePlacementStore((s) => s.cancelPlacement);

    if (!isPlacing) return null;

    return (
        <div className="panel-section" style={{
            backgroundColor: 'rgba(74, 158, 255, 0.1)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-3)'
        }}>
            <div className="panel-section__title" style={{ color: 'var(--color-accent-primary)' }}>
                Placement Mode
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-2)' }}>
                Placing: <strong>{objectType}</strong>
            </p>
            <ul style={{ fontSize: 'var(--font-size-xs)', paddingLeft: 'var(--spacing-4)', marginBottom: 'var(--spacing-3)' }}>
                <li><strong>Click</strong> to set position</li>
                <li><strong>Drag</strong> to set velocity direction</li>
                <li><strong>Click again</strong> to confirm</li>
                <li><strong>ESC</strong> or right-click to cancel</li>
            </ul>
            <button className="btn btn--ghost" onClick={cancelPlacement} style={{ width: '100%' }}>
                Cancel Placement
            </button>
        </div>
    );
}

/**
 * Grid snapping controls
 */
function GridControls() {
    const gridSnappingEnabled = usePlacementStore((s) => s.gridSnappingEnabled);
    const gridSnapSize = usePlacementStore((s) => s.gridSnapSize);
    const setGridSnapping = usePlacementStore((s) => s.setGridSnapping);
    const setGridSnapSize = usePlacementStore((s) => s.setGridSnapSize);

    return (
        <div className="panel-section">
            <div className="panel-section__title">Grid Settings</div>
            <label className="checkbox">
                <input
                    type="checkbox"
                    className="checkbox__input"
                    checked={gridSnappingEnabled}
                    onChange={(e) => setGridSnapping(e.target.checked)}
                />
                <span className="checkbox__label">Enable Grid Snapping</span>
            </label>
            {gridSnappingEnabled && (
                <div className="control-group" style={{ marginTop: 'var(--spacing-2)' }}>
                    <label className="control-group__label">
                        Grid Size: {gridSnapSize}
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={gridSnapSize}
                        onChange={(e) => setGridSnapSize(parseInt(e.target.value))}
                        className="slider"
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Left panel component
 */
export function LeftPanel() {
    const mode = useAppMode();
    const cancelPlacement = usePlacementStore((s) => s.cancelPlacement);
    const isPlacing = usePlacementStore((s) => s.isPlacing);

    const isSimulationMode = mode === 'simulation';

    // Cancel placement on ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isPlacing) {
                cancelPlacement();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlacing, cancelPlacement]);

    // Cancel placement when switching to observation mode
    useEffect(() => {
        if (!isSimulationMode && isPlacing) {
            cancelPlacement();
        }
    }, [isSimulationMode, isPlacing, cancelPlacement]);

    return (
        <aside className="panel panel-left">
            <div className="panel__header">
                <h2 className="panel__title">Objects</h2>
            </div>

            <div className="panel__content">
                {/* Placement instructions (when active) */}
                <PlacementInstructions />

                {/* Spawn section - only in simulation mode */}
                {isSimulationMode && !isPlacing && (
                    <div className="panel-section">
                        <div className="panel-section__title">Create Objects</div>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-3)' }}>
                            Click a button, then click in scene to position. Drag to set velocity.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                            <PlacementButton
                                label="G-Type Star (Sun-like)"
                                color="#fff4ea"
                                objectType={CosmicObjectType.STAR}
                                config={{ spectralClass: SpectralClass.G }}
                            />
                            <PlacementButton
                                label="O-Type Star (Blue Giant)"
                                color="#9bb0ff"
                                objectType={CosmicObjectType.STAR}
                                config={{ spectralClass: SpectralClass.O }}
                            />
                            <PlacementButton
                                label="M-Type Star (Red Dwarf)"
                                color="#ffcc6f"
                                objectType={CosmicObjectType.STAR}
                                config={{ spectralClass: SpectralClass.M }}
                            />
                            <PlacementButton
                                label="Rocky Planet"
                                color="#8b7355"
                                objectType={CosmicObjectType.PLANET}
                            />
                            <PlacementButton
                                label="Black Hole"
                                color="#7c5cff"
                                objectType={CosmicObjectType.BLACK_HOLE}
                            />
                            <PlacementButton
                                label="Neutron Star"
                                color="#aaccff"
                                objectType={CosmicObjectType.NEUTRON_STAR}
                            />
                        </div>
                    </div>
                )}

                {/* Grid controls */}
                {isSimulationMode && <GridControls />}

                {/* Observation mode message */}
                {!isSimulationMode && (
                    <div className="panel-section">
                        <p className="text-secondary" style={{ fontSize: 'var(--font-size-xs)' }}>
                            <strong>Observation Mode</strong><br />
                            Object creation is disabled. Switch to Simulation Mode to create and modify objects.
                        </p>
                    </div>
                )}

                {/* Property editor */}
                <PropertyEditor />
            </div>
        </aside>
    );
}

export default LeftPanel;
