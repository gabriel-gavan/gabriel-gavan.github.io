import Phaser from 'phaser';
import { createText, createCenteredText, truncateTextToWidth } from '../../utils/TextUtils.js';
import { manifest } from '../../manifest.js';

/**
 * AbilityPanel - Pick which ability to use
 *
 * Two-mode panel:
 * 1. List Mode: Shows ability buttons with truncated descriptions
 * 2. Detail Mode: Shows full ability info with "Use" button
 *
 * All visual properties are themeable via manifest.ui
 */
export class AbilityPanel extends Phaser.GameObjects.Container {
    constructor(scene, x, y, width) {
        super(scene, x, y);

        this.panelWidth = width;

        // Cache theme values for performance
        this.theme = this.getThemeValues();

        this.buttonHeight = this.theme.buttonHeight;
        this.buttonSpacing = this.theme.buttonSpacing;
        this.buttons = [];
        this.detailElements = [];
        this.onSelect = null;
        this.onBack = null;

        // View state
        this.viewMode = 'list'; // 'list' or 'detail'
        this.currentCharacter = null;
        this.currentAbilities = null;
        this.selectedAbility = null;

        // Title - read from manifest for content-agnostic theming
        const defaultLabel = manifest.ui?.labels?.abilitySelect || 'Choose an Ability:';
        this.title = createText(scene, 0, 0, defaultLabel, {
            fontSize: this.theme.headingSize,
            fontFamily: this.theme.fontFamily,
            fontStyle: 'bold',
            color: this.theme.textSpeaker
        });
        this.add(this.title);

        // Back button
        this.backButton = this.createBackButton();
        this.add(this.backButton);

        scene.add.existing(this);
    }

    /**
     * Get theme values from manifest with fallbacks
     */
    getThemeValues() {
        const fonts = manifest.ui?.fonts || {};
        const fontMetrics = fonts.metrics || {};
        const colors = manifest.ui?.colors || {};
        const dims = manifest.ui?.dimensions?.ability || {};

        return {
            // Font settings
            fontFamily: fonts.primary || 'Georgia, serif',
            headingSize: fonts.sizes?.heading || '14px',
            bodySize: fonts.sizes?.body || '13px',
            smallSize: fonts.sizes?.small || '12px',
            tinySize: fonts.sizes?.tiny || '11px',

            // Font metrics for layout calculations
            lineHeight: fontMetrics.lineHeight || 1.4,
            sectionGap: fontMetrics.sectionGap || 2.0,

            // Colors
            textSpeaker: colors.textSpeaker || '#ffd700',
            textPrimary: colors.textPrimary || '#e8e8e8',
            textSecondary: colors.textSecondary || '#aaaaaa',
            textDisabled: colors.textDisabled || '#666666',
            buttonNormal: colors.buttonNormal || 0x2d2d44,
            buttonHover: colors.buttonHover || 0x4a4a6a,
            buttonDisabled: colors.buttonDisabled || 0x222233,
            dialogBorder: colors.dialogBorder || 0x4a4a6a,
            dialogBg: colors.dialogBg || 0x1a1a2e,
            healthOk: colors.healthOk ? `#${colors.healthOk.toString(16).padStart(6, '0')}` : '#4ade80',
            healthDown: colors.healthDown ? `#${colors.healthDown.toString(16).padStart(6, '0')}` : '#ef4444',
            enemyName: colors.enemy?.name || '#ff6b6b',

            // Action button colors
            actionButtonBg: colors.actionButton?.bg || 0x2d5a27,
            actionButtonBgHover: colors.actionButton?.bgHover || 0x3d7a37,
            actionButtonBorder: colors.actionButton?.border || 0x4ade80,
            actionButtonBorderHover: colors.actionButton?.borderHover || 0x6bef6b,

            // Info button colors
            infoButtonBg: colors.infoButton?.bg || 0x3a3a5a,
            infoButtonBgHover: colors.infoButton?.bgHover || 0x5a5a7a,

            // Back button colors
            backButtonBg: colors.backButton?.bg || 0x2a2a3a,
            backButtonBgHover: colors.backButton?.bgHover || 0x3a3a4a,

            // Button dimensions - minimum 60px for mobile touch targets
            buttonHeight: Math.max(60, dims.buttonHeight || 52),
            buttonSpacing: dims.buttonSpacing || 8,
            borderRadius: dims.borderRadius || 6,
            namePaddingTop: dims.namePaddingTop || 8,
            descPaddingTop: dims.descPaddingTop || 28,
            rightColumnX: dims.rightColumnX || 45,
            sectionSpacing: dims.sectionSpacing || 16,
        };
    }

    /**
     * Show abilities for a character (list mode)
     * @param {Object} character - The acting character
     * @param {Object} abilities - { basic: Array, special: Array }
     * @param {Function} onSelect - Callback when ability selected
     * @param {Function} onBack - Callback to go back to character select
     */
    showAbilities(character, abilities, onSelect, onBack) {
        this.clearAll();
        this.onSelect = onSelect;
        this.onBack = onBack;
        this.currentCharacter = character;
        this.currentAbilities = abilities;
        this.viewMode = 'list';

        // Update title
        const firstName = character.name.split(' ')[0];
        this.title.setText(`${firstName}'s Abilities:`);

        let yOffset = 30;

        // Section: Basic Attacks
        if (abilities.basic.length > 0) {
            const basicSectionLabel = manifest.ui?.labels?.basicAttacksSection || '— Basic Attacks —';
            const basicLabel = createText(this.scene, 0, yOffset, basicSectionLabel, {
                fontSize: this.theme.tinySize,
                fontFamily: this.theme.fontFamily,
                color: this.theme.textSecondary
            });
            this.add(basicLabel);
            this.buttons.push(basicLabel);
            yOffset += 20;

            abilities.basic.forEach(ability => {
                const button = this.createAbilityButton(ability, 0, yOffset, true);
                this.buttons.push(button);
                this.add(button);
                yOffset += this.buttonHeight + this.buttonSpacing;
            });
        }

        // Section: Special Abilities
        if (abilities.special.length > 0) {
            yOffset += this.theme.sectionSpacing; // Proper spacing before section header
            const specialSectionLabel = manifest.ui?.labels?.specialAbilitiesSection || '— Special Abilities —';
            const specialLabel = createText(this.scene, 0, yOffset, specialSectionLabel, {
                fontSize: this.theme.tinySize,
                fontFamily: this.theme.fontFamily,
                color: this.theme.textSecondary
            });
            this.add(specialLabel);
            this.buttons.push(specialLabel);
            yOffset += 20;

            abilities.special.forEach(ability => {
                const button = this.createAbilityButton(ability, 0, yOffset, ability.available);
                this.buttons.push(button);
                this.add(button);
                yOffset += this.buttonHeight + this.buttonSpacing;
            });
        }

        // Position back button at bottom
        this.backButton.setY(yOffset + 10);
        this.backButton.setVisible(true);

        this.setVisible(true);
    }

    /**
     * Show detailed view for a single ability
     * @param {Object} ability - The ability to show details for
     */
    showAbilityDetail(ability) {
        this.clearButtons();
        this.viewMode = 'detail';
        this.selectedAbility = ability;

        // Update title
        this.title.setText(ability.name);

        const padding = 15;
        let contentY = 35;

        // Stat badge (if applicable)
        if (ability.stat) {
            const statBadge = createText(this.scene, padding, contentY, ability.stat.toUpperCase(), {
                fontSize: this.theme.smallSize,
                fontFamily: this.theme.fontFamily,
                fontStyle: 'bold',
                color: this.theme.textSpeaker
            });
            this.detailElements.push(statBadge);
            contentY += 24;
        }

        // Full description with word wrap
        const descText = createText(this.scene, padding, contentY, ability.description || 'No description available.', {
            fontSize: this.theme.bodySize,
            fontFamily: this.theme.fontFamily,
            color: this.theme.textPrimary,
            wordWrap: { width: this.panelWidth - padding * 2 },
            lineSpacing: 4
        });
        this.detailElements.push(descText);
        contentY += descText.height + 20;

        // Stats row (damage, uses)
        let statsX = padding;

        if (ability.damage) {
            const dmgLabel = createText(this.scene, statsX, contentY, `⚔ Damage: ${ability.damage}`, {
                fontSize: this.theme.smallSize,
                fontFamily: this.theme.fontFamily,
                color: this.theme.enemyName
            });
            this.detailElements.push(dmgLabel);
            statsX += dmgLabel.width + 20;
        }

        if (ability.uses !== undefined) {
            const usesText = ability.usesRemaining !== undefined
                ? `${ability.usesRemaining}/${ability.uses} uses`
                : `${ability.uses} uses`;
            const usesColor = ability.available !== false ? this.theme.healthOk : this.theme.healthDown;
            const usesLabel = createText(this.scene, statsX, contentY, usesText, {
                fontSize: this.theme.smallSize,
                fontFamily: this.theme.fontFamily,
                color: usesColor
            });
            this.detailElements.push(usesLabel);
        }

        if (ability.damage || ability.uses !== undefined) {
            contentY += 30;
        }

        // "Use this ability" button
        const useButton = this.createUseButton(ability, contentY, padding);
        this.detailElements.push(useButton);
        contentY += 50;

        // Calculate panel height and create background
        const panelHeight = contentY + 20;
        const panelBg = this.scene.add.graphics();
        panelBg.fillStyle(this.theme.dialogBg, 0.95);
        panelBg.fillRoundedRect(0, 28, this.panelWidth, panelHeight, this.theme.borderRadius);
        panelBg.lineStyle(1, this.theme.dialogBorder);
        panelBg.strokeRoundedRect(0, 28, this.panelWidth, panelHeight, this.theme.borderRadius);

        // Add background first (behind content), then add content on top
        this.add(panelBg);
        this.sendToBack(panelBg);
        this.detailElements.unshift(panelBg); // Track for cleanup

        // Add all the text elements to the container
        this.detailElements.forEach(el => {
            if (el !== panelBg) {
                this.add(el);
            }
        });

        // Position back button below panel
        this.backButton.setY(28 + panelHeight + 10);
        this.backButton.setVisible(true);
    }

    /**
     * Create the "Use this ability" button
     */
    createUseButton(ability, y, padding = 0) {
        const button = this.scene.add.container(padding, y);
        const buttonWidth = this.panelWidth - padding * 2;
        // Larger button for mobile touch targets (was 40, now 48)
        const buttonHeight = 48;

        const bg = this.scene.add.graphics();
        bg.fillStyle(this.theme.actionButtonBg, 1);
        bg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, this.theme.borderRadius);
        bg.lineStyle(2, this.theme.actionButtonBorder);
        bg.strokeRoundedRect(0, 0, buttonWidth, buttonHeight, this.theme.borderRadius);
        button.add(bg);

        const text = createCenteredText(this.scene, buttonWidth / 2, buttonHeight / 2, '⚔ Use this Ability', {
            fontSize: this.theme.bodySize,
            fontFamily: this.theme.fontFamily,
            fontStyle: 'bold',
            color: '#ffffff'
        });
        button.add(text);

        // Expanded hit area for mobile
        const hitPad = 5;
        bg.setInteractive(
            new Phaser.Geom.Rectangle(-hitPad, -hitPad, buttonWidth + hitPad * 2, buttonHeight + hitPad * 2),
            Phaser.Geom.Rectangle.Contains
        );

        bg.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(this.theme.actionButtonBgHover, 1);
            bg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, this.theme.borderRadius);
            bg.lineStyle(2, this.theme.actionButtonBorderHover);
            bg.strokeRoundedRect(0, 0, buttonWidth, buttonHeight, this.theme.borderRadius);
        });

        bg.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(this.theme.actionButtonBg, 1);
            bg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, this.theme.borderRadius);
            bg.lineStyle(2, this.theme.actionButtonBorder);
            bg.strokeRoundedRect(0, 0, buttonWidth, buttonHeight, this.theme.borderRadius);
        });

        // Touch feedback
        bg.on('pointerdown', () => {
            this.scene.tweens.add({
                targets: button,
                scaleX: 0.97,
                scaleY: 0.97,
                duration: 50
            });
        });

        bg.on('pointerup', () => {
            this.scene.tweens.add({
                targets: button,
                scaleX: 1,
                scaleY: 1,
                duration: 100
            });
            if (this.onSelect) {
                this.onSelect(ability);
            }
        });

        return button;
    }

    createAbilityButton(ability, x, y, available) {
        const button = this.scene.add.container(x, y);
        const infoButtonWidth = 36; // Width of the info button on right
        const mainWidth = this.panelWidth - infoButtonWidth;

        // Main button background (left side - for selecting ability)
        const bg = this.scene.add.graphics();
        const bgColor = available ? this.theme.buttonNormal : this.theme.buttonDisabled;
        bg.fillStyle(bgColor, 1);
        bg.fillRoundedRect(0, 0, mainWidth, this.buttonHeight, {
            tl: this.theme.borderRadius,
            tr: 0,
            bl: this.theme.borderRadius,
            br: 0
        });
        bg.lineStyle(1, this.theme.dialogBorder);
        bg.strokeRoundedRect(0, 0, mainWidth, this.buttonHeight, {
            tl: this.theme.borderRadius,
            tr: 0,
            bl: this.theme.borderRadius,
            br: 0
        });
        button.add(bg);

        // Info button background (right side - for showing details)
        const infoBg = this.scene.add.graphics();
        const infoBgColor = available ? this.theme.infoButtonBg : this.theme.buttonDisabled;
        infoBg.fillStyle(infoBgColor, 1);
        infoBg.fillRoundedRect(mainWidth, 0, infoButtonWidth, this.buttonHeight, {
            tl: 0,
            tr: this.theme.borderRadius,
            bl: 0,
            br: this.theme.borderRadius
        });
        infoBg.lineStyle(1, this.theme.dialogBorder);
        infoBg.strokeRoundedRect(mainWidth, 0, infoButtonWidth, this.buttonHeight, {
            tl: 0,
            tr: this.theme.borderRadius,
            bl: 0,
            br: this.theme.borderRadius
        });
        button.add(infoBg);

        // Info icon (ℹ or ?)
        const infoIcon = createCenteredText(this.scene, mainWidth + infoButtonWidth / 2, this.buttonHeight / 2, 'ℹ', {
            fontSize: this.theme.bodySize,
            fontFamily: this.theme.fontFamily,
            fontStyle: 'bold',
            color: available ? this.theme.textSecondary : this.theme.textDisabled
        });
        button.add(infoIcon);

        // Ability name
        const nameColor = available ? this.theme.textPrimary : this.theme.textDisabled;
        const name = createText(this.scene, 10, this.theme.namePaddingTop, ability.name, {
            fontSize: this.theme.bodySize,
            fontFamily: this.theme.fontFamily,
            fontStyle: 'bold',
            color: nameColor
        });
        button.add(name);

        // Calculate available width for description (leave room for info button)
        const descMaxWidth = mainWidth - 20;

        // Description / stat requirement - smart truncation
        const descColor = available ? this.theme.textSecondary : '#555555';
        const descStyle = {
            fontSize: this.theme.tinySize,
            fontFamily: this.theme.fontFamily,
        };
        let rawDesc = ability.description || 'No description';
        if (ability.stat) {
            rawDesc = `${ability.stat.toUpperCase()} • ${rawDesc}`;
        }
        // Add uses/damage inline if present
        const extras = [];
        if (ability.uses !== undefined) {
            const usesText = ability.usesRemaining !== undefined
                ? `${ability.usesRemaining}/${ability.uses}`
                : `${ability.uses}`;
            extras.push(usesText);
        }
        if (ability.damage) {
            extras.push(`⚔${ability.damage}`);
        }
        if (extras.length > 0) {
            rawDesc = `[${extras.join(' ')}] ${rawDesc}`;
        }
        const descText = truncateTextToWidth(this.scene, rawDesc, descMaxWidth, descStyle);
        const desc = createText(this.scene, 10, this.theme.descPaddingTop, descText, {
            ...descStyle,
            color: descColor
        });
        button.add(desc);

        // Only make interactive if available
        if (available) {
            // Main area - click to use ability immediately
            // Expanded hit area for mobile (5px padding top/bottom)
            const hitPadY = 5;
            bg.setInteractive(
                new Phaser.Geom.Rectangle(0, -hitPadY, mainWidth, this.buttonHeight + hitPadY * 2),
                Phaser.Geom.Rectangle.Contains
            );

            bg.on('pointerover', () => {
                bg.clear();
                bg.fillStyle(this.theme.buttonHover, 1);
                bg.fillRoundedRect(0, 0, mainWidth, this.buttonHeight, {
                    tl: this.theme.borderRadius,
                    tr: 0,
                    bl: this.theme.borderRadius,
                    br: 0
                });
                bg.lineStyle(1, this.theme.textSpeaker);
                bg.strokeRoundedRect(0, 0, mainWidth, this.buttonHeight, {
                    tl: this.theme.borderRadius,
                    tr: 0,
                    bl: this.theme.borderRadius,
                    br: 0
                });
            });

            bg.on('pointerout', () => {
                bg.clear();
                bg.fillStyle(this.theme.buttonNormal, 1);
                bg.fillRoundedRect(0, 0, mainWidth, this.buttonHeight, {
                    tl: this.theme.borderRadius,
                    tr: 0,
                    bl: this.theme.borderRadius,
                    br: 0
                });
                bg.lineStyle(1, this.theme.dialogBorder);
                bg.strokeRoundedRect(0, 0, mainWidth, this.buttonHeight, {
                    tl: this.theme.borderRadius,
                    tr: 0,
                    bl: this.theme.borderRadius,
                    br: 0
                });
            });

            // Touch feedback: scale down on press
            bg.on('pointerdown', () => {
                this.scene.tweens.add({
                    targets: button,
                    scaleX: 0.97,
                    scaleY: 0.97,
                    duration: 50
                });
            });

            // Trigger selection on pointer up for better mobile experience
            bg.on('pointerup', () => {
                this.scene.tweens.add({
                    targets: button,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 100
                });
                if (this.onSelect) {
                    this.onSelect(ability);
                }
            });

            // Info button - click to show details
            // Expanded hit area for mobile (5px padding top/bottom, 10px on right)
            infoBg.setInteractive(
                new Phaser.Geom.Rectangle(mainWidth, -hitPadY, infoButtonWidth + 10, this.buttonHeight + hitPadY * 2),
                Phaser.Geom.Rectangle.Contains
            );

            infoBg.on('pointerover', () => {
                infoBg.clear();
                infoBg.fillStyle(this.theme.infoButtonBgHover, 1);
                infoBg.fillRoundedRect(mainWidth, 0, infoButtonWidth, this.buttonHeight, {
                    tl: 0,
                    tr: this.theme.borderRadius,
                    bl: 0,
                    br: this.theme.borderRadius
                });
                infoBg.lineStyle(1, this.theme.textSpeaker);
                infoBg.strokeRoundedRect(mainWidth, 0, infoButtonWidth, this.buttonHeight, {
                    tl: 0,
                    tr: this.theme.borderRadius,
                    bl: 0,
                    br: this.theme.borderRadius
                });
                infoIcon.setColor('#ffffff');
            });

            infoBg.on('pointerout', () => {
                infoBg.clear();
                infoBg.fillStyle(this.theme.infoButtonBg, 1);
                infoBg.fillRoundedRect(mainWidth, 0, infoButtonWidth, this.buttonHeight, {
                    tl: 0,
                    tr: this.theme.borderRadius,
                    bl: 0,
                    br: this.theme.borderRadius
                });
                infoBg.lineStyle(1, this.theme.dialogBorder);
                infoBg.strokeRoundedRect(mainWidth, 0, infoButtonWidth, this.buttonHeight, {
                    tl: 0,
                    tr: this.theme.borderRadius,
                    bl: 0,
                    br: this.theme.borderRadius
                });
                infoIcon.setColor(this.theme.textSecondary);
            });

            // Touch feedback for info button
            infoBg.on('pointerdown', () => {
                this.scene.tweens.add({
                    targets: infoIcon,
                    scaleX: 0.9,
                    scaleY: 0.9,
                    duration: 50
                });
            });

            infoBg.on('pointerup', () => {
                this.scene.tweens.add({
                    targets: infoIcon,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 100
                });
                // Show detail view
                this.showAbilityDetail(ability);
            });
        }

        return button;
    }

    createBackButton() {
        const button = this.scene.add.container(0, 0);

        // Larger back button for mobile (was 80x30, now 90x40)
        const btnWidth = 90;
        const btnHeight = 40;

        const bg = this.scene.add.graphics();
        bg.fillStyle(this.theme.backButtonBg, 1);
        bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 4);
        button.add(bg);

        const text = createCenteredText(this.scene, btnWidth / 2, btnHeight / 2, '← Back', {
            fontSize: this.theme.smallSize,
            fontFamily: this.theme.fontFamily,
            color: this.theme.textSecondary
        });
        button.add(text);

        // Expanded hit area for mobile
        const hitPad = 5;
        bg.setInteractive(
            new Phaser.Geom.Rectangle(-hitPad, -hitPad, btnWidth + hitPad * 2, btnHeight + hitPad * 2),
            Phaser.Geom.Rectangle.Contains
        );

        bg.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(this.theme.backButtonBgHover, 1);
            bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 4);
        });

        bg.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(this.theme.backButtonBg, 1);
            bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 4);
        });

        // Touch feedback
        bg.on('pointerdown', () => {
            this.scene.tweens.add({
                targets: button,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 50
            });
        });

        bg.on('pointerup', () => {
            this.scene.tweens.add({
                targets: button,
                scaleX: 1,
                scaleY: 1,
                duration: 100
            });
            this.handleBack();
        });

        button.setVisible(false);
        return button;
    }

    /**
     * Handle back button - context-aware navigation
     */
    handleBack() {
        if (this.viewMode === 'detail') {
            // Return to list view
            this.showAbilities(this.currentCharacter, this.currentAbilities, this.onSelect, this.onBack);
        } else {
            // Return to character select
            if (this.onBack) {
                this.onBack();
            }
        }
    }

    /**
     * Clear list view buttons
     */
    clearButtons() {
        this.buttons.forEach(btn => btn.destroy());
        this.buttons = [];
    }

    /**
     * Clear detail view elements
     */
    clearDetailElements() {
        this.detailElements.forEach(el => el.destroy());
        this.detailElements = [];
    }

    /**
     * Clear all UI elements
     */
    clearAll() {
        this.clearButtons();
        this.clearDetailElements();
    }

    hide() {
        this.setVisible(false);
    }
}
