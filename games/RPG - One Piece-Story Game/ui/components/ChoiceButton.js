import Phaser from 'phaser';
import { createCenteredText, TEXT_STYLES } from '../../utils/TextUtils.js';
import { UI_COLORS } from '../styles/UIColors.js';

/**
 * ChoiceButton - Single interactive choice button
 */
export class ChoiceButton extends Phaser.GameObjects.Container {
    constructor(scene, x, y, width, height, label, onClick) {
        super(scene, x, y);

        this.buttonWidth = width;
        // Enforce minimum 60px height for mobile touch targets
        this.buttonHeight = Math.max(60, height);

        // Button background
        this.bg = scene.add.graphics();
        this.drawButton(UI_COLORS.buttonNormal);
        this.add(this.bg);

        // Button text (extra horizontal padding for buttons)
        this.label = createCenteredText(scene, width / 2, this.buttonHeight / 2, label, {
            ...TEXT_STYLES.button,
            wordWrap: { width: width - 40 }
        }, { padding: { left: 10, top: 6, right: 10, bottom: 6 } });
        this.add(this.label);

        // Interactivity - expanded hit area for mobile (10px padding on sides, 5px top/bottom)
        const hitPadX = 10;
        const hitPadY = 5;
        this.bg.setInteractive(
            new Phaser.Geom.Rectangle(-hitPadX, -hitPadY, width + hitPadX * 2, this.buttonHeight + hitPadY * 2),
            Phaser.Geom.Rectangle.Contains
        );

        this.bg.on('pointerover', () => {
            this.drawButton(UI_COLORS.buttonHover);
            scene.tweens.add({
                targets: this,
                scaleX: 1.02,
                scaleY: 1.02,
                duration: 100
            });
        });

        this.bg.on('pointerout', () => {
            this.drawButton(UI_COLORS.buttonNormal);
            scene.tweens.add({
                targets: this,
                scaleX: 1,
                scaleY: 1,
                duration: 100
            });
        });

        // Touch feedback: scale down on press, trigger action on release
        this.bg.on('pointerdown', () => {
            scene.tweens.add({
                targets: this,
                scaleX: 0.97,
                scaleY: 0.97,
                duration: 50
            });
        });

        this.bg.on('pointerup', () => {
            scene.tweens.add({
                targets: this,
                scaleX: 1,
                scaleY: 1,
                duration: 100
            });
            onClick();
        });

        scene.add.existing(this);
    }

    drawButton(color) {
        this.bg.clear();
        this.bg.fillStyle(color, 1);
        this.bg.fillRoundedRect(0, 0, this.buttonWidth, this.buttonHeight, 8);
        this.bg.lineStyle(1, UI_COLORS.dialogBorder);
        this.bg.strokeRoundedRect(0, 0, this.buttonWidth, this.buttonHeight, 8);
    }

    setLabel(text) {
        this.label.setText(text);
    }
}
