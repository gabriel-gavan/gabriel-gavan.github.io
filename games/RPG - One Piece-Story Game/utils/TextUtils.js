/**
 * TextUtils - Text creation helpers for Phaser
 *
 * Phaser's text rendering doesn't fully account for font descenders (g, y, p, q).
 * These utilities apply padding automatically to prevent clipping.
 *
 * Descender padding is configurable via manifest.ui.fonts.metrics.descenderPadding
 *
 * Mobile Responsiveness:
 * - getResponsiveFontSize() scales fonts up on smaller screens to maintain readability
 * - Use when the canvas is scaled down on mobile devices
 */

import { manifest } from '../manifest.js';

// Mobile breakpoint - screens narrower than this get mobile treatment
export const MOBILE_BREAKPOINT = 600;

// Fallback padding values if manifest doesn't define them
const FALLBACK_PADDING = {
    small: { top: 2, bottom: 6 },   // For fonts <= 16px
    medium: { top: 3, bottom: 8 },  // For fonts 17-27px
    large: { top: 4, bottom: 10 }   // For fonts >= 28px
};

/**
 * Get descender padding from manifest or use fallbacks
 */
function getDescenderPadding() {
    const manifestPadding = manifest.ui?.fonts?.metrics?.descenderPadding;
    if (manifestPadding) {
        return {
            small: manifestPadding.small || FALLBACK_PADDING.small,
            medium: manifestPadding.medium || FALLBACK_PADDING.medium,
            large: manifestPadding.large || FALLBACK_PADDING.large,
        };
    }
    return FALLBACK_PADDING;
}

/**
 * Determine padding size based on font size
 */
function getPaddingForFontSize(fontSize) {
    const padding = getDescenderPadding();
    const size = parseInt(fontSize, 10) || 16;
    if (size >= 28) return padding.large;
    if (size >= 17) return padding.medium;
    return padding.small;
}

/**
 * Get a responsive font size that scales up on smaller screens
 *
 * When the game canvas (800x600) is scaled down to fit mobile viewports,
 * text becomes proportionally smaller. This function compensates by
 * increasing font sizes when the effective canvas width is reduced.
 *
 * @param {string} baseSize - Base font size (e.g., "14px" or "16px")
 * @param {Phaser.Scene} scene - The scene to check scale from
 * @returns {string} Scaled font size (e.g., "16px")
 */
export function getResponsiveFontSize(baseSize, scene) {
    // Get mobile scale factor from manifest (default 1.15 = 15% larger)
    const mobileConfig = manifest.ui?.fonts?.mobile || {};
    const mobileScaleFactor = mobileConfig.scaleFactor || 1.15;

    // Get the current canvas width
    const width = scene?.scale?.width || 800;

    // Scale up fonts on mobile viewports
    const scaleFactor = width < MOBILE_BREAKPOINT ? mobileScaleFactor : 1.0;

    // Parse the base size and apply scaling
    const sizeValue = parseInt(baseSize, 10) || 14;
    return `${Math.round(sizeValue * scaleFactor)}px`;
}

/**
 * Create a text object with descender-safe padding
 *
 * @param {Phaser.Scene} scene - The scene to add text to
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} text - Text content
 * @param {object} style - Phaser text style config
 * @param {object} options - Additional options
 * @param {boolean} options.autoAdd - Whether to add to scene (default: true)
 * @param {object} options.padding - Override padding {left, top, right, bottom}
 * @returns {Phaser.GameObjects.Text}
 */
export function createText(scene, x, y, text, style = {}, options = {}) {
    const fonts = manifest.ui?.fonts || {};
    const textObj = scene.add.text(x, y, text, {
        fontFamily: fonts.primary || 'Georgia, serif',
        color: '#ffffff',
        ...style
    });

    // Apply padding based on font size or custom override
    const defaultPadding = getPaddingForFontSize(style.fontSize);
    const padding = options.padding || defaultPadding;

    textObj.setPadding(
        padding.left ?? 0,
        padding.top ?? defaultPadding.top,
        padding.right ?? 0,
        padding.bottom ?? defaultPadding.bottom
    );

    return textObj;
}

/**
 * Create centered text (origin 0.5) with descender-safe padding
 */
export function createCenteredText(scene, x, y, text, style = {}, options = {}) {
    const textObj = createText(scene, x, y, text, style, options);
    textObj.setOrigin(0.5);
    return textObj;
}

/**
 * Truncate text to fit within a pixel width, breaking at word boundaries
 *
 * @param {Phaser.Scene} scene - The scene (for creating temp text)
 * @param {string} text - Text to truncate
 * @param {number} maxWidth - Maximum width in pixels
 * @param {object} style - Text style (for measuring)
 * @param {string} ellipsis - Ellipsis character (default '…')
 * @returns {string} Truncated text with ellipsis if needed
 */
export function truncateTextToWidth(scene, text, maxWidth, style = {}, ellipsis = '…') {
    if (!text) return '';

    // Create temp text to measure
    const fonts = manifest.ui?.fonts || {};
    const tempText = scene.add.text(0, 0, text, {
        fontFamily: style.fontFamily || fonts.primary || 'Georgia, serif',
        fontSize: style.fontSize || fonts.sizes?.body || '13px',
        fontStyle: style.fontStyle || ''
    });

    // If it fits, return as-is
    if (tempText.width <= maxWidth) {
        tempText.destroy();
        return text;
    }

    // Measure ellipsis width
    tempText.setText(ellipsis);
    const ellipsisWidth = tempText.width;
    const targetWidth = maxWidth - ellipsisWidth;

    // Try word-by-word truncation first
    const words = text.split(' ');
    let truncated = '';

    for (let i = 0; i < words.length; i++) {
        const testText = truncated ? truncated + ' ' + words[i] : words[i];
        tempText.setText(testText);

        if (tempText.width > targetWidth) {
            // This word pushes us over - use previous state
            if (truncated) {
                tempText.destroy();
                return truncated + ellipsis;
            }
            // First word is too long - truncate by character
            break;
        }
        truncated = testText;
    }

    // If no words fit, truncate by character
    if (!truncated) {
        truncated = '';
        for (let i = 0; i < text.length; i++) {
            tempText.setText(text.slice(0, i + 1));
            if (tempText.width > targetWidth) {
                truncated = text.slice(0, i);
                break;
            }
        }
    }

    tempText.destroy();
    return truncated ? truncated + ellipsis : ellipsis;
}

/**
 * Shared text styles for consistency across the game
 * All values now read from manifest for full theming support
 */
function getTextStyles() {
    const fonts = manifest.ui?.fonts || {};
    const colors = manifest.ui?.colors || {};
    const primaryFont = fonts.primary || 'Georgia, serif';

    return {
        // Dialogue and narrative
        dialogue: {
            fontSize: fonts.sizes?.title || '16px',
            fontFamily: primaryFont,
            color: colors.textPrimary || '#e8e8e8',
            lineSpacing: 6
        },
        speaker: {
            fontSize: '18px',
            fontFamily: primaryFont,
            color: colors.textSpeaker || '#ffd700',
            fontStyle: 'bold'
        },

        // Buttons and UI
        button: {
            fontSize: fonts.sizes?.title || '16px',
            fontFamily: primaryFont,
            color: colors.buttonText || '#ffffff',
            align: 'center'
        },

        // Dice scene
        diceHeader: {
            fontSize: '24px',
            fontFamily: primaryFont,
            color: '#ffffff',
            align: 'center'
        },
        diceResult: {
            fontSize: '20px',
            fontFamily: primaryFont,
            color: '#ffffff',
            align: 'center'
        },
        diceTier: {
            fontSize: '28px',
            fontFamily: primaryFont,
            fontStyle: 'bold',
            align: 'center'
        },

        // Small/subtle text
        hint: {
            fontSize: fonts.sizes?.heading || '14px',
            fontFamily: primaryFont,
            color: colors.textSecondary || '#888888',
            align: 'center'
        }
    };
}

// Export as getter to ensure manifest is loaded
export const TEXT_STYLES = new Proxy({}, {
    get(target, prop) {
        return getTextStyles()[prop];
    }
});
