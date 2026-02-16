import { EventBus } from '../../events/EventBus.js';
import { COMBAT_EVENTS } from '../../events/CombatEvents.js';
import { manifest } from '../../manifest.js';
import { createCenteredText } from '../../utils/TextUtils.js';

/**
 * CombatView - Manages the visual representation of combat
 * 
 * Handles rendering of:
 * - Enemy main sprite (centered)
 * - Visual effects
 * - Combat animations
 */
export class CombatView {
    constructor(scene, layer) {
        this.scene = scene;
        this.layer = layer;
        this.enemySprite = null;
        this.playerSprite = null;
        this.currentEnemyId = null;
        this.currentPlayerId = null;
        this.enemyImages = null;
        this.playerImages = null;
        this.currentEnemyForm = 'idle'; // Track current visual form to prevent redundant swaps

        this.setupListeners();
    }

    setupListeners() {
        EventBus.on(COMBAT_EVENTS.ENEMY.SPAWNED, this.handleEnemySpawned, this);
        EventBus.on(COMBAT_EVENTS.ENEMY.DAMAGE_FLASH, this.handleEnemyDamageFlash, this);
        EventBus.on(COMBAT_EVENTS.ENEMY.STATUS_UPDATED, this.handleEnemyStatusUpdated, this);
        EventBus.on(COMBAT_EVENTS.INITIATIVE.TURN_CHANGED, this.handleTurnChanged, this);
        EventBus.on(COMBAT_EVENTS.ACTION.EXECUTED, this.handleActionExecuted, this);
        EventBus.on(COMBAT_EVENTS.TARGET.ENEMY_TARGETING, this.handleEnemyTargeting, this);
        EventBus.on(COMBAT_EVENTS.HEALTH.DAMAGE_TAKEN, this.handleDamageTaken, this);
        EventBus.on(COMBAT_EVENTS.HEALTH.HEAL_RECEIVED, this.handleHealReceived, this);
        EventBus.on('system.combat.end', this.clear, this);
    }

    destroy() {
        EventBus.off(COMBAT_EVENTS.ENEMY.SPAWNED, this.handleEnemySpawned, this);
        EventBus.off(COMBAT_EVENTS.ENEMY.DAMAGE_FLASH, this.handleEnemyDamageFlash, this);
        EventBus.off(COMBAT_EVENTS.ENEMY.STATUS_UPDATED, this.handleEnemyStatusUpdated, this);
        EventBus.off(COMBAT_EVENTS.INITIATIVE.TURN_CHANGED, this.handleTurnChanged, this);
        EventBus.off(COMBAT_EVENTS.ACTION.EXECUTED, this.handleActionExecuted, this);
        EventBus.off(COMBAT_EVENTS.TARGET.ENEMY_TARGETING, this.handleEnemyTargeting, this);
        EventBus.off(COMBAT_EVENTS.HEALTH.DAMAGE_TAKEN, this.handleDamageTaken, this);
        EventBus.off(COMBAT_EVENTS.HEALTH.HEAL_RECEIVED, this.handleHealReceived, this);
        EventBus.off('system.combat.end', this.clear, this);
        this.clear();
    }

    handleEnemySpawned({ enemy }) {
        // Clear enemy but keep player if exists (though usually clear all)
        if (this.enemySprite) {
            this.enemySprite.destroy();
            this.enemySprite = null;
        }
        this.currentEnemyId = enemy.id;
        this.enemyImages = enemy.images;
        this.currentEnemyForm = 'idle'; // Reset form tracking for new enemy

        if (enemy.images?.idle) {
            const textureKey = `combat_view_${enemy.id}`;
            // Shift enemy slightly left to make room for party member
            const centerX = this.scene.scale.width * 0.4;
            const centerY = this.scene.scale.height / 2 - 20;

            this.enemySprite = this.scene.add.image(centerX, centerY, null);
            this.enemySprite.setAlpha(0);
            this.layer.add(this.enemySprite);

            if (this.scene.textures.exists(textureKey)) {
                this.setEnemyTexture(textureKey);
            } else {
                this.scene.load.image(textureKey, enemy.images.idle);
                this.scene.load.once(`filecomplete-image-${textureKey}`, () => {
                    if (this.currentEnemyId === enemy.id) {
                        this.setEnemyTexture(textureKey);
                    }
                });
                this.scene.load.start();
            }
        }
    }

    handleEnemyTargeting({ target }) {
        if (target) {
            this.showPlayer(target);
        }
    }

    handleTurnChanged({ order, currentIndex }) {
        const combatant = order[currentIndex];
        
        if (!combatant) return;

        if (combatant.type === 'party') {
            this.showPlayer(combatant);
        } else {
            // Optional: Hide player or dim them when it's enemy turn
            // For now, we'll keep the last active player or clear if you prefer
            // this.hidePlayer(); 
        }
    }

    showPlayer(character) {
        if (this.currentPlayerId === character.id && this.playerSprite) return;

        this.hidePlayer();
        this.currentPlayerId = character.id;
        this.playerImages = character.images;

        if (character.images?.idle) {
            const textureKey = `combat_view_player_${character.id}`;
            const x = this.scene.scale.width * 0.8;
            const y = this.scene.scale.height / 2 + 30; // Slightly lower than enemy

            this.playerSprite = this.scene.add.image(x, y, null);
            this.playerSprite.setAlpha(0);
            
            // Flip sprite to face left (assuming standard sprites face right)
            this.playerSprite.setFlipX(true); 
            
            this.layer.add(this.playerSprite);

            const showIt = () => {
                if (!this.playerSprite) return;
                this.playerSprite.setTexture(textureKey);
                
                // Scale logic
                const maxSize = 220;
                this.playerSprite.setScale(1);
                if (this.playerSprite.width > maxSize || this.playerSprite.height > maxSize) {
                    const scale = maxSize / Math.max(this.playerSprite.width, this.playerSprite.height);
                    this.playerSprite.setScale(scale);
                    // Re-apply flip after scale reset if needed, but setScale(s) preserves sign usually? 
                    // Actually Phaser setScale(x, y) might overwrite flip if negative. 
                    // setFlipX is safer.
                }

                // Animate in
                this.scene.tweens.add({
                    targets: this.playerSprite,
                    x: x - 20, // Slide in from right
                    alpha: 1,
                    duration: 400,
                    ease: 'Power2'
                });
            };

            if (this.scene.textures.exists(textureKey)) {
                showIt();
            } else {
                this.scene.load.image(textureKey, character.images.idle);
                this.scene.load.once(`filecomplete-image-${textureKey}`, () => {
                    if (this.currentPlayerId === character.id) showIt();
                });
                this.scene.load.start();
            }
        }
    }

    handleActionExecuted({ actorId, abilityId, ability, actionType, result }) {
        if (actorId === 'enemy') {
            this.animateEnemyAttack(abilityId, ability, actionType);
        } else if (actorId === this.currentPlayerId) {
            this.animatePlayerAttack(abilityId, ability, actionType, result);
        }
    }

    createShadowTrail(sprite, duration) {
        const timer = this.scene.time.addEvent({
            delay: 50,
            repeat: Math.floor(duration / 50),
            callback: () => {
                if (!sprite || !sprite.scene) return;
                const shadow = this.scene.add.image(sprite.x, sprite.y, sprite.texture.key);
                shadow.setScale(sprite.scaleX, sprite.scaleY);
                shadow.setFlipX(sprite.flipX);
                shadow.setAlpha(0.4);
                shadow.setTint(0x4a1a4a); // Deep spectral purple
                this.layer.add(shadow);
                
                this.scene.tweens.add({
                    targets: shadow,
                    alpha: 0,
                    scale: sprite.scale * 1.1,
                    duration: 600,
                    ease: 'Power2',
                    onComplete: () => shadow.destroy()
                });
            }
        });
    }

    createDeadlyCelloEffect(result) {
        if (!this.playerSprite) return;

        const x = this.playerSprite.x;
        const y = this.playerSprite.y;

        // Camera shake and flash for impact
        this.scene.cameras.main.shake(500, 0.01);
        this.scene.cameras.main.flash(400, 0x9b4d9b, 0.3);

        // Handle special combat text (RESIST or CRITICAL)
        if (result) {
            const combatColors = manifest.ui?.colors?.combat || {};
            if (result.tier === 'critical') {
                this.showFloatingText(this.scene.scale.width / 2, this.scene.scale.height / 2 - 100, 'CRITICAL!', '#ff00ff');
            } else if (result.tier === 'failure') {
                this.showFloatingText(this.scene.scale.width / 2, this.scene.scale.height / 2 - 100, 'RESISTED', '#888888');
            }
        }
        
        // Create expanding sonic rings using Graphics
        for (let i = 0; i < 5; i++) {
            this.scene.time.delayedCall(i * 150, () => {
                const ring = this.scene.add.graphics();
                ring.lineStyle(2, 0x9b4d9b, 0.8);
                ring.strokeCircle(0, 0, 10);
                ring.x = x;
                ring.y = y;
                this.layer.add(ring);

                this.scene.tweens.add({
                    targets: ring,
                    scale: 40,
                    alpha: 0,
                    duration: 1000,
                    ease: 'Quad.easeOut',
                    onComplete: () => ring.destroy()
                });
            });
        }

        // Particle burst for more impact
        const particles = this.scene.add.particles(x, y, null, {
            speed: { min: 50, max: 200 },
            scale: { start: 0.1, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: [0x9b4d9b, 0x4a1a4a, 0x000000],
            lifespan: 800,
            blendMode: 'ADD',
            emitting: false
        });
        
        // Create a basic circle texture for particles if it doesn't exist
        if (!this.scene.textures.exists('sonic_particle')) {
            const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
            graphics.fillStyle(0xffffff);
            graphics.fillCircle(4, 4, 4);
            graphics.generateTexture('sonic_particle', 8, 8);
        }
        
        particles.setTexture('sonic_particle');
        this.layer.add(particles);
        particles.explode(30);

        this.scene.time.delayedCall(1000, () => particles.destroy());
    }

    animateEnemyAttack(abilityId, ability, actionType) {
        // Default to immediate completion if something fails
        const completeAnimation = () => {
            EventBus.emit(COMBAT_EVENTS.ACTION.ANIMATION_COMPLETE, { actorId: 'enemy' });
        };

        if (!this.enemySprite || !this.enemyImages) {
            completeAnimation();
            return;
        }

        // Determine texture (try specific ability first, then generic attack, fallback to idle)
        let attackKey = abilityId;
        let textureUrl = this.enemyImages[attackKey] || this.enemyImages['melee'] || this.enemyImages['attack'];
        
        if (textureUrl) {
            const textureKey = `combat_enemy_${this.currentEnemyId}_${attackKey}`;
            
            // Helper to swap and animate
            const performAnim = () => {
                this.enemySprite.setTexture(textureKey);
                
                const isOffensive = actionType === 'attack';
                
                if (isOffensive) {
                    // Animate lunge
                    this.scene.tweens.add({
                        targets: this.enemySprite,
                        x: '-=50',
                        duration: 150,
                        yoyo: true,
                        ease: 'Power1',
                        onComplete: () => {
                            this.scene.time.delayedCall(300, () => {
                                if (this.enemySprite && this.enemyImages?.idle) {
                                    const idleKey = `combat_view_${this.currentEnemyId}`;
                                    this.enemySprite.setTexture(idleKey);
                                }
                                completeAnimation();
                            });
                        }
                    });
                } else {
                    // Animate buff (pulse/scale)
                    this.scene.tweens.add({
                        targets: this.enemySprite,
                        scale: '*=1.1',
                        duration: 200,
                        yoyo: true,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            this.scene.time.delayedCall(300, () => {
                                if (this.enemySprite && this.enemyImages?.idle) {
                                    const idleKey = `combat_view_${this.currentEnemyId}`;
                                    this.enemySprite.setTexture(idleKey);
                                }
                                completeAnimation();
                            });
                        }
                    });
                }
            };

            if (this.scene.textures.exists(textureKey)) {
                performAnim();
            } else {
                this.scene.load.image(textureKey, textureUrl);
                this.scene.load.once(`filecomplete-image-${textureKey}`, performAnim);
                this.scene.load.start();
            }
        } else {
            completeAnimation();
        }
    }

    animatePlayerAttack(abilityId, ability, actionType, result) {
        const completeAnimation = () => {
            EventBus.emit(COMBAT_EVENTS.ACTION.ANIMATION_COMPLETE, { actorId: this.currentPlayerId });
        };

        if (!this.playerSprite || !this.playerImages) {
            completeAnimation();
            return;
        }

        const textureUrl = this.playerImages['attack'];
        
        if (textureUrl) {
            const textureKey = `combat_player_${this.currentPlayerId}_attack`;

            const performAnim = () => {
                this.playerSprite.setTexture(textureKey);

                const isOffensive = actionType === 'attack';
                
                // Special visual for Deadly Cello
                if (abilityId === 'deadly_cello') {
                    this.createDeadlyCelloEffect(result);
                    this.createShadowTrail(this.playerSprite, 500);
                }

                if (isOffensive) {
                    // Lunge forward
                    this.scene.tweens.add({
                        targets: this.playerSprite,
                        x: '-=50',
                        duration: 150,
                        yoyo: true,
                        ease: 'Power1',
                        onComplete: () => {
                            this.scene.time.delayedCall(300, () => {
                                if (this.playerSprite && this.playerImages?.idle) {
                                    const idleKey = `combat_view_player_${this.currentPlayerId}`;
                                    this.playerSprite.setTexture(idleKey);
                                }
                                completeAnimation();
                            });
                        }
                    });
                } else {
                    // Buff pulse
                    this.scene.tweens.add({
                        targets: this.playerSprite,
                        scale: '*=1.1',
                        duration: 200,
                        yoyo: true,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            this.scene.time.delayedCall(300, () => {
                                if (this.playerSprite && this.playerImages?.idle) {
                                    const idleKey = `combat_view_player_${this.currentPlayerId}`;
                                    this.playerSprite.setTexture(idleKey);
                                }
                                completeAnimation();
                            });
                        }
                    });
                }
            };

            if (this.scene.textures.exists(textureKey)) {
                performAnim();
            } else {
                this.scene.load.image(textureKey, textureUrl);
                this.scene.load.once(`filecomplete-image-${textureKey}`, performAnim);
                this.scene.load.start();
            }
        } else {
            completeAnimation();
        }
    }

    hidePlayer() {
        if (this.playerSprite) {
            this.playerSprite.destroy();
            this.playerSprite = null;
        }
        this.currentPlayerId = null;
    }

    setEnemyTexture(key) {
        if (!this.enemySprite) return;

        this.enemySprite.setTexture(key);
        this.enemySprite.setAlpha(1);

        // Scale Logic
        const maxWidth = 300;
        const maxHeight = 300;

        // Reset scale first
        this.enemySprite.setScale(1);

        if (this.enemySprite.width > maxWidth || this.enemySprite.height > maxHeight) {
            const scaleX = maxWidth / this.enemySprite.width;
            const scaleY = maxHeight / this.enemySprite.height;
            const scale = Math.min(scaleX, scaleY);
            this.enemySprite.setScale(scale);
        }

        // Entrance Animation
        this.enemySprite.y -= 20;
        this.scene.tweens.add({
            targets: this.enemySprite,
            y: this.enemySprite.y + 20,
            alpha: { from: 0, to: 1 },
            duration: 500,
            ease: 'Back.out'
        });
    }

    handleEnemyDamageFlash(payload = {}) {
        const combatColors = manifest.ui?.colors?.combat || {};
        if (this.enemySprite) {
            this.flashSprite(this.enemySprite, combatColors.damageFlash || 0xff0000);
            if (payload.amount) {
                this.showFloatingText(this.enemySprite.x, this.enemySprite.y - 50, `-${payload.amount}`, combatColors.damageText || '#ff4444');
            }
        }
    }

    handleDamageTaken(payload) {
        const combatColors = manifest.ui?.colors?.combat || {};
        const { targetId, amount } = payload;
        if (this.playerSprite && this.currentPlayerId === targetId) {
            this.flashSprite(this.playerSprite, combatColors.damageFlash || 0xff0000);
            if (amount) {
                this.showFloatingText(this.playerSprite.x, this.playerSprite.y - 50, `-${amount}`, combatColors.damageText || '#ff4444');
            }
        }
    }

    handleHealReceived({ targetId, amount }) {
        const combatColors = manifest.ui?.colors?.combat || {};
        if (this.playerSprite && this.currentPlayerId === targetId && amount) {
             this.showFloatingText(this.playerSprite.x, this.playerSprite.y - 50, `+${amount}`, combatColors.healText || '#44ff44');
        }
        // Could also handle enemy healing if needed, checking targetId against enemyId
        if (this.enemySprite && this.currentEnemyId === targetId && amount) {
             this.showFloatingText(this.enemySprite.x, this.enemySprite.y - 50, `+${amount}`, combatColors.healText || '#44ff44');
        }
    }

    showFloatingText(x, y, text, color) {
        const combatColors = manifest.ui?.colors?.combat || {};
        const floatingText = createCenteredText(this.scene, x, y, text, {
            fontSize: '32px',
            fontFamily: 'Impact, sans-serif', // Keep Impact for punchy combat numbers
            color: color,
            stroke: combatColors.textStroke || '#000000',
            strokeThickness: 4
        });
        this.layer.add(floatingText);

        this.scene.tweens.add({
            targets: floatingText,
            y: y - 60,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => {
                floatingText.destroy();
            }
        });
    }

    flashSprite(sprite, color) {
        this.scene.tweens.add({
            targets: sprite,
            tint: color,
            duration: 100,
            yoyo: true,
            onComplete: () => {
                sprite.clearTint();
            }
        });

        // Shake effect
        this.scene.tweens.add({
            targets: sprite,
            x: '+=5',
            duration: 50,
            yoyo: true,
            repeat: 3
        });
    }

    handleEnemyStatusUpdated({ enemy }) {
        if (enemy.status === 'defeated' && this.enemySprite) {
            this.scene.tweens.add({
                targets: this.enemySprite,
                alpha: 0,
                scale: 0,
                rotation: 0.5,
                duration: 1000,
                ease: 'Power2'
            });
            return;
        }

        // Handle visual transformations (e.g., Wild Shape into spider)
        // Transformation takes highest priority
        if (enemy.transformed && this.enemyImages && this.enemySprite) {
            const formImage = this.enemyImages[enemy.transformed];
            if (formImage && this.currentEnemyForm !== enemy.transformed) {
                this.swapEnemySprite(enemy.transformed, formImage);
                return;
            }
        }

        // Handle special abilities that have visual states (data-driven)
        // If enemy.images contains a key matching a used special, swap to that visual
        // Only if not already transformed into something else
        if (!enemy.transformed && enemy.usedSpecials && this.enemyImages && this.enemySprite) {
            for (const abilityId of Object.keys(enemy.usedSpecials)) {
                if (enemy.usedSpecials[abilityId] && this.enemyImages[abilityId] && this.currentEnemyForm !== abilityId) {
                    this.swapEnemySprite(abilityId, this.enemyImages[abilityId]);
                    return; // Only apply one visual state at a time
                }
            }
        }

        // Revert to idle if no transformation or special visual is active
        if (!enemy.transformed && this.currentEnemyForm !== 'idle' && this.enemyImages && this.enemySprite) {
            const hasActiveVisual = enemy.usedSpecials &&
                Object.keys(enemy.usedSpecials).some(id => enemy.usedSpecials[id] && this.enemyImages[id]);

            if (!hasActiveVisual && this.enemyImages['idle']) {
                this.swapEnemySprite('idle', this.enemyImages['idle']);
            }
        }
    }

    /**
     * Swap enemy sprite to a new form/state with animation
     */
    swapEnemySprite(formKey, imageUrl) {
        // Prevent redundant swaps
        if (this.currentEnemyForm === formKey) return;

        const textureKey = `combat_enemy_${this.currentEnemyId}_${formKey}`;

        const applyTransform = () => {
            if (!this.enemySprite || !this.enemySprite.scene) return;

            this.currentEnemyForm = formKey;

            // Flash effect during transformation
            this.scene.tweens.add({
                targets: this.enemySprite,
                alpha: 0,
                duration: 150,
                yoyo: true,
                onYoyo: () => {
                    if (!this.enemySprite) return;
                    this.enemySprite.setTexture(textureKey);
                    // Re-apply scaling
                    this.enemySprite.setScale(1);
                    const maxWidth = 300;
                    const maxHeight = 300;
                    if (this.enemySprite.width > maxWidth || this.enemySprite.height > maxHeight) {
                        const scaleX = maxWidth / this.enemySprite.width;
                        const scaleY = maxHeight / this.enemySprite.height;
                        const scale = Math.min(scaleX, scaleY);
                        this.enemySprite.setScale(scale);
                    }
                }
            });
        };

        if (this.scene.textures.exists(textureKey)) {
            applyTransform();
        } else {
            this.scene.load.image(textureKey, imageUrl);
            this.scene.load.once(`filecomplete-image-${textureKey}`, applyTransform);
            this.scene.load.start();
        }
    }

    clear() {
        if (this.enemySprite) {
            this.enemySprite.destroy();
            this.enemySprite = null;
        }
        if (this.playerSprite) {
            this.playerSprite.destroy();
            this.playerSprite = null;
        }
        this.currentEnemyId = null;
        this.currentPlayerId = null;
    }
}