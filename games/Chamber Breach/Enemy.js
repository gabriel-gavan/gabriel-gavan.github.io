import * as THREE from 'three';
import { CONFIG } from './config.js';
import { MicroDrone } from './MicroDrone.js';
import { createShieldMaterial } from './ShieldShader.js';
import { createBossMaterial } from './BossShader.js';
import { Weapon } from './Weapon.js';

// Texture cache to prevent reloading during spawns
const ENEMY_TEXTURES = {};
const ENEMY_TEXTURES_LOD = {};
const ENEMY_TEXTURE_PROMISES = {};
const ENEMY_TEXTURE_QUEUE = [];
const ENEMY_TEXTURES_READY = {};
const loader = new THREE.TextureLoader();

const SPRITE_URLS = {
    'SENTRY': 'https://rosebud.ai/assets/sentry_drone_new.webp?X9tu',
    'HEAVY_SEC_BOT': 'https://rosebud.ai/assets/heavy_sec_bot_new.webp.webp?2jap',
    'SHIELD_PROJECTOR': 'https://rosebud.ai/assets/shield_drone_sprite.webp.webp?R2lh',
    'TANK': 'https://rosebud.ai/assets/tank_bot_new.webp?Ygvw',
    'STALKER': 'https://rosebud.ai/assets/stalker_drone_v2.webp.webp?rfgU',
    'TITAN': 'https://rosebud.ai/assets/titan_boss_drone.webp?OFzL',
    'CLOAK_MASTER': 'https://rosebud.ai/assets/stalker_drone_v2.webp.webp?rfgU',
    'OBSIDIAN_JUGGERNAUT': 'https://rosebud.ai/assets/heavy_sec_bot_new.webp.webp?2jap',
    'CRYO_COMMANDER': 'https://rosebud.ai/assets/titan_boss_drone.webp?OFzL',
    'AETHERIS_OVERSEER': 'https://rosebud.ai/assets/titan_boss_drone.webp?OFzL',
    'TELEPORTER': 'https://rosebud.ai/assets/teleporter_drone.webp?Uhav',
    'SPLITTER': 'https://rosebud.ai/assets/splitter_drone.webp?8Wa1',
    'SUPPRESSOR': 'https://rosebud.ai/assets/suppressor_drone.webp?Tnb4',
    'EXPLODER': 'https://rosebud.ai/assets/exploder_drone.webp?Zgc6',
    'PARASITE': 'https://rosebud.ai/assets/parasite_drone.webp?FW41'
};

// Material/Geometry Cache to prevent excessive allocation
const MATERIAL_CACHE = new Map();
const GEO_CACHE = {
    hitbox: new THREE.BoxGeometry(1, 1, 1),
    beam: new THREE.CylinderGeometry(0.02, 0.5, 8, 8, 1, true),
    halo: new THREE.TorusGeometry(0.6, 0.04, 8, 24),
    shield: new THREE.SphereGeometry(1.5, 12, 12),
    projectorShield: new THREE.SphereGeometry(10, 16, 12)
};

const MUTATOR_COLORS = {
    'REGENERATOR': 0x00ff00,
    'SHIELD_BREAKER': 0x00ffff,
    'SPEED_DEMON': 0xff00ff,
    'TANK_PLATING': 0xffff00
};

function getFallbackTexture() {
    if (!ENEMY_TEXTURES.FALLBACK) {
        const canvas = document.createElement('canvas');
        canvas.width = 4;
        canvas.height = 4;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 4, 4);
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(0, 0, 2, 2);
        ctx.fillRect(2, 2, 2, 2);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        ENEMY_TEXTURES.FALLBACK = texture;
    }
    return ENEMY_TEXTURES.FALLBACK;
}

function createPlaceholderLODTexture(originalTexture) {
    const image = originalTexture?.image;
    if (!image) return getFallbackTexture();

    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    try {
        ctx.drawImage(image, 0, 0, size, size);
        const lodTex = new THREE.CanvasTexture(canvas);
        lodTex.minFilter = THREE.LinearFilter;
        lodTex.magFilter = THREE.LinearFilter;
        lodTex.generateMipmaps = false;
        return lodTex;
    } catch (err) {
        return getFallbackTexture();
    }
}

function scheduleLODTextureBuild(type, texture) {
    if (ENEMY_TEXTURES_LOD[type]) return;
    const build = () => {
        if (!ENEMY_TEXTURES_LOD[type]) {
            ENEMY_TEXTURES_LOD[type] = createPlaceholderLODTexture(texture);
        }
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(build, { timeout: 100 });
    } else {
        setTimeout(build, 0);
    }
}

function ensureEnemyTexture(type) {
    if (ENEMY_TEXTURES[type]) return ENEMY_TEXTURES[type];
    if (!SPRITE_URLS[type]) return getFallbackTexture();
    if (!ENEMY_TEXTURE_PROMISES[type]) {
        ENEMY_TEXTURE_PROMISES[type] = new Promise((resolve) => {
            loader.load(
                SPRITE_URLS[type],
                (tex) => {
                    tex.needsUpdate = true;
                    ENEMY_TEXTURES[type] = tex;
                    ENEMY_TEXTURES_READY[type] = true;
                    scheduleLODTextureBuild(type, tex);
                    resolve(tex);
                },
                undefined,
                () => {
                    ENEMY_TEXTURES[type] = getFallbackTexture();
                    ENEMY_TEXTURES_READY[type] = true;
                    resolve(ENEMY_TEXTURES[type]);
                }
            );
        });
    }
    return ENEMY_TEXTURES[type] || getFallbackTexture();
}

function getEnemyMaterial(type, isElite, isAlly) {
    const key = `${type}_${isElite}_${isAlly}`;
    if (!MATERIAL_CACHE.has(key)) {
        const map = ensureEnemyTexture(type);
        const color = isElite ? 0xff00ff : (isAlly ? 0x00ff00 : 0xffffff);
        MATERIAL_CACHE.set(key, new THREE.SpriteMaterial({ map, color, transparent: true }));
    }
    return MATERIAL_CACHE.get(key);
}

function getEnemyLODTexture(type) {
    return ENEMY_TEXTURES_LOD[type] || ENEMY_TEXTURES[type] || getFallbackTexture();
}

// Shared Math Pool to prevent GC
const MATH = {
    v1: new THREE.Vector3(),
    v2: new THREE.Vector3(),
    v3: new THREE.Vector3(),
    v4: new THREE.Vector3(),
    v5: new THREE.Vector3(),
    v6: new THREE.Vector3(),
    v7: new THREE.Vector3(),
    v8: new THREE.Vector3(),
    color: new THREE.Color(),
    sphere: new THREE.Sphere(),
    raycaster: new THREE.Raycaster()
};

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
        this.mutator = null; 
        
        this.path = [];
        this.pathIndex = 0;
        this.lastPathUpdate = 0;
        this.pathUpdateInterval = 800 + Math.random() * 1000; 
        this.spawnTime = Date.now();
        this.spawnWarmupMs = 250;
        this.spawnBurstCooldown = 0;
        this.isPathfinding = false;
        this.pathRequestToken = 0;
        
        const stats = CONFIG.ENEMY.TYPES[this.type];
        let buff = 1 + (heatLevel - 1) * CONFIG.HEAT.STAT_BUFF_PER_LEVEL;
        
        if (this.scene.game && this.scene.game.difficultyMultiplier) {
            buff *= this.scene.game.difficultyMultiplier;
        }

        if (this.isElite) {
            buff *= 1.5; 
            this.eliteAbilityTimer = 0;
            this.eliteAbilityCooldown = this.type === 'STALKER' ? 3000 : 5000;
            this.nextShootFxTime = 0;
            const mutators = ['REGENERATOR', 'SHIELD_BREAKER', 'SPEED_DEMON', 'TANK_PLATING'];
            this.mutator = mutators[Math.floor(Math.random() * mutators.length)];
            if (this.mutator === 'TANK_PLATING') buff *= 1.5;
            if (this.mutator === 'SPEED_DEMON') buff *= 1.2;
        }

        this.health = stats.HEALTH * buff;
        this.maxHealth = stats.HEALTH * buff;
        this.damage = stats.DAMAGE * buff;
        this.moveSpeed = stats.SPEED * buff;
        this.attackRange = stats.RANGE;
        this.scoreValue = stats.SCORE * (this.isElite ? 3 : 1);
        this.singularityResist = stats.SINGULARITY_RESIST || 0;
        this.phaseResist = stats.PHASE_RESIST || 0;

        this.isRaging = false;
        this.isAlly = false;
        this.isCloaked = false;
        
        this.visualLOD = null;
        this.sprites = [];
        this.hitboxes = [];

        const titanTypes = ['TITAN', 'CLOAK_MASTER', 'OBSIDIAN_JUGGERNAUT', 'CRYO_COMMANDER', 'AETHERIS_OVERSEER'];
        if (titanTypes.includes(this.type)) {
            this.isTitan = true;
        }

        if (this.facilityId === 'neon') {
            this.isCloaked = true;
            this.cloakRevealRange = 8; 
            this.cloakActionRange = 12; 
        }

        this.mesh = this.createMesh();
        this.mesh.position.copy(position);
        
        const groundTypes = ['STALKER', 'TANK', 'HEAVY_SEC_BOT', 'EXPLODER', 'PARASITE', 'OBSIDIAN_JUGGERNAUT'];
        if (groundTypes.includes(this.type)) {
            this.mesh.position.y = 0.1; 
        } else if (this.type === 'TITAN' || this.type === 'CLOAK_MASTER' || this.type === 'CRYO_COMMANDER' || this.type === 'AETHERIS_OVERSEER') {
            this.mesh.position.y = 8; 
        } else {
            this.mesh.position.y = 1.8; 
        }
        
        this.originalColor = new THREE.Color(0xffffff);
        this.hitFlashTimer = 0;
        this.deathTimer = 0;
        this.nextShootFxTime = 0;
        
        this.scene.add(this.mesh);
        this.isDead = false;
        this.lastAttack = 0;
        this.isDisabled = false;
        this.disableTimer = 0;
        this.targetEnemy = null;
        this.onDeath = null; 
        
        this.command = 'FOLLOW'; 
        this.stance = 'BALANCED'; 
        this.commandPos = new THREE.Vector3();
        this.commandTarget = null; 

        this.modules = []; 
        this.shieldHealth = 0;
        this.maxShieldHealth = 20;
        this.empBurstTimer = 0;
        this.singularityTimer = 0;
        this.kineticChainTimer = 0;
        this.wasSingularityActive = false;
        this.wasEchoActive = false;
        this.gravityWellFactor = 1.0;
        this.timeScale = 1.0; 
        this.isPhased = false; 
        this.resonanceOwner = null; 
        this.isResonating = false; 
        this.microDrones = [];
        this.onSingularityDetonate = null; 
        
        this.targetingLine = null;
        
        this.burnTimer = 0;
        this.burnDamage = 0;
        this.shockTimer = 0;
        this.lastShockChain = 0;

        if (this.type === 'HEAVY_SEC_BOT' || this.isTitan) {
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
            
            if (this.isTitan) {
                this.titanAttackTimer = 0;
                this.titanAttackCooldown = (this.type === 'CLOAK_MASTER' || this.type === 'CRYO_COMMANDER' || this.type === 'AETHERIS_OVERSEER') ? 3000 : 6000;
                if (this.type !== 'OBSIDIAN_JUGGERNAUT') this.mesh.position.y = 8; 
            }
        }

        if (this.type === 'SHIELD_PROJECTOR') {
            this.projectorShieldMesh = this.createProjectorShieldMesh();
            this.mesh.add(this.projectorShieldMesh);
            this.shieldRange = 10;
        }

        this.initWeapon();
    }

    initWeapon() {
        let cooldown = this.type === 'TANK' ? 4000 : (this.modules.includes('RAPID_FIRE') ? 1000 : 2000);
        if (this.type === 'STALKER') cooldown = 1000;
        
        this.weapon = new Weapon({
            name: this.type,
            cooldown: cooldown,
            damage: this.damage,
            projectileSpeed: 12,
            projectileColor: this.isAlly ? 0x00ff00 : 0xff0000,
            owner: this.isAlly ? 'PLAYER' : 'ENEMY',
            muzzleOffset: new THREE.Vector3(0, 0.5, 0.8),
            accuracy: this.isElite ? 0.95 : 0.85
        });
    }

    createTargetingLine() {
        const material = new THREE.LineBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.15,
            blending: THREE.AdditiveBlending 
        });
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 1)
        ]);
        this.targetingLine = new THREE.Line(geometry, material);
        this.targetingLine.name = 'targetingLine';
        this.targetingLine.frustumCulled = false;
        this.scene.add(this.targetingLine);
    }

    updateTargetingLine() {
        if (!this.targetingLine) return;

        if (this.isDead || this.isDisabled || !this.isAlly || !this.targetEnemy || this.targetEnemy.isDead) {
            this.targetingLine.visible = false;
            return;
        }

        this.targetingLine.visible = true;
        
        const start = MATH.v1.copy(this.mesh.position).add(MATH.v2.set(0, 0.5, 0));
        const end = MATH.v3.copy(this.targetEnemy.mesh.position).add(MATH.v2.set(0, 0.5, 0));
        
        const positions = this.targetingLine.geometry.attributes.position.array;
        positions[0] = start.x;
        positions[1] = start.y;
        positions[2] = start.z;
        positions[3] = end.x;
        positions[4] = end.y;
        positions[5] = end.z;
        this.targetingLine.geometry.attributes.position.needsUpdate = true;
        
        this.targetingLine.material.color.set(0x00ffff);
        
        const t = Date.now() * 0.01;
        this.targetingLine.material.opacity = 0.15 + Math.sin(t) * 0.1;
        
        if (this.lastKnownTarget !== this.targetEnemy) {
            this.lastKnownTarget = this.targetEnemy;
            if (this.particleSystem) {
                this.particleSystem.createExplosion(end, 0x00ffff, 5, 1);
            }
        }
    }

    createProjectorShieldMesh() {
        const geo = GEO_CACHE.projectorShield;
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
        const rangeSq = range * range;

        if (Date.now() % 5 === 0) {
            const nearby = spatialGrid ? spatialGrid.getNearby(this.mesh.position, range) : [];
            for (let i = 0; i < nearby.length; i++) {
                const e = nearby[i];
                if (e !== this && !e.isDead && e.isAlly === this.isAlly) {
                    const dx = e.mesh.position.x - this.mesh.position.x;
                    const dz = e.mesh.position.z - this.mesh.position.z;
                    if (dx*dx + dz*dz < rangeSq) {
                        e.hasProjectedShield = true;
                        e.projectedShieldTimer = 250; 
                    }
                }
            }

            if (this.isAlly) {
                const dpx = playerPos.x - this.mesh.position.x;
                const dpz = playerPos.z - this.mesh.position.z;
                if (dpx*dpx + dpz*dpz < rangeSq) {
                    this.player.hasProjectedShield = true;
                    this.player.projectedShieldTimer = 250;
                }
            }
        }
    }

    createAdaptiveShieldMesh() {
        const geo = GEO_CACHE.shield;
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
        if (!this.visualLOD) return;
        
        const highGroup = this.visualLOD.levels[0].object;
        const existingGroup = highGroup.getObjectByName('moduleGroup');
        if (existingGroup) highGroup.remove(existingGroup);

        const newGroup = new THREE.Group();
        newGroup.name = 'moduleGroup';

        this.modules.forEach((mod) => {
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
                const fieldGeo = new THREE.SphereGeometry(6, 16, 16);
                const fieldMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.05, wireframe: true });
                const field = new THREE.Mesh(fieldGeo, fieldMat);
                field.name = 'overclock_visual_field';
                modMesh.add(field);
            } else if (mod === 'GRAVITY_SINGULARITY') {
                const geo = new THREE.IcosahedronGeometry(0.3, 2);
                const mat = new THREE.MeshStandardMaterial({ color: 0x6600ff, emissive: 0x220055, wireframe: true });
                modMesh = new THREE.Mesh(geo, mat);
                modMesh.position.set(0, -0.6, 0);
                modMesh.name = 'singularity_core';
                const particleCount = 12;
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
            }
            if (modMesh) newGroup.add(modMesh);
        });

        highGroup.add(newGroup);
    }

    createMesh() {
        const group = new THREE.Group();
        const scale = (CONFIG.ENEMY.TYPES[this.type].SCALE || 1.5) * (this.isElite ? 1.3 : 1.0);
        
        const lod = new THREE.LOD();
        lod.name = 'visualLOD';
        this.visualLOD = lod;

        const highResMaterial = getEnemyMaterial(this.type, this.isElite, this.isAlly).clone();
        const lowResKey = `${this.type}_${this.isElite}_${this.isAlly}_low`;
        if (!MATERIAL_CACHE.has(lowResKey)) {
            const baseMat = getEnemyMaterial(this.type, this.isElite, this.isAlly);
            const lowMat = baseMat.clone();
            lowMat.map = getEnemyLODTexture(this.type);
            MATERIAL_CACHE.set(lowResKey, lowMat);
        }
        const lowResMaterial = MATERIAL_CACHE.get(lowResKey);

        const highGroup = new THREE.Group();
        const highSprite = new THREE.Sprite(highResMaterial);
        highSprite.scale.set(scale, scale, 1);
        
        const groundTypes = ['STALKER', 'TANK', 'HEAVY_SEC_BOT'];
        if (groundTypes.includes(this.type)) {
            highSprite.center.set(0.5, 0); 
        }
        highGroup.add(highSprite);
        this.sprites[0] = highSprite;

        let glowColor = this.type === 'SENTRY' ? 0x00ffaa : (this.type === 'STALKER' ? 0xff3300 : 0x00ffff);
        if (this.isElite) glowColor = 0xff00ff;
        const lightIntensity = this.isElite ? 2.0 : 0.2;
        const lightDistance = this.isElite ? 4.0 : 2.0;

        this.glow = new THREE.PointLight(glowColor, lightIntensity, lightDistance);
        this.glow.position.y = -0.5;
        this.glow.userData.isEnemyGlow = true; 
        highGroup.add(this.glow);

        if (this.isElite) {
            const haloGeo = GEO_CACHE.halo;
            const haloColor = MUTATOR_COLORS[this.mutator] || 0xff00ff;
            const haloMat = new THREE.MeshBasicMaterial({ color: haloColor, transparent: true, opacity: 0.4 });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.rotation.x = Math.PI / 2;
            halo.position.y = scale * 0.7;
            halo.name = 'eliteHalo';
            highGroup.add(halo);
        }

        if (this.type === 'SENTRY') {
            const beamGeo = GEO_CACHE.beam;
            const beamMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
            this.scanBeam = new THREE.Mesh(beamGeo, beamMat);
            this.scanBeam.rotation.x = Math.PI / 2;
            this.scanBeam.position.z = -4;
            highGroup.add(this.scanBeam);
        }

        if (this.isTitan || this.type === 'AETHERIS_OVERSEER') {
            const bossGeo = new THREE.SphereGeometry(scale * 1.5, 16, 16);
            this.bossMaterial = createBossMaterial(0x00d0ff);
            this.bossEmergenceMesh = new THREE.Mesh(bossGeo, this.bossMaterial);
            highGroup.add(this.bossEmergenceMesh);
            this.emergenceTimer = 5.0;
        }
        
        lod.addLevel(highGroup, 0);

        const medGroup = new THREE.Group();
        const medSprite = new THREE.Sprite(highResMaterial);
        medSprite.scale.copy(highSprite.scale);
        medSprite.center.copy(highSprite.center);
        medGroup.add(medSprite);
        this.sprites[1] = medSprite;
        lod.addLevel(medGroup, CONFIG.ENEMY.LOD.MEDIUM_DIST);

        const lowGroup = new THREE.Group();
        const lowSprite = new THREE.Sprite(lowResMaterial);
        lowSprite.scale.copy(highSprite.scale);
        lowSprite.center.copy(highSprite.center);
        lowGroup.add(lowSprite);
        this.sprites[2] = lowSprite;
        lod.addLevel(lowGroup, CONFIG.ENEMY.LOD.LOW_DIST);

        group.add(lod);

        const hitboxGeo = GEO_CACHE.hitbox;
        const hitboxMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0, visible: false });
        const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
        hitbox.scale.set(scale * 0.8, scale * 1.2, scale * 0.8);
        hitbox.name = 'hitbox';
        hitbox.userData.isEnemyHitbox = true; 
        hitbox.userData.enemyRef = this; 
        group.add(hitbox);

        return group;
    }

    update(deltaTime, playerPos, activeSmokeScreens = [], isThermalActive = false, otherEnemies = [], turrets = [], map = null, spatialGrid = null, frameCounter = 0) {
        const nowMs = Date.now();
        const myPos = this.mesh.position;
        const distToPlayerSq = playerPos ? myPos.distanceToSquared(playerPos) : 10000;
        const performanceTier = distToPlayerSq > 3600 ? 2 : (distToPlayerSq > 900 ? 1 : 0);
        if (this.spawnBurstCooldown > 0) this.spawnBurstCooldown -= deltaTime * 1000;
        const isWarmingUp = nowMs - this.spawnTime < this.spawnWarmupMs;

        let updateModulo = 1;
        if (distToPlayerSq > 3600) updateModulo = 12;
        else if (distToPlayerSq > 900) updateModulo = 6;
        else if (distToPlayerSq > 225) updateModulo = 2;

        const shouldUpdateLogic = (frameCounter + this.mesh.id) % updateModulo === 0;
        const shouldUpdateVisuals = performanceTier === 0 || (performanceTier === 1 && (frameCounter + this.mesh.id) % 2 === 0);
        const shouldUpdateCombat = !isWarmingUp && shouldUpdateLogic && this.spawnBurstCooldown <= 0 && (performanceTier === 0 || (frameCounter + (this.mesh.id * 7)) % (updateModulo * 2) === 0);

        if (this.isAlly && this.targetingLine && shouldUpdateVisuals) {
            this.updateTargetingLine();
        }

        if (this.isDead) {
            if (this.targetingLine) this.targetingLine.visible = false; 
            if (this.deathTimer > 0) {
                this.deathTimer -= deltaTime;
                this.sprites.forEach(sprite => {
                    if (sprite && sprite.material) {
                        sprite.material.opacity = Math.max(0, this.deathTimer / 0.2);
                    }
                });
                this.mesh.scale.addScalar(deltaTime * 1.5);
                if (this.deathTimer <= 0) {
                    this.scene.remove(this.mesh);
                }
            }
            return;
        }

        if (!shouldUpdateLogic) {
            if (distToPlayerSq > (CONFIG.ENEMY.LOD.CULL_DIST * CONFIG.ENEMY.LOD.CULL_DIST)) {
                this.mesh.visible = false;
                return;
            } else {
                this.mesh.visible = true;
            }
            if (this.path && this.path.length > 0 && this.pathIndex < this.path.length) {
                const nextPoint = this.path[this.pathIndex];
                if (myPos.distanceToSquared(nextPoint) < 1.0) this.pathIndex++;
                if (this.pathIndex < this.path.length) {
                    const targetPt = this.path[this.pathIndex];
                    const moveDir = MATH.v1.subVectors(targetPt, myPos).normalize();
                    const finalMoveSpeed = this.moveSpeed * this.timeScale;
                    myPos.x += moveDir.x * finalMoveSpeed * deltaTime * updateModulo;
                    myPos.z += moveDir.z * finalMoveSpeed * deltaTime * updateModulo;
                }
            }
            return; 
        }

        if ((this.isTitan || this.type === 'HEAVY_SEC_BOT') && !this.isDisabled) {
            this.titanAttackTimer = (this.titanAttackTimer || 0) + deltaTime * 1000 * updateModulo;
            if (this.titanAttackTimer > (this.titanAttackCooldown || 6000)) {
                this.executeTitanAttack(playerPos, otherEnemies);
                this.titanAttackTimer = 0;
            }
            
            if (this.isTitan) {
                const t = Date.now() * 0.001;
                this.mesh.position.y = (this.type === 'AETHERIS_OVERSEER' ? 12 : 7) + Math.sin(t) * 2;
                this.mesh.rotation.z = Math.sin(t * 0.5) * 0.1;
                
                if (this.bossMaterial && this.emergenceTimer > 0) {
                    this.emergenceTimer -= deltaTime * updateModulo;
                    const progress = Math.max(0, this.emergenceTimer / 5.0);
                    this.bossMaterial.uniforms.emergence.value = progress;
                    this.bossMaterial.uniforms.time.value = t;
                    this.bossMaterial.uniforms.distortion.value = 1.0 + progress * 5.0;
                    this.bossMaterial.uniforms.glitch.value = progress > 0.5 ? progress : 0;
                    
                    if (this.scene.game && this.scene.game.setBossGlitch) {
                        this.scene.game.setBossGlitch(this.bossMaterial.uniforms.glitch.value);
                    }
                    
                    if (this.emergenceTimer <= 0) {
                        const highGroup = this.visualLOD.levels[0].object;
                        highGroup.remove(this.bossEmergenceMesh);
                        this.bossMaterial.dispose();
                        this.bossEmergenceMesh.geometry.dispose();
                        this.bossMaterial = null;
                        this.bossEmergenceMesh = null;
                        this.sprites.forEach(s => s.material.opacity = 1.0);
                        if (this.scene.game && this.scene.game.setBossGlitch) {
                            this.scene.game.setBossGlitch(0);
                        }
                    } else {
                        this.sprites.forEach(s => s.material.opacity = 1.0 - progress);
                    }
                }
            }
        }

        if (this.isElite && !this.isDisabled && shouldUpdateVisuals) {
            this.eliteAbilityTimer = (this.eliteAbilityTimer || 0) + deltaTime * 1000 * updateModulo;
            if (this.eliteAbilityTimer > this.eliteAbilityCooldown) {
                this.executeEliteAbility(playerPos, otherEnemies, spatialGrid);
                this.eliteAbilityTimer = 0;
            }

            const halo = this.mesh.getObjectByName('eliteHalo');
            if (halo) {
                halo.rotation.z += deltaTime * 2 * updateModulo;
                halo.position.y += Math.sin(Date.now() * 0.005) * 0.005;
            }
        }

        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= deltaTime * updateModulo;
            if (this.hitFlashTimer <= 0) {
                this.sprites.forEach(sprite => {
                    if (sprite && sprite.material) {
                        sprite.material.color.copy(this.originalColor);
                    }
                });
            }
        }

        let targetPos = playerPos;
        let targetingPlayer = true;

        if (this.isAlly) {
            targetingPlayer = false;
            const game = this.scene.game;
            let currentCommand = this.command;

            if (game && game.isHackingTerminal && game.currentTerminal) {
                const termPos = game.currentTerminal.group.position;
                let highThreatTarget = null;
                const huntRangeSq = 225;

                const nearby = spatialGrid ? spatialGrid.getNearby(myPos, 15) : otherEnemies;
                for (let i = 0; i < nearby.length; i++) {
                    const e = nearby[i];
                    if (!e.isAlly && !e.isDead && (e.type === 'STALKER' || e.isElite || e.isTitan)) {
                        if (myPos.distanceToSquared(e.mesh.position) < huntRangeSq) {
                            highThreatTarget = e;
                            break;
                        }
                    }
                }

                if (highThreatTarget) {
                    currentCommand = 'STRIKE';
                    this.targetEnemy = highThreatTarget;
                    targetPos = highThreatTarget.mesh.position;
                    if (this.glow) {
                        this.glow.color.set(0xff0000); 
                        this.glow.intensity = 3 + Math.sin(Date.now() * 0.02) * 2;
                    }
                } else if (this.command === 'FOLLOW' || this.command === 'DEFEND') {
                    currentCommand = 'DEFEND';
                    const offsetAngle = (this.mesh.id % 8) * (Math.PI / 4);
                    const offsetDist = 4 + (this.mesh.id % 3) * 2;
                    targetPos = MATH.v1.copy(termPos);
                    targetPos.x += Math.cos(offsetAngle) * offsetDist;
                    targetPos.z += Math.sin(offsetAngle) * offsetDist;
                    if (this.glow) {
                        this.glow.color.set(0x00ff00);
                        this.glow.intensity = 1.0;
                    }
                }
            } else {
                if (this.glow && this.isAlly && !this.isDisabled) this.glow.color.set(0x00ff00);
                if (this.command === 'DEFEND') targetPos = this.commandPos;
                else if (this.command === 'STRIKE' && this.commandTarget && !this.commandTarget.isDead) targetPos = this.commandTarget.mesh.position;
                else targetPos = playerPos; 
            }

            if (Date.now() - (this.lastTargetUpdate || 0) > 500) {
                this.lastTargetUpdate = Date.now();
                if (!(currentCommand === 'STRIKE' && this.targetEnemy && !this.targetEnemy.isDead)) {
                    let minDistSq = Infinity;
                    this.targetEnemy = null;
                    const detRange = CONFIG.ENEMY.DETECTION_RANGE;
                    const detRangeSq = detRange * detRange;
                    const nearby = spatialGrid ? spatialGrid.getNearby(myPos, detRange) : otherEnemies;
                    for (let i = 0; i < nearby.length; i++) {
                        const e = nearby[i];
                        if (e !== this && !e.isAlly && !e.isDead) {
                            const dSq = myPos.distanceToSquared(e.mesh.position);
                            if (dSq < minDistSq && dSq < detRangeSq) {
                                minDistSq = dSq;
                                this.targetEnemy = e;
                                if (dSq < 25) break;
                            }
                        }
                    }
                }
            }
            if (this.targetEnemy) targetPos = this.targetEnemy.mesh.position;
        } else {
            if (Date.now() - (this.lastTargetUpdate || 0) > 600) {
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

        if (this.projectedShieldTimer > 0) {
            this.projectedShieldTimer -= deltaTime * 1000 * updateModulo;
            if (this.projectedShieldTimer <= 0) this.hasProjectedShield = false;
        }

        if (this.type === 'SHIELD_PROJECTOR' && !this.isDisabled) {
            this.updateShieldProjector(deltaTime * updateModulo, otherEnemies, playerPos, spatialGrid);
        }

        if (nowMs - (this.lastAvoidUpdate || 0) > 250) {
            this.lastAvoidUpdate = nowMs;
            this.currentAvoidance = this.currentAvoidance || new THREE.Vector3();
            this.currentAvoidance.set(0, 0, 0);
            const nearby = spatialGrid ? spatialGrid.getNearby(myPos, 2) : [];
            for (let i = 0; i < Math.min(nearby.length, 2); i++) {
                const e = nearby[i];
                if (e === this || e.isDead) continue;
                const dSq = myPos.distanceToSquared(e.mesh.position);
                if (dSq < 2.25) {
                    const d = Math.sqrt(dSq) || 0.001;
                    MATH.v1.subVectors(myPos, e.mesh.position).normalize();
                    this.currentAvoidance.add(MATH.v1.multiplyScalar(0.5 / d));
                }
            }
        }

        if (nowMs - (this.lastWallAvoidUpdate || 0) > 400) {
            this.lastWallAvoidUpdate = nowMs;
            this.wallAvoidance = this.wallAvoidance || new THREE.Vector3();
            this.wallAvoidance.set(0, 0, 0);
            if (map && map.checkCollision(myPos, 1.2, this.myChamberIdx)) {
                const cur = this.myChamberIdx !== null ? map.chambers[this.myChamberIdx] : null;
                if (cur) {
                    MATH.v1.set(cur.x, myPos.y, cur.z).sub(myPos).normalize();
                    this.wallAvoidance.add(MATH.v1.multiplyScalar(3.0));
                }
            }
        }

        const combinedAvoidance = MATH.v2.copy(this.currentAvoidance || MATH.v1.set(0,0,0)).add(this.wallAvoidance || MATH.v1.set(0,0,0));

        if (this.burnTimer > 0) {
            this.burnTimer -= deltaTime * updateModulo;
            this.takeDamage(this.burnDamage * deltaTime * updateModulo, otherEnemies, 'INCENDIARY');
        }

        if (this.mutator === 'REGENERATOR' && !this.isDead && this.health < this.maxHealth) {
            this.health = Math.min(this.maxHealth, this.health + (this.maxHealth * 0.02 * deltaTime * updateModulo));
        }

        if (this.shockTimer > 0) {
            this.shockTimer -= deltaTime * updateModulo;
            this.timeScale = 0.2; 
            if (Math.random() < 0.1) {
                this.sprites.forEach(s => {
                    if (s && s.material) s.material.color.set(0x00ffff);
                });
            }
            if (nowMs - this.lastShockChain > 1500) {
                this.lastShockChain = nowMs;
                this.executeChainLightning(this, 10, otherEnemies);
            }
        } else if (this.timeScale === 0.2) {
            this.timeScale = 1.0;
        }

        if (this.isAlly && (nowMs - (this.lastOverclockCheck || 0) > 800)) {
            this.lastOverclockCheck = nowMs;
            this.isOverclocked = false;
            const nearby = spatialGrid ? spatialGrid.getNearby(this.mesh.position, 6) : [];
            for (let i = 0; i < nearby.length; i++) {
                const e = nearby[i];
                if (e.isAlly && !e.isDead && e.modules.includes('OVERCLOCK')) {
                    if (e.mesh.position.distanceToSquared(this.mesh.position) < 36) {
                        this.isOverclocked = true;
                        break;
                    }
                }
            }
        }

        if (this.navigation && !this.isPathfinding && nowMs - this.lastPathUpdate > this.pathUpdateInterval) {
            this.lastPathUpdate = nowMs;
            this.isPathfinding = true;
            const pathToken = ++this.pathRequestToken;
            const pathTarget = MATH.v4.copy(targetPos);
            const self = this;
            this.navigation.findPathAsync(this.mesh.position, pathTarget, function(newPath) {
                if (pathToken !== self.pathRequestToken) return;
                self.isPathfinding = false;
                if (newPath && !self.isDead) {
                    self.path = newPath.map(function(p) { return new THREE.Vector3(p.x, 0.5, p.z); });
                    self.pathIndex = 0;
                }
            });
        }

        if (shouldUpdateVisuals) this.sprites.forEach(sprite => {
            if (!sprite || !sprite.material) return;
            const mat = sprite.material;
            if (this.isAlly) {
                mat.color.set(this.isCloaked ? 0x4444ff : 0x00ff00);
                if (this.isCloaked) mat.opacity = 0.3;
            } else if (this.isCloaked) {
                mat.opacity = 0.05 + Math.sin(nowMs * 0.01) * 0.05;
                mat.color.set(0x8800ff);
            }

            if (isThermalActive) {
                mat.opacity = 1.0;
                mat.color.set(this.isAlly ? 0x00ffaa : 0xff5500); 
            } else {
                this.isInSmoke = activeSmokeScreens.some(smoke => smoke.checkCollision(myPos));
        if (this.isInSmoke) {
            mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.2, deltaTime * 5);
            if (!this.isAlly) mat.color.set(0x666666);
            this.targetY = 4.5; 
        } else if (!this.isCloaked) {
                    mat.opacity = THREE.MathUtils.lerp(mat.opacity, 1.0, deltaTime * 5);
                    if (!this.isAlly) mat.color.set(0xffffff);
                    this.targetY = 1.5 + Math.sin(nowMs * 0.005) * 0.2;
                }
            }
        });

        const distSq = myPos.distanceToSquared(targetPos);
        
        if (this.visualLOD && this.scene.game && this.scene.game.camera) {
            this.visualLOD.update(this.scene.game.camera);
        }

        if (distSq < 2500) {
            this.mesh.lookAt(targetPos.x, myPos.y, targetPos.z);

            if (!this.isDisabled) {
                if (this.type === 'EXPLODER' && distSq < 9) this.die(); 
                if (this.type === 'PARASITE' && distSq < 4) {
                    this.player.takeDamage(5 * deltaTime * 10 * updateModulo);
                    if (Math.random() < 0.1) this.player.shakeAmount += 0.2;
                }
            }

            let moveDistThreshold = targetingPlayer ? this.attackRange * 0.8 : 5;
            let finalMoveSpeed = this.moveSpeed * this.timeScale;
            if (this.isAlly) {
                if (this.stance === 'AGGRESSIVE') { moveDistThreshold *= 0.5; finalMoveSpeed *= 1.3; }
                else if (this.stance === 'DEFENSIVE') { moveDistThreshold *= 1.5; finalMoveSpeed *= 0.8; }
            }

            let moveDir = null;
            if (this.isElite && !this.isAlly && this.scene.game?.insaneMomentActive) {
                moveDir = MATH.v3.subVectors(myPos, playerPos).normalize();
                finalMoveSpeed *= 1.5; moveDistThreshold = 0;
            }

            if (distSq > moveDistThreshold * moveDistThreshold) {
                if (!moveDir) {
                    if (this.path && this.path.length > 0 && this.pathIndex < this.path.length) {
                        const nextPoint = this.path[this.pathIndex];
                        if (myPos.distanceToSquared(nextPoint) < 1.0) this.pathIndex++;
                        if (this.pathIndex < this.path.length) moveDir = MATH.v3.subVectors(this.path[this.pathIndex], myPos).normalize();
                        else moveDir = MATH.v3.subVectors(targetPos, myPos).normalize();
                    } else {
                        moveDir = MATH.v3.subVectors(targetPos, myPos).normalize();
                    }
                }
                moveDir.add(combinedAvoidance.multiplyScalar(0.5)).normalize();
                if (this.isOverclocked) finalMoveSpeed *= 1.5;
                
                myPos.x += moveDir.x * finalMoveSpeed * deltaTime * updateModulo;
                myPos.z += moveDir.z * finalMoveSpeed * deltaTime * updateModulo;
            }

            if (this.type !== 'TANK' && this.type !== 'STALKER') {
                myPos.y = THREE.MathUtils.lerp(myPos.y, this.targetY || 1.5, deltaTime * 2 * updateModulo);
            }

            let canSeeTarget = !this.isInSmoke || myPos.y > 3.5;
            if (canSeeTarget && map && distSq < this.attackRange * this.attackRange) {
                if (distSq < 16) this.isLoSBlocked = false;
                else if (nowMs - (this.lastLoSCheck || 0) > 500) {
                    this.lastLoSCheck = nowMs;
                    const checkDir = MATH.v3.subVectors(targetPos, myPos).normalize();
                    MATH.raycaster.set(myPos, checkDir);
                    const obstacles = [];
                    if (this.myChamberIdx !== null && map.spatialGrid.has(this.myChamberIdx)) {
                        const indices = map.spatialGrid.get(this.myChamberIdx);
                        for(let i=0; i < Math.min(indices.length, 10); i++) obstacles.push(map.walls[indices[i]]);
                    }
                    if (obstacles.length > 0) {
                        const hits = MATH.raycaster.intersectObjects(obstacles, true);
                        this.isLoSBlocked = (hits.length > 0 && hits[0].distance < Math.sqrt(distSq) - 0.5);
                    }
                }
                if (this.isLoSBlocked) canSeeTarget = false;
            }

            let cooldownMult = 1.0;
            if (this.isRaging) cooldownMult *= 0.5;
            if (this.isAlly) cooldownMult *= (this.stance === 'AGGRESSIVE' ? 0.7 : (this.stance === 'DEFENSIVE' ? 1.2 : 1.0));
            cooldownMult /= this.timeScale; 
            if (this.isOverclocked) cooldownMult *= 0.6; 

            let baseCooldown = (this.type === 'TANK' ? 4000 : (this.modules.includes('RAPID_FIRE') ? 1000 : 2000));
            if (this.type === 'STALKER') baseCooldown = 1000;
            this.weapon.cooldown = baseCooldown * cooldownMult;

            if (canSeeTarget && distSq < this.attackRange * this.attackRange && shouldUpdateCombat) {
                this.shoot(targetingPlayer, otherEnemies, spatialGrid);
            }
        }
    }

    shoot(targetingPlayer = true, otherEnemies = [], spatialGrid = null) {
        const now = Date.now();
        if (now < (this.nextShootFxTime || 0)) return;

        const muzzlePos = MATH.v1.copy(this.mesh.position).add(MATH.v2.set(0, 0.5, 0));
        
        let targetPos;
        if (this.isAlly && this.targetEnemy) targetPos = this.targetEnemy.mesh.position;
        else if (targetingPlayer) targetPos = this.player.camera.position;

        if (targetPos && this.weapon) {
            const shootDir = MATH.v3.subVectors(targetPos, muzzlePos).normalize();
            muzzlePos.add(shootDir.clone().multiplyScalar(0.8));

            const fired = this.weapon.fire(muzzlePos, shootDir, this.scene.game, {
                damageType: this.mutator
            });
            
            if (fired) {
                // Add a small randomized recovery window so groups of enemies don't fire in sync
                this.nextShootFxTime = now + (this.isElite ? 140 : 180) + Math.floor(Math.random() * 60);
                this.hitFlashTimer = 0;
                this.spawnBurstCooldown = Math.max(this.spawnBurstCooldown, this.isElite ? 80 : 140);

                if (!this.isAlly) {
                    this.sprites.forEach(s => {
                        if (s && s.material) s.material.color.set(0xffffff);
                    });
                }

                if (this.isAlly && this.targetEnemy) {
                    let damage = this.damage * (this.player.perks?.droneBuild ? 1.5 : 1.0);
                    if (this.modules.includes('HEAVY_LASER')) damage *= 1.5;
                    let dtype = 'PLAYER';
                    if (this.player.perks?.fireBuild) dtype = 'INCENDIARY';
                    else if (this.player.perks?.shockBuild) dtype = 'SHOCK';
                    this.targetEnemy.takeDamage(damage, otherEnemies, dtype, spatialGrid);
                }
            }
        }
    }

    takeDamage(amount, sourceEnemies = [], damageType = 'PLAYER', spatialGrid = null) {
        if (this.isDead || this.isPhased) return; 
        let final = amount * (this.gravityWellFactor || 1.0);
        if (this.isFragile) final *= 1.5;
        if (this.isFrozen && damageType === 'PLAYER') final *= 2.0;

        if (damageType === 'INCENDIARY' && this.burnTimer <= 0) {
            this.burnTimer = 3.0; this.burnDamage = amount * 0.4;
        } else if (damageType === 'SHOCK' && this.shockTimer <= 0) {
            this.shockTimer = 1.2; this.lastShockChain = Date.now();
            this.executeChainLightning(this, amount * 0.5, sourceEnemies, spatialGrid);
        }

        if (this.hasProjectedShield) final *= 0.25; 

        if (this.isAlly && this.shieldHealth > 0) {
            this.shieldHealth -= final;
            if (this.shieldHealth < 0) { this.health -= Math.abs(this.shieldHealth); this.shieldHealth = 0; }
        } else this.health -= final;

        this.sprites.forEach(sprite => {
            if (sprite && sprite.material) {
                if (this.hitFlashTimer <= 0) this.originalColor.copy(sprite.material.color);
                sprite.material.color.set(0xffffff);
            }
        });
        this.hitFlashTimer = 0;
        if (this.scene.game) this.scene.game.hitFeedback(damageType === 'SHOCK' ? 0.5 : 1.0);

        if (this.health <= 0) this.die();
    }

    die() {
        if (this.isDead) return;
        this.isDead = true;
        this.deathTimer = 0.2;
        if (this.glow) this.glow.visible = false;
        if (this.onDeath) this.onDeath(this);
    }

    reset(scene, player, position, type, facilityId, navigation, particleSystem, heatLevel, isElite) {
        this.scene = scene;
        this.player = player;
        this.type = type;
        this.facilityId = facilityId;
        this.navigation = navigation;
        this.particleSystem = particleSystem;
        this.heatLevel = heatLevel;
        this.isElite = isElite;
        this.mutator = null;

        this.path = [];
        this.pathIndex = 0;
        this.lastPathUpdate = 0;
        this.pathUpdateInterval = 800 + Math.random() * 1000;
        this.isPathfinding = false;
        this.pathRequestToken++;

        const stats = CONFIG.ENEMY.TYPES[this.type];
        let buff = 1 + (heatLevel - 1) * CONFIG.HEAT.STAT_BUFF_PER_LEVEL;
        if (this.scene.game && this.scene.game.difficultyMultiplier) {
            buff *= this.scene.game.difficultyMultiplier;
        }
        if (this.isElite) {
            buff *= 1.5;
            this.eliteAbilityTimer = 0;
            this.eliteAbilityCooldown = this.type === 'STALKER' ? 3000 : 5000;
            const mutators = ['REGENERATOR', 'SHIELD_BREAKER', 'SPEED_DEMON', 'TANK_PLATING'];
            this.mutator = mutators[Math.floor(Math.random() * mutators.length)];
            if (this.mutator === 'TANK_PLATING') buff *= 1.5;
            if (this.mutator === 'SPEED_DEMON') buff *= 1.2;
        }

        this.health = stats.HEALTH * buff;
        this.maxHealth = stats.HEALTH * buff;
        this.damage = stats.DAMAGE * buff;
        this.moveSpeed = stats.SPEED * buff;
        this.attackRange = stats.RANGE;
        this.scoreValue = stats.SCORE * (this.isElite ? 3 : 1);
        this.singularityResist = stats.SINGULARITY_RESIST || 0;
        this.phaseResist = stats.PHASE_RESIST || 0;

        this.isRaging = false;
        this.isAlly = facilityId === 'ally';
        this.isCloaked = false;
        this.isDead = false;
        this.isDisabled = false;
        this.disableTimer = 0;
        this.isDecoy = false;
        this.isHunter = false;
        this.isPhased = false;
        this.isResonating = false;
        this.isFragile = false;
        this.isFrozen = false;
        this.hasProjectedShield = false;
        this.projectedShieldTimer = 0;

        const titanTypes = ['TITAN', 'CLOAK_MASTER', 'OBSIDIAN_JUGGERNAUT', 'CRYO_COMMANDER', 'AETHERIS_OVERSEER'];
        this.isTitan = titanTypes.includes(this.type);

        if (this.facilityId === 'neon') {
            this.isCloaked = true;
            this.cloakRevealRange = 8;
            this.cloakActionRange = 12;
        }

        this.mesh.position.copy(position);
        const groundTypes = ['STALKER', 'TANK', 'HEAVY_SEC_BOT', 'EXPLODER', 'PARASITE', 'OBSIDIAN_JUGGERNAUT'];
        if (groundTypes.includes(this.type)) {
            this.mesh.position.y = 0.1;
        } else if (this.type === 'TITAN' || this.type === 'CLOAK_MASTER' || this.type === 'CRYO_COMMANDER' || this.type === 'AETHERIS_OVERSEER') {
            this.mesh.position.y = 8;
        } else {
            this.mesh.position.y = 1.8;
        }

        this.mesh.scale.set(1, 1, 1);
        this.mesh.visible = true;
        this.originalColor = new THREE.Color(0xffffff);
        this.hitFlashTimer = 0;
        this.deathTimer = 0;
        this.nextShootFxTime = 0;

        this.sprites.forEach(sprite => {
            if (sprite && sprite.material) {
                sprite.material.opacity = 1.0;
                sprite.material.color.set(this.isAlly ? 0x00ff00 : (this.isElite ? 0xff00ff : 0xffffff));
            }
        });

        if (this.glow) {
            this.glow.visible = true;
            let glowColor = this.type === 'SENTRY' ? 0x00ffaa : (this.type === 'STALKER' ? 0xff3300 : 0x00ffff);
            if (this.isElite) {
                glowColor = MUTATOR_COLORS[this.mutator] || 0xff00ff;
                const halo = this.mesh.getObjectByName('eliteHalo');
                if (halo && halo.material) {
                    halo.material.color.set(glowColor);
                }
            }
            this.glow.color.set(glowColor);
            this.glow.intensity = this.isElite ? 2.0 : 0.2;
            this.glow.distance = this.isElite ? 4.0 : 2.0;
        }

        if (this.visualLOD) {
            this.visualLOD.visible = true;
        }

        this.lastAttack = 0;
        this.targetEnemy = null;
        this.onDeath = null;
        this.onSingularityDetonate = null;

        this.command = 'FOLLOW';
        this.stance = 'BALANCED';
        this.commandPos.set(0, 0, 0);
        this.commandTarget = null;

        this.modules = [];
        this.shieldHealth = 0;
        this.maxShieldHealth = 20;
        this.empBurstTimer = 0;
        this.singularityTimer = 0;
        this.kineticChainTimer = 0;
        this.wasSingularityActive = false;
        this.wasEchoActive = false;
        this.gravityWellFactor = 1.0;
        this.timeScale = 1.0;
        this.resonanceOwner = null;

        this.microDrones = [];

        if (this.targetingLine) {
            this.targetingLine.visible = false;
        }
        this.lastKnownTarget = null;

        this.burnTimer = 0;
        this.burnDamage = 0;
        this.shockTimer = 0;
        this.lastShockChain = 0;

        if (this.type === 'HEAVY_SEC_BOT' || this.isTitan) {
            this.adaptiveResistances = { 'LASER': 0, 'EMP': 0, 'SLOW': 0, 'PLAYER': 0 };
            this.currentShieldType = null;
            this.bossPhase = 1;

            if (this.shieldMesh) {
                this.shieldMesh.visible = false;
                if (this.shieldMesh.material?.uniforms) {
                    this.shieldMesh.material.uniforms.impactStrength.value = 0;
                }
            }

            if (this.isTitan) {
                this.titanAttackTimer = 0;
                this.titanAttackCooldown = (this.type === 'CLOAK_MASTER' || this.type === 'CRYO_COMMANDER' || this.type === 'AETHERIS_OVERSEER') ? 3000 : 6000;
                if (this.type !== 'OBSIDIAN_JUGGERNAUT') this.mesh.position.y = 8;
            }
        }

        if (this.type === 'SHIELD_PROJECTOR' && this.projectorShieldMesh) {
            this.projectorShieldMesh.visible = false;
            this.shieldRange = 10;
        }

        if ((this.isTitan || this.type === 'AETHERIS_OVERSEER') && this.bossEmergenceMesh) {
            this.emergenceTimer = 0;
        }

        if (this.scanBeam) {
            this.scanBeam.visible = this.type === 'SENTRY';
        }

        if (this.visualLOD?.levels?.[0]?.object) {
            const highGroup = this.visualLOD.levels[0].object;
            const existingModGroup = highGroup.getObjectByName('moduleGroup');
            if (existingModGroup) highGroup.remove(existingModGroup);
        }

        this.scene.add(this.mesh);
    }

    executeChainLightning(primaryTarget, damage, allEnemies, spatialGrid = null) {
        const range = 6; const max = 3;
        let count = 0; let src = primaryTarget;
        const hit = new Set([primaryTarget]);
        while (count < max) {
            let next = null; let minDist = range;
            const nearby = spatialGrid ? spatialGrid.getNearby(src.mesh.position, range) : allEnemies;
            nearby.forEach(e => {
                if (!e.isAlly && !e.isDead && !hit.has(e)) {
                    const d = e.mesh.position.distanceTo(src.mesh.position);
                    if (d < minDist) { minDist = d; next = e; }
                }
            });
            if (!next) break;
            if (this.particleSystem) this.particleSystem.createTracer(src.mesh.position, next.mesh.position, 0x00ffff);
            next.takeDamage(damage, allEnemies, 'PLAYER', spatialGrid);
            hit.add(next); src = next; count++;
        }
    }

    executeTitanAttack(playerPos, otherEnemies) {
        if (this.isDead || this.isDisabled) return;
        
        const distToPlayer = this.mesh.position.distanceTo(playerPos);
        const game = this.scene.game;
        
        if (this.particleSystem && !this.isAlly) {
        }

        switch(this.type) {
            case 'AETHERIS_OVERSEER':
                if (distToPlayer < 40) {
                    game?.triggerShockwave(this.mesh.position, 1.0, 3.0);
                    if (this.particleSystem) this.particleSystem.createThermalPulse(this.mesh.position, 40, 0x00aaff);
                    if (game?.playerController) {
                        const originalGravity = game.playerController.gravity;
                        game.playerController.gravity *= 3.0;
                        setTimeout(() => {
                            if (game?.playerController) game.playerController.gravity = originalGravity;
                        }, 3000);
                    }
                    game?.showProgressionMessage("OVERSEER: GRAVITY WELL ACTIVATED", 2000);
                }
                break;

            case 'OBSIDIAN_JUGGERNAUT':
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const burstPos = this.mesh.position.clone();
                    burstPos.x += Math.cos(angle) * 12;
                    burstPos.z += Math.sin(angle) * 12;
                    game?.handleAreaDamage(burstPos, 8, 50);
                }
                game?.showProgressionMessage("JUGGERNAUT: MAGMA BURST", 2000);
                break;

            case 'CRYO_COMMANDER':
                if (distToPlayer < 30) {
                    game?.triggerShockwave(this.mesh.position, 0.5, 1.0);
                    if (this.particleSystem) this.particleSystem.createThermalPulse(this.mesh.position, 30, 0x00ffff);
                    this.player.takeDamage(25);
                    this.player.buffs.push({ type: 'SLOW', multiplier: 0.3, duration: 4 });
                    game?.showProgressionMessage("COMMANDER: FLASH FREEZE PROTOCOL", 2000);
                }
                break;

            case 'CLOAK_MASTER':
                for (let i = 0; i < 2; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const spawnPos = this.mesh.position.clone();
                    spawnPos.x += Math.cos(angle) * 10;
                    spawnPos.z += Math.sin(angle) * 10;
                    
                    if (game && game.enemies.length < CONFIG.ENEMY.MAX_ACTIVE + 5) {
                        const decoy = game.enemyPool
                            ? game.enemyPool.acquire(this.scene, this.player, spawnPos, 'STALKER', this.facilityId, this.navigation, this.particleSystem, this.heatLevel, false)
                            : new Enemy(this.scene, this.player, spawnPos, 'STALKER', this.facilityId, this.navigation, this.particleSystem, this.heatLevel, false);
                        decoy.maxHealth = 100;
                        decoy.health = 100;
                        decoy.isDecoy = true;
                        game.enemies.push(decoy);
                    }
                }
                this.isCloaked = true;
                setTimeout(() => { if (!this.isDead) this.isCloaked = false; }, 5000);
                game?.showProgressionMessage("CLOAK MASTER: MIRROR IMAGES DEPLOYED", 2000);
                break;

            case 'TITAN':
            case 'HEAVY_SEC_BOT':
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        if (!this.isDead && !this.isDisabled) this.shoot(true, otherEnemies);
                    }, i * 250);
                }
                break;
        }
    }

    executeEliteAbility(playerPos, otherEnemies, spatialGrid) {
        if (this.isDead || this.isDisabled) return;
        if (this.scene.game) this.scene.game.triggerEliteSound(this.type);
        switch (this.type) {
            case 'SENTRY':
                for (let i = 0; i < 3; i++) setTimeout(() => { if (!this.isDead && !this.isDisabled) this.shoot(true, otherEnemies, spatialGrid); }, i * 200);
                break;
            case 'STALKER':
                MATH.v1.subVectors(playerPos, this.mesh.position).normalize();
                this.mesh.position.add(MATH.v1.multiplyScalar(5));
                if (this.particleSystem) this.particleSystem.createExplosion(this.mesh.position, 0xff00ff, 4, 0.8);
                break;
            case 'TANK':
                if (this.particleSystem) this.particleSystem.createExplosion(this.mesh.position, 0xff00ff, 8, 2);
                if (this.mesh.position.distanceTo(playerPos) < 10) this.player.takeDamage(40);
                break;
        }
    }

    applyEMP(duration) {
        if (this.isDead) return;
        this.isDisabled = true; this.disableTimer = duration;
        this.sprites.forEach(sprite => {
            if (sprite && sprite.material) {
                sprite.material.emissive.set(0x004466);
                sprite.material.emissiveIntensity = 2.0;
            }
        });
    }
}