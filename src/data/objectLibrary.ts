/**
 * Object Library - Comprehensive catalog of celestial objects and structures
 * Based on real astronomical data and classifications
 */

import { CosmicObjectType, SpectralClass } from '@/engine/physics/types';

export interface ObjectTemplate {
    id: string;
    name: string;
    category: 'celestial' | 'structure';
    subcategory: string;
    icon: string;
    color: string; // Preview color
    defaultProperties: {
        type: CosmicObjectType;
        config?: Record<string, unknown>;
        description?: string;
    };
}

/**
 * CELESTIAL OBJECTS - Individual cosmic bodies
 */
export const CELESTIAL_OBJECTS: ObjectTemplate[] = [
    // Small Bodies
    {
        id: 'comet',
        name: 'Comet',
        category: 'celestial',
        subcategory: 'Small Bodies',
        icon: '☄️',
        color: '#b0c4de',
        defaultProperties: {
            type: CosmicObjectType.PLANET,
            description: 'Icy body with volatile composition'
        }
    },
    {
        id: 'asteroid',
        name: 'Asteroid',
        category: 'celestial',
        subcategory: 'Small Bodies',
        icon: '🪨',
        color: '#8b7355',
        defaultProperties: {
            type: CosmicObjectType.PLANET,
            description: 'Rocky minor planet'
        }
    },
    {
        id: 'meteor',
        name: 'Meteor',
        category: 'celestial',
        subcategory: 'Small Bodies',
        icon: '💫',
        color: '#dcdcdc',
        defaultProperties: {
            type: CosmicObjectType.PLANET,
            description: 'Small meteoroid'
        }
    },

    // Dwarf Planets
    {
        id: 'dwarf-planet',
        name: 'Dwarf Planet',
        category: 'celestial',
        subcategory: 'Dwarf Planets',
        icon: '🌑',
        color: '#a9a9a9',
        defaultProperties: {
            type: CosmicObjectType.PLANET,
            description: 'Planet-like body, e.g. Pluto'
        }
    },

    // Rocky Planets (Terrestrial)
    {
        id: 'rocky-planet',
        name: 'Rocky Planet',
        category: 'celestial',
        subcategory: 'Rocky Planets',
        icon: '🌍',
        color: '#8b7355',
        defaultProperties: {
            type: CosmicObjectType.PLANET,
            description: 'Earth-like terrestrial planet'
        }
    },
    {
        id: 'desert-planet',
        name: 'Desert Planet',
        category: 'celestial',
        subcategory: 'Rocky Planets',
        icon: '🏜️',
        color: '#daa520',
        defaultProperties: {
            type: CosmicObjectType.PLANET,
            description: 'Mars-like arid world'
        }
    },
    {
        id: 'ice-planet',
        name: 'Ice Planet',
        category: 'celestial',
        subcategory: 'Rocky Planets',
        icon: '❄️',
        color: '#b0e0e6',
        defaultProperties: {
            type: CosmicObjectType.PLANET,
            description: 'Frozen terrestrial world'
        }
    },

    // Gas Giants
    {
        id: 'gas-giant',
        name: 'Gas Giant',
        category: 'celestial',
        subcategory: 'Gas Giants',
        icon: '🪐',
        color: '#f4a460',
        defaultProperties: {
            type: CosmicObjectType.PLANET,
            description: 'Jupiter-like gas giant'
        }
    },
    {
        id: 'ice-giant',
        name: 'Ice Giant',
        category: 'celestial',
        subcategory: 'Ice Giants',
        icon: '💎',
        color: '#4682b4',
        defaultProperties: {
            type: CosmicObjectType.PLANET,
            description: 'Neptune-like ice giant'
        }
    },

    // Main Sequence Stars
    {
        id: 'star-o',
        name: 'O-Type Star (Blue)',
        category: 'celestial',
        subcategory: 'Stars - Main Sequence',
        icon: '⭐',
        color: '#9bb0ff',
        defaultProperties: {
            type: CosmicObjectType.STAR,
            config: { spectralClass: SpectralClass.O },
            description: 'Extremely hot blue star, 30,000-50,000K'
        }
    },
    {
        id: 'star-b',
        name: 'B-Type Star (Blue-White)',
        category: 'celestial',
        subcategory: 'Stars - Main Sequence',
        icon: '⭐',
        color: '#aabfff',
        defaultProperties: {
            type: CosmicObjectType.STAR,
            config: { spectralClass: SpectralClass.B },
            description: 'Hot blue-white star, 10,000-30,000K'
        }
    },
    {
        id: 'star-a',
        name: 'A-Type Star (White)',
        category: 'celestial',
        subcategory: 'Stars - Main Sequence',
        icon: '⭐',
        color: '#cad7ff',
        defaultProperties: {
            type: CosmicObjectType.STAR,
            config: { spectralClass: SpectralClass.A },
            description: 'White star like Sirius, 7,500-10,000K'
        }
    },
    {
        id: 'star-f',
        name: 'F-Type Star (Yellow-White)',
        category: 'celestial',
        subcategory: 'Stars - Main Sequence',
        icon: '⭐',
        color: '#f8f7ff',
        defaultProperties: {
            type: CosmicObjectType.STAR,
            config: { spectralClass: SpectralClass.F },
            description: 'Yellow-white star, 6,000-7,500K'
        }
    },
    {
        id: 'star-g',
        name: 'G-Type Star (Yellow/Sun)',
        category: 'celestial',
        subcategory: 'Stars - Main Sequence',
        icon: '☀️',
        color: '#fff4ea',
        defaultProperties: {
            type: CosmicObjectType.STAR,
            config: { spectralClass: SpectralClass.G },
            description: 'Sun-like yellow star, 5,200-6,000K'
        }
    },
    {
        id: 'star-k',
        name: 'K-Type Star (Orange)',
        category: 'celestial',
        subcategory: 'Stars - Main Sequence',
        icon: '⭐',
        color: '#ffd2a1',
        defaultProperties: {
            type: CosmicObjectType.STAR,
            config: { spectralClass: SpectralClass.K },
            description: 'Orange dwarf star, 3,700-5,200K'
        }
    },
    {
        id: 'star-m',
        name: 'M-Type Star (Red Dwarf)',
        category: 'celestial',
        subcategory: 'Stars - Main Sequence',
        icon: '🔴',
        color: '#ffcc6f',
        defaultProperties: {
            type: CosmicObjectType.STAR,
            config: { spectralClass: SpectralClass.M },
            description: 'Cool red dwarf, 2,400-3,700K'
        }
    },

    // Exotic Objects
    {
        id: 'neutron-star',
        name: 'Neutron Star',
        category: 'celestial',
        subcategory: 'Exotic Objects',
        icon: '💠',
        color: '#aaccff',
        defaultProperties: {
            type: CosmicObjectType.NEUTRON_STAR,
            description: 'Ultra-dense stellar remnant'
        }
    },
    {
        id: 'black-hole',
        name: 'Black Hole',
        category: 'celestial',
        subcategory: 'Exotic Objects',
        icon: '⚫',
        color: '#7c5cff',
        defaultProperties: {
            type: CosmicObjectType.BLACK_HOLE,
            description: 'Gravitational singularity'
        }
    },
];

/**
 * STRUCTURES - Complex cosmic structures (simplified for now)
 * Note: Full structure implementation would require multi-object systems
 */
export const STRUCTURES: ObjectTemplate[] = [
    {
        id: 'nebula-emission',
        name: 'Emission Nebula',
        category: 'structure',
        subcategory: 'Nebulas',
        icon: '🌌',
        color: '#ff69b4',
        defaultProperties: {
            type: CosmicObjectType.STAR,
            config: { spectralClass: SpectralClass.O },
            description: 'Ionized gas cloud (simplified as hot star)'
        }
    },
    {
        id: 'binary-system',
        name: 'Binary Star System',
        category: 'structure',
        subcategory: 'Star Systems',
        icon: '👥',
        color: '#fff4ea',
        defaultProperties: {
            type: CosmicObjectType.STAR,
            config: { spectralClass: SpectralClass.G },
            description: 'Place two stars manually'
        }
    },
    {
        id: 'planetary-system',
        name: 'Planetary System',
        category: 'structure',
        subcategory: 'Star Systems',
        icon: '🪐',
        color: '#fff4ea',
        defaultProperties: {
            type: CosmicObjectType.STAR,
            config: { spectralClass: SpectralClass.G },
            description: 'Place star, then add planets in orbit'
        }
    },
];

/**
 * Get objects by category
 */
export function getObjectsByCategory(category: 'celestial' | 'structure') {
    const source = category === 'celestial' ? CELESTIAL_OBJECTS : STRUCTURES;

    // Group by subcategory
    const grouped = source.reduce((acc, obj) => {
        if (!acc[obj.subcategory]) {
            acc[obj.subcategory] = [];
        }
        acc[obj.subcategory].push(obj);
        return acc;
    }, {} as Record<string, ObjectTemplate[]>);

    return grouped;
}

/**
 * Get object template by ID
 */
export function getObjectTemplate(id: string): ObjectTemplate | undefined {
    return [...CELESTIAL_OBJECTS, ...STRUCTURES].find(obj => obj.id === id);
}
