/**
 * Cosmic Fabric - Observation Mode Data Store
 * 
 * Manages astronomical data for Observation Mode.
 * Data is read-only and sourced from real catalogs.
 * 
 * This mode does NOT run physics simulation.
 */

import { create } from 'zustand';
import { Vector3 } from '@/engine/physics/vector';
import { CosmicObjectType, SpectralClass, GalaxyType } from '@/engine/physics/types';

/**
 * Observational object (read-only, non-simulated)
 */
export interface ObservationalObject {
    /** Unique identifier */
    id: string;

    /** Object name */
    name: string;

    /** Scientific designation (e.g., HD 123456, NGC 1234) */
    designation?: string;

    /** Object type */
    type: CosmicObjectType;

    /** Position in galactic coordinates (converted to simulation space) */
    position: Vector3;

    /** Distance from Earth in parsecs */
    distanceParsecs: number;

    /** Right ascension (degrees) */
    rightAscension: number;

    /** Declination (degrees) */
    declination: number;

    /** Visual magnitude */
    apparentMagnitude?: number;

    /** Absolute magnitude */
    absoluteMagnitude?: number;

    /** Color index (B-V) */
    colorIndex?: number;

    /** Spectral class (for stars) */
    spectralClass?: SpectralClass;

    /** Galaxy type (for galaxies) */
    galaxyType?: GalaxyType;

    /** Estimated mass in solar masses */
    massSolar?: number;

    /** Estimated radius in solar radii */
    radiusSolar?: number;

    /** Data source catalog */
    catalog: string;

    /** Catalog ID */
    catalogId: string;

    /** Additional notes or description */
    description?: string;
}

/**
 * Observation mode state
 */
export interface ObservationState {
    /** All loaded observational objects */
    objects: Map<string, ObservationalObject>;

    /** Currently selected object ID */
    selectedId: string | null;

    /** Current view center position */
    viewCenter: Vector3;

    /** Current view scale (parsecs per unit) */
    viewScale: number;

    /** Visible distance range [min, max] in parsecs */
    visibleRange: [number, number];

    /** Filter by object types */
    typeFilters: Set<CosmicObjectType>;

    /** Search query */
    searchQuery: string;

    /** Loading state */
    isLoading: boolean;

    /** Error message if any */
    error: string | null;

    // Actions
    setObjects: (objects: ObservationalObject[]) => void;
    selectObject: (id: string | null) => void;
    setViewCenter: (center: Vector3) => void;
    setViewScale: (scale: number) => void;
    setVisibleRange: (min: number, max: number) => void;
    toggleTypeFilter: (type: CosmicObjectType) => void;
    setSearchQuery: (query: string) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    // Computed
    getFilteredObjects: () => ObservationalObject[];
    getObjectById: (id: string) => ObservationalObject | undefined;
}

/**
 * Default visible types
 */
const DEFAULT_TYPE_FILTERS = new Set<CosmicObjectType>([
    CosmicObjectType.STAR,
    CosmicObjectType.GALAXY,
    CosmicObjectType.NEBULA,
    CosmicObjectType.BLACK_HOLE,
]);

/**
 * Observation store
 */
export const useObservationStore = create<ObservationState>()((set, get) => ({
    // Initial state
    objects: new Map(),
    selectedId: null,
    viewCenter: Vector3.zero(),
    viewScale: 1,  // 1 parsec per unit
    visibleRange: [0, 1000],  // 0 to 1000 parsecs
    typeFilters: DEFAULT_TYPE_FILTERS,
    searchQuery: '',
    isLoading: false,
    error: null,

    // Set objects from loaded data
    setObjects: (objects) => {
        const map = new Map<string, ObservationalObject>();
        for (const obj of objects) {
            map.set(obj.id, obj);
        }
        set({ objects: map, error: null });
    },

    // Select object
    selectObject: (id) => set({ selectedId: id }),

    // View controls
    setViewCenter: (center) => set({ viewCenter: center }),
    setViewScale: (scale) => set({ viewScale: Math.max(0.001, scale) }),
    setVisibleRange: (min, max) => set({ visibleRange: [min, max] }),

    // Filters
    toggleTypeFilter: (type) => set((state) => {
        const newFilters = new Set(state.typeFilters);
        if (newFilters.has(type)) {
            newFilters.delete(type);
        } else {
            newFilters.add(type);
        }
        return { typeFilters: newFilters };
    }),

    setSearchQuery: (query) => set({ searchQuery: query }),

    // Loading state
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),

    // Get filtered objects
    getFilteredObjects: () => {
        const state = get();
        const results: ObservationalObject[] = [];

        for (const obj of state.objects.values()) {
            // Type filter
            if (!state.typeFilters.has(obj.type)) continue;

            // Distance filter
            if (obj.distanceParsecs < state.visibleRange[0] ||
                obj.distanceParsecs > state.visibleRange[1]) continue;

            // Search filter
            if (state.searchQuery) {
                const query = state.searchQuery.toLowerCase();
                const matchesName = obj.name.toLowerCase().includes(query);
                const matchesDesignation = obj.designation?.toLowerCase().includes(query);
                const matchesCatalogId = obj.catalogId.toLowerCase().includes(query);
                if (!matchesName && !matchesDesignation && !matchesCatalogId) continue;
            }

            results.push(obj);
        }

        return results;
    },

    // Get object by ID
    getObjectById: (id) => get().objects.get(id),
}));

/**
 * Convert equatorial coordinates to Cartesian position
 * RA/Dec in degrees, distance in parsecs
 */
export function equatorialToCartesian(
    rightAscension: number,
    declination: number,
    distanceParsecs: number
): Vector3 {
    const raRad = (rightAscension * Math.PI) / 180;
    const decRad = (declination * Math.PI) / 180;

    const x = distanceParsecs * Math.cos(decRad) * Math.cos(raRad);
    const y = distanceParsecs * Math.cos(decRad) * Math.sin(raRad);
    const z = distanceParsecs * Math.sin(decRad);

    return new Vector3(x, y, z);
}

/**
 * Sample data - nearby stars (will be replaced with catalog data)
 */
export const SAMPLE_NEARBY_STARS: ObservationalObject[] = [
    {
        id: 'sun',
        name: 'Sun',
        designation: 'Sol',
        type: CosmicObjectType.STAR,
        position: Vector3.zero(),
        distanceParsecs: 0.0000048,
        rightAscension: 0,
        declination: 0,
        apparentMagnitude: -26.74,
        absoluteMagnitude: 4.83,
        colorIndex: 0.63,
        spectralClass: SpectralClass.G,
        massSolar: 1,
        radiusSolar: 1,
        catalog: 'Solar System',
        catalogId: 'Sol',
    },
    {
        id: 'proxima',
        name: 'Proxima Centauri',
        designation: 'α Centauri C',
        type: CosmicObjectType.STAR,
        position: equatorialToCartesian(217.4, -62.7, 1.3),
        distanceParsecs: 1.3,
        rightAscension: 217.4,
        declination: -62.7,
        apparentMagnitude: 11.13,
        absoluteMagnitude: 15.6,
        colorIndex: 1.82,
        spectralClass: SpectralClass.M,
        massSolar: 0.12,
        radiusSolar: 0.15,
        catalog: 'Gaia DR3',
        catalogId: 'Gaia DR3 5853498713190525696',
    },
    {
        id: 'alpha_cen_a',
        name: 'Alpha Centauri A',
        designation: 'α Centauri A',
        type: CosmicObjectType.STAR,
        position: equatorialToCartesian(219.9, -60.8, 1.34),
        distanceParsecs: 1.34,
        rightAscension: 219.9,
        declination: -60.8,
        apparentMagnitude: -0.01,
        absoluteMagnitude: 4.38,
        colorIndex: 0.71,
        spectralClass: SpectralClass.G,
        massSolar: 1.1,
        radiusSolar: 1.22,
        catalog: 'Gaia DR3',
        catalogId: 'Gaia DR3 5853498713190525312',
    },
    {
        id: 'barnards',
        name: "Barnard's Star",
        designation: 'BD+04°3561a',
        type: CosmicObjectType.STAR,
        position: equatorialToCartesian(269.45, 4.69, 1.83),
        distanceParsecs: 1.83,
        rightAscension: 269.45,
        declination: 4.69,
        apparentMagnitude: 9.54,
        absoluteMagnitude: 13.22,
        colorIndex: 1.74,
        spectralClass: SpectralClass.M,
        massSolar: 0.14,
        radiusSolar: 0.18,
        catalog: 'Gaia DR3',
        catalogId: 'Gaia DR3 4472832130942575872',
    },
    {
        id: 'sirius_a',
        name: 'Sirius A',
        designation: 'α Canis Majoris A',
        type: CosmicObjectType.STAR,
        position: equatorialToCartesian(101.3, -16.7, 2.64),
        distanceParsecs: 2.64,
        rightAscension: 101.3,
        declination: -16.7,
        apparentMagnitude: -1.46,
        absoluteMagnitude: 1.42,
        colorIndex: 0.0,
        spectralClass: SpectralClass.A,
        massSolar: 2.06,
        radiusSolar: 1.71,
        catalog: 'Gaia DR3',
        catalogId: 'Gaia DR3 2947050466531873024',
    },
];

/**
 * Load sample data into observation store
 */
export function loadSampleData() {
    const store = useObservationStore.getState();
    store.setLoading(true);
    store.setObjects(SAMPLE_NEARBY_STARS);
    store.setLoading(false);
}

export default useObservationStore;
