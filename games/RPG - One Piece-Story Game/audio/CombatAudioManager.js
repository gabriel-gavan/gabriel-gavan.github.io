/**
 * CombatAudioManager - Handles combat audio event integration
 * 
 * Separates audio concerns from scene management.
 * Listens to combat events and triggers appropriate sounds.
 */

import { EventBus } from '../events/EventBus.js';
import { COMBAT_EVENTS } from '../events/CombatEvents.js';
import { getSoundEffects } from './SoundEffects.js';
import { AbilitySoundMapper, SOUND_TYPES } from './AbilitySoundMapper.js';

export class CombatAudioManager {
    constructor(gameState, combatManager) {
        this.gameState = gameState;
        this.combatManager = combatManager;
        this.soundEffects = getSoundEffects();
        
        // Track state to prevent duplicate sounds
        this.previousEnemyEffects = [];
        this.previousPartyEffects = new Map();
        
        this.setupListeners();
    }

    setupListeners() {
        // Enemy spawn
        EventBus.on(COMBAT_EVENTS.ENEMY.SPAWNED, this.onEnemySpawned, this);

        // Initiative rolls
        EventBus.on(COMBAT_EVENTS.INITIATIVE.ROLLED, this.onInitiativeRolled, this);

        // Damage and healing
        EventBus.on(COMBAT_EVENTS.HEALTH.DAMAGE_TAKEN, this.onDamageTaken, this);
        EventBus.on(COMBAT_EVENTS.ENEMY.DAMAGE_FLASH, this.onEnemyDamaged, this);
        EventBus.on(COMBAT_EVENTS.HEALTH.HEAL_RECEIVED, this.onHealReceived, this);

        // Actions
        EventBus.on(COMBAT_EVENTS.ACTION.EXECUTED, this.onActionExecuted, this);

        // Victory and defeat
        EventBus.on(COMBAT_EVENTS.SCENE.VICTORY, this.onVictory, this);
        EventBus.on('system.combat.end', this.onCombatEnd, this);

        // Effects
        EventBus.on(COMBAT_EVENTS.ENEMY.STATUS_UPDATED, this.onEnemyStatusUpdated, this);
        EventBus.on(COMBAT_EVENTS.HEALTH.PARTY_UPDATED, this.onPartyUpdated, this);
    }

    cleanup() {
        EventBus.off(COMBAT_EVENTS.ENEMY.SPAWNED, this.onEnemySpawned, this);
        EventBus.off(COMBAT_EVENTS.INITIATIVE.ROLLED, this.onInitiativeRolled, this);
        EventBus.off(COMBAT_EVENTS.HEALTH.DAMAGE_TAKEN, this.onDamageTaken, this);
        EventBus.off(COMBAT_EVENTS.ENEMY.DAMAGE_FLASH, this.onEnemyDamaged, this);
        EventBus.off(COMBAT_EVENTS.HEALTH.HEAL_RECEIVED, this.onHealReceived, this);
        EventBus.off(COMBAT_EVENTS.ACTION.EXECUTED, this.onActionExecuted, this);
        EventBus.off(COMBAT_EVENTS.SCENE.VICTORY, this.onVictory, this);
        EventBus.off('system.combat.end', this.onCombatEnd, this);
        EventBus.off(COMBAT_EVENTS.ENEMY.STATUS_UPDATED, this.onEnemyStatusUpdated, this);
        EventBus.off(COMBAT_EVENTS.HEALTH.PARTY_UPDATED, this.onPartyUpdated, this);
    }

    // Event Handlers

    onEnemySpawned() {
        this.soundEffects.playEnemySpawn();
    }

    onInitiativeRolled() {
        this.soundEffects.playInitiative();
    }

    onDamageTaken({ amount }) {
        this.soundEffects.playDamage(amount);
    }

    onEnemyDamaged({ amount }) {
        this.soundEffects.playDamage(amount);
    }

    onHealReceived() {
        this.soundEffects.playHeal();
    }

    onActionExecuted({ abilityId, actorId }) {
        const ability = this.getAbilityData(abilityId, actorId);
        const soundType = AbilitySoundMapper.getSoundTypeWithOverrides(abilityId, ability);

        switch (soundType) {
            case SOUND_TYPES.SPECIAL:
                this.soundEffects.playSpecialAbility();
                break;
            case SOUND_TYPES.RANGED:
                this.soundEffects.playRangedAttack();
                break;
            case SOUND_TYPES.MELEE:
            default:
                this.soundEffects.playMeleeAttack();
                break;
        }
    }

    onVictory() {
        this.soundEffects.playVictory();
    }

    onCombatEnd() {
        // Check if it's victory or defeat
        if (this.gameState.combat?.enemy?.currentHealth > 0) {
            this.soundEffects.playDefeat();
        }
        // Victory sound already played by onVictory
    }

    onEnemyStatusUpdated({ enemy }) {
        // Only play sound if new debuffs were added
        if (enemy?.effects?.length > 0) {
            const currentDebuffs = enemy.effects
                .filter(e => this.isDebuff(e.type))
                .map(e => e.type);
            
            const hasNewDebuff = currentDebuffs.some(type => 
                !this.previousEnemyEffects.includes(type)
            );
            
            if (hasNewDebuff) {
                this.soundEffects.playDebuff();
            }
            
            this.previousEnemyEffects = currentDebuffs;
        } else {
            this.previousEnemyEffects = [];
        }
    }

    onPartyUpdated({ party }) {
        // Only play sound if new buffs were added
        for (const member of party) {
            const currentBuffs = member.effects
                ?.filter(e => this.isBuff(e.type))
                .map(e => e.type) || [];
            
            const previousBuffs = this.previousPartyEffects.get(member.id) || [];
            const hasNewBuff = currentBuffs.some(type => 
                !previousBuffs.includes(type)
            );
            
            if (hasNewBuff) {
                this.soundEffects.playBuff();
                break; // Only play once per update
            }
            
            this.previousPartyEffects.set(member.id, currentBuffs);
        }
    }

    // Helper Methods

    getAbilityData(abilityId, actorId) {
        // Enemy ability
        if (actorId === 'enemy' && this.combatManager.enemyData) {
            return this.combatManager.enemyData.attacks?.find(a => a.id === abilityId);
        }
        
        // Player ability - search through character abilities
        const abilitiesData = this.gameState.abilitiesData;
        if (!abilitiesData) return null;
        
        for (const characterId in abilitiesData) {
            const charAbilities = abilitiesData[characterId];
            
            // Check basic attacks
            const basicAbility = charAbilities.basicAttacks?.find(a => a.id === abilityId);
            if (basicAbility) return basicAbility;

            // Check special abilities
            const specialAbility = charAbilities.specialAbilities?.find(a => a.id === abilityId);
            if (specialAbility) return specialAbility;
        }
        
        return null;
    }

    isDebuff(effectType) {
        return ['stun', 'weaken', 'mark', 'restrain', 'poison', 'blind'].includes(effectType);
    }

    isBuff(effectType) {
        return ['damage_boost', 'shield', 'dodge', 'concealment', 'haste'].includes(effectType);
    }
}
