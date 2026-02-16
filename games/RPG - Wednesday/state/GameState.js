/**
 * GameState - Centralized state management for the adventure
 *
 * Manages: scene navigation, party health, flags, choice history
 * Pattern: Singleton accessed via GameState.instance
 *
 * Internally delegates to focused modules:
 * - DataLoader: JSON file loading
 * - PartyState: Party member management
 * - FlagState: Story flags and history
 * - CombatState: Combat-specific state
 * - EffectManager: Effect application and queries
 * - DamageCalculator: Damage modifier calculations
 */

import { DataLoader } from '../data/DataLoader.js';
import { PartyState } from './PartyState.js';
import { FlagState } from './FlagState.js';
import { CombatState } from './CombatState.js';
import { EffectManager } from '../systems/effects/EffectManager.js';
import { getDamageModifier } from '../systems/rules/DamageRules.js';
import { STATUS_EFFECTS } from '../constants/GameConstants.js';

export class GameState {
    static instance = null;

    constructor() {
        if (GameState.instance) {
            return GameState.instance;
        }
        GameState.instance = this;

        // Initialize sub-modules
        this._dataLoader = new DataLoader();
        this._partyState = new PartyState();
        this._flagState = new FlagState();
        this._combatState = new CombatState();
        this._effectManager = new EffectManager();

        // Scene tracking (kept here for simplicity)
        this.currentScene = null;
        this.currentBeat = null;
    }

    // ========================================
    // Public API - Backward Compatible
    // ========================================

    // Expose party array for direct access (backward compatibility)
    get party() {
        return this._partyState.getAll();
    }

    // Expose combat state for direct access
    get combat() {
        return this._combatState.get();
    }

    set combat(value) {
        this._combatState.combat = value;
    }

    // Expose data references
    get manifest() {
        return this._dataLoader.manifest;
    }

    get abilitiesData() {
        return this._dataLoader.abilitiesData;
    }

    get enemiesData() {
        return this._dataLoader.enemiesData;
    }

    // Expose flag state properties
    get flags() {
        return this._flagState.flags;
    }

    set flags(value) {
        this._flagState.flags = value;
    }

    get choiceHistory() {
        return this._flagState.choiceHistory;
    }

    set choiceHistory(value) {
        this._flagState.choiceHistory = value;
    }

    get turnCount() {
        return this._flagState.turnCount;
    }

    set turnCount(value) {
        this._flagState.turnCount = value;
    }

    // ========================================
    // Initialization
    // ========================================

    /**
     * Initialize state with manifest and party data
     */
    async init(manifestPath = 'data/manifest.json', partyPath = 'data/party.json') {
        await this._dataLoader.loadManifest(manifestPath);
        const partyData = await this._dataLoader.loadParty(partyPath);

        this._partyState.initialize(partyData);
        this.currentScene = this._dataLoader.getStartingScene();

        return this;
    }

    /**
     * Load a scene by ID
     */
    async loadScene(sceneId) {
        const sceneData = await this._dataLoader.loadScene(sceneId);
        if (sceneData) {
            this.currentScene = sceneId;
            this.currentBeat = null;
        }
        return sceneData;
    }

    /**
     * Load combat data (abilities and enemies)
     */
    async loadCombatData(abilitiesPath = 'data/abilities.json', enemiesPath = 'data/enemies.json') {
        return this._dataLoader.loadCombatData(abilitiesPath, enemiesPath);
    }

    // ========================================
    // Party Management (delegates to PartyState)
    // ========================================

    applyDamage(targetId, amount) {
        this._partyState.applyDamage(targetId, amount);
    }

    applyHeal(targetId, amount) {
        this._partyState.applyHeal(targetId, amount);
    }

    getMember(id) {
        return this._partyState.getMember(id);
    }

    isPartyWiped() {
        return this._partyState.isWiped();
    }

    getActiveParty() {
        return this._partyState.getActive();
    }

    // ========================================
    // Flag & History (delegates to FlagState)
    // ========================================

    setFlag(name, value = true) {
        this._flagState.setFlag(name, value);
    }

    hasFlag(name) {
        return this._flagState.hasFlag(name);
    }

    recordChoice(choiceId, outcome, roll = null) {
        this._flagState.recordChoice(choiceId, outcome, {
            scene: this.currentScene,
            beat: this.currentBeat,
            roll
        });
    }

    // ========================================
    // Combat State (delegates to CombatState)
    // ========================================

    initCombat(enemyId) {
        const enemyData = this._dataLoader.getEnemy(enemyId);
        if (!enemyData) {
            console.error(`Enemy not found: ${enemyId}`);
            return null;
        }

        return this._combatState.initialize(
            enemyData,
            this._partyState.getAll(),
            this._dataLoader.abilitiesData
        );
    }

    getAvailableAbilities(characterId) {
        const charAbilities = this._dataLoader.getAbilities(characterId);
        if (!charAbilities) return { basic: [], special: [] };

        const basic = charAbilities.basicAttacks || [];

        const special = (charAbilities.specialAbilities || []).map(ability => {
            const used = this._combatState.getAbilityUsage(characterId, ability.id);
            const remaining = ability.uses - used;
            return {
                ...ability,
                usesRemaining: remaining,
                available: remaining > 0
            };
        });

        return { basic, special };
    }

    useAbility(characterId, abilityId) {
        this._combatState.useAbility(characterId, abilityId);
    }

    applyDamageToEnemy(amount) {
        return this._combatState.damageEnemy(amount);
    }

    applyDamageToCompanion(amount) {
        return this._combatState.damageCompanion(amount);
    }

    isEnemyDefeated() {
        return this._combatState.isEnemyDefeated();
    }

    addCombatLogEntry(entry) {
        this._combatState.addLogEntry(entry);
    }

    endCombat() {
        this._combatState.end();
    }

    // ========================================
    // Effects (delegates to EffectManager)
    // ========================================

    applyEffectToCharacter(characterId, effect) {
        this._effectManager.applyToCharacter(this.combat, characterId, effect);
    }

    applyEffectToEnemy(effect) {
        this._effectManager.applyToEnemy(this.combat, effect);
    }

    applyPartyEffect(effect) {
        this._effectManager.applyToParty(this.combat, effect);
    }

    tickEffects() {
        this._effectManager.tick(this.combat);
    }

    isCharacterRestrained(characterId) {
        return this._effectManager.characterHasEffect(this.combat, characterId, STATUS_EFFECTS.RESTRAIN);
    }

    isCharacterStunned(characterId) {
        return this._effectManager.characterHasEffect(this.combat, characterId, STATUS_EFFECTS.STUN);
    }

    isEnemyStunned() {
        return this._effectManager.enemyHasEffect(this.combat, STATUS_EFFECTS.STUN);
    }

    isCharacterProtectedByStaticShield(characterId) {
        return this._effectManager.characterHasEffect(this.combat, characterId, STATUS_EFFECTS.STATIC_SHIELD);
    }

    removeRestrainFromCharacter(characterId) {
        this._effectManager.removeFromCharacter(this.combat, characterId, STATUS_EFFECTS.RESTRAIN);
    }

    getRestrainedParty() {
        return this.getActiveParty().filter(p => this.isCharacterRestrained(p.id));
    }

    isEnemyMarked() {
        return this._effectManager.enemyHasEffect(this.combat, STATUS_EFFECTS.MARK);
    }

    consumeMarkOnEnemy() {
        return this._effectManager.consumeEnemyMark(this.combat);
    }

    getPartyAccuracyBonus() {
        return this._effectManager.getPartyAccuracyBonus(this.combat);
    }

    getCharacterHasteBonus(characterId) {
        return this._effectManager.getCharacterHasteBonus(this.combat, characterId);
    }

    // ========================================
    // Damage Calculation (delegates to DamageRules)
    // ========================================

    getDamageModifier(targetId, isPlayerAttacking) {
        return getDamageModifier(this.combat, targetId, isPlayerAttacking);
    }

    // ========================================
    // Reset
    // ========================================

    reset() {
        this._partyState.reset();
        this._flagState.reset();
        this._combatState.end();

        this.currentScene = this._dataLoader.getStartingScene();
        this.currentBeat = null;
    }
}

// Export singleton getter
export function getGameState() {
    if (!GameState.instance) {
        new GameState();
    }
    return GameState.instance;
}
