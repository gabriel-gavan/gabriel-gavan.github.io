import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createShieldMaterial } from './ShieldShader.js';
import { PerkManager } from './PerkManager.js';
import { Weapon } from './Weapon.js';

export class Player {
    constructor(scene, camera, particleSystem, onShake, onBarrelExplode, onPipeHit, onGasHit, onExtHit, onEnemyKilled, onObjectDestroyed) {
        this.scene = scene;
        this.game = scene.game;
        this.camera = camera;
        this.particleSystem = particleSystem;
        this.onShake = onShake;
        this.onBarrelExplode = onBarrelExplode;
        this.onPipeHit = onPipeHit;
        this.onGasHit = onGasHit;
        this.onExtHit = onExtHit;
        this.onEnemyKilled = onEnemyKilled;
        this.onObjectDestroyed = onObjectDestroyed;
        this.maxHealth = CONFIG.PLAYER.MAX_HEALTH;
        this.health = this.maxHealth;

        this._scratchVecA = new THREE.Vector3();
        this._scratchVecB = new THREE.Vector3();
        this._scratchVecC = new THREE.Vector3();
        this._scratchVecD = new THREE.Vector3();
        this._scratchVecE = new THREE.Vector3();
        this._scratchQuat = new THREE.Quaternion();

        this.ui = {
            thermalOverlay: null,
            crosshair: null,
            scopeOverlay: null,
            sniperAmmo: null,
            ammo: null,
            healthVal: null,
            scoreVal: null,
            grenadeCount: null,
            extAmmo: null,
            turretAmmo: null,
            slotRifle: null,
            slotSniper: null,
            slotExt: null,
            slotTurret: null,
            thermalSlot: null,
            thermalVal: null,
            thermalBar: null,
            coresVal: null,
            scrapVal: null,
            hitmarker: null,
            rifleAmmoIcon: null,
            sniperAmmoIcon: null,
            rifleMods: null,
            sniperMods: null
        };

        this.lastUIValues = {
            health: -1,
            score: -1,
            rifleMag: -1,
            rifleRes: -1,
            sniperMag: -1,
            sniperRes: -1,
            grenades: -1,
            emps: -1,
            thermal: -1,
            scrap: -1,
            cores: -1,
            rifleModHash: -1,
            sniperModHash: -1
        };

        const ASSETS = {
            RIFLE: 'https://rosebud.ai/assets/fps_rifle_sprite.webp?cgUE',
            SNIPER: 'https://rosebud.ai/assets/fps_sniper_perfect_match.png.webp?kjuL',
            EXTINGUISHER: 'https://rosebud.ai/assets/fps_extinguisher_sprite.webp?NqPV',
            TURRET: 'https://rosebud.ai/assets/fps_turret_sprite.webp?YBIK',
            AMMO_INCENDIARY: 'https://rosebud.ai/assets/incendiary_ammo_icon.png.webp?F1cz',
            AMMO_SHOCK: 'https://rosebud.ai/assets/shock_ammo_icon.png.webp?jXE1'
        };
        this.assetUrls = ASSETS;

        this.weapons = {
            RIFLE: {
                ...CONFIG.PLAYER.WEAPONS.RIFLE,
                magazine: CONFIG.PLAYER.WEAPONS.RIFLE.MAGAZINE_SIZE,
                reserve: CONFIG.PLAYER.WEAPONS.RIFLE.RESERVE_AMMO_START,
                mesh: this.createWeaponSprite(ASSETS.RIFLE, 1.2),
                mods: { fireRate: 0, reload: 0, magazine: 0, damage: 0 },
                elementalAmmo: { type: 'PLAYER', count: 0 },
                defaultPos: new THREE.Vector3(0.5, -0.6, -1.0),
                aimPos: new THREE.Vector3(0, -0.45, -0.8),
                muzzleOffset: new THREE.Vector3(-0.4, 0.2, 0.1),
                system: new Weapon({
                    name: 'RIFLE',
                    cooldown: CONFIG.PLAYER.WEAPONS.RIFLE.COOLDOWN,
                    damage: CONFIG.PLAYER.WEAPONS.RIFLE.DAMAGE,
                    projectileSpeed: 150,
                    projectileColor: 0x00d0ff,
                    owner: 'PLAYER',
                    shake: CONFIG.PLAYER.WEAPONS.RIFLE.SHAKE,
                    onShoot: () => this.audio.shoot()
                })
            },
            SNIPER: {
                ...CONFIG.PLAYER.WEAPONS.SNIPER,
                magazine: CONFIG.PLAYER.WEAPONS.SNIPER.MAGAZINE_SIZE,
                reserve: CONFIG.PLAYER.WEAPONS.SNIPER.RESERVE_AMMO_START,
                mesh: this.createWeaponSprite(ASSETS.SNIPER, 1),
                currentZoomIndex: 0,
                mods: { fireRate: 0, reload: 0, magazine: 0, damage: 0 },
                elementalAmmo: { type: 'PLAYER', count: 0 },
                defaultPos: new THREE.Vector3(0.65, -0.65, -1.2),
                aimPos: new THREE.Vector3(0, -0.45, -0.8),
                muzzleOffset: new THREE.Vector3(1.1, 0.4, 0.1),
                system: new Weapon({
                    name: 'SNIPER',
                    cooldown: CONFIG.PLAYER.WEAPONS.SNIPER.COOLDOWN,
                    damage: CONFIG.PLAYER.WEAPONS.SNIPER.DAMAGE,
                    projectileSpeed: 300,
                    projectileColor: 0x00ffff,
                    owner: 'PLAYER',
                    shake: CONFIG.PLAYER.WEAPONS.SNIPER.SHAKE,
                    onShoot: () => this.audio.shoot()
                })
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

        this.perkManager = new PerkManager(this);

        this.currentWeaponKey = 'RIFLE';
        this.currentWeapon = this.weapons[this.currentWeaponKey];
        this.currentTurretType = 'LASER';
        this.turretTypes = ['LASER', 'EMP', 'SLOW'];

        Object.values(this.weapons).forEach(w => {
            this.camera.add(w.mesh);
            w.mesh.visible = false;
        });

        this.weapons.SNIPER.mesh.scale.x = -1.25;
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
        this.isInvincible = false;
        this.invincibilityTimer = 0;
        this.hasProjectedShield = false;
        this.projectedShieldTimer = 0;

        this.omegaTurretUnlocked = false;
        this.flashFreezeUnlocked = false;

        const shieldGeo = new THREE.SphereGeometry(1.5, 32, 32);
        this.projectedShieldMesh = new THREE.Mesh(shieldGeo, createShieldMaterial(0x00ffff, 0.15));
        this.projectedShieldMesh.visible = false;
        this.scene.add(this.projectedShieldMesh);

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

        this.muzzleFlashLight = new THREE.PointLight(0x00d0ff, 0, 6);
        this.muzzleFlashLight.position.set(0.4, -0.3, -1.2);
        this.camera.add(this.muzzleFlashLight);

        this.audio = {
            shoot: () => {},
            hit: () => {},
            reload: () => {}
        };

        this.cacheUIElements();

        this.lastDamageTime = 0;
        this.lastSecondaryShot = 0;
        this.damageMultiplier = 1.0;
        this.buffTimer = 0;
        this.buffs = [];

        this.updateUI();
    }

    setAudio(callbacks) {
        this.audio = { ...this.audio, ...callbacks };
    }

    cacheUIElements() {
        this.ui.thermalOverlay = document.getElementById('thermal-overlay');
        this.ui.crosshair = document.getElementById('crosshair');
        this.ui.scopeOverlay = document.getElementById('scope-overlay');
        this.ui.sniperAmmo = document.getElementById('sniper-ammo');
        this.ui.ammo = document.getElementById('ammo');
        this.ui.healthVal = document.getElementById('health-val');
        this.ui.scoreVal = document.getElementById('score-val');
        this.ui.grenadeCount = document.getElementById('grenade-count');
        this.ui.extAmmo = document.getElementById('ext-ammo');
        this.ui.turretAmmo = document.getElementById('turret-ammo');
        this.ui.slotRifle = document.getElementById('slot-rifle');
        this.ui.slotSniper = document.getElementById('slot-sniper');
        this.ui.slotExt = document.getElementById('slot-ext');
        this.ui.slotTurret = document.getElementById('slot-turret');
        this.ui.thermalSlot = document.getElementById('thermal-slot');
        this.ui.thermalVal = document.getElementById('thermal-val');
        this.ui.thermalBar = document.getElementById('thermal-bar');
        this.ui.coresVal = document.getElementById('cores-val');
        this.ui.scrapVal = document.getElementById('scrap-val');
        this.ui.hitmarker = document.getElementById('hitmarker');
        this.ui.rifleAmmoIcon = document.getElementById('rifle-ammo-icon');
        this.ui.sniperAmmoIcon = document.getElementById('sniper-ammo-icon');
        this.ui.rifleMods = document.getElementById('rifle-mods');
        this.ui.sniperMods = document.getElementById('sniper-mods');
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

        if (key === 'TURRET' && this.currentWeaponKey === 'TURRET') {
            const idx = this.turretTypes.indexOf(this.currentTurretType);
            this.currentTurretType = this.turretTypes[(idx + 1) % this.turretTypes.length];
            this.updateTurretPreview();
            this.updateUI();
            return;
        }

        if (key === this.currentWeaponKey) return;
        if (!this.weapons[key]) return;

        this.isAiming = false;
        this.currentWeapon.mesh.visible = false;
        this.currentWeaponKey = key;
        this.currentWeapon = this.weapons[key];

        if (!(this.currentWeaponKey === 'SNIPER' && this.isAiming)) {
            this.currentWeapon.mesh.visible = true;
        }
        this.updateUI();
    }

    updateTurretPreview() {
        const mesh = this.weapons.TURRET.mesh;
        const color = new THREE.Color(1, 1, 1);
        if (this.currentTurretType === 'EMP') color.set(0x00ffff);
        if (this.currentTurretType === 'SLOW') color.set(0xaa00ff);

        if (mesh.material) {
            mesh.material.color.copy(color);
        }
    }

    toggleThermal() {
        if (this.isDead) return;
        if (!this.isThermalActive && this.thermalEnergy < 10) return;

        this.isThermalActive = !this.isThermalActive;
        const overlay = this.ui.thermalOverlay || document.getElementById('thermal-overlay');
        if (overlay) overlay.style.display = this.isThermalActive ? 'block' : 'none';
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
        this.trajectoryLine.material.color.set(this.isAimingEMP ? 0x00ffff : 0x00ff00);

        const startPos = this._scratchVecA;
        this.camera.getWorldPosition(startPos);
        const startVel = this._scratchVecB.set(0, 0, -1)
            .applyQuaternion(this.camera.quaternion)
            .multiplyScalar(CONFIG.PLAYER.GRENADE.THROW_FORCE);

        const points = [];
        const tempPos = this._scratchVecC;
        const tempVel = this._scratchVecD.copy(startVel);
        const dt = 0.1;
        const gravityHalfDtSq = 0.5 * CONFIG.PLAYER.GRENADE.GRAVITY;
        let t = 0;

        for (let i = 0; i < 30; i++) {
            tempPos.copy(startPos).addScaledVector(tempVel, t);
            tempPos.y -= gravityHalfDtSq * t * t;
            points.push(tempPos.clone());
            if (tempPos.y < 0) break;
            t += dt;
        }

        this.trajectoryLine.geometry.setFromPoints(points);
    }

    throwGrenade(onSpawn) {
        if (this.isDead || this.grenadeCount <= 0 || Date.now() - this.lastGrenade < CONFIG.PLAYER.GRENADE.COOLDOWN) return;

        this.grenadeCount--;
        this.lastGrenade = Date.now();
        this.updateUI();

        const spawnPos = this._scratchVecA;
        this.camera.getWorldPosition(spawnPos);
        const velocity = this._scratchVecB.set(0, 0, -1)
            .applyQuaternion(this.camera.quaternion)
            .multiplyScalar(CONFIG.PLAYER.GRENADE.THROW_FORCE);

        if (onSpawn) onSpawn(spawnPos, velocity);
    }

    throwEMP(onSpawn) {
        if (this.isDead || this.empCount <= 0 || Date.now() - this.lastEMP < CONFIG.PLAYER.EMP.COOLDOWN) return;

        this.empCount--;
        this.lastEMP = Date.now();
        this.updateUI();

        const spawnPos = this._scratchVecA;
        this.camera.getWorldPosition(spawnPos);
        const velocity = this._scratchVecB.set(0, 0, -1)
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

        if (weapon.mods[modType] >= 5) return false;

        weapon.mods[modType]++;

        if (modType === 'fireRate') {
            weapon.COOLDOWN *= 0.9;
            if (weapon.system) weapon.system.cooldown = weapon.COOLDOWN;
        } else if (modType === 'reload') {
            weapon.RELOAD_TIME *= 0.9;
        } else if (modType === 'magazine') {
            const increase = Math.ceil(weapon.MAGAZINE_SIZE * 0.2);
            weapon.MAGAZINE_SIZE += increase;
            weapon.magazine += increase;
        } else if (modType === 'damage') {
            weapon.DAMAGE = Math.ceil(weapon.DAMAGE * 1.15);
            if (weapon.system) weapon.system.damage = weapon.DAMAGE;
        }

        this.updateUI();
        return true;
    }

    update(deltaTime, isMoving, mouseDelta, raycastTargets) {
        if (this.isDead) return;
        this.raycastTargets = raycastTargets;

        if (!this.lastCrosshairUpdate) this.lastCrosshairUpdate = 0;
        if (!this.lastUIUpdate) this.lastUIUpdate = 0;
        const now = Date.now();

        if (this.invincibilityTimer > 0) {
            this.invincibilityTimer -= deltaTime;
            if (this.invincibilityTimer <= 0) {
                this.isInvincible = false;
                this.invincibilityTimer = 0;
            }
        }

        if (this.projectedShieldTimer > 0) {
            this.projectedShieldTimer -= deltaTime * 1000;
            if (this.projectedShieldTimer <= 0) {
                this.hasProjectedShield = false;
            }
        }

        if (this.projectedShieldMesh) {
            this.projectedShieldMesh.visible = this.hasProjectedShield || this.isInvincible;
            if (this.projectedShieldMesh.visible) {
                this.projectedShieldMesh.position.copy(this.mesh.position);
                this.projectedShieldMesh.material.uniforms.time.value += deltaTime;
                this.projectedShieldMesh.material.uniforms.isHighFrequency.value = this.isInvincible ? 1.0 : 0.0;

                if (this.projectedShieldMesh.material.uniforms.impactStrength.value > 0) {
                    this.projectedShieldMesh.material.uniforms.impactStrength.value -= deltaTime * 3;
                }
            }
        }

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

        if (this.perkManager) {
            this.perkManager.update(deltaTime);
        }

        if (this.isThermalActive) {
            this.thermalEnergy -= CONFIG.THERMAL.CONSUMPTION_RATE * deltaTime;
            if (this.thermalEnergy <= 0) {
                this.thermalEnergy = 0;
                this.toggleThermal();
            }
        } else {
            this.thermalEnergy = Math.min(CONFIG.THERMAL.MAX_ENERGY, this.thermalEnergy + CONFIG.THERMAL.REGEN_RATE * deltaTime);
        }

        if (this.currentWeaponKey !== 'EXTINGUISHER' || !this.isSpraying) {
            const ext = this.weapons.EXTINGUISHER;
            ext.magazine = Math.min(CONFIG.PLAYER.EXTINGUISHER.CAPACITY, ext.magazine + CONFIG.PLAYER.EXTINGUISHER.REGEN_RATE * deltaTime);
        }

        if (now - this.lastCrosshairUpdate > 100) {
            this.lastCrosshairUpdate = now;
            const crosshair = this.ui.crosshair || document.getElementById('crosshair');
            if (crosshair && this.raycastTargets) {
                this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
                const intersects = this.raycaster.intersectObjects(this.raycastTargets, true);
                let color = 'rgba(0, 255, 170, 0.8)';
                if (intersects.length > 0) {
                    const hit = intersects[0];
                    if (hit.object.userData.enemyRef) {
                        color = 'rgba(255, 68, 0, 0.9)';
                    } else if (hit.object.userData.isBarrel || hit.object.userData.isPipe) {
                        color = 'rgba(255, 255, 0, 0.9)';
                    }
                }
                document.documentElement.style.setProperty('--crosshair-color', color);
            }
        }

        if (now - this.lastUIUpdate > 66) {
            this.lastUIUpdate = now;
            this.updateUI();
        }

        this.updateTrajectory();

        const targetPos = this.isAiming ? this.currentWeapon.aimPos : this.currentWeapon.defaultPos;
        let targetFOV = CONFIG.PLAYER.DEFAULT_FOV;
        if (this.isAiming) {
            if (Array.isArray(this.currentWeapon.ADS_FOV)) {
                targetFOV = this.currentWeapon.ADS_FOV[this.currentWeapon.currentZoomIndex];
            } else {
                targetFOV = this.currentWeapon.ADS_FOV;
            }
        }

        const scopeOverlay = this.ui.scopeOverlay || document.getElementById('scope-overlay');
        const crosshairEl = this.ui.crosshair || document.getElementById('crosshair');
        if (this.currentWeaponKey === 'SNIPER' && this.isAiming) {
            if (scopeOverlay) scopeOverlay.style.display = 'block';
            if (crosshairEl) crosshairEl.style.display = 'none';
            this.currentWeapon.mesh.visible = false;
        } else {
            if (scopeOverlay) scopeOverlay.style.display = 'none';
            if (crosshairEl) crosshairEl.style.display = 'block';
            this.currentWeapon.mesh.visible = true;
        }

        this.currentWeapon.mesh.position.lerp(targetPos, deltaTime * 15);

        if (Math.abs(this.camera.fov - targetFOV) > 0.1) {
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, deltaTime * 15);
            this.camera.updateProjectionMatrix();
        }

        const bobMultiplier = this.isAiming ? 0.2 : 1.0;
        if (isMoving && !this.isReloading) {
            this.bobTime += deltaTime * CONFIG.PLAYER.BOB.SPEED;
            const bobX = Math.cos(this.bobTime) * CONFIG.PLAYER.BOB.AMOUNT * bobMultiplier;
            const bobY = Math.sin(this.bobTime * 2) * CONFIG.PLAYER.BOB.AMOUNT * bobMultiplier;
            this.currentWeapon.mesh.position.x += bobX;
            this.currentWeapon.mesh.position.y += bobY;
        }

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

    getWeaponTint() {
        let tint = 0x00d0ff;

        if (this.currentWeapon.elementalAmmo && this.currentWeapon.elementalAmmo.count > 0) {
            const type = this.currentWeapon.elementalAmmo.type;
            if (type === 'INCENDIARY') return 0xff4400;
            if (type === 'SHOCK') return 0x00ffff;
        }

        if (this.currentWeapon.perks) {
            if (this.currentWeapon.perks.explosiveKills) return 0xff5500;
            if (this.currentWeapon.perks.penetration > 0) return 0x00ffaa;
            if (this.currentWeapon.perks.ricochet) return 0xaaaaff;
        }

        if (this.perks) {
            if (this.perks.vampiric > 0) return 0xff0044;
            if (this.perks.regen > 0) return 0x00ff00;
            if (this.perks.critChance > 0) return 0x00ffff;
        }

        return tint;
    }

    shoot(targetObjects, onDeployTurret) {
        if (this.isDead || this.isReloading || this.isMeleeing || this.currentWeapon.magazine <= 0) return;

        if (this.currentWeaponKey === 'EXTINGUISHER') return;

        if (this.currentWeaponKey === 'TURRET') {
            if (Date.now() - this.lastShot < this.currentWeapon.COOLDOWN) return;

            this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
            const floor = this.scene.getObjectByName('FLOOR');
            if (!floor) return;

            const intersects = this.raycaster.intersectObject(floor, true);
            if (intersects.length > 0) {
                const hit = intersects[0];
                if (hit.distance < 5) {
                    this.currentWeapon.magazine--;
                    this.lastShot = Date.now();
                    const dir = this._scratchVecB.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
                    if (onDeployTurret) onDeployTurret(hit.point, dir, this.currentTurretType);
                    this.updateUI();
                }
            }
            return;
        }

        const currentCooldown = this.perkManager ? this.perkManager.getModifiedFireRate(this.currentWeapon) : this.currentWeapon.COOLDOWN;
        if (Date.now() - this.lastShot < currentCooldown) return;

        this.currentWeapon.magazine--;
        this.lastShot = Date.now();
        this.updateUI();

        const crosshair = this.ui.crosshair || document.getElementById('crosshair');
        if (crosshair) {
            crosshair.style.transform = 'translate(-50%, -50%) scale(1.4)';
            setTimeout(() => {
                crosshair.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 50);
        }

        this.audio.shoot();

        let activeDamageType = 'PLAYER';
        if (this.currentWeapon.elementalAmmo && this.currentWeapon.elementalAmmo.count > 0) {
            activeDamageType = this.currentWeapon.elementalAmmo.type;
            this.currentWeapon.elementalAmmo.count--;
        }

        const baseDamage = this.currentWeapon.DAMAGE;
        let critMultiplier = 1.0;
        let shakeMultiplier = 1.0;

        if (this.perks && this.perks.critChance > 0) {
            if (Math.random() < this.perks.critChance) {
                critMultiplier = 10.0;
                shakeMultiplier = 3.0;
                if (window.game && window.game.dailyChallengeManager) {
                    window.game.dailyChallengeManager.track('headshots');
                }
            }
        }

        const finalDamage = baseDamage * this.damageMultiplier * critMultiplier;

        if (this.onShake) this.onShake(this.currentWeapon.SHAKE * shakeMultiplier);

        const muzzleFlashColor = this.getWeaponTint();

        this.muzzleFlashLight.color.set(muzzleFlashColor);
        this.muzzleFlashLight.intensity = 2 * shakeMultiplier;
        setTimeout(() => {
            this.muzzleFlashLight.intensity = 0;
        }, 40);

        const muzzlePos = this._scratchVecA;
        if (this.currentWeapon.muzzleOffset) {
            muzzlePos.copy(this.currentWeapon.muzzleOffset);
            this.currentWeapon.mesh.localToWorld(muzzlePos);
        } else {
            this.currentWeapon.mesh.getWorldPosition(muzzlePos);
        }

        this.muzzleFlashLight.position.copy(muzzlePos);
        this.camera.worldToLocal(this.muzzleFlashLight.position);

        const shootDir = this._scratchVecB.set(0, 0, -1).applyQuaternion(this.camera.quaternion);

        // Muzzle flash disabled per request

        this.currentWeapon.mesh.position.z += 0.2;
        setTimeout(() => { if (this.currentWeapon) this.currentWeapon.mesh.position.z -= 0.2; }, 50);

        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);

        const maxPenetration = (this.currentWeapon.perks && this.currentWeapon.perks.penetration) || 0;
        let hitsRemaining = 1 + maxPenetration;
        let lastHitPoint = muzzlePos.clone();
        let currentDir = shootDir.clone();

        const processHit = (hit, isRicochet = false) => {
            const hitObject = hit.object;
            const enemy = hitObject.userData.enemyRef;

            this.audio.hit(!!enemy);

            const hm = this.ui.hitmarker || document.getElementById('hitmarker');
            if (hm && enemy) {
                hm.style.display = 'block';
                const lines = hm.querySelectorAll('.hm-line');
                lines.forEach(l => {
                    if (enemy.isDead) l.classList.add('kill');
                    else l.classList.remove('kill');
                });

                setTimeout(() => {
                    hm.style.display = 'none';
                }, 100);
            }

            if (this.particleSystem) {
                const isBarrel = hitObject.userData.isBarrel;
                const isPipe = hitObject.userData.isPipe;
                const isGas = hitObject.userData.isGas;
                const isExt = hitObject.userData.isExtinguisherProp;

                let impactColor = 0xcccccc;
                if (enemy) {
                    if (activeDamageType === 'INCENDIARY' || this.perks.fireBuild) impactColor = 0xff4400;
                    else if (activeDamageType === 'SHOCK' || this.perks.shockBuild) impactColor = 0x00ffff;
                    else if (this.perks.gravityBuild) impactColor = 0x5500ff;
                    else impactColor = 0xff0000;
                } else if (isBarrel) impactColor = 0xffaa00;
                else if (isPipe) impactColor = 0x00ff00;
                else if (isGas) impactColor = 0x88ffaa;
                else if (isExt) impactColor = 0xffffff;

                const normal = hit.face ? hit.face.normal : this._scratchVecC.set(0, 1, 0);
                this.particleSystem.createImpact(hit.point, normal, impactColor);
            }

            if (enemy) {
                let dmg = finalDamage;
                if (this.currentWeapon.perks.shieldBreaker) {
                    if (enemy.type === 'TANK' || enemy.type === 'HEAVY_SEC_BOT' || enemy.type === 'SHIELD_PROJECTOR') {
                        dmg *= 3.0;
                    }
                }

                enemy.takeDamage(dmg, [], activeDamageType);

                if (this.perks.shockBuild || (this.perks.chainBullets && Math.random() < (this.perks.chainChance || 0.5))) {
                    const chainTargets = this.perks.chainTargets || 5;
                    const chainRange = 15;
                    let hits = 0;
                    if (window.game && window.game.enemies) {
                        for (let i = 0; i < window.game.enemies.length && hits < chainTargets; i++) {
                            const e = window.game.enemies[i];
                            if (!e.isDead && e !== enemy && e.mesh.position.distanceTo(enemy.mesh.position) < chainRange) {
                                e.takeDamage(dmg * 0.5, [], 'SHOCK');
                                if (this.particleSystem) {
                                    this.particleSystem.createTracer(enemy.mesh.position, e.mesh.position, 0x00ffff, 1.0);
                                    this.particleSystem.createImpact(e.mesh.position, this._scratchVecC.set(0, 1, 0), 0x00ffff);
                                }
                                hits++;
                            }
                        }
                    }
                }

                if (this.perks.gravityBuild || this.perks.pullOnHit) {
                    const pullRange = 12;
                    if (window.game && window.game.enemies) {
                        if (this.onShake) this.onShake(0.05);
                        for (let i = 0; i < window.game.enemies.length; i++) {
                            const e = window.game.enemies[i];
                            if (!e.isDead && e !== enemy && e.mesh.position.distanceTo(enemy.mesh.position) < pullRange) {
                                const dir = this._scratchVecC.subVectors(enemy.mesh.position, e.mesh.position).normalize();
                                e.mesh.position.add(dir.multiplyScalar(0.5));
                            }
                        }
                    }
                }

                if (this.currentWeaponKey === 'SNIPER' && this.currentWeapon.perks.ammoRecall && Math.random() < 0.5) {
                    this.currentWeapon.magazine = Math.min(this.currentWeapon.MAGAZINE_SIZE, this.currentWeapon.magazine + 1);
                    const ammoEl = this.ui.sniperAmmo || document.getElementById('sniper-ammo');
                    if (ammoEl) {
                        ammoEl.style.color = '#00ffff';
                        ammoEl.style.textShadow = '0 0 10px #00ffff';
                        setTimeout(() => {
                            if (ammoEl) {
                                ammoEl.style.color = '';
                                ammoEl.style.textShadow = '';
                            }
                        }, 200);
                    }
                }

                if (enemy.isDead) {
                    this.score += 100;
                    if (this.perkManager) this.perkManager.handleKill(enemy);
                    if (this.onEnemyKilled) this.onEnemyKilled(enemy);
                    this.updateUI();
                }

                hitsRemaining--;
                lastHitPoint.copy(hit.point);
                return hitsRemaining > 0;
            } else {
                if (hitObject.userData.isBarrel) {
                    hitObject.userData.health -= finalDamage;
                    if (hitObject.userData.health <= 0 && this.onBarrelExplode) this.onBarrelExplode(hitObject);
                } else if (hitObject.userData.isPipe) {
                    if (this.onPipeHit) this.onPipeHit(hitObject, hit.point);
                } else if (hitObject.userData.isGas) {
                    if (this.onGasHit) this.onGasHit(hitObject.userData.gasLeak);
                } else if (hitObject.userData.isExtinguisherProp) {
                    hitObject.userData.health -= finalDamage;
                    if (hitObject.userData.health <= 0 && this.onExtHit) this.onExtHit(hitObject);
                } else if (hitObject.userData.isDestructible) {
                    if (hitObject.userData.parentProp) {
                        const normal = hit.face ? hit.face.normal : this._scratchVecC.set(0, 1, 0);
                        hitObject.userData.parentProp.takeDamage(finalDamage, hit.point, normal);
                        if (hitObject.userData.parentProp.isDead) {
                            this.score += hitObject.userData.parentProp.scoreValue || 0;
                            this.updateUI();
                        }
                    } else {
                        hitObject.userData.health -= finalDamage;
                        if (hitObject.userData.health <= 0 && this.onObjectDestroyed) this.onObjectDestroyed(hitObject);
                    }
                }

                if (this.currentWeaponKey === 'RIFLE' && this.currentWeapon.perks.ricochet && !isRicochet) {
                    const normal = hit.face ? hit.face.normal.clone().applyQuaternion(hitObject.quaternion || this._scratchQuat.identity()) : this._scratchVecC.set(0, 1, 0);
                    currentDir.reflect(normal);
                    lastHitPoint.copy(hit.point);

                    if (this.particleSystem) {
                        this.particleSystem.createExplosion(hit.point, 0xffaa00, 5, 0.5);
                    }

                    this.raycaster.set(lastHitPoint, currentDir);
                    const ricochetIntersects = this.raycaster.intersectObjects(targetObjects, true);
                    if (ricochetIntersects.length > 0) {
                        processHit(ricochetIntersects[0], true);
                    }
                }

                return false;
            }
        };

        const intersects = this.raycaster.intersectObjects(targetObjects, true);
        if (intersects.length > 0) {
            if (maxPenetration > 0) {
                for (let i = 0; i < intersects.length; i++) {
                    if (!processHit(intersects[i])) break;
                }
            } else {
                processHit(intersects[0]);
            }
        }

        if (this.currentWeapon.magazine === 0 && this.currentWeapon.reserve > 0) {
            this.reload();
        }
    }

    secondaryShoot(targetObjects, onDeployTurret, enemies, fireFields, barrels, hazards) {
        if (this.isDead || this.isReloading || this.isMeleeing) return;

        if (this.currentWeaponKey === 'SNIPER') {
            const railConfig = this.currentWeapon.RAIL_SHOT;
            if (!railConfig) return;

            if (Date.now() - this.lastSecondaryShot < railConfig.COOLDOWN) return;

            if (this.isThermalActive) {
                const siphonCost = 25;
                if (this.thermalEnergy < siphonCost) return;

                this.executeRailSiphonShot(targetObjects, railConfig, siphonCost);
            } else {
                if (this.thermalEnergy < railConfig.ENERGY_COST) return;

                this.lastSecondaryShot = Date.now();
                this.thermalEnergy -= railConfig.ENERGY_COST;
                this.updateUI();

                this.executeStandardRailShot(targetObjects, railConfig);
            }
        } else if (this.currentWeaponKey === 'RIFLE') {
            if (!this.isInvincible && !this.hasProjectedShield) return;

            const siphonCooldown = 400;
            if (Date.now() - this.lastSecondaryShot < siphonCooldown) return;

            this.lastSecondaryShot = Date.now();

            if (this.isInvincible) this.invincibilityTimer -= 0.4;
            else if (this.hasProjectedShield) this.projectedShieldTimer -= 400;

            this.executeShieldSiphonShot(targetObjects);
        } else if (this.currentWeaponKey === 'TURRET') {
            if (!this.omegaTurretUnlocked) return;
            const omegaCost = 40;
            if (this.thermalEnergy < omegaCost || this.currentWeapon.magazine <= 0) return;
            if (Date.now() - this.lastSecondaryShot < 2000) return;

            this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
            const floor = this.scene.getObjectByName('FLOOR');
            if (!floor) return;

            const intersects = this.raycaster.intersectObject(floor, true);
            if (intersects.length > 0 && intersects[0].distance < 5) {
                this.lastSecondaryShot = Date.now();
                this.thermalEnergy -= omegaCost;
                this.currentWeapon.magazine--;

                const hit = intersects[0];
                const dir = this._scratchVecB.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
                if (onDeployTurret) onDeployTurret(hit.point, dir, this.currentTurretType, true);

                const turretName = this.currentTurretType === 'LASER' ? 'OMEGA SENTRY' : `OMEGA ${this.currentTurretType}`;
                this.game.showProgressionMessage(`OMEGA PROTOCOL: ${turretName} DEPLOYED`, 2000);
                this.updateUI();
            }
        } else if (this.currentWeaponKey === 'EXTINGUISHER') {
            if (!this.flashFreezeUnlocked) return;
            const freezeCost = 50;
            if (this.currentWeapon.magazine < freezeCost) return;
            if (Date.now() - this.lastSecondaryShot < 5000) return;

            this.lastSecondaryShot = Date.now();
            this.currentWeapon.magazine -= freezeCost;
            this.executeFlashFreeze(enemies, fireFields, barrels, hazards);
            this.updateUI();
        }
    }

    executeFlashFreeze(enemies, fireFields, barrels, hazards) {
        const range = 15;
        const playerPos = this.camera.position;
        const playerForward = this._scratchVecA.set(0, 0, -1).applyQuaternion(this.camera.quaternion);

        if (this.onShake) this.onShake(1.0);

        if (this.particleSystem) {
            const burstPos = playerPos.clone().add(playerForward.clone().multiplyScalar(5));
            this.particleSystem.createLargeCloud(burstPos, 0x00ffff, 15, 6);
            this.particleSystem.createThermalPulse(burstPos, 12, 0x00ffff);
        }

        enemies.forEach(e => {
            if (!e.isDead && !e.isAlly) {
                const toEnemy = this._scratchVecB.subVectors(e.mesh.position, playerPos);
                if (toEnemy.length() < range) {
                    toEnemy.normalize();
                    if (playerForward.dot(toEnemy) > 0.3) {
                        e.applyFreeze(6000);
                        if (this.particleSystem) {
                            this.particleSystem.createExplosion(e.mesh.position, 0x00ffff, 10, 2);
                        }
                    }
                }
            }
        });

        this.spray(0.1, fireFields, barrels, hazards);
        this.game.showProgressionMessage("FLASH FREEZE PROTOCOL INITIATED", 2000);
    }

    executeStandardRailShot(targetObjects, railConfig) {
        const railColor = 0x00ffff;
        if (this.onShake) this.onShake(railConfig.SHAKE);

        this.muzzleFlashLight.color.set(railColor);
        this.muzzleFlashLight.intensity = 5;
        setTimeout(() => this.muzzleFlashLight.intensity = 0, 100);

        const muzzlePos = this._scratchVecA;
        if (this.currentWeapon.muzzleOffset) {
            muzzlePos.copy(this.currentWeapon.muzzleOffset);
            this.currentWeapon.mesh.localToWorld(muzzlePos);
        } else {
            this.currentWeapon.mesh.getWorldPosition(muzzlePos);
        }

        this.muzzleFlashLight.position.copy(muzzlePos);
        this.camera.worldToLocal(this.muzzleFlashLight.position);

        const shootDir = this._scratchVecB.set(0, 0, -1).applyQuaternion(this.camera.quaternion);

        if (this.particleSystem) {
            this.particleSystem.createMuzzleFlash(muzzlePos, shootDir, railColor);
            const maxPoint = muzzlePos.clone().add(shootDir.clone().multiplyScalar(100));
            this.particleSystem.createTracer(muzzlePos, maxPoint, railColor, 3.0);
        }

        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const intersects = this.raycaster.intersectObjects(targetObjects, true);

        let hitCount = 0;
        for (let i = 0; i < intersects.length; i++) {
            const hit = intersects[i];
            const hitObject = hit.object;
            const enemy = hitObject.userData.enemyRef;

            if (enemy) {
                enemy.takeDamage(railConfig.DAMAGE * this.damageMultiplier, [], 'SHOCK');
                if (this.particleSystem) {
                    this.particleSystem.createImpact(hit.point, hit.face ? hit.face.normal : this._scratchVecC.set(0, 1, 0), railColor);
                }
                if (enemy.isDead) {
                    this.score += 200;
                    if (this.onEnemyKilled) this.onEnemyKilled(enemy);
                }
                hitCount++;
                if (hitCount >= railConfig.PENETRATION) break;
            } else if (hitObject.userData.isBarrel || hitObject.userData.isPipe || hitObject.userData.isDestructible) {
                if (hitObject.userData.isBarrel) {
                    if (this.onBarrelExplode) this.onBarrelExplode(hitObject);
                } else if (hitObject.userData.isDestructible) {
                    const normal = hit.face ? hit.face.normal : this._scratchVecC.set(0, 1, 0);
                    if (hitObject.userData.parentProp) {
                        hitObject.userData.parentProp.takeDamage(railConfig.DAMAGE * this.damageMultiplier, hit.point, normal);
                        if (hitObject.userData.parentProp.isDead) {
                            this.score += hitObject.userData.parentProp.scoreValue || 0;
                            this.updateUI();
                        }
                    } else {
                        hitObject.userData.health = 0;
                        if (this.onObjectDestroyed) this.onObjectDestroyed(hitObject);
                    }
                }
            } else break;
        }
        this.audio.shoot();
    }

    executeRailSiphonShot(targetObjects, railConfig, cost) {
        const siphonColor = 0xff00ff;
        this.lastSecondaryShot = Date.now();
        this.thermalEnergy -= cost;
        this.updateUI();

        if (this.onShake) this.onShake(railConfig.SHAKE * 0.7);

        const muzzlePos = this._scratchVecA;
        if (this.currentWeapon.muzzleOffset) {
            muzzlePos.copy(this.currentWeapon.muzzleOffset);
            this.currentWeapon.mesh.localToWorld(muzzlePos);
        } else {
            this.currentWeapon.mesh.getWorldPosition(muzzlePos);
        }

        const shootDir = this._scratchVecB.set(0, 0, -1).applyQuaternion(this.camera.quaternion);

        if (this.particleSystem) {
            this.particleSystem.createMuzzleFlash(muzzlePos, shootDir, siphonColor);
            const maxPoint = muzzlePos.clone().add(shootDir.clone().multiplyScalar(100));
            this.particleSystem.createTracer(muzzlePos, maxPoint, siphonColor, 4.0);
        }

        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const intersects = this.raycaster.intersectObjects(targetObjects, true);

        let hitCount = 0;
        let killCount = 0;
        for (let i = 0; i < intersects.length; i++) {
            const hit = intersects[i];
            const enemy = hit.object.userData.enemyRef;
            if (enemy) {
                enemy.takeDamage(railConfig.DAMAGE * 1.2 * this.damageMultiplier, [], 'SHOCK');
                if (enemy.isDead) {
                    killCount++;
                    this.score += 300;
                    if (this.onEnemyKilled) this.onEnemyKilled(enemy);
                }
                hitCount++;
                if (hitCount >= railConfig.PENETRATION + 2) break;
            } else break;
        }

        if (killCount > 0) {
            this.thermalEnergy = Math.min(CONFIG.THERMAL.MAX_ENERGY, this.thermalEnergy + killCount * 15);
            if (this.particleSystem) {
                this.particleSystem.createExplosion(this.camera.position, siphonColor, 20, 2);
            }
        }

        this.audio.shoot();
    }

    executeShieldSiphonShot(targetObjects) {
        const siphonColor = 0xff0044;
        this.audio.shoot();

        if (this.onShake) this.onShake(0.1);

        const muzzlePos = this._scratchVecA;
        if (this.currentWeapon.muzzleOffset) {
            muzzlePos.copy(this.currentWeapon.muzzleOffset);
            this.currentWeapon.mesh.localToWorld(muzzlePos);
        } else {
            this.currentWeapon.mesh.getWorldPosition(muzzlePos);
        }

        const shootDir = this._scratchVecB.set(0, 0, -1).applyQuaternion(this.camera.quaternion);

        if (this.particleSystem) {
            this.particleSystem.createMuzzleFlash(muzzlePos, shootDir, siphonColor);
            const tracerEnd = muzzlePos.clone().add(shootDir.clone().multiplyScalar(50));
            this.particleSystem.createTracer(muzzlePos, tracerEnd, siphonColor, 2.0);
        }

        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const intersects = this.raycaster.intersectObjects(targetObjects, true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const enemy = hit.object.userData.enemyRef;

            if (enemy) {
                const damage = this.currentWeapon.DAMAGE * 2.0;
                enemy.takeDamage(damage, [], 'PLAYER');

                const healAmt = damage * 0.3;
                this.heal(healAmt);

                if (this.particleSystem) {
                    this.particleSystem.createImpact(hit.point, hit.face ? hit.face.normal : this._scratchVecC.set(0, 1, 0), siphonColor);
                    this.particleSystem.createTracer(hit.point, this.mesh.position, siphonColor, 0.5);
                }

                if (enemy.isDead) {
                    this.score += 150;
                    if (this.onEnemyKilled) this.onEnemyKilled(enemy);
                }
            } else if (this.particleSystem) {
                this.particleSystem.createImpact(hit.point, hit.face ? hit.face.normal : this._scratchVecC.set(0, 1, 0), 0xcccccc);
            }
        }

        this.updateUI();
    }

    melee(enemies) {
        if (this.isDead || this.isMeleeing || Date.now() - this.lastMelee < CONFIG.PLAYER.MELEE.COOLDOWN) return;

        this.isMeleeing = true;
        this.isAiming = false;
        this.lastMelee = Date.now();

        const originalRot = this.currentWeapon.mesh.rotation.clone();
        const originalPos = this.currentWeapon.mesh.position.clone();

        this.currentWeapon.mesh.position.z -= 0.5;
        this.currentWeapon.mesh.position.x -= 0.2;
        this.currentWeapon.mesh.rotation.y += 0.5;
        this.currentWeapon.mesh.rotation.x -= 0.3;

        setTimeout(() => {
            this.currentWeapon.mesh.position.copy(originalPos);
            this.currentWeapon.mesh.rotation.copy(originalRot);
            this.isMeleeing = false;
        }, 200);

        const playerForward = this._scratchVecA.set(0, 0, -1).applyQuaternion(this.camera.quaternion);

        enemies.forEach(enemy => {
            const toEnemy = this._scratchVecB.subVectors(enemy.mesh.position, this.camera.position);
            const distance = toEnemy.length();

            if (distance < CONFIG.PLAYER.MELEE.RANGE) {
                toEnemy.normalize();
                const dot = playerForward.dot(toEnemy);

                if (dot > 0.5) {
                    enemy.takeDamage(CONFIG.PLAYER.MELEE.DAMAGE);

                    if (this.particleSystem) {
                        this.particleSystem.createImpact(enemy.mesh.position, this._scratchVecC.set(0, 1, 0), 0xff0000);
                    }

                    if (enemy.isDead) {
                        this.score += 150;
                        if (this.onEnemyKilled) this.onEnemyKilled(enemy);
                        this.updateUI();
                    }
                }
            }
        });
    }

    spray(deltaTime, fireFields, barrels, hazards = []) {
        if (this.currentWeaponKey !== 'EXTINGUISHER' || this.currentWeapon.magazine <= 0) {
            this.isSpraying = false;
            return;
        }

        this.isSpraying = true;
        this.currentWeapon.magazine -= CONFIG.PLAYER.EXTINGUISHER.EXTINGUISH_RATE * deltaTime;
        this.updateUI();

        if (this.particleSystem && Math.random() < 0.5) {
            const nozzlePos = this._scratchVecA;
            this.currentWeapon.mesh.getWorldPosition(nozzlePos);
            const dir = this._scratchVecB.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
            this.particleSystem.createExplosion(nozzlePos.add(dir.multiplyScalar(0.5)), 0xffffff, 2, 5);
        }

        const playerPos = this.camera.position;
        const playerForward = this._scratchVecA.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const range = CONFIG.PLAYER.EXTINGUISHER.RANGE;
        const cone = CONFIG.PLAYER.EXTINGUISHER.CONE;

        fireFields.forEach(fire => {
            const toFire = this._scratchVecB.subVectors(fire.position, playerPos);
            if (toFire.length() < range) {
                toFire.normalize();
                if (playerForward.dot(toFire) > cone) {
                    fire.duration -= deltaTime * 1000 * 5;
                }
            }
        });

        barrels.forEach(barrel => {
            const toBarrel = this._scratchVecB.subVectors(barrel.position, playerPos);
            if (toBarrel.length() < range) {
                toBarrel.normalize();
                if (playerForward.dot(toBarrel) > cone) {
                    barrel.userData.isBarrel = false;
                    barrel.material.color.set(0x00ff00);
                    barrel.material.emissive.set(0x002200);
                }
            }
        });

        hazards.forEach(hazard => {
            if (hazard.triggerMesh && hazard.triggerMesh.userData.isCryoVent) {
                const toVent = this._scratchVecB.subVectors(hazard.position, playerPos);
                if (toVent.length() < range) {
                    toVent.normalize();
                    if (playerForward.dot(toVent) > cone) {
                        hazard.freeze();
                    }
                }
            }
        });
    }

    takeDamage(amount, isDOT = false, type = 'PLAYER') {
        if (this.isDead || this.isPhased) return;

        if (this.isInvincible) {
            if (this.perks && this.perks.explosiveBullets && !isDOT) {
                if (window.game && window.game.handleAreaDamage) {
                    const pos = this._scratchVecA.copy(this.mesh.position);
                    window.game.handleAreaDamage(pos, 8, 150);
                    if (this.particleSystem) {
                        this.particleSystem.createExplosion(pos, 0xffaa00, 50, 8);
                    }
                    if (this.onShake) this.onShake(1.5);
                }
            }

            if (this.perks && this.perks.vampiric > 0 && !isDOT) {
                const healAmount = amount * 0.5;
                this.heal(healAmount);
                if (this.particleSystem) {
                    this.particleSystem.createExplosion(this.mesh.position, 0xff0044, 10, 2);
                }
            }

            if (this.perks && this.perks.chainBullets && !isDOT) {
                if (window.game && window.game.enemies) {
                    const pos = this._scratchVecA.copy(this.mesh.position);
                    let hits = 0;
                    for (let i = 0; i < window.game.enemies.length && hits < 5; i++) {
                        const enemy = window.game.enemies[i];
                        if (!enemy.isDead && enemy.mesh.position.distanceTo(pos) < 12) {
                            enemy.takeDamage(80, [], 'SHOCK');
                            if (this.particleSystem) {
                                this.particleSystem.createTracer(pos, enemy.mesh.position, 0x00ffff, 2.0);
                                this.particleSystem.createImpact(enemy.mesh.position, this._scratchVecC.set(0, 1, 0), 0x00ffff);
                            }
                            hits++;
                        }
                    }
                }
            }

            if (this.projectedShieldMesh && this.projectedShieldMesh.material.uniforms) {
                this.projectedShieldMesh.material.uniforms.impactStrength.value = 1.0;
                this.projectedShieldMesh.material.uniforms.impactPos.value.set(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2
                ).normalize().multiplyScalar(1.5);
            }
            return;
        }

        let finalAmount = amount;
        if (this.hasProjectedShield && !isDOT) {
            finalAmount *= 0.25;

            if (this.projectedShieldMesh && this.projectedShieldMesh.material.uniforms) {
                this.projectedShieldMesh.material.uniforms.impactStrength.value = 1.0;
                this.projectedShieldMesh.material.uniforms.impactPos.value.set(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2
                ).normalize().multiplyScalar(1.5);
            }

            document.body.style.backgroundColor = 'rgba(0, 255, 255, 0.2)';
        }

        const now = Date.now();
        if (!isDOT && now - this.lastDamageTime < CONFIG.PLAYER.INVULNERABILITY_DURATION) return;

        if (!isDOT) this.lastDamageTime = now;

        this.health -= finalAmount;
        this.updateUI();

        let flashColor = 'rgba(255, 0, 0, 0.3)';
        if (typeof type === 'string') {
            if (type.startsWith('rgb')) flashColor = type;
            else if (type === 'SHOCK') flashColor = 'rgba(0, 255, 255, 0.3)';
        }

        if (!isDOT || amount > 5) {
            if (this.onShake) this.onShake(CONFIG.PLAYER.DAMAGE_SHAKE);
            document.body.style.backgroundColor = flashColor;
            setTimeout(() => {
                if (!this.isDead) document.body.style.backgroundColor = 'black';
            }, 100);
        } else {
            const dotColor = flashColor.includes('rgba')
                ? flashColor.replace(/[^,]+\)$/, ' 0.05)')
                : flashColor.replace('rgb', 'rgba').replace(')', ', 0.05)');

            document.body.style.backgroundColor = dotColor;
            setTimeout(() => {
                if (!this.isDead && document.body.style.backgroundColor.includes('0.05')) {
                    document.body.style.backgroundColor = 'black';
                }
            }, 50);
        }

        if (this.health <= 0) {
            this.die();
        } else if (amount > 30 && Math.random() < 0.2) {
            if (this.scene.game && this.scene.game.triggerNeuralLinkMalfunction) {
                this.scene.game.triggerNeuralLinkMalfunction();
            }
        } else if (this.perkManager) this.perkManager.handleDamageTaken();
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

        const flashColor = type === 'RIFLE' ? 'rgba(255, 170, 0, 0.2)' : 'rgba(0, 170, 255, 0.2)';
        document.body.style.backgroundColor = flashColor;
        setTimeout(() => document.body.style.backgroundColor = 'black', 100);
    }

    reload() {
        if (this.isDead || this.isReloading || this.currentWeapon.magazine === this.currentWeapon.MAGAZINE_SIZE || this.currentWeapon.reserve <= 0) return;

        this.isReloading = true;
        this.isAiming = false;
        this.updateUI();
        this.audio.reload();

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
        const healthVal = Math.max(0, Math.floor(this.health));
        const rifleMag = this.weapons.RIFLE.magazine;
        const rifleRes = this.weapons.RIFLE.reserve;
        const sniperMag = this.weapons.SNIPER.magazine;
        const sniperRes = this.weapons.SNIPER.reserve;
        const score = this.score;
        const scrap = window.game ? window.game.scrap : 0;
        const cores = window.game ? window.game.techCores : 0;
        const thermal = Math.floor(this.thermalEnergy);
        const rifleModHash = (this.weapons.RIFLE.mods.damage || 0) + (this.weapons.RIFLE.mods.fireRate || 0) + (this.weapons.RIFLE.mods.magazine || 0) + (this.weapons.RIFLE.mods.reload || 0);
        const sniperModHash = (this.weapons.SNIPER.mods.damage || 0) + (this.weapons.SNIPER.mods.fireRate || 0) + (this.weapons.SNIPER.mods.magazine || 0) + (this.weapons.SNIPER.mods.reload || 0);

        const healthEl = this.ui.healthVal || document.getElementById('health-val');
        if (healthEl && this.lastUIValues.health !== healthVal) {
            healthEl.innerText = healthVal;
            this.lastUIValues.health = healthVal;
        }

        const grenadeEl = this.ui.grenadeCount || document.getElementById('grenade-count');
        if (grenadeEl && (this.lastUIValues.grenades !== this.grenadeCount || this.lastUIValues.emps !== this.empCount)) {
            grenadeEl.innerText = `F:${this.grenadeCount} E:${this.empCount}`;
            this.lastUIValues.grenades = this.grenadeCount;
            this.lastUIValues.emps = this.empCount;
        }

        const rifleAmmoEl = this.ui.ammo || document.getElementById('rifle-ammo');
        if (rifleAmmoEl && (this.lastUIValues.rifleMag !== rifleMag || this.lastUIValues.rifleRes !== rifleRes)) {
            rifleAmmoEl.innerText = `${rifleMag} / ${rifleRes}${this.weapons.RIFLE.elementalAmmo.count > 0 ? ' [' + this.weapons.RIFLE.elementalAmmo.count + ']' : ''}`;
            this.lastUIValues.rifleMag = rifleMag;
            this.lastUIValues.rifleRes = rifleRes;
            this.updateAmmoIcon('RIFLE');
            this.updateModHUD('RIFLE', rifleModHash);
        }

        const sniperAmmoEl = this.ui.sniperAmmo || document.getElementById('sniper-ammo');
        if (sniperAmmoEl && (this.lastUIValues.sniperMag !== sniperMag || this.lastUIValues.sniperRes !== sniperRes)) {
            sniperAmmoEl.innerText = `${sniperMag} / ${sniperRes}${this.weapons.SNIPER.elementalAmmo.count > 0 ? ' [' + this.weapons.SNIPER.elementalAmmo.count + ']' : ''}`;
            this.lastUIValues.sniperMag = sniperMag;
            this.lastUIValues.sniperRes = sniperRes;
            this.updateAmmoIcon('SNIPER');
            this.updateModHUD('SNIPER', sniperModHash);
        }

        const extAmmoEl = this.ui.extAmmo || document.getElementById('ext-ammo');
        if (extAmmoEl) extAmmoEl.innerText = `${Math.floor(this.weapons.EXTINGUISHER.magazine)}%`;

        const turretAmmoEl = this.ui.turretAmmo || document.getElementById('turret-ammo');
        if (turretAmmoEl) turretAmmoEl.innerText = `${this.weapons.TURRET.magazine} [${this.currentTurretType}]`;

        const rifleSlot = this.ui.slotRifle || document.getElementById('slot-rifle');
        const sniperSlot = this.ui.slotSniper || document.getElementById('slot-sniper');
        const extSlot = this.ui.slotExt || document.getElementById('slot-ext');
        const turretSlot = this.ui.slotTurret || document.getElementById('slot-turret');
        const thermalSlot = this.ui.thermalSlot || document.getElementById('thermal-slot');

        if (rifleSlot) rifleSlot.classList.toggle('active', this.currentWeaponKey === 'RIFLE');
        if (sniperSlot) sniperSlot.classList.toggle('active', this.currentWeaponKey === 'SNIPER');
        if (extSlot) extSlot.classList.toggle('active', this.currentWeaponKey === 'EXTINGUISHER');
        if (turretSlot) turretSlot.classList.toggle('active', this.currentWeaponKey === 'TURRET');

        const thermalValEl = this.ui.thermalVal || document.getElementById('thermal-val');
        const thermalBarEl = this.ui.thermalBar || document.getElementById('thermal-bar');
        if (thermalValEl && this.lastUIValues.thermal !== thermal) {
            thermalValEl.innerText = `${thermal}%`;
            if (thermalBarEl) thermalBarEl.style.width = `${thermal}%`;
            this.lastUIValues.thermal = thermal;
        }
        if (thermalSlot) thermalSlot.classList.toggle('active', this.isThermalActive);

        const scoreEl = this.ui.scoreVal || document.getElementById('score-val');
        if (scoreEl && this.lastUIValues.score !== score) {
            scoreEl.innerText = score;
            this.lastUIValues.score = score;
        }

        const coresEl = this.ui.coresVal || document.getElementById('cores-val');
        if (coresEl && this.lastUIValues.cores !== cores) {
            coresEl.innerText = cores;
            this.lastUIValues.cores = cores;
        }

        const scrapHUD = this.ui.scrapVal || document.getElementById('scrap-val');
        if (scrapHUD && this.lastUIValues.scrap !== scrap) {
            scrapHUD.innerText = scrap;
            this.lastUIValues.scrap = scrap;
        }
    }

    updateAmmoIcon(weaponKey) {
        const weapon = this.weapons[weaponKey];
        const iconEl = weaponKey === 'RIFLE'
            ? (this.ui.rifleAmmoIcon || document.getElementById('rifle-ammo-icon'))
            : (this.ui.sniperAmmoIcon || document.getElementById('sniper-ammo-icon'));
        if (!iconEl) return;

        if (weapon.elementalAmmo && weapon.elementalAmmo.count > 0) {
            const type = weapon.elementalAmmo.type;
            let src = '';
            let color = '';

            if (type === 'INCENDIARY') {
                src = this.assetUrls.AMMO_INCENDIARY;
                color = '#ff4400';
            } else if (type === 'SHOCK') {
                src = this.assetUrls.AMMO_SHOCK;
                color = '#00ffff';
            }

            if (src) {
                iconEl.src = src;
                iconEl.style.display = 'block';
                iconEl.style.color = color;
            } else {
                iconEl.style.display = 'none';
            }
        } else {
            iconEl.style.display = 'none';
        }
    }

    updateModHUD(weaponKey, modHash) {
        const weapon = this.weapons[weaponKey];
        const container = weaponKey === 'RIFLE' ? (this.ui.rifleMods || document.getElementById('rifle-mods')) : (this.ui.sniperMods || document.getElementById('sniper-mods'));
        if (!container || !weapon.mods) return;

        const lastHashKey = `${weaponKey.toLowerCase()}ModHash`;
        const lastHash = this.lastUIValues[lastHashKey] || 0;
        if (modHash === lastHash) return;
        this.lastUIValues[lastHashKey] = modHash;

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
    }
}
