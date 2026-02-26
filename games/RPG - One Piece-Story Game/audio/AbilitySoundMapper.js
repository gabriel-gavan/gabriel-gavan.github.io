/**
 * AbilitySoundMapper - Maps ability properties to sound types
 * 
 * Provides clean separation between ability data and sound selection logic
 */

// Sound type constants
export const SOUND_TYPES = {
    MELEE: 'melee',
    RANGED: 'ranged',
    SPECIAL: 'special'
};

// Damage types that should use special ability sounds
const SPECIAL_DAMAGE_TYPES = new Set([
    'fire',
    'ice',
    'cold',
    'lightning',
    'acid',
    'poison',
    'radiant',
    'necrotic',
    'psychic',
    'force'
]);

// Ranged damage types
const RANGED_DAMAGE_TYPES = new Set([
    'piercing' // For arrows, bolts, etc.
]);

// Keywords in ability names that indicate ranged attacks
const RANGED_KEYWORDS = [
    'shoot',
    'arrow',
    'bow',
    'throw',
    'hurl',
    'toss',
    'sling',
    'crossbow'
];

// Keywords in ability names that indicate special/magical attacks
const SPECIAL_KEYWORDS = [
    'magic',
    'spell',
    'fire',
    'ice',
    'lightning',
    'acid',
    'holy',
    'divine',
    'arcane',
    'blast',
    'bolt',
    'ray'
];

export class AbilitySoundMapper {
    /**
     * Determine the appropriate sound type for an ability
     * @param {Object} ability - The ability data object
     * @returns {string} - One of SOUND_TYPES values
     */
    static getSoundType(ability) {
        if (!ability) return SOUND_TYPES.MELEE;

        // Priority 1: Check damage type
        if (ability.damageType) {
            if (SPECIAL_DAMAGE_TYPES.has(ability.damageType)) {
                return SOUND_TYPES.SPECIAL;
            }
            if (RANGED_DAMAGE_TYPES.has(ability.damageType) && 
                this._hasRangedIndicators(ability)) {
                return SOUND_TYPES.RANGED;
            }
        }

        // Priority 2: Check stat (wits often indicates magic/special)
        if (ability.stat === 'wits') {
            return SOUND_TYPES.SPECIAL;
        }

        // Priority 3: Check ability name for keywords
        const abilityName = ability.name?.toLowerCase() || '';
        
        if (SPECIAL_KEYWORDS.some(keyword => abilityName.includes(keyword))) {
            return SOUND_TYPES.SPECIAL;
        }
        
        if (RANGED_KEYWORDS.some(keyword => abilityName.includes(keyword))) {
            return SOUND_TYPES.RANGED;
        }

        // Default: melee
        return SOUND_TYPES.MELEE;
    }

    /**
     * Check if ability has indicators of being ranged
     * @private
     */
    static _hasRangedIndicators(ability) {
        const name = ability.name?.toLowerCase() || '';
        const description = ability.description?.toLowerCase() || '';
        
        return RANGED_KEYWORDS.some(keyword => 
            name.includes(keyword) || description.includes(keyword)
        );
    }

    /**
     * Add custom mapping for specific ability IDs
     * Useful for overriding the automatic detection
     */
    static _customMappings = {
        // Example: 'unique_ability_id': SOUND_TYPES.SPECIAL
    };

    /**
     * Get sound type with custom override support
     */
    static getSoundTypeWithOverrides(abilityId, ability) {
        // Check for custom override first
        if (this._customMappings[abilityId]) {
            return this._customMappings[abilityId];
        }
        
        return this.getSoundType(ability);
    }
}
