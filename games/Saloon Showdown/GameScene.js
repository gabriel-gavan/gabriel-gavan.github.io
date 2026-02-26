import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Door } from './Door.js';
import { Prop } from './Prop.js';

export class GameScene {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.textureLoader = new THREE.TextureLoader();
        
        this.score = 0;
        this.ammo = CONFIG.GAME.MAX_AMMO;
        this.combo = 0;
        this.lives = 3;
        this.level = 1;
        this.banditsKilledInLevel = 0;
        this.innocentsShot = 0;
        this.isGameOver = false;
        this.isGameStarted = false;
        this.isBossActive = false;
        this.autoReload = false;
        
        this.doors = [];
        this.props = [];
        this.bulletHoles = [];
        this.activeBanditTimeouts = new Map(); // Track bandit "draw" timers
        this.activeDoorTimeouts = new Map(); // Track door cleanup timers
        this.particles = [];

        // Cached resources for performance
        this.bulletHoleMaterial = new THREE.MeshBasicMaterial({ 
            map: this.textureLoader.load(CONFIG.ASSETS.BULLET_HOLE), 
            transparent: true, 
            depthWrite: false, 
            polygonOffset: true,
            polygonOffsetFactor: -4 
        });
        this.particleGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        this.shootableObjects = []; // Pre-cached for raycasting

        this.setupScene();
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.onScoreUpdate = null;
        this.onAmmoUpdate = null;
        this.onComboUpdate = null;
        this.onLivesUpdate = null;
        this.onLevelUpdate = null;
        this.onInnocentsUpdate = null;
        this.onPlayerHit = null;
        this.onGameOver = null;
        this.onLevelUp = null;
        this.onShoot = null;
        this.onPropBreak = null;
        this.onWallHit = null;
    }

    setupScene() {
        // Background plane - repositioned for better depth
        const bgTexture = this.textureLoader.load(CONFIG.ASSETS.SALOON_BG);
        const bgGeometry = new THREE.PlaneGeometry(160, 90);
        const bgMaterial = new THREE.MeshBasicMaterial({ map: bgTexture });
        const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
        bgMesh.position.set(0, 0, -30); 
        bgMesh.userData.isWall = true;
        this.scene.add(bgMesh);
        this.shootableObjects.push(bgMesh);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);

        // Doors - Positioned to align with arches in the new background
        const doorPositions = [
            new THREE.Vector3(-31, -16, -12),
            new THREE.Vector3(0, -16, -12),
            new THREE.Vector3(31, -16, -12)
        ];

        doorPositions.forEach((pos, i) => {
            const door = new Door(i, pos, this.textureLoader);
            this.doors.push(door);
            this.scene.add(door.group);
            // Tag door meshes as walls, but NOT the targets inside the group
            door.doorMeshLeft.traverse(child => { 
                if(child.isMesh) {
                    child.userData.isWall = true; 
                    this.shootableObjects.push(child);
                }
            });
            door.doorMeshRight.traverse(child => { 
                if(child.isMesh) {
                    child.userData.isWall = true; 
                    this.shootableObjects.push(child);
                }
            });
            // Also add target meshes to shootable list
            Object.values(door.targets).forEach(target => {
                this.shootableObjects.push(target.mesh);
            });
        });

        // Add some Props (bottles/mugs)
        const propConfigs = [
            { type: 'bottle', pos: new THREE.Vector3(-45, -25, -20) },
            { type: 'bottle', pos: new THREE.Vector3(-40, -25, -20) },
            { type: 'mug', pos: new THREE.Vector3(40, -25, -20) },
            { type: 'mug', pos: new THREE.Vector3(45, -25, -20) },
            { type: 'bottle', pos: new THREE.Vector3(-15, -20, -10) },
            { type: 'mug', pos: new THREE.Vector3(15, -20, -10) }
        ];

        propConfigs.forEach(config => {
            const prop = new Prop(config.type, this.textureLoader);
            prop.mesh.position.copy(config.pos);
            this.props.push(prop);
            this.scene.add(prop.mesh);
            this.shootableObjects.push(prop.mesh);
        });

        // Event listener for shooting using pointer events for mobile support
        window.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    }

    onPointerDown(event) {
        if (!this.isGameStarted || this.isGameOver) return;

        if (this.ammo <= 0) {
            if (this.onDryFire) this.onDryFire();
            return;
        }

        this.ammo--;
        if (this.onAmmoUpdate) this.onAmmoUpdate(this.ammo);
        this.handleShoot();

        // Auto reload logic
        if (this.ammo <= 0 && this.autoReload) {
            setTimeout(() => {
                this.reload();
                if (this.onAutoReload) this.onAutoReload();
            }, 300);
        }

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Optimized: only raycast against currently visible shootable objects
        const visibleShootables = this.shootableObjects.filter(obj => {
            // Check if the object itself is visible AND its parents are visible
            let current = obj;
            while(current) {
                if(!current.visible) return false;
                current = current.parent;
            }
            return true;
        });

        const intersects = this.raycaster.intersectObjects(visibleShootables, true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const mesh = hit.object;
            const hitPoint = hit.point;

            // Check if we hit a Character
            let hitType = null;
            let targetObj = mesh.userData.target;

            if (targetObj) {
                hitType = this.processCharacterHit(targetObj);
            }
            
            // Check if we hit a Prop
            if (!hitType) {
                let propObj = mesh.userData.prop;
                if (propObj) {
                    const result = propObj.onShoot();
                    if (result && result.type === 'prop') {
                        hitType = 'prop';
                        this.spawnParticles(result.position, result.propType === 'bottle' ? 0x00ff00 : 0xffffff, 15);
                        if (this.onPropBreak) this.onPropBreak();
                    }
                }
            }

            // If we hit a wall or door (non-character, non-prop), add a decal
            if (!hitType && (mesh.userData.isWall || mesh.parent?.userData.isWall)) {
                this.addBulletHole(hitPoint, mesh);
                this.spawnParticles(hitPoint, 0x8b4513, 8); // Brown wood splinters
                if (this.onWallHit) this.onWallHit();
            }

            if (hitType === 'bandit') {
                this.combo++;
            } else if (hitType === 'woman' || hitType === 'prospector') {
                this.combo = 0;
            }
        } else {
            this.combo = 0;
        }

        if (this.onComboUpdate) this.onComboUpdate(this.combo);
    }

    processCharacterHit(target) {
        if (target.isShot) return null;
        
        let targetDoor = null;
        for (const door of this.doors) {
            if (Object.values(door.targets).includes(target)) {
                targetDoor = door;
                break;
            }
        }
        
        if (!targetDoor) return null;

        const type = target.onShoot();
        if (type === 'hit') return 'hit'; // Hit but not dead

        // Clear all timers for this door
        if (this.activeBanditTimeouts.has(targetDoor.id)) {
            clearTimeout(this.activeBanditTimeouts.get(targetDoor.id));
            this.activeBanditTimeouts.delete(targetDoor.id);
        }
        if (this.activeDoorTimeouts.has(targetDoor.id)) {
            clearTimeout(this.activeDoorTimeouts.get(targetDoor.id));
            this.activeDoorTimeouts.delete(targetDoor.id);
        }

        if (type === 'bandit' || type === 'boss') {
            const multiplier = Math.max(1, this.combo + 1);
            this.score += (type === 'boss' ? 50 : 1) * multiplier;
            this.banditsKilledInLevel++;
            
            if (type === 'boss') this.isBossActive = false;

            if (this.onScoreUpdate) this.onScoreUpdate(this.score);
            if (this.onProgressUpdate) this.onProgressUpdate(this.banditsKilledInLevel, CONFIG.GAME.BANDITS_PER_LEVEL);
            
            // Check for level up
            if (this.banditsKilledInLevel >= CONFIG.GAME.BANDITS_PER_LEVEL) {
                this.levelUp();
            }
        } else {
            this.innocentsShot++;
            if (this.onInnocentsUpdate) this.onInnocentsUpdate(this.innocentsShot);
            if (this.innocentsShot >= CONFIG.GAME.MAX_INNOCENTS_ALLOWED) {
                this.gameOver(type);
                return type;
            }
        }

        // Close door after seeing the death
        setTimeout(() => {
            if (targetDoor.isOpen) targetDoor.close();
        }, 350);

        return type;
    }

    addBulletHole(point, parentMesh) {
        const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), this.bulletHoleMaterial);
        
        decal.userData.isDecal = true;
        decal.position.copy(point);
        decal.position.z += 0.05; // Slightly in front of surface
        
        // Random rotation for variety
        decal.rotation.z = Math.random() * Math.PI * 2;
        
        this.scene.add(decal);
        this.bulletHoles.push(decal);
        
        // Fade out after a while
        setTimeout(() => {
            const fade = setInterval(() => {
                decal.material.opacity -= 0.1;
                if (decal.material.opacity <= 0) {
                    clearInterval(fade);
                    this.scene.remove(decal);
                    this.bulletHoles = this.bulletHoles.filter(h => h !== decal);
                }
            }, 100);
        }, 5000);
    }

    spawnParticles(position, color, count) {
        const material = new THREE.MeshBasicMaterial({ color: color });
        
        for (let i = 0; i < count; i++) {
            const particle = new THREE.Mesh(this.particleGeometry, material);
            particle.position.copy(position);
            
            // Random velocity
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5 + 0.5, // Slight upward boost
                (Math.random() - 0.5) * 1.5
            );
            
            particle.userData.life = 1.0; // Life from 1.0 down to 0
            
            this.scene.add(particle);
            this.particles.push(particle);
        }
    }

    handleShoot() {
        if (this.onShoot) this.onShoot();
    }

    levelUp() {
        if (this.level >= CONFIG.GAME.MAX_LEVELS) {
            this.gameOver('victory');
            return;
        }
        this.level++;
        this.banditsKilledInLevel = 0;
        if (this.onLevelUpdate) this.onLevelUpdate(this.level);
        if (this.onLevelUp) this.onLevelUp(this.level);
        if (this.onProgressUpdate) this.onProgressUpdate(0, CONFIG.GAME.BANDITS_PER_LEVEL);
    }

    start() {
        this.isGameStarted = true;
        this.score = 0;
        this.ammo = CONFIG.GAME.MAX_AMMO;
        this.lives = 3;
        this.level = 1;
        this.banditsKilledInLevel = 0;
        this.innocentsShot = 0;
        this.isGameOver = false;
        if (this.onScoreUpdate) this.onScoreUpdate(this.score);
        if (this.onAmmoUpdate) this.onAmmoUpdate(this.ammo);
        if (this.onLivesUpdate) this.onLivesUpdate(this.lives);
        if (this.onLevelUpdate) this.onLevelUpdate(this.level);
        if (this.onProgressUpdate) this.onProgressUpdate(0, CONFIG.GAME.BANDITS_PER_LEVEL);
        if (this.onInnocentsUpdate) this.onInnocentsUpdate(this.innocentsShot);
        
        // Clear all timers
        this.activeBanditTimeouts.forEach(t => clearTimeout(t));
        this.activeBanditTimeouts.clear();
        this.activeDoorTimeouts.forEach(t => clearTimeout(t));
        this.activeDoorTimeouts.clear();
    }

    reload() {
        this.ammo = CONFIG.GAME.MAX_AMMO;
        if (this.onAmmoUpdate) this.onAmmoUpdate(this.ammo);
    }

    gameOver(reason) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.isGameStarted = false;
        
        // Clear any pending bandit timeouts
        this.activeBanditTimeouts.forEach(timeout => clearTimeout(timeout));
        this.activeBanditTimeouts.clear();
        
        if (this.onGameOver) this.onGameOver(reason, this.score);
    }

    update() {
        if (!this.isGameStarted || this.isGameOver) return;
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.position.add(p.userData.velocity);
            p.userData.velocity.y -= 0.05; // Gravity
            p.userData.life -= 0.02;
            
            p.scale.setScalar(p.userData.life);
            
            if (p.userData.life <= 0) {
                this.scene.remove(p);
                this.particles.splice(i, 1);
            }
        }

        // Randomly open doors based on spawn chance
        if (Math.random() < CONFIG.GAME.SPAWN_CHANCE) {
            const availableDoors = this.doors.filter(d => d.state === 'closed');
            if (availableDoors.length > 0) {
                const door = availableDoors[Math.floor(Math.random() * availableDoors.length)];
                
                // Choose a random character type
                const types = ['bandit', 'woman', 'prospector'];
                const weights = [0.6, 0.2, 0.2]; // 60% chance for bandit
                const rand = Math.random();
                let chosenType = 'bandit';
                let variant = 0;
                let hp = 1;
                
                let cumulative = 0;
                for (let i = 0; i < types.length; i++) {
                    cumulative += weights[i];
                    if (rand < cumulative) {
                        chosenType = types[i];
                        break;
                    }
                }

                // If level 10 and last bandit, spawn boss
                const maxVariants = 5; 
                const poolSize = Math.min(this.level, maxVariants);
                variant = Math.floor(Math.random() * poolSize);

                if (this.level === 10 && this.banditsKilledInLevel === CONFIG.GAME.BANDITS_PER_LEVEL - 1 && !this.isBossActive) {
                    chosenType = 'boss';
                    hp = CONFIG.GAME.BOSS_HP;
                    this.isBossActive = true;
                }

                door.open(chosenType, variant, hp);
                
                // If a bandit or boss is spawned, set a timer for them to "shoot" the player
                if (chosenType === 'bandit' || chosenType === 'boss') {
                    // Base shot time reduced by level reduction
                    const baseLevelDuration = CONFIG.GAME.BASE_SHOT_TIME - (this.level - 1) * CONFIG.GAME.LEVEL_SHOT_REDUCTION;
                    const duration = baseLevelDuration - (this.score * 10);
                    const timeout = setTimeout(() => {
                        if (door.isOpen && door.currentTarget && !door.currentTarget.isShot) {
                            this.lives--;
                            if (this.onLivesUpdate) this.onLivesUpdate(this.lives);
                            if (this.onPlayerHit) this.onPlayerHit();
                            door.close();
                            if (this.lives <= 0) {
                                this.gameOver('bandit_shot_you');
                            }
                        }
                    }, Math.max(500, duration));
                    this.activeBanditTimeouts.set(door.id, timeout);
                } else {
                    // Innocents close automatically after a while
                    const doorId = door.id; // Capture ID for the cleanup
                    const timeout = setTimeout(() => {
                        if (door.isOpen) {
                            door.close();
                        }
                        this.activeDoorTimeouts.delete(doorId);
                    }, 2500);
                    this.activeDoorTimeouts.set(doorId, timeout);
                }
            }
        }
    }
}
