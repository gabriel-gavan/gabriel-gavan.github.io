import { COMBAT, CHARACTER_STATUS } from '../constants/GameConstants.js';

/**
 * CombatState - Manages combat-specific state
 *
 * Handles enemy state, ability usage tracking, and combat log.
 * Works with EffectManager for effect-related state.
 */
export class CombatState {
    constructor() {
        this.combat = null;
    }

    /**
     * Initialize combat state for a new encounter
     * @param {Object} enemyData - Enemy data from enemies.json
     * @param {Array} party - Party members
     * @param {Object} abilitiesData - Abilities data from abilities.json
     * @returns {Object} Combat state object
     */
    initialize(enemyData, party, abilitiesData) {
        // Initialize ability usage tracking for all characters
        const abilityUsage = {};
        for (const member of party) {
            abilityUsage[member.id] = {};
            const charAbilities = abilitiesData?.[member.id];
            if (charAbilities?.specialAbilities) {
                for (const ability of charAbilities.specialAbilities) {
                    abilityUsage[member.id][ability.id] = 0;
                }
            }
        }

        // Initialize cooldowns from enemy attacks
        const cooldowns = {};
        for (const attack of enemyData.attacks || []) {
            if (attack.cooldown) {
                cooldowns[attack.id] = 0;
            }
        }

        this.combat = {
            active: true,
            round: 1,
            phase: 'enemy_turn',
            enemy: {
                id: enemyData.id,
                name: enemyData.name,
                shortName: enemyData.shortName,
                images: enemyData.images || {},
                currentHealth: enemyData.health,
                maxHealth: enemyData.health,
                status: CHARACTER_STATUS.HEALTHY,
                activeEffects: [],
                cooldowns,
                usedSpecials: {}
            },
            companion: enemyData.companion ? {
                id: enemyData.companion.id,
                currentHealth: enemyData.companion.health,
                maxHealth: enemyData.companion.health,
                status: CHARACTER_STATUS.HEALTHY,
                active: true
            } : null,
            abilityUsage,
            characterEffects: {},
            partyEffects: [],
            combatLog: []
        };

        // Initialize character effects tracking
        for (const member of party) {
            this.combat.characterEffects[member.id] = [];
        }

        return this.combat;
    }

    /**
     * Get current combat state
     * @returns {Object|null}
     */
    get() {
        return this.combat;
    }

    /**
     * Check if combat is active
     * @returns {boolean}
     */
    isActive() {
        return this.combat?.active || false;
    }

    /**
     * Apply damage to enemy
     * @param {number} amount - Damage amount (must be positive)
     * @returns {Object|null} Updated enemy state
     */
    damageEnemy(amount) {
        if (!this.combat?.enemy) return null;
        if (!amount || amount < 0) return this.combat.enemy;

        this.combat.enemy.currentHealth = Math.max(0, this.combat.enemy.currentHealth - amount);

        // Update status based on health percentage
        const healthPercent = this.combat.enemy.currentHealth / this.combat.enemy.maxHealth;
        if (this.combat.enemy.currentHealth === 0) {
            this.combat.enemy.status = CHARACTER_STATUS.DEFEATED;
        } else if (healthPercent <= COMBAT.HEALTH_THRESHOLDS.CRITICAL) {
            this.combat.enemy.status = CHARACTER_STATUS.CRITICAL;
        } else if (healthPercent <= COMBAT.HEALTH_THRESHOLDS.WOUNDED) {
            this.combat.enemy.status = CHARACTER_STATUS.WOUNDED;
        } else {
            this.combat.enemy.status = CHARACTER_STATUS.HEALTHY;
        }

        return this.combat.enemy;
    }

    /**
     * Apply damage to companion
     * @param {number} amount - Damage amount
     * @returns {Object|null} Updated companion state
     */
    damageCompanion(amount) {
        if (!this.combat?.companion) return null;

        this.combat.companion.currentHealth = Math.max(0, this.combat.companion.currentHealth - amount);

        if (this.combat.companion.currentHealth === 0) {
            this.combat.companion.status = CHARACTER_STATUS.DEFEATED;
            this.combat.companion.active = false;
        }

        return this.combat.companion;
    }

    /**
     * Check if enemy is defeated
     * @returns {boolean}
     */
    isEnemyDefeated() {
        return this.combat?.enemy?.status === CHARACTER_STATUS.DEFEATED;
    }

    /**
     * Use a special ability (increment usage counter)
     * @param {string} characterId - Character using ability
     * @param {string} abilityId - Ability being used
     */
    useAbility(characterId, abilityId) {
        if (!this.combat?.abilityUsage?.[characterId]) return;

        if (this.combat.abilityUsage[characterId][abilityId] === undefined) {
            this.combat.abilityUsage[characterId][abilityId] = 0;
        }
        this.combat.abilityUsage[characterId][abilityId]++;
    }

    /**
     * Get ability usage count
     * @param {string} characterId
     * @param {string} abilityId
     * @returns {number}
     */
    getAbilityUsage(characterId, abilityId) {
        return this.combat?.abilityUsage?.[characterId]?.[abilityId] || 0;
    }

    /**
     * Add entry to combat log
     * @param {Object} entry - Log entry data
     */
    addLogEntry(entry) {
        if (!this.combat) return;

        this.combat.combatLog.push({
            round: this.combat.round,
            ...entry,
            timestamp: Date.now()
        });

        // Keep only last 5 entries
        if (this.combat.combatLog.length > 5) {
            this.combat.combatLog.shift();
        }
    }

    /**
     * End combat and clean up
     */
    end() {
        this.combat = null;
    }
}
