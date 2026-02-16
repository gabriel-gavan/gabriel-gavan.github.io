import { EventBus } from '../../events/EventBus.js';
import { SCENE_EVENTS } from '../../events/SceneEvents.js';
import { COMBAT_EVENTS } from '../../events/CombatEvents.js';
import { manifest } from '../../manifest.js';

/**
 * OutcomeProcessor - Handles the application of choice outcomes
 * 
 * Responsibilities:
 * - Applies damage/healing effects
 * - Updates flags
 * - Manages scene transitions and navigation
 * - Handles special conditions (Party Wipe, Ending)
 */
export class OutcomeProcessor {
    constructor(gameState, sceneSystem) {
        this.gameState = gameState;
        this.sceneSystem = sceneSystem;
    }

    process(outcome, currentSceneData) {
        // Damage
        if (outcome.damage) {
            const targetId = this.sceneSystem.resolveTarget(outcome.damage.target);
            this.gameState.applyDamage(targetId, outcome.damage.amount);
            EventBus.emit(COMBAT_EVENTS.HEALTH.DAMAGE_TAKEN, { targetId });
        }

        // Multi-target damage
        if (outcome.damage_list) {
            outcome.damage_list.forEach(dmg => {
                const targetId = this.sceneSystem.resolveTarget(dmg.target);
                this.gameState.applyDamage(targetId, dmg.amount);
                EventBus.emit(COMBAT_EVENTS.HEALTH.DAMAGE_TAKEN, { targetId });
            });
        }

        // Healing
        if (outcome.heal) {
            const targetId = this.sceneSystem.resolveTarget(outcome.heal.target);
            this.gameState.applyHeal(targetId, outcome.heal.amount);
            EventBus.emit(COMBAT_EVENTS.HEALTH.HEAL_RECEIVED, { targetId });
        }

        // Update party UI if needed
        if (outcome.damage || outcome.damage_list || outcome.heal) {
            EventBus.emit(COMBAT_EVENTS.HEALTH.PARTY_UPDATED, { party: this.gameState.party });
        }

        // Flags
        if (outcome.setFlag) {
            this.gameState.setFlag(outcome.setFlag);
        }

        // End Screen
        if (currentSceneData?.isEnding) {
            EventBus.emit(SCENE_EVENTS.END_SCREEN);
            return;
        }

        // Party Wipe - read fallback defeat scene from manifest for content-agnostic theming
        if (this.gameState.isPartyWiped()) {
            const defeatScene = manifest.defeatScene || 'epilogue_defeat';
            this.sceneSystem.loadScene(defeatScene);
            return;
        }

        // Navigation
        if (outcome.nextScene) {
            if (currentSceneData?.type === 'combat' && outcome.nextScene.includes('victory')) {
                // Handle via Victory Moment event
                EventBus.emit(SCENE_EVENTS.VICTORY_MOMENT, {
                    onComplete: () => this.sceneSystem.loadScene(outcome.nextScene)
                });
            } else {
                this.sceneSystem.loadScene(outcome.nextScene);
            }
            return;
        }

        // Remaining Choices
        const remaining = currentSceneData?.choices;
        if (remaining && remaining.length > 0) {
            this.sceneSystem.showChoices(remaining);
        }
    }
}
