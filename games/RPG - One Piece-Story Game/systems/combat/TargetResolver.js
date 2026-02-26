import { CHARACTER_STATUS } from '../../constants/GameConstants.js';

/**
 * TargetResolver - Resolves target strings to party members
 *
 * Handles various targeting modes: direct ID, lowest/highest health,
 * threat-based, AOE (all), and random.
 */
export class TargetResolver {
    /**
     * Resolve target string to party member(s)
     * @param {string} targetStr - Target identifier or targeting mode
     * @param {Array} party - All party members
     * @param {Array} activeParty - Active (non-down) party members
     * @returns {Object|Object[]|null} Single target, array for AOE, or null
     */
    resolve(targetStr, party, activeParty) {
        if (!targetStr) return null;

        // Direct character ID
        const direct = party.find(p => p.id === targetStr);
        if (direct && direct.status !== CHARACTER_STATUS.DOWN) return direct;

        // Need active party for special targeting
        if (!activeParty || activeParty.length === 0) return null;

        switch (targetStr) {
            case 'lowest_health':
                return this.getLowestHealth(activeParty);

            case 'highest_health':
                return this.getHighestHealth(activeParty);

            case 'highest_threat':
                return this.getHighestThreat(activeParty);

            case 'grouped':
            case 'all':
            case 'aoe':
                return activeParty;

            case 'random':
                return this.getRandom(activeParty);

            default:
                // Unknown targeting mode - return first active
                return activeParty[0];
        }
    }

    /**
     * Get party member with lowest current health
     */
    getLowestHealth(activeParty) {
        return activeParty.reduce((min, p) =>
            p.currentHealth < min.currentHealth ? p : min
        );
    }

    /**
     * Get party member with highest current health
     */
    getHighestHealth(activeParty) {
        return activeParty.reduce((max, p) =>
            p.currentHealth > max.currentHealth ? p : max
        );
    }

    /**
     * Get party member with highest threat (max of brawn/cunning)
     */
    getHighestThreat(activeParty) {
        return activeParty.reduce((max, p) => {
            const pThreat = Math.max(p.stats?.brawn || 0, p.stats?.cunning || 0);
            const maxThreat = Math.max(max.stats?.brawn || 0, max.stats?.cunning || 0);
            return pThreat > maxThreat ? p : max;
        });
    }

    /**
     * Get random active party member
     */
    getRandom(activeParty) {
        return activeParty[Math.floor(Math.random() * activeParty.length)];
    }

    /**
     * Check if target is AOE (array of targets)
     */
    isAOE(target) {
        return Array.isArray(target);
    }

    /**
     * Get all restrained party members
     * @param {Array} activeParty - Active party members
     * @param {Function} isRestrained - Function to check if character is restrained
     */
    getRestrained(activeParty, isRestrained) {
        return activeParty.filter(p => isRestrained(p.id));
    }
}
