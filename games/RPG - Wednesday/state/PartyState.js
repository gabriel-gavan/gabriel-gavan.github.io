import { CHARACTER_STATUS } from '../constants/GameConstants.js';

/**
 * PartyState - Manages party member state
 *
 * Tracks health, status, and provides party-wide queries.
 */
export class PartyState {
    constructor() {
        this.members = [];
    }

    /**
     * Initialize party from data
     * @param {Array} partyData - Raw party data from JSON
     */
    initialize(partyData) {
        this.members = partyData.map(member => ({
            ...member,
            currentHealth: member.maxHealth,
            status: 'ok'
        }));
    }

    /**
     * Get all party members
     * @returns {Array}
     */
    getAll() {
        return this.members;
    }

    /**
     * Get party member by ID
     * @param {string} id - Member ID
     * @returns {Object|undefined}
     */
    getMember(id) {
        return this.members.find(p => p.id === id);
    }

    /**
     * Apply damage to a party member
     * @param {string} targetId - Member ID
     * @param {number} amount - Damage amount
     */
    applyDamage(targetId, amount) {
        const member = this.getMember(targetId);
        if (!member || member.status === CHARACTER_STATUS.DOWN) return;

        member.currentHealth = Math.max(0, member.currentHealth - amount);

        if (member.currentHealth === 0) {
            member.status = CHARACTER_STATUS.DOWN;
        } else if (member.currentHealth < member.maxHealth) {
            member.status = 'hurt';
        }
    }

    /**
     * Heal a party member
     * Note: Cannot heal members who are 'down'
     * @param {string} targetId - Member ID
     * @param {number} amount - Heal amount
     */
    applyHeal(targetId, amount) {
        const member = this.getMember(targetId);
        if (!member || member.status === CHARACTER_STATUS.DOWN) return;

        member.currentHealth = Math.min(member.maxHealth, member.currentHealth + amount);
        member.status = member.currentHealth === member.maxHealth ? 'ok' : 'hurt';
    }

    /**
     * Check if entire party is down
     * @returns {boolean}
     */
    isWiped() {
        return this.members.every(p => p.status === CHARACTER_STATUS.DOWN);
    }

    /**
     * Get active (non-down) party members
     * @returns {Array}
     */
    getActive() {
        return this.members.filter(p => p.status !== CHARACTER_STATUS.DOWN);
    }

    /**
     * Reset all party members to full health
     */
    reset() {
        this.members.forEach(member => {
            member.currentHealth = member.maxHealth;
            member.status = 'ok';
        });
    }
}
