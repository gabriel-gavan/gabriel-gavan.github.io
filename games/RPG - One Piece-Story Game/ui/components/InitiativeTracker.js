import Phaser from 'phaser';
import { manifest } from '../../manifest.js';
import { createText, MOBILE_BREAKPOINT } from '../../utils/TextUtils.js';

/**
 * InitiativeTracker - Shows turn order during combat
 *
 * Features:
 * - Collapsible on mobile (shows only current turn when collapsed)
 * - Tap header to toggle expanded/collapsed
 * - Auto-collapses on mobile, expanded on desktop
 *
 * All visual properties are themeable via manifest.ui
 */
export class InitiativeTracker extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {
        super(scene, x, y);

        this.entries = [];
        this.currentIndex = 0;
        this.initiativeOrder = [];

        // Collapse state - default based on viewport (collapsed on mobile)
        this.isCollapsed = scene.scale.width < MOBILE_BREAKPOINT;

        // Cache theme values for performance
        this.theme = this.getThemeValues();

        // Background
        this.background = scene.add.graphics();
        this.add(this.background);

        // Header container (always visible - clickable to toggle)
        this.headerContainer = scene.add.container(0, 0);
        this.add(this.headerContainer);

        // Create header elements
        this.createHeader();

        // Entry container (hidden when collapsed)
        this.entryContainer = scene.add.container(0, this.theme.headerHeight);
        this.add(this.entryContainer);

        this.setVisible(false);
        this.setDepth(100);
        scene.add.existing(this);
    }

    /**
     * Get theme values from manifest with fallbacks
     */
    getThemeValues() {
        const fonts = manifest.ui?.fonts || {};
        const dims = manifest.ui?.dimensions?.initiative || {};
        const colors = manifest.ui?.colors?.initiative || {};
        const portraits = manifest.ui?.dimensions?.portrait || {};

        return {
            fontFamily: fonts.monospace || 'monospace',
            bodyFont: fonts.primary || 'Georgia, serif',
            fontSize: fonts.sizes?.small || '12px',
            entryHeight: dims.entryHeight || 30,
            headerHeight: dims.headerHeight || 32,
            panelWidth: dims.panelWidth || 170,
            collapsedWidth: dims.collapsedWidth || 150,
            padding: dims.padding || 5,
            portraitSize: portraits.medium || 22,
            currentEnemy: colors.currentEnemy || 0x8b0000,
            currentParty: colors.currentParty || 0x2d5a27,
            inactive: colors.inactive || 0x1a1a2e,
            enemyName: colors.enemyName || '#ff6666',
            partyName: colors.partyName || '#88ff88',
            currentName: colors.currentName || '#ffffff',
            indicator: colors.indicator || '#ffff00',
            panelBg: manifest.ui?.colors?.panelBg || 0x0a0a1a,
            dialogBorder: manifest.ui?.colors?.dialogBorder || 0x4a4a6a,
            textDisabled: manifest.ui?.colors?.textDisabled || '#666666',
            textSpeaker: manifest.ui?.colors?.textSpeaker || '#ffd700',
            enemyPlaceholder: manifest.ui?.colors?.enemy?.placeholder || 0xcc0000,
            partyPlaceholder: manifest.ui?.colors?.party?.placeholder || 0x00cc00,
        };
    }

    /**
     * Create the header (title + toggle indicator)
     */
    createHeader() {
        // Clear existing header elements
        this.headerContainer.removeAll(true);

        // Title icon
        this.titleIcon = createText(this.scene, 0, 0, '⚔', {
            fontSize: this.theme.fontSize,
            fontFamily: this.theme.fontFamily,
            color: this.theme.textSpeaker
        });
        this.headerContainer.add(this.titleIcon);

        // Title text (changes based on collapsed state)
        const defaultTitle = manifest.ui?.labels?.initiativeTitle || '⚔ TURN ORDER';
        // Strip emoji prefix if present (we show it separately in titleIcon)
        this.expandedTitle = defaultTitle.replace(/^[^\w\s]+\s*/, '').trim() || 'TURN ORDER';
        this.titleText = createText(this.scene, 18, 0, this.expandedTitle, {
            fontSize: this.theme.fontSize,
            fontFamily: this.theme.fontFamily,
            color: this.theme.textSpeaker
        });
        this.headerContainer.add(this.titleText);

        // Toggle indicator (▼ expanded, ▶ collapsed)
        this.toggleIndicator = createText(this.scene, this.theme.panelWidth - 20, 0, '▼', {
            fontSize: this.theme.fontSize,
            fontFamily: this.theme.fontFamily,
            color: this.theme.textDisabled
        });
        this.headerContainer.add(this.toggleIndicator);

        // Make header interactive
        const hitArea = new Phaser.Geom.Rectangle(
            -this.theme.padding,
            -this.theme.padding,
            this.theme.panelWidth,
            this.theme.headerHeight
        );
        this.headerContainer.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

        this.headerContainer.on('pointerdown', () => this.toggle());
    }

    /**
     * Toggle between collapsed and expanded states
     */
    toggle() {
        this.isCollapsed = !this.isCollapsed;
        this.render();
    }

    /**
     * Update the initiative display
     * @param {Array} initiativeOrder - Array of {id, name, type, initiative, images}
     * @param {number} currentIndex - Index of current turn
     */
    update(initiativeOrder, currentIndex) {
        this.currentIndex = currentIndex;
        this.initiativeOrder = initiativeOrder || [];

        if (this.initiativeOrder.length === 0) {
            this.setVisible(false);
            return;
        }

        this.render();
        this.setVisible(true);
    }

    /**
     * Render the tracker based on current state (collapsed/expanded)
     */
    render() {
        if (this.isCollapsed) {
            this.renderCollapsed();
        } else {
            this.renderExpanded();
        }
    }

    /**
     * Render collapsed state - just current turn info
     */
    renderCollapsed() {
        this.entryContainer.removeAll(true);
        this.entries = [];
        this.entryContainer.setVisible(false);

        const currentCombatant = this.initiativeOrder[this.currentIndex];
        if (!currentCombatant) {
            this.background.clear();
            return;
        }

        const isEnemy = currentCombatant.type === 'enemy';
        const firstName = currentCombatant.name.split(' ')[0];

        // Update header to show current combatant
        this.titleText.setText(`${firstName}'s turn`);
        this.toggleIndicator.setText('▶');
        this.toggleIndicator.setX(this.theme.collapsedWidth - 20);

        // Draw compact background
        const padding = this.theme.padding;
        this.background.clear();
        this.background.fillStyle(isEnemy ? this.theme.currentEnemy : this.theme.currentParty, 0.9);
        this.background.lineStyle(1, this.theme.dialogBorder);
        this.background.fillRoundedRect(-padding, -padding, this.theme.collapsedWidth, this.theme.headerHeight, 6);
        this.background.strokeRoundedRect(-padding, -padding, this.theme.collapsedWidth, this.theme.headerHeight, 6);
    }

    /**
     * Render expanded state - full list
     */
    renderExpanded() {
        this.entryContainer.removeAll(true);
        this.entries = [];

        // Reset header to default
        this.titleText.setText(this.expandedTitle);
        this.toggleIndicator.setText('▼');
        this.toggleIndicator.setX(this.theme.panelWidth - 20);

        let y = 0;
        const entryHeight = this.theme.entryHeight;
        const panelWidth = this.theme.panelWidth - 10;

        this.initiativeOrder.forEach((combatant, index) => {
            const isCurrent = index === this.currentIndex;
            const isEnemy = combatant.type === 'enemy';

            // Entry background
            const entryBg = this.scene.add.graphics();
            if (isCurrent) {
                entryBg.fillStyle(isEnemy ? this.theme.currentEnemy : this.theme.currentParty, 0.8);
            } else {
                entryBg.fillStyle(this.theme.inactive, 0.6);
            }
            entryBg.fillRoundedRect(0, y, panelWidth, entryHeight - 2, 4);
            this.entryContainer.add(entryBg);

            // Turn indicator
            const indicator = createText(this.scene, 5, y + 6, isCurrent ? '▶' : ' ', {
                fontSize: this.theme.fontSize,
                fontFamily: this.theme.fontFamily,
                color: isCurrent ? this.theme.indicator : this.theme.textDisabled
            });
            this.entryContainer.add(indicator);

            // Portrait
            const portraitX = 25;
            const portraitY = y + entryHeight / 2;
            const portraitSize = this.theme.portraitSize;

            // Add placeholder circle first
            const placeholder = this.scene.add.graphics();
            placeholder.fillStyle(isEnemy ? this.theme.enemyPlaceholder : this.theme.partyPlaceholder, 0.5);
            placeholder.fillCircle(portraitX, portraitY, portraitSize / 2);
            this.entryContainer.add(placeholder);

            // Try to load portrait
            if (combatant.images?.portrait) {
                const textureKey = `portrait_${combatant.id}`;

                const showPortrait = () => {
                    if (!this.scene) return;
                    const portrait = this.scene.add.image(portraitX, portraitY, textureKey);

                    // Scale portrait
                    const scale = portraitSize / Math.max(portrait.width, portrait.height);
                    portrait.setScale(scale);

                    this.entryContainer.add(portrait);
                    placeholder.destroy();
                };

                if (this.scene.textures.exists(textureKey)) {
                    showPortrait();
                } else {
                    this.scene.load.image(textureKey, combatant.images.portrait);
                    this.scene.load.once(`filecomplete-image-${textureKey}`, showPortrait);
                    this.scene.load.start();
                }
            }

            // Combatant name
            const nameColor = isCurrent ? this.theme.currentName
                : (isEnemy ? this.theme.enemyName : this.theme.partyName);
            const name = createText(this.scene, 45, y + 6, combatant.name.split(' ')[0], {
                fontSize: this.theme.fontSize,
                fontFamily: this.theme.bodyFont,
                color: nameColor
            });
            this.entryContainer.add(name);

            this.entries.push({ bg: entryBg, indicator, name });
            y += entryHeight;
        });

        // Update background size
        const padding = this.theme.padding;
        const totalHeight = y + this.theme.headerHeight + padding;
        this.background.clear();
        this.background.fillStyle(this.theme.panelBg, 0.85);
        this.background.lineStyle(1, this.theme.dialogBorder);
        this.background.fillRoundedRect(-padding, -padding, this.theme.panelWidth, totalHeight, 6);
        this.background.strokeRoundedRect(-padding, -padding, this.theme.panelWidth, totalHeight, 6);

        // Show entry container
        this.entryContainer.setVisible(true);
    }

    hide() {
        this.setVisible(false);
    }

    /**
     * Clear the initiative display (for new combat)
     */
    clear() {
        this.entryContainer.removeAll(true);
        this.entries = [];
        this.currentIndex = 0;
        this.initiativeOrder = [];
        this.background.clear();
        this.setVisible(false);
    }

}
