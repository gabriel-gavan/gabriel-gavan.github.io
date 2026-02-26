/**
 * CombatManager - Orchestrates ability-based combat
 *
 * Per CONTRIBUTING.md: Delegates to focused modules:
 * - CombatFlow: State machine, initiative, turns
 * - CombatNarrator: Context building for AI
 * - CombatRules: Pure math calculations
 * - CombatAI: AI decision making and narration
 * - TargetResolver: Target resolution
 */

import { CombatAI } from './CombatAI.js';
import { TargetResolver } from './TargetResolver.js';
import { CombatFlow, COMBAT_PHASES } from './CombatFlow.js';
import { CombatNarrator } from './CombatNarrator.js';
import { EventBus } from '../../events/EventBus.js';
import { COMBAT_EVENTS } from '../../events/CombatEvents.js';
import { SCENE_EVENTS } from '../../events/SceneEvents.js';
import { CHARACTER_STATUS, COMBAT } from '../../constants/GameConstants.js';
import { calculateAbilityDamage, attemptBreakFree, getHealthStatus } from '../rules/CombatRules.js';
import { getDamageModifier } from '../rules/DamageRules.js';
import { manifest } from '../../manifest.js';

// Re-export COMBAT_PHASES for backward compatibility
export { COMBAT_PHASES };

export class CombatManager {
    /**
     * @param {Phaser.Scene} scene - The AdventureScene instance
     * @param {GameState} gameState - Game state manager
     * @param {ChatManager} chatManager - AI service for narration
     */
    constructor(scene, gameState, chatManager) {
        this.scene = scene;
        this.gameState = gameState;

        // Delegate to focused modules
        this.ai = new CombatAI(chatManager);
        this.targetResolver = new TargetResolver();
        this.flow = new CombatFlow(gameState);
        this.narrator = new CombatNarrator(gameState);

        // Combat data
        this.enemyData = null;
        this.sceneConfig = null;

        // Current turn state
        this.selectedCharacter = null;
        this.selectedAbility = null;
        this.lastEnemyAction = null;

        // Wire up phase change callback
        this.flow.onPhaseChange = (phase) => this.onPhaseChange?.(phase);

        // Callbacks for scene integration
        this.onPhaseChange = null;
        this.onNarration = null;
        this.onError = null;
    }

    // Expose phase for external access
    get phase() {
        return this.flow.getPhase();
    }

    get initiativeOrder() {
        return this.flow.initiativeOrder;
    }

    get currentTurnIndex() {
        return this.flow.currentTurnIndex;
    }

    /**
     * Get narrator speaker name from manifest for content-agnostic theming
     */
    get narratorLabel() {
        return manifest.ui?.labels?.narrator || 'Narrator';
    }

    /**
     * Start combat from scene data
     * @param {Object} combatConfig - Combat scene configuration
     */
    async startCombat(combatConfig) {
        this.sceneConfig = combatConfig;
        this.enemyData = this.gameState.enemiesData[combatConfig.enemyId];

        if (!this.enemyData) {
            console.error(`Enemy not found: ${combatConfig.enemyId}`);
            return;
        }

        // Initialize combat state if needed
        if (!this.gameState.combat) {
            this.gameState.initCombat(combatConfig.enemyId);
        }

        // Show opening narration
        this.flow.setPhase(COMBAT_PHASES.INITIALIZING);

        EventBus.emit(COMBAT_EVENTS.ENEMY.SPAWNED, {
            enemy: this.gameState.combat.enemy,
            name: this.enemyData.shortName
        });

        await this.showNarration(combatConfig.openingNarration, this.enemyData.shortName);

        // Roll initiative
        this.flow.rollAllInitiative(this.gameState.getActiveParty(), this.enemyData);

        // Announce initiative - read labels from manifest for content-agnostic theming
        const initiativeHeader = manifest.ui?.labels?.initiativeHeader || '⚔️ INITIATIVE ORDER ⚔️';
        await this.showNarration(
            `${initiativeHeader}\n${this.flow.getInitiativeOrderText()}`,
            this.narratorLabel
        );
        this.flow.emitInitiativeRolled();

        // Start first turn
        await this.nextTurn();
    }

    /**
     * Process next turn in initiative order
     */
    async nextTurn() {
        if (this.flow.isRoundComplete()) {
            await this.endRound();
            return;
        }

        const current = this.flow.getCurrentCombatant();

        EventBus.emit(COMBAT_EVENTS.INITIATIVE.TURN_CHANGED, {
            order: this.flow.initiativeOrder,
            currentIndex: this.flow.currentTurnIndex
        });

        if (current.type === 'enemy') {
            await this.runEnemyTurn();
        } else {
            await this.runPartyMemberTurn(current.id);
        }
    }

    /**
     * Run a party member's turn
     */
    async runPartyMemberTurn(characterId) {
        const character = this.gameState.party.find(p => p.id === characterId);

        if (!character || character.status === CHARACTER_STATUS.DOWN) {
            const fallbackName = manifest.ui?.labels?.unknownCharacter || 'A party member';
            const unconsciousText = manifest.ai?.fallbackNarration?.unconscious || 'is unconscious and cannot act';
            await this.showNarration(
                `${character?.name || fallbackName} ${unconsciousText}!`,
                this.narratorLabel
            );
            this.flow.advanceTurn();
            await this.nextTurn();
            return;
        }

        // Check restraints
        if (this.gameState.isCharacterRestrained(characterId)) {
            await this.processRestrainedCharacter(character);
            if (this.gameState.isCharacterRestrained(characterId)) {
                this.flow.advanceTurn();
                await this.nextTurn();
                return;
            }
        }

        // Set up turn
        this.selectedCharacter = character;
        this.flow.setPhase(COMBAT_PHASES.PLAYER_ABILITY_SELECT);

        const abilities = this.gameState.getAvailableAbilities(character.id);

        EventBus.emit(COMBAT_EVENTS.ABILITY.SELECT_REQUESTED, {
            character,
            abilities,
            onSelect: (ability) => this.onAbilitySelected(ability)
        });
    }

    /**
     * Process restrained character's break-free attempt
     */
    async processRestrainedCharacter(character) {
        const brawnBonus = character.stats?.brawn || 0;
        const result = attemptBreakFree(brawnBonus);

        // Get fallback narration from manifest (content-agnostic)
        const fallback = manifest.ai?.fallbackNarration || {};
        const successText = fallback.breakFreeSuccess || 'breaks free from the restraints';
        const failureText = fallback.breakFreeFailure || 'struggles against the restraints but remains trapped';

        if (result.success) {
            this.gameState.removeRestrainFromCharacter(character.id);
            await this.showNarration(
                `${character.name} ${successText}! (Rolled ${result.roll}+${result.bonus}=${result.total})`,
                this.narratorLabel
            );
        } else {
            await this.showNarration(
                `${character.name} ${failureText}! (Rolled ${result.roll}+${result.bonus}=${result.total}, needed ${COMBAT.BREAKFREE_DC})`,
                this.narratorLabel
            );
        }

        EventBus.emit(COMBAT_EVENTS.HEALTH.PARTY_UPDATED, { party: this.gameState.party });
    }

    // ========================================
    // Enemy Turn
    // ========================================

    async runEnemyTurn() {
        if (this.flow.checkVictory()) {
            await this.handleVictory();
            return;
        }

        this.flow.setPhase(COMBAT_PHASES.ENEMY_DECIDING);

        try {
            const decision = await this.ai.getEnemyDecision(
                this.enemyData,
                this.gameState.combat,
                this.gameState.party
            );

            this.lastEnemyAction = decision;

            // Resolve target
            const resolvedTarget = this.resolveTarget(decision.target);
            let targetName = this.getTargetName(resolvedTarget);

            // Spotlight target
            this.emitTargetSpotlight(resolvedTarget);

            // Get narration
            this.flow.setPhase(COMBAT_PHASES.ENEMY_NARRATION);

            const attack = this.enemyData.attacks.find(a => a.id === decision.action_id);
            const damageContext = attack
                ? this.narrator.buildEnemyDamageContext(attack, resolvedTarget, this.isAOETarget.bind(this))
                : {};
            const combatContext = {
                ...this.narrator.buildCombatContext(),
                ...damageContext
            };

            const narration = await this.ai.getEnemyActionNarration(
                this.enemyData,
                decision,
                this.gameState.party,
                targetName,
                combatContext
            );

            await this.showNarration(narration, this.enemyData.shortName);

            // Resolve action
            this.flow.setPhase(COMBAT_PHASES.ENEMY_RESOLUTION);
            await this.resolveEnemyAction(decision);

            // Wait for animation
            await this.waitForAnimationComplete('enemy');

            EventBus.emit(COMBAT_EVENTS.TARGET.TARGET_CLEARED);

            if (this.flow.checkDefeat()) {
                await this.handleDefeat();
                return;
            }

            // Companion turn
            if (this.gameState.combat.companion?.active) {
                await this.runCompanionTurn();
                if (this.flow.checkDefeat()) {
                    await this.handleDefeat();
                    return;
                }
            }

            this.flow.advanceTurn();
            await this.nextTurn();

        } catch (error) {
            console.error('Enemy turn error:', error);
            this.handleError('Enemy turn failed. Please try again.', () => this.runEnemyTurn());
        }
    }

    /**
     * Resolve enemy action effects
     */
    async resolveEnemyAction(decision) {
        if (!decision.action_id) return;

        const attack = this.enemyData.attacks.find(a => a.id === decision.action_id);
        if (!attack) return;

        // Emit action event for animation
        EventBus.emit(COMBAT_EVENTS.ACTION.EXECUTED, {
            actorId: 'enemy',
            abilityId: attack.id,
            actionType: 'attack'
        });

        const resolved = this.resolveTarget(decision.target);
        if (!resolved) return;

        const targets = this.isAOETarget(resolved) ? resolved : [resolved];
        const targetNames = [];

        for (const target of targets) {
            if (!target) continue;
            targetNames.push(target.name);

            if (attack.damage) {
                const modifier = getDamageModifier(this.gameState.combat, target.id, false);
                const finalDamage = Math.max(0, attack.damage + modifier);
                if (finalDamage > 0) {
                    this.gameState.applyDamage(target.id, finalDamage);
                    EventBus.emit(COMBAT_EVENTS.HEALTH.DAMAGE_TAKEN, { 
                        targetId: target.id, 
                        amount: finalDamage,
                        type: 'damage' 
                    });
                }
            }

            if (attack.effect) {
                this.gameState.applyEffectToCharacter(target.id, attack.effect);
            }

            if (attack.bonusEffect?.damage) {
                this.gameState.applyDamage(target.id, attack.bonusEffect.damage);
            }
        }

        EventBus.emit(COMBAT_EVENTS.HEALTH.PARTY_UPDATED, { party: this.gameState.party });

        if (attack.cooldown && this.gameState.combat?.enemy?.cooldowns) {
            this.gameState.combat.enemy.cooldowns[attack.id] = attack.cooldown;
        }

        this.gameState.addCombatLogEntry({
            actor: 'enemy',
            action: attack.name,
            target: targetNames.join(', '),
            damage: attack.damage || 0
        });

        EventBus.emit(COMBAT_EVENTS.ENEMY.STATUS_UPDATED, { enemy: this.gameState.combat.enemy });
    }

    // ========================================
    // Player Ability Selection
    // ========================================

    async onAbilitySelected(ability) {
        this.selectedAbility = ability;
        this.proceedToRoll(ability);
    }

    proceedToRoll(ability) {
        this.flow.setPhase(COMBAT_PHASES.PLAYER_ROLLING);

        if (ability.uses !== undefined) {
            this.gameState.useAbility(this.selectedCharacter.id, ability.id);
        }

        const statBonus = this.selectedCharacter.stats[ability.stat] || 0;

        EventBus.emit(COMBAT_EVENTS.DICE.ROLL_REQUESTED, {
            stat: ability.stat,
            bonus: statBonus,
            difficulty: ability.difficulty || 'normal',
            actorName: this.selectedCharacter.name,
            abilityName: ability.name,
            onComplete: (result) => this.onDiceResult(result)
        });
    }

    async onDiceResult(result) {
        this.flow.setPhase(COMBAT_PHASES.PLAYER_RESOLUTION);

        try {
            const damageContext = this.narrator.buildPlayerDamageContext(this.selectedAbility, result);
            const combatContext = {
                ...this.narrator.buildCombatContext(),
                ...damageContext,
                ...this.narrator.buildCharacterContext(this.selectedCharacter)
            };

            const narration = await this.ai.getPlayerOutcomeNarration(
                this.selectedCharacter,
                this.selectedAbility,
                result,
                this.enemyData,
                combatContext
            );

            await this.showNarration(narration, this.narratorLabel);
            await this.resolvePlayerAction(result);

            // Wait for animation
            await this.waitForAnimationComplete(this.selectedCharacter.id);

            this.gameState.addCombatLogEntry({
                actor: this.selectedCharacter.id,
                action: this.selectedAbility.name,
                result: result.tier,
                damage: calculateAbilityDamage(this.selectedAbility, result.tier)
            });

            if (this.flow.checkVictory()) {
                await this.handleVictory();
                return;
            }

            this.flow.advanceTurn();
            await this.nextTurn();

        } catch (error) {
            console.error('Player resolution error:', error);
            this.handleError('Action failed. Please try again.', () => {
                if (this.selectedAbility?.uses !== undefined && this.selectedCharacter) {
                    const usage = this.gameState.combat?.abilityUsage?.[this.selectedCharacter.id];
                    if (usage && usage[this.selectedAbility.id] > 0) {
                        usage[this.selectedAbility.id]--;
                    }
                }
                this.runPartyMemberTurn(this.selectedCharacter.id);
            });
        }
    }

    async resolvePlayerAction(result) {
        const ability = this.selectedAbility;

        // Emit action event for animation
        EventBus.emit(COMBAT_EVENTS.ACTION.EXECUTED, {
            actorId: this.selectedCharacter.id,
            abilityId: ability.id,
            actionType: 'attack'
        });

        if (ability.damage && result.tier !== 'failure') {
            const baseDamage = calculateAbilityDamage(ability, result.tier);
            const modifier = getDamageModifier(this.gameState.combat, 'enemy', true);
            const markBonus = this.gameState.consumeMarkOnEnemy();
            const finalDamage = Math.max(0, baseDamage + modifier + markBonus);

            if (finalDamage > 0) {
                this.gameState.applyDamageToEnemy(finalDamage);
                EventBus.emit(COMBAT_EVENTS.ENEMY.DAMAGE_FLASH, { amount: finalDamage });
                EventBus.emit(COMBAT_EVENTS.ENEMY.STATUS_UPDATED, { enemy: this.gameState.combat.enemy });
            }

            await this.checkEnemyTriggers();
        }

        if (ability.effect?.type === 'heal') {
            const healAmount = result.tier === 'critical'
                ? ability.effect.amount + 1
                : ability.effect.amount;

            if (ability.targetType === 'self') {
                this.gameState.applyHeal(this.selectedCharacter.id, healAmount);
                EventBus.emit(COMBAT_EVENTS.HEALTH.HEAL_RECEIVED, { 
                    targetId: this.selectedCharacter.id,
                    amount: healAmount,
                    type: 'heal'
                });
            } else if (ability.targetType === 'party') {
                for (const member of this.gameState.getActiveParty()) {
                    this.gameState.applyHeal(member.id, healAmount);
                    EventBus.emit(COMBAT_EVENTS.HEALTH.HEAL_RECEIVED, { 
                        targetId: member.id,
                        amount: healAmount,
                        type: 'heal'
                    });
                }
            }

            EventBus.emit(COMBAT_EVENTS.HEALTH.PARTY_UPDATED, { party: this.gameState.party });
        }

        if (ability.effect && ability.effect.type !== 'heal') {
            if (ability.targetType === 'enemy') {
                this.gameState.applyEffectToEnemy(ability.effect);
            } else if (ability.targetType === 'party' || ability.targetType === 'area') {
                this.gameState.applyPartyEffect(ability.effect);
            }
        }
    }

    // ========================================
    // Triggered Abilities
    // ========================================

    async checkEnemyTriggers() {
        const specialAbilities = this.enemyData.specialAbilities || [];
        if (specialAbilities.length === 0) return;

        const usedSpecials = this.gameState.combat.enemy.usedSpecials || {};
        const healthPercent = this.gameState.combat.enemy.currentHealth /
                              this.gameState.combat.enemy.maxHealth;

        for (const ability of specialAbilities) {
            if (usedSpecials[ability.id]) continue;

            const trigger = ability.trigger;
            if (!trigger) continue;

            let shouldTrigger = false;
            if (trigger.type === 'health_below' &&
                healthPercent <= trigger.threshold &&
                this.gameState.combat.enemy.currentHealth > 0) {
                shouldTrigger = true;
            }

            if (shouldTrigger) {
                usedSpecials[ability.id] = true;
                this.gameState.combat.enemy.usedSpecials = usedSpecials;
                await this.activateEnemySpecial(ability);
            }
        }
    }

    async activateEnemySpecial(ability) {
        const narration = await this.ai.getEnemySpecialNarration(this.enemyData, ability);
        await this.showNarration(narration, this.enemyData.shortName);

        if (ability.effect) {
            if (ability.effect.type === 'damage_reduction') {
                this.gameState.applyEffectToEnemy(ability.effect);
            } else if (ability.effect.type === 'transform') {
                const healthBoost = ability.effect.healthBoost || 0;
                this.gameState.combat.enemy.currentHealth += healthBoost;
                this.gameState.combat.enemy.maxHealth += healthBoost;

                const status = getHealthStatus(
                    this.gameState.combat.enemy.currentHealth,
                    this.gameState.combat.enemy.maxHealth
                );
                this.gameState.combat.enemy.status = status;
                this.gameState.combat.enemy.transformed = ability.effect.form;
            }
        }

        EventBus.emit(COMBAT_EVENTS.ENEMY.STATUS_UPDATED, { enemy: this.gameState.combat.enemy });
    }

    // ========================================
    // Companion System
    // ========================================

    async runCompanionTurn() {
        const companion = this.enemyData.companion;
        if (!companion || !this.gameState.combat.companion?.active) return;

        const attack = companion.attacks[Math.floor(Math.random() * companion.attacks.length)];
        if (!attack) return;

        const resolved = this.resolveTarget(attack.targeting || 'random');
        if (!resolved) return;

        const targetName = this.getTargetName(resolved);
        this.emitTargetSpotlight(resolved);

        const damageContext = this.narrator.buildCompanionDamageContext(attack, resolved, this.isAOETarget.bind(this));
        const context = {
            ...this.narrator.buildCombatContext(),
            ...damageContext
        };

        const narration = await this.ai.getCompanionNarration(companion, attack, targetName, context);
        await this.showNarration(narration, companion.name);

        await this.resolveCompanionAction(companion, attack, resolved);
        
        // No visual animation for companion yet, so no wait needed
        // await this.waitForAnimationComplete('companion');

        EventBus.emit(COMBAT_EVENTS.TARGET.TARGET_CLEARED);
    }

    async resolveCompanionAction(companion, attack, resolved) {
        const targets = this.isAOETarget(resolved) ? resolved : [resolved];

        for (const target of targets) {
            if (!target) continue;

            if (attack.damage) {
                const modifier = getDamageModifier(this.gameState.combat, target.id, false);
                const finalDamage = Math.max(0, attack.damage + modifier);
                if (finalDamage > 0) {
                    this.gameState.applyDamage(target.id, finalDamage);
                    EventBus.emit(COMBAT_EVENTS.HEALTH.DAMAGE_TAKEN, { 
                        targetId: target.id, 
                        amount: finalDamage,
                        type: 'damage' 
                    });
                }
            }

            if (attack.effect) {
                this.gameState.applyEffectToCharacter(target.id, attack.effect);
            }
        }

        EventBus.emit(COMBAT_EVENTS.HEALTH.PARTY_UPDATED, { party: this.gameState.party });

        const targetNames = targets.map(t => t?.name).filter(Boolean);
        this.gameState.addCombatLogEntry({
            actor: companion.name,
            action: attack.name,
            target: targetNames.join(', '),
            damage: attack.damage || 0
        });
    }

    // ========================================
    // Round Management
    // ========================================

    async endRound() {
        const round = this.flow.startNewRound();
        // Read round transition template from manifest for content-agnostic theming
        const roundTemplate = manifest.ui?.labels?.roundTransition || '--- ROUND {round} ---';
        const roundText = roundTemplate.replace('{round}', round);
        await this.showNarration(roundText, this.narratorLabel);
        await this.nextTurn();
    }

    // ========================================
    // End Conditions
    // ========================================

    async handleVictory() {
        this.flow.setPhase(COMBAT_PHASES.COMBAT_END);

        await new Promise(resolve => {
            EventBus.emit(COMBAT_EVENTS.SCENE.VICTORY, { onComplete: resolve });
        });

        this.flow.endCombat();
        EventBus.emit('system.combat.end');
        EventBus.emit(SCENE_EVENTS.LOAD_REQUESTED, { sceneId: this.sceneConfig.victoryScene });
    }

    async handleDefeat() {
        this.flow.setPhase(COMBAT_PHASES.COMBAT_END);
        this.flow.endCombat();
        EventBus.emit('system.combat.end');
        EventBus.emit(SCENE_EVENTS.LOAD_REQUESTED, { sceneId: this.sceneConfig.defeatScene });
    }

    // ========================================
    // Utilities
    // ========================================

    /**
     * Wait for visual animation to complete
     * @param {string} actorId - ID of actor to wait for (optional filter)
     */
    async waitForAnimationComplete(actorId = null) {
        return new Promise(resolve => {
            const timeout = this.scene.time.delayedCall(3000, () => {
                cleanup();
                resolve();
            });

            const handler = (payload) => {
                if (actorId && payload?.actorId && payload.actorId !== actorId) return;
                cleanup();
                resolve();
            };

            const cleanup = () => {
                EventBus.off(COMBAT_EVENTS.ACTION.ANIMATION_COMPLETE, handler);
                timeout.remove();
            };

            EventBus.on(COMBAT_EVENTS.ACTION.ANIMATION_COMPLETE, handler);
        });
    }

    resolveTarget(targetStr) {
        return this.targetResolver.resolve(
            targetStr,
            this.gameState.party,
            this.gameState.getActiveParty()
        );
    }

    isAOETarget(target) {
        return this.targetResolver.isAOE(target);
    }

    getTargetName(resolvedTarget) {
        // Use party terms from manifest for content-agnostic theming
        const partyTerms = manifest.ai?.partyTerms || {};
        const plural = partyTerms.plural || 'party members';
        const singular = partyTerms.singular || 'a party member';

        if (this.isAOETarget(resolvedTarget)) {
            return `the ${plural}`;
        }
        return resolvedTarget?.name || singular;
    }

    emitTargetSpotlight(resolvedTarget) {
        if (this.isAOETarget(resolvedTarget)) {
            const lowestHp = resolvedTarget.reduce((min, p) =>
                p.currentHealth < min.currentHealth ? p : min, resolvedTarget[0]);
            EventBus.emit(COMBAT_EVENTS.TARGET.ENEMY_TARGETING, { 
                targetId: lowestHp.id,
                target: lowestHp 
            });
        } else if (resolvedTarget) {
            EventBus.emit(COMBAT_EVENTS.TARGET.ENEMY_TARGETING, { 
                targetId: resolvedTarget.id,
                target: resolvedTarget
            });
        }
    }

    async showNarration(text, speaker = null) {
        if (!text || !text.trim()) return;

        return new Promise((resolve) => {
            EventBus.emit(COMBAT_EVENTS.NARRATION.SHOW, {
                text,
                speaker,
                onContinue: resolve
            });
        });
    }

    handleError(message, onRetry) {
        this.onError?.(message, onRetry);
        EventBus.emit(COMBAT_EVENTS.ERROR.SHOW, { message, onRetry });
    }

    getCombatSummary() {
        const combat = this.gameState.combat;
        if (!combat) return null;

        return {
            round: combat.round,
            phase: this.phase,
            enemy: {
                name: this.enemyData?.shortName,
                health: `${combat.enemy.currentHealth}/${combat.enemy.maxHealth}`,
                status: combat.enemy.status
            },
            party: this.gameState.party.map(p => ({
                name: p.name,
                health: `${p.currentHealth}/${p.maxHealth}`,
                status: p.status
            }))
        };
    }
}
