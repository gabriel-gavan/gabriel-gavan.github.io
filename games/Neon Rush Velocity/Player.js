import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Player {
    constructor(scene) {
        this.scene = scene;
        const loader = new THREE.TextureLoader();
        this.currentLane = 1; // 0, 1, 2
        this.previousLane = 1; // For bumping back
        this.targetX = CONFIG.LANES[this.currentLane];
        this.y = 0;
        this.velocityY = 0;
        this.isGrounded = true;
        this.isSliding = false;
        this.isDead = false;
        this.slideTimer = 0;
        this.slideDuration = 0.6;

        // Power-up states
        this.activePowerUps = {
            magnet: 0,
            jetpack: 0,
            shield: 0,
            boost: 0,
            super_jump: 0,
            multiplier: 0,
            hoverboard: 0
        };

        this.showEquipment = true; 
        this.boardInvisible = false; 

        this.particles = [];
        this.maxParticles = 20;

        // Optimized Shared Geometries/Materials
        this.trailGeom = new THREE.PlaneGeometry(0.1, 0.4);
        this.trailMat = new THREE.MeshBasicMaterial({ 
            transparent: true, 
            side: THREE.DoubleSide
        });

        this.mesh = this._createMesh();
        this.scene.add(this.mesh);

        // Shield visual - Restored to Basic Material for Neon Glow
        const shieldTex = loader.load(CONFIG.ASSETS.ICONS.SHIELD);
        this.shieldMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(3, 3),
            new THREE.MeshBasicMaterial({ 
                map: shieldTex, 
                transparent: true, 
                side: THREE.DoubleSide
            })
        );
        this.shieldMesh.visible = false;
        this.mesh.add(this.shieldMesh);

        // Hoverboard visual - Using high-fidelity sprite
        const boardTex = loader.load(CONFIG.ASSETS.ICONS.HOVERBOARD);
        const boardGeom = new THREE.PlaneGeometry(3, 1.5);
        this.boardMaterial = new THREE.MeshBasicMaterial({ 
            map: boardTex,
            transparent: true,
            side: THREE.DoubleSide
        });
        this.hoverboardMesh = new THREE.Mesh(boardGeom, this.boardMaterial);
        this.hoverboardMesh.rotation.x = Math.PI / 2;
        this.hoverboardMesh.position.y = -0.5;
        this.hoverboardMesh.visible = false;
        this.mesh.add(this.hoverboardMesh);

        // Jetpack visual - Restored to Basic Material for Neon Glow
        const jetpackTex = loader.load(CONFIG.ASSETS.ICONS.JETPACK);
        this.jetpackMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1.5, 1.5),
            new THREE.MeshBasicMaterial({ 
                map: jetpackTex, 
                transparent: true, 
                side: THREE.DoubleSide
            })
        );
        this.jetpackMesh.position.set(0, 1.5, 0.5); // On back
        this.jetpackMesh.visible = false;
        this.mesh.add(this.jetpackMesh);
    }

    setBoardSkin(config) {
        if (this.boardMaterial) {
            if (typeof config === 'object') {
                this.boardMaterial.color.setHex(config.color);
                this.boardInvisible = config.invisible || false;
            } else {
                this.boardMaterial.color.setHex(config);
            }
        }
    }

    _createMesh() {
        const group = new THREE.Group();
        
        // High-fidelity Sprite for Player
        const loader = new THREE.TextureLoader();
        this.textures = {
            idle: loader.load(CONFIG.ASSETS.PLAYER_FRONT_TEXTURE),
            backIdle: loader.load(CONFIG.ASSETS.PLAYER_BACK_TEXTURE),
            run: CONFIG.ASSETS.PLAYER_FRONT_RUN_TEXTURES.map(url => loader.load(url)),
            frontRun: CONFIG.ASSETS.PLAYER_FRONT_RUN_TEXTURES.map(url => loader.load(url)),
            jump: loader.load(CONFIG.ASSETS.PLAYER_JUMP_TEXTURE),
            frontJump: loader.load(CONFIG.ASSETS.PLAYER_JUMP_TEXTURE),
            slide: loader.load(CONFIG.ASSETS.PLAYER_SLIDE_TEXTURE),
            frontSlide: loader.load(CONFIG.ASSETS.PLAYER_FRONT_SLIDE_TEXTURE),
            crash: loader.load(CONFIG.ASSETS.PLAYER_CRASH_TEXTURE),
            frontCrash: loader.load(CONFIG.ASSETS.PLAYER_CRASH_TEXTURE)
        };
        this.runFrame = 0;
        this.runTimer = 0;
        this.runFrameDuration = 0.1;

        const playerGeom = new THREE.PlaneGeometry(1.5, 2.4); 
        const playerMat = new THREE.MeshBasicMaterial({ 
            map: this.textures.idle,
            transparent: true,
            alphaTest: 0.1, 
            side: THREE.DoubleSide
        });
        this.spriteMesh = new THREE.Mesh(playerGeom, playerMat);
        this.spriteMesh.position.y = 1.2; 
        
        group.add(this.spriteMesh);

        // Blob Shadow - Standard for grounding
        const shadowGeom = new THREE.CircleGeometry(0.8, 32);
        const shadowMat = new THREE.MeshBasicMaterial({ 
            color: 0x000000, 
            transparent: true, 
            opacity: 0.4 
        });
        this.shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
        this.shadowMesh.rotation.x = -Math.PI / 2;
        this.shadowMesh.position.y = 0.05; // Offset slightly above track
        group.add(this.shadowMesh);

        // Keep the procedural body for logic/collision if needed, but make it invisible
        const bodyGeom = new THREE.BoxGeometry(0.7, CONFIG.PLAYER_HEIGHT, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({ visible: false });
        this.bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        this.bodyMesh.position.y = CONFIG.PLAYER_HEIGHT / 2;
        group.add(this.bodyMesh);

        this.accentMaterial = playerMat; 

        return group;
    }

    setSkin(config) {
        if (this.accentMaterial) {
            if (typeof config === 'object') {
                this.accentMaterial.color.setHex(config.color);
                this.showEquipment = !config.noEquipment;
            } else {
                this.accentMaterial.color.setHex(config);
            }
        }
    }

    _updateSprite(dt, isPlaying) {
        // Use back textures during gameplay, and front textures (facing camera) in menus
        let targetTex;

        if (this.isDead) {
            targetTex = isPlaying ? this.textures.crash : this.textures.frontCrash;
        } else if (!this.isGrounded) {
            targetTex = isPlaying ? this.textures.jump : this.textures.frontJump;
        } else if (this.isSliding) {
            targetTex = isPlaying ? this.textures.slide : this.textures.frontSlide;
        } else if (isPlaying) {
            this.runTimer += dt;
            if (this.runTimer >= this.runFrameDuration) {
                this.runTimer = 0;
                this.runFrame = (this.runFrame + 1) % 8;
            }
            targetTex = this.textures.run[this.runFrame];
        } else {
            // Hero pose for menu (facing camera)
            targetTex = this.textures.frontRun[2]; 
        }
        
        if (this.accentMaterial.map !== targetTex) {
            this.accentMaterial.map = targetTex;
            this.accentMaterial.needsUpdate = true;
        }
    }

    update(dt, input, camera, isPlaying) {
        // Power-up timers
        for (let key in this.activePowerUps) {
            if (this.activePowerUps[key] > 0) {
                this.activePowerUps[key] -= dt;
                if (this.activePowerUps[key] <= 0) {
                    this.activePowerUps[key] = 0;
                    this._onPowerUpEnd(key);
                }
            }
        }

        this._updateSprite(dt, isPlaying);

        // Character Orientation: Oriented forward (+Z)
        if (isPlaying) {
            // Apply some tilt for "feel" during lane switches
            const steerAmount = (this.targetX - this.mesh.position.x) * 0.1;
            this.spriteMesh.rotation.z = THREE.MathUtils.lerp(this.spriteMesh.rotation.z, -steerAmount, 10 * dt);
            
            // Subtle forward lean
            let targetTiltX = 0.1;
            if (this.isSliding) targetTiltX = 0.4;
            this.spriteMesh.rotation.x = THREE.MathUtils.lerp(this.spriteMesh.rotation.x, targetTiltX, 10 * dt);
        } else {
            this.spriteMesh.rotation.set(0, 0, 0);
        }

        // Accessories follow character orientation
        if (this.shieldMesh) this.shieldMesh.rotation.copy(this.spriteMesh.rotation);
        if (this.jetpackMesh) this.jetpackMesh.rotation.copy(this.spriteMesh.rotation);


        // Lane switching
        if (input.consumeAction('left') && this.currentLane > 0) {
            this.previousLane = this.currentLane;
            this.currentLane--;
        }
        if (input.consumeAction('right') && this.currentLane < 2) {
            this.previousLane = this.currentLane;
            this.currentLane++;
        }
        this.targetX = CONFIG.LANES[this.currentLane];

        // Smooth horizontal move
        this.mesh.position.x = THREE.MathUtils.lerp(this.mesh.position.x, this.targetX, CONFIG.LANE_SWITCH_SPEED * dt);

        // Jetpack logic
        if (this.activePowerUps.jetpack > 0) {
            this.y = THREE.MathUtils.lerp(this.y, 12, 3 * dt); // Raised flight height
            this.isGrounded = false;
        } else {
            // Jump
            if (input.consumeAction('up') && this.isGrounded) {
                const jumpForce = this.activePowerUps.super_jump > 0 ? CONFIG.JUMP_FORCE * 1.5 : CONFIG.JUMP_FORCE;
                this.velocityY = jumpForce;
                this.isGrounded = false;
                this.stopSlide();
            }

            // Apply Gravity
            if (!this.isGrounded) {
                this.velocityY -= CONFIG.GRAVITY * dt;
                this.y += this.velocityY * dt;

                if (this.y <= 0) {
                    this.y = 0;
                    this.velocityY = 0;
                    this.isGrounded = true;
                }
            }
        }

        // Slide logic
        if (input.consumeAction('down') && this.isGrounded && !this.isSliding) {
            this.startSlide();
        }

        if (this.isSliding) {
            this.slideTimer -= dt;
            if (this.slideTimer <= 0) {
                this.stopSlide();
            }
        }

        this.mesh.position.y = this.y + (this.isSliding ? CONFIG.PLAYER_HEIGHT / 4 : 0);
        
        // Update Shadow
        if (this.shadowMesh) {
            this.shadowMesh.position.y = -this.y + 0.05; // Stay on ground
            const shadowScale = Math.max(0.2, 1.0 - (this.y * 0.15));
            this.shadowMesh.scale.setScalar(shadowScale);
            this.shadowMesh.material.opacity = 0.4 * shadowScale;
        }

        this.shieldMesh.visible = this.showEquipment && this.activePowerUps.shield > 0;
        this.hoverboardMesh.visible = !this.boardInvisible && this.activePowerUps.hoverboard > 0;
        this.jetpackMesh.visible = this.showEquipment && this.activePowerUps.jetpack > 0;
        
        this._animateProcedural(dt);
        this._updateParticles(dt, isPlaying);
    }

    _animateProcedural(dt) {
        if (this.isGrounded && !this.isSliding) {
            // Running or Idle bobbing
            const time = Date.now() * 0.01;
            this.mesh.position.y = this.y + Math.abs(Math.sin(time)) * 0.2;
            this.spriteMesh.scale.setScalar(1.0); // Reset jump scale
        } else if (!this.isGrounded) {
            // Jump - subtle scale effect instead of rotation for sprites
            this.spriteMesh.scale.setScalar(1.0 + Math.abs(this.velocityY) * 0.02);
        } else if (this.isSliding) {
            // Slide animation handled in startSlide/stopSlide
        }
    }

    activatePowerUp(type, duration) {
        const finalDuration = duration || CONFIG.DURATIONS[type.toUpperCase()] || 10;
        this.activePowerUps[type] = finalDuration;
        
        if (type === 'boost') {
            // Boost logic handled in GameScene by increasing moveSpeed
        }
    }

    _onPowerUpEnd(type) {
        if (type === 'jetpack') {
            // Gravity will take over
        }
    }

    _updateParticles(dt, isPlaying) {
        // Power-up trail colors
        const color = this.activePowerUps.boost > 0 ? 0xffffff : 
                     this.activePowerUps.jetpack > 0 ? 0x00ff00 : 
                     CONFIG.COLORS.PLAYER; 
        
        // Restore emissive pulsing logic
        const trailOpacity = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;

        // Spawn trail particles more frequently for "streak" effect - ONLY DURING GAMEPLAY
        if (isPlaying && Math.random() < 0.8) {
            // Reusing shared geometry and material but cloning material is faster than full object creation
            const pMat = this.trailMat.clone();
            pMat.color.setHex(color);
            pMat.opacity = trailOpacity;
            const p = new THREE.Mesh(this.trailGeom, pMat);
            p.position.copy(this.mesh.position);
            p.position.y += Math.random() * 0.5;
            p.position.z += 0.5;
            p.rotation.x = Math.PI / 2;
            this.scene.add(p);
            this.particles.push({ mesh: p, life: 1.0, type: 'trail' });
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt * 2; // Slightly slower fade for more visibility
            if (p.type === 'trail') {
                p.mesh.scale.x = p.life;
                p.mesh.position.z += 10 * dt; // Drift back
            } else {
                p.mesh.scale.setScalar(p.life);
                if (p.velocity) {
                    p.mesh.position.addScaledVector(p.velocity, dt);
                    p.velocity.y -= 15 * dt; // Gravity for the "pop" feel
                    p.velocity.multiplyScalar(0.98); // Air resistance
                }
            }
            p.mesh.material.opacity = p.life;
            
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                if (p.mesh.material.dispose) p.mesh.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }

    startSlide() {
        if (this.isSliding) return;
        this.isSliding = true;
        this.slideTimer = this.slideDuration;
        this.spriteMesh.scale.y = 0.5;
        this.spriteMesh.position.y = 0.6; // Corrected: half-height of squashed sprite (1.2/2)
    }

    stopSlide() {
        this.isSliding = false;
        this.spriteMesh.scale.y = 1.0;
        this.spriteMesh.position.y = 1.2; // Corrected: reset to new standard height (2.4/2)
    }

    getBounds() {
        this.mesh.updateMatrixWorld(true);
        const box = new THREE.Box3();
        // Specifically use the bodyMesh for the collision box to be precise
        box.setFromObject(this.bodyMesh);
        // Slightly tighten the box for better player experience
        box.expandByVector(new THREE.Vector3(-0.05, -0.05, -0.05));
        return box;
    }

    reset() {
        this.currentLane = 1;
        this.targetX = CONFIG.LANES[this.currentLane];
        this.mesh.position.set(0, CONFIG.PLAYER_HEIGHT / 2, 0); // Start at center for run
        this.mesh.rotation.y = 0; // Reset rotation for run
        this.y = 0;
        this.velocityY = 0;
        this.isGrounded = true;
        this.isDead = false;
        this.stopSlide();
        
        for (let key in this.activePowerUps) this.activePowerUps[key] = 0;
        this.shieldMesh.visible = false;

        this.particles.forEach(p => this.scene.remove(p.mesh));
        this.particles = [];
    }
}
