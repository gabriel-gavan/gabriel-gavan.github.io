import { STATUS_EFFECTS } from '../../../constants/GameConstants.js';
import { manifest } from '../../../manifest.js';

/**
 * FallbackNarration - Fallback templates when AI narration fails
 *
 * Provides simple, grammatically correct narration without AI.
 * Text can be customized via manifest.ai.fallbackNarration for theming.
 */

/**
 * Generate fallback narration for enemy attack
 * @param {Object} params - { enemyName, attackName, targetName, damage, effect }
 * @returns {string}
 */
export function getEnemyAttackNarration({ enemyName, attackName, targetName, damage, effect }) {
    let narration = `${enemyName} uses ${attackName}`;

    if (targetName) {
        narration += ` against ${targetName}`;
    }

    narration += '!';

    if (damage) {
        narration += ` Deals ${damage} damage.`;
    }

    if (effect) {
        narration += ` ${getEffectDescription(effect)}`;
    }

    return narration;
}

/**
 * Generate fallback narration for player action
 * @param {Object} params - { characterName, abilityName, targetName, tier, damage, effect }
 * @returns {string}
 */
export function getPlayerActionNarration({ characterName, abilityName, targetName, tier, damage, effect }) {
    const tierDescriptions = {
        critical: 'lands a devastating',
        success: 'successfully uses',
        partial: 'partially lands',
        failure: 'attempts but fails'
    };

    let narration = `${characterName} ${tierDescriptions[tier] || 'uses'} ${abilityName}`;

    if (targetName && tier !== 'failure') {
        narration += ` on ${targetName}`;
    }

    narration += '!';

    if (tier !== 'failure') {
        if (damage) {
            narration += ` Deals ${damage} damage.`;
        }
        if (effect) {
            narration += ` ${getEffectDescription(effect)}`;
        }
    }

    return narration;
}

/**
 * Get description for an effect - reads from manifest for content-agnostic theming
 */
function getEffectDescription(effect) {
    if (!effect || !effect.type) return '';

    // Get effect descriptions from manifest
    const effectDescriptions = manifest.ai?.fallbackNarration?.effects || {};

    // Normalize effect type for lookup (STATUS_EFFECTS constants map to simple strings)
    const effectType = effect.type.toLowerCase();

    // Try to get from manifest, fall back to generic defaults
    let template = effectDescriptions[effectType];

    if (!template) {
        // Use default template if effect type not found in manifest
        template = effectDescriptions.default || '{type} effect applied!';
    }

    // Replace placeholders
    return template
        .replace('{damage}', effect.damage || 1)
        .replace('{type}', effect.type);
}

/**
 * Generate fallback initiative announcement
 * @param {Array} initiativeOrder - Array of { name, rolled, bonus, initiative }
 * @returns {string}
 */
export function getInitiativeAnnouncement(initiativeOrder) {
    const orderText = initiativeOrder
        .map((c, i) => `${i + 1}. ${c.name} (${c.rolled}+${c.bonus}=${c.initiative})`)
        .join('\n');

    // Read header from manifest for content-agnostic theming
    const header = manifest.ui?.labels?.initiativeHeader || '⚔️ INITIATIVE ORDER ⚔️';
    return `${header}\n${orderText}`;
}

/**
 * Generate round transition text
 * @param {number} round - Round number
 * @returns {string}
 */
export function getRoundTransition(round) {
    // Read template from manifest for content-agnostic theming
    const template = manifest.ui?.labels?.roundTransition || '--- ROUND {round} ---';
    return template.replace('{round}', round);
}

/**
 * Generate break-free narration
 * @param {string} characterName
 * @param {boolean} success
 * @returns {string}
 */
export function getBreakFreeNarration(characterName, success) {
    // Use manifest fallback narration for content-agnostic theming
    const fallback = manifest.ai?.fallbackNarration || {};

    if (success) {
        const successText = fallback.breakFreeSuccess || 'breaks free from the restraints';
        return `${characterName} ${successText}!`;
    }
    const failureText = fallback.breakFreeFailure || 'struggles against the restraints but remains trapped';
    return `${characterName} ${failureText}!`;
}

/**
 * Generate unconscious turn narration
 * @param {string} characterName
 * @returns {string}
 */
export function getUnconsciousTurnNarration(characterName) {
    // Use manifest fallback narration for content-agnostic theming
    const fallback = manifest.ai?.fallbackNarration || {};
    const unconsciousText = fallback.unconscious || 'is unconscious and cannot act';
    return `${characterName} ${unconsciousText}!`;
}
