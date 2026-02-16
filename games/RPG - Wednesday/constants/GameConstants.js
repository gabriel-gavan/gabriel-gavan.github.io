/**
 * GameConstants - Centralized constants for the game
 *
 * Per CONTRIBUTING.md: "All gameplay constants (Damage multipliers,
 * difficulty thresholds, status effect IDs) must live in GameConstants.js"
 */

// ========================================
// Status Effects
// ========================================

export const STATUS_EFFECTS = {
    RESTRAIN: 'restrain',
    MARK: 'mark',
    SHIELD: 'shield',
    CONCEALMENT: 'concealment',
    SLOW: 'slow',
    DAMAGE_REDUCTION: 'damage_reduction',
    ACCURACY_BOOST: 'accuracy_boost',
    VULNERABLE: 'vulnerable',
    HASTE: 'haste',
    STUN: 'stun',
    TAUNT: 'taunt',
    STATIC_SHIELD: 'static_shield'
};

export const CHARACTER_STATUS = {
    DOWN: 'down',
    HEALTHY: 'healthy',
    HURT: 'hurt',
    BADLY_HURT: 'badly hurt',
    DOWNED: 'downed',
    WOUNDED: 'wounded',
    CRITICAL: 'critical',
    DEFEATED: 'defeated',
    UNKNOWN: 'unknown'
};

// ========================================
// Combat Mechanics
// ========================================

export const COMBAT = {
    /** Damage multiplier for critical hits */
    CRITICAL_MULTIPLIER: 1.5,
    /** Damage multiplier for partial successes */
    PARTIAL_MULTIPLIER: 0.5,
    /** DC to break free from restraints (d6 + brawn >= this) */
    BREAKFREE_DC: 4,
    /** Bonus damage when consuming a mark on enemy */
    MARK_BONUS_DAMAGE: 1,
    /** Health percentage thresholds for enemy status */
    HEALTH_THRESHOLDS: {
        CRITICAL: 0.25,
        WOUNDED: 0.5
    }
};

// ========================================
// Dice & Difficulty
// ========================================

/**
 * Difficulty thresholds for d20 rolls
 * Format: { critical, success, partial } - below partial = failure
 */
export const DIFFICULTY_THRESHOLDS = {
    easy:      { critical: 18, success: 8,  partial: 4  },
    normal:    { critical: 20, success: 12, partial: 6  },
    hard:      { critical: 22, success: 15, partial: 8  },
    very_hard: { critical: 24, success: 18, partial: 10 }
};

export const DICE = {
    D20_MIN: 1,
    D20_MAX: 20,
    D6_MIN: 1,
    D6_MAX: 6,
    /** Natural 20 guarantees at least success tier */
    NAT20_MINIMUM_TIER: 'success'
};

// ========================================
// Effect Modifiers
// ========================================

export const EFFECT_VALUES = {
    /** Default damage reduction for shield/concealment effects */
    DEFAULT_REDUCTION: 1,
    /** Default slow effect damage reduction */
    SLOW_REDUCTION: 1
};

// ========================================
// AI Configuration
// ========================================

export const AI_CONFIG = {
    /** Maximum retry attempts for AI calls */
    MAX_RETRIES: 3,
    /** Timeout for AI requests in milliseconds */
    TIMEOUT_MS: 5000,
    /** Base delay between retries (multiplied by attempt number) */
    RETRY_DELAY_MS: 500,
    /** Default max tokens for AI responses */
    DEFAULT_MAX_TOKENS: 256,
    /** Max tokens for decision responses */
    DECISION_MAX_TOKENS: 150,
    /** Max tokens for narration responses */
    NARRATION_MAX_TOKENS: 200
};

// ========================================
// Target Types
// ========================================

export const TARGET_TYPES = {
    ENEMY: 'enemy',
    SELF: 'self',
    ALLY: 'ally',
    ANY: 'any'
};

// ========================================
// Action Types
// ========================================

export const ACTION_TYPES = {
    ATTACK: 'attack',
    HEAL: 'heal',
    BUFF: 'buff',
    DEBUFF: 'debuff'
};

// ========================================
// Combatant Types
// ========================================

export const COMBATANT_TYPES = {
    ENEMY: 'enemy',
    PARTY: 'party'
};

// ========================================
// UI & Animation Timing
// ========================================

export const TIMING = {
    /** Delay before starting combat after scene load (ms) */
    COMBAT_START_DELAY: 400,
    /** Duration for damage flash animations (ms) */
    DAMAGE_FLASH_DURATION: 200,
    /** Duration for heal glow animations (ms) */
    HEAL_GLOW_DURATION: 300
};
