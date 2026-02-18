import * as THREE from 'three';
import { CONFIG } from './config.js';
import { MicroDrone } from './MicroDrone.js';

export class Enemy {
    constructor(scene, player, position, type = 'SENTRY', facilityId = 'meridian') {
        this.scene = scene;
        this.player = player;
        this.type = type;
        this.facilityId = facilityId;
        
        const stats = CONFIG.ENEMY.TYPES[this.type];
        this.health = stats.HEALTH;
        this.maxHealth = stats.HEALTH;
        this.damage = stats.DAMAGE;
        this.moveSpeed = stats.SPEED;
        this.attackRange = stats.RANGE;
        this.scoreValue = stats.SCORE;

        // Facility-specific enemy modifiers
        if (this.facilityId === 'neon') {
            // Neon-Shift enemies are built with high-tech stealth
            this.isCloaked = true;
            this.cloakRevealRange = 8; // Reveals when player is close
            this.cloakActionRange = 12; // Uncloaks to strike
        }

        this.mesh = this.createMesh();
        this.mesh.position.copy(position);
        this.mesh.position.y = this.type === 'STALKER' ? 0.5 : 1.5; 
        
        this.scene.add(this.mesh);
        this.isDead = false;
        this.isAlly = false;
        this.lastAttack = 0;
        this.isDisabled = false;
        this.disableTimer = 0;
        this.targetEnemy = null;
        this.onDeath = null; // Callback for special death effects
        
        // Command State
        this.command = 'FOLLOW'; // FOLLOW, MOVE_TO, GUARD
        this.commandPos = new THREE.Vector3();

        // Module State
        this.modules = []; // ['SHIELD', 'RAPID_FIRE', 'HEAVY_LASER', 'REPAIR', 'CLOAK', 'EMP_BURST', 'SELF_DESTRUCT', 'CHAIN_LIGHTNING', 'SWARM', 'REPAIR_FIELD', 'OVERCLOCK', 'GRAVITY_SINGULARITY', 'VOLATILE_DETONATION', 'KINETIC_CHAIN', 'MAGNETIC_SIPHON', 'SINGULARITY_ECHO', 'GRAVITY_WELL', 'CRUSHING_PRESSURE', 'SINGULARITY_COLLAPSE', 'NEUTRON_FLUX', 'GAMMA_BURST']
        this.shieldHealth = 0;
        this.maxShieldHealth = 20;
        this.isCloaked = false;
        this.empBurstTimer = 0;
        this.singularityTimer = 0;
        this.kineticChainTimer = 0;
        this.wasSingularityActive = false;
        this.wasEchoActive = false;
        this.gravityWellFactor = 1.0;
        this.timeScale = 1.0; 
        this.isPhased = false; 
        this.resonanceOwner = null; // Track which drone singularity we're in
        this.isResonating = false; // Prevents recursive resonance
        this.microDrones = [];
        this.onSingularityDetonate = null; // Callback for detonation module
        
        // Elemental State
        this.burnTimer = 0;
        this.burnDamage = 0;
        this.shockTimer = 0;
        this.lastShockChain = 0;

        // Adaptive Shielding for Heavy Sec-Bot
        if (this.type === 'HEAVY_SEC_BOT') {
            this.adaptiveResistances = {
                'LASER': 0,
                'EMP': 0,
                'SLOW': 0,
                'PLAYER': 0
            };
            this.currentShieldType = null;
            this.shieldMesh = this.createAdaptiveShieldMesh();
            this.mesh.add(this.shieldMesh);
            this.bossPhase = 1;
        }
    }

    createAdaptiveShieldMesh() {
        const geo = new THREE.SphereGeometry(1.5, 32, 32);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0, 
            wireframe: true 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        return mesh;
    }

    applyModule(moduleType) {
        if (!this.modules.includes(moduleType)) {
            this.modules.push(moduleType);
            
            if (moduleType === 'SHIELD') {
                this.shieldHealth = this.maxShieldHealth;
            }
            if (moduleType === 'CLOAK') {
                this.isCloaked = true;
            }
            if (moduleType === 'SWARM') {
                this.spawnSwarm();
            }
            this.updateModuleVisuals();
        }
    }

    spawnSwarm() {
        const count = 4;
        for (let i = 0; i < count; i++) {
            this.microDrones.push(new MicroDrone(this.scene, this.player, i, count));
        }
    }

    updateModuleVisuals() {
        // Clear old module meshes if any
        const moduleGroup = this.mesh.getObjectByName('moduleGroup');
        if (moduleGroup) this.mesh.remove(moduleGroup);

        const newGroup = new THREE.Group();
        newGroup.name = 'moduleGroup';

        this.modules.forEach((mod, index) => {
            let modMesh;
            if (mod === 'SHIELD') {
                const geo = new THREE.SphereGeometry(1.2, 16, 16);
                const mat = new THREE.MeshBasicMaterial({ 
                    color: 0x00ffff, 
                    transparent: true, 
                    opacity: 0.2, 
                    wireframe: true 
                });
                modMesh = new THREE.Mesh(geo, mat);
            } else if (mod === 'RAPID_FIRE') {
                const geo = new THREE.BoxGeometry(0.2, 0.2, 0.6);
                const mat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.set(0.6, -0.4, 0.4);
            } else if (mod === 'HEAVY_LASER') {
                const geo = new THREE.CylinderGeometry(0.1, 0.1, 0.8);
                const mat = new THREE.MeshStandardMaterial({ color: 0xff00ff });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.rotation.x = Math.PI / 2;
                modMesh.position.set(-0.6, -0.4, 0.4);
            } else if (mod === 'REPAIR') {
                const geo = new THREE.TorusGeometry(0.3, 0.05, 8, 24);
                const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.y = 0.8;
                modMesh.rotation.x = Math.PI / 2;
            } else if (mod === 'CLOAK') {
                const geo = new THREE.RingGeometry(0.7, 0.8, 16);
                const mat = new THREE.MeshBasicMaterial({ color: 0x8888ff, transparent: true, opacity: 0.5 });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.y = -0.5;
                modMesh.rotation.x = -Math.PI / 2;
            } else if (mod === 'EMP_BURST') {
                const geo = new THREE.IcosahedronGeometry(0.3, 1);
                const mat = new THREE.MeshStandardMaterial({ color: 0x00ffff, wireframe: true });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.y = -0.7;
            } else if (mod === 'SELF_DESTRUCT') {
                const geo = new THREE.SphereGeometry(0.2, 8, 8);
                const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.z = -0.4;
                modMesh.name = 'destruct_core';
            } else if (mod === 'CHAIN_LIGHTNING') {
                const geo = new THREE.DodecahedronGeometry(0.2);
                const mat = new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x0055ff });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.set(0, 0.4, -0.4);
            } else if (mod === 'SWARM') {
                const geo = new THREE.TorusKnotGeometry(0.2, 0.05, 32, 8);
                const mat = new THREE.MeshStandardMaterial({ color: 0x00ffff });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.set(0, -0.5, -0.6);
            } else if (mod === 'REPAIR_FIELD') {
                const geo = new THREE.OctahedronGeometry(0.25, 1);
                const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x004400 });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.y = 1.0;
                modMesh.name = 'repair_emitter';
                
                // Pulsing field visual
                const fieldGeo = new THREE.SphereGeometry(5, 32, 32);
                const fieldMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.05, wireframe: true });
                const field = new THREE.Mesh(fieldGeo, fieldMat);
                field.name = 'repair_visual_field';
                modMesh.add(field);
            } else if (mod === 'OVERCLOCK') {
                const geo = new THREE.ConeGeometry(0.2, 0.4, 4);
                const mat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0x442200 });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.set(0, 0.6, 0.5);
                modMesh.rotation.x = Math.PI / 2;
                modMesh.name = 'overclock_emitter';

                // Field visual
                const fieldGeo = new THREE.SphereGeometry(6, 16, 16);
                const fieldMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.05, wireframe: true });
                const field = new THREE.Mesh(fieldGeo, fieldMat);
                field.name = 'overclock_visual_field';
                modMesh.add(field);
            } else if (mod === 'GRAVITY_SINGULARITY') {
                const geo = new THREE.IcosahedronGeometry(0.3, 2);
                const mat = new THREE.MeshStandardMaterial({ 
                    color: 0x6600ff, 
                    emissive: 0x220055,
                    wireframe: true 
                });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.set(0, -0.6, 0);
                modMesh.name = 'singularity_core';
                
                // Vortex particles
                const particleCount = 20;
                const particleGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
                const particleMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff });
                const particles = new THREE.Group();
                particles.name = 'singularity_particles';
                for (let i = 0; i < particleCount; i++) {
                    const p = new THREE.Mesh(particleGeo, particleMat);
                    const angle = (i / particleCount) * Math.PI * 2;
                    const r = 0.5 + Math.random() * 0.5;
                    p.position.set(Math.cos(angle) * r, Math.sin(angle) * r, (Math.random() - 0.5) * 0.5);
                    particles.add(p);
                }
                modMesh.add(particles);
            } else if (mod === 'VOLATILE_DETONATION') {
                const geo = new THREE.SphereGeometry(0.2, 8, 8);
                const mat = new THREE.MeshBasicMaterial({ color: 0xff4400, wireframe: true });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.y = -0.6;
                modMesh.name = 'volatile_spike';
                
                // Add spikes
                for (let i = 0; i < 6; i++) {
                    const spikeGeo = new THREE.ConeGeometry(0.05, 0.3, 4);
                    const spikeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                    const spike = new THREE.Mesh(spikeGeo, spikeMat);
                    const axis = new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize();
                    spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
                    spike.position.copy(axis).multiplyScalar(0.2);
                    modMesh.add(spike);
                }
            } else if (mod === 'KINETIC_CHAIN') {
                const geo = new THREE.TorusGeometry(0.4, 0.02, 8, 32);
                const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.y = -0.6;
                modMesh.rotation.x = Math.PI / 2;
                modMesh.name = 'kinetic_ring';
            } else if (mod === 'MAGNETIC_SIPHON') {
                const geo = new THREE.TorusGeometry(0.5, 0.01, 8, 32);
                const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.y = -0.6;
                modMesh.rotation.x = Math.PI / 2;
                modMesh.name = 'siphon_ring';
            } else if (mod === 'SINGULARITY_ECHO') {
                const geo = new THREE.IcosahedronGeometry(0.15, 1);
                const mat = new THREE.MeshBasicMaterial({ color: 0x8800ff, transparent: true, opacity: 0.6 });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.set(0.3, -0.4, -0.3);
                modMesh.name = 'echo_core';
            } else if (mod === 'GRAVITY_WELL') {
                const geo = new THREE.CylinderGeometry(0.35, 0.45, 0.1, 6);
                const mat = new THREE.MeshStandardMaterial({ color: 0x4444ff, emissive: 0x000033 });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.y = -0.75;
                modMesh.name = 'gravity_well_plate';
            } else if (mod === 'CRUSHING_PRESSURE') {
                const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
                const mat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 1.0 });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.set(-0.3, -0.4, -0.3);
                modMesh.name = 'crushing_module';
                
                // Add tiny red "active" lights
                const lightGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
                const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                const light = new THREE.Mesh(lightGeo, lightMat);
                light.position.set(0, 0.15, 0.15);
                modMesh.add(light);
            } else if (mod === 'SINGULARITY_COLLAPSE') {
                const geo = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32);
                const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.4, wireframe: true });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.y = -0.65;
                modMesh.name = 'collapse_stabilizer';
            } else if (mod === 'NEUTRON_FLUX') {
                const geo = new THREE.IcosahedronGeometry(0.2, 0);
                const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00ffff });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.set(0, 0.8, 0);
                modMesh.name = 'neutron_emitter';
                
                const haloGeo = new THREE.TorusGeometry(0.3, 0.02, 16, 100);
                const haloMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 });
                const halo = new THREE.Mesh(haloGeo, haloMat);
                halo.rotation.x = Math.PI/2;
                modMesh.add(halo);
            } else if (mod === 'CHRONO_DILATION') {
                const geo = new THREE.TorusKnotGeometry(0.25, 0.04, 64, 8);
                const mat = new THREE.MeshStandardMaterial({ 
                    color: 0x00ffff, 
                    emissive: 0x004488,
                    transparent: true,
                    opacity: 0.8
                });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.set(0.4, 0.4, 0.3);
                modMesh.name = 'chrono_stabilizer';
                
                // Outer ring
                const ringGeo = new THREE.TorusGeometry(0.4, 0.01, 16, 64);
                const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                modMesh.add(ring);
            } else if (mod === 'PHASE_SHIFT_CLOAK') {
                const geo = new THREE.TorusGeometry(0.3, 0.05, 16, 3); // Triangle ring
                const mat = new THREE.MeshStandardMaterial({ 
                    color: 0xff00ff, 
                    emissive: 0x440044,
                    metalness: 1.0,
                    roughness: 0.0
                });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.set(-0.4, 0.4, -0.3);
                modMesh.name = 'phase_projector';
                
                // Pulsing core
                const coreGeo = new THREE.SphereGeometry(0.1, 8, 8);
                const coreMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
                const core = new THREE.Mesh(coreGeo, coreMat);
                core.name = 'phase_core';
                modMesh.add(core);
            } else if (mod === 'RESONANCE_OVERLOAD') {
                const geo = new THREE.SphereGeometry(0.3, 16, 16);
                const mat = new THREE.MeshStandardMaterial({ 
                    color: 0xffaa00, 
                    emissive: 0x442200,
                    wireframe: true 
                });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.set(0.4, -0.4, -0.3);
                modMesh.name = 'resonance_tuning_fork';
                
                // Vibrating rings
                const ringGeo = new THREE.TorusGeometry(0.2, 0.01, 8, 32);
                const ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.5 });
                for(let i=0; i<3; i++) {
                    const ring = new THREE.Mesh(ringGeo, ringMat);
                    ring.position.y = (i - 1) * 0.15;
                    ring.rotation.x = Math.PI/2;
                    ring.name = `res_ring_${i}`;
                    modMesh.add(ring);
                }
            } else if (mod === 'GAMMA_BURST') {
                const geo = new THREE.OctahedronGeometry(0.25, 0);
                const mat = new THREE.MeshStandardMaterial({ 
                    color: 0x00ff00, 
                    emissive: 0x004400,
                    metalness: 0.9,
                    roughness: 0.1
                });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.set(-0.4, 0.4, 0.3);
                modMesh.name = 'gamma_core';
            }
            if (modMesh) newGroup.add(modMesh);
        });

        this.mesh.add(newGroup);
    }

    createMesh() {
        const group = new THREE.Group();
        const loader = new THREE.TextureLoader();
        
        // Load appropriate sprite based on type
        let spriteUrl = 'https://rosebud.ai/assets/sentry_drone_sprite.webp?BA0Q';
        if (this.type === 'HEAVY_SEC_BOT') {
            spriteUrl = 'https://rosebud.ai/assets/boss_mech_sprite.webp?aQjC';
        }
        
        const map = loader.load(spriteUrl);
        const material = new THREE.SpriteMaterial({ 
            map: map,
            color: 0xffffff
        });
        
        const sprite = new THREE.Sprite(material);
        
        // Scale sprite based on type using config
        const scale = CONFIG.ENEMY.TYPES[this.type].SCALE || 1.5;
        sprite.scale.set(scale, scale, 1);
        
        group.add(sprite);
        
        // Add a hidden reference body for material flashing logic
        const referenceBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.1, 0.1),
            new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0 })
        );
        referenceBody.name = 'referenceBody';
        group.add(referenceBody);

        return group;
    }

    update(deltaTime, playerPos, activeSmokeScreens = [], isThermalActive = false, otherEnemies = [], turrets = [], walls = []) {
        if (this.isDead) return;

        // --- Avoidance & Navigation logic ---
        const avoidanceDir = new THREE.Vector3();
        
        // Avoid other enemies
        otherEnemies.forEach(e => {
            if (e !== this && !e.isDead) {
                const d = this.mesh.position.distanceTo(e.mesh.position);
                if (d < 2) {
                    const diff = new THREE.Vector3().subVectors(this.mesh.position, e.mesh.position).normalize();
                    avoidanceDir.add(diff.multiplyScalar(1.0 / d));
                }
            }
        });

        // Avoid walls
        walls.forEach(w => {
            const d = this.mesh.position.distanceTo(w.position);
            if (d < 3) {
                const diff = new THREE.Vector3().subVectors(this.mesh.position, w.position).normalize();
                avoidanceDir.add(diff.multiplyScalar(2.0 / d));
            }
        });

        // --- Elemental Processing ---
        if (this.burnTimer > 0) {
            this.burnTimer -= deltaTime;
            const burnTick = this.burnDamage * deltaTime;
            this.takeDamage(burnTick, otherEnemies, 'INCENDIARY');
            
            // Visual for burn
            if (Math.random() < 0.1) {
                const p = this.mesh.position.clone();
                p.y += Math.random();
                this.mesh.children[0].material.emissive.set(0xff4400);
            }
        }

        if (this.shockTimer > 0) {
            this.shockTimer -= deltaTime;
            this.timeScale = 0.2; // Significant slow/stun during shock
            
            // Shock visual
            if (Math.random() < 0.15) {
                this.mesh.children[0].material.emissive.set(0x00ffff);
            }

            // Occasional chain arc
            if (Date.now() - this.lastShockChain > 1000) {
                this.lastShockChain = Date.now();
                this.executeChainLightning(this, 10, otherEnemies);
            }
        } else if (this.timeScale === 0.2) {
            this.timeScale = 1.0; // Reset after shock
        }

        // Check for nearby Overclockers
        this.isOverclocked = false;
        if (this.isAlly) {
            otherEnemies.forEach(e => {
                if (e.isAlly && !e.isDead && e.modules.includes('OVERCLOCK')) {
                    if (e.mesh.position.distanceTo(this.mesh.position) < 6) {
                        this.isOverclocked = true;
                    }
                }
            });
        }

        // Apply effects to turrets if we are a support drone
        if (this.isAlly) {
            const hasOverclock = this.modules.includes('OVERCLOCK');
            const hasRepair = this.modules.includes('REPAIR_FIELD');
            
            if (hasOverclock || hasRepair) {
                turrets.forEach(t => {
                    const d = t.mesh.position.distanceTo(this.mesh.position);
                    if (d < 6) {
                        if (hasOverclock) {
                            // Turrets don't have a timeScale property, we should add it or handle it in Turret.js
                            // For now let's assume we want to speed up their fireRate
                            t.supportOverclocked = true; 
                        }
                        if (hasRepair) {
                            t.health = Math.min(t.maxHealth, t.health + 5 * deltaTime);
                        }
                    }
                });
            }
        }

        // Chrono stabilizer logic
        if (this.isAlly && this.modules.includes('CHRONO_DILATION')) {
            const stabilizer = this.mesh.getObjectByName('chrono_stabilizer');
            if (stabilizer) {
                stabilizer.rotation.z += deltaTime * 3;
                stabilizer.rotation.y += deltaTime * 2;
                stabilizer.children[0].rotation.x += deltaTime; // Spin the ring
            }
        }

        // Phase Projector logic
        if (this.isAlly && this.modules.includes('PHASE_SHIFT_CLOAK')) {
            const projector = this.mesh.getObjectByName('phase_projector');
            if (projector) {
                projector.rotation.z -= deltaTime * 4;
                const core = projector.getObjectByName('phase_core');
                if (core) core.scale.setScalar(1 + Math.sin(Date.now() * 0.01) * 0.3);
            }
        }

        // Resonance Tuning logic
        if (this.isAlly && this.modules.includes('RESONANCE_OVERLOAD')) {
            const fork = this.mesh.getObjectByName('resonance_tuning_fork');
            if (fork) {
                const vib = Math.sin(Date.now() * 0.05) * 0.05;
                fork.position.x = 0.4 + vib;
                for(let i=0; i<3; i++) {
                    const ring = fork.getObjectByName(`res_ring_${i}`);
                    if (ring) {
                        ring.scale.setScalar(1 + Math.sin(Date.now() * 0.02 + i) * 0.2);
                    }
                }
            }
        }

        // Overclock field logic (visual only for the emitter)
        if (this.isAlly && this.modules.includes('OVERCLOCK')) {
            const emitter = this.mesh.getObjectByName('overclock_emitter');
            if (emitter) {
                emitter.rotation.z += deltaTime * 5;
                const field = emitter.getObjectByName('overclock_visual_field');
                if (field) {
                    field.rotation.y += deltaTime * 0.5;
                }
            }
        }

        // Repair field logic
        if (this.isAlly && this.modules.includes('REPAIR_FIELD')) {
            const emitter = this.mesh.getObjectByName('repair_emitter');
            if (emitter) {
                emitter.rotation.y += deltaTime * 2;
                const field = emitter.getObjectByName('repair_visual_field');
                if (field) {
                    field.scale.setScalar(0.95 + Math.sin(Date.now() * 0.003) * 0.05);
                }
            }

            const repairRadius = 5;
            const repairAmt = 4; // HP per second

            // Heal player
            if (this.mesh.position.distanceTo(playerPos) < repairRadius) {
                this.player.heal(repairAmt * deltaTime);
            }

            // Heal nearby allies
            otherEnemies.forEach(e => {
                if (e.isAlly && !e.isDead && e !== this) {
                    if (e.mesh.position.distanceTo(this.mesh.position) < repairRadius) {
                        e.health = Math.min(e.maxHealth, e.health + repairAmt * deltaTime);
                    }
                }
            });
        }

        // Micro-drone swarm update
        if (this.isAlly && this.microDrones.length > 0) {
            this.microDrones.forEach(drone => drone.update(deltaTime, otherEnemies));
        }

        // Self-destruct blinking logic
        if (this.isAlly && this.modules.includes('SELF_DESTRUCT')) {
            const core = this.mesh.getObjectByName('destruct_core');
            if (core) {
                const blink = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
                core.material.color.setRGB(1, blink * 0.2, blink * 0.2);
                core.scale.setScalar(1 + blink * 0.5);
            }
        }

        // EMP Burst logic
        if (this.isAlly && this.modules.includes('EMP_BURST')) {
            this.empBurstTimer += deltaTime;
            if (this.empBurstTimer > 8) { // Burst every 8 seconds
                // Check for enemies nearby
                let hasEnemiesInRange = false;
                otherEnemies.forEach(e => {
                    if (!e.isAlly && !e.isDead && e.mesh.position.distanceTo(this.mesh.position) < 8) {
                        hasEnemiesInRange = true;
                    }
                });

                if (hasEnemiesInRange) {
                    this.executeEMPBurst(otherEnemies);
                    this.empBurstTimer = 0;
                }
            }
        }

        // Auto-repair logic
        if (this.isAlly && this.modules.includes('REPAIR') && this.health < this.maxHealth) {
            this.health += deltaTime * 2; // Heal 2 HP per second
            if (this.health > this.maxHealth) this.health = this.maxHealth;
        }

        // Gravity Singularity logic
        if (this.isAlly && this.modules.includes('GRAVITY_SINGULARITY')) {
            this.singularityTimer += deltaTime;
            const core = this.mesh.getObjectByName('singularity_core');
            const particles = this.mesh.getObjectByName('singularity_particles');

            // Singularity cycle: 12s cooldown, 4s active
            const cycleTime = 16;
            const activeTime = 4;
            const echoDuration = 3;
            
            const isSingularityActive = (this.singularityTimer % cycleTime) < activeTime;
            const isEchoActive = this.modules.includes('SINGULARITY_ECHO') && 
                                (this.singularityTimer % cycleTime) >= activeTime && 
                                (this.singularityTimer % cycleTime) < (activeTime + echoDuration);

            if (this.wasSingularityActive && !isSingularityActive) {
                // Main Singularity ended!
                if (this.modules.includes('VOLATILE_DETONATION') && this.onSingularityDetonate) {
                    this.onSingularityDetonate(this, 'VOLATILE');
                }
                if (this.modules.includes('NEUTRON_FLUX') && this.onSingularityDetonate) {
                    this.onSingularityDetonate(this, 'NEUTRON');
                }
            }
            
            // If echo just ended
            if (this.wasEchoActive && !isEchoActive) {
                 if (this.modules.includes('VOLATILE_DETONATION') && this.onSingularityDetonate) {
                    this.onSingularityDetonate(this, 'VOLATILE'); // Echo also detonates!
                }
                if (this.modules.includes('NEUTRON_FLUX') && this.onSingularityDetonate) {
                    this.onSingularityDetonate(this, 'NEUTRON');
                }
            }

            this.wasSingularityActive = isSingularityActive;
            this.wasEchoActive = isEchoActive;

            if (core) {
                const echoCore = this.mesh.getObjectByName('echo_core');
                const hasGravityWell = this.modules.includes('GRAVITY_WELL');
                const hasCrushingPressure = this.modules.includes('CRUSHING_PRESSURE');
                const hasSingularityCollapse = this.modules.includes('SINGULARITY_COLLAPSE');
                const hasChronoDilation = this.modules.includes('CHRONO_DILATION');
                const hasPhaseShift = this.modules.includes('PHASE_SHIFT_CLOAK');
                const hasResonance = this.modules.includes('RESONANCE_OVERLOAD');
                
                if (isSingularityActive || isEchoActive) {
                    if (hasPhaseShift) {
                        this.isPhased = true;
                        // Check if player is within range
                        if (this.mesh.position.distanceTo(playerPos) < (isSingularityActive ? 10 : 5)) {
                            this.player.isPhased = true;
                        }
                    }

                    let radius = isSingularityActive ? 10 : 5;
                    let pullForce = isSingularityActive ? 8 : 4;
                    const crushingDamageBase = 20; // Base DOT per second

                    if (hasSingularityCollapse) {
                        pullForce *= 2; // Double pull speed
                    }
                    
                    const pulse = Math.sin(Date.now() * 0.01) * 0.5 + (isSingularityActive ? 1.5 : 0.8);
                    
                    if (isSingularityActive) {
                        core.scale.setScalar(pulse);
                        core.rotation.y += deltaTime * 10;
                        if (hasChronoDilation) core.material.emissive.set(0x00ffff);
                        if (hasPhaseShift) core.material.emissive.set(0xff00ff);
                    } else if (isEchoActive) {
                        core.scale.setScalar(pulse);
                        core.material.opacity = 0.5; // Faded echo
                        core.rotation.y += deltaTime * 5;
                        if (hasChronoDilation) core.material.emissive.set(0x004488);
                        if (hasPhaseShift) core.material.emissive.set(0x880088);
                    }

                    if (particles) {
                        particles.rotation.z -= deltaTime * (isSingularityActive ? 15 : 7);
                        particles.scale.setScalar(isSingularityActive ? 1.5 : 0.7);
                        if (hasChronoDilation) particles.children.forEach(p => p.material.color.set(0x00ffff));
                        if (hasPhaseShift) particles.children.forEach(p => p.material.color.set(0xff00ff));
                    }

                    // Pull effect
                    const caughtEnemies = [];

                    otherEnemies.forEach(e => {
                        if (!e.isAlly && !e.isDead) {
                            const d = e.mesh.position.distanceTo(this.mesh.position);
                            if (d < radius) {
                                caughtEnemies.push(e);
                                const pullDir = new THREE.Vector3().subVectors(this.mesh.position, e.mesh.position).normalize();
                                e.mesh.position.x += pullDir.x * pullForce * deltaTime;
                                e.mesh.position.z += pullDir.z * pullForce * deltaTime;
                                e.mesh.position.y = THREE.MathUtils.lerp(e.mesh.position.y, this.mesh.position.y, deltaTime * 2);
                                
                                if (hasGravityWell) {
                                    e.gravityWellFactor = 1.5; // 50% extra damage
                                }

                                if (hasChronoDilation) {
                                    e.timeScale = 0.3; // 70% slow
                                }

                                if (hasResonance) {
                                    e.resonanceOwner = this;
                                }

                                if (hasCrushingPressure) {
                                    // Scaling damage: more damage closer to the center
                                    const pressureFactor = 1 + (1 - (d / radius)) * 2; // Up to 3x damage at center
                                    e.takeDamage(crushingDamageBase * pressureFactor * deltaTime, otherEnemies);
                                    
                                    // Tiny impact particles for pressure
                                    if (Math.random() < 0.1) {
                                        this.scene.add(new THREE.PointLight(0xff0000, 0.5, 1)); // Temporary flash would be better but this works for vibe
                                    }
                                }
                            }
                        }
                    });

                    // Kinetic Chain Arc Logic
                    if (this.modules.includes('KINETIC_CHAIN') && caughtEnemies.length > 1) {
                        this.kineticChainTimer += deltaTime;
                        const arcCooldown = isSingularityActive ? 0.4 : 0.6;
                        if (this.kineticChainTimer > arcCooldown) {
                            this.kineticChainTimer = 0;
                            this.executeKineticChain(caughtEnemies);
                        }
                    }
                } else {
                    core.scale.setScalar(1.0);
                    core.material.opacity = 1.0;
                    core.rotation.y += deltaTime * 2;
                    if (particles) {
                        particles.rotation.z -= deltaTime * 2;
                        particles.scale.setScalar(1.0);
                    }
                }

                if (echoCore) {
                    echoCore.rotation.x += deltaTime;
                    echoCore.scale.setScalar(1 + Math.sin(Date.now() * 0.005) * 0.2);
                }
            }
        }

        // --- Targeting Logic ---
        let targetPos = playerPos;
        let targetingPlayer = true;

        if (this.isAlly) {
            targetingPlayer = false;
            
            // Handle Commands
            if (this.command === 'MOVE_TO' || this.command === 'GUARD') {
                targetPos = this.commandPos;
                if (this.command === 'MOVE_TO' && this.mesh.position.distanceTo(this.commandPos) < 2) {
                    this.command = 'GUARD';
                }
            } else {
                targetPos = playerPos.clone().add(new THREE.Vector3(2, 0, 2));
            }

            // Target nearest hostile
            let minDist = Infinity;
            this.targetEnemy = null;
            otherEnemies.forEach(e => {
                if (e !== this && !e.isAlly && !e.isDead) {
                    const d = e.mesh.position.distanceTo(this.mesh.position);
                    if (d < minDist && d < CONFIG.ENEMY.DETECTION_RANGE) {
                        minDist = d;
                        this.targetEnemy = e;
                    }
                }
            });

            if (this.targetEnemy && this.command === 'FOLLOW') {
                targetPos = this.targetEnemy.mesh.position;
            }
        } else {
            // Hostile AI: Target player OR nearest visible Ally
            let minDist = this.mesh.position.distanceTo(playerPos);
            this.targetEnemy = null; // In this case, targetEnemy means target drone
            
            otherEnemies.forEach(e => {
                if (e.isAlly && !e.isDead && !e.isCloaked && !e.isPhased) { // Hides from sensors
                    const d = e.mesh.position.distanceTo(this.mesh.position);
                    if (d < minDist) {
                        minDist = d;
                        this.targetEnemy = e;
                        targetPos = e.mesh.position;
                        targetingPlayer = false;
                    }
                }
            });
        }

        // EMP Logic
        if (this.isDisabled) {
            this.disableTimer -= deltaTime * 1000;
            if (this.disableTimer <= 0) {
                this.isDisabled = false;
            }
            // Fall to ground if disabled
            this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, 0.5, deltaTime * 2);
            // Glitchy rotation
            this.mesh.rotation.z = Math.sin(Date.now() * 0.05) * 0.2;
            
            // Visual glitch: random emissive
            const body = this.mesh.children[0];
            if (Math.random() < 0.1) {
                body.material.emissive.set(0x00ffff);
            } else {
                body.material.emissive.set(this.isAlly ? 0x003300 : 0x000000);
            }
            return; // Skip normal AI
        }

        // Check if inside smoke
        this.isInSmoke = activeSmokeScreens.some(smoke => smoke.checkCollision(this.mesh.position));
        
        const sprite = this.mesh.children[0];

        if (this.isAlly) {
            sprite.material.color.set(this.isCloaked ? 0x4444ff : 0x00ff00);
            if (this.isCloaked) {
                sprite.material.opacity = 0.3;
            }
        } else if (this.isCloaked) {
            // High-tech shimmering effect for Neon-Shift cloaking
            sprite.material.opacity = 0.05 + Math.sin(Date.now() * 0.01) * 0.05;
            sprite.material.color.set(0x8800ff); // Purple tint for experimental tech
        }

        if (isThermalActive) {
            sprite.material.opacity = 1.0;
            sprite.material.color.set(this.isAlly ? 0x00ffaa : 0xff5500); 
        } else if (this.isInSmoke) {
            sprite.material.opacity = THREE.MathUtils.lerp(sprite.material.opacity, 0.2, deltaTime * 5);
            if (!this.isAlly) sprite.material.color.set(0xff0000);
            this.targetY = 4.5; 
        } else if (!this.isCloaked) {
            sprite.material.opacity = THREE.MathUtils.lerp(sprite.material.opacity, 1.0, deltaTime * 5);
            if (!this.isAlly) sprite.material.color.set(0xffffff);
            this.targetY = 1.5 + Math.sin(Date.now() * 0.005) * 0.2;
        }

        const dist = this.mesh.position.distanceTo(targetPos);

        // --- Handle Cloak Logic for Neon-Shift Units ---
        if (!this.isAlly && this.facilityId === 'neon' && this.isCloaked) {
            // Re-cloak if player is far away
            if (dist > this.cloakActionRange + 5) {
                this.isCloaked = true;
            }
            // Auto-reveal if player is too close (sensor interference)
            if (dist < this.cloakRevealRange) {
                this.isCloaked = false;
                // Reveal visual effect
                this.mesh.children[0].material.emissive.set(0x00ffff);
            }
        }

        if (dist < CONFIG.ENEMY.DETECTION_RANGE) {
            // Face target (sprite handles its own billboarding)
            this.mesh.lookAt(targetPos.x, this.mesh.position.y, targetPos.z);

            // Update Adaptive Shield Visual Rotation
            if (this.shieldMesh && this.shieldMesh.visible) {
                this.shieldMesh.rotation.y += deltaTime * 2;
                this.shieldMesh.rotation.z += deltaTime;
            }

            // Move towards target if not too close
            const stopDist = targetingPlayer ? this.attackRange * 0.8 : 5;
            if (dist > stopDist) {
                const dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position).normalize();
                
                // Mix in avoidance
                dir.add(avoidanceDir.multiplyScalar(0.5)).normalize();

                let moveSpeed = this.moveSpeed * this.timeScale;
                if (this.isOverclocked) moveSpeed *= 1.5;
                
                this.mesh.position.x += dir.x * moveSpeed * deltaTime;
                this.mesh.position.z += dir.z * moveSpeed * deltaTime;
            }

            // Smoothly move to target height
            if (this.type !== 'TANK' && this.type !== 'STALKER') {
                this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, this.targetY, deltaTime * 2);
            } else {
                this.mesh.position.y = this.type === 'TANK' ? 0.3 : 0.5;
            }

            // Attack logic
            const canSeeTarget = !this.isInSmoke || this.mesh.position.y > 3.5;
            let cooldown = this.type === 'TANK' ? 4000 : (this.modules.includes('RAPID_FIRE') ? 1000 : 2000);
            if (this.type === 'STALKER') cooldown = 1000;
            
            cooldown /= this.timeScale; 
            if (this.isOverclocked) cooldown *= 0.6; 

            if (canSeeTarget && dist < this.attackRange && Date.now() - this.lastAttack > cooldown) {
                this.lastAttack = Date.now();
                this.shoot(targetingPlayer, otherEnemies);
            }
        }
    }

    shoot(targetingPlayer = true, otherEnemies = []) {
        // Attack reveals the drone if cloaked
        if (this.isCloaked) {
            this.isCloaked = false;
            const body = this.mesh.children[0];
            body.material.opacity = 1.0;
            if (this.isAlly) body.material.transparent = false;
            
            // Visual burst for revealing
            const flashColor = this.facilityId === 'neon' ? 0xff00ff : 0x00ffff;
            const flash = new THREE.PointLight(flashColor, 10, 5);
            flash.position.copy(this.mesh.position);
            this.scene.add(flash);
            setTimeout(() => this.scene.remove(flash), 200);
            
            // Neon-Shift units immediately try to re-cloak after a delay if they miss or hit
            if (this.facilityId === 'neon' && !this.isAlly) {
                setTimeout(() => {
                    if (!this.isDead && !this.isDisabled) this.isCloaked = true;
                }, 2000);
            }
        }

        // Visual feedback
        const flashColor = this.isAlly ? (this.modules.includes('HEAVY_LASER') ? 0xff00ff : 0x00ff00) : 0xff0000;
        const flash = new THREE.PointLight(flashColor, 5, 5);
        flash.position.copy(this.mesh.position);
        this.scene.add(flash);
        setTimeout(() => this.scene.remove(flash), 100);

        let damage = this.damage;
        if (this.isAlly && this.modules.includes('HEAVY_LASER')) {
            damage *= 1.5;
        }

        // Tank explosive shot
        if (this.type === 'TANK' && !this.isAlly) {
            const pos = this.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0));
            const targetPos = this.player.mesh.position.clone();
            // This is handled by a special area effect in GameScene normally, 
            // for now let's just do a heavy direct hit
            damage = 40;
        }

        if (this.isAlly && this.targetEnemy) {
            this.targetEnemy.takeDamage(damage, otherEnemies);

            // Chain Lightning Logic
            if (this.modules.includes('CHAIN_LIGHTNING')) {
                this.executeChainLightning(this.targetEnemy, damage * 0.5, otherEnemies);
            }
        } else if (targetingPlayer) {
            this.player.takeDamage(damage);
        }
    }

    executeChainLightning(primaryTarget, damage, allEnemies) {
        const chainRange = 6;
        const maxTargets = 3;
        let chainCount = 0;
        let currentSource = primaryTarget;
        const hitTargets = new Set([primaryTarget]);

        const findNextTarget = (source) => {
            let nearest = null;
            let minDist = chainRange;

            allEnemies.forEach(e => {
                if (!e.isAlly && !e.isDead && !hitTargets.has(e)) {
                    const d = e.mesh.position.distanceTo(source.mesh.position);
                    if (d < minDist) {
                        minDist = d;
                        nearest = e;
                    }
                }
            });
            return nearest;
        };

        const createArc = (start, end) => {
            const points = [start.clone(), end.clone()];
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
            const line = new THREE.Line(geo, mat);
            this.scene.add(line);
            
            // Pulse effect
            setTimeout(() => {
                this.scene.remove(line);
            }, 100);
        };

        while (chainCount < maxTargets) {
            const next = findNextTarget(currentSource);
            if (!next) break;

            createArc(currentSource.mesh.position, next.mesh.position);
            next.takeDamage(damage, allEnemies);
            hitTargets.add(next);
            currentSource = next;
            chainCount++;
        }
    }

    executeKineticChain(enemies) {
        // Create arcs between random pairs of enemies in the singularity
        const arcCount = Math.min(enemies.length, 5);
        const damagePerArc = 15;
        let totalDamageDealt = 0;

        for (let i = 0; i < arcCount; i++) {
            const e1 = enemies[Math.floor(Math.random() * enemies.length)];
            const e2 = enemies[Math.floor(Math.random() * enemies.length)];
            
            if (e1 !== e2) {
                const points = [e1.mesh.position.clone(), e2.mesh.position.clone()];
                const geo = new THREE.BufferGeometry().setFromPoints(points);
                const mat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });
                const line = new THREE.Line(geo, mat);
                this.scene.add(line);
                
                e1.takeDamage(damagePerArc, enemies);
                e2.takeDamage(damagePerArc, enemies);
                totalDamageDealt += damagePerArc * 2;

                setTimeout(() => this.scene.remove(line), 150);
            }
        }

        // Siphon logic: Restore health based on damage dealt
        if (this.modules.includes('MAGNETIC_SIPHON') && totalDamageDealt > 0) {
            const siphonRatio = 0.25; // 25% lifesteal
            const healAmount = totalDamageDealt * siphonRatio;
            this.health = Math.min(this.maxHealth, this.health + healAmount);
            
            // Visual feedback for siphon
            const siphonRing = this.mesh.getObjectByName('siphon_ring');
            if (siphonRing) {
                siphonRing.scale.setScalar(2.0);
                setTimeout(() => {
                    if (siphonRing) siphonRing.scale.setScalar(1.0);
                }, 100);
            }
        }
    }

    takeDamage(amount, sourceEnemies = [], damageType = 'PLAYER') {
        let finalAmount = amount * (this.gravityWellFactor || 1.0);
        
        if (this.isDead || this.isPhased) return; // Invulnerability

        // --- Apply Elemental Effects ---
        if (damageType === 'INCENDIARY') {
            this.burnTimer = 3.0; // 3 seconds burn
            this.burnDamage = amount * 0.5; // Half original shot damage over time
        } else if (damageType === 'SHOCK') {
            this.shockTimer = 1.5; // 1.5s stun/slow
            this.lastShockChain = Date.now();
            // Immediate chain on hit
            this.executeChainLightning(this, amount * 0.3, sourceEnemies);
        }
        
        // --- Adaptive Shielding Logic ---
        if (this.type === 'HEAVY_SEC_BOT') {
            // Phase 2: Vulnerability - Armor shed makes boss more susceptible
            if (this.bossPhase === 2) {
                finalAmount *= 1.3; // 30% more damage taken
            }

            // Track damage by type
            if (this.adaptiveResistances[damageType] !== undefined) {
                this.adaptiveResistances[damageType] += amount;
            }

            // Resistance mitigation
            if (this.currentShieldType === damageType) {
                // Adaptive shield is weaker in Phase 2
                const reduction = this.bossPhase === 2 ? 0.5 : 0.8;
                finalAmount *= (1 - reduction); 
            }

            // Check for shield adaptation (every 100 damage)
            const threshold = 100;
            let highestDmgType = null;
            let maxDmg = 0;

            for (const type in this.adaptiveResistances) {
                if (this.adaptiveResistances[type] > threshold && this.adaptiveResistances[type] > maxDmg) {
                    maxDmg = this.adaptiveResistances[type];
                    highestDmgType = type;
                }
            }

            if (highestDmgType && highestDmgType !== this.currentShieldType) {
                this.adaptShield(highestDmgType);
            }
        }

        // Handle Resonance Overload
        if (this.resonanceOwner && !this.isResonating && !this.isAlly && sourceEnemies.length > 0) {
            this.isResonating = true;
            const resonanceDamage = finalAmount * 0.3; // 30% splash
            
            sourceEnemies.forEach(e => {
                if (e !== this && e.resonanceOwner === this.resonanceOwner && !e.isAlly && !e.isDead) {
                    e.takeDamage(resonanceDamage, sourceEnemies);
                }
            });
            this.isResonating = false;
        }

        if (this.isAlly && this.shieldHealth > 0) {
            this.shieldHealth -= finalAmount;
            if (this.shieldHealth < 0) {
                const carryOver = Math.abs(this.shieldHealth);
                this.shieldHealth = 0;
                this.health -= carryOver;
            }
            // Update shield visual (dim it as it breaks)
            const moduleGroup = this.mesh.getObjectByName('moduleGroup');
            if (moduleGroup) {
                moduleGroup.children.forEach(child => {
                    if (child.geometry && child.geometry.type === 'SphereGeometry') {
                        child.material.opacity = (this.shieldHealth / this.maxShieldHealth) * 0.2;
                    }
                });
            }
        } else {
            this.health -= finalAmount;
        }

        // Check for phase transition
        if (this.type === 'HEAVY_SEC_BOT' && this.bossPhase === 1 && this.health < this.maxHealth * 0.5) {
            this.transitionToPhase2();
        }

        if (this.health <= 0) {
            this.die();
        }
        
        // Flash white on hit
        this.mesh.children[0].material.emissive.set(0xff0000);
        setTimeout(() => {
            if (!this.isDead && !this.isDisabled) {
                this.mesh.children[0].material.emissive.set(this.isAlly ? 0x003300 : 0x330000);
            }
        }, 100);
    }

    transitionToPhase2() {
        this.bossPhase = 2;
        this.moveSpeed *= 1.4; // 40% speed boost
        
        // Visual feedback for phase shift
        const body = this.mesh.children[0];
        body.material.color.set(0xff5555); // Reddish tint
        
        // Particle burst / flash
        const flash = new THREE.PointLight(0xff0000, 20, 15);
        flash.position.copy(this.mesh.position);
        this.scene.add(flash);
        setTimeout(() => this.scene.remove(flash), 500);

        // Small screen shake or message would be nice but handled in GameScene
        console.log("HEAVY SEC-BOT: ARMOR PLATES EJECTED - ENTERING OVERCLOCK MODE");
    }

    adaptShield(type) {
        this.currentShieldType = type;
        
        // Visual feedback
        let color = 0xffffff;
        if (type === 'LASER') color = 0x00ffaa;
        if (type === 'EMP') color = 0x00ffff;
        if (type === 'SLOW') color = 0xaa00ff;
        if (type === 'PLAYER') color = 0xffff00;

        if (this.shieldMesh) {
            this.shieldMesh.visible = true;
            this.shieldMesh.material.color.set(color);
            this.shieldMesh.material.opacity = 0.4;
            
            // Temporary pulse to show adaptation
            this.shieldMesh.scale.setScalar(1.2);
            setTimeout(() => {
                if (this.shieldMesh) this.shieldMesh.scale.setScalar(1);
            }, 300);
        }

        // Reset all tracking after adapting
        for (const t in this.adaptiveResistances) {
            this.adaptiveResistances[t] = 0;
        }

        console.log(`HEAVY SEC-BOT adapted shield to: ${type}`);
    }

    executeEMPBurst(enemies) {
        const radius = 8;
        const duration = 4000;

        // Visual
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3, wireframe: true })
        );
        flash.position.copy(this.mesh.position);
        this.scene.add(flash);

        // Animate expand
        let scale = 0.1;
        const interval = setInterval(() => {
            scale += 0.2;
            flash.scale.set(scale, scale, scale);
            flash.material.opacity -= 0.015;
            if (flash.material.opacity <= 0) {
                this.scene.remove(flash);
                clearInterval(interval);
            }
        }, 16);

        // Reveal if cloaked
        if (this.isCloaked) this.isCloaked = false;

        // Apply EMP to enemies and clear their shields
        enemies.forEach(enemy => {
            if (!enemy.isAlly && !enemy.isDead && enemy.mesh.position.distanceTo(this.mesh.position) < radius) {
                enemy.applyEMP(duration);
                // If the enemy had a shield (future proofing if hostiles get shields)
                if (enemy.shieldHealth > 0) enemy.shieldHealth = 0;
            }
        });
    }

    applyEMP(duration) {
        if (this.isDead) return;
        this.isDisabled = true;
        this.disableTimer = duration;
        
        // Visual indicator: constant blue tint while disabled
        this.mesh.children[0].material.emissive.set(0x004466);
    }

    die() {
        if (this.isDead) return;
        this.isDead = true;
        
        if (this.onDeath) this.onDeath(this);

        // Cleanup micro-drones
        this.microDrones.forEach(drone => drone.destroy());
        this.microDrones = [];

        this.scene.remove(this.mesh);
    }
}
