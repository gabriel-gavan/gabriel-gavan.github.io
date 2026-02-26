import Phaser from 'phaser';
import { createCenteredText } from '../../utils/TextUtils.js';
import { UI_COLORS } from '../styles/UIColors.js';
import { ChoiceButton } from './ChoiceButton.js';
import { manifest } from '../../manifest.js';

/**
 * CombatErrorDialog - Shows error with retry option
 */
export class CombatErrorDialog extends Phaser.GameObjects.Container {
    constructor(scene, x, y, width = 300, height = 150) {
        super(scene, x, y);

        // Get error colors from manifest
        const colors = manifest.ui?.colors || {};
        const errorColor = colors.enemy?.name || '#ff6b6b';
        const errorColorHex = typeof errorColor === 'string' ?
            parseInt(errorColor.replace('#', ''), 16) : errorColor;
        const overlayColor = colors.overlay?.dark || 0x000000;

        // Semi-transparent overlay
        this.overlay = scene.add.graphics();
        this.overlay.fillStyle(overlayColor, 0.7);
        this.overlay.fillRect(-x, -y, scene.cameras.main.width, scene.cameras.main.height);
        this.add(this.overlay);

        // Dialog box
        this.bg = scene.add.graphics();
        this.bg.fillStyle(UI_COLORS.dialogBg, 0.98);
        this.bg.fillRoundedRect(0, 0, width, height, 12);
        this.bg.lineStyle(2, errorColorHex);
        this.bg.strokeRoundedRect(0, 0, width, height, 12);
        this.add(this.bg);

        // Error icon
        this.icon = createCenteredText(scene, width / 2, 30, '⚠', {
            fontSize: '24px',
            color: errorColor
        });
        this.add(this.icon);

        // Message
        this.message = createCenteredText(scene, width / 2, 60, '', {
            fontSize: '14px',
            fontFamily: 'Georgia, serif',
            color: UI_COLORS.textPrimary,
            wordWrap: { width: width - 40 }
        });
        this.add(this.message);

        // Retry button
        this.retryButton = new ChoiceButton(scene, 50, 100, width - 100, 36, 'Try Again', () => {
            this.hide();
            if (this.onRetry) this.onRetry();
        });
        this.add(this.retryButton);

        this.setVisible(false);
        scene.add.existing(this);
    }

    show(message, onRetry) {
        this.message.setText(message);
        this.onRetry = onRetry;
        this.setVisible(true);
    }

    hide() {
        this.setVisible(false);
    }
}
