import * as THREE from 'three';
import { CONFIG } from './config.js';
import { MicroDrone } from './MicroDrone.js';
import { createShieldMaterial } from './ShieldShader.js';

// Texture cache to prevent reloading during spawns
const ENEMY_TEXTURES = {};
const loader = new THREE.TextureLoader();

const SPRITE_URLS = {
    'SENTRY': 'https://rosebud.ai/assets/sentry_drone_new.webp?X9tu',
    'HEAVY_SEC_BOT': 'https://rosebud.ai/assets/heavy_sec_bot_new.webp?O9Gj',
    'SHIELD_PROJECTOR': 'https://rosebud.ai/assets/shield_drone_sprite.webp?X7y9',
    'TANK': 'https://rosebud.ai/assets/tank_bot_new.webp?Ygvw',
    'STALKER': 'https://rosebud.ai/assets/stalker_drone_new.webp?1ilJ'
};

// Pre-warm cache
Object.entries(SPRITE_URLS).forEach(([key, url]) => {
    ENEMY_TEXTURES[key] = loader.load(url);
});

export class Enemy {
    constructor(scene, player, position, type = 'SENTRY', facilityId = 'meridian', navigation = null, particleSystem = null, heatLevel = 1, isElite = false) {
        this.scene = scene;
        this.player = player;
        this.type = type;
        this.facilityId = facilityId;
        this.navigation = navigation;
        this.particleSystem = particleSystem;
        this.heatLevel = heatLevel;
        this.isElite = isElite;
        
        // Pathfinding state
        this.path = [];
        this.pathIndex = 0;
        this.lastPathUpdate = 0;
        this.pathUpdateInterval = 500 + Math.random() * 500; // ms between path updates
        
        const stats = CONFIG.ENEMY.TYPES[this.type];
        let buff = 1 + (heatLevel - 1) * CONFIG.HEAT.STAT_BUFF_PER_LEVEL;
        
        // Elite Buffs
        if (this.isElite) {
            buff *= 1.5; // Elites are 50% stronger than their non-elite counterparts
            this.eliteAbilityTimer = 0;
            this.eliteAbilityCooldown = this.type === 'STALKER' ? 3000 : 5000;
        }

        this.health = stats.HEALTH * buff;
        this.maxHealth = stats.HEALTH * buff;
        this.damage = stats.DAMAGE * buff;
        this.moveSpeed = stats.SPEED * buff;
        this.attackRange = stats.RANGE;
        this.scoreValue = stats.SCORE * (this.isElite ? 3 : 1);

        // Boss Phase 2 / Rage check
        this.isRaging = false;
        
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
        
        this.originalColor = new THREE.Color(0xffffff);
        this.hitFlashTimer = 0;
        this.deathTimer = 0;
        
        this.scene.add(this.mesh);
        this.isDead = false;
        this.isAlly = false;
        this.lastAttack = 0;
        this.isDisabled = false;
        this.disableTimer = 0;
        this.targetEnemy = null;
        this.onDeath = null; // Callback for special death effects
        
        // Command State
        this.command = 'FOLLOW'; // FOLLOW, STRIKE, DEFEND
        this.stance = 'BALANCED'; // BALANCED, AGGRESSIVE, DEFENSIVE
        this.commandPos = new THREE.Vector3();
        this.commandTarget = null; // Specific enemy to focus fire on

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
        this.raycaster = new THREE.Raycaster();
        
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

        if (this.type === 'SHIELD_PROJECTOR') {
            this.projectorShieldMesh = this.createProjectorShieldMesh();
            this.mesh.add(this.projectorShieldMesh);
            this.shieldRange = 10;
        }
    }

    createProjectorShieldMesh() {
        const geo = new THREE.SphereGeometry(this.shieldRange || 10, 32, 16);
        const mat = createShieldMaterial(0x00ffff, 0.05);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        mesh.name = 'projector_shield';
        return mesh;
    }

    updateShieldProjector(deltaTime, otherEnemies, playerPos, spatialGrid = null) {
        if (!this.projectorShieldMesh) return;
        
        this.projectorShieldMesh.visible = true;
        this.projectorShieldMesh.rotation.y += deltaTime * 0.5;
        this.projectorShieldMesh.rotation.z += deltaTime * 0.3;
        
        if (this.projectorShieldMesh.material.uniforms) {
            this.projectorShieldMesh.material.uniforms.time.value += deltaTime;
            if (this.projectorShieldMesh.material.uniforms.impactStrength.value > 0) {
                this.projectorShieldMesh.material.uniforms.impactStrength.value -= deltaTime * 2;
            }
        }

        const range = this.shieldRange || 10;

        // Apply shield to allies
        const nearby = spatialGrid ? spatialGrid.getNearby(this.mesh.position, range) : otherEnemies;
        nearby.forEach(e => {
            if (e !== this && !e.isDead && e.isAlly === this.isAlly) {
                const dSq = e.mesh.position.distanceToSquared(this.mesh.position);
                if (dSq < range * range) {
                    // Apply temporary shield buff
                    e.hasProjectedShield = true;
                    e.projectedShieldTimer = 200; // ms to persist
                }
            }
        });

        // Shield player if allied
        if (this.isAlly) {
            const d = playerPos.distanceTo(this.mesh.position);
            if (d < range) {
                this.player.hasProjectedShield = true;
                this.player.projectedShieldTimer = 200;
            }
        }
    }

    createAdaptiveShieldMesh() {
        const geo = new THREE.SphereGeometry(1.5, 32, 32);
        const mat = createShieldMaterial(0xffffff, 0);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        mesh.name = 'adaptive_shield';
        return mesh;
    }

    setStance(stance) {
        this.stance = stance.toUpperCase();
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
                const geo = new THREE.SphereGeometry(1.2, 32, 32);
                const mat = createShieldMaterial(0x00ffff, 0.2);
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.name = 'module_shield';
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
        
        // Use pre-warmed texture cache
        const map = ENEMY_TEXTURES[this.type] || ENEMY_TEXTURES['SENTRY'];
        
        const material = new THREE.SpriteMaterial({ 
            map: map,
            color: this.isElite ? 0xff00ff : 0xffffff // Elite units have a purple tint
        });
        
        const sprite = new THREE.Sprite(material);
        
        // Scale sprite based on type using config
        const scale = (CONFIG.ENEMY.TYPES[this.type].SCALE || 1.5) * (this.isElite ? 1.3 : 1.0);
        sprite.scale.set(scale, scale, 1);
        group.add(sprite);

        // --- Visual Polish Enhancements ---
        // 1. Under-glow Light
        let glowColor = this.type === 'SENTRY' ? 0x00ffaa : (this.type === 'STALKER' ? 0xff3300 : 0x00ffff);
        if (this.isElite) glowColor = 0xff00ff; // Elites always glow purple

        this.glow = new THREE.PointLight(glowColor, this.isElite ? 2.5 : 0.8, 3.5);
        this.glow.position.y = -0.5;
        group.add(this.glow);

        // Elite Halo
        if (this.isElite) {
            const haloGeo = new THREE.TorusGeometry(0.6, 0.05, 8, 32);
            const haloMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.5 });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.rotation.x = Math.PI / 2;
            halo.position.y = scale * 0.7;
            halo.name = 'eliteHalo';
            group.add(halo);
        }

        // 2. Scanning Beam (Sentry only)
        if (this.type === 'SENTRY') {
            const beamGeo = new THREE.CylinderGeometry(0.02, 0.5, 8, 8, 1, true);
            const beamMat = new THREE.MeshBasicMaterial({ 
                color: 0x00ffaa, 
                transparent: true, 
                opacity: 0.1,
                side: THREE.DoubleSide
            });
            this.scanBeam = new THREE.Mesh(beamGeo, beamMat);
            this.scanBeam.rotation.x = Math.PI / 2;
            this.scanBeam.position.z = -4;
            group.add(this.scanBeam);
        }
        
        // Add a proper HITBOX for raycasting (invisible)
        const hitboxGeo = new THREE.BoxGeometry(scale * 0.8, scale * 1.2, scale * 0.8);
        const hitboxMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0, visible: false });
        const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
        hitbox.name = 'hitbox';
        hitbox.userData.isEnemyHitbox = true; 
        hitbox.userData.enemyRef = this; // Optimized lookup
        group.add(hitbox);

        return group;
    }

    update(deltaTime, playerPos, activeSmokeScreens = [], isThermalActive = false, otherEnemies = [], turrets = [], map = null, spatialGrid = null) {
        if (this.isDead) {
            if (this.deathTimer > 0) {
                this.deathTimer -= deltaTime;
                const sprite = this.mesh.children[0];
                if (sprite && sprite.material) {
                    sprite.material.opacity = Math.max(0, this.deathTimer / 0.2);
                    this.mesh.scale.addScalar(deltaTime * 1.5);
                }
                if (this.deathTimer <= 0) {
                    this.scene.remove(this.mesh);
                }
            }
            return;
        }

        // --- Elite Logic ---
        if (this.isElite && !this.isDisabled) {
            if (!this.eliteAbilityTimer) this.eliteAbilityTimer = 0;
            this.eliteAbilityTimer += deltaTime * 1000;
            if (this.eliteAbilityTimer > this.eliteAbilityCooldown) {
                this.executeEliteAbility(playerPos, otherEnemies, spatialGrid);
                this.eliteAbilityTimer = 0;
            }

            const halo = this.mesh.getObjectByName('eliteHalo');
            if (halo) {
                halo.rotation.z += deltaTime * 2;
                halo.position.y += Math.sin(Date.now() * 0.005) * 0.005;
            }
        }

        // --- Optimized Timers ---
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= deltaTime;
            if (this.hitFlashTimer <= 0) {
                const sprite = this.mesh.children[0];
                if (sprite && sprite.material) {
                    sprite.material.color.copy(this.originalColor || new THREE.Color(0xffffff));
                }
            }
        }

        const myPos = this.mesh.position;

        // Throttled Chamber Index check
        if (!this.lastChamberCheck || Date.now() - this.lastChamberCheck > 2000) {
            this.lastChamberCheck = Date.now();
            this.myChamberIdx = null;
            if (map) {
                // Optimize chamber search by checking current first if it exists
                const cur = this.myChamberIdx !== null ? map.chambers[this.myChamberIdx] : null;
                if (cur && Math.abs(myPos.x - cur.x) < cur.size / 2 + 5 && Math.abs(myPos.z - cur.z) < cur.size / 2 + 5) {
                    // Still in same chamber
                } else {
                    const myChamber = map.chambers.find(c => 
                        Math.abs(myPos.x - c.x) < c.size / 2 + 5 && 
                        Math.abs(myPos.z - c.z) < c.size / 2 + 5
                    );
                    this.myChamberIdx = myChamber ? myChamber.index : null;
                }
            }
        }

        // --- Targeting Logic ---
        let targetPos = playerPos;
        let targetingPlayer = true;

        if (this.isAlly) {
            targetingPlayer = false;
            
            // Handle Commands
            if (this.command === 'DEFEND') {
                targetPos = this.commandPos;
                // If we reach defend pos, just stay around it
            } else if (this.command === 'STRIKE' && this.commandTarget && !this.commandTarget.isDead) {
                targetPos = this.commandTarget.mesh.position;
            } else {
                targetPos = playerPos; 
            }

            // Target nearest hostile (Throttled)
            if (!this.lastTargetUpdate || Date.now() - this.lastTargetUpdate > 500) {
                this.lastTargetUpdate = Date.now();
                
                if (this.command === 'STRIKE' && this.commandTarget && !this.commandTarget.isDead) {
                    this.targetEnemy = this.commandTarget;
                } else {
                    let minDistSq = Infinity;
                    this.targetEnemy = null;
                    const detectionRange = CONFIG.ENEMY.DETECTION_RANGE;
                    const detectionRangeSq = detectionRange * detectionRange;
                    
                    const nearby = spatialGrid ? spatialGrid.getNearby(myPos, detectionRange) : otherEnemies;
                    for (let i = 0; i < nearby.length; i++) {
                        const e = nearby[i];
                        if (e !== this && !e.isAlly && !e.isDead) {
                            const dSq = myPos.distanceToSquared(e.mesh.position);
                            if (dSq < minDistSq && dSq < detectionRangeSq) {
                                minDistSq = dSq;
                                this.targetEnemy = e;
                                if (dSq < 25) break; // Close enough target found
                            }
                        }
                    }
                }
            }

            if (this.targetEnemy && (this.command === 'FOLLOW' || this.command === 'DEFEND')) {
                targetPos = this.targetEnemy.mesh.position;
            } else if (this.command === 'STRIKE' && this.targetEnemy) {
                targetPos = this.targetEnemy.mesh.position;
            }
        } else {
            // Hostile AI: Target player OR nearest visible Ally (Throttled)
            if (!this.lastTargetUpdate || Date.now() - this.lastTargetUpdate > 600) {
                this.lastTargetUpdate = Date.now();
                let minDistSq = myPos.distanceToSquared(playerPos);
                this.targetEnemy = null; 
                
                const nearby = spatialGrid ? spatialGrid.getNearby(myPos, CONFIG.ENEMY.DETECTION_RANGE) : otherEnemies;
                for (let i = 0; i < nearby.length; i++) {
                    const e = nearby[i];
                    if (e.isAlly && !e.isDead && !e.isCloaked && !e.isPhased) {
                        const dSq = myPos.distanceToSquared(e.mesh.position);
                        if (dSq < minDistSq) {
                            minDistSq = dSq;
                            this.targetEnemy = e;
                            this.hostileTargetPos = e.mesh.position;
                            targetingPlayer = false;
                        }
                    }
                }
                if (!this.targetEnemy) {
                    this.hostileTargetPos = playerPos;
                    targetingPlayer = true;
                }
            }
            targetPos = this.hostileTargetPos || playerPos;
        }

        // --- Projected Shield timer decrease ---
        if (this.projectedShieldTimer > 0) {
            this.projectedShieldTimer -= deltaTime * 1000;
            if (this.projectedShieldTimer <= 0) {
                this.hasProjectedShield = false;
            }
        }

        // --- Shield Projector logic ---
        if (this.type === 'SHIELD_PROJECTOR' && !this.isDisabled) {
            this.updateShieldProjector(deltaTime, otherEnemies, playerPos, spatialGrid);
        }

        // --- Avoidance & Navigation logic ---
        // Avoid other enemies - Throttled and limit number of neighbors
        if (!this.lastAvoidUpdate || Date.now() - this.lastAvoidUpdate > 300) {
            this.lastAvoidUpdate = Date.now();
            this.currentAvoidance = new THREE.Vector3();
            let neighborCount = 0;
            const maxNeighbors = 2; // Reduced further for performance

            const nearby = spatialGrid ? spatialGrid.getNearby(myPos, 2) : otherEnemies;
            for (let i = 0; i < nearby.length; i++) {
                const e = nearby[i];
                if (e === this || e.isDead || neighborCount >= maxNeighbors) continue;
                
                const distSq = myPos.distanceToSquared(e.mesh.position);
                if (distSq < 4) { // dist < 2
                    const d = Math.sqrt(distSq) || 0.001;
                    const diff = new THREE.Vector3().subVectors(myPos, e.mesh.position).normalize();
                    this.currentAvoidance.add(diff.multiplyScalar(0.8 / d));
                    neighborCount++;
                }
            }
        }
        const combinedAvoidance = this.currentAvoidance.clone();

        // Avoid walls - Proactive check using raycasters would be ideal but map check is faster
        if (!this.lastWallAvoidUpdate || Date.now() - this.lastWallAvoidUpdate > 400) {
            this.lastWallAvoidUpdate = Date.now();
            this.wallAvoidance = new THREE.Vector3();
            if (map && map.checkCollision(myPos, 1.2, this.myChamberIdx)) { // Increased check radius
                // If colliding, push away from the nearest wall/obstacle
                // We find the center of the chamber and push towards it
                if (this.myChamberIdx !== null) {
                    const chamber = map.chambers[this.myChamberIdx];
                    if (chamber) {
                        const toCenter = new THREE.Vector3(chamber.x, myPos.y, chamber.z).sub(myPos).normalize();
                        this.wallAvoidance.add(toCenter.multiplyScalar(3.0));
                    }
                }
            }
        }
        combinedAvoidance.add(this.wallAvoidance);

        // --- Elemental Processing ---
        if (this.burnTimer > 0) {
            this.burnTimer -= deltaTime;
            const burnTick = this.burnDamage * deltaTime;
            this.takeDamage(burnTick, otherEnemies, 'INCENDIARY');
            
            // Visual for burn
            if (Math.random() < 0.1) {
                const p = this.mesh.position.clone();
                p.y += Math.random();
                this.mesh.children[0].material.color.set(0xff4400);
            }
        }

        if (this.shockTimer > 0) {
            this.shockTimer -= deltaTime;
            this.timeScale = 0.2; // Significant slow/stun during shock
            
            // Shock visual
            if (Math.random() < 0.15) {
                this.mesh.children[0].material.color.set(0x00ffff);
            }

            // Occasional chain arc
            if (Date.now() - this.lastShockChain > 1000) {
                this.lastShockChain = Date.now();
                this.executeChainLightning(this, 10, otherEnemies);
            }
        } else if (this.timeScale === 0.2) {
            this.timeScale = 1.0; // Reset after shock
        }

        // Check for nearby Overclockers - Throttled
        if (this.isAlly && (!this.lastOverclockCheck || Date.now() - this.lastOverclockCheck > 400)) {
            this.lastOverclockCheck = Date.now();
            this.isOverclocked = false;
            const overclockRange = 6;
            const overclockRangeSq = overclockRange * overclockRange;
            const nearby = spatialGrid ? spatialGrid.getNearby(this.mesh.position, overclockRange) : otherEnemies;
            for (let i = 0; i < nearby.length; i++) {
                const e = nearby[i];
                if (e.isAlly && !e.isDead && e.modules.includes('OVERCLOCK')) {
                    if (e.mesh.position.distanceToSquared(this.mesh.position) < overclockRangeSq) {
                        this.isOverclocked = true;
                        break;
                    }
                }
            }
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

            // Throttled repair logic
            if (!this.lastRepairTick || Date.now() - this.lastRepairTick > 500) {
                this.lastRepairTick = Date.now();
                const repairRadius = 5;
                const repairRadiusSq = repairRadius * repairRadius;
                const repairAmt = 2; // HP per tick (2 HP every 500ms = 4 HP/s)

                // Heal player
                if (this.mesh.position.distanceToSquared(playerPos) < repairRadiusSq) {
                    this.player.heal(repairAmt);
                }

                // Heal nearby allies
                const nearby = spatialGrid ? spatialGrid.getNearby(this.mesh.position, repairRadius) : otherEnemies;
                for (let i = 0; i < nearby.length; i++) {
                    const e = nearby[i];
                    if (e.isAlly && !e.isDead && e !== this) {
                        if (e.mesh.position.distanceToSquared(this.mesh.position) < repairRadiusSq) {
                            e.health = Math.min(e.maxHealth, e.health + repairAmt);
                        }
                    }
                }
            }
        }

        // Micro-drone swarm update
        if (this.isAlly && this.microDrones.length > 0) {
            this.microDrones.forEach(drone => drone.update(deltaTime, otherEnemies, this.targetEnemy));
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
                const radius = 8;
                const nearby = spatialGrid ? spatialGrid.getNearby(this.mesh.position, radius) : otherEnemies;
                for (let i = 0; i < nearby.length; i++) {
                    const e = nearby[i];
                    if (!e.isAlly && !e.isDead && e.mesh.position.distanceToSquared(this.mesh.position) < radius * radius) {
                        hasEnemiesInRange = true;
                        break;
                    }
                }

                if (hasEnemiesInRange) {
                    this.executeEMPBurst(nearby);
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

                    // Pull effect - Throttled enemy collection
                    if (!this.lastSingularitySearch || Date.now() - this.lastSingularitySearch > 100) {
                        this.lastSingularitySearch = Date.now();
                        this.caughtEnemies = [];
                        const radiusSq = radius * radius;
                        const nearby = spatialGrid ? spatialGrid.getNearby(this.mesh.position, radius) : otherEnemies;
                        for (let i = 0; i < nearby.length; i++) {
                            const e = nearby[i];
                            if (!e.isAlly && !e.isDead && e.mesh.position.distanceToSquared(this.mesh.position) < radiusSq) {
                                this.caughtEnemies.push(e);
                            }
                        }
                    }

                    this.caughtEnemies.forEach(e => {
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
                            const dSq = e.mesh.position.distanceToSquared(this.mesh.position);
                            const pressureFactor = 1 + (1 - (Math.sqrt(dSq) / radius)) * 2;
                            e.takeDamage(crushingDamageBase * pressureFactor * deltaTime, otherEnemies);
                            
                            if (Math.random() < 0.05) {
                                // Reduced particle spawn for performance
                            }
                        }
                    });

                    // Kinetic Chain Arc Logic
                    if (this.modules.includes('KINETIC_CHAIN') && this.caughtEnemies.length > 1) {
                        this.kineticChainTimer += deltaTime;
                        const arcCooldown = isSingularityActive ? 0.4 : 0.6;
                        if (this.kineticChainTimer > arcCooldown) {
                            this.kineticChainTimer = 0;
                            this.executeKineticChain(this.caughtEnemies, spatialGrid);
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
            
            // Visual glitch: random color shift
            const body = this.mesh.children[0];
            if (Math.random() < 0.1) {
                body.material.color.set(0x00ffff);
            } else {
                body.material.color.set(this.isAlly ? 0x00ff00 : 0xffffff);
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

        // --- Pathfinding ---
        if (this.navigation && Date.now() - this.lastPathUpdate > this.pathUpdateInterval) {
            this.lastPathUpdate = Date.now();
            this.path = this.navigation.findPath(this.mesh.position, targetPos);
            this.pathIndex = 0;
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

        // Throttled Height & Movement Height
        if (!this.lastHeightUpdate || Date.now() - this.lastHeightUpdate > 100) {
            this.lastHeightUpdate = Date.now();
            if (this.isInSmoke) {
                this.targetY = 4.5;
            } else if (!this.isCloaked) {
                this.targetY = 1.5 + Math.sin(Date.now() * 0.005) * 0.2;
            }
        }

        const distSq = myPos.distanceToSquared(targetPos);
        const detectionRangeSq = CONFIG.ENEMY.DETECTION_RANGE * CONFIG.ENEMY.DETECTION_RANGE;

        if (distSq < detectionRangeSq) {
            // Face target (sprite handles its own billboarding)
            this.mesh.lookAt(targetPos.x, myPos.y, targetPos.z);

            // Update Shield Visuals (Throttled)
            const shield = this.mesh.getObjectByName('module_shield') || this.mesh.getObjectByName('adaptive_shield') || this.mesh.getObjectByName('projector_shield');
            if (shield && shield.material.uniforms) {
                shield.material.uniforms.time.value += deltaTime;
                if (shield.material.uniforms.impactStrength.value > 0) {
                    shield.material.uniforms.impactStrength.value -= deltaTime * 3;
                }
            }

            // Move towards target if not too close
            let moveDistThreshold = targetingPlayer ? this.attackRange * 0.8 : 5;
            
            // Stance adjustments
            let finalMoveSpeed = this.moveSpeed * this.timeScale;
            if (this.isAlly) {
                if (this.stance === 'AGGRESSIVE') {
                    moveDistThreshold *= 0.5;
                    finalMoveSpeed *= 1.3;
                } else if (this.stance === 'DEFENSIVE') {
                    moveDistThreshold *= 1.5;
                    finalMoveSpeed *= 0.8;
                }
            }

            if (distSq > Math.pow(moveDistThreshold, 2)) {
                let moveDir;
                if (this.path && this.path.length > 0 && this.pathIndex < this.path.length) {
                    const nextPoint = this.path[this.pathIndex];
                    if (myPos.distanceToSquared(nextPoint) < 1.0) {
                        this.pathIndex++;
                    }
                    if (this.pathIndex < this.path.length) {
                        const targetPt = this.path[this.pathIndex];
                        moveDir = new THREE.Vector3().subVectors(targetPt, myPos).normalize();
                    } else {
                        moveDir = new THREE.Vector3().subVectors(targetPos, myPos).normalize();
                    }
                } else {
                    moveDir = new THREE.Vector3().subVectors(targetPos, myPos).normalize();
                }
                
                // Mix in avoidance
                moveDir.add(combinedAvoidance.multiplyScalar(0.5)).normalize();

                if (this.isOverclocked) finalMoveSpeed *= 1.5;
                
                myPos.x += moveDir.x * finalMoveSpeed * deltaTime;
                myPos.z += moveDir.z * finalMoveSpeed * deltaTime;
            }

            // Smoothly move to target height
            if (this.type !== 'TANK' && this.type !== 'STALKER') {
                myPos.y = THREE.MathUtils.lerp(myPos.y, this.targetY || 1.5, deltaTime * 2);
            } else {
                myPos.y = this.type === 'TANK' ? 0.3 : 0.5;
            }

            // Attack logic (Throttled)
            let canSeeTarget = !this.isInSmoke || myPos.y > 3.5;
            
            // Rage pulsing light
            if (this.isRaging && this.rageLight) {
                this.rageLight.intensity = 2 + Math.sin(Date.now() * 0.01) * 3;
            }

            // Optimized Wall obstruction check: only check every 500ms and only relevant walls
            if (canSeeTarget && map && distSq < Math.pow(this.attackRange, 2)) {
                if (distSq < 16) { // If < 4m, assume LoS for performance
                    this.isLoSBlocked = false;
                } else if (!this.lastLoSCheck || Date.now() - this.lastLoSCheck > 500) {
                    this.lastLoSCheck = Date.now();
                    
                    const checkDir = new THREE.Vector3().subVectors(targetPos, myPos).normalize();
                    this.raycaster.set(myPos, checkDir);
                    
                    // Collect relevant wall meshes using spatial grid if possible
                    const obstacles = [];
                    const currentRoomIdx = this.myChamberIdx;

                    if (currentRoomIdx !== null && map.spatialGrid.has(currentRoomIdx)) {
                        const indices = map.spatialGrid.get(currentRoomIdx);
                        // Limit obstacles checked to first 10 for performance
                        for(let i=0; i < Math.min(indices.length, 10); i++) {
                            obstacles.push(map.walls[indices[i]]);
                        }
                    } else {
                        // Minimal fallback
                        if (map.walls.length > 0) obstacles.push(map.walls[0]);
                    }

                    if (map.doors) {
                        map.doors.forEach(d => {
                            if (!d.isOpen && d.chamberIndex === currentRoomIdx) obstacles.push(d.pL, d.pR);
                        });
                    }

                    if (obstacles.length > 0) {
                        const hits = this.raycaster.intersectObjects(obstacles, true);
                        const distToTarget = Math.sqrt(distSq);
                        if (hits.length > 0 && hits[0].distance < distToTarget - 0.5) {
                            this.isLoSBlocked = true;
                        } else {
                            this.isLoSBlocked = false;
                        }
                    }
                }
                if (this.isLoSBlocked) canSeeTarget = false;
            }

            let cooldown = this.type === 'TANK' ? 4000 : (this.modules.includes('RAPID_FIRE') ? 1000 : 2000);
            if (this.type === 'STALKER') cooldown = 1000;
            if (this.isRaging) cooldown *= 0.5; // Double fire rate in rage mode
            
            if (this.isAlly) {
                if (this.stance === 'AGGRESSIVE') cooldown *= 0.7;
                else if (this.stance === 'DEFENSIVE') cooldown *= 1.2;
            }

            cooldown /= this.timeScale; 
            if (this.isOverclocked) cooldown *= 0.6; 

            if (canSeeTarget && distSq < Math.pow(this.attackRange, 2) && Date.now() - this.lastAttack > cooldown) {
                this.lastAttack = Date.now();
                this.shoot(targetingPlayer, otherEnemies, spatialGrid);
            }
        }
    }

    shoot(targetingPlayer = true, otherEnemies = [], spatialGrid = null) {
        // Visual feedback
        const flashColor = this.isAlly ? (this.modules.includes('HEAVY_LASER') ? 0xff00ff : 0x00ff00) : 0xff0000;
        
        if (!this.muzzlePos) this.muzzlePos = new THREE.Vector3();
        this.muzzlePos.copy(this.mesh.position);
        this.muzzlePos.y += 0.5;
        
        if (this.particleSystem) {
            let targetPos;
            if (this.isAlly && this.targetEnemy) {
                targetPos = this.targetEnemy.mesh.position;
            } else if (targetingPlayer) {
                targetPos = this.player.camera.position;
            }

            if (targetPos) {
                const shootDir = new THREE.Vector3().subVectors(targetPos, this.muzzlePos).normalize();
                this.muzzlePos.add(shootDir.clone().multiplyScalar(0.8));
                
                // Telegraphing: Pulse the enemy and play a warning sound
                const sprite = this.mesh.children[0];
                if (sprite && sprite.material && !this.isAlly) {
                    sprite.material.color.set(0xffffff);
                    this.hitFlashTimer = 0.4; // Longer flash for telegraphing
                    
                    // Trigger a warning beep via Tone.js if available
                    if (this.scene.game && this.scene.game.hackSynth) {
                        this.scene.game.hackSynth.triggerAttackRelease("C6", "32n");
                    }
                }

                this.particleSystem.createMuzzleFlash(this.muzzlePos, shootDir, flashColor);
                
                if (!this.isAlly) {
                    // Physical Projectiles only - no automatic damage timers!
                    this.particleSystem.createEnemyProjectile(this.muzzlePos, targetPos, flashColor);
                    this.particleSystem.createPersistentTracer(this.muzzlePos, targetPos, flashColor);
                } else {
                    this.particleSystem.createTracer(this.muzzlePos, targetPos, flashColor);
                }
            }
        }

        let damage = this.damage;
        if (this.isAlly && this.modules.includes('HEAVY_LASER')) {
            damage *= 1.5;
        }

        if (this.isAlly && this.targetEnemy) {
            this.targetEnemy.takeDamage(damage, otherEnemies, 'PLAYER', spatialGrid);
            if (this.modules.includes('CHAIN_LIGHTNING')) {
                this.executeChainLightning(this.targetEnemy, damage * 0.5, otherEnemies, spatialGrid);
            }
        }
        // Removed targetingPlayer automatic damage branch!
    }

    executeChainLightning(primaryTarget, damage, allEnemies, spatialGrid = null) {
        const chainRange = 6;
        const maxTargets = 3;
        let chainCount = 0;
        let currentSource = primaryTarget;
        const hitTargets = new Set([primaryTarget]);

        const findNextTarget = (source) => {
            let nearest = null;
            let minDist = chainRange;
            const nearby = spatialGrid ? spatialGrid.getNearby(source.mesh.position, chainRange) : allEnemies;

            nearby.forEach(e => {
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
            if (this.particleSystem) {
                this.particleSystem.createTracer(start, end, 0x00ffff);
            }
        };

        while (chainCount < maxTargets) {
            const next = findNextTarget(currentSource);
            if (!next) break;

            createArc(currentSource.mesh.position, next.mesh.position);
            next.takeDamage(damage, allEnemies, 'PLAYER', spatialGrid);
            hitTargets.add(next);
            currentSource = next;
            chainCount++;
        }
    }

    executeKineticChain(enemies, spatialGrid = null) {
        // Create arcs between random pairs of enemies in the singularity
        const arcCount = Math.min(enemies.length, 5);
        const damagePerArc = 15;
        let totalDamageDealt = 0;

        for (let i = 0; i < arcCount; i++) {
            const e1 = enemies[Math.floor(Math.random() * enemies.length)];
            const e2 = enemies[Math.floor(Math.random() * enemies.length)];
            
            if (e1 !== e2) {
                if (this.particleSystem) {
                    this.particleSystem.createTracer(e1.mesh.position, e2.mesh.position, 0x00ffff);
                }
                
                e1.takeDamage(damagePerArc, enemies, 'PLAYER', spatialGrid);
                e2.takeDamage(damagePerArc, enemies, 'PLAYER', spatialGrid);
                totalDamageDealt += damagePerArc * 2;
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

    takeDamage(amount, sourceEnemies = [], damageType = 'PLAYER', spatialGrid = null) {
        let finalAmount = amount * (this.gravityWellFactor || 1.0);
        if (this.isDead || this.isPhased) return; 

        // Handle Elemental Status Application
        if (damageType === 'INCENDIARY' && this.burnTimer <= 0) {
            this.burnTimer = 3.0; // 3 seconds of burning
            this.burnDamage = amount * 0.4; // DOT is 40% of trigger hit
        } else if (damageType === 'SHOCK' && this.shockTimer <= 0) {
            this.shockTimer = 1.2; // 1.2s stun
            this.lastShockChain = Date.now();
            this.executeChainLightning(this, amount * 0.5, sourceEnemies, spatialGrid);
        }

        if (this.hasProjectedShield) {
            finalAmount *= 0.25; 
            
            // Shield Impact Ripple
            const shield = this.mesh.getObjectByName('module_shield') || this.mesh.getObjectByName('adaptive_shield') || this.mesh.getObjectByName('projector_shield');
            if (shield && shield.material.uniforms) {
                shield.material.uniforms.impactStrength.value = 1.0;
                // Randomize impact position on the sphere for visual variety
                shield.material.uniforms.impactPos.value.set(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2
                ).normalize().multiplyScalar(1.2);
            }

            if (Math.random() < 0.2) {
                const flash = new THREE.PointLight(0x00ffff, 5, 3);
                flash.position.copy(this.mesh.position);
                this.scene.add(flash);
                setTimeout(() => this.scene.remove(flash), 100);
            }
        }

        // Heavy Sec-Bot Adaptation
        if (this.type === 'HEAVY_SEC_BOT' && damageType !== 'INCENDIARY' && damageType !== 'SHOCK') {
            this.adaptiveResistances[damageType] = (this.adaptiveResistances[damageType] || 0) + finalAmount;
            if (this.adaptiveResistances[damageType] > 100 && this.currentShieldType !== damageType) {
                this.adaptShield(damageType);
            }
            if (this.currentShieldType === damageType) {
                finalAmount *= 0.2; // 80% resistance to adapted type
            }
        }

        const sprite = this.mesh.children[0];
        if (sprite && sprite.material) {
            if (!this.hitFlashTimer || this.hitFlashTimer <= 0) this.originalColor = sprite.material.color.clone();
            sprite.material.color.set(0xffffff);
            this.hitFlashTimer = 0.08;
        }

        if (this.isAlly && this.shieldHealth > 0) {
            this.shieldHealth -= finalAmount;
            if (this.shieldHealth < 0) { this.health -= Math.abs(this.shieldHealth); this.shieldHealth = 0; }
        } else this.health -= finalAmount;

        if (this.type === 'HEAVY_SEC_BOT' && this.bossPhase === 1 && this.health < this.maxHealth * 0.5) this.transitionToPhase2();
        if (this.type === 'HEAVY_SEC_BOT' && !this.isRaging && this.health < this.maxHealth * 0.3) this.transitionToRage();
        if (this.health <= 0) this.die();
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

        console.log("HEAVY SEC-BOT: ARMOR PLATES EJECTED - ENTERING OVERCLOCK MODE");
    }

    transitionToRage() {
        this.isRaging = true;
        this.moveSpeed *= 1.5; // Additional speed
        this.damage *= 1.2;    // More damage
        
        // Massive visual feedback
        const body = this.mesh.children[0];
        body.material.color.set(0xff0000); // Deep red
        
        if (this.particleSystem) {
            this.particleSystem.createExplosion(this.mesh.position, 0xff0000, 40, 5);
        }

        // Dedicated rage pulse light
        this.rageLight = new THREE.PointLight(0xff0000, 5, 10);
        this.mesh.add(this.rageLight);

        if (this.scene.game) {
            this.scene.game.shakeAmount = Math.max(this.scene.game.shakeAmount, 1.0);
            this.scene.game.showProgressionMessage("CRITICAL DANGER: TITAN UNIT ENTERING RAGE MODE");
        }
        
        console.log("HEAVY SEC-BOT: RAGE CORE ACTIVATED");
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

    executeEliteAbility(playerPos, otherEnemies, spatialGrid) {
        if (this.isDead || this.isDisabled) return;

        // Trigger unique elite audio handshake
        if (this.scene.game) {
            this.scene.game.triggerEliteSound(this.type);
        }

        switch (this.type) {
            case 'SENTRY':
                // Sentry Elite: Multi-shot burst
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        if (!this.isDead && !this.isDisabled) this.shoot(true, otherEnemies, spatialGrid);
                    }, i * 200);
                }
                break;
            case 'STALKER':
                // Stalker Elite: Sudden Dash
                const dashDir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
                this.mesh.position.add(dashDir.multiplyScalar(5));
                if (this.particleSystem) {
                    this.particleSystem.createExplosion(this.mesh.position, 0xff00ff, 10, 2);
                }
                break;
            case 'TANK':
                // Tank Elite: Shockwave Stomp
                if (this.particleSystem) {
                    this.particleSystem.createExplosion(this.mesh.position, 0xff00ff, 30, 8);
                }
                // Check if player is near
                if (this.mesh.position.distanceTo(playerPos) < 10) {
                    this.player.takeDamage(40);
                    // Push player? 
                }
                break;
            case 'SHIELD_PROJECTOR':
                // Shield Projector Elite: Massive Burst
                this.executeEMPBurst(otherEnemies);
                break;
            case 'HEAVY_SEC_BOT':
                // Already a boss, but if it's "Elite", maybe it fires faster
                this.lastAttack -= 2000; // Instant shoot
                break;
        }
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
        this.deathTimer = 0.3;
        
        const body = this.mesh.children[0];
        if (body && body.material) {
            body.material.transparent = true;
            body.material.opacity = 0.5;
            body.material.color.set(0xffaa00);
        }

        if (this.onDeath) this.onDeath(this);
        this.microDrones.forEach(drone => drone.destroy());
        this.microDrones = [];

        if (this.scene.particleSystem) {
            this.scene.particleSystem.createExplosion(this.mesh.position, 0xffaa00, 15, 3);
        }
    }
}
