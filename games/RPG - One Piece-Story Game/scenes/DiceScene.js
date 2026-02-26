import Phaser from 'phaser';
import { performRoll } from '../systems/rules/DiceRules.js';
import { createCenteredText, createText, TEXT_STYLES } from '../utils/TextUtils.js';
import { getSoundEffects } from '../audio/SoundEffects.js';
import { manifest } from '../manifest.js';

/**
 * DiceScene - Overlay scene for dice roll animations
 *
 * Shows: Actor name, stat being tested, animated d20, result with tier
 */

// Get tier colors from manifest with fallbacks
function getTierColors() {
    const diceColors = manifest.ui?.colors?.dice || {};
    return {
        critical: diceColors.critical || 0xffd700,  // Gold
        success: diceColors.success || 0x4ade80,   // Green
        partial: diceColors.partial || 0xfbbf24,   // Yellow/Orange
        failure: diceColors.failure || 0xef4444    // Red
    };
}

const TIER_LABELS = {
    critical: 'CRITICAL!',
    success: 'Success',
    partial: 'Partial',
    failure: 'Failure'
};

// Animation tuning constants
const ANIMATION = {
    rollCycles: 15,        // Number of random numbers shown
    cycleDelay: 60,        // ms between each cycle
    shakeIntensity: 8,     // Pixels of shake during roll
    resultDelay: 300,      // ms before showing continue prompt
    fadeOutDuration: 300   // ms for fade out
};

export class DiceScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DiceScene' });
    }

    /**
     * Called when scene is launched with roll data
     * @param {Object} data - { stat, statName, bonus, difficulty, actorName, onComplete }
     */
    init(data) {
        this.rollData = data;
        // Reset state for new roll (scene instance persists between launches)
        this.isCompleting = false;
    }

    create() {
        const { width, height } = this.scale;

        // Get sound effects instance
        this.soundEffects = getSoundEffects();

        // Dim overlay
        this.overlay = this.add.graphics();
        this.overlay.fillStyle(0x000000, 0.8);
        this.overlay.fillRect(0, 0, width, height);

        // Container for dice UI (centered)
        this.diceContainer = this.add.container(width / 2, height / 2);

        // Actor and stat info
        const headerText = `${this.rollData.actorName} rolls ${this.rollData.statName}`;
        this.header = createCenteredText(this, 0, -100, headerText, TEXT_STYLES.diceHeader);
        this.diceContainer.add(this.header);

        // Difficulty indicator
        const diffText = `Difficulty: ${this.rollData.difficulty}`;
        this.diffLabel = createCenteredText(this, 0, -70, diffText, { ...TEXT_STYLES.hint, color: '#aaaaaa' });
        this.diceContainer.add(this.diffLabel);

        // Cache dice colors from manifest
        this.diceColors = manifest.ui?.colors?.dice || {};

        // Dice display (will animate)
        this.diceBox = this.add.graphics();
        this.drawDiceBox(this.diceColors.boxBg || 0x333355);
        this.diceContainer.add(this.diceBox);

        this.diceText = createCenteredText(this, 0, 0, '?', {
            fontSize: '48px',
            fontStyle: 'bold',
            color: '#ffffff'
        });
        this.diceContainer.add(this.diceText);

        // Result text (hidden initially)
        this.resultText = createCenteredText(this, 0, 80, '', TEXT_STYLES.diceResult);
        this.resultText.setAlpha(0);
        this.diceContainer.add(this.resultText);

        // Tier label (hidden initially)
        this.tierText = createCenteredText(this, 0, 115, '', TEXT_STYLES.diceTier);
        this.tierText.setAlpha(0);
        this.diceContainer.add(this.tierText);

        // Start roll animation
        this.animateRoll();
    }

    drawDiceBox(color) {
        this.diceBox.clear();
        this.diceBox.fillStyle(color, 1);
        this.diceBox.fillRoundedRect(-40, -40, 80, 80, 12);
        this.diceBox.lineStyle(3, this.diceColors?.boxBorder || 0x666688);
        this.diceBox.strokeRoundedRect(-40, -40, 80, 80, 12);
    }

    animateRoll() {
        // Perform the actual roll
        this.result = performRoll(this.rollData.bonus, this.rollData.difficulty);

        // Animate random numbers cycling
        let cycles = 0;

        const rollTimer = this.time.addEvent({
            delay: ANIMATION.cycleDelay,
            callback: () => {
                cycles++;
                // Show random number during animation
                const fakeRoll = Math.floor(Math.random() * 20) + 1;
                this.diceText.setText(fakeRoll.toString());

                // Shake effect
                const shake = ANIMATION.shakeIntensity;
                this.diceContainer.x = (this.scale.width / 2) + (Math.random() - 0.5) * shake;
                this.diceContainer.y = (this.scale.height / 2) + (Math.random() - 0.5) * shake;

                if (cycles >= ANIMATION.rollCycles) {
                    rollTimer.destroy();
                    this.showResult();
                }
            },
            repeat: ANIMATION.rollCycles - 1
        });
    }

    showResult() {
        // Reset position
        this.diceContainer.x = this.scale.width / 2;
        this.diceContainer.y = this.scale.height / 2;

        // Show actual roll
        this.diceText.setText(this.result.roll.toString());

        // Color dice based on natural 20/1
        if (this.result.isNat20) {
            this.drawDiceBox(this.diceColors.criticalTint || 0x4a6741);  // Green tint
        } else if (this.result.isNat1) {
            this.drawDiceBox(this.diceColors.failureTint || 0x6b3030);  // Red tint
        }

        // Play sound based on result tier
        if (this.result.tier === 'critical') {
            this.soundEffects.playCritical();
        } else if (this.result.tier === 'failure') {
            this.soundEffects.playCriticalFail();
        }

        // Show breakdown
        const bonusText = this.result.bonus >= 0 ? `+${this.result.bonus}` : this.result.bonus.toString();
        this.resultText.setText(`${this.result.roll} ${bonusText} = ${this.result.total}`);

        // Show tier
        const tierColors = getTierColors();
        const tierColor = tierColors[this.result.tier];
        this.tierText.setText(TIER_LABELS[this.result.tier]);
        this.tierText.setColor(`#${tierColor.toString(16).padStart(6, '0')}`);

        // Animate results appearing
        this.tweens.add({
            targets: [this.resultText, this.tierText],
            alpha: 1,
            duration: 300,
            ease: 'Power2'
        });

        // Scale pop for tier text
        this.tierText.setScale(0.5);
        this.tweens.add({
            targets: this.tierText,
            scale: 1,
            duration: 400,
            ease: 'Back.easeOut'
        });

        // Show "click to continue" prompt
        this.continueText = createCenteredText(this, 0, 160, 'Click to continue...', TEXT_STYLES.hint);
        this.continueText.setAlpha(0);
        this.diceContainer.add(this.continueText);

        // Fade in the continue prompt
        this.tweens.add({
            targets: this.continueText,
            alpha: 1,
            duration: 500,
            delay: ANIMATION.resultDelay
        });

        // Wait for click to dismiss
        this.input.once('pointerdown', () => {
            this.completeRoll();
        });
    }

    completeRoll() {
        // Guard against double-clicks during fade
        if (this.isCompleting) return;
        this.isCompleting = true;

        // Fade out
        this.tweens.add({
            targets: [this.overlay, this.diceContainer],
            alpha: 0,
            duration: ANIMATION.fadeOutDuration,
            ease: 'Power2',
            onComplete: () => {
                if (this.rollData?.onComplete) {
                    this.rollData.onComplete(this.result);
                }
                this.scene.stop();
            }
        });
    }
}
