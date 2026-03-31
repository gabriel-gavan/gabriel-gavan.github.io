import * as THREE from 'three';
import { HealthPack } from './HealthPack.js';
import { AmmoCrate } from './AmmoCrate.js';
import { CreditChip } from './CreditChip.js';
import { DataCore } from './DataCore.js';

const _tmpLootPos = new THREE.Vector3();
const _tmpLootDir = new THREE.Vector3();
const _legendaryTypes = ['BLACK_HOLE_CORE', 'INFINITE_AMMO', 'AUTO_DRONE_ARMY', 'TIME_SLOW_AURA', 'CHAIN_EXPLOSION'];
const _rareTypes = ['REPAIR_BOT', 'SHIELD_REFRESH', 'AMMO_PACK_LARGE'];

export class LootManager {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.particleSystem = game.particleSystem;
        this._legendaryResetTimeout = null;
    }

    handleEnemyDeath(enemy) {
        _tmpLootPos.copy(enemy.mesh.position);
        const rand = Math.random();

        // 2% Legendary
        if (rand < 0.02) {
            this.spawnLegendaryLoot(_tmpLootPos);
        } 
        // 10% Rare
        else if (rand < 0.12) {
            this.spawnRareLoot(_tmpLootPos);
        }
        // Normal drops (Ammo/Health/Credits)
        else if (rand < 0.4) {
            this.spawnNormalLoot(_tmpLootPos);
        }
    }

    spawnLegendaryLoot(pos) {
        const type = _legendaryTypes[Math.floor(Math.random() * _legendaryTypes.length)];
        this.createLootPickup(pos, type, 'LEGENDARY');
    }

    spawnRareLoot(pos) {
        const type = _rareTypes[Math.floor(Math.random() * _rareTypes.length)];
        this.createLootPickup(pos, type, 'RARE');
    }

    spawnNormalLoot(pos) {
        const rand = Math.random();
        if (rand < 0.3) {
            const pack = new HealthPack(this.scene, pos);
            this.game.pickups.push(pack);
        } else if (rand < 0.6) {
            const crate = new AmmoCrate(this.scene, pos);
            this.game.pickups.push(crate);
        } else {
            const chip = new CreditChip(this.scene, pos, 50);
            this.game.pickups.push(chip);
        }
    }

    createLootPickup(pos, type, rarity) {
        // Simple visual for special loot since we don't have dedicated classes for all yet
        const color = rarity === 'LEGENDARY' ? 0xffd700 : 0x00ffff;
        const geo = new THREE.IcosahedronGeometry(0.5, 1);
        const mat = new THREE.MeshStandardMaterial({ 
            color: color, 
            emissive: color, 
            emissiveIntensity: 2,
            transparent: true,
            opacity: 0.8
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.position.y = 1;
        mesh.userData.isLoot = true;
        mesh.userData.lootType = type;
        mesh.userData.rarity = rarity;
        
        this.scene.add(mesh);
        
        // Add to game's pickups for collection logic
        const pickup = {
            mesh: mesh,
            type: type,
            rarity: rarity,
            isCollected: false,
            update: (dt, playerPos) => {
                if (pickup.isCollected) return;
                mesh.rotation.y += dt * 2;
                mesh.position.y = 1 + Math.sin(Date.now() * 0.005) * 0.2;
                
                // Collection check
                if (playerPos) {
                    const dist = mesh.position.distanceTo(playerPos);
                    
                    // Magnetic pull if close
                    if (dist < 6.0) {
                        const pullSpeed = 15.0;
                        _tmpLootDir.subVectors(playerPos, mesh.position).normalize();
                        mesh.position.add(_tmpLootDir.multiplyScalar(dt * pullSpeed));
                    }

                    if (dist < 1.8) {
                        pickup.isCollected = true;
                    }
                }
            },
            collect: () => {
                this.applyLootEffect(type, rarity, mesh.position.clone());
                if (this.particleSystem) {
                    this.particleSystem.createExplosion(mesh.position, color, 40, 4);
                }
            },
            destroy: () => {
                this.scene.remove(mesh);
            }
        };
        this.game.pickups.push(pickup);

        // Legendary Glow
        if (rarity === 'LEGENDARY') {
            const light = new THREE.PointLight(color, 10, 10);
            mesh.add(light);
        }
    }

    applyLootEffect(type, rarity, customPos = null) {
        const game = this.game;
        const player = game.player;

        if (!customPos) {
            game.showProgressionMessage(`${rarity} PICKUP: ${type.replace('_', ' ')}`, 4000);
        }
        
        // Intense screen feedback for legendaries
        if (rarity === 'LEGENDARY' && !customPos) {
            game.shakeAmount += 2.0;
            if (game.heatVisuals) game.heatVisuals.glitchIntensity = 0.8;
            if (this._legendaryResetTimeout) clearTimeout(this._legendaryResetTimeout);
            this._legendaryResetTimeout = setTimeout(() => {
                if (game.heatVisuals && !game.insaneMomentActive) game.heatVisuals.glitchIntensity = 0;
                this._legendaryResetTimeout = null;
            }, 800);
            
            // "Insane Moment" trigger
            if (game.triggerInsaneMoment) game.triggerInsaneMoment('LEGENDARY_PICKUP');
        }

        if (game.successSynth && !customPos) {
            game.successSynth.triggerAttackRelease(rarity === 'LEGENDARY' ? "C6" : "G5", "4n");
        }

        switch(type) {
            case 'BLACK_HOLE_CORE':
                const corePos = customPos || player.mesh.position.clone();
                // Gravity Build mini-holes are smaller and shorter
                const isMini = !!customPos;
                const duration = isMini ? 2000 : 5000;
                const range = isMini ? 12 : 25;
                const force = isMini ? 0.4 : 0.8;

                // Create visual black hole mesh
                const bhGeo = new THREE.SphereGeometry(isMini ? 0.5 : 1.5, 32, 32);
                const bhMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
                const bhMesh = new THREE.Mesh(bhGeo, bhMat);
                bhMesh.position.copy(corePos);
                game.scene.add(bhMesh);
                
                // Pulsating core effect
                const outerGeo = new THREE.SphereGeometry(isMini ? 0.8 : 2.5, 32, 32);
                const outerMat = new THREE.MeshBasicMaterial({ color: 0x5500ff, transparent: true, opacity: 0.3 });
                const outerMesh = new THREE.Mesh(outerGeo, outerMat);
                bhMesh.add(outerMesh);

                // Sound spike: deep bass
                if (game.detonateSynth) {
                    game.detonateSynth.triggerAttackRelease(isMini ? "C2" : "C1", isMini ? "2n" : "1n");
                }

                // Register singularity for particle system
                if (!game.activeSingularities) game.activeSingularities = new Map();
                const singularityId = Math.random().toString(36).substr(2, 9);
                game.activeSingularities.set(singularityId, { pos: corePos, range, force });

                let scale = 0.1;
                const blackHoleInterval = setInterval(() => {
                    scale += isMini ? 0.02 : 0.05;
                    bhMesh.scale.set(scale, scale, scale);
                    outerMesh.scale.setScalar(1.2 + Math.sin(Date.now() * 0.01) * 0.2);
                    
                    // Visual Chaos: Continuous shake and aberration while pulling
                    if (game.heatVisuals) {
                        game.heatVisuals.glitchIntensity = Math.max(game.heatVisuals.glitchIntensity, isMini ? 0.3 : 0.8);
                    }
                    game.shakeAmount = Math.max(game.shakeAmount, isMini ? 0.4 : 1.2);
                    game.saturation = Math.max(game.saturation, isMini ? 1.2 : 1.8);

                    const enemies = game.enemies;
                    for (let i = 0, len = enemies.length; i < len; i++) {
                        const e = enemies[i];
                        if (!e.isDead && e.mesh.position.distanceTo(corePos) < range) {
                            _tmpLootDir.subVectors(corePos, e.mesh.position).normalize();
                            e.mesh.position.add(_tmpLootDir.multiplyScalar(force));
                        }
                    }
                }, 50);

                setTimeout(() => {
                    clearInterval(blackHoleInterval);
                    game.activeSingularities.delete(singularityId);
                    game.scene.remove(bhMesh);
                    
                    // Reset glitch after hole collapses
                    if (game.heatVisuals && !game.insaneMomentActive) {
                        game.heatVisuals.glitchIntensity = 0;
                    }

                    // Massive explosion at the end
                    game.handleAreaDamage(corePos, range * 0.8, isMini ? 200 : 1000);
                    if (game.particleSystem) {
                        game.particleSystem.createExplosion(corePos, 0x5500ff, isMini ? 50 : 200, isMini ? 4 : 12);
                        game.particleSystem.createThermalPulse(corePos, range, 0x5500ff);
                    }
                    game.shakeAmount += isMini ? 1.5 : 5.0;
                    
                    if (game.detonateSynth) {
                        game.detonateSynth.triggerAttackRelease(isMini ? "G1" : "C0", "1n");
                    }
                }, duration);
                break;
            case 'INFINITE_AMMO':
                player.perks.infiniteAmmo = true;
                const currentWeapon = player.weapons[player.currentWeaponKey];
                currentWeapon.DAMAGE *= 2.0; 
                currentWeapon.FIRE_RATE_MOD = 0.3; // Insane fire rate
                setTimeout(() => { 
                    player.perks.infiniteAmmo = false; 
                    currentWeapon.DAMAGE /= 2.0;
                    currentWeapon.FIRE_RATE_MOD = 1.0;
                }, 10000);
                break;
            case 'AUTO_DRONE_ARMY':
                for (let i = 0; i < 8; i++) game.spawnAllyDrone(); // Spawn 8 drones!
                break;
            case 'TIME_SLOW_AURA':
                player.perks.timeSlowAura = true;
                setTimeout(() => { player.perks.timeSlowAura = false; }, 20000);
                break;
            case 'CHAIN_EXPLOSION':
                player.perks.chainExplosions = true;
                player.perks.explosiveBullets = true; // Every shot explodes too
                setTimeout(() => { player.perks.chainExplosions = false; }, 20000);
                break;
            case 'REPAIR_BOT':
                player.heal(150);
                break;
            case 'SHIELD_REFRESH':
                player.hasProjectedShield = true;
                player.projectedShieldTimer = 25000;
                break;
            case 'AMMO_PACK_LARGE':
                player.replenishAmmo('RIFLE');
                player.replenishAmmo('SNIPER');
                break;
        }
    }
}
