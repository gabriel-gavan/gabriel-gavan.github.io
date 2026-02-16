import Phaser from 'phaser';
import { EventBus } from '../../events/EventBus.js';
import { SCENE_EVENTS } from '../../events/SceneEvents.js';
import { COMBAT_EVENTS } from '../../events/CombatEvents.js';

/**
 * DebugPanel - Developer tools for testing scene navigation
 *
 * Features:
 * - Toggle with F1 key
 * - Tabbed interface: Scenes | State | AI
 * - Jump to any scene from manifest
 * - Apply flag presets for different game states
 * - View/modify party health
 * - Configure API token
 */

const PANEL_COLORS = {
    background: 0x1a1a2e,
    header: 0x16213e,
    button: 0x0f3460,
    buttonHover: 0x1a4a8e,
    border: 0x4a4a6a,
    tabActive: 0x0f3460,
    tabInactive: 0x16213e,
    text: '#e8e8e8',
    textDim: '#a0a0a0',
    accent: '#ffd700'
};

/**
 * Flag presets for different game states
 */
const FLAG_PRESETS = {
    fresh_start: {
        name: 'Fresh Start',
        description: 'Beginning of adventure',
        flags: {},
        partyHealth: 'full'
    },
    after_chiefs_mission: {
        name: 'After Chief',
        description: 'Completed chief scene',
        flags: {
            'got_chiefs_stick': true,
            'chiefs_blessing': true,
            'divine_favor': true
        },
        partyHealth: 'full'
    },
    after_lotslegs: {
        name: 'After Spider',
        description: 'Defeated Lotslegs',
        flags: {
            'got_chiefs_stick': true,
            'squealy_champion': true,
            'got_fire_potion': true,
            'looted_spider': true
        },
        partyHealth: 'some_damage'
    },
    combat_ready: {
        name: 'Combat Ready',
        description: 'Ready for Vorka',
        flags: {
            'got_chiefs_stick': true,
            'squealy_champion': true,
            'got_fire_potion': true,
            'looted_spider': true,
            'found_weapons': true,
            'found_fireworks': true
        },
        partyHealth: 'some_damage'
    },
    nearly_dead: {
        name: 'Near Death',
        description: 'Critical condition',
        flags: {
            'got_chiefs_stick': true,
            'squealy_champion': true
        },
        partyHealth: 'critical'
    }
};

export class DebugPanel extends Phaser.GameObjects.Container {
    constructor(scene, gameState) {
        super(scene, 0, 0);

        this.gameState = gameState;
        this.isVisible = false;
        this.selectedPreset = null;
        this.currentTab = 'scenes';

        // Panel dimensions
        this.panelWidth = 280;
        this.panelHeight = 340;
        this.panelX = 10;
        this.panelY = 10;

        // Tab content containers
        this.tabContents = {};

        this.createPanel();
        this.setupKeyboardToggle();

        // Start hidden
        this.setVisible(false);
        this.setDepth(1000);

        scene.add.existing(this);
    }

    createPanel() {
        // Background panel
        this.background = this.scene.add.graphics();
        this.background.fillStyle(PANEL_COLORS.background, 0.95);
        this.background.fillRoundedRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight, 8);
        this.background.lineStyle(2, PANEL_COLORS.border);
        this.background.strokeRoundedRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight, 8);
        this.add(this.background);

        // Header
        const headerHeight = 32;
        this.header = this.scene.add.graphics();
        this.header.fillStyle(PANEL_COLORS.header, 1);
        this.header.fillRoundedRect(this.panelX, this.panelY, this.panelWidth, headerHeight, { tl: 8, tr: 8, bl: 0, br: 0 });
        this.add(this.header);

        // Title
        this.title = this.scene.add.text(this.panelX + 10, this.panelY + 7, 'DEBUG (F1)', {
            fontSize: '12px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.accent,
            fontStyle: 'bold'
        });
        this.add(this.title);

        // Current scene indicator
        this.sceneIndicator = this.scene.add.text(this.panelX + 100, this.panelY + 8, '', {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.textDim
        });
        this.add(this.sceneIndicator);

        // Create tabs
        this.createTabs(this.panelY + headerHeight);

        // Create tab content areas
        const contentY = this.panelY + headerHeight + 28;
        this.createScenesTab(contentY);
        this.createStateTab(contentY);
        this.createAITab(contentY);

        // Show default tab
        this.switchTab('scenes');
    }

    createTabs(yPos) {
        const tabWidth = 85;
        const tabs = [
            { id: 'scenes', label: 'Scenes' },
            { id: 'state', label: 'State' },
            { id: 'ai', label: 'AI' }
        ];

        this.tabButtons = [];

        tabs.forEach((tab, index) => {
            const x = this.panelX + 8 + (index * (tabWidth + 4));
            const tabBtn = this.createTabButton(tab.id, tab.label, x, yPos + 4, tabWidth);
            this.tabButtons.push(tabBtn);
        });
    }

    createTabButton(id, label, x, y, width) {
        const container = this.scene.add.container(x, y);

        const bg = this.scene.add.graphics();
        bg.fillStyle(PANEL_COLORS.tabInactive, 1);
        bg.fillRoundedRect(0, 0, width, 22, 4);
        container.add(bg);

        const text = this.scene.add.text(width / 2, 11, label, {
            fontSize: '11px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.textDim
        });
        text.setOrigin(0.5);
        container.add(text);

        // Make interactive
        bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, 22), Phaser.Geom.Rectangle.Contains);
        bg.on('pointerdown', () => this.switchTab(id));
        bg.on('pointerover', () => {
            if (this.currentTab !== id) {
                text.setColor(PANEL_COLORS.text);
            }
        });
        bg.on('pointerout', () => {
            if (this.currentTab !== id) {
                text.setColor(PANEL_COLORS.textDim);
            }
        });

        this.add(container);

        return { container, bg, text, id };
    }

    switchTab(tabId) {
        this.currentTab = tabId;

        // Update tab visuals
        this.tabButtons.forEach(tab => {
            const isActive = tab.id === tabId;
            tab.bg.clear();
            tab.bg.fillStyle(isActive ? PANEL_COLORS.tabActive : PANEL_COLORS.tabInactive, 1);
            tab.bg.fillRoundedRect(0, 0, 85, 22, 4);
            tab.text.setColor(isActive ? PANEL_COLORS.accent : PANEL_COLORS.textDim);
        });

        // Show/hide content
        Object.keys(this.tabContents).forEach(key => {
            this.tabContents[key].setVisible(key === tabId);
        });
    }

    // ========================================
    // SCENES TAB
    // ========================================

    createScenesTab(yPos) {
        const container = this.scene.add.container(0, 0);
        this.tabContents.scenes = container;
        this.add(container);

        let y = yPos + 8;
        const scenes = Object.keys(this.gameState.manifest?.scenes || {});

        scenes.forEach((sceneId) => {
            const btn = this.createSceneButton(sceneId, this.panelX + 12, y, container);
            y += 22;
        });
    }

    createSceneButton(sceneId, x, y, container) {
        const displayName = sceneId.length > 28 ? sceneId.substring(0, 25) + '...' : sceneId;

        const text = this.scene.add.text(x, y, `> ${displayName}`, {
            fontSize: '11px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.text
        });

        text.setInteractive({ useHandCursor: true });
        text.on('pointerover', () => text.setColor(PANEL_COLORS.accent));
        text.on('pointerout', () => text.setColor(PANEL_COLORS.text));
        text.on('pointerdown', () => this.jumpToScene(sceneId));

        container.add(text);
        return text;
    }

    // ========================================
    // STATE TAB
    // ========================================

    createStateTab(yPos) {
        const container = this.scene.add.container(0, 0);
        this.tabContents.state = container;
        this.add(container);

        let y = yPos + 8;

        // Presets section
        const presetsLabel = this.scene.add.text(this.panelX + 12, y, 'FLAG PRESETS:', {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.accent
        });
        container.add(presetsLabel);
        y += 16;

        this.presetButtons = [];
        Object.entries(FLAG_PRESETS).forEach(([key, preset]) => {
            const btn = this.createPresetButton(key, preset, this.panelX + 12, y, container);
            this.presetButtons.push(btn);
            y += 20;
        });

        y += 10;

        // Health section
        const healthLabel = this.scene.add.text(this.panelX + 12, y, 'PARTY HEALTH:', {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.accent
        });
        container.add(healthLabel);
        y += 18;

        this.createHealthButton('Heal All', this.panelX + 12, y, container, () => {
            this.gameState.party.forEach(m => {
                m.currentHealth = m.maxHealth;
                m.status = 'ok';
            });
            this.refreshDisplay();
        });

        this.createHealthButton('Damage', this.panelX + 90, y, container, () => {
            this.gameState.party.forEach(m => {
                m.currentHealth = Math.max(1, m.currentHealth - 2);
                m.status = m.currentHealth < m.maxHealth ? 'hurt' : 'ok';
            });
            this.refreshDisplay();
        });

        this.createHealthButton('Wipe', this.panelX + 160, y, container, () => {
            this.gameState.party.forEach(m => {
                m.currentHealth = 0;
                m.status = 'down';
            });
            this.refreshDisplay();
        });

        y += 25;

        // Combat Cheats
        const combatLabel = this.scene.add.text(this.panelX + 12, y, 'COMBAT CHEATS:', {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.accent
        });
        container.add(combatLabel);
        y += 18;

        this.createHealthButton('Hit Enemy', this.panelX + 12, y, container, () => {
            if (this.gameState.combat && this.gameState.combat.enemy) {
                // Apply 2 damage to enemy
                this.gameState.applyDamageToEnemy(2);
                EventBus.emit(COMBAT_EVENTS.ENEMY.STATUS_UPDATED, { enemy: this.gameState.combat.enemy });
                console.log('[Debug] Hit enemy for 2 damage');
            } else {
                console.warn('[Debug] No active enemy to hit');
            }
        });

        this.createHealthButton('Kill Enemy', this.panelX + 80, y, container, () => {
            if (this.gameState.combat && this.gameState.combat.enemy) {
                this.gameState.combat.enemy.currentHealth = 1;
                this.gameState.combat.enemy.status = 'critical';
                // Emit event to update UI
                EventBus.emit(COMBAT_EVENTS.ENEMY.STATUS_UPDATED, { enemy: this.gameState.combat.enemy });
                console.log('[Debug] Set enemy HP to 1');
            } else {
                console.warn('[Debug] No active enemy to kill');
            }
        });
    }

    createPresetButton(key, preset, x, y, container) {
        const text = this.scene.add.text(x, y, `[${preset.name}] ${preset.description}`, {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.textDim
        });

        text.setInteractive({ useHandCursor: true });
        text.on('pointerover', () => text.setColor(PANEL_COLORS.accent));
        text.on('pointerout', () => {
            text.setColor(this.selectedPreset === key ? '#88ff88' : PANEL_COLORS.textDim);
        });
        text.on('pointerdown', () => this.applyPreset(key));

        container.add(text);
        return { text, key };
    }

    createHealthButton(label, x, y, container, onClick) {
        const btn = this.scene.add.text(x, y, `[${label}]`, {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.textDim
        });

        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setColor(PANEL_COLORS.accent));
        btn.on('pointerout', () => btn.setColor(PANEL_COLORS.textDim));
        btn.on('pointerdown', onClick);

        container.add(btn);
        return btn;
    }

    // ========================================
    // AI TAB
    // ========================================

    createAITab(yPos) {
        const container = this.scene.add.container(0, 0);
        this.tabContents.ai = container;
        this.add(container);

        let y = yPos + 8;

        // Token status
        const tokenLabel = this.scene.add.text(this.panelX + 12, y, 'API TOKEN:', {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.accent
        });
        container.add(tokenLabel);
        y += 18;

        this.tokenStatus = this.scene.add.text(this.panelX + 12, y, 'Not configured', {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.textDim
        });
        container.add(this.tokenStatus);
        y += 20;

        // Set token button
        const setBtn = this.scene.add.text(this.panelX + 12, y, '[Set Token]', {
            fontSize: '11px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.text
        });
        setBtn.setInteractive({ useHandCursor: true });
        setBtn.on('pointerover', () => setBtn.setColor(PANEL_COLORS.accent));
        setBtn.on('pointerout', () => setBtn.setColor(PANEL_COLORS.text));
        setBtn.on('pointerdown', () => this.promptForToken());
        container.add(setBtn);

        // Clear token button
        const clearBtn = this.scene.add.text(this.panelX + 100, y, '[Clear]', {
            fontSize: '11px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.textDim
        });
        clearBtn.setInteractive({ useHandCursor: true });
        clearBtn.on('pointerover', () => clearBtn.setColor(PANEL_COLORS.accent));
        clearBtn.on('pointerout', () => clearBtn.setColor(PANEL_COLORS.textDim));
        clearBtn.on('pointerdown', () => {
            if (this.scene.chatManager) {
                this.scene.chatManager.clearAuthToken();
                this.updateTokenStatus();
            }
        });
        container.add(clearBtn);

        y += 30;

        // Instructions
        const instructions = this.scene.add.text(this.panelX + 12, y,
            'To get token:\n1. Login to Playground\n2. DevTools > Application\n3. Local Storage > accessToken', {
            fontSize: '9px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.textDim,
            lineSpacing: 4
        });
        container.add(instructions);

        y += 60;

        // Test AI button
        const testBtn = this.scene.add.text(this.panelX + 12, y, '[Test AI Connection]', {
            fontSize: '11px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.text
        });
        testBtn.setInteractive({ useHandCursor: true });
        testBtn.on('pointerover', () => testBtn.setColor(PANEL_COLORS.accent));
        testBtn.on('pointerout', () => testBtn.setColor(PANEL_COLORS.text));
        testBtn.on('pointerdown', () => this.testAIConnection());
        container.add(testBtn);

        this.aiTestResult = this.scene.add.text(this.panelX + 12, y + 20, '', {
            fontSize: '9px',
            fontFamily: 'monospace',
            color: PANEL_COLORS.textDim
        });
        container.add(this.aiTestResult);
    }

    promptForToken() {
        const token = window.prompt('Enter JWT API Token:');
        if (token && token.trim()) {
            if (this.scene.chatManager) {
                this.scene.chatManager.setAuthToken(token.trim());
                this.updateTokenStatus();
            }
        }
    }

    updateTokenStatus() {
        if (!this.tokenStatus) return;

        const token = this.scene.chatManager?._config?.authToken;
        if (token) {
            const preview = token.substring(0, 25) + '...';
            this.tokenStatus.setText(preview);
            this.tokenStatus.setColor('#88ff88');
        } else {
            this.tokenStatus.setText('Not configured');
            this.tokenStatus.setColor(PANEL_COLORS.textDim);
        }
    }

    async testAIConnection() {
        if (!this.scene.chatManager) {
            this.aiTestResult.setText('No ChatManager found');
            this.aiTestResult.setColor('#ff6666');
            return;
        }

        this.aiTestResult.setText('Testing...');
        this.aiTestResult.setColor(PANEL_COLORS.accent);

        try {
            this.scene.chatManager.cleanChatHistory();
            this.scene.chatManager.addMessage('user', 'Say "Goblin test OK" in 3 words or less.');

            const start = Date.now();
            const response = await this.scene.chatManager.getCharacterResponse('chat', 20);
            const elapsed = Date.now() - start;

            this.aiTestResult.setText(`OK (${elapsed}ms): "${response.slice(0, 30)}..."`);
            this.aiTestResult.setColor('#88ff88');
        } catch (error) {
            this.aiTestResult.setText(`Error: ${error.message.slice(0, 40)}`);
            this.aiTestResult.setColor('#ff6666');
        }
    }

    // ========================================
    // COMMON METHODS
    // ========================================

    setupKeyboardToggle() {
        this.scene.input.keyboard.on('keydown-F1', () => {
            this.toggle();
        });
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.setVisible(this.isVisible);

        if (this.isVisible) {
            this.refreshDisplay();
        }
    }

    refreshDisplay() {
        // Update scene indicator
        const currentScene = this.gameState.currentScene || '-';
        const shortScene = currentScene.length > 15 ? currentScene.slice(0, 12) + '...' : currentScene;
        this.sceneIndicator.setText(shortScene);

        // Update token status
        this.updateTokenStatus();

        // Notify parent scene to update health display (using EventBus would be cleaner but accessing scene props is ok for debug)
        if (this.scene.healthDisplay) {
            this.scene.healthDisplay.updateParty(this.gameState.party);
        }
    }

    applyPreset(presetKey) {
        const preset = FLAG_PRESETS[presetKey];
        if (!preset) return;

        this.gameState.flags = { ...preset.flags };
        this.applyPartyHealth(preset.partyHealth);

        this.selectedPreset = presetKey;
        this.presetButtons.forEach(btn => {
            const color = btn.key === presetKey ? '#88ff88' : PANEL_COLORS.textDim;
            btn.text.setColor(color);
        });

        this.refreshDisplay();
        console.log(`[Debug] Applied preset: ${preset.name}`);
        EventBus.emit(COMBAT_EVENTS.HEALTH.PARTY_UPDATED, { party: this.gameState.party });
    }

    applyPartyHealth(healthType) {
        this.gameState.party.forEach((member, index) => {
            switch (healthType) {
                case 'full':
                    member.currentHealth = member.maxHealth;
                    member.status = 'ok';
                    break;
                case 'some_damage':
                    const damage = (index + 1) * 2;
                    member.currentHealth = Math.max(1, member.maxHealth - damage);
                    member.status = member.currentHealth < member.maxHealth ? 'hurt' : 'ok';
                    break;
                case 'critical':
                    member.currentHealth = Math.max(1, Math.floor(member.maxHealth * 0.2));
                    member.status = 'hurt';
                    break;
            }
        });
    }

    jumpToScene(sceneId) {
        console.log(`[Debug] Jumping to scene: ${sceneId}`);

        this.gameState.turnCount = 0;
        this.gameState.choiceHistory = [];

        // End any active combat before jumping scenes
        if (this.gameState.combat) {
            console.log('[Debug] Ending active combat');
            this.gameState.endCombat();
            EventBus.emit('system.combat.end');
        }

        EventBus.emit(SCENE_EVENTS.LOAD_REQUESTED, { sceneId });

        this.refreshDisplay();
    }
}
