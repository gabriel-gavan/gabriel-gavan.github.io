import { EventBus } from '../../events/EventBus.js';
import { SCENE_EVENTS, DIALOGUE_EVENTS, CHOICE_EVENTS } from '../../events/SceneEvents.js';
import { COMBAT_EVENTS } from '../../events/CombatEvents.js';
import { OutcomeProcessor } from './OutcomeProcessor.js';

import { CHARACTER_STATUS } from '../../constants/GameConstants.js';

/**
 * SceneSystem - Manages game flow, narrative, and choices
 * 
 * Responsibilities:
 * - Loads scene data
 * - Determines scene type (Narrative vs Combat)
 * - Processes choices and outcomes
 * - Emits events for UI updates
 */
export class SceneSystem {
    constructor(gameState) {
        this.gameState = gameState;
        this.currentSceneData = null;
        this.actingCharacter = null;
        this.spotlightCharacter = null;
        
        this.outcomeProcessor = new OutcomeProcessor(gameState, this);

        this.setupListeners();
    }

    setupListeners() {
        // Listen for scene load requests (e.g. from DebugPanel or CombatManager)
        EventBus.on(SCENE_EVENTS.LOAD_REQUESTED, this.handleLoadRequest, this);
        EventBus.on(CHOICE_EVENTS.SELECTED, this.handleChoiceSelected, this);
        EventBus.on(COMBAT_EVENTS.SCENE.VICTORY, this.handleVictoryMoment, this);
    }

    destroy() {
        EventBus.off(SCENE_EVENTS.LOAD_REQUESTED, this.handleLoadRequest, this);
        EventBus.off(CHOICE_EVENTS.SELECTED, this.handleChoiceSelected, this);
        EventBus.off(COMBAT_EVENTS.SCENE.VICTORY, this.handleVictoryMoment, this);
    }

    async handleLoadRequest({ sceneId }) {
        await this.loadScene(sceneId);
    }

    async loadScene(sceneId) {
        const sceneData = await this.gameState.loadScene(sceneId);
        if (!sceneData) return null;

        this.currentSceneData = sceneData;
        EventBus.emit(SCENE_EVENTS.LOADED, { sceneData });

        // Update visuals
        EventBus.emit(SCENE_EVENTS.BACKGROUND_CHANGED, { background: sceneData.background });
        
        // Update audio
        EventBus.emit(SCENE_EVENTS.MUSIC_CHANGED, { music: sceneData.music });

        const isCombat = sceneData.type === 'combat' && sceneData.combat;

        if (isCombat) {
            // Combat Scene
            EventBus.emit(SCENE_EVENTS.COMBAT_MODE_CHANGED, { enabled: true, combatData: sceneData.combat, animate: true });
            
            // Delay combat start slightly for transition
            setTimeout(() => {
                // Initialize combat via GameState if not already done
                if (!this.gameState.combat) {
                    this.gameState.initCombat(sceneData.combat.enemyId);
                }
                
                EventBus.emit('system.combat.start', { combatConfig: sceneData.combat });
            }, 400);

        } else {
            // Narrative Scene
            EventBus.emit(SCENE_EVENTS.COMBAT_MODE_CHANGED, { enabled: false });
            
            EventBus.emit(DIALOGUE_EVENTS.SHOW, {
                text: sceneData.openingText,
                speaker: sceneData.speaker,
                onContinue: () => this.handleNarrativeContinue(sceneData)
            });
        }
    }

    handleNarrativeContinue(sceneData) {
        if (sceneData.choices && sceneData.choices.length > 0) {
            // Scene has choices
            this.showChoices(sceneData.choices);
        } else if (sceneData.nextScene) {
            // Simple transition
            this.loadScene(sceneData.nextScene);
        } else if (sceneData.isEnding) {
            // Ending scene
            EventBus.emit(SCENE_EVENTS.END_SCREEN);
        }
    }

    showChoices(choices) {
        // Filter out choices where acting character is down
        const availableChoices = choices.filter(choice => {
            if (!choice.character) return true;
            const member = this.gameState.party.find(m => m.id === choice.character);
            if (!member) return true;
            return member.status !== CHARACTER_STATUS.DOWN;
        });

        if (availableChoices.length === 0) {
            console.warn('[SceneSystem] All characters are down - showing all choices anyway');
            EventBus.emit(CHOICE_EVENTS.SHOW_OPTIONS, { choices: choices });
        } else {
            EventBus.emit(CHOICE_EVENTS.SHOW_OPTIONS, { choices: availableChoices });
        }
    }

    handleChoiceSelected({ choice }) {
        // Check for stat check
        if (choice.stat) {
            this.handleStatCheck(choice);
        } else {
            this.resolveChoice(choice, 'success');
        }
    }

    handleStatCheck(choice) {
        const actorId = choice.character || this.gameState.party[0].id;
        const actor = this.gameState.party.find(m => m.id === actorId);

        if (!actor) {
            console.error('Actor not found:', actorId);
            this.resolveChoice(choice, 'failure');
            return;
        }

        const statBonus = actor.stats?.[choice.stat] || 0;
        this.actingCharacter = actorId;

        // Request dice roll (handled by DiceScene/AdventureScene)
        EventBus.emit(COMBAT_EVENTS.DICE.ROLL_REQUESTED, {
            stat: choice.stat,
            statName: choice.stat.charAt(0).toUpperCase() + choice.stat.slice(1),
            bonus: statBonus,
            difficulty: choice.difficulty || 'normal',
            actorName: actor.name,
            onComplete: (result) => {
                this.handleDiceResult(choice, result);
            }
        });
    }

    handleDiceResult(choice, result) {
        const tier = this.findBestOutcomeTier(choice.outcomes, result.tier);
        this.gameState.recordChoice(choice.id, tier, result);
        this.resolveChoice(choice, tier);
    }

    findBestOutcomeTier(outcomes, tier) {
        if (!outcomes || typeof outcomes !== 'object') return 'failure';

        const tierFallbacks = {
            critical: ['critical', 'success'],
            success: ['success', 'partial', 'critical'],
            partial: ['partial', 'failure', 'success'],
            failure: ['failure', 'partial']
        };

        const fallbacks = tierFallbacks[tier] || ['success'];
        for (const t of fallbacks) {
            if (outcomes[t]) return t;
        }

        const keys = Object.keys(outcomes);
        return keys.length > 0 ? keys[0] : 'failure';
    }

    resolveChoice(choice, tier) {
        const outcome = choice.outcomes[tier] || choice.outcomes.success || Object.values(choice.outcomes)[0];

        if (!outcome) {
            console.error('No outcome defined for choice:', choice.id);
            return;
        }

        // Emit outcome event for character animation
        EventBus.emit('scene.choice.outcome', {
            tier,
            character: choice.character,
            outcome
        });

        // Show outcome narration
        EventBus.emit(DIALOGUE_EVENTS.SHOW, {
            text: outcome.text,
            speaker: outcome.speaker,
            onContinue: () => this.processOutcomeEffects(outcome)
        });
    }

    processOutcomeEffects(outcome) {
        this.outcomeProcessor.process(outcome, this.currentSceneData);
    }

    resolveTarget(target) {
        if (target === 'self' || target === 'acting') {
            return this.actingCharacter || this.gameState.party[0].id;
        }
        if (target === 'spotlight') {
            return this.spotlightCharacter || this.gameState.party[0].id;
        }
        return target;
    }

    handleVictoryMoment({ onComplete }) {
        EventBus.emit(SCENE_EVENTS.VICTORY_MOMENT, { onComplete });
    }
}
