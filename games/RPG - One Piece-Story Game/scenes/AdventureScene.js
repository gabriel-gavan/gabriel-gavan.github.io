import Phaser from 'phaser';
import { getGameState } from '../state/GameState.js';
import {
    DialogueBox,
    ChoicePanel,
    HealthDisplay,
    EnemyDisplay,
    CharacterSelectPanel,
    AbilityPanel,
    CombatErrorDialog,
    InitiativeTracker
} from '../ui/index.js';
import { DebugPanel } from '../ui/panels/DebugPanel.js';
import ChatManager, { CHARACTER_PROMPTS } from '../services/AIService.js';
import { CombatUIManager, DialogueUIManager, SceneUIManager } from '../ui/managers/index.js';
import { CombatManager } from '../systems/combat/CombatManager.js';
import { CombatView } from '../systems/combat/CombatView.js';
import { SceneSystem } from '../systems/flow/SceneSystem.js';
import { EventBus } from '../events/EventBus.js';
import { SCENE_EVENTS } from '../events/SceneEvents.js';
import { MOBILE_BREAKPOINT } from '../utils/TextUtils.js';
import { getSoundEffects } from '../audio/SoundEffects.js';
import { CombatAudioManager } from '../audio/CombatAudioManager.js';
import { manifest } from '../manifest.js';

/**
 * AdventureScene - Main game scene for narrative and combat
 *
 * Coordinates UI components and initializes Systems and Managers.
 * Now purely an entry point and container for systems.
 */
export class AdventureScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AdventureScene' });
    }

    async create() {
        this.gameState = getGameState();

        // Initialize state and load first scene
        await this.gameState.init();

        // Set document title from manifest (content-agnostic theming)
        document.title = manifest.documentTitle || manifest.title;

        // Load combat data (abilities + enemies) for v2 combat
        await this.gameState.loadCombatData();

        // Initialize AI service for combat narration
        this.chatManager = new ChatManager(CHARACTER_PROMPTS.narrator);

        // Initialize sound effects system
        // Tone.js requires user interaction before starting audio context
        this.soundEffects = getSoundEffects();
        
        // Initialize audio on first user interaction
        this.input.once('pointerdown', async () => {
            await this.soundEffects.init();
        });

        // Create layer containers for z-ordering
        this.backgroundLayer = this.add.container(0, 0);
        this.characterLayer = this.add.container(0, 0);
        this.vignetteLayer = this.add.container(0, 0);
        this.uiLayer = this.add.container(0, 0);

        // Create UI components
        this.createUI();

        // Initialize Logic Systems
        this.sceneSystem = new SceneSystem(this.gameState);
        this.combatManager = new CombatManager(this, this.gameState, this.chatManager);
        this.combatView = new CombatView(this, this.characterLayer);

        // Initialize UI Managers
        this.combatUIManager = new CombatUIManager(this);
        this.dialogueUIManager = new DialogueUIManager(this);
        this.sceneUIManager = new SceneUIManager(this);

        // Initialize Audio Manager
        this.combatAudioManager = new CombatAudioManager(this.gameState, this.combatManager);

        // Setup bridge listener for combat start
        EventBus.on('system.combat.start', ({ combatConfig }) => {
            this.combatManager.startCombat(combatConfig);
        });

        // Load starting scene via EventBus
        EventBus.emit(SCENE_EVENTS.LOAD_REQUESTED, { sceneId: this.gameState.currentScene });
    }

    createUI() {
        const { width, height } = this.scale;

        // Layout configuration for UI positioning
        this.layoutConfig = {
            dialogueHeight: 150,
            dialogueMargin: 20,
            choiceDialogueGap: 15,
            choiceButtonHeight: 60, // Increased for mobile (was 52)
            choiceButtonSpacing: 10,
            maxChoices: 4,
            sideMargin: 40,
            choicePanelWidth: 350,
            abilityPanelWidth: 350,
        };

        // Calculate initial positions
        const positions = this.calculateUIPositions(width, height);

        // Dialogue box at bottom
        this.dialogueBox = new DialogueBox(
            this,
            positions.dialogueX,
            positions.dialogueY,
            positions.dialogueWidth,
            positions.dialogueHeight
        );
        this.uiLayer.add(this.dialogueBox);

        // Choice panel (positioned in thumb-friendly zone)
        this.choicePanel = new ChoicePanel(
            this,
            positions.choicePanelX,
            positions.choicesY,
            this.layoutConfig.choicePanelWidth,
            this.layoutConfig.choiceButtonHeight,
            this.layoutConfig.choiceButtonSpacing
        );
        this.choicePanel.hide();
        this.uiLayer.add(this.choicePanel);

        // Health display (top right, hidden until combat)
        this.healthDisplay = new HealthDisplay(this, positions.healthDisplayX, 20);
        this.healthDisplay.setVisible(false);
        this.uiLayer.add(this.healthDisplay);

        // Enemy display (top left, hidden until combat)
        this.enemyDisplay = new EnemyDisplay(this, 20, 20);
        this.enemyDisplay.setVisible(false);
        this.uiLayer.add(this.enemyDisplay);

        // Combat vignette overlay (hidden by default)
        this.vignetteGraphics = this.add.graphics();
        this.vignetteLayer.add(this.vignetteGraphics);
        this.vignetteLayer.setVisible(false);

        // Combat v2 UI components (hidden by default)
        this.characterSelectPanel = new CharacterSelectPanel(this, positions.dialogueX, positions.characterSelectY, positions.dialogueWidth);
        this.characterSelectPanel.setVisible(false);
        this.uiLayer.add(this.characterSelectPanel);

        // Position AbilityPanel in thumb-friendly zone
        this.abilityPanel = new AbilityPanel(this, positions.abilityPanelX, positions.abilityPanelY, this.layoutConfig.abilityPanelWidth);
        this.abilityPanel.setVisible(false);
        this.uiLayer.add(this.abilityPanel);

        this.combatErrorDialog = new CombatErrorDialog(this, positions.errorDialogX, positions.errorDialogY);
        this.uiLayer.add(this.combatErrorDialog);

        // Initiative tracker (shows turn order in combat, positioned below enemy display)
        this.initiativeTracker = new InitiativeTracker(this, 20, 120);
        this.initiativeTracker.setVisible(false);
        this.uiLayer.add(this.initiativeTracker);

        // Debug panel (press F1 to toggle)
        this.debugPanel = new DebugPanel(this, this.gameState);
    }

    /**
     * Calculate UI positions based on screen dimensions
     * Uses percentage-based positioning for mobile responsiveness
     */
    calculateUIPositions(width, height) {
        const cfg = this.layoutConfig;

        // Responsive dialogue height - taller on mobile to accommodate larger fonts
        let dialogueHeight = cfg.dialogueHeight;
        if (width < MOBILE_BREAKPOINT) {
            dialogueHeight = Math.max(cfg.dialogueHeight, Math.min(height * 0.22, 200));
        }

        // Dialogue box - bottom of screen with margin
        const dialogueY = height - dialogueHeight - cfg.dialogueMargin;
        const dialogueWidth = width - (cfg.sideMargin * 2);

        // Choice panel - positioned above dialogue, in lower 40% of screen (thumb zone)
        const choicesHeight = (cfg.maxChoices * cfg.choiceButtonHeight) + ((cfg.maxChoices - 1) * cfg.choiceButtonSpacing);
        // Position choices higher when screen is taller, but keep in thumb zone
        const choicesY = Math.max(
            height * 0.35, // Never higher than 35% from top
            dialogueY - choicesHeight - cfg.choiceDialogueGap
        );

        // Center panels horizontally
        const choicePanelX = width / 2 - cfg.choicePanelWidth / 2;
        const abilityPanelX = width / 2 - cfg.abilityPanelWidth / 2;

        // Character select panel - above dialogue
        const characterSelectY = choicesY - 30;

        // Ability panel - in the middle area, above dialogue
        const abilityPanelY = Math.max(height * 0.20, choicesY - 140);

        return {
            dialogueX: cfg.sideMargin,
            dialogueY,
            dialogueWidth,
            dialogueHeight,
            choicesY,
            choicePanelX,
            healthDisplayX: width - 160,
            characterSelectY,
            abilityPanelX,
            abilityPanelY,
            errorDialogX: width / 2 - 150,
            errorDialogY: height / 2 - 75,
        };
    }
}

