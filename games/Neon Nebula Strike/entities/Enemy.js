import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Enemy {
    constructor(scene, player, position, type = 'normal') {
        this.scene = scene;
        this.player = player;
        this.alive = true;
        this.type = type; // 'normal', 'boss', 'armored', 'heavy', 'final_boss'
        this.isBoss = type === 'boss' || type === 'final_boss';
        this.isFinalBoss = type === 'final_boss';
        this.isArmored = type === 'armored';
        this.isHeavy = type === 'heavy';
        
        if (this.isFinalBoss) {
            this.health = CONFIG.FINAL_BOSS.HEALTH;
            this.speed = CONFIG.FINAL_BOSS.MOVE_SPEED;
            this.attackState = 'CHASE';
            this.stateTimer = 0;
            this.lastStateChange = 0;
            this.nextSummonTime = 0;
            this.projectiles = [];
        } else if (this.isBoss) {
            this.health = CONFIG.BOSS.HEALTH;
            this.speed = CONFIG.BOSS.MOVE_SPEED;
        } else if (this.isHeavy) {
            this.health = 400;
            this.speed = CONFIG.ENEMY.MOVE_SPEED * 0.7;
        } else if (this.isArmored) {
            this.health = 200;
            this.speed = CONFIG.ENEMY.MOVE_SPEED * 0.9;
        } else {
            this.health = 100;
            this.speed = CONFIG.ENEMY.MOVE_SPEED + Math.random() * 2;
        }
        
        this.walkTimer = Math.random() * Math.PI * 2;
        
        // Texture loading
        const textureLoader = new THREE.TextureLoader();
        let texture;
        if (this.isFinalBoss) {
            texture = textureLoader.load(CONFIG.ASSETS.FINAL_BOSS_OVERMIND);
        } else if (this.isBoss) {
            texture = textureLoader.load(CONFIG.ASSETS.BOSS);
        } else if (this.isHeavy) {
            texture = textureLoader.load(CONFIG.ASSETS.HEAVY_JUGGERNAUT);
        } else if (this.isArmored) {
            texture = textureLoader.load(CONFIG.ASSETS.ARMORED_SOLDIER);
        } else {
            const monsterUrl = CONFIG.ASSETS.MONSTERS[Math.floor(Math.random() * CONFIG.ASSETS.MONSTERS.length)];
            texture = textureLoader.load(monsterUrl);
        }
        
        // Use Sprite for the enemy to always face the camera
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 1,
            color: this.isFinalBoss ? 0xffaaaa : (this.isBoss ? 0xffccaa : 0xffffff)
        });
        this.sprite = new THREE.Sprite(material);
        
        // --- Visual Improvements: Rim Light Silhouette ---
        const rimMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.15,
            color: this.isFinalBoss ? 0xff0000 : (this.isBoss ? 0xff6600 : 0x00ff7f),
            blending: THREE.AdditiveBlending
        });
        this.rimSprite = new THREE.Sprite(rimMat);
        this.rimSprite.scale.set(1.1, 1.1, 1); // Slightly larger
        this.sprite.add(this.rimSprite);
        
        // Add a shadow/suppression under the enemy
        const glowGeo = new THREE.CircleGeometry(1, 16);
        const glowMat = new THREE.MeshBasicMaterial({ 
            color: 0x000000, // Black shadow instead of glow
            transparent: true, 
            opacity: 0.4, 
            side: THREE.DoubleSide
        });
        this.baseGlow = new THREE.Mesh(glowGeo, glowMat);
        this.baseGlow.rotation.x = Math.PI / 2;
        this.baseGlow.position.y = 0.05;
        this.scene.add(this.baseGlow);
        
        let baseScale = 3;
        if (this.isFinalBoss) baseScale = CONFIG.FINAL_BOSS.SCALE;
        else if (this.isBoss) baseScale = CONFIG.BOSS.SCALE;
        else if (this.isHeavy) baseScale = 5;
        else if (this.isArmored) baseScale = 3.5;

        this.baseScaleX = baseScale;
        this.baseScaleY = baseScale;

        this.sprite.scale.set(baseScale, baseScale, 1);
        this.sprite.position.copy(position);
        this.sprite.position.y = baseScale / 2; 
        
        this.scene.add(this.sprite);

        // State
        this.frozenTimer = 0;
        this.stunTimer = 0;
        this.acidTimer = 0;
        this.stalkTimer = Math.random() * 5; // Initial stalk time
        this.aiState = 'CHASE'; // 'CHASE', 'STALK'

        // Health Bar Setup
        this.maxHealth = this.health;
        this.createHealthBar(baseScale);
        
        // Collision radius
        this.radius = this.isFinalBoss ? 8.0 : (this.isBoss ? 4.0 : (this.isHeavy ? 1.5 : 1.0));
    }

    createHealthBar(baseScale) {
        this.healthBarGroup = new THREE.Group();
        
        this.barWidth = baseScale * 0.8;
        const height = this.isBoss ? 0.4 : 0.2; // Thicker bar for bosses
        
        const bgGeo = new THREE.PlaneGeometry(this.barWidth, height);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x440000, transparent: true, opacity: 0.8 });
        const bg = new THREE.Mesh(bgGeo, bgMat);
        
        const fgGeo = new THREE.PlaneGeometry(this.barWidth, height);
        // Bosses get a more distinct color (Gold/Orange for bosses, Green for normal)
        const barColor = this.isFinalBoss ? 0xffcc00 : (this.isBoss ? 0xff6600 : 0x00ff00);
        const fgMat = new THREE.MeshBasicMaterial({ color: barColor });
        this.healthBarFg = new THREE.Mesh(fgGeo, fgMat);
        this.healthBarFg.position.z = 0.01; 
        
        this.healthBarGroup.add(bg);
        this.healthBarGroup.add(this.healthBarFg);
        
        // Position it above the sprite
        this.healthBarGroup.position.copy(this.sprite.position);
        this.healthBarGroup.position.y = baseScale + 0.5;
        
        this.scene.add(this.healthBarGroup);
    }

    update(deltaTime) {
        if (!this.alive) return;

        // Breathing/Pulse effect
        const pulse = 1 + Math.sin(Date.now() * 0.003 + this.walkTimer) * 0.05;
        this.sprite.scale.set(this.baseScaleX * pulse, this.baseScaleY * (2 - pulse), 1);

        // Acid effect (Melt armor: 2x damage)
        if (this.acidTimer > 0) {
            this.acidTimer -= deltaTime;
            this.sprite.material.color.set(0x00ff00);
            this.rimSprite.material.color.set(0x00ff00);
            this.rimSprite.material.opacity = 0.4 + Math.sin(Date.now() * 0.01) * 0.2;
        }

        // Stun effect (Disrupt logic: no movement)
        if (this.stunTimer > 0) {
            this.stunTimer -= deltaTime;
            this.sprite.material.rotation = Math.sin(Date.now() * 0.05) * 0.5;
            this.sprite.material.color.set(0xffffaa); // Yellow disrupt tint
            return; // Skip AI update
        }

        // Freeze effect
        if (this.frozenTimer > 0) {
            this.frozenTimer -= deltaTime;
            deltaTime *= 0.5; // Slow down by 50%
            this.sprite.material.color.set(0x00ffff);
            this.rimSprite.material.color.set(0x00ffff);
            this.rimSprite.material.opacity = 0.6;
        } else if (this.alive && this.acidTimer <= 0) {
            this.sprite.material.color.set(0xffffff);
            const defaultRimColor = this.isFinalBoss ? 0xff0000 : (this.isBoss ? 0xff6600 : 0x00ff7f);
            this.rimSprite.material.color.set(defaultRimColor);
            this.rimSprite.material.opacity = 0.15;
        }

        if (this.isFinalBoss) {
            this.updateFinalBoss(deltaTime);
        } else {
            this.updateNormal(deltaTime);
        }

        // Update glow and health bar
        if (this.baseGlow) {
            this.baseGlow.position.x = this.sprite.position.x;
            this.baseGlow.position.z = this.sprite.position.z;
            this.baseGlow.scale.setScalar(this.radius * 2.0 * pulse);
        }

        if (this.healthBarGroup && window.gameManager?.camera) {
            this.healthBarGroup.position.copy(this.sprite.position);
            this.healthBarGroup.position.y = (this.baseScaleY * pulse) + 0.5;
            // Face camera
            this.healthBarGroup.quaternion.copy(window.gameManager.camera.quaternion);
        }
    }

    updateNormal(deltaTime) {
        // Phase check for regular bosses
        if (this.isBoss && !this.isFinalBoss) {
            const healthPercent = this.health / this.maxHealth;
            let currentPhase = 1;
            if (healthPercent < 0.33) currentPhase = 3;
            else if (healthPercent < 0.66) currentPhase = 2;

            if (this.currentPhase !== currentPhase) {
                this.currentPhase = currentPhase;
                if (window.gameManager) {
                    window.gameManager.levelUpNotification.innerText = `BOSS PHASE ${currentPhase}`;
                    window.gameManager.levelUpNotification.style.color = "#ff4d4d";
                    window.gameManager.levelUpNotification.classList.add('visible');
                    setTimeout(() => window.gameManager.levelUpNotification.classList.remove('visible'), 2000);
                }
                this.speed *= 1.2;
            }
            this.updateBossAI(deltaTime, currentPhase);
            return;
        }

        // --- AI Stealth Tactics (Stalking) ---
        // Switch between CHASE and STALK states
        this.stalkTimer -= deltaTime;
        if (this.stalkTimer <= 0) {
            this.aiState = this.aiState === 'CHASE' ? 'STALK' : 'CHASE';
            this.stalkTimer = this.aiState === 'STALK' ? (2 + Math.random() * 3) : (4 + Math.random() * 5);
        }

        // --- Advanced Steering ---
        const steering = new THREE.Vector3();
        const playerPos = this.player.position.clone();
        
        // Target Point (Pincer/Flank Logic)
        let target = playerPos;
        if (this.isArmored && !this.pincerOffset) {
            // Give armored units a fixed pincer offset
            const side = Math.random() > 0.5 ? 1 : -1;
            this.pincerOffset = new THREE.Vector3(side * 12, 0, side * 12).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
        }

        if (this.aiState === 'STALK' && !this.isHeavy) {
            // Favor dark regions when stalking - stay at a distance and move toward flanks
            const angleToPlayer = Math.atan2(this.sprite.position.z - playerPos.z, this.sprite.position.x - playerPos.x);
            const stalkDist = 18 + Math.random() * 5;
            const flankAngle = angleToPlayer + (Math.sin(Date.now() * 0.001) * 0.5); // Slow zig-zag
            target = new THREE.Vector3(
                playerPos.x + Math.cos(flankAngle) * stalkDist,
                0,
                playerPos.z + Math.sin(flankAngle) * stalkDist
            );
        } else if (this.isArmored && this.pincerOffset) {
            target = playerPos.clone().add(this.pincerOffset);
        }

        // 1. Chase Force
        const chaseDir = new THREE.Vector3().subVectors(target, this.sprite.position);
        chaseDir.y = 0;
        const distanceToTarget = chaseDir.length();
        chaseDir.normalize();
        steering.add(chaseDir.multiplyScalar(1.0));

        // 2. Separation Force (Don't overlap other enemies)
        const separation = new THREE.Vector3();
        let neighbors = 0;
        if (window.gameManager?.enemies) {
            window.gameManager.enemies.forEach(other => {
                if (other !== this && other.alive) {
                    const dist = this.sprite.position.distanceTo(other.sprite.position);
                    const minDist = (this.radius + other.radius) * 1.5;
                    if (dist < minDist && dist > 0) {
                        const diff = new THREE.Vector3().subVectors(this.sprite.position, other.sprite.position);
                        diff.normalize().divideScalar(dist);
                        separation.add(diff);
                        neighbors++;
                    }
                }
            });
        }
        if (neighbors > 0) {
            separation.divideScalar(neighbors);
            steering.add(separation.multiplyScalar(2.5)); // High priority on separation
        }

        // 3. Strafing (Sideways movement)
        if (distanceToTarget < 15 && !this.isHeavy) {
            const strafeDir = new THREE.Vector3(chaseDir.z, 0, -chaseDir.x);
            const strafeStrength = Math.sin(Date.now() * 0.002 + this.walkTimer) * 0.5;
            steering.add(strafeDir.multiplyScalar(strafeStrength));
        }

        steering.y = 0;
        steering.normalize();

        const attackRange = this.isHeavy ? 2.5 : 2.0;
        const distanceToPlayer = this.sprite.position.distanceTo(playerPos);

        // --- Execute Movement ---
        if (distanceToPlayer > attackRange) {
            // Speed boost in "darkness" (away from center or lights)
            const darknessMult = (this.sprite.position.length() > 100) ? 1.3 : 1.0;
            this.sprite.position.addScaledVector(steering, this.speed * darknessMult * deltaTime);
            
            // Ground Walking Animation
            const animSpeed = this.isHeavy ? 8 : 12;
            this.walkTimer += deltaTime * animSpeed;
            this.sprite.material.rotation = Math.sin(this.walkTimer) * 0.15;
            const baseHeight = this.sprite.scale.y / 2;
            const bobAmount = this.isHeavy ? 0.5 : 0.3;
            this.sprite.position.y = baseHeight + Math.abs(Math.sin(this.walkTimer)) * bobAmount;
        } else {
            // Attack player
            this.attack();
            
            // Attack animation (shaking)
            this.sprite.material.rotation = Math.sin(Date.now() * 0.05) * 0.2;
        }

        // --- Boundary Clamping (Boss Persistence fix) ---
        const limit = 245; // Arena size is 500x500 (±250)
        this.sprite.position.x = Math.max(-limit, Math.min(limit, this.sprite.position.x));
        this.sprite.position.z = Math.max(-limit, Math.min(limit, this.sprite.position.z));
    }

    updateBossAI(deltaTime, phase) {
        const now = Date.now();
        this.stateTimer += deltaTime;

        // Boss State Machine
        const stateDuration = phase === 3 ? 3000 : 4000;
        if (now - this.lastStateChange > stateDuration && !this.isJumping && !this.laserActive) {
            const states = ['CHASE'];
            if (phase >= 1) states.push('SUMMON');
            if (phase >= 2) states.push('LASER', 'BULLET_HELL');
            if (phase >= 3) states.push('JUMP', 'BARRAGE');
            
            this.attackState = states[Math.floor(Math.random() * states.length)];
            this.lastStateChange = now;
            
            // Warning visual
            if (this.attackState === 'LASER') this.sprite.material.color.set(0xff0000);
            if (this.attackState === 'JUMP') this.sprite.material.color.set(0xffff00);
            if (this.attackState === 'SUMMON') this.sprite.material.color.set(0x00ff00);
            if (this.attackState === 'BULLET_HELL') this.sprite.material.color.set(0xff00ff);
            if (this.attackState === 'BARRAGE') this.sprite.material.color.set(0x00ffff);
        }

        const direction = new THREE.Vector3();
        direction.subVectors(this.player.position, this.sprite.position);
        direction.y = 0;
        const distance = direction.length();

        if (this.attackState === 'CHASE') {
            if (distance > 5) {
                direction.normalize();
                this.sprite.position.addScaledVector(direction, this.speed * deltaTime);
            } else {
                this.attack();
            }
            this.sprite.material.color.set(0xffffff);
        } else if (this.attackState === 'SUMMON') {
            if (now - this.lastStateChange > 1000) {
                this.summonMinions(2);
                this.attackState = 'CHASE';
                this.lastStateChange = now;
            }
        } else if (this.attackState === 'LASER') {
            this.handleLaserAttack(deltaTime);
        } else if (this.attackState === 'JUMP') {
            this.handleJumpAttack(deltaTime);
        } else if (this.attackState === 'BULLET_HELL') {
            this.handleBulletHell(deltaTime);
        } else if (this.attackState === 'BARRAGE') {
            this.handleBarrage(deltaTime);
        }

        // --- Boundary Clamping for Bosses (Fix persistence) ---
        const limit = 245;
        this.sprite.position.x = Math.max(-limit, Math.min(limit, this.sprite.position.x));
        this.sprite.position.z = Math.max(-limit, Math.min(limit, this.sprite.position.z));

        // Face player
        this.sprite.material.rotation = Math.sin(Date.now() * 0.01) * 0.1;
        
        // Update Laser Mesh if active
        if (this.laserMesh) {
            this.updateLaserVisual();
        }

        // Update projectiles
        if (this.projectiles) {
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const p = this.projectiles[i];
                p.sprite.position.addScaledVector(p.velocity, deltaTime);
                if (p.sprite.position.distanceTo(this.player.position) < 2.5) {
                    window.gameManager?.damagePlayer(p.damage || 15);
                    this.scene.remove(p.sprite);
                    this.projectiles.splice(i, 1);
                } else if (p.sprite.position.length() > 500) {
                    this.scene.remove(p.sprite);
                    this.projectiles.splice(i, 1);
                }
            }
        }

        // Walking/Idle bobbing
        if (!this.isJumping) {
            const baseHeight = this.sprite.scale.y / 2;
            this.sprite.position.y = baseHeight + Math.abs(Math.sin(Date.now() * 0.005)) * 0.5;
        }
    }

    handleBulletHell(deltaTime) {
        const now = Date.now();
        if (!this.lastFireTime) this.lastFireTime = 0;
        
        const interval = 200;
        if (now - this.lastFireTime > interval) {
            this.lastFireTime = now;
            const count = 12;
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2 + (now * 0.001);
                const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
                this.fireProjectile(dir, 15, 10);
            }
        }

        if (now - this.lastStateChange > 3000) {
            this.attackState = 'CHASE';
            this.lastStateChange = now;
        }
    }

    handleBarrage(deltaTime) {
        const now = Date.now();
        if (!this.lastFireTime) this.lastFireTime = 0;
        
        const interval = 100;
        if (now - this.lastFireTime > interval) {
            this.lastFireTime = now;
            const dir = new THREE.Vector3().subVectors(this.player.position, this.sprite.position).normalize();
            dir.x += (Math.random() - 0.5) * 0.4;
            dir.z += (Math.random() - 0.5) * 0.4;
            this.fireProjectile(dir, 30, 15);
        }

        if (now - this.lastStateChange > 2500) {
            this.attackState = 'CHASE';
            this.lastStateChange = now;
        }
    }

    fireProjectile(direction, speed, damage) {
        if (!this.projectiles) this.projectiles = [];
        const texture = new THREE.TextureLoader().load(CONFIG.ASSETS.EXPLOSION);
        const mat = new THREE.SpriteMaterial({ 
            map: texture, 
            color: this.attackState === 'BULLET_HELL' ? 0xff00ff : 0x00ffff 
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(1.5, 1.5, 1);
        sprite.position.copy(this.sprite.position);
        sprite.position.y += 2;
        this.scene.add(sprite);

        const velocity = direction.clone().multiplyScalar(speed);
        this.projectiles.push({ sprite, velocity, damage });
    }

    handleLaserAttack(deltaTime) {
        const now = Date.now();
        const timeInState = now - this.lastStateChange;
        
        if (timeInState < 1000) {
            // Charging laser
            this.sprite.scale.set(this.sprite.scale.x * 1.01, this.sprite.scale.y * 0.99, 1);
            return;
        }

        if (!this.laserActive) {
            this.laserActive = true;
            this.createLaserVisual();
        }

        if (timeInState > 3000) {
            this.laserActive = false;
            this.removeLaserVisual();
            this.attackState = 'CHASE';
            this.lastStateChange = now;
            return;
        }

        // Damage player if laser hits
        const bossToPlayer = new THREE.Vector3().subVectors(this.player.position, this.sprite.position);
        bossToPlayer.y = 0;
        const angle = bossToPlayer.angleTo(this.laserDirection || new THREE.Vector3(1, 0, 0));
        if (angle < 0.1 && bossToPlayer.length() < 50) {
            window.gameManager?.damagePlayer(0.5);
        }
    }

    createLaserVisual() {
        const geo = new THREE.CylinderGeometry(0.2, 0.2, 1, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.7 });
        this.laserMesh = new THREE.Mesh(geo, mat);
        this.laserMesh.rotation.z = Math.PI / 2;
        this.scene.add(this.laserMesh);
        
        this.laserDirection = new THREE.Vector3().subVectors(this.player.position, this.sprite.position).normalize();
        this.laserDirection.y = 0;
    }

    updateLaserVisual() {
        const start = this.sprite.position.clone();
        start.y += 2;
        const end = start.clone().addScaledVector(this.laserDirection, 50);
        
        const dist = start.distanceTo(end);
        this.laserMesh.scale.set(1, dist, 1);
        this.laserMesh.position.copy(start.clone().lerp(end, 0.5));
        this.laserMesh.lookAt(end);
        this.laserMesh.rotateX(Math.PI / 2);
    }

    removeLaserVisual() {
        if (this.laserMesh) {
            this.scene.remove(this.laserMesh);
            this.laserMesh = null;
        }
    }

    handleJumpAttack(deltaTime) {
        const now = Date.now();
        const timeInState = now - this.lastStateChange;

        if (!this.isJumping) {
            if (timeInState < 1000) {
                // Crouching before jump
                this.sprite.scale.y *= 0.98;
                return;
            }
            this.isJumping = true;
            this.jumpVelocity = 25;
            window.gameManager?.synth.triggerAttackRelease('C2', '4n');
        }

        // Physics
        this.sprite.position.y += this.jumpVelocity * deltaTime;
        this.jumpVelocity -= 50 * deltaTime; // Gravity

        // Move towards player in air
        const dir = new THREE.Vector3().subVectors(this.player.position, this.sprite.position).normalize();
        this.sprite.position.addScaledVector(dir, 10 * deltaTime);

        // Boundary Clamping (Air)
        const limit = 245;
        this.sprite.position.x = Math.max(-limit, Math.min(limit, this.sprite.position.x));
        this.sprite.position.z = Math.max(-limit, Math.min(limit, this.sprite.position.z));

        const groundLevel = this.sprite.scale.y / 2;
        if (this.sprite.position.y < groundLevel) {
            this.sprite.position.y = groundLevel;
            this.isJumping = false;
            this.attackState = 'CHASE';
            this.lastStateChange = now;
            this.triggerShockwave(15, 30);
            window.gameManager?.shakeScreen(10);
        }
    }

    updateFinalBoss(deltaTime) {
        const now = Date.now();
        this.stateTimer += deltaTime;

        // Phase Check (HP based)
        const healthPercent = this.health / this.maxHealth;
        let currentPhase = 1;
        if (healthPercent < 0.33) currentPhase = 3;
        else if (healthPercent < 0.66) currentPhase = 2;

        if (this.currentPhase !== currentPhase) {
            this.currentPhase = currentPhase;
            window.gameManager?.synth.triggerAttackRelease(['C2', 'C3'], '2n');
            if (window.gameManager) {
                window.gameManager.levelUpNotification.innerText = `OVERMIND PHASE ${currentPhase}`;
                window.gameManager.levelUpNotification.style.color = currentPhase === 3 ? "#ff0000" : "#ffcc00";
                window.gameManager.levelUpNotification.classList.add('visible');
                setTimeout(() => window.gameManager.levelUpNotification.classList.remove('visible'), 2000);
            }
        }

        // The Overmind uses the improved Boss AI
        this.updateBossAI(deltaTime, currentPhase);

        // Overmind-specific Ultimate (Phase 3 only)
        if (currentPhase === 3 && this.attackState === 'CHASE' && Math.random() < 0.005) {
            this.attackState = 'ULTIMATE';
            this.lastStateChange = now;
            if (window.gameManager) {
                window.gameManager.levelUpNotification.innerText = "WARNING: SINGULARITY DETECTED";
                window.gameManager.levelUpNotification.style.color = "#ffffff";
                window.gameManager.levelUpNotification.classList.add('visible');
                setTimeout(() => window.gameManager.levelUpNotification.classList.remove('visible'), 2000);
            }
        }

        if (this.attackState === 'ULTIMATE') {
            // THE SINGULARITY: Pull player in and charge massive blast
            const pullStrength = 15;
            const pullDir = new THREE.Vector3().subVectors(this.sprite.position, this.player.position).normalize();
            this.player.position.addScaledVector(pullDir, pullStrength * deltaTime);
            
            const pulse = 1 + Math.sin(now * 0.02) * 0.2;
            const s = CONFIG.FINAL_BOSS.SCALE;
            this.sprite.scale.set(s * pulse, s * pulse, 1);

            if (now - this.lastStateChange > 4000) {
                this.triggerShockwave(CONFIG.FINAL_BOSS.SHOCKWAVE_RANGE * 1.5, CONFIG.FINAL_BOSS.DAMAGE * 1.5);
                this.sprite.scale.set(s, s, 1);
                this.attackState = 'CHASE';
                this.lastStateChange = now;
                window.gameManager?.shakeScreen(20);
            }
        }

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.sprite.position.addScaledVector(p.velocity, deltaTime);
            if (p.sprite.position.distanceTo(this.player.position) < 2) {
                window.gameManager.damagePlayer(CONFIG.FINAL_BOSS.PROJECTILE_DAMAGE);
                this.scene.remove(p.sprite);
                this.projectiles.splice(i, 1);
            } else if (p.sprite.position.length() > 500) {
                this.scene.remove(p.sprite);
                this.projectiles.splice(i, 1);
            }
        }
    }

    summonMinions(count = 3) {
        if (!window.gameManager) return;
        for (let i = 0; i < count; i++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 15,
                0,
                (Math.random() - 0.5) * 15
            );
            const pos = this.sprite.position.clone().add(offset);
            const minion = new Enemy(this.scene, this.player, pos, 'normal');
            window.gameManager.enemies.push(minion);
        }
    }

    fireBossProjectile(speed = 25) {
        const texture = new THREE.TextureLoader().load(CONFIG.ASSETS.EXPLOSION);
        const mat = new THREE.SpriteMaterial({ map: texture, color: this.currentPhase === 3 ? 0xff4d4d : 0xff00ff });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(2.5, 2.5, 1);
        sprite.position.copy(this.sprite.position);
        sprite.position.y += 5;
        this.scene.add(sprite);

        const velocity = new THREE.Vector3();
        velocity.subVectors(this.player.position, sprite.position).normalize().multiplyScalar(speed);
        
        this.projectiles.push({ sprite, velocity });
    }

    triggerShockwave(customRange, customDamage) {
        // Visual
        const range = customRange || (this.isFinalBoss ? CONFIG.FINAL_BOSS.SHOCKWAVE_RANGE : 15);
        const damage = customDamage || (this.isFinalBoss ? CONFIG.FINAL_BOSS.DAMAGE : CONFIG.BOSS.DAMAGE);

        const geometry = new THREE.RingGeometry(1, 1.2, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: this.attackState === 'ULTIMATE' ? 0xffffff : 0xff00ff, 
            side: THREE.DoubleSide 
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(this.sprite.position);
        ring.position.y = 0.1;
        this.scene.add(ring);

        let scale = 1;
        const interval = setInterval(() => {
            scale += 2.0;
            ring.scale.set(scale, scale, 1);
            if (scale > range) {
                this.scene.remove(ring);
                clearInterval(interval);
            }
        }, 20);

        if (this.sprite.position.distanceTo(this.player.position) < range) {
            window.gameManager.damagePlayer(damage);
        }
    }

    attack() {
        if (window.gameManager) {
            let damage = CONFIG.ENEMY.DAMAGE;
            if (this.isFinalBoss) damage = CONFIG.FINAL_BOSS.DAMAGE;
            else if (this.isBoss) damage = CONFIG.BOSS.DAMAGE;
            else if (this.isHeavy) damage = 15;
            else if (this.isArmored) damage = 12;

            window.gameManager.damagePlayer(damage * 0.1); 
        }
    }

    takeDamage(amount) {
        // Acid Armor Melt: 2x damage
        if (this.acidTimer > 0) amount *= 2.0;

        // Boss Damage Gating: Can't lose more than 10% health in a single hit
        if (this.isBoss) {
            const maxHit = this.maxHealth * 0.1;
            amount = Math.min(amount, maxHit);
        }

        // Death Mark (Execution)
        const deathMarkLvl = window.gameManager?.upgrades.death_mark || 0;
        if (deathMarkLvl > 0 && this.health < this.maxHealth * 0.1) {
            amount = this.health + 100; // Execute
        }

        this.health -= amount;
        
        // Update health bar
        if (this.healthBarFg) {
            const healthPercent = Math.max(0, this.health / this.maxHealth);
            this.healthBarFg.scale.x = healthPercent;
            // Shift to stay left-aligned
            this.healthBarFg.position.x = -(1 - healthPercent) * (this.barWidth / 2);
            
            // Color shift: green to red
            if (healthPercent < 0.3) {
                this.healthBarFg.material.color.set(0xff0000);
            } else if (healthPercent < 0.6) {
                this.healthBarFg.material.color.set(0xffff00);
            }
        }

        // Hit feedback
        this.sprite.material.color.set(0xff4444);
        setTimeout(() => {
            if (this.alive && this.stunTimer > 0) {
                this.sprite.material.color.set(0xffffff); // Use white during stun pulse
            } else if (this.alive && this.frozenTimer > 0) {
                this.sprite.material.color.set(0x00ffff);
            } else if (this.alive && this.acidTimer > 0) {
                this.sprite.material.color.set(0x00ff00);
            } else if (this.alive) {
                this.sprite.material.color.set(0xffffff);
            }
        }, 100);

        if (this.health <= 0) {
            this.die();
        }
    }

    stun(duration) {
        if (this.isFinalBoss) return;
        this.stunTimer = Math.max(this.stunTimer, duration);
    }

    freeze(duration) {
        if (this.isFinalBoss) return; // Final boss immune to freeze
        this.frozenTimer = Math.max(this.frozenTimer, duration);
    }

    die() {
        if (!this.alive) return;
        this.alive = false;
        
        // Clean up projectiles
        if (this.projectiles) {
            this.projectiles.forEach(p => this.scene.remove(p.sprite));
        }

        this.scene.remove(this.sprite);
        if (this.baseGlow) this.scene.remove(this.baseGlow);
        if (this.healthBarGroup) this.scene.remove(this.healthBarGroup);
        if (window.gameManager) {
            window.gameManager.onEnemyKilled(this.sprite.position.clone());
        }
    }
}
