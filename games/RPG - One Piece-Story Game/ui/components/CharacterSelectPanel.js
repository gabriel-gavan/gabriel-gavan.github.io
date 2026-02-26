import Phaser from 'phaser';
import { createText, createCenteredText } from '../../utils/TextUtils.js';
import { UI_COLORS } from '../styles/UIColors.js';
import { manifest } from '../../manifest.js';

/**
 * CharacterSelectPanel - Pick which party member acts this turn
 *
 * Displays active party members as horizontal cards.
 * Downed characters are not shown.
 */
export class CharacterSelectPanel extends Phaser.GameObjects.Container {
    constructor(scene, x, y, width) {
        super(scene, x, y);

        this.panelWidth = width;
        // Increased card size for better mobile touch targets (was 90x80)
        this.cardWidth = 100;
        this.cardHeight = 90;
        this.cards = [];
        this.onSelect = null;

        // Cache theme values
        const fonts = manifest.ui?.fonts || {};
        const colors = manifest.ui?.colors || {};
        this.theme = {
            fontFamily: fonts.primary || 'Georgia, serif',
            textSpeaker: colors.textSpeaker || '#ffd700',
            textPrimary: colors.textPrimary || '#e8e8e8',
            healthBarBg: 0x333333,
        };

        // Title - read from manifest for content-agnostic theming
        const defaultLabel = manifest.ui?.labels?.characterSelect || 'Choose a Character:';
        this.title = createText(scene, 0, 0, defaultLabel, {
            fontSize: '14px',
            fontFamily: this.theme.fontFamily,
            fontStyle: 'bold',
            color: this.theme.textSpeaker
        });
        this.add(this.title);

        scene.add.existing(this);
    }

    /**
     * Show character selection
     * @param {Array} characters - Active party members
     * @param {Function} onSelect - Callback when character selected
     * @param {string} [customTitle] - Optional custom title (for ally targeting)
     */
    showCharacters(characters, onSelect, customTitle = null) {
        this.clearCards();
        this.onSelect = onSelect;

        // Update title if custom title provided, otherwise use manifest label
        const defaultLabel = manifest.ui?.labels?.characterSelect || 'Choose a Character:';
        this.title.setText(customTitle || defaultLabel);

        const startX = 0;
        const spacing = 10;

        characters.forEach((char, index) => {
            const x = startX + index * (this.cardWidth + spacing);
            const card = this.createCharacterCard(char, x, 25);
            this.cards.push(card);
            this.add(card);
        });

        this.setVisible(true);
    }

    createCharacterCard(character, x, y) {
        const card = this.scene.add.container(x, y);

        // Card background
        const bg = this.scene.add.graphics();
        bg.fillStyle(UI_COLORS.buttonNormal, 1);
        bg.fillRoundedRect(0, 0, this.cardWidth, this.cardHeight, 8);
        bg.lineStyle(2, UI_COLORS.dialogBorder);
        bg.strokeRoundedRect(0, 0, this.cardWidth, this.cardHeight, 8);
        card.add(bg);

        // Character Portrait (adjusted for larger card)
        if (character.images?.portrait) {
            const textureKey = `char_${character.id}_portrait`;
            const portrait = this.scene.add.image(this.cardWidth / 2, 28, null); // Centered in top half
            
            if (this.scene.textures.exists(textureKey)) {
                portrait.setTexture(textureKey);
                this.scalePortrait(portrait);
                card.add(portrait);
            } else {
                this.scene.load.image(textureKey, character.images.portrait);
                this.scene.load.once(`filecomplete-image-${textureKey}`, () => {
                    portrait.setTexture(textureKey);
                    this.scalePortrait(portrait);
                });
                this.scene.load.start();
                card.add(portrait);
            }
        }

        // Character name (adjusted for larger card)
        const firstName = character.name.split(' ')[0];
        const name = createCenteredText(this.scene, this.cardWidth / 2, 50, firstName, {
            fontSize: '14px',
            fontFamily: this.theme.fontFamily,
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        });
        card.add(name);

        // Health bar (adjusted for larger card)
        const barWidth = this.cardWidth - 20;
        const healthPercent = character.currentHealth / character.maxHealth;
        const healthColor = character.status === 'hurt' ? UI_COLORS.healthHurt : UI_COLORS.healthOk;

        const barBg = this.scene.add.graphics();
        barBg.fillStyle(this.theme.healthBarBg, 1);
        barBg.fillRoundedRect(10, 68, barWidth, 8, 3);
        card.add(barBg);

        const barFill = this.scene.add.graphics();
        barFill.fillStyle(healthColor, 1);
        barFill.fillRoundedRect(10, 68, barWidth * healthPercent, 8, 3);
        card.add(barFill);

        // HP text (adjusted for larger card)
        const hpText = createCenteredText(this.scene, this.cardWidth / 2, 80,
            `${character.currentHealth}/${character.maxHealth}`, {
                fontSize: '11px',
                fontFamily: this.theme.fontFamily,
                color: this.theme.textPrimary
            });
        card.add(hpText);

        // Make interactive - expanded hit area for mobile (10px padding on each side)
        const hitPad = 10;
        bg.setInteractive(
            new Phaser.Geom.Rectangle(-hitPad, -hitPad, this.cardWidth + hitPad * 2, this.cardHeight + hitPad * 2),
            Phaser.Geom.Rectangle.Contains
        );

        bg.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(UI_COLORS.buttonHover, 1);
            bg.fillRoundedRect(0, 0, this.cardWidth, this.cardHeight, 8);
            bg.lineStyle(2, this.theme.textSpeaker);
            bg.strokeRoundedRect(0, 0, this.cardWidth, this.cardHeight, 8);
        });

        bg.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(UI_COLORS.buttonNormal, 1);
            bg.fillRoundedRect(0, 0, this.cardWidth, this.cardHeight, 8);
            bg.lineStyle(2, UI_COLORS.dialogBorder);
            bg.strokeRoundedRect(0, 0, this.cardWidth, this.cardHeight, 8);
        });

        // Touch feedback: scale down on press
        bg.on('pointerdown', () => {
            this.scene.tweens.add({
                targets: card,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 50
            });
        });

        // Trigger selection on pointer up for better mobile experience
        bg.on('pointerup', () => {
            this.scene.tweens.add({
                targets: card,
                scaleX: 1,
                scaleY: 1,
                duration: 100
            });
            if (this.onSelect) {
                this.onSelect(character);
            }
        });

        return card;
    }

    scalePortrait(sprite) {
        const maxSize = 40;
        if (sprite.width > maxSize || sprite.height > maxSize) {
            const scale = maxSize / Math.max(sprite.width, sprite.height);
            sprite.setScale(scale);
        }
    }

    clearCards() {
        this.cards.forEach(card => card.destroy());
        this.cards = [];
    }

    hide() {
        this.setVisible(false);
    }
}
