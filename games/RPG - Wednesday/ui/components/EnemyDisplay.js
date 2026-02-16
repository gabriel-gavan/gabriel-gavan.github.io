import Phaser from 'phaser';
import { createText } from '../../utils/TextUtils.js';
import { manifest } from '../../manifest.js';

/**
 * EnemyDisplay - Shows enemy name and HP during combat
 *
 * Displays a health bar and HP text for the current enemy.
 * All visual properties are themeable via manifest.ui
 */
export class EnemyDisplay extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {
        super(scene, x, y);

        this.enemyName = '';
        this.initialized = false;
        this.currentEnemyId = null;

        // Cache theme values for performance
        this.theme = this.getThemeValues();

        // Enemy name
        this.nameText = createText(scene, 0, 0, '', {
            fontSize: this.theme.titleSize,
            fontFamily: this.theme.fontFamily,
            fontStyle: 'bold',
            color: this.theme.enemyNameColor
        });
        this.add(this.nameText);

        // Health bar graphics (created on first init)
        this.barBg = null;
        this.barFill = null;

        // Status text (HP display)
        this.statusText = createText(scene, 0, 38, '', {
            fontSize: this.theme.bodySize,
            fontFamily: this.theme.fontFamily,
            color: this.theme.textPrimary
        });
        this.add(this.statusText);

        // Status icons container
        this.statusIcons = scene.add.container(0, -15);
        this.add(this.statusIcons);

        scene.add.existing(this);
    }

    /**
     * Get theme values from manifest with fallbacks
     */
    getThemeValues() {
        const fonts = manifest.ui?.fonts || {};
        const colors = manifest.ui?.colors || {};
        const dims = manifest.ui?.dimensions?.enemyHealthBar || {};
        const anim = manifest.ui?.animation || {};
        const labels = manifest.ui?.labels || {};

        return {
            fontFamily: fonts.primary || 'Georgia, serif',
            titleSize: fonts.sizes?.title || '16px',
            bodySize: fonts.sizes?.body || '13px',
            textPrimary: colors.textPrimary || '#e8e8e8',
            enemyNameColor: colors.enemy?.name || '#ff6b6b',
            healthOk: colors.healthOk || 0x4ade80,
            healthHurt: colors.healthHurt || 0xfbbf24,
            healthCritical: colors.healthCritical || 0xff6b6b,
            healthBarBg: colors.healthBarBg || 0x333333,
            barWidth: dims.width || 100,
            barHeight: dims.height || 12,
            barRadius: dims.borderRadius || 4,
            barYOffset: dims.yOffset || 20,
            damageFlash: anim.damageFlash || 80,
            highlightPulse: anim.highlightPulse || 400,
            defeatedLabel: labels.defeated || 'DEFEATED!',
            hpLabel: labels.hpLabel || 'HP',
        };
    }

    /**
     * Initialize enemy display for combat
     * @param {Object} enemyState - { currentHealth, maxHealth, status, images }
     * @param {string} displayName - Enemy display name
     */
    setEnemy(enemyState, displayName) {
        this.initialized = true;
        this.enemyName = displayName;
        this.currentEnemyId = enemyState.id;
        this.nameText.setText(displayName);

        // Create health bar if it doesn't exist
        if (!this.barBg) {
            this.barBg = this.scene.add.graphics();
            this.add(this.barBg);

            this.barFill = this.scene.add.graphics();
            this.add(this.barFill);
        }

        this.updateStatus(enemyState);
        this.setVisible(true);
    }

    /**
     * Update enemy status display
     * @param {Object} enemyState - { currentHealth, maxHealth, status }
     */
    updateStatus(enemyState) {
        if (!this.initialized || !enemyState) return;
        if (!enemyState.maxHealth || enemyState.maxHealth <= 0) return;

        const healthPercent = Math.max(0, Math.min(1, enemyState.currentHealth / enemyState.maxHealth));

        // Determine health bar color based on thresholds
        let color;
        if (healthPercent > 0.5) {
            color = this.theme.healthOk;
        } else if (healthPercent > 0.25) {
            color = this.theme.healthHurt;
        } else {
            color = this.theme.healthCritical;
        }

        // Draw health bar background
        this.barBg.clear();
        this.barBg.fillStyle(this.theme.healthBarBg, 1);
        this.barBg.fillRoundedRect(0, this.theme.barYOffset, this.theme.barWidth, this.theme.barHeight, this.theme.barRadius);

        // Draw health bar fill
        this.barFill.clear();
        this.barFill.fillStyle(color, 1);
        this.barFill.fillRoundedRect(0, this.theme.barYOffset, this.theme.barWidth * healthPercent, this.theme.barHeight, this.theme.barRadius);

        // Update status text
        const statusText = enemyState.status === 'defeated'
            ? this.theme.defeatedLabel
            : `${enemyState.currentHealth}/${enemyState.maxHealth} ${this.theme.hpLabel}`;
        this.statusText.setText(statusText);

        this.updateStatusIcons(enemyState.activeEffects || []);
    }

    /**
     * Update status icons based on active effects
     */
    updateStatusIcons(effects) {
        this.statusIcons.removeAll(true);
        
        let iconX = 0;
        const iconSpacing = 20;

        effects.forEach(effect => {
            if (effect.type === 'stun') {
                this.createStatusIcon('👁️', 'Psychic Resonance', iconX);
                iconX += iconSpacing;
            } else if (effect.type === 'poison') {
                this.createStatusIcon('🔥', 'Burning', iconX);
                iconX += iconSpacing;
            } else if (effect.type === 'mark') {
                this.createStatusIcon('🎯', 'Marked', iconX);
                iconX += iconSpacing;
            } else if (effect.type === 'vulnerable') {
                this.createStatusIcon('💔', 'Vulnerable', iconX);
                iconX += iconSpacing;
            }
        });
    }

    createStatusIcon(emoji, label, x) {
        const icon = createText(this.scene, x, 0, emoji, {
            fontSize: '14px',
            fontFamily: this.theme.fontFamily
        });
        
        // Add a subtle glow/pulse for Psychic Resonance
        if (label === 'Psychic Resonance') {
            this.scene.tweens.add({
                targets: icon,
                alpha: 0.5,
                scale: 1.2,
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        }
        
        this.statusIcons.add(icon);
    }

    /**
     * Flash effect when enemy takes damage
     */
    flashDamage() {
        this.scene.tweens.add({
            targets: this.nameText,
            alpha: 0.3,
            duration: this.theme.damageFlash,
            yoyo: true,
            repeat: 1
        });
    }

    /**
     * Highlight the enemy display (e.g., during their turn)
     * @param {boolean} active - Whether to show or hide the highlight
     */
    highlight(active) {
        if (this.highlightTween) {
            this.highlightTween.stop();
            this.highlightTween = null;
        }

        if (active) {
            // Pulse the name to indicate enemy's turn
            this.highlightTween = this.scene.tweens.add({
                targets: this.nameText,
                alpha: 0.5,
                duration: this.theme.highlightPulse,
                yoyo: true,
                repeat: -1
            });
        } else {
            this.nameText.setAlpha(1);
        }
    }

    /**
     * Clear enemy display
     */
    clear() {
        this.enemyName = '';
        this.nameText.setText('');
        this.statusText.setText('');
        this.initialized = false;
        this.currentEnemyId = null;

        // Stop any highlight animation
        if (this.highlightTween) {
            this.highlightTween.stop();
            this.highlightTween = null;
        }

        if (this.barBg) {
            this.barBg.clear();
        }
        if (this.barFill) {
            this.barFill.clear();
        }
    }
}
