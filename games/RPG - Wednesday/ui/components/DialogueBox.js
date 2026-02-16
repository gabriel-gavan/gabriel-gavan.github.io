import Phaser from 'phaser';
import { createText, TEXT_STYLES, getResponsiveFontSize } from '../../utils/TextUtils.js';
import { manifest } from '../../manifest.js';

// Layout constants
const INDICATOR_RIGHT_MARGIN = 35;
const INDICATOR_BOTTOM_MARGIN = 28;
const TEXT_BOTTOM_MARGIN = 40; // Space for indicator below text

/**
 * DialogueBox - Displays narrative text and speaker name
 *
 * Uses simple word-by-word pagination: measures text using mainText directly
 * (no temp text object), adds words until overflow, then starts new page.
 *
 * All visual properties are themeable via manifest.ui
 */
export class DialogueBox extends Phaser.GameObjects.Container {
    constructor(scene, x, y, width, height) {
        super(scene, x, y);

        this.boxWidth = width;
        this.boxHeight = height;
        this.isWaitingForClick = false;
        this.onContinue = null;

        // Cache theme values for performance
        this.theme = this.getThemeValues();

        // Pagination state
        this.pages = [];
        this.currentPageIndex = 0;
        this.fullText = ''; // Store original text for pagination
        this.maxTextHeight = height - this.theme.textY - TEXT_BOTTOM_MARGIN;

        // Background panel
        this.bg = scene.add.graphics();
        this.drawBackground(width, height);
        this.add(this.bg);

        // Speaker name
        const responsiveSpeakerStyle = {
            ...TEXT_STYLES.speaker,
            fontSize: getResponsiveFontSize(TEXT_STYLES.speaker.fontSize || '18px', scene)
        };
        this.speakerText = createText(scene, this.theme.padding, this.theme.speakerY, '', responsiveSpeakerStyle);
        this.add(this.speakerText);

        // Main text
        const responsiveDialogueStyle = {
            ...TEXT_STYLES.dialogue,
            fontSize: getResponsiveFontSize(TEXT_STYLES.dialogue.fontSize || '16px', scene),
            wordWrap: { width: width - (this.theme.padding * 2) }
        };
        this.mainText = createText(scene, this.theme.padding, this.theme.textY, '', responsiveDialogueStyle);
        this.add(this.mainText);

        // Continue indicator
        const continueSymbol = manifest.ui?.labels?.continueIndicator || '▼';
        const responsiveIndicatorSize = getResponsiveFontSize(`${this.theme.indicatorSize + 4}px`, scene);
        this.continueIndicator = createText(scene, width - INDICATOR_RIGHT_MARGIN, height - INDICATOR_BOTTOM_MARGIN, continueSymbol, {
            fontSize: responsiveIndicatorSize,
            color: this.theme.textPrimary
        });
        this.continueIndicator.setAlpha(0);
        this.add(this.continueIndicator);

        // Make interactive
        this.bg.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, width, height),
            Phaser.Geom.Rectangle.Contains
        );
        this.bg.on('pointerdown', () => this.handleClick());

        scene.add.existing(this);
    }

    drawBackground(width, height) {
        this.bg.clear();
        this.bg.fillStyle(this.theme.dialogBg, 0.95);
        this.bg.fillRoundedRect(0, 0, width, height, this.theme.borderRadius);
        this.bg.lineStyle(2, this.theme.dialogBorder);
        this.bg.strokeRoundedRect(0, 0, width, height, this.theme.borderRadius);
    }

    getThemeValues() {
        const colors = manifest.ui?.colors || {};
        const dims = manifest.ui?.dimensions?.dialogue || {};
        const anim = manifest.ui?.animation || {};

        return {
            dialogBg: colors.dialogBg || 0x1a1a2e,
            dialogBorder: colors.dialogBorder || 0x4a4a6a,
            textPrimary: colors.textPrimary || '#e8e8e8',
            padding: dims.padding || 20,
            speakerY: dims.speakerY || 15,
            textY: dims.textY || 45,
            indicatorSize: dims.indicatorSize || 14,
            borderRadius: dims.borderRadius || 12,
            continuePulse: anim.continuePulse || 600,
        };
    }

    /**
     * Display text with optional speaker
     */
    setText(text, speaker = null) {
        this.speakerText.setText(speaker || '');
        this.isWaitingForClick = false;
        this.continueIndicator.setAlpha(0);
        this.scene.tweens.killTweensOf(this.continueIndicator);

        // Store original text for pagination
        this.fullText = text || '';

        // Paginate and display
        this.pages = this.paginateText(this.fullText);
        this.currentPageIndex = 0;
        this.showCurrentPage();
    }

    /**
     * Simple word-by-word pagination using mainText for measurement
     * No temp text = no measurement mismatch
     */
    paginateText(text) {
        if (!text.trim()) return [''];

        const words = text.split(/(\s+)/); // Keep whitespace as separate tokens
        const pages = [];
        let currentPage = '';

        for (const word of words) {
            const testText = currentPage + word;
            this.mainText.setText(testText);

            if (this.mainText.height > this.maxTextHeight && currentPage.trim()) {
                // Current page is full, start new page
                pages.push(currentPage.trim());
                currentPage = word.trim() ? word : '';
            } else {
                currentPage = testText;
            }
        }

        // Add final page
        if (currentPage.trim()) {
            pages.push(currentPage.trim());
        }

        return pages.length > 0 ? pages : [''];
    }

    showCurrentPage() {
        this.mainText.setText(this.pages[this.currentPageIndex] || '');

        // Show indicator if more pages
        if (this.hasMorePages()) {
            this.continueIndicator.setAlpha(0.7);
        } else {
            this.continueIndicator.setAlpha(0);
        }
    }

    hasMorePages() {
        return this.currentPageIndex < this.pages.length - 1;
    }

    nextPage() {
        if (this.hasMorePages()) {
            this.currentPageIndex++;
            this.showCurrentPage();
            return true;
        }
        return false;
    }

    waitForContinue(callback) {
        this.isWaitingForClick = true;
        this.onContinue = callback;

        this.continueIndicator.setAlpha(1);
        this.scene.tweens.add({
            targets: this.continueIndicator,
            alpha: 0.3,
            duration: this.theme.continuePulse,
            yoyo: true,
            repeat: -1
        });
    }

    handleClick() {
        if (this.nextPage()) {
            return;
        }

        if (this.isWaitingForClick && this.onContinue) {
            this.scene.tweens.killTweensOf(this.continueIndicator);
            this.continueIndicator.setAlpha(0);
            this.isWaitingForClick = false;
            const callback = this.onContinue;
            this.onContinue = null;
            callback();
        }
    }
}
