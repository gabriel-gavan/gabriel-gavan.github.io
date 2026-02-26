/**
 * CombatFlow - Combat state machine and turn management
 *
 * Per CONTRIBUTING.md: "CombatFlow: Manages the state machine (Whose turn is it? Is the battle over?)."
 *
 * Responsibilities:
 * - Initiative rolling and ordering
 * - Turn progression
 * - Round management
 * - Phase transitions
 */

import { EventBus } from '../../events/EventBus.js';
import { COMBAT_EVENTS } from '../../events/CombatEvents.js';
import { COMBATANT_TYPES } from '../../constants/GameConstants.js';
import { rollInitiative, sortByInitiative } from '../rules/CombatRules.js';

/**
 * Combat phases - state machine states
 */
export const COMBAT_PHASES = {
    INITIALIZING: 'initializing',
    ENEMY_DECIDING: 'enemy_deciding',
    ENEMY_NARRATION: 'enemy_narration',
    ENEMY_RESOLUTION: 'enemy_resolution',
    PLAYER_CHAR_SELECT: 'player_char_select',
    PLAYER_ABILITY_SELECT: 'player_ability_select',
    PLAYER_ROLLING: 'player_rolling',
    PLAYER_RESOLUTION: 'player_resolution',
    ROUND_END: 'round_end',
    COMBAT_END: 'combat_end'
};

export class CombatFlow {
    /**
     * @param {GameState} gameState - Game state manager
     */
    constructor(gameState) {
        this.gameState = gameState;
        this.phase = COMBAT_PHASES.INITIALIZING;
        this.initiativeOrder = [];
        this.currentTurnIndex = 0;

        // Callbacks for phase changes
        this.onPhaseChange = null;
    }

    /**
     * Get current phase
     * @returns {string} Current combat phase
     */
    getPhase() {
        return this.phase;
    }

    /**
     * Set current phase and notify listeners
     * @param {string} phase - One of COMBAT_PHASES values
     */
    setPhase(phase) {
        this.phase = phase;
        if (this.gameState.combat) {
            this.gameState.combat.phase = phase;
        }
        this.onPhaseChange?.(phase);
    }

    /**
     * Roll initiative for all combatants
     * @param {Array} party - Active party members
     * @param {Object} enemyData - Enemy data object
     * @returns {Array} Sorted initiative order
     */
    rollAllInitiative(party, enemyData) {
        this.initiativeOrder = [];

        // Roll for each active party member
        for (const member of party) {
            const cunningBonus = member.stats?.cunning || 0;
            const result = rollInitiative(cunningBonus);

            this.initiativeOrder.push({
                id: member.id,
                name: member.name,
                type: COMBATANT_TYPES.PARTY,
                images: member.images, // Pass images to tracker
                initiative: result.total,
                rolled: result.roll,
                bonus: result.bonus
            });
        }

        // Roll for enemy
        const enemyCunning = enemyData.stats?.cunning || 0;
        const enemyResult = rollInitiative(enemyCunning);

        this.initiativeOrder.push({
            id: COMBATANT_TYPES.ENEMY,
            name: enemyData.shortName,
            type: COMBATANT_TYPES.ENEMY,
            images: enemyData.images, // Pass images to tracker
            initiative: enemyResult.total,
            rolled: enemyResult.roll,
            bonus: enemyResult.bonus
        });

        // Sort by initiative
        this.initiativeOrder = sortByInitiative(this.initiativeOrder);

        // Reset turn index
        this.currentTurnIndex = 0;

        // Store in combat state for UI access
        if (this.gameState.combat) {
            this.gameState.combat.initiativeOrder = this.initiativeOrder;
        }

        return this.initiativeOrder;
    }

    /**
     * Get formatted initiative order for display
     * @returns {string} Formatted initiative order text
     */
    getInitiativeOrderText() {
        return this.initiativeOrder
            .map((c, i) => `${i + 1}. ${c.name} (${c.rolled}+${c.bonus}=${c.initiative})`)
            .join('\n');
    }

    /**
     * Emit initiative rolled event
     */
    emitInitiativeRolled() {
        EventBus.emit(COMBAT_EVENTS.INITIATIVE.ROLLED, {
            order: this.initiativeOrder,
            currentIndex: 0
        });
    }

    /**
     * Get current turn's combatant
     * @returns {Object|null} Current combatant or null if round complete
     */
    getCurrentCombatant() {
        if (this.currentTurnIndex >= this.initiativeOrder.length) {
            return null;
        }
        return this.initiativeOrder[this.currentTurnIndex];
    }

    /**
     * Check if current turn is enemy's turn
     * @returns {boolean} True if enemy's turn
     */
    isEnemyTurn() {
        const current = this.getCurrentCombatant();
        return current?.type === COMBATANT_TYPES.ENEMY;
    }

    /**
     * Advance to next turn
     * @returns {Object|null} Next combatant or null if round complete
     */
    advanceTurn() {
        this.currentTurnIndex++;

        EventBus.emit(COMBAT_EVENTS.INITIATIVE.TURN_CHANGED, {
            order: this.initiativeOrder,
            currentIndex: this.currentTurnIndex
        });

        return this.getCurrentCombatant();
    }

    /**
     * Check if round is complete (all combatants have acted)
     * @returns {boolean} True if round is complete
     */
    isRoundComplete() {
        return this.currentTurnIndex >= this.initiativeOrder.length;
    }

    /**
     * Start new round
     * @returns {number} New round number
     */
    startNewRound() {
        this.setPhase(COMBAT_PHASES.ROUND_END);

        // Tick effects
        this.gameState.tickEffects();

        // Increment round
        this.gameState.combat.round++;

        // Reset turn index
        this.currentTurnIndex = 0;

        EventBus.emit(COMBAT_EVENTS.INITIATIVE.TURN_CHANGED, {
            order: this.initiativeOrder,
            currentIndex: 0
        });

        return this.gameState.combat.round;
    }

    /**
     * Check victory condition
     * @returns {boolean} True if enemy is defeated
     */
    checkVictory() {
        return this.gameState.isEnemyDefeated();
    }

    /**
     * Check defeat condition
     * @returns {boolean} True if party is wiped
     */
    checkDefeat() {
        return this.gameState.isPartyWiped();
    }

    /**
     * End combat and transition to end phase
     */
    endCombat() {
        this.setPhase(COMBAT_PHASES.COMBAT_END);
        this.gameState.endCombat();
    }

    /**
     * Reset flow state for new combat
     */
    reset() {
        this.phase = COMBAT_PHASES.INITIALIZING;
        this.initiativeOrder = [];
        this.currentTurnIndex = 0;
    }
}
