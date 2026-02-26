import Phaser from 'phaser';
import { createText } from '../../utils/TextUtils.js';
import { manifest } from '../../manifest.js';

/**
 * HealthDisplay - Shows party health bars (for combat)
 * Includes spotlight indicator for characters in danger
 *
 * All visual properties are themeable via manifest.ui
 */
export class HealthDisplay extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {
        super(scene, x, y);

        this.healthBars = new Map();

        // Cache theme values for performance
        this.theme = this.getThemeValues();

        scene.add.existing(this);
    }

    /**
     * Get theme values from manifest with fallbacks
     */
    getThemeValues() {
        const fonts = manifest.ui?.fonts || {};
        const colors = manifest.ui?.colors || {};
        const dims = manifest.ui?.dimensions?.healthBar || {};
        const portraits = manifest.ui?.dimensions?.portrait || {};
        const spacing = manifest.ui?.spacing || {};
        const anim = manifest.ui?.animation || {};

        return {
            fontFamily: fonts.primary || 'Georgia, serif',
            bodySize: fonts.sizes?.body || '13px',
            textPrimary: colors.textPrimary || '#e8e8e8',
            healthOk: colors.healthOk || 0x4ade80,
            healthHurt: colors.healthHurt || 0xfbbf24,
            healthDown: colors.healthDown || 0xef4444,
            healthBarBg: colors.healthBarBg || 0x333333,
            barWidth: dims.width || 50,
            barHeight: dims.height || 10,
            barRadius: dims.borderRadius || 3,
            portraitSize: portraits.small || 20,
            rowHeight: spacing.healthBarRow || 28,
            portraitOffset: spacing.portraitOffset || 15,
            nameOffset: spacing.nameOffset || 40,
            damageFlash: anim.damageFlash || 80,
            healGlow: anim.healGlow || 150,
        };
    }

    /**
     * Update display for party members
     * @param {Array} party - Array of party member state objects
     */
    updateParty(party) {
        this.removeAll(true);
        this.healthBars.clear();

        party.forEach((member, index) => {
            const y = index * this.theme.rowHeight;
            const barX = 0;
            const barWidth = this.theme.barWidth;

            // Health bar background (left side)
            const barBg = this.scene.add.graphics();
            barBg.fillStyle(this.theme.healthBarBg, 1);
            barBg.fillRoundedRect(barX, y + 2, barWidth, this.theme.barHeight, this.theme.barRadius);
            this.add(barBg);

            // Health bar fill
            const barFill = this.scene.add.graphics();
            const healthPercent = member.maxHealth > 0
                ? Math.max(0, Math.min(1, member.currentHealth / member.maxHealth))
                : 0;
            const color = member.status === 'down' ? this.theme.healthDown
                : member.status === 'hurt' ? this.theme.healthHurt
                : this.theme.healthOk;

            barFill.fillStyle(color, 1);
            barFill.fillRoundedRect(barX, y + 2, barWidth * healthPercent, this.theme.barHeight, this.theme.barRadius);
            this.add(barFill);

            // Portrait (Small circle/icon)
            if (member.images?.portrait) {
                const portraitSize = this.theme.portraitSize;
                const portraitX = barX + barWidth + this.theme.portraitOffset;
                const portraitY = y + 7;

                const textureKey = `health_portrait_${member.id}`;

                // Placeholder/Background circle
                const portraitBg = this.scene.add.graphics();
                portraitBg.fillStyle(0x000000, 0.5);
                portraitBg.fillCircle(portraitX, portraitY, portraitSize / 2);
                this.add(portraitBg);

                const showPortrait = () => {
                    const portrait = this.scene.add.image(portraitX, portraitY, textureKey);
                    const scale = portraitSize / Math.max(portrait.width, portrait.height);
                    portrait.setScale(scale);
                    this.add(portrait);
                };

                if (this.scene.textures.exists(textureKey)) {
                    showPortrait();
                } else {
                    this.scene.load.image(textureKey, member.images.portrait);
                    this.scene.load.once(`filecomplete-image-${textureKey}`, showPortrait);
                    this.scene.load.start();
                }
            }

            // Name - use first name only for cleaner display
            const firstName = member.name.split(' ')[0];
            const name = createText(this.scene, barX + this.theme.barWidth + this.theme.nameOffset, y, firstName, {
                fontSize: this.theme.bodySize,
                fontFamily: this.theme.fontFamily,
                color: this.theme.textPrimary
            });
            this.add(name);

            this.healthBars.set(member.id, { name, barBg, barFill });
        });
    }

    /**
     * Flash damage effect on a party member's health bar
     * @param {string} memberId - ID of member who took damage
     */
    flashDamage(memberId) {
        const bar = this.healthBars.get(memberId);
        if (!bar) return;

        // Flash the health bar by toggling alpha
        this.scene.tweens.add({
            targets: bar.barFill,
            alpha: 0.2,
            duration: this.theme.damageFlash,
            yoyo: true,
            repeat: 2
        });
    }

    /**
     * Glow effect when a party member heals
     * @param {string} memberId - ID of member who healed
     */
    glowHeal(memberId) {
        const bar = this.healthBars.get(memberId);
        if (!bar) return;

        // Pulse the health bar
        this.scene.tweens.add({
            targets: bar.barFill,
            scaleY: 1.5,
            duration: this.theme.healGlow,
            yoyo: true,
            ease: 'Sine.easeOut'
        });
    }
}
