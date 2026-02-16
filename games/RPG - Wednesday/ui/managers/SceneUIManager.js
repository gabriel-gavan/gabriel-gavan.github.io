import { EventBus } from '../../events/EventBus.js';
import { SCENE_EVENTS } from '../../events/SceneEvents.js';
import { CHOICE_EVENTS } from '../../events/SceneEvents.js';
import { getGameState } from '../../state/GameState.js'; // Need to reset game on End Screen
import { manifest } from '../../manifest.js';
import { createCenteredText } from '../../utils/TextUtils.js';

export class SceneUIManager {
    constructor(scene) {
        this.scene = scene;
        this.gameState = getGameState();
        this.narrativeSprites = [];
        this.currentActingCharacter = null;
        this.setupListeners();
    }

    setupListeners() {
        EventBus.on(SCENE_EVENTS.BACKGROUND_CHANGED, this.handleBackgroundChanged, this);
        EventBus.on(SCENE_EVENTS.MUSIC_CHANGED, this.handleMusicChanged, this);
        EventBus.on(SCENE_EVENTS.COMBAT_MODE_CHANGED, this.handleCombatModeChanged, this);
        EventBus.on(SCENE_EVENTS.VICTORY_MOMENT, this.handleVictoryMoment, this);
        EventBus.on(SCENE_EVENTS.END_SCREEN, this.handleEndScreen, this);
        EventBus.on(SCENE_EVENTS.LOADED, this.handleSceneLoaded, this);
        EventBus.on(CHOICE_EVENTS.SELECTED, this.handleChoiceSelected, this);
        EventBus.on('scene.choice.outcome', this.handleChoiceOutcome, this);
    }

    destroy() {
        EventBus.off(SCENE_EVENTS.BACKGROUND_CHANGED, this.handleBackgroundChanged, this);
        EventBus.off(SCENE_EVENTS.MUSIC_CHANGED, this.handleMusicChanged, this);
        EventBus.off(SCENE_EVENTS.COMBAT_MODE_CHANGED, this.handleCombatModeChanged, this);
        EventBus.off(SCENE_EVENTS.VICTORY_MOMENT, this.handleVictoryMoment, this);
        EventBus.off(SCENE_EVENTS.END_SCREEN, this.handleEndScreen, this);
        EventBus.off(SCENE_EVENTS.LOADED, this.handleSceneLoaded, this);
        EventBus.off(CHOICE_EVENTS.SELECTED, this.handleChoiceSelected, this);
        EventBus.off('scene.choice.outcome', this.handleChoiceOutcome, this);
    }

    handleSceneLoaded({ sceneData }) {
        if (sceneData.type === 'narrative') {
            this.currentSceneId = sceneData.id;
            this.updateSceneCharacters(sceneData.id);
        }
    }

    handleChoiceSelected({ choice }) {
        // Show the acting character when a choice is made
        if (choice.character) {
            this.showActingCharacter(choice.character);
        }
    }

    handleChoiceOutcome({ tier, character }) {
        // Check if this scene has a special animation type defined in manifest
        const sceneConfig = manifest.sceneDisplay?.scenes?.[this.currentSceneId];

        if (sceneConfig?.animation?.type === 'confrontation') {
            // Data-driven confrontation animation (e.g., horse encounter)
            this.animateConfrontation(tier);
        } else if (this.currentActingCharacter) {
            // Standard character animation
            this.animateCharacterOutcome(tier);
        }
    }

    updateSceneCharacters(sceneId) {
        // Clear existing narrative sprites
        this.clearNarrativeSprites();

        // Get scene display config from manifest
        const sceneConfig = manifest.sceneDisplay?.scenes?.[sceneId];
        if (!sceneConfig) return;

        // Handle Party Sprites
        if (sceneConfig.party && sceneConfig.party.show) {
            this.showPartySprites(sceneConfig.party);
        }

        // Handle Other Characters (NPCs, enemies, etc.)
        if (sceneConfig.characters) {
            sceneConfig.characters.forEach(charConfig => {
                this.showCharacterSprite(charConfig);
            });
        }
    }

    clearNarrativeSprites() {
        // Kill all tweens on narrative sprites before destroying them
        this.narrativeSprites.forEach(sprite => {
            this.scene.tweens.killTweensOf(sprite);
            sprite.destroy();
        });
        this.narrativeSprites = [];
        this.currentActingCharacter = null;
    }

    showActingCharacter(characterId) {
        // Clear any existing character (but not scene NPCs like the horse)
        if (this.currentActingCharacter?.sprite) {
            this.currentActingCharacter.sprite.destroy();
            const index = this.narrativeSprites.indexOf(this.currentActingCharacter.sprite);
            if (index > -1) this.narrativeSprites.splice(index, 1);
        }

        const character = this.gameState.party.find(p => p.id === characterId);
        if (!character) return;

        // Check for scene-specific config from manifest, fall back to defaults
        const sceneConfig = manifest.sceneDisplay?.scenes?.[this.currentSceneId];
        const defaults = manifest.sceneDisplay?.dynamicCharacterDefaults || {
            x: 0.5, y: 0.45, maxSize: 180
        };
        const config = sceneConfig?.dynamicCharacter || defaults;
        
        const x = this.scene.scale.width * config.x;
        const y = this.scene.scale.height * config.y;
        const textureUrl = character.images.idle;
        const textureKey = `narrative_${character.id}_idle`;

        // Store reference for animation
        this.currentActingCharacter = { character, sprite: null };

        // Create sprite with callback to store reference
        const sprite = this.scene.add.image(x, y, null);
        sprite.setAlpha(0);
        if (config.flipX) sprite.setFlipX(true);
        
        this.scene.characterLayer.add(sprite);
        this.narrativeSprites.push(sprite);
        this.currentActingCharacter.sprite = sprite;

        const applyTexture = () => {
            if (!sprite.active) return;
            sprite.setTexture(textureKey);
            
            // Scale to fit maxSize
            sprite.setScale(1);
            if (sprite.width > config.maxSize || sprite.height > config.maxSize) {
                const s = config.maxSize / Math.max(sprite.width, sprite.height);
                sprite.setScale(s);
            }
            // Preserve flipX after scaling
            if (config.flipX) sprite.setFlipX(true);

            // Animate in with a slight bounce
            this.scene.tweens.add({
                targets: sprite,
                alpha: 1,
                y: y - 10,
                duration: 400,
                ease: 'Back.easeOut'
            });
        };

        if (this.scene.textures.exists(textureKey)) {
            applyTexture();
        } else {
            this.scene.load.image(textureKey, textureUrl);
            this.scene.load.once(`filecomplete-image-${textureKey}`, applyTexture);
            this.scene.load.start();
        }
    }

    animateConfrontation(tier) {
        if (!this.currentActingCharacter?.sprite) return;

        const characterSprite = this.currentActingCharacter.sprite;
        const horseSprite = this.narrativeSprites.find(s => s !== characterSprite);
        
        if (!horseSprite) return;

        const isSuccess = tier === 'critical' || tier === 'success';
        const originalHorseX = horseSprite.x;
        const characterX = characterSprite.x;

        if (isSuccess) {
            // Success: Character dodges/hits horse, horse runs away
            
            // Horse charges toward character
            this.scene.tweens.add({
                targets: horseSprite,
                x: characterX + 100, // Stop short of character
                duration: 400,
                ease: 'Power2',
                onComplete: () => {
                    // Character attacks/dodges
                    if (tier === 'critical') {
                        // Critical: Character attacks
                        const character = this.currentActingCharacter.character;
                        const attackKey = `narrative_${character.id}_attack`;
                        const attackUrl = character.images.attack;
                        
                        const attackAnim = () => {
                            if (this.scene.textures.exists(attackKey) && characterSprite.active) {
                                characterSprite.setTexture(attackKey);
                                
                                // Lunge forward
                                this.scene.tweens.add({
                                    targets: characterSprite,
                                    x: characterSprite.x + 40,
                                    duration: 200,
                                    yoyo: true,
                                    ease: 'Power2'
                                });
                            }
                        };

                        if (this.scene.textures.exists(attackKey)) {
                            attackAnim();
                        } else {
                            this.scene.load.image(attackKey, attackUrl);
                            this.scene.load.once(`filecomplete-image-${attackKey}`, attackAnim);
                            this.scene.load.start();
                        }
                    } else {
                        // Regular success: Character dodges
                        this.scene.tweens.add({
                            targets: characterSprite,
                            y: characterSprite.y - 20,
                            duration: 200,
                            yoyo: true,
                            ease: 'Quad.easeOut'
                        });
                    }

                    // Horse recoils and flees
                    this.scene.time.delayedCall(300, () => {
                        this.scene.tweens.add({
                            targets: horseSprite,
                            x: this.scene.scale.width + 200,
                            duration: 600,
                            ease: 'Power2'
                        });
                    });
                }
            });

        } else {
            // Failure: Horse tramples character
            
            // Horse charges fast
            this.scene.tweens.add({
                targets: horseSprite,
                x: characterX,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    // Character gets hit - swap to hurt sprite
                    const character = this.currentActingCharacter.character;
                    const hurtKey = `narrative_${character.id}_hurt`;
                    const hurtUrl = character.images.hurt;
                    
                    const hitAnim = () => {
                        if (this.scene.textures.exists(hurtKey) && characterSprite.active) {
                            characterSprite.setTexture(hurtKey);
                        }
                        
                        // Character flies back
                        this.scene.tweens.add({
                            targets: characterSprite,
                            x: characterSprite.x - 80,
                            y: characterSprite.y + 20,
                            angle: -45,
                            duration: 400,
                            ease: 'Power2'
                        });
                    };

                    if (this.scene.textures.exists(hurtKey)) {
                        hitAnim();
                    } else {
                        this.scene.load.image(hurtKey, hurtUrl);
                        this.scene.load.once(`filecomplete-image-${hurtKey}`, hitAnim);
                        this.scene.load.start();
                    }

                    // Horse continues past
                    this.scene.tweens.add({
                        targets: horseSprite,
                        x: characterX - 200,
                        duration: 400,
                        ease: 'Power2'
                    });
                }
            });
        }
    }

    celebrateVictory() {
        // Wait for sprites to load and fade in, then start looping celebration animations
        this.scene.time.delayedCall(1000, () => {
            this.narrativeSprites.forEach((sprite, index) => {
                if (!sprite.active) return;
                
                const baseY = sprite.y;
                const partyIndex = sprite.getData('partyIndex');
                
                if (partyIndex !== null && partyIndex !== undefined) {
                    // Each character has unique celebration pattern
                    switch (partyIndex) {
                        case 0: // First character - enthusiastic jumping
                            this.scene.tweens.add({
                                targets: sprite,
                                y: baseY - 25,
                                duration: 400,
                                yoyo: true,
                                repeat: -1,
                                ease: 'Quad.easeOut',
                                delay: partyIndex * 200
                            });
                            break;

                        case 1: // Second character - spinning joy
                            this.scene.tweens.add({
                                targets: sprite,
                                angle: 360,
                                duration: 2000,
                                repeat: -1,
                                ease: 'Linear',
                                delay: partyIndex * 200
                            });
                            this.scene.tweens.add({
                                targets: sprite,
                                y: baseY - 15,
                                duration: 1000,
                                yoyo: true,
                                repeat: -1,
                                ease: 'Sine.easeInOut',
                                delay: partyIndex * 200
                            });
                            break;

                        case 2: // Third character - bouncy celebration
                            this.scene.tweens.add({
                                targets: sprite,
                                y: baseY - 20,
                                scaleX: sprite.scaleX * 1.1,
                                scaleY: sprite.scaleY * 1.1,
                                duration: 600,
                                yoyo: true,
                                repeat: -1,
                                ease: 'Back.easeOut',
                                delay: partyIndex * 200
                            });
                            break;

                        case 3: // Fourth character - side to side dance
                            const baseX = sprite.x;
                            this.scene.tweens.add({
                                targets: sprite,
                                x: baseX - 15,
                                duration: 500,
                                yoyo: true,
                                repeat: -1,
                                ease: 'Sine.easeInOut',
                                delay: partyIndex * 200
                            });
                            this.scene.tweens.add({
                                targets: sprite,
                                y: baseY - 10,
                                duration: 250,
                                yoyo: true,
                                repeat: -1,
                                ease: 'Quad.easeOut',
                                delay: partyIndex * 200
                            });
                            break;
                    }
                }
            });
        });
    }

    animateCharacterOutcome(tier) {
        if (!this.currentActingCharacter?.sprite) return;

        const sprite = this.currentActingCharacter.sprite;
        const character = this.currentActingCharacter.character;
        
        // Determine success vs failure
        const isSuccess = tier === 'critical' || tier === 'success';
        const isCritical = tier === 'critical';
        const isFailure = tier === 'failure';

        if (isCritical) {
            // Critical success - big celebration bounce
            this.scene.tweens.add({
                targets: sprite,
                y: sprite.y - 30,
                duration: 200,
                yoyo: true,
                ease: 'Quad.easeOut',
                repeat: 1
            });
            
            // Add a spin for extra flair
            this.scene.tweens.add({
                targets: sprite,
                angle: 360,
                duration: 600,
                ease: 'Back.easeOut'
            });
            
        } else if (isSuccess) {
            // Regular success - small hop
            this.scene.tweens.add({
                targets: sprite,
                y: sprite.y - 20,
                duration: 250,
                yoyo: true,
                ease: 'Quad.easeOut'
            });
            
        } else if (isFailure) {
            // Failure - shake and show hurt sprite if available
            const originalX = sprite.x;
            
            // Try to swap to hurt sprite
            const hurtTextureKey = `narrative_${character.id}_hurt`;
            const hurtUrl = character.images.hurt;
            
            if (hurtUrl) {
                const swapToHurt = () => {
                    // Guard against sprite being destroyed before texture loads
                    if (sprite && sprite.scene && this.scene.textures.exists(hurtTextureKey)) {
                        sprite.setTexture(hurtTextureKey);
                    }
                };
                
                if (this.scene.textures.exists(hurtTextureKey)) {
                    swapToHurt();
                } else {
                    this.scene.load.image(hurtTextureKey, hurtUrl);
                    this.scene.load.once(`filecomplete-image-${hurtTextureKey}`, swapToHurt);
                    this.scene.load.start();
                }
            }
            
            // Shake animation
            this.scene.tweens.add({
                targets: sprite,
                x: originalX - 8,
                duration: 50,
                yoyo: true,
                repeat: 5,
                ease: 'Linear'
            });
            
        } else {
            // Partial success - subtle nod
            this.scene.tweens.add({
                targets: sprite,
                y: sprite.y - 10,
                duration: 200,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });
        }
    }

    showPartySprites(config) {
        const party = this.gameState.party;
        const startX = this.scene.scale.width * config.startX;
        const y = this.scene.scale.height * config.y;
        const spacing = this.scene.scale.width * config.spacing;
        const scale = config.scale || 1;
        const maxSize = config.maxSize || null;

        party.forEach((member, index) => {
            const x = startX + (index * spacing);
            const textureUrl = member.images[config.pose || 'idle'];

            // Use member ID + pose as texture key
            const textureKey = `narrative_${member.id}_${config.pose}`;

            this.createAndLoadSprite(textureKey, textureUrl, x, y, false, scale, maxSize, index);
        });

        // If this is a victory scene (defined in manifest), trigger celebration animations
        const victoryScenes = manifest.sceneDisplay?.victoryScenes || [];
        if (victoryScenes.includes(this.currentSceneId)) {
            this.celebrateVictory();
        }
    }

    showCharacterSprite(config) {
        const x = this.scene.scale.width * config.x;
        const y = this.scene.scale.height * config.y;
        
        this.createAndLoadSprite(config.texture, config.url, x, y, config.flipX, config.scale, config.maxSize);
    }

    createAndLoadSprite(key, url, x, y, flipX = false, scale = 1, maxSize = null, partyIndex = null) {
        // Create placeholder sprite
        const sprite = this.scene.add.image(x, y, null);
        sprite.setAlpha(0);
        if (flipX) sprite.setFlipX(true);
        
        // Store party index for victory animations
        if (partyIndex !== null) {
            sprite.setData('partyIndex', partyIndex);
        }
        
        this.scene.characterLayer.add(sprite);
        this.narrativeSprites.push(sprite);

        const applyTexture = () => {
            if (!sprite.active) return; // Sprite might have been destroyed
            sprite.setTexture(key);
            
            // Apply scale - either explicit scale or fit to maxSize
            if (maxSize) {
                // Scale to fit within maxSize (like CombatView does)
                sprite.setScale(1);
                if (sprite.width > maxSize || sprite.height > maxSize) {
                    const s = maxSize / Math.max(sprite.width, sprite.height);
                    sprite.setScale(s);
                }
            } else if (scale !== 1) {
                sprite.setScale(scale);
            } else {
                 // Auto-scale if too big (max 300px height?)
                 if (sprite.height > 300) {
                     const s = 300 / sprite.height;
                     sprite.setScale(s);
                 }
            }

            // Animate in - stagger if party member
            const delay = partyIndex !== null ? partyIndex * 150 : 0;
            
            this.scene.tweens.add({
                targets: sprite,
                alpha: 1,
                y: y, // Final Y (maybe start slightly off?)
                duration: 500,
                ease: 'Power2',
                delay: delay
            });
        };

        if (this.scene.textures.exists(key)) {
            applyTexture();
        } else {
            this.scene.load.image(key, url);
            this.scene.load.once(`filecomplete-image-${key}`, applyTexture);
            this.scene.load.start();
        }
    }

    handleMusicChanged({ music }) {
        if (!music) return; // Don't stop music if undefined, only if explicitly null? No, probably just switch if new track.
        
        // If it's the same track, do nothing
        if (this.currentMusicKey === music) return;

        // If we have current music playing, fade it out
        if (this.currentMusic) {
            this.scene.tweens.add({
                targets: this.currentMusic,
                volume: 0,
                duration: 1000,
                onComplete: (tween, targets) => {
                    targets[0].stop();
                    targets[0].destroy();
                }
            });
        }

        this.currentMusicKey = music;

        // Load and play new music
        if (this.scene.cache.audio.exists(music)) {
            this.playMusic(music);
        } else {
            this.scene.load.audio(music, encodeURI(music));
            this.scene.load.once('complete', () => {
                // Ensure we haven't switched again while loading
                if (this.currentMusicKey === music) {
                    if (this.scene.cache.audio.exists(music)) {
                        this.playMusic(music);
                    } else {
                        console.warn(`Failed to load music: ${music}`);
                    }
                }
            });
            this.scene.load.start();
        }
    }

    playMusic(key) {
        this.currentMusic = this.scene.sound.add(key, { 
            loop: true,
            volume: 0 
        });
        this.currentMusic.play();
        
        this.scene.tweens.add({
            targets: this.currentMusic,
            volume: 0.5,
            duration: 1000
        });
    }

    handleBackgroundChanged({ background }) {
        const { backgroundLayer, scale } = this.scene;
        
        if (!background) {
            backgroundLayer.removeAll(true);
            const bg = this.scene.add.graphics();
            bg.fillGradientStyle(0x16213e, 0x16213e, 0x0f3460, 0x0f3460);
            bg.fillRect(0, 0, scale.width, scale.height);
            backgroundLayer.add(bg);
            return;
        }

        // Check if texture exists (using URL as key)
        if (this.scene.textures.exists(background)) {
            this.setBackground(background);
        } else {
            // Load it
            this.scene.load.image(background, background);
            this.scene.load.once('complete', () => {
                this.setBackground(background);
            });
            this.scene.load.start();
        }
    }

    setBackground(key) {
        const { backgroundLayer, scale } = this.scene;
        backgroundLayer.removeAll(true);
        
        // Add new background
        const img = this.scene.add.image(scale.width / 2, scale.height / 2, key);
        
        // Scale to cover
        const scaleX = scale.width / img.width;
        const scaleY = scale.height / img.height;
        const finalScale = Math.max(scaleX, scaleY);
        img.setScale(finalScale);
        
        backgroundLayer.add(img);
    }

    handleCombatModeChanged({ enabled, animate }) {
        const {
            vignetteLayer,
            healthDisplay,
            enemyDisplay,
            initiativeTracker,
            characterSelectPanel,
            abilityPanel
        } = this.scene;

        if (enabled) {
            this.clearNarrativeSprites(); // Clear narrative sprites when combat starts
            this.drawVignette();
            initiativeTracker.clear();

            if (animate) {
                vignetteLayer.setAlpha(0);
                healthDisplay.setAlpha(0);
                enemyDisplay.setAlpha(0);
                initiativeTracker.setAlpha(0);

                vignetteLayer.setVisible(true);
                healthDisplay.setVisible(true);
                enemyDisplay.setVisible(true);
                initiativeTracker.setVisible(true);

                this.scene.tweens.add({
                    targets: [vignetteLayer, healthDisplay, enemyDisplay, initiativeTracker],
                    alpha: 1,
                    duration: 400,
                    ease: 'Sine.easeIn'
                });
            } else {
                vignetteLayer.setVisible(true);
                healthDisplay.setVisible(true);
                enemyDisplay.setVisible(true);
                initiativeTracker.setVisible(true);
            }
            
            // Start pulsing animation for vignette
            this.startVignettePulse();
            
            // Update party health display
            healthDisplay.updateParty(this.gameState.party);
        } else {
            // Stop pulsing animation
            this.stopVignettePulse();
            
            vignetteLayer.setVisible(false);
            healthDisplay.setVisible(false);
            enemyDisplay.setVisible(false);
            characterSelectPanel.setVisible(false);
            abilityPanel.setVisible(false);
            initiativeTracker.setVisible(false);

            enemyDisplay.clear();
        }
    }

    drawVignette(intensity = 1.0) {
        const { width, height } = this.scene.scale;
        const graphics = this.scene.vignetteGraphics;
        graphics.clear();
        
        // Subtle red vignette with gradient - polished combat feel
        const edgeWidth = 80;
        const baseAlpha = 0.35;
        const outerAlpha = baseAlpha * intensity;  // Varies with pulse
        const innerAlpha = 0;     // Transparent toward center
        
        // Subtle dark red color
        const redColor = 0x4a0a0a;
        
        // Top edge - gradient from dark at top to transparent at bottom
        // fillGradientStyle(topLeft, topRight, bottomLeft, bottomRight, alphaTopLeft, alphaTopRight, alphaBottomLeft, alphaBottomRight)
        graphics.fillGradientStyle(redColor, redColor, redColor, redColor, outerAlpha, outerAlpha, innerAlpha, innerAlpha);
        graphics.fillRect(0, 0, width, edgeWidth);
        
        // Bottom edge - gradient from transparent at top to dark at bottom
        graphics.fillGradientStyle(redColor, redColor, redColor, redColor, innerAlpha, innerAlpha, outerAlpha, outerAlpha);
        graphics.fillRect(0, height - edgeWidth, width, edgeWidth);
        
        // Left edge - gradient from dark at left to transparent at right
        graphics.fillGradientStyle(redColor, redColor, redColor, redColor, outerAlpha, innerAlpha, outerAlpha, innerAlpha);
        graphics.fillRect(0, 0, edgeWidth, height);
        
        // Right edge - gradient from transparent at left to dark at right
        graphics.fillGradientStyle(redColor, redColor, redColor, redColor, innerAlpha, outerAlpha, innerAlpha, outerAlpha);
        graphics.fillRect(width - edgeWidth, 0, edgeWidth, height);
    }

    startVignettePulse() {
        // Stop any existing pulse
        this.stopVignettePulse();
        
        // Create a subtle pulsing effect
        this.vignettePulseIntensity = 1.0;
        this.vignettePulseTween = this.scene.tweens.addCounter({
            from: 1.0,
            to: 1.3,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
            onUpdate: (tween) => {
                this.vignettePulseIntensity = tween.getValue();
                this.drawVignette(this.vignettePulseIntensity);
            }
        });
    }

    stopVignettePulse() {
        if (this.vignettePulseTween) {
            this.vignettePulseTween.stop();
            this.vignettePulseTween = null;
        }
    }

    handleVictoryMoment({ onComplete }) {
        const { width, height } = this.scene.scale;
        this.scene.choicePanel.hide();

        const flash = this.scene.add.graphics();
        flash.fillStyle(0xffd700, 0.3);
        flash.fillRect(0, 0, width, height);
        flash.setAlpha(0);
        this.scene.uiLayer.add(flash);

        const fonts = manifest.ui?.fonts || {};
        const colors = manifest.ui?.colors || {};
        const victoryText = createCenteredText(this.scene, width / 2, height / 2, 'VICTORY!', {
            fontSize: '64px',
            fontFamily: fonts.primary || 'Georgia, serif',
            color: colors.textSpeaker || '#ffd700',
            fontStyle: 'bold',
            stroke: colors.combat?.textStroke || '#000000',
            strokeThickness: 6
        });
        victoryText.setAlpha(0);
        victoryText.setScale(0.5);
        this.scene.uiLayer.add(victoryText);

        this.scene.tweens.add({
            targets: flash,
            alpha: 0.5,
            duration: 150,
            yoyo: true,
            onComplete: () => flash.setAlpha(0.1)
        });

        const clickText = createCenteredText(this.scene, width / 2, height / 2 + 60, 'Click to continue...', {
            fontSize: fonts.sizes?.title || '16px',
            fontFamily: fonts.primary || 'Georgia, serif',
            color: colors.textPrimary || '#ffffff'
        });
        clickText.setAlpha(0);
        this.scene.uiLayer.add(clickText);

        this.scene.tweens.add({
            targets: victoryText,
            alpha: 1,
            scale: 1,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({ targets: clickText, alpha: 1, duration: 300 });
                this.scene.tweens.add({
                    targets: clickText,
                    alpha: 0.5,
                    duration: 600,
                    yoyo: true,
                    repeat: -1,
                    delay: 300
                });

                const clickHandler = () => {
                    flash.off('pointerdown', clickHandler);
                    this.scene.tweens.killTweensOf(clickText);
                    this.scene.tweens.add({
                        targets: [victoryText, flash, clickText],
                        alpha: 0,
                        duration: 300,
                        onComplete: () => {
                            victoryText.destroy();
                            flash.destroy();
                            clickText.destroy();
                            if (onComplete) onComplete();
                        }
                    });
                };

                flash.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
                flash.on('pointerdown', clickHandler);
            }
        });
    }

    handleEndScreen() {
        const { width, height } = this.scene.scale;
        this.scene.choicePanel.hide();

        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        this.scene.uiLayer.add(overlay);

        const fonts = manifest.ui?.fonts || {};
        const colors = manifest.ui?.colors || {};

        const endText = createCenteredText(this.scene, width / 2, height / 2 - 60, 'THE END', {
            fontSize: '48px',
            fontFamily: fonts.primary || 'Georgia, serif',
            color: colors.textSpeaker || '#ffd700',
            fontStyle: 'bold'
        });
        this.scene.uiLayer.add(endText);

        const titleText = createCenteredText(this.scene, width / 2, height / 2, manifest.title, {
            fontSize: '24px',
            fontFamily: fonts.primary || 'Georgia, serif',
            color: colors.textPrimary || '#e8e8e8'
        });
        this.scene.uiLayer.add(titleText);

        const buttonWidth = 200;
        const buttonHeight = 50;
        const buttonX = width / 2 - buttonWidth / 2;
        const buttonY = height / 2 + 60;

        const button = this.scene.add.graphics();
        button.fillStyle(0x2d2d44, 1);
        button.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        button.lineStyle(2, 0x4a4a6a);
        button.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        this.scene.uiLayer.add(button);

        const buttonText = createCenteredText(this.scene, width / 2, buttonY + buttonHeight / 2, 'Play Again', {
            fontSize: '18px',
            fontFamily: fonts.primary || 'Georgia, serif',
            color: colors.buttonText || '#ffffff'
        });
        this.scene.uiLayer.add(buttonText);

        button.setInteractive(new Phaser.Geom.Rectangle(buttonX, buttonY, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);

        button.on('pointerover', () => {
            button.clear();
            button.fillStyle(0x4a4a6a, 1);
            button.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
            button.lineStyle(2, 0x6a6a8a);
            button.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        });

        button.on('pointerout', () => {
            button.clear();
            button.fillStyle(0x2d2d44, 1);
            button.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
            button.lineStyle(2, 0x4a4a6a);
            button.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        });

        button.on('pointerdown', () => {
            button.disableInteractive();
            overlay.destroy();
            endText.destroy();
            titleText.destroy();
            button.destroy();
            buttonText.destroy();

            this.gameState.reset();
            EventBus.emit(SCENE_EVENTS.LOAD_REQUESTED, { sceneId: this.gameState.currentScene });
        });
    }
}
