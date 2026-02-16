/**
 * DamageRules - Pure functions for damage calculation
 *
 * Per CONTRIBUTING.md: "CombatRules: Pure math. (Attacker, Defender) => Damage. No side effects."
 *
 * Centralizes damage calculation logic including reductions
 * from shields, concealment, slow, etc.
 */

import { EFFECT_VALUES, STATUS_EFFECTS } from '../../constants/GameConstants.js';

/**
 * Calculate damage modifier from active effects
 * @param {Object} combat - Combat state object
 * @param {string} targetId - Character ID or 'enemy'
 * @param {boolean} isPlayerAttacking - True if player attacking enemy
 * @returns {number} Modifier to add to damage (negative = reduction)
 */
export function getDamageModifier(combat, targetId, isPlayerAttacking) {
    if (!combat) return 0;
    let modifier = 0;

    if (isPlayerAttacking) {
        // Player attacking enemy - check enemy's damage reduction
        for (const effect of combat.enemy?.activeEffects || []) {
            if (effect.type === STATUS_EFFECTS.DAMAGE_REDUCTION) {
                modifier -= effect.amount || EFFECT_VALUES.DEFAULT_REDUCTION;
            }
            if (effect.type === STATUS_EFFECTS.VULNERABLE) {
                modifier += effect.amount || 1;
            }
        }
    } else {
        // Enemy attacking party
        // Check party-wide effects (concealment, party shields)
        for (const effect of combat.partyEffects || []) {
            if (effect.type === STATUS_EFFECTS.CONCEALMENT) {
                modifier -= EFFECT_VALUES.DEFAULT_REDUCTION;
            }
            if (effect.type === STATUS_EFFECTS.SHIELD) {
                modifier -= effect.reduction || EFFECT_VALUES.DEFAULT_REDUCTION;
            }
        }

        // Check enemy debuffs (slow from Caltrops)
        for (const effect of combat.enemy?.activeEffects || []) {
            if (effect.type === STATUS_EFFECTS.SLOW) {
                modifier -= EFFECT_VALUES.SLOW_REDUCTION;
            }
        }

        // Check target's personal shields
        const targetEffects = combat.characterEffects?.[targetId] || [];
        for (const effect of targetEffects) {
            if (effect.type === STATUS_EFFECTS.SHIELD) {
                modifier -= effect.reduction || EFFECT_VALUES.DEFAULT_REDUCTION;
            }
        }

        // Tank Passive: Lurch has innate damage reduction
        if (targetId === 'lurch') {
            modifier -= 1; // Innate -1 damage reduction for Lurch
        }
    }

    return modifier;
}

/**
 * Calculate final damage after modifiers
 * @param {number} baseDamage - Base damage amount
 * @param {Object} combat - Combat state object
 * @param {string} targetId - Target character/enemy ID
 * @param {boolean} isPlayerAttacking - True if player attacking
 * @returns {number} Final damage (minimum 0)
 */
export function calculateFinalDamage(baseDamage, combat, targetId, isPlayerAttacking) {
    const modifier = getDamageModifier(combat, targetId, isPlayerAttacking);
    return Math.max(0, baseDamage + modifier);
}

/**
 * Check if an effect provides damage reduction
 * @param {Object} effect - Effect object to check
 * @returns {boolean} True if effect reduces damage
 */
export function isProtectiveEffect(effect) {
    return effect.type === STATUS_EFFECTS.SHIELD ||
           effect.type === STATUS_EFFECTS.CONCEALMENT ||
           effect.type === STATUS_EFFECTS.DAMAGE_REDUCTION;
}
