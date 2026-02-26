/**
 * DiceRules - Pure functions for dice rolling and outcome determination
 *
 * Per CONTRIBUTING.md: "systems/rules/: Pure functions for D&D mechanics"
 *
 * Core mechanic: d20 + stat bonus → compare to difficulty → outcome tier
 */

import { DIFFICULTY_THRESHOLDS, DICE } from '../../constants/GameConstants.js';

/**
 * Roll a d20
 * @returns {number} Random value between 1 and 20
 */
export function rollD20() {
    return Math.floor(Math.random() * DICE.D20_MAX) + DICE.D20_MIN;
}

/**
 * Roll a d6
 * @returns {number} Random value between 1 and 6
 */
export function rollD6() {
    return Math.floor(Math.random() * DICE.D6_MAX) + DICE.D6_MIN;
}

/**
 * Determine outcome tier from total roll
 * @param {number} total - The total roll value (d20 + modifiers)
 * @param {string} difficulty - Difficulty level (easy, normal, hard, very_hard)
 * @returns {string} Outcome tier: 'critical', 'success', 'partial', or 'failure'
 */
export function getOutcomeTier(total, difficulty = 'normal') {
    const thresholds = DIFFICULTY_THRESHOLDS[difficulty] || DIFFICULTY_THRESHOLDS.normal;

    if (total >= thresholds.critical) return 'critical';
    if (total >= thresholds.success) return 'success';
    if (total >= thresholds.partial) return 'partial';
    return 'failure';
}

/**
 * Perform a complete roll with stat bonus
 * @param {number} statBonus - Bonus from character stat (0-3)
 * @param {string} difficulty - Difficulty level
 * @returns {Object} Roll result with { roll, bonus, total, tier, isNat20, isNat1 }
 */
export function performRoll(statBonus = 0, difficulty = 'normal') {
    const roll = rollD20();
    const total = roll + statBonus;
    let tier = getOutcomeTier(total, difficulty);

    // Natural 20 rule: guarantees at least success
    const isNat20 = roll === DICE.D20_MAX;
    if (isNat20 && (tier === 'partial' || tier === 'failure')) {
        tier = DICE.NAT20_MINIMUM_TIER;
    }

    return {
        roll,
        bonus: statBonus,
        total,
        tier,
        isNat20,
        isNat1: roll === DICE.D20_MIN
    };
}

/**
 * Get probability breakdown for a given stat and difficulty
 * Useful for testing and balancing
 * @param {number} statBonus - Character stat bonus
 * @param {string} difficulty - Difficulty level
 * @returns {Object} Probabilities as percentages { critical, success, partial, failure }
 */
export function getProbabilities(statBonus = 0, difficulty = 'normal') {
    const thresholds = DIFFICULTY_THRESHOLDS[difficulty] || DIFFICULTY_THRESHOLDS.normal;

    // Calculate probability of each tier
    const criticalNeed = thresholds.critical - statBonus;
    const successNeed = thresholds.success - statBonus;
    const partialNeed = thresholds.partial - statBonus;

    const pCritical = Math.max(0, Math.min(DICE.D20_MAX, DICE.D20_MAX + 1 - criticalNeed)) / DICE.D20_MAX;
    const pSuccess = Math.max(0, Math.min(DICE.D20_MAX, DICE.D20_MAX + 1 - successNeed)) / DICE.D20_MAX - pCritical;
    const pPartial = Math.max(0, Math.min(DICE.D20_MAX, DICE.D20_MAX + 1 - partialNeed)) / DICE.D20_MAX - pCritical - pSuccess;
    const pFailure = 1 - pCritical - pSuccess - pPartial;

    return {
        critical: Math.round(pCritical * 100),
        success: Math.round(pSuccess * 100),
        partial: Math.round(pPartial * 100),
        failure: Math.round(pFailure * 100)
    };
}
