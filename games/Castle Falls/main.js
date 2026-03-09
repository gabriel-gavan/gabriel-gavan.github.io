import * as THREE from 'three';
import { PlayerController, ThirdPersonCameraController } from './rosie/controls/rosieControls.js';
import { MobileControls } from './rosie/controls/rosieMobileControls.js';
import { CONFIG } from './config.js';
import { LevelManager } from './LevelManager.js';
import { UIManager } from './UIManager.js';
import { RobloxCharacter } from './Character.js';
import { audioManager } from './AudioManager.js';
import { ParticleSystem } from './ParticleSystem.js';
import { GameState } from './GameData.js';
import { Ladder, PlayerProjectile, DragonBoss, Gargoyle, Archer, StaticProp } from './Obstacle.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000); // Increased Far Plane
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Mobile detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Particle system
        this.particleSystem = new ParticleSystem(this.scene);

        // Projectiles
        this.playerProjectiles = [];
        this.lastFireTime = 0;
        this.fireRate = 0.25;

        // Scene aesthetics
        this.scene.background = new THREE.Color(CONFIG.COLORS.VOID);
        this.scene.fog = new THREE.FogExp2(CONFIG.COLORS.FOG, 0.015); // Slightly thinner fog for distant view

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Increased ambient light for better visibility
        this.scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xaaaaaa, 0x444444, 0.6); // Sky/Ground light for depth
        this.scene.add(hemiLight);

        this.pointLight = new THREE.PointLight(0xffddaa, 5, 35); // Brighter, wider player torch
        this.pointLight.castShadow = true;
        this.pointLight.shadow.mapSize.width = 1024;
        this.pointLight.shadow.mapSize.height = 1024;
        this.scene.add(this.pointLight);

        // Data & UI
        this.gameState = new GameState();
        this.uiManager = new UIManager(
            () => {
                this.lives = CONFIG.PLAYER.INITIAL_LIVES;
                this.restart();
                this.isPaused = false;
            },
            (level, name) => this.startLevel(level, name)
        );
        this.uiManager.renderCampaigns(this.gameState);
        
        // Setup mobile fire button
        this.uiManager.fireButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.currentLevel >= CONFIG.PLAYER.MAGIC_UNLOCK_LEVEL) {
                this.shootProjectile();
            }
        });
        this.uiManager.fireButton.addEventListener('mousedown', (e) => {
            if (this.currentLevel >= CONFIG.PLAYER.MAGIC_UNLOCK_LEVEL) {
                this.shootProjectile();
            }
        });

        // Initial setup
        this.isGameOver = false;
        this.isPaused = true;
        this.distance = 0;
        this.lastCheckpointDist = 0;
        this.currentLevel = 1;
        this.targetDistance = 100;
        
        this.health = CONFIG.PLAYER.MAX_HEALTH;
        this.lives = CONFIG.PLAYER.INITIAL_LIVES;
        this.iFrameTime = 0;
        this.wasOnGround = true;

        // Wall run state
        this.wallRunTimer = 0;
        this.isWallRunning = false;
        this.wallRunSide = null; // 'left' or 'right'
        
        this.initPlayer();
        this.levelManager = new LevelManager(this.scene);
        this.restart(); // Build initial level segments

        this.lastTime = 0;
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        window.addEventListener('resize', () => {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });
    }

    initPlayer() {
        // Advanced blocky character with limbs and hair
        this.character = new RobloxCharacter();
        this.playerMesh = this.character.group;
        this.playerMesh.position.set(
            CONFIG.PLAYER.START_POS.x, 
            CONFIG.PLAYER.START_POS.y, 
            CONFIG.PLAYER.START_POS.z
        );
        // Do NOT add shadows to the group itself, it's handled by children
        this.scene.add(this.playerMesh);

        this.controller = new PlayerController(this.playerMesh, {
            moveSpeed: CONFIG.PLAYER.MOVE_SPEED,
            jumpForce: CONFIG.PLAYER.JUMP_FORCE,
            gravity: CONFIG.PLAYER.GRAVITY,
            groundLevel: -50 // We handle grounding manually in animate loop
        });

        // Initialize Mobile Controls if needed
        this.mobileControls = new MobileControls(this.controller);

        this.thirdPersonCamera = new ThirdPersonCameraController(
            this.camera, 
            this.playerMesh, 
            this.renderer.domElement, 
            { distance: 8, height: 4 }
        );
    }

    startLevel(levelNum, sectorName) {
        this.currentLevel = levelNum;
        this.targetDistance = this.gameState.getLevelDistance(levelNum);
        this.levelManager.setLevel(levelNum, this.scene);
        this.uiManager.setLevelName(sectorName);
        this.lives = CONFIG.PLAYER.INITIAL_LIVES;
        this.uiManager.updateLives(this.lives);
        this.lastCheckpointDist = 0; // Reset checkpoint on new level
        
        if (levelNum === CONFIG.PLAYER.MAGIC_UNLOCK_LEVEL) {
            this.uiManager.showMagicUnlocked();
        }

        this.restart();
        this.isPaused = false;
    }

    restart() {
        // Reset character pose first
        this.character.resetPose();

        // Reset level generation state first
        this.levelManager.resetGeneration();

        // Reset player
        this.playerMesh.position.set(
            CONFIG.PLAYER.START_POS.x, 
            CONFIG.PLAYER.START_POS.y, 
            CONFIG.PLAYER.START_POS.z
        );
        this.playerMesh.rotation.set(0, Math.PI, 0); // Face forward (-Z)
        this.controller.velocity.set(0, 0, 0);
        this.controller.isOnGround = false;
        this.distance = 0;
        this.lastCheckpointDist = 0; // Reset checkpoint on full restart
        this.isGameOver = false;
        
        this.health = CONFIG.PLAYER.MAX_HEALTH;
        this.iFrameTime = 0;
        this.playerMesh.visible = true;
        this.uiManager.updatePlayerHealth(this.health, CONFIG.PLAYER.MAX_HEALTH);
        this.uiManager.updateLives(this.lives); // Ensure lives are drawn

        // Reset level meshes
        this.levelManager.segments.forEach(s => this.scene.remove(s.mesh));
        this.levelManager.segments = [];
        this.levelManager.obstacles.forEach(o => o.destroy(this.scene));
        this.levelManager.obstacles = [];
        
        // Add initial segments
        for (let i = 0; i < 6; i++) {
            this.levelManager.addSegment(i < 1); // Only the very first segment is safe
        }
    }

    shootProjectile() {
        if (performance.now() - this.lastFireTime < this.fireRate * 1000) return;
        
        // Spawn from player torso looking forward
        const direction = new THREE.Vector3(0, 0, 1);
        direction.applyQuaternion(this.playerMesh.quaternion);
        
        const position = this.playerMesh.position.clone().add(new THREE.Vector3(0, 1.45, 0));
        const projectile = new PlayerProjectile(this.scene, position, direction);
        this.playerProjectiles.push(projectile);
        
        this.lastFireTime = performance.now();
        audioManager.playShoot();
        this.particleSystem.emitMagicSparks(position, 0x00ffff);
    }

    takeDamage(amount) {
        if (this.iFrameTime > 0 || this.isGameOver || this.character.isDead) return;
        
        this.health -= amount;
        this.iFrameTime = CONFIG.PLAYER.IFRAME_DURATION;
        this.uiManager.updatePlayerHealth(this.health, CONFIG.PLAYER.MAX_HEALTH);
        
        audioManager.playHit();
        const hitPos = this.playerMesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        this.particleSystem.emit(hitPos, 10, 0xff0000);

        if (this.health <= 0) {
            this.health = 0;
            this.lives--;
            this.uiManager.updateLives(this.lives);

            // Show death pose
            this.character.setDead(true);
            this.controller.velocity.set(0, 0, 0);

            if (this.lives <= 0) {
                this.isGameOver = true;
                this.gameState.saveScore(this.currentLevel, this.distance);
                this.uiManager.showGameOver(this.distance, this.currentLevel, this.gameState.progress.leaderboard);
                audioManager.playGameOver();
                this.particleSystem.emit(hitPos, 20, 0xff0000);
            } else {
                this.uiManager.showLifeLost();
                // Respawn with a delay for visual impact
                setTimeout(() => {
                    this.respawnAtCheckpoint();
                }, 1500); 
            }
        }
    }

    respawnAtCheckpoint() {
        // Reset character pose first
        this.character.resetPose();
        
        // Reset player state
        this.health = CONFIG.PLAYER.MAX_HEALTH;
        this.iFrameTime = CONFIG.PLAYER.IFRAME_DURATION; // Grant iFrames on respawn
        this.uiManager.updatePlayerHealth(this.health, CONFIG.PLAYER.MAX_HEALTH);
        this.controller.velocity.set(0, 0, 0);
        this.controller.isOnGround = false;
        
        // Ensure wall-run state is reset
        this.isWallRunning = false;
        this.wallRunSide = null;
        this.wallRunTimer = 0;

        // Determine target checkpoint distance
        const targetDist = this.lastCheckpointDist;
        this.distance = targetDist;

        // Tell LevelManager to regenerate up to this point
        const segment = this.levelManager.generateAtDistance(targetDist);
        
        // Position player at the start of the segment
        if (segment) {
            const pos = segment.center.clone();
            // Start at center of segment
            this.playerMesh.position.copy(pos);
            this.playerMesh.position.y = 5; // Drop slightly for safety
            
            // Set rotation to match segment direction (upright only)
            const angle = Math.atan2(segment.direction.x, segment.direction.z);
            this.playerMesh.rotation.set(0, angle, 0);
        } else {
            // Fallback to start
            this.playerMesh.position.set(CONFIG.PLAYER.START_POS.x, CONFIG.PLAYER.START_POS.y, CONFIG.PLAYER.START_POS.z);
            this.playerMesh.rotation.set(0, Math.PI, 0);
        }
    }

    animate(time) {
        const deltaTime = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        // Update lighting and camera even when paused
        this.pointLight.position.set(
            this.playerMesh.position.x, 
            this.playerMesh.position.y + 2, 
            this.playerMesh.position.z
        );
        this.thirdPersonCamera.update();

        if (this.isPaused) {
            this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(this.animate);
            return;
        }

        if (this.isGameOver) {
            this.particleSystem.update(deltaTime);
            this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(this.animate);
            return;
        }

        requestAnimationFrame(this.animate);
        const cameraRotation = this.thirdPersonCamera.update();
        
        // Update iFrames
        if (this.iFrameTime > 0) {
            this.iFrameTime -= deltaTime;
            // Flicker effect
            this.playerMesh.visible = Math.floor(this.iFrameTime * 10) % 2 === 0;
            if (this.iFrameTime <= 0) {
                this.playerMesh.visible = true;
            }
        }

        // Handle shooting
        if (this.controller.keys['Space'] || this.controller.keys['KeyF']) {
             // In this game Space is jump, so maybe F or Click for fire
        }
        // Let's use Mouse Button 0 (Left Click) for firing
        // Restricted to later levels where combat is needed
        if (this.controller.mouseDown && this.currentLevel >= CONFIG.PLAYER.MAGIC_UNLOCK_LEVEL) {
            this.shootProjectile();
        }

        // Update player projectiles
        for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
            const p = this.playerProjectiles[i];
            p.update(deltaTime);
            
            // Check collision with obstacles (especially the boss and enemies)
            for (const o of this.levelManager.obstacles) {
                if (o instanceof DragonBoss && !o.isDead) {
                    const dist = p.group.position.distanceTo(o.group.position.clone().add(new THREE.Vector3(0, 3, 0)));
                    if (dist < 8) { // Dragon has a large hitbox
                        o.takeDamage(20);
                        p.destroy();
                        this.particleSystem.emitMagicSparks(p.group.position, 0x00ffff);
                        audioManager.playImpact();
                        break;
                    }
                } else if ((o instanceof Gargoyle || o instanceof Archer) && !o.isDead) {
                    const dist = p.group.position.distanceTo(o.group.position.clone().add(new THREE.Vector3(0, 1, 0)));
                    if (dist < 2) {
                        o.takeDamage(20);
                        p.destroy();
                        this.particleSystem.emitMagicSparks(p.group.position, 0xaa00ff);
                        audioManager.playImpact();
                        break;
                    }
                }
            }

            if (p.isDead) {
                this.playerProjectiles.splice(i, 1);
            }
        }

        // Update boss health bar visibility
        let bossFound = false;
        for (const o of this.levelManager.obstacles) {
            if (o instanceof DragonBoss) {
                const distToBoss = this.playerMesh.position.distanceTo(o.group.position);
                if (distToBoss < 80) {
                    this.uiManager.showBossHealth('The Ancient Dragon');
                    this.uiManager.updateBossHealth(o.health, o.maxHealth);
                    bossFound = true;
                }
            }
        }
        if (!bossFound) this.uiManager.hideBossHealth();

        // 1. Update obstacles & generation based on path distance
        this.levelManager.update(deltaTime, this.distance, this.playerMesh.position);

        // 2. Ladder Climbing Logic
        let isOnLadder = false;
        const playerPos = this.playerMesh.position;
        for (const o of this.levelManager.obstacles) {
            if (o instanceof Ladder) {
                const dx = Math.abs(playerPos.x - o.group.position.x);
                const dz = Math.abs(playerPos.z - o.group.position.z);
                const dy = playerPos.y - (o.group.position.y - o.height / 2); // Distance from ladder bottom
                
                // Allow climbing if player is within range and not far above the top
                if (dx < 1.2 && dz < 1.2 && dy >= -0.5 && dy <= o.height + 0.5) {
                    isOnLadder = true;
                    break;
                }
            }
        }

        // 4. Check collision & grounding
        const collisionResult = this.levelManager.checkCollision(this.playerMesh.position, this.distance);
        const segment = collisionResult.activeSegment;
        
        // Update distance based on path travel
        if (collisionResult.currentDist > this.distance) {
            // Ensure distance is monotonic to prevent generation stutters
            this.distance = Math.max(this.distance, collisionResult.currentDist);
            const progress = this.distance / this.targetDistance;
            const diffFactor = this.levelManager.getDifficultyFactor();
            this.uiManager.updateDistance(this.distance, this.currentLevel, progress, diffFactor);

            if (this.distance >= this.targetDistance) {
                this.isPaused = true;
                this.gameState.completeLevel(this.currentLevel);
                this.uiManager.renderCampaigns(this.gameState);
                this.uiManager.showLevelComplete(this.currentLevel, this.distance, this.currentLevel + 1);
            }
        }

        this.character.setClimbing(isOnLadder);

        // 3. Wall Running & Clamping Logic (Fully Orientation-Aware)
        let wallRunHandled = false;
        if (segment && !collisionResult.isGrounded && !isOnLadder && !this.isGameOver) {
            const toCenter = playerPos.clone().sub(segment.center);
            const distRight = toCenter.dot(segment.right);
            const halfWidth = segment.width / 2;
            const playerRadius = 0.45;

            const nearLeft = distRight <= -halfWidth + (playerRadius + 0.1);
            const nearRight = distRight >= halfWidth - (playerRadius + 0.1);
            
            // Wall run entry: must have horizontal speed and be moving forward relative to segment
            const horizontalVelocity = new THREE.Vector3(this.controller.velocity.x, 0, this.controller.velocity.z);
            const forwardSpeed = horizontalVelocity.dot(segment.direction);
            
            // Intent check: is the player pressing the key towards the wall?
            const pressingLeft = this.controller.keys['KeyA'] || this.controller.keys['ArrowLeft'];
            const pressingRight = this.controller.keys['KeyD'] || this.controller.keys['ArrowRight'];

            if (forwardSpeed > CONFIG.PLAYER.WALL_RUN.MIN_SPEED) {
                if (nearLeft && pressingLeft && !this.isWallRunning) {
                    this.isWallRunning = true;
                    this.wallRunSide = 'left';
                    this.wallRunTimer = CONFIG.PLAYER.WALL_RUN.MAX_DURATION;
                } else if (nearRight && pressingRight && !this.isWallRunning) {
                    this.isWallRunning = true;
                    this.wallRunSide = 'right';
                    this.wallRunTimer = CONFIG.PLAYER.WALL_RUN.MAX_DURATION;
                }
            }

            if (this.isWallRunning) {
                this.wallRunTimer -= deltaTime;
                const stillNearLeft = distRight <= -halfWidth + 1.2;
                const stillNearRight = distRight >= halfWidth - 1.2;

                if (this.wallRunTimer <= 0 || (this.wallRunSide === 'left' && !stillNearLeft) || (this.wallRunSide === 'right' && !stillNearRight)) {
                    this.isWallRunning = false;
                    this.wallRunSide = null;
                } else {
                    // Apply Wall Run Physics
                    if (this.controller.velocity.y < 0) {
                        this.controller.velocity.y *= (1 - CONFIG.PLAYER.WALL_RUN.GRAVITY_MULTIPLIER);
                    }
                    
                    // Stick to the wall relative to segment orientation
                    const targetDist = this.wallRunSide === 'left' ? -halfWidth + playerRadius : halfWidth - playerRadius;
                    const correction = targetDist - distRight;
                    // Apply correction smoothly or only if too far
                    if (Math.abs(correction) > 0.1) {
                        this.playerMesh.position.add(segment.right.clone().multiplyScalar(correction * 0.5));
                    }

                    if (this.controller.keys['Space']) {
                        this.controller.velocity.y = CONFIG.PLAYER.WALL_RUN.JUMP_BOOST_Y;
                        const pushDir = this.wallRunSide === 'left' ? 1 : -1;
                        this.controller.velocity.add(segment.right.clone().multiplyScalar(pushDir * CONFIG.PLAYER.WALL_RUN.JUMP_BOOST_X));
                        this.isWallRunning = false;
                        this.wallRunSide = null;
                        audioManager.playJump();
                    }
                    wallRunHandled = true;
                }
            }
        }
        if (!wallRunHandled) {
            this.isWallRunning = false;
            this.wallRunSide = null;
        }

        this.character.setWallRunning(this.wallRunSide);

        // 4. Handle jump sound
        if (this.controller.keys['Space'] && this.controller.isOnGround && this.controller.canJump && !isOnLadder && !this.isWallRunning) {
            audioManager.playJump();
        }

        if (collisionResult.isLethal) {
            this.takeDamage(collisionResult.lethalDamage || 20);
        }

        if (this.playerMesh.position.y < -15 || this.isGameOver) {
            if (!this.isGameOver) {
                this.takeDamage(100);
            }
            return;
        }

        // 5. Update the controller
        this.controller.groundLevel = isOnLadder ? this.playerMesh.position.y : collisionResult.groundY;
        this.controller.isOnGround = isOnLadder ? true : collisionResult.isGrounded;
        
        if (isOnLadder) {
            if (this.controller.keys['KeyW'] || this.controller.keys['Space']) this.controller.velocity.y = 6;
            else if (this.controller.keys['KeyS']) this.controller.velocity.y = -6;
            else this.controller.velocity.y = 0;
        }

        this.controller.update(deltaTime, cameraRotation);

        // --- ENHANCED: Multi-Segment Collision & Clamping (Fixes Wall Popping) ---
        if (!this.isGameOver && collisionResult.nearSegments.length > 0) {
            const playerRadius = 0.45;

            for (const seg of collisionResult.nearSegments) {
                const toCenter = playerPos.clone().sub(seg.center);
                const distForward = toCenter.dot(seg.direction);
                const distRight = toCenter.dot(seg.right);
                
                const halfLength = seg.length / 2;
                const halfWidth = seg.width / 2;

                // 1. Hallway Side Clamping
                // Only clamp sides if we are NOT at the exit of a corner
                const isExitSide = seg.isCorner && ((seg.isRightTurn && distRight > 0) || (!seg.isRightTurn && distRight < 0));
                
                // CRITICAL FIX: Only clamp sides in the central 80% of a straight segment
                // This prevents "snapping" and "popping" at the junctions between segments
                const isNearJunction = !seg.isCorner && (Math.abs(distForward) > halfLength * 0.85);

                if (!isExitSide && !isNearJunction && Math.abs(distRight) > halfWidth - playerRadius) {
                    const pushAmount = Math.abs(distRight) - (halfWidth - playerRadius);
                    const side = distRight > 0 ? -1 : 1;
                    this.playerMesh.position.add(seg.right.clone().multiplyScalar(side * pushAmount));

                    // Damp velocity
                    const velSide = this.controller.velocity.dot(seg.right);
                    if ((side === -1 && velSide > 0) || (side === 1 && velSide < 0)) {
                        this.controller.velocity.sub(seg.right.clone().multiplyScalar(velSide));
                    }
                }

                // 2. Dead-end clamping (Only if moving FORWARD into the corner)
                if (seg.isCorner && distForward > halfLength - playerRadius) {
                    // Only block if the player is still in the "entry" half of the corner
                    if (Math.abs(distRight) < halfWidth * 0.5) {
                        const push = distForward - (halfLength - playerRadius);
                        this.playerMesh.position.add(seg.direction.clone().multiplyScalar(-push));
                        const velForward = this.controller.velocity.dot(seg.direction);
                        if (velForward > 0) this.controller.velocity.sub(seg.direction.clone().multiplyScalar(velForward));
                    }
                }

                if (seg.dist === 0 && distForward < -halfLength + playerRadius) {
                    const push = Math.abs(distForward) - (halfLength - playerRadius);
                    this.playerMesh.position.add(seg.direction.clone().multiplyScalar(push));
                    const velForward = this.controller.velocity.dot(seg.direction);
                    if (velForward < 0) this.controller.velocity.sub(seg.direction.clone().multiplyScalar(velForward));
                }

                // 3. Physical Obstacle Blocks (Wall-Hugging Prevention)
                seg.mesh.children.forEach(obj => {
                    if (obj.isMesh && obj.geometry.type === 'BoxGeometry' && obj.position.y === 0.6) {
                        const worldObjPos = new THREE.Vector3();
                        obj.getWorldPosition(worldObjPos);
                        
                        const dx = playerPos.x - worldObjPos.x;
                        const dz = playerPos.z - worldObjPos.z;
                        const distSq = dx * dx + dz * dz;
                        const minSafe = 0.6 + playerRadius; 

                        if (distSq < minSafe * minSafe) {
                            const dist = Math.sqrt(distSq);
                            const push = (minSafe - dist);
                            const dir = new THREE.Vector2(dx, dz).normalize().multiplyScalar(push);
                            this.playerMesh.position.x += dir.x;
                            this.playerMesh.position.z += dir.y;
                        }
                    }
                });
            }

            // 4. Static Prop Collision (Optimized)
            for (const o of this.levelManager.obstacles) {
                if (o instanceof StaticProp) {
                    const propPos = o.mesh.getWorldPosition(new THREE.Vector3());
                    const dy = playerPos.y - propPos.y;
                    const halfH = o.height / 2;
                    
                    if (dy < halfH - 0.2 && dy > -halfH) {
                        const toProp = playerPos.clone().sub(propPos);
                        const dist = new THREE.Vector2(toProp.x, toProp.z).length();
                        const minSafe = (o.width + o.depth) / 4 + playerRadius;
                        
                        if (dist < minSafe) {
                            const push = (minSafe - dist);
                            const dir = new THREE.Vector2(toProp.x, toProp.z).normalize().multiplyScalar(push);
                            this.playerMesh.position.x += dir.x;
                            this.playerMesh.position.z += dir.y;
                        }
                    }
                }
            }
        }

        // EXTRA SAFETY: Ensure the player mesh never falls below the ground level 
        if (this.controller.isOnGround && this.playerMesh.position.y < this.controller.groundLevel) {
            this.playerMesh.position.y = this.controller.groundLevel;
            this.controller.velocity.y = 0;
        }

        // Check for landing
        if (this.controller.isOnGround && !this.wasOnGround) {
            this.particleSystem.emitDustCloud(this.playerMesh.position);
            // Checkpoint logic: save every 250m
            const currentCkp = Math.floor(this.distance / 250) * 250;
            if (currentCkp > this.lastCheckpointDist) {
                this.lastCheckpointDist = currentCkp;
                this.uiManager.showStatus("Checkpoint Reached!");
            }
        }
        this.wasOnGround = this.controller.isOnGround;

        // 6. Update character animations
        this.character.update(deltaTime, this.controller.velocity, this.controller.isOnGround);

        // Update particles
        this.particleSystem.update(deltaTime);
        
        // Start BGM on first move
        if (!audioManager.bgmPlaying && (this.controller.velocity.length() > 0.1)) {
            audioManager.startBgm();
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new Game();
