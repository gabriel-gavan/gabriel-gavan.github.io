import { STATUS_EFFECTS } from '../../constants/GameConstants.js';

/**
 * EffectManager - Manages combat effects (buffs, debuffs, DoTs)
 *
 * Handles effect application, duration tracking, and queries.
 * Effects are stored on the combat state object passed to methods.
 */
export class EffectManager {
    /**
     * Apply effect to a character
     * @param {Object} combat - Combat state object
     * @param {string} characterId - Target character ID
     * @param {Object} effect - Effect to apply { type, duration, ... }
     */
    applyToCharacter(combat, characterId, effect) {
        if (!combat?.characterEffects?.[characterId]) return;

        combat.characterEffects[characterId].push({
            ...effect,
            turnsRemaining: effect.duration || 1
        });
    }

    /**
     * Apply effect to enemy
     * @param {Object} combat - Combat state object
     * @param {Object} effect - Effect to apply
     */
    applyToEnemy(combat, effect) {
        if (!combat?.enemy) return;

        combat.enemy.activeEffects.push({
            ...effect,
            turnsRemaining: effect.duration || 1
        });
    }

    /**
     * Apply party-wide effect
     * @param {Object} combat - Combat state object
     * @param {Object} effect - Effect to apply
     */
    applyToParty(combat, effect) {
        if (!combat) return;

        combat.partyEffects.push({
            ...effect,
            turnsRemaining: effect.duration || 1
        });
    }

    /**
     * Tick all effects at end of round (reduce durations, remove expired)
     * @param {Object} combat - Combat state object
     */
    tick(combat) {
        if (!combat) return;

        // Tick character effects
        for (const characterId of Object.keys(combat.characterEffects)) {
            combat.characterEffects[characterId] =
                combat.characterEffects[characterId]
                    .map(e => ({ ...e, turnsRemaining: e.turnsRemaining - 1 }))
                    .filter(e => e.turnsRemaining > 0);
        }

        // Tick enemy effects
        if (combat.enemy?.activeEffects) {
            combat.enemy.activeEffects =
                combat.enemy.activeEffects
                    .map(e => ({ ...e, turnsRemaining: e.turnsRemaining - 1 }))
                    .filter(e => e.turnsRemaining > 0);
        }

        // Tick party effects
        combat.partyEffects =
            combat.partyEffects
                .map(e => ({ ...e, turnsRemaining: e.turnsRemaining - 1 }))
                .filter(e => e.turnsRemaining > 0);

        // Tick enemy cooldowns
        if (combat.enemy?.cooldowns) {
            for (const attackId of Object.keys(combat.enemy.cooldowns)) {
                if (combat.enemy.cooldowns[attackId] > 0) {
                    combat.enemy.cooldowns[attackId]--;
                }
            }
        }
    }

    /**
     * Get party-wide accuracy bonus from active effects
     * @param {Object} combat - Combat state object
     * @returns {number} Total accuracy bonus
     */
    getPartyAccuracyBonus(combat) {
        if (!combat?.partyEffects) return 0;
        return combat.partyEffects
            .filter(e => e.type === STATUS_EFFECTS.ACCURACY_BOOST)
            .reduce((total, e) => total + (e.bonus || 0), 0);
    }

    /**
     * Get haste bonus for a specific character
     * @param {Object} combat - Combat state object
     * @param {string} characterId - Character ID
     * @returns {number} Haste bonus
     */
    getCharacterHasteBonus(combat, characterId) {
        const charEffects = combat?.characterEffects?.[characterId] || [];
        const partyEffects = combat?.partyEffects || [];
        
        const charBonus = charEffects
            .filter(e => e.type === STATUS_EFFECTS.HASTE)
            .reduce((total, e) => total + (e.bonus || 0), 0);
            
        const partyBonus = partyEffects
            .filter(e => e.type === STATUS_EFFECTS.HASTE)
            .reduce((total, e) => total + (e.bonus || 0), 0);
            
        return charBonus + partyBonus;
    }

    /**
     * Check if character has a specific effect type
     * @param {Object} combat - Combat state object
     * @param {string} characterId - Character ID
     * @param {string} effectType - Effect type to check
     * @returns {boolean}
     */
    characterHasEffect(combat, characterId, effectType) {
        const effects = combat?.characterEffects?.[characterId] || [];
        return effects.some(e => e.type === effectType);
    }

    /**
     * Check if enemy has a specific effect type
     * @param {Object} combat - Combat state object
     * @param {string} effectType - Effect type to check
     * @returns {boolean}
     */
    enemyHasEffect(combat, effectType) {
        return combat?.enemy?.activeEffects?.some(e => e.type === effectType) || false;
    }

    /**
     * Remove specific effect type from character
     * @param {Object} combat - Combat state object
     * @param {string} characterId - Character ID
     * @param {string} effectType - Effect type to remove
     */
    removeFromCharacter(combat, characterId, effectType) {
        if (!combat?.characterEffects?.[characterId]) return;
        combat.characterEffects[characterId] =
            combat.characterEffects[characterId].filter(e => e.type !== effectType);
    }

    /**
     * Consume mark on enemy (removes it and returns bonus damage)
     * @param {Object} combat - Combat state object
     * @returns {number} Bonus damage from mark (0 if not marked)
     */
    consumeEnemyMark(combat) {
        if (!combat?.enemy?.activeEffects) return 0;

        const markIndex = combat.enemy.activeEffects.findIndex(e => e.type === STATUS_EFFECTS.MARK);
        if (markIndex === -1) return 0;

        const mark = combat.enemy.activeEffects[markIndex];
        combat.enemy.activeEffects.splice(markIndex, 1);
        return mark.bonus || 1;
    }

    /**
     * Get all characters with a specific effect
     * @param {Object} combat - Combat state object
     * @param {string} effectType - Effect type to find
     * @returns {Array<string>} Character IDs with effect
     */
    getCharactersWithEffect(combat, effectType) {
        if (!combat?.characterEffects) return [];

        return Object.entries(combat.characterEffects)
            .filter(([_, effects]) => effects.some(e => e.type === effectType))
            .map(([id]) => id);
    }
}
