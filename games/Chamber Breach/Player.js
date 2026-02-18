import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Player {
    constructor(scene, camera, particleSystem, onShake, onBarrelExplode, onPipeHit, onGasHit, onExtHit, onEnemyKilled) {
        this.scene = scene;
        this.camera = camera;
        this.particleSystem = particleSystem;
        this.onShake = onShake;
        this.onBarrelExplode = onBarrelExplode;
        this.onPipeHit = onPipeHit;
        this.onGasHit = onGasHit;
        this.onExtHit = onExtHit;
        this.onEnemyKilled = onEnemyKilled;
        this.maxHealth = CONFIG.PLAYER.MAX_HEALTH;
        this.health = this.maxHealth;
        
        // Asset URLs
        const ASSETS = {
            RIFLE: 'https://rosebud.ai/assets/fps_rifle_sprite.webp?cgUE',
            SNIPER: 'https://rosebud.ai/assets/fps_sniper_sprite.webp?vsVa',
            EXTINGUISHER: 'https://rosebud.ai/assets/fps_extinguisher_sprite.webp?NqPV',
            TURRET: 'https://rosebud.ai/assets/fps_turret_sprite.webp?YBIK'
        };

        const textureLoader = new THREE.TextureLoader();
        
        // Weapon state
        this.weapons = {
            RIFLE: {
                ...CONFIG.PLAYER.WEAPONS.RIFLE,
                magazine: CONFIG.PLAYER.WEAPONS.RIFLE.MAGAZINE_SIZE,
                reserve: CONFIG.PLAYER.WEAPONS.RIFLE.RESERVE_AMMO_START,
                mesh: this.createWeaponSprite(ASSETS.RIFLE, 1.2),
                mods: { fireRate: 0, reload: 0, magazine: 0 },
                elementalAmmo: { type: 'PLAYER', count: 0 },
                defaultPos: new THREE.Vector3(0.5, -0.6, -1.0),
                aimPos: new THREE.Vector3(0, -0.45, -0.8)
            },
            SNIPER: {
                ...CONFIG.PLAYER.WEAPONS.SNIPER,
                magazine: CONFIG.PLAYER.WEAPONS.SNIPER.MAGAZINE_SIZE,
                reserve: CONFIG.PLAYER.WEAPONS.SNIPER.RESERVE_AMMO_START,
                mesh: this.createWeaponSprite(ASSETS.SNIPER, 1.4),
                currentZoomIndex: 0,
                mods: { fireRate: 0, reload: 0, magazine: 0 },
                elementalAmmo: { type: 'PLAYER', count: 0 },
                defaultPos: new THREE.Vector3(0.5, -0.7, -1.2),
                aimPos: new THREE.Vector3(0, -0.6, -1.0)
            },
            EXTINGUISHER: {
                NAME: 'EXTINGUISHER',
                magazine: CONFIG.PLAYER.EXTINGUISHER.CAPACITY,
                reserve: 0,
                mesh: this.createWeaponSprite(ASSETS.EXTINGUISHER, 1.1),
                isGadget: true,
                defaultPos: new THREE.Vector3(0.5, -0.6, -1.0),
                aimPos: new THREE.Vector3(0, -0.5, -0.8)
            },
            TURRET: {
                NAME: 'TURRET',
                magazine: 2,
                maxMagazine: 2,
                reserve: 0,
                mesh: this.createWeaponSprite(ASSETS.TURRET, 1.0),
                isGadget: true,
                COOLDOWN: 2000,
                defaultPos: new THREE.Vector3(0.5, -0.6, -1.0),
                aimPos: new THREE.Vector3(0, -0.5, -0.8)
            }
        };
        
        this.currentWeaponKey = 'RIFLE';
        this.currentWeapon = this.weapons[this.currentWeaponKey];
        this.currentTurretType = 'LASER';
        this.turretTypes = ['LASER', 'EMP', 'SLOW'];
        
        Object.values(this.weapons).forEach(w => {
            this.camera.add(w.mesh);
            w.mesh.visible = false;
        });
        this.currentWeapon.mesh.visible = true;

        this.score = 0;
        this.isDead = false;
        this.isReloading = false;
        this.isAiming = false;
        this.isMeleeing = false;
        this.lastShot = 0;
        this.lastMelee = 0;
        this.lastGrenade = 0;
        this.grenadeCount = CONFIG.PLAYER.GRENADE.COUNT_START;
        this.isAimingGrenade = false;

        this.empCount = CONFIG.PLAYER.EMP.COUNT_START;
        this.lastEMP = 0;
        this.isAimingEMP = false;

        this.thermalEnergy = CONFIG.THERMAL.MAX_ENERGY;
        this.isThermalActive = false;
        this.isPhased = false;

        this.trajectoryLine = this.createTrajectoryLine();
        this.scene.add(this.trajectoryLine);
        this.trajectoryLine.visible = false;

        const geo = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, visible: false });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.y = 1;
        this.scene.add(this.mesh);

        this.raycaster = new THREE.Raycaster();
        this.bobTime = 0;
        
        this.audio = {
            shoot: () => {},
            hit: () => {},
            reload: () => {}
        };

        this.flashlight = new THREE.SpotLight(0xffffff, 2, 15, Math.PI / 6, 0.5, 1);
        this.flashlight.position.set(0, 0, 0);
        this.camera.add(this.flashlight);
        this.flashlight.target.position.set(0, 0, -1);
        this.camera.add(this.flashlight.target);
        this.isFlashlightActive = true;
        this.flashlightBattery = CONFIG.FLASHLIGHT.MAX_BATTERY;
        
        this.lastDamageTime = 0;
        this.damageMultiplier = 1.0;
        this.buffTimer = 0;
        this.buffs = [];

        this.updateUI();
    }

    setAudio(callbacks) {
        this.audio = { ...this.audio, ...callbacks };
    }

    createWeaponSprite(url, scale) {
        const texture = new THREE.TextureLoader().load(url);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(scale, scale, 1);
        return sprite;
    }

    switchWeapon(key) {
        if (this.isReloading || this.isDead) return;
        
        // If already on Turret, cycle type
        if (key === 'TURRET' && this.currentWeaponKey === 'TURRET') {
            const idx = this.turretTypes.indexOf(this.currentTurretType);
            this.currentTurretType = this.turretTypes[(idx + 1) % this.turretTypes.length];
            this.updateTurretPreview();
            this.updateUI();
            return;
        }

        if (key === this.currentWeaponKey) return;
        if (!this.weapons[key]) return;

        this.isAiming = false; // Cancel ADS on switch
        this.currentWeapon.mesh.visible = false;
        this.currentWeaponKey = key;
        this.currentWeapon = this.weapons[key];
        
        // Don't show weapon mesh if sniping and aiming
        if (!(this.currentWeaponKey === 'SNIPER' && this.isAiming)) {
            this.currentWeapon.mesh.visible = true;
        }
        this.updateUI();
    }

    updateTurretPreview() {
        const mesh = this.weapons.TURRET.mesh;
        let color = new THREE.Color(1, 1, 1);
        if (this.currentTurretType === 'EMP') color.set(0x00ffff);
        if (this.currentTurretType === 'SLOW') color.set(0xaa00ff);
        
        if (mesh.material) {
            mesh.material.color.copy(color);
        }
    }

    toggleThermal() {
        if (this.isDead) return;
        if (!this.isThermalActive && this.thermalEnergy < 10) return; // Need some energy to start

        this.isThermalActive = !this.isThermalActive;
        const overlay = document.getElementById('thermal-overlay');
        if (overlay) overlay.style.display = this.isThermalActive ? 'block' : 'none';
        this.updateUI();
    }

    toggleFlashlight(forceState = null) {
        if (this.isDead) return;
        if (forceState !== null) {
            this.isFlashlightActive = forceState;
        } else {
            if (!this.isFlashlightActive && this.flashlightBattery < 5) return;
            this.isFlashlightActive = !this.isFlashlightActive;
        }
        this.updateUI();
    }

    cycleSniperZoom() {
        if (this.currentWeaponKey !== 'SNIPER' || !this.isAiming) return;
        this.currentWeapon.currentZoomIndex = (this.currentWeapon.currentZoomIndex + 1) % this.currentWeapon.ADS_FOV.length;
    }

    createTrajectoryLine() {
        const points = [];
        for (let i = 0; i < 30; i++) points.push(new THREE.Vector3());
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
        return new THREE.Line(geo, mat);
    }

    updateTrajectory() {
        if (!this.isAimingGrenade && !this.isAimingEMP) {
            this.trajectoryLine.visible = false;
            return;
        }

        this.trajectoryLine.visible = true;
        
        // Color based on type
        if (this.isAimingEMP) {
            this.trajectoryLine.material.color.set(0x00ffff);
        } else {
            this.trajectoryLine.material.color.set(0x00ff00);
        }

        const startPos = new THREE.Vector3();
        this.camera.getWorldPosition(startPos);
        const startVel = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(this.camera.quaternion)
            .multiplyScalar(CONFIG.PLAYER.GRENADE.THROW_FORCE);

        const points = [];
        const tempPos = new THREE.Vector3();
        const tempVel = new THREE.Vector3().copy(startVel);
        const dt = 0.1;

        for (let i = 0; i < 30; i++) {
            tempPos.copy(startPos).add(tempVel.clone().multiplyScalar(i * dt));
            tempPos.y -= 0.5 * CONFIG.PLAYER.GRENADE.GRAVITY * Math.pow(i * dt, 2);
            points.push(tempPos.clone());
            if (tempPos.y < 0) break;
        }

        this.trajectoryLine.geometry.setFromPoints(points);
    }

    throwGrenade(onSpawn) {
        if (this.isDead || this.grenadeCount <= 0 || Date.now() - this.lastGrenade < CONFIG.PLAYER.GRENADE.COOLDOWN) return;

        this.grenadeCount--;
        this.lastGrenade = Date.now();
        this.updateUI();

        const spawnPos = new THREE.Vector3();
        this.camera.getWorldPosition(spawnPos);
        const velocity = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(this.camera.quaternion)
            .multiplyScalar(CONFIG.PLAYER.GRENADE.THROW_FORCE);

        if (onSpawn) onSpawn(spawnPos, velocity);
    }

    throwEMP(onSpawn) {
        if (this.isDead || this.empCount <= 0 || Date.now() - this.lastEMP < CONFIG.PLAYER.EMP.COOLDOWN) return;

        this.empCount--;
        this.lastEMP = Date.now();
        this.updateUI();

        const spawnPos = new THREE.Vector3();
        this.camera.getWorldPosition(spawnPos);
        const velocity = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(this.camera.quaternion)
            .multiplyScalar(CONFIG.PLAYER.GRENADE.THROW_FORCE);

        if (onSpawn) onSpawn(spawnPos, velocity);
    }

    replenishGrenades(amount) {
        this.grenadeCount = Math.min(CONFIG.PLAYER.GRENADE.MAX_COUNT, this.grenadeCount + amount);
        this.updateUI();
    }

    upgradeWeapon(weaponKey, modType) {
        const weapon = this.weapons[weaponKey];
        if (!weapon || !weapon.mods) return false;
        
        if (weapon.mods[modType] === undefined) {
            weapon.mods[modType] = 0;
        }

        if (weapon.mods[modType] >= 5) return false; // Max level 5
        
        weapon.mods[modType]++;
        
        if (modType === 'fireRate') {
            // Reduce cooldown by 10% per level
            weapon.COOLDOWN *= 0.9;
        } else if (modType === 'reload') {
            // Reduce reload time by 10% per level
            weapon.RELOAD_TIME *= 0.9;
        } else if (modType === 'magazine') {
            // Increase magazine size by 20% per level
            const increase = Math.ceil(weapon.MAGAZINE_SIZE * 0.2);
            weapon.MAGAZINE_SIZE += increase;
            weapon.magazine += increase; // Add to current mag too
        } else if (modType === 'damage') {
            // Increase damage by 15% per level
            weapon.DAMAGE = Math.ceil(weapon.DAMAGE * 1.15);
        }
        
        this.updateUI();
        return true;
    }

    update(deltaTime, isMoving, mouseDelta) {
        if (this.isDead) return;

        // --- Phase Shift Logic ---
        if (this.isPhased) {
            document.body.style.backgroundColor = 'rgba(255, 0, 255, 0.1)';
            if (this.currentWeapon.mesh.material) {
                this.currentWeapon.mesh.material.opacity = 0.4;
            }
        } else {
            if (this.currentWeapon.mesh.material && this.currentWeapon.mesh.material.opacity < 1.0 && !this.isReloading) {
                this.currentWeapon.mesh.material.opacity = THREE.MathUtils.lerp(this.currentWeapon.mesh.material.opacity, 1.0, deltaTime * 5);
            }
        }

        // --- Damage Buff Update ---
        this.damageMultiplier = 1.0;
        
        for (let i = this.buffs.length - 1; i >= 0; i--) {
            const buff = this.buffs[i];
            buff.duration -= deltaTime;
            if (buff.duration <= 0) {
                this.buffs.splice(i, 1);
            } else {
                this.damageMultiplier += buff.multiplier;
            }
        }

        // --- Flashlight Logic ---
        if (this.isFlashlightActive) {
            this.flashlightBattery -= CONFIG.FLASHLIGHT.CONSUMPTION_RATE * deltaTime;
            if (this.flashlightBattery <= 0) {
                this.flashlightBattery = 0;
                this.toggleFlashlight(false);
            }
        } else {
            this.flashlightBattery = Math.min(CONFIG.FLASHLIGHT.MAX_BATTERY, this.flashlightBattery + CONFIG.FLASHLIGHT.REGEN_RATE * deltaTime);
        }
        this.flashlight.visible = this.isFlashlightActive;

        // --- Thermal Vision Logic ---
        if (this.isThermalActive) {
            this.thermalEnergy -= CONFIG.THERMAL.CONSUMPTION_RATE * deltaTime;
            if (this.thermalEnergy <= 0) {
                this.thermalEnergy = 0;
                this.toggleThermal();
            }
        } else {
            this.thermalEnergy = Math.min(CONFIG.THERMAL.MAX_ENERGY, this.thermalEnergy + CONFIG.THERMAL.REGEN_RATE * deltaTime);
        }
        this.updateUI();

        // --- Extinguisher Regen ---
        if (this.currentWeaponKey !== 'EXTINGUISHER' || !this.isSpraying) {
            const ext = this.weapons.EXTINGUISHER;
            ext.magazine = Math.min(CONFIG.PLAYER.EXTINGUISHER.CAPACITY, ext.magazine + CONFIG.PLAYER.EXTINGUISHER.REGEN_RATE * deltaTime);
            this.updateUI();
        }

        this.updateTrajectory();

        // --- ADS Logic ---
        const targetPos = this.isAiming ? this.currentWeapon.aimPos : this.currentWeapon.defaultPos;
        
        let targetFOV = CONFIG.PLAYER.DEFAULT_FOV;
        if (this.isAiming) {
            if (Array.isArray(this.currentWeapon.ADS_FOV)) {
                targetFOV = this.currentWeapon.ADS_FOV[this.currentWeapon.currentZoomIndex];
            } else {
                targetFOV = this.currentWeapon.ADS_FOV;
            }
        }
        
        // Handle Sniper scope overlay
        const scopeOverlay = document.getElementById('scope-overlay');
        const crosshair = document.getElementById('crosshair');
        if (this.currentWeaponKey === 'SNIPER' && this.isAiming) {
            if (scopeOverlay) scopeOverlay.style.display = 'block';
            if (crosshair) crosshair.style.display = 'none';
            this.currentWeapon.mesh.visible = false; // Hide weapon model when scoped
        } else {
            if (scopeOverlay) scopeOverlay.style.display = 'none';
            if (crosshair) crosshair.style.display = 'block';
            this.currentWeapon.mesh.visible = true;
        }

        // Smoothly move weapon to target position
        this.currentWeapon.mesh.position.lerp(targetPos, deltaTime * 10);
        
        // Smoothly zoom camera FOV
        if (Math.abs(this.camera.fov - targetFOV) > 0.1) {
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, deltaTime * 10);
            this.camera.updateProjectionMatrix();
        }

        // --- Weapon Bobbing (while moving) ---
        const bobMultiplier = this.isAiming ? 0.2 : 1.0;
        if (isMoving && !this.isReloading) {
            this.bobTime += deltaTime * CONFIG.PLAYER.BOB.SPEED;
            const bobX = Math.cos(this.bobTime) * CONFIG.PLAYER.BOB.AMOUNT * bobMultiplier;
            const bobY = Math.sin(this.bobTime * 2) * CONFIG.PLAYER.BOB.AMOUNT * bobMultiplier;
            
            this.currentWeapon.mesh.position.x += bobX;
            this.currentWeapon.mesh.position.y += bobY;
        }

        // --- Weapon Sway ---
        const swayMultiplier = this.isAiming ? 0.3 : 1.0;
        if (mouseDelta && !this.isReloading) {
            const swayX = -mouseDelta.x * CONFIG.PLAYER.SWAY.INTENSITY * swayMultiplier;
            const swayY = mouseDelta.y * CONFIG.PLAYER.SWAY.INTENSITY * swayMultiplier;
            
            const currentSwayX = THREE.MathUtils.clamp(swayX, -CONFIG.PLAYER.SWAY.MAX_AMOUNT, CONFIG.PLAYER.SWAY.MAX_AMOUNT);
            const currentSwayY = THREE.MathUtils.clamp(swayY, -CONFIG.PLAYER.SWAY.MAX_AMOUNT, CONFIG.PLAYER.SWAY.MAX_AMOUNT);
            
            this.currentWeapon.mesh.position.x += currentSwayX;
            this.currentWeapon.mesh.position.y += currentSwayY;
        }
    }

    shoot(enemies, walls, onDeployTurret) {
        if (this.isDead || this.isReloading || this.isMeleeing || this.currentWeapon.magazine <= 0) return;
        
        if (this.currentWeaponKey === 'EXTINGUISHER') return; // Handled separately via spray

        if (this.currentWeaponKey === 'TURRET') {
            if (Date.now() - this.lastShot < this.currentWeapon.COOLDOWN) return;
            
            this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
            const intersects = this.raycaster.intersectObjects([this.scene.children[0]], true); // floor
            if (intersects.length > 0) {
                const hit = intersects[0];
                if (hit.distance < 5) {
                    this.currentWeapon.magazine--;
                    this.lastShot = Date.now();
                    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                    if (onDeployTurret) onDeployTurret(hit.point, dir, this.currentTurretType);
                    this.updateUI();
                }
            }
            return;
        }

        if (Date.now() - this.lastShot < this.currentWeapon.COOLDOWN) return;
        
        this.currentWeapon.magazine--;
        this.lastShot = Date.now();
        this.updateUI();
        
        this.audio.shoot(); // Trigger audio

        const baseDamage = this.currentWeapon.DAMAGE;
        const finalDamage = baseDamage * this.damageMultiplier;
        
        let activeDamageType = 'PLAYER';
        if (this.currentWeapon.elementalAmmo && this.currentWeapon.elementalAmmo.count > 0) {
            activeDamageType = this.currentWeapon.elementalAmmo.type;
            this.currentWeapon.elementalAmmo.count--;
        }

        if (this.onShake) this.onShake(this.currentWeapon.SHAKE);

        let muzzleFlashColor = 0xffff00;
        if (this.buffs.length > 0) muzzleFlashColor = 0x00ff00;
        if (activeDamageType === 'INCENDIARY') muzzleFlashColor = 0xff4400;
        if (activeDamageType === 'SHOCK') muzzleFlashColor = 0x00ffff;

        const flash = new THREE.PointLight(muzzleFlashColor, 4, 6);
        flash.position.set(0.4, -0.3, -1.2);
        this.camera.add(flash);
        setTimeout(() => this.camera.remove(flash), 40);

        if (this.particleSystem) {
            const muzzlePos = new THREE.Vector3();
            this.currentWeapon.mesh.getWorldPosition(muzzlePos);
            const shootDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            this.particleSystem.createMuzzleFlash(muzzlePos, shootDir, muzzleFlashColor);
        }

        this.currentWeapon.mesh.position.z += 0.2;
        setTimeout(() => this.currentWeapon.mesh.position.z -= 0.2, 50);

        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const targetObjects = [...enemies.map(e => e.mesh), ...walls];
        const intersects = this.raycaster.intersectObjects(targetObjects, true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const hitObject = hit.object;

            const enemy = enemies.find(e => e.mesh === hitObject || e.mesh.children.includes(hitObject));
            this.audio.hit(!!enemy); // Trigger impact audio

            if (this.particleSystem) {
                const isEnemy = enemies.some(e => e.mesh === hitObject || e.mesh.children.includes(hitObject));
                const isBarrel = hitObject.userData.isBarrel;
                const isPipe = hitObject.userData.isPipe;
                const isGas = hitObject.userData.isGas;
                const isExt = hitObject.userData.isExtinguisherProp;
                
                let impactColor = 0xcccccc;
                if (isEnemy) {
                    if (activeDamageType === 'INCENDIARY') impactColor = 0xff4400;
                    else if (activeDamageType === 'SHOCK') impactColor = 0x00ffff;
                    else impactColor = 0xff0000;
                }
                else if (isBarrel) impactColor = 0xffaa00;
                else if (isPipe) impactColor = 0x00ff00;
                else if (isGas) impactColor = 0x88ffaa;
                else if (isExt) impactColor = 0xffffff;

                this.particleSystem.createImpact(hit.point, hit.face.normal, impactColor);
            }

            if (enemy) {
                enemy.takeDamage(finalDamage, enemies, activeDamageType);
                if (enemy.isDead) {
                    this.score += 100;
                    if (this.onEnemyKilled) this.onEnemyKilled(enemy);
                    this.updateUI();
                }
            } else if (hitObject.userData.isBarrel) {
                hitObject.userData.health -= finalDamage;
                if (hitObject.userData.health <= 0) {
                    if (this.onBarrelExplode) this.onBarrelExplode(hitObject);
                }
            } else if (hitObject.userData.isPipe) {
                if (this.onPipeHit) this.onPipeHit(hitObject, hit.point);
            } else if (hitObject.userData.isGas) {
                if (this.onGasHit) this.onGasHit(hitObject.userData.gasLeak);
            } else if (hitObject.userData.isExtinguisherProp) {
                hitObject.userData.health -= finalDamage;
                if (hitObject.userData.health <= 0) {
                    if (this.onExtHit) this.onExtHit(hitObject);
                }
            }
        }

        if (this.currentWeapon.magazine === 0 && this.currentWeapon.reserve > 0) {
            this.reload();
        }
    }

    melee(enemies) {
        if (this.isDead || this.isMeleeing || Date.now() - this.lastMelee < CONFIG.PLAYER.MELEE.COOLDOWN) return;

        this.isMeleeing = true;
        this.isAiming = false; // Cancel ADS
        this.lastMelee = Date.now();

        // Melee animation: Swing weapon
        const originalRot = this.currentWeapon.mesh.rotation.clone();
        const originalPos = this.currentWeapon.mesh.position.clone();

        // Simple swing animation using a timeout for simplicity in this structure
        // Moves the gun forward and rotates it
        this.currentWeapon.mesh.position.z -= 0.5;
        this.currentWeapon.mesh.position.x -= 0.2;
        this.currentWeapon.mesh.rotation.y += 0.5;
        this.currentWeapon.mesh.rotation.x -= 0.3;

        setTimeout(() => {
            this.currentWeapon.mesh.position.copy(originalPos);
            this.currentWeapon.mesh.rotation.copy(originalRot);
            this.isMeleeing = false;
        }, 200);

        // Damage Logic
        // Check for enemies within a cone or close range in front of the player
        const playerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        
        enemies.forEach(enemy => {
            const toEnemy = new THREE.Vector3().subVectors(enemy.mesh.position, this.camera.position);
            const distance = toEnemy.length();
            
            if (distance < CONFIG.PLAYER.MELEE.RANGE) {
                // Check if enemy is in front (dot product)
                toEnemy.normalize();
                const dot = playerForward.dot(toEnemy);
                
                if (dot > 0.5) { // Roughly 60 degree cone
                    enemy.takeDamage(CONFIG.PLAYER.MELEE.DAMAGE);
                    
                    // Blood effect for melee
                    if (this.particleSystem) {
                        this.particleSystem.createImpact(enemy.mesh.position, new THREE.Vector3(0, 1, 0), 0xff0000);
                    }

                    if (enemy.isDead) {
                        this.score += 150; // Bonus score for melee
                        if (this.onEnemyKilled) this.onEnemyKilled(enemy);
                        this.updateUI();
                    }
                }
            }
        });
    }

    spray(deltaTime, fireFields, barrels) {
        if (this.currentWeaponKey !== 'EXTINGUISHER' || this.currentWeapon.magazine <= 0) {
            this.isSpraying = false;
            return;
        }

        this.isSpraying = true;
        this.currentWeapon.magazine -= CONFIG.PLAYER.EXTINGUISHER.EXTINGUISH_RATE * deltaTime;
        this.updateUI();

        // Particles
        if (this.particleSystem && Math.random() < 0.5) {
            const nozzlePos = new THREE.Vector3();
            this.currentWeapon.mesh.getWorldPosition(nozzlePos);
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            this.particleSystem.createExplosion(nozzlePos.add(dir.multiplyScalar(0.5)), 0xffffff, 2, 5);
        }

        // Extinguish Logic
        const playerPos = this.camera.position;
        const playerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const range = CONFIG.PLAYER.EXTINGUISHER.RANGE;
        const cone = CONFIG.PLAYER.EXTINGUISHER.CONE;

        // Clear FireFields
        fireFields.forEach(fire => {
            const toFire = new THREE.Vector3().subVectors(fire.position, playerPos);
            if (toFire.length() < range) {
                toFire.normalize();
                if (playerForward.dot(toFire) > cone) {
                    // Reduce duration or just clear
                    fire.duration -= deltaTime * 1000 * 5; // Extinguish 5x faster
                }
            }
        });

        // Disable Barrels
        barrels.forEach(barrel => {
            const toBarrel = new THREE.Vector3().subVectors(barrel.position, playerPos);
            if (toBarrel.length() < range) {
                toBarrel.normalize();
                if (playerForward.dot(toBarrel) > cone) {
                    // Turn barrel green/disabled
                    barrel.userData.isBarrel = false;
                    barrel.material.color.set(0x00ff00);
                    barrel.material.emissive.set(0x002200);
                }
            }
        });
    }

    takeDamage(amount, isDOT = false) {
        if (this.isDead || this.isPhased) return;
        
        const now = Date.now();
        if (!isDOT && now - this.lastDamageTime < CONFIG.PLAYER.INVULNERABILITY_DURATION) return;
        
        if (!isDOT) this.lastDamageTime = now;
        
        this.health -= amount;
        this.updateUI();

        // Don't shake/flash for tiny DOT damage unless it's substantial
        if (!isDOT || amount > 5) {
            if (this.onShake) this.onShake(CONFIG.PLAYER.DAMAGE_SHAKE);
            document.body.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
            setTimeout(() => {
                if (!this.isDead) document.body.style.backgroundColor = 'black';
            }, 100);
        } else {
            // Subtle red hint for DOT
            document.body.style.backgroundColor = 'rgba(255, 0, 0, 0.05)';
            setTimeout(() => {
                if (!this.isDead && document.body.style.backgroundColor.includes('0.05')) {
                    document.body.style.backgroundColor = 'black';
                }
            }, 50);
        }

        if (this.health <= 0) this.die();
    }

    heal(amount) {
        if (this.isDead) return;
        this.health = Math.min(this.maxHealth, this.health + amount);
        this.updateUI();
        document.body.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
        setTimeout(() => document.body.style.backgroundColor = 'black', 100);
    }

    replenishAmmo(type) {
        if (this.isDead) return;
        
        const weapon = this.weapons[type];
        if (!weapon) return;

        const amount = type === 'RIFLE' ? CONFIG.PICKUPS.AMMO_RIFLE : CONFIG.PICKUPS.AMMO_SNIPER;
        weapon.reserve = Math.min(weapon.MAX_RESERVE_AMMO, weapon.reserve + amount);
        this.updateUI();

        // Color flash based on weapon type
        const flashColor = type === 'RIFLE' ? 'rgba(255, 170, 0, 0.2)' : 'rgba(0, 170, 255, 0.2)';
        document.body.style.backgroundColor = flashColor;
        setTimeout(() => document.body.style.backgroundColor = 'black', 100);
    }

    reload() {
        if (this.isDead || this.isReloading || this.currentWeapon.magazine === this.currentWeapon.MAGAZINE_SIZE || this.currentWeapon.reserve <= 0) return;

        this.isReloading = true;
        this.isAiming = false;
        this.updateUI();
        this.audio.reload(); // Trigger reload audio

        // Reload animation
        const startRotation = this.currentWeapon.mesh.rotation.x;
        this.currentWeapon.mesh.rotation.x = 0.5;

        setTimeout(() => {
            const needed = this.currentWeapon.MAGAZINE_SIZE - this.currentWeapon.magazine;
            const toReload = Math.min(needed, this.currentWeapon.reserve);
            this.currentWeapon.magazine += toReload;
            this.currentWeapon.reserve -= toReload;
            this.isReloading = false;
            this.currentWeapon.mesh.rotation.x = startRotation;
            this.updateUI();
        }, this.currentWeapon.RELOAD_TIME);
    }

    swapWeapon() {
        const nextKey = this.currentWeaponKey === 'RIFLE' ? 'SNIPER' : 'RIFLE';
        this.switchWeapon(nextKey);
    }

    updateUI() {
        const healthEl = document.getElementById('health-val');
        const rifleAmmoEl = document.getElementById('rifle-ammo');
        const sniperAmmoEl = document.getElementById('sniper-ammo');
        const extAmmoEl = document.getElementById('ext-ammo');
        const turretAmmoEl = document.getElementById('turret-ammo');
        const rifleSlot = document.getElementById('slot-rifle');
        const sniperSlot = document.getElementById('slot-sniper');
        const extSlot = document.getElementById('slot-ext');
        const turretSlot = document.getElementById('slot-turret');
        const scoreEl = document.getElementById('score-val');
        const coresEl = document.getElementById('cores-val');
        const scrapHUD = document.getElementById('scrap-val');

        if (healthEl) healthEl.innerText = Math.max(0, this.health);
        
        const grenadeEl = document.getElementById('grenade-count');
        if (grenadeEl) {
            grenadeEl.innerText = `F:${this.grenadeCount} E:${this.empCount}`;
        }

        if (rifleAmmoEl) rifleAmmoEl.innerText = `${this.weapons.RIFLE.magazine} / ${this.weapons.RIFLE.reserve}${this.weapons.RIFLE.elementalAmmo.count > 0 ? ' [' + this.weapons.RIFLE.elementalAmmo.type + ':' + this.weapons.RIFLE.elementalAmmo.count + ']' : ''}`;
        if (sniperAmmoEl) sniperAmmoEl.innerText = `${this.weapons.SNIPER.magazine} / ${this.weapons.SNIPER.reserve}${this.weapons.SNIPER.elementalAmmo.count > 0 ? ' [' + this.weapons.SNIPER.elementalAmmo.type + ':' + this.weapons.SNIPER.elementalAmmo.count + ']' : ''}`;
        
        // Update Mod Indicators
        this.updateModHUD('RIFLE');
        this.updateModHUD('SNIPER');

        if (extAmmoEl) extAmmoEl.innerText = `${Math.floor(this.weapons.EXTINGUISHER.magazine)}%`;
        if (turretAmmoEl) turretAmmoEl.innerText = `${this.weapons.TURRET.magazine} [${this.currentTurretType}]`;
        
        if (rifleSlot) rifleSlot.classList.toggle('active', this.currentWeaponKey === 'RIFLE');
        if (sniperSlot) sniperSlot.classList.toggle('active', this.currentWeaponKey === 'SNIPER');
        if (extSlot) extSlot.classList.toggle('active', this.currentWeaponKey === 'EXTINGUISHER');
        if (turretSlot) turretSlot.classList.toggle('active', this.currentWeaponKey === 'TURRET');

        // Thermal UI
        const thermalValEl = document.getElementById('thermal-val');
        const thermalBarEl = document.getElementById('thermal-bar');
        const thermalSlot = document.getElementById('thermal-slot');
        if (thermalValEl) thermalValEl.innerText = `${Math.floor(this.thermalEnergy)}%`;
        if (thermalBarEl) thermalBarEl.style.width = `${this.thermalEnergy}%`;
        if (thermalSlot) thermalSlot.classList.toggle('active', this.isThermalActive);

        // Flashlight UI
        const flashlightValEl = document.getElementById('flashlight-val');
        const flashlightBarEl = document.getElementById('flashlight-bar');
        const flashlightSlot = document.getElementById('flashlight-slot');
        if (flashlightValEl) flashlightValEl.innerText = `${Math.floor(this.flashlightBattery)}%`;
        if (flashlightBarEl) flashlightBarEl.style.width = `${this.flashlightBattery}%`;
        if (flashlightSlot) flashlightSlot.classList.toggle('active', this.isFlashlightActive);

        if (scoreEl) scoreEl.innerText = this.score;
        if (coresEl && window.game) coresEl.innerText = window.game.techCores;
        if (scrapHUD && window.game) scrapHUD.innerText = window.game.scrap;
    }

    updateModHUD(weaponKey) {
        const weapon = this.weapons[weaponKey];
        const container = document.getElementById(`${weaponKey.toLowerCase()}-mods`);
        if (!container || !weapon.mods) return;

        const modTypes = [
            { key: 'damage', label: 'DMG', class: 'dmg' },
            { key: 'fireRate', label: 'RATE', class: 'fireRate' },
            { key: 'magazine', label: 'MAG', class: 'magazine' },
            { key: 'reload', label: 'RELOAD', class: 'reload' }
        ];

        let html = '';
        modTypes.forEach(mod => {
            const level = weapon.mods[mod.key] || 0;
            html += `
                <div class="mod-group">
                    <div class="mod-label">${mod.label}</div>
                    <div class="mod-pips">
            `;
            for (let i = 0; i < 5; i++) {
                html += `<div class="mod-pip ${i < level ? 'filled ' + mod.class : ''}"></div>`;
            }
            html += `
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }
    die() {
        this.isDead = true;
        // The GameScene will handle the death screen transition
    }
}
