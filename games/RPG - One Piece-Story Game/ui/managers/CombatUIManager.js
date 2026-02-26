import { EventBus } from '../../events/EventBus.js';
import { COMBAT_EVENTS } from '../../events/CombatEvents.js';
import { DIALOGUE_EVENTS } from '../../events/SceneEvents.js';

export class CombatUIManager {
    constructor(scene) {
        this.scene = scene;
        this.setupListeners();
    }

    setupListeners() {
        // Initiative
        EventBus.on(COMBAT_EVENTS.INITIATIVE.ROLLED, this.handleInitiativeRolled, this);
        EventBus.on(COMBAT_EVENTS.INITIATIVE.TURN_CHANGED, this.handleTurnChanged, this);

        // Ability
        EventBus.on(COMBAT_EVENTS.ABILITY.SELECT_REQUESTED, this.handleAbilitySelectRequested, this);

        // Health
        EventBus.on(COMBAT_EVENTS.HEALTH.PARTY_UPDATED, this.handlePartyHealthUpdated, this);
        EventBus.on(COMBAT_EVENTS.HEALTH.DAMAGE_TAKEN, this.handleDamageTaken, this);
        EventBus.on(COMBAT_EVENTS.HEALTH.HEAL_RECEIVED, this.handleHealReceived, this);

        // Target
        EventBus.on(COMBAT_EVENTS.TARGET.ENEMY_TARGETING, this.handleEnemyTargeting, this);
        EventBus.on(COMBAT_EVENTS.TARGET.TARGET_CLEARED, this.handleTargetCleared, this);

        // Enemy
        EventBus.on(COMBAT_EVENTS.ENEMY.SPAWNED, this.handleEnemySpawned, this);
        EventBus.on(COMBAT_EVENTS.ENEMY.STATUS_UPDATED, this.handleEnemyStatusUpdated, this);
        EventBus.on(COMBAT_EVENTS.ENEMY.DAMAGE_FLASH, this.handleEnemyDamageFlash, this);

        // Dice
        EventBus.on(COMBAT_EVENTS.DICE.ROLL_REQUESTED, this.handleDiceRollRequested, this);

        // Narration
        EventBus.on(COMBAT_EVENTS.NARRATION.SHOW, this.handleNarrationShow, this);

        // Error
        EventBus.on(COMBAT_EVENTS.ERROR.SHOW, this.handleErrorShow, this);
    }

    destroy() {
        EventBus.off(COMBAT_EVENTS.INITIATIVE.ROLLED, this.handleInitiativeRolled, this);
        EventBus.off(COMBAT_EVENTS.INITIATIVE.TURN_CHANGED, this.handleTurnChanged, this);
        EventBus.off(COMBAT_EVENTS.ABILITY.SELECT_REQUESTED, this.handleAbilitySelectRequested, this);
        EventBus.off(COMBAT_EVENTS.HEALTH.PARTY_UPDATED, this.handlePartyHealthUpdated, this);
        EventBus.off(COMBAT_EVENTS.HEALTH.DAMAGE_TAKEN, this.handleDamageTaken, this);
        EventBus.off(COMBAT_EVENTS.HEALTH.HEAL_RECEIVED, this.handleHealReceived, this);
        EventBus.off(COMBAT_EVENTS.TARGET.ENEMY_TARGETING, this.handleEnemyTargeting, this);
        EventBus.off(COMBAT_EVENTS.TARGET.TARGET_CLEARED, this.handleTargetCleared, this);
        EventBus.off(COMBAT_EVENTS.ENEMY.STATUS_UPDATED, this.handleEnemyStatusUpdated, this);
        EventBus.off(COMBAT_EVENTS.ENEMY.DAMAGE_FLASH, this.handleEnemyDamageFlash, this);
        EventBus.off(COMBAT_EVENTS.DICE.ROLL_REQUESTED, this.handleDiceRollRequested, this);
        EventBus.off(COMBAT_EVENTS.NARRATION.SHOW, this.handleNarrationShow, this);
        EventBus.off(COMBAT_EVENTS.ERROR.SHOW, this.handleErrorShow, this);
    }

    // Handlers
    handleInitiativeRolled({ order, currentIndex }) {
        this.scene.initiativeTracker?.update(order, currentIndex);
    }

    handleTurnChanged({ order, currentIndex }) {
        this.scene.initiativeTracker?.update(order, currentIndex);
        // Highlight enemy display when it's their turn
        if (order && order[currentIndex]) {
            const current = order[currentIndex];
            if (current.type === 'enemy') {
                this.scene.enemyDisplay?.highlight(true);
            } else {
                this.scene.enemyDisplay?.highlight(false);
            }
        }
    }

    handleAbilitySelectRequested({ character, abilities, onSelect }) {
        this.scene.choicePanel.hide();
        this.scene.characterSelectPanel.hide();
        this.scene.abilityPanel.showAbilities(character, abilities, onSelect, null);
    }

    handlePartyHealthUpdated({ party }) {
        this.scene.healthDisplay?.updateParty(party);
    }

    handleDamageTaken({ targetId }) {
        this.scene.healthDisplay?.flashDamage(targetId);
    }

    handleHealReceived({ targetId }) {
        this.scene.healthDisplay?.glowHeal(targetId);
    }

    handleEnemyTargeting({ targetId }) {
        // Spotlight removed - could add visual indicator in future
    }

    handleTargetCleared() {
        // Spotlight removed - could add visual indicator in future
    }

    handleEnemySpawned({ enemy, name }) {
        if (this.scene.enemyDisplay) {
            this.scene.enemyDisplay.setEnemy(enemy, name);
            this.scene.enemyDisplay.setVisible(true);
        }
    }

    handleEnemyStatusUpdated({ enemy }) {
        this.scene.enemyDisplay?.updateStatus(enemy);
    }

    handleEnemyDamageFlash() {
        this.scene.enemyDisplay?.flashDamage();
    }

    handleDiceRollRequested(config) {
        this.scene.characterSelectPanel.hide();
        this.scene.abilityPanel.hide();

        this.scene.scene.launch('DiceScene', {
            stat: config.stat,
            statName: config.stat.charAt(0).toUpperCase() + config.stat.slice(1),
            bonus: config.bonus,
            difficulty: config.difficulty || 'normal',
            actorName: config.actorName,
            onComplete: config.onComplete
        });
    }

    handleNarrationShow({ text, speaker, onContinue }) {
        EventBus.emit(DIALOGUE_EVENTS.SHOW, { text, speaker, onContinue });
    }

    handleErrorShow({ message, onRetry }) {
        this.scene.combatErrorDialog.show(message, onRetry);
    }
}
