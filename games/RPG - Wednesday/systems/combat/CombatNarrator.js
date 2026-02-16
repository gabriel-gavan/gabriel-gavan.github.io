/**
 * CombatNarrator - Context building for AI narration
 *
 * Per CONTRIBUTING.md: "CombatNarrator: Handles LLM context generation and prompt engineering."
 *
 * Responsibilities:
 * - Building combat context for AI prompts
 * - Calculating damage context before resolution
 * - Providing momentum and effect context
 */

import { CHARACTER_STATUS, COMBAT } from '../../constants/GameConstants.js';
import { getDamageModifier } from '../rules/DamageRules.js';
import { calculateAbilityDamage } from '../rules/CombatRules.js';

export class CombatNarrator {
    /**
     * @param {GameState} gameState - Game state manager
     */
    constructor(gameState) {
        this.gameState = gameState;
    }

    /**
     * Build comprehensive combat context for AI narration
     * @returns {Object} Combined effect and momentum context
     */
    buildCombatContext() {
        return {
            ...this.getEffectContext(),
            ...this.getMomentumContext()
        };
    }

    /**
     * Get active effects context for narration
     * Helps AI reference buffs/debuffs in descriptions
     * @returns {Object} { partyBuffs, enemyDebuffs }
     */
    getEffectContext() {
        const combat = this.gameState.combat;
        const partyEffects = combat?.partyEffects || [];
        const enemyEffects = combat?.enemy?.activeEffects || [];

        return {
            partyBuffs: partyEffects.length > 0
                ? partyEffects.map(e => `${e.type}${e.reduction ? ` (-${e.reduction} damage)` : ''} (${e.turnsRemaining} turns)`).join(', ')
                : 'none',
            enemyDebuffs: enemyEffects.length > 0
                ? enemyEffects.map(e => `${e.type}${e.amount ? ` (${e.amount})` : ''} (${e.turnsRemaining} turns)`).join(', ')
                : 'none'
        };
    }

    /**
     * Get combat momentum context for tone setting
     * Helps AI match narration tone to combat situation
     * @returns {Object} Momentum context with round, health info, and situation
     */
    getMomentumContext() {
        const party = this.gameState.party;
        const enemy = this.gameState.combat?.enemy;
        if (!enemy) return {};

        const partyStanding = party.filter(p => p.status !== CHARACTER_STATUS.DOWN).length;
        const partyAvgHp = party.reduce((sum, p) => sum + (p.currentHealth / p.maxHealth), 0) / party.length;
        const enemyHpPercent = enemy.currentHealth / enemy.maxHealth;

        let momentum;
        if (partyAvgHp > 0.7 && enemyHpPercent < 0.5) {
            momentum = 'party dominating';
        } else if (partyAvgHp < 0.3 || partyStanding <= 1) {
            momentum = 'desperate situation';
        } else if (enemyHpPercent < COMBAT.HEALTH_THRESHOLDS.CRITICAL) {
            momentum = 'enemy on the ropes';
        } else {
            momentum = 'evenly matched';
        }

        return {
            round: this.gameState.combat?.round || 1,
            partyStanding,
            partyTotal: party.length,
            partyAvgHpPercent: Math.round(partyAvgHp * 100),
            enemyHpPercent: Math.round(enemyHpPercent * 100),
            momentum
        };
    }

    /**
     * Pre-calculate expected damage for enemy attack
     * @param {Object} attack - Enemy attack data
     * @param {Object} target - Target party member
     * @returns {Object} { damage, modifier, finalDamage }
     */
    calculateEnemyAttackDamage(attack, target) {
        if (!attack.damage) return { damage: 0, modifier: 0, finalDamage: 0 };

        const modifier = getDamageModifier(this.gameState.combat, target.id, false);
        const finalDamage = Math.max(0, attack.damage + modifier);

        return {
            damage: attack.damage,
            modifier,
            finalDamage
        };
    }

    /**
     * Build damage context for enemy attack narration
     * @param {Object} attack - Enemy attack data
     * @param {Object|Array} resolvedTarget - Target(s)
     * @param {Function} isAOETarget - Function to check if AOE
     * @returns {Object} Damage context for AI prompt
     */
    buildEnemyDamageContext(attack, resolvedTarget, isAOETarget) {
        if (!attack.damage) {
            return { damageDealt: 0, isLethal: false };
        }

        // For AOE, calculate for primary target (lowest HP for drama)
        const targets = isAOETarget(resolvedTarget) ? resolvedTarget : [resolvedTarget];
        const primaryTarget = targets.reduce((min, t) =>
            (t.currentHealth < min.currentHealth) ? t : min, targets[0]);

        const { finalDamage } = this.calculateEnemyAttackDamage(attack, primaryTarget);
        const healthAfter = Math.max(0, primaryTarget.currentHealth - finalDamage);
        const isLethal = healthAfter === 0 && primaryTarget.currentHealth > 0;

        return {
            damageDealt: finalDamage,
            targetHealthBefore: primaryTarget.currentHealth,
            targetHealthAfter: healthAfter,
            targetMaxHealth: primaryTarget.maxHealth,
            targetStatus: isLethal ? CHARACTER_STATUS.DOWNED : (healthAfter <= 2 ? CHARACTER_STATUS.BADLY_HURT : CHARACTER_STATUS.HURT),
            isLethal
        };
    }

    /**
     * Build damage context for companion attack narration
     * @param {Object} attack - Companion attack data
     * @param {Object|Array} resolvedTarget - Target(s)
     * @param {Function} isAOETarget - Function to check if AOE
     * @returns {Object} Damage context for AI prompt
     */
    buildCompanionDamageContext(attack, resolvedTarget, isAOETarget) {
        if (!attack.damage) {
            return { damageDealt: 0, isLethal: false };
        }

        const targets = isAOETarget(resolvedTarget) ? resolvedTarget : [resolvedTarget];
        const primaryTarget = targets.reduce((min, t) =>
            (t.currentHealth < min.currentHealth) ? t : min, targets[0]);

        const modifier = getDamageModifier(this.gameState.combat, primaryTarget.id, false);
        const finalDamage = Math.max(0, attack.damage + modifier);
        const healthAfter = Math.max(0, primaryTarget.currentHealth - finalDamage);
        const isLethal = healthAfter === 0 && primaryTarget.currentHealth > 0;

        return {
            damageDealt: finalDamage,
            targetHealthBefore: primaryTarget.currentHealth,
            targetHealthAfter: healthAfter,
            targetMaxHealth: primaryTarget.maxHealth,
            targetStatus: isLethal ? CHARACTER_STATUS.DOWNED : (healthAfter <= 2 ? CHARACTER_STATUS.BADLY_HURT : CHARACTER_STATUS.HURT),
            isLethal
        };
    }

    /**
     * Build damage context for player attack narration
     * @param {Object} ability - Player ability data
     * @param {Object} rollResult - Dice roll result
     * @returns {Object} Damage context for AI prompt
     */
    buildPlayerDamageContext(ability, rollResult) {
        if (!ability.damage || rollResult.tier === 'failure') {
            return { damageDealt: 0, isKillingBlow: false };
        }

        const baseDamage = calculateAbilityDamage(ability, rollResult.tier);
        const modifier = getDamageModifier(this.gameState.combat, 'enemy', true);
        const markBonus = this.gameState.isEnemyMarked() ? COMBAT.MARK_BONUS_DAMAGE : 0;
        const finalDamage = Math.max(0, baseDamage + modifier + markBonus);

        const enemy = this.gameState.combat?.enemy;
        const healthBefore = enemy?.currentHealth || 0;
        const healthAfter = Math.max(0, healthBefore - finalDamage);
        const isKillingBlow = healthAfter === 0 && healthBefore > 0;

        return {
            damageDealt: finalDamage,
            enemyHealthBefore: healthBefore,
            enemyHealthAfter: healthAfter,
            enemyMaxHealth: enemy?.maxHealth || 0,
            enemyStatus: enemy?.status || CHARACTER_STATUS.UNKNOWN,
            isKillingBlow,
            hadMark: markBonus > 0
        };
    }

    /**
     * Build character context for player action narration
     * @param {Object} character - Acting character
     * @returns {Object} Character personality context
     */
    buildCharacterContext(character) {
        return {
            characterTrait: character.trait,
            characterDescription: character.description
        };
    }
}
