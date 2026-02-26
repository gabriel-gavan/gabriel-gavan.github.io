/**
 * CombatRules - Pure functions for combat mechanics
 *
 * Per CONTRIBUTING.md: "CombatRules: Pure math. (Attacker, Defender) => Damage. No side effects."
 *
 * Contains stateless calculations for:
 * - Damage based on ability and roll tier
 * - Initiative rolls
 * - Break-free attempts
 * - Health status determination
 */

import { COMBAT, DICE } from '../../constants/GameConstants.js';
import { rollD20, rollD6 } from './DiceRules.js';

/**
 * Calculate damage based on ability and roll result tier
 * @param {Object} ability - Ability data with damage property
 * @param {string} tier - Roll outcome tier (critical, success, partial, failure)
 * @returns {number} Calculated damage amount
 */
export function calculateAbilityDamage(ability, tier) {
    if (!ability.damage) return 0;

    let damage = ability.damage;

    switch (tier) {
        case 'critical':
            damage = Math.ceil(damage * COMBAT.CRITICAL_MULTIPLIER);
            break;
        case 'success':
            // Full damage
            break;
        case 'partial':
            damage = Math.ceil(damage * COMBAT.PARTIAL_MULTIPLIER);
            break;
        case 'failure':
            damage = 0;
            break;
    }

    return damage;
}

/**
 * Roll initiative for a combatant
 * @param {number} cunningBonus - Cunning stat bonus (default 0)
 * @returns {Object} Initiative result { roll, bonus, total }
 */
export function rollInitiative(cunningBonus = 0) {
    const roll = rollD20();
    return {
        roll,
        bonus: cunningBonus,
        total: roll + cunningBonus
    };
}

/**
 * Sort combatants by initiative (descending)
 * Ties broken by bonus, then random
 * @param {Array} combatants - Array of { id, name, type, initiative, bonus }
 * @returns {Array} Sorted combatants array
 */
export function sortByInitiative(combatants) {
    return [...combatants].sort((a, b) => {
        if (b.initiative !== a.initiative) {
            return b.initiative - a.initiative;
        }
        if (b.bonus !== a.bonus) {
            return b.bonus - a.bonus;
        }
        return Math.random() - 0.5;
    });
}

/**
 * Attempt to break free from restraints
 * @param {number} brawnBonus - Brawn stat bonus (default 0)
 * @returns {Object} Result { roll, bonus, total, success }
 */
export function attemptBreakFree(brawnBonus = 0) {
    const roll = rollD6();
    const total = roll + brawnBonus;
    return {
        roll,
        bonus: brawnBonus,
        total,
        success: total >= COMBAT.BREAKFREE_DC
    };
}

/**
 * Determine enemy status based on health percentage
 * @param {number} currentHealth - Current health
 * @param {number} maxHealth - Maximum health
 * @returns {string} Status: 'healthy', 'wounded', or 'critical'
 */
export function getHealthStatus(currentHealth, maxHealth) {
    if (currentHealth <= 0) return 'defeated';

    const healthPercent = currentHealth / maxHealth;

    if (healthPercent <= COMBAT.HEALTH_THRESHOLDS.CRITICAL) {
        return 'critical';
    }
    if (healthPercent <= COMBAT.HEALTH_THRESHOLDS.WOUNDED) {
        return 'wounded';
    }
    return 'healthy';
}

/**
 * Calculate final player damage to enemy including mark bonus
 * @param {number} baseDamage - Base calculated damage
 * @param {number} modifier - Damage modifier from effects
 * @param {boolean} hasMarkBonus - Whether enemy has mark to consume
 * @returns {Object} { finalDamage, markBonusApplied }
 */
export function calculatePlayerDamageToEnemy(baseDamage, modifier, hasMarkBonus) {
    const markBonus = hasMarkBonus ? COMBAT.MARK_BONUS_DAMAGE : 0;
    const finalDamage = Math.max(0, baseDamage + modifier + markBonus);
    return {
        finalDamage,
        markBonusApplied: hasMarkBonus && markBonus > 0
    };
}

/**
 * Check if a triggered ability should activate
 * @param {Object} trigger - Trigger configuration { type, threshold }
 * @param {number} healthPercent - Current health as decimal (0-1)
 * @param {number} currentHealth - Current health value
 * @returns {boolean} True if trigger conditions are met
 */
export function shouldTriggerAbility(trigger, healthPercent, currentHealth) {
    if (!trigger) return false;

    // Only trigger health-based abilities if still alive
    if (trigger.type === 'health_below') {
        return healthPercent <= trigger.threshold && currentHealth > 0;
    }

    return false;
}
