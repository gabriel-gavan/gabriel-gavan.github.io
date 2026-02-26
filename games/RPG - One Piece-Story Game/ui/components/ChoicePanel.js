import Phaser from 'phaser';
import { ChoiceButton } from './ChoiceButton.js';

/**
 * ChoicePanel - Container for multiple choice buttons
 */
export class ChoicePanel extends Phaser.GameObjects.Container {
    constructor(scene, x, y, width, buttonHeight = 52, buttonSpacing = 10) {
        super(scene, x, y);

        this.panelWidth = width;
        this.buttons = [];
        this.buttonHeight = buttonHeight;
        this.buttonSpacing = buttonSpacing;

        scene.add.existing(this);
    }

    /**
     * Display choices as buttons
     * @param {Array} choices - Array of {id, label} objects
     * @param {Function} onSelect - Callback with choice object
     */
    showChoices(choices, onSelect) {
        this.clearButtons();

        choices.forEach((choice, index) => {
            const y = index * (this.buttonHeight + this.buttonSpacing);

            // Format label with character name if specified
            let displayLabel = choice.label;
            if (choice.character) {
                const charName = choice.character.charAt(0).toUpperCase() + choice.character.slice(1);
                displayLabel = `[${charName}] ${choice.label}`;
            }

            const button = new ChoiceButton(
                this.scene,
                0,
                y,
                this.panelWidth,
                this.buttonHeight,
                displayLabel,
                () => onSelect(choice)
            );
            this.buttons.push(button);
            this.add(button);
        });
    }

    clearButtons() {
        this.buttons.forEach(btn => btn.destroy());
        this.buttons = [];
    }

    hide() {
        this.setVisible(false);
    }

    show() {
        this.setVisible(true);
    }
}
