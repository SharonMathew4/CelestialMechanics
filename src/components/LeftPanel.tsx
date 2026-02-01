/**
 * New Left Panel - 3-Section Accordion Design
 * Sections: Add Objects | Edit | Properties
 */

import { useState, useEffect } from 'react';
import { useSimulationStore, useSelectionState } from '@/store';
import { usePlacementStore } from '@/store/placementStore';
import { useUIStore } from '@/store/uiStore';
import { getObjectsByCategory, ObjectTemplate } from '@/data/objectLibrary';
import './LeftPanel.css';

/**
 * Collapsible Section Component
 */
interface SectionProps {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function CollapsibleSection({ title, isOpen, onToggle, children }: SectionProps) {
    return (
        <div className="panel-section panel-section--collapsible">
            <button
                className={`panel-section__header ${isOpen ? 'panel-section__header--open' : ''}`}
                onClick={onToggle}
            >
                <span className="panel-section__title">{title}</span>
                <span className="panel-section__icon">{isOpen ? '▼' : '▶'}</span>
            </button>
            {isOpen && (
                <div className="panel-section__content">
                    {children}
                </div>
            )}
        </div>
    );
}

/**
 * Object Template Button
 */
interface ObjectButtonProps {
    template: ObjectTemplate;
    onClick: () => void;
    isActive: boolean;
}

function ObjectButton({ template, isActive, onClick }: ObjectButtonProps) {
    return (
        <button
            className={`object-btn ${isActive ? 'object-btn--active' : ''}`}
            onClick={onClick}
            style={{
                borderLeftColor: template.color,
                backgroundColor: isActive ? 'rgba(74, 158, 255, 0.15)' : undefined,
            }}
        >
            <span className="object-btn__icon">{template.icon}</span>
            <span className="object-btn__name">{template.name}</span>
        </button>
    );
}

/**
 * ADD OBJECTS SECTION
 */
function AddObjectsSection({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
    const [activeCategory, setActiveCategory] = useState<'celestial' | 'structure'>('celestial');
    const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>(['Stars - Main Sequence']);

    const startPlacement = usePlacementStore((s) => s.startPlacement);
    const { isPlacing, objectType } = usePlacementStore();

    const celestialGroups = getObjectsByCategory('celestial');
    const structureGroups = getObjectsByCategory('structure');

    const currentGroups = activeCategory === 'celestial' ? celestialGroups : structureGroups;

    const toggleSubcategory = (subcategory: string) => {
        setExpandedSubcategories(prev =>
            prev.includes(subcategory)
                ? prev.filter(s => s !== subcategory)
                : [...prev, subcategory]
        );
    };

    return (
        <CollapsibleSection title="Add Objects" isOpen={isOpen} onToggle={onToggle}>
            {/* Category Tabs */}
            <div className="category-tabs">
                <button
                    className={`category-tab ${activeCategory === 'celestial' ? 'category-tab--active' : ''}`}
                    onClick={() => setActiveCategory('celestial')}
                >
                    ⭐ Celestial Objects
                </button>
                <button
                    className={`category-tab ${activeCategory === 'structure' ? 'category-tab--active' : ''}`}
                    onClick={() => setActiveCategory('structure')}
                >
                    🌌 Structures
                </button>
            </div>

            {/* Object Library */}
            <div className="object-library">
                {Object.entries(currentGroups).map(([subcategory, templates]) => (
                    <div key={subcategory} className="object-group">
                        <button
                            className="object-group__header"
                            onClick={() => toggleSubcategory(subcategory)}
                        >
                            <span>{subcategory}</span>
                            <span>{expandedSubcategories.includes(subcategory) ? '▼' : '▶'}</span>
                        </button>
                        {expandedSubcategories.includes(subcategory) && (
                            <div className="object-group__items">
                                {templates.map(template => (
                                    <ObjectButton
                                        key={template.id}
                                        template={template}
                                        isActive={isPlacing && objectType === template.defaultProperties.type}
                                        onClick={() => startPlacement(
                                            template.defaultProperties.type,
                                            template.defaultProperties.config
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Placement Instructions */}
            {isPlacing && (
                <div className="placement-hint">
                    <strong>Placement Mode Active</strong>
                    <p>Click to position → Drag for velocity → Click to confirm</p>
                </div>
            )}
        </CollapsibleSection>
    );
}

/**
 * EDIT SECTION
 */
function EditSection({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
    const selection = useSelectionState();
    const objects = useSimulationStore((s) => s.objects);
    const updateObject = useSimulationStore((s) => s.updateObject);

    const selectedId = selection.selectedIds[0];
    const obj = selectedId ? objects.get(selectedId) : null;

    if (!obj) {
        return (
            <CollapsibleSection title="Edit" isOpen={isOpen} onToggle={onToggle}>
                <p className="text-muted">Select an object to edit its properties</p>
            </CollapsibleSection>
        );
    }

    // Simplified property editor - can be expanded
    return (
        <CollapsibleSection title="Edit" isOpen={isOpen} onToggle={onToggle}>
            <div className="property-editor">
                <div className="property-row">
                    <label>Name</label>
                    <input type="text" value={obj.metadata.name} readOnly />
                </div>
                <div className="property-row">
                    <label>Type</label>
                    <input type="text" value={obj.type} readOnly />
                </div>
                <div className="property-row">
                    <label>Mass (kg)</label>
                    <input type="number" value={obj.properties.mass} readOnly />
                </div>
                <div className="property-row">
                    <label>Radius (m)</label>
                    <input type="number" value={obj.properties.radius} readOnly />
                </div>
                <p className="text-muted" style={{ marginTop: '1rem', fontSize: '0.75rem' }}>
                    Full editing capabilities coming soon
                </p>
            </div>
        </CollapsibleSection>
    );
}

/**
 * PROPERTIES SECTION
 */
function PropertiesSection({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
    const toggleRightPanel = useUIStore((s) => s.togglePanel);

    const handleClick = () => {
        onToggle();
        // Also toggle right panel to show universe stats
        toggleRightPanel('right');
    };

    return (
        <CollapsibleSection title="Properties" isOpen={isOpen} onToggle={handleClick}>
            <p className="text-muted">
                Universe statistics are displayed in the right panel when this section is open.
            </p>
        </CollapsibleSection>
    );
}

/**
 * MAIN LEFT PANEL
 */
export function LeftPanel() {
    const [openSection, setOpenSection] = useState<'add' | 'edit' | 'properties' | null>('add');
    const cancelPlacement = usePlacementStore((s) => s.cancelPlacement);
    const isPlacing = usePlacementStore((s) => s.isPlacing);

    // Cancel placement on ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isPlacing) {
                cancelPlacement();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlacing, cancelPlacement]);

    return (
        <aside className="panel panel-left">
            <div className="panel__header">
                <h2 className="panel__title">Controls</h2>
            </div>

            <div className="panel__content">
                <AddObjectsSection
                    isOpen={openSection === 'add'}
                    onToggle={() => setOpenSection(openSection === 'add' ? null : 'add')}
                />

                <EditSection
                    isOpen={openSection === 'edit'}
                    onToggle={() => setOpenSection(openSection === 'edit' ? null : 'edit')}
                />

                <PropertiesSection
                    isOpen={openSection === 'properties'}
                    onToggle={() => setOpenSection(openSection === 'properties' ? null : 'properties')}
                />
            </div>
        </aside>
    );
}

export default LeftPanel;
