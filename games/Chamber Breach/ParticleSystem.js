import * as THREE from 'three';
import { ObjectPool } from './ObjectPool.js';

// Centralized Zero-Allocation MATH pool for the particle system
const MATH = {
    v1: new THREE.Vector3(),
    v2: new THREE.Vector3(),
    v3: new THREE.Vector3(),
    v4: new THREE.Vector3(),
    v5: new THREE.Vector3(),
    vUp: new THREE.Vector3(0, 1, 0),
    c1: new THREE.Color()
};

// --- Specialized Poolable Effect Classes ---

class ExplosionEffect {
    constructor(scene, particlePool, effectPool = null) {
        this.scene = scene;
        this.particlePool = particlePool;
        this.effectPool = effectPool;
        this.active = false;
        this.particles = [];
        this.timer = 0;
        
        // Pre-allocate particle slots
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                mesh: null,
                velocity: new THREE.Vector3(),
                life: 0,
                decay: 0
            });
        }
    }

    spawn(position, color, count, speed) {
        this.active = true;
        this.timer = 1.5;
        const finalCount = Math.min(count, 15);
        
        for (let i = 0; i < finalCount; i++) {
            const p = this.particles[i];
            const mesh = this.particlePool.get();
            if (!mesh) continue;

            const size = 0.05 + Math.random() * 0.1;
            mesh.material.color.set(color);
            mesh.material.opacity = 1.0;
            mesh.scale.setScalar(size);
            mesh.position.copy(position);
            mesh.visible = true;
            mesh.matrixAutoUpdate = true; // Temporary for moving particles

            p.mesh = mesh;
            p.velocity.set(
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed
            );
            p.life = 1.0;
            p.decay = 0.02 + Math.random() * 0.05;
        }
    }

    update(deltaTime) {
        if (!this.active) return;
        this.timer -= deltaTime;
        let anyActive = false;

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (!p.mesh) continue;

            p.life -= p.decay;
            if (p.life <= 0) {
                p.mesh.visible = false;
                this.particlePool.release(p.mesh);
                p.mesh = null;
                continue;
            }

            anyActive = true;
            p.mesh.position.x += p.velocity.x * deltaTime;
            p.mesh.position.y += p.velocity.y * deltaTime;
            p.mesh.position.z += p.velocity.z * deltaTime;
            if (p.mesh.material) p.mesh.material.opacity = p.life;
            p.mesh.scale.multiplyScalar(0.96);
        }

        if (!anyActive || this.timer <= 0) {
            this.active = false;
            // The main loop in ParticleSystem.update will handle releasing this back to the effect pool
        }
    }
}

class MuzzleEffect {
    constructor(scene, particlePool, spritePool, effectPool = null) {
        this.scene = scene;
        this.particlePool = particlePool;
        this.spritePool = spritePool;
        this.effectPool = effectPool;
        this.active = false;
        this.sprite = null;
        this.sparks = [];
        this.timer = 0;

        for (let i = 0; i < 3; i++) {
            this.sparks.push({
                mesh: null,
                velocity: new THREE.Vector3(),
                life: 0
            });
        }
    }

    spawn(position, direction, color) {
        this.active = true;
        this.timer = 0.15; // Much shorter duration - snappy flash

        // Small, fast muzzle flash sprite (not the oversized yellow blob)
        this.sprite = this.spritePool.get();
        if (this.sprite) {
            this.sprite.material.color.set(color);
            this.sprite.position.copy(position);
            this.sprite.scale.set(0.4, 0.4, 0.4); // Much smaller starting scale
            this.sprite.visible = true;
        }

        // Muzzle Sparks
        for (let i = 0; i < 3; i++) {
            const s = this.sparks[i];
            const mesh = this.particlePool.get();
            if (!mesh) continue;

            mesh.material.color.set(color);
            mesh.material.opacity = 1.0;
            mesh.scale.setScalar(0.03 + Math.random() * 0.03);
            mesh.position.copy(position);
            mesh.visible = true;

            s.mesh = mesh;
            s.velocity.copy(direction).multiplyScalar(5 + Math.random() * 5);
            s.velocity.x += (Math.random() - 0.5) * 2.0;
            s.velocity.y += (Math.random() - 0.5) * 2.0;
            s.velocity.z += (Math.random() - 0.5) * 2.0;
            s.life = 0.15 + Math.random() * 0.1; // Shorter spark life
        }
    }

    update(deltaTime) {
        if (!this.active) return;
        this.timer -= deltaTime;

        if (this.sprite) {
            this.sprite.scale.addScalar(deltaTime * 2.0); // Slower grow
            this.sprite.material.opacity = Math.max(0, this.timer / 0.15); // Fade out
            if (this.timer <= 0) {
                this.sprite.visible = false;
                this.spritePool.release(this.sprite);
                this.sprite = null;
            }
        }

        let anySparks = false;
        for (let i = 0; i < this.sparks.length; i++) {
            const s = this.sparks[i];
            if (!s.mesh) continue;

            s.life -= deltaTime * 4.0; // Faster decay
            if (s.life <= 0) {
                s.mesh.visible = false;
                this.particlePool.release(s.mesh);
                s.mesh = null;
                continue;
            }

            anySparks = true;
            s.mesh.position.x += s.velocity.x * deltaTime;
            s.mesh.position.y += s.velocity.y * deltaTime;
            s.mesh.position.z += s.velocity.z * deltaTime;
            if (s.mesh.material) s.mesh.material.opacity = s.life;
        }

        if (this.timer <= 0 && !anySparks && !this.sprite) {
            this.active = false;
        }
    }
}

class ImpactEffect {
    constructor(particleSystem, effectPool = null) {
        this.particleSystem = particleSystem;
        this.effectPool = effectPool;
        this.active = false;
        this.timer = 0;
    }

    spawn(position, normal, color) {
        this.active = true;
        this.timer = 1.0;
        this.particleSystem.createExplosion(position, color, 6, 2.0);
        this.particleSystem.createDecal(position, normal, 0x000000, 0.4);
        
        // Small puff of smoke/dust
        for (let i = 0; i < 2; i++) {
            const p = this.particleSystem.getNextParticle();
            if (!p) break;

            const mesh = this.particleSystem.particlePool.get();
            if (!mesh) {
                this.particleSystem.releaseParticle(p, -1);
                continue;
            }
            mesh.material.color.set(0x333333);
            mesh.material.opacity = 1.0;
            mesh.scale.setScalar(0.02 + Math.random() * 0.06);
            mesh.position.copy(position);
            mesh.visible = true;
            mesh.matrixAutoUpdate = true;
            
            p.mesh = mesh;
            p.velocity.copy(normal).multiplyScalar(1 + Math.random() * 1.5);
            p.velocity.x += (Math.random() - 0.5) * 1.0;
            p.velocity.y += (Math.random() - 0.5) * 1.0;
            p.velocity.z += (Math.random() - 0.5) * 1.0;
            p.life = 1.0;
            p.decay = 0.08 + Math.random() * 0.05;
            p.pool = this.particleSystem.particlePool;
        }

        MATH.v1.copy(normal).multiplyScalar(0.2);
        MATH.v2.copy(position).add(MATH.v1);
        this.particleSystem.flashLight(MATH.v2, color, 3, 2, 50);
    }

    update(deltaTime) {
        if (!this.active) return;
        this.timer -= deltaTime;
        if (this.timer <= 0) this.active = false;
    }
}

// --- Main Particle System ---

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.player = null; 
        this.map = null; // Reference to the map for collision
        this.particles = [];
        this.activeParticles = []; 
        this.MAX_PARTICLES = 300; // Performance: Further reduced for GPU stability
        
        // --- Effect Pools ---
        this.activeEffects = [];
        this.explosionPool = [];
        this.muzzleEffectPool = [];
        this.impactEffectPool = [];
        
        // Stack to track available indices
        this.availableIndices = [];
        
        // Initialize fixed-size array for logical particles
        for (let i = 0; i < this.MAX_PARTICLES; i++) {
            this.particles[i] = {
                id: i,
                active: false,
                mesh: null,
                velocity: new THREE.Vector3(),
                life: 0,
                decay: 0,
                pool: null,
                isProjectile: false,
                isTracer: false,
                isSprite: false,
                isDebris: false,
                isPersistent: false,
                isDecal: false,
                growSpeed: 0,
                damage: 0,
                bounds: null,
                bounce: 0
            };
            this.availableIndices.push(i);
        }

        this.textureLoader = new THREE.TextureLoader();
        
        // Pre-load textures
        this.muzzleTexture = this.textureLoader.load('https://rosebud.ai/assets/muzzle_flash_sprite.png.webp?cmmK');
        this.dustTexture = this.textureLoader.load('https://rosebud.ai/assets/data_dust_particle.png.webp?K9IH');

        // Shared geometries
        this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
        this.tracerGeo = new THREE.BoxGeometry(0.02, 0.02, 1);
        
        this.materialPool = new Map(); // Color -> Material
        
        // --- Pools ---
        
        // Light Pool - HARD CAPPED
        this.maxLights = 12; 
        this.allCreatedLights = []; 
        this.activeLights = []; 
        this.lightPool = {
            available: [],
            get: () => {
                if (this.lightPool.available.length > 0) return this.lightPool.available.pop();
                if (this.allCreatedLights.length < this.maxLights) {
                    const light = new THREE.PointLight(0xffffff, 0, 5);
                    light.castShadow = false;
                    light.userData.timer = 0;
                    this.scene.add(light);
                    this.allCreatedLights.push(light);
                    return light;
                }
                return null;
            },
            release: (light) => {
                if (light) {
                    light.visible = false;
                    light.intensity = 0;
                    this.lightPool.available.push(light);
                }
            }
        };

        // Particle Mesh Pool - reduced initial allocation, grows on demand
        this.particlePool = new ObjectPool(() => {
            const mesh = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
            mesh.visible = false;
            mesh.matrixAutoUpdate = false; 
            this.scene.add(mesh);
            return mesh;
        }, 150); // Reduced from 500 - pool grows on demand

        // Tracer Pool
        this.tracerPool = new ObjectPool(() => {
            const mat = new THREE.MeshBasicMaterial({ 
                transparent: true, 
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(this.tracerGeo, mat);
            mesh.visible = false;
            this.scene.add(mesh);
            return mesh;
        }, 30); // Reduced from 400

        // Projectile Pool
        this.projectileGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6);
        this.projectileGeo.rotateX(Math.PI / 2);
        this.projectilePool = new ObjectPool(() => {
            const mat = new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: 1.0,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(this.projectileGeo, mat); // Shared geometry
            mesh.visible = false;
            mesh.frustumCulled = true;
            this.scene.add(mesh);
            return mesh;
        }, 30); // Reduced from 400

        // Sprite Pool (Muzzle Flashes)
        this.spritePool = new ObjectPool(() => {
            const mat = new THREE.SpriteMaterial({ 
                map: this.muzzleTexture,
                transparent: true, 
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const sprite = new THREE.Sprite(mat);
            sprite.visible = false;
            this.scene.add(sprite);
            return sprite;
        }, 10); // Reduced from 40

        // Decal Pool
        this.decalGeo = new THREE.PlaneGeometry(0.5, 0.5);
        this.decalPool = new ObjectPool(() => {
            const mat = new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.8,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -4
            });
            const mesh = new THREE.Mesh(this.decalGeo, mat);
            mesh.visible = false;
            this.scene.add(mesh);
            return mesh;
        }, 20); // Reduced from 80

        // Debris Pool - Use MeshBasicMaterial instead of expensive MeshStandardMaterial
        this.debrisPool = new ObjectPool(() => {
            const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
            const mat = new THREE.MeshBasicMaterial({ color: 0x333333 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.visible = false;
            this.scene.add(mesh);
            return mesh;
        }, 50);

        // --- Optimized Effect Pools ---
        
        // Explosion Effect Pool
        this.explosionEffectPool = new ObjectPool(() => {
            return new ExplosionEffect(this.scene, this.particlePool);
        }, 8);

        // Muzzle Effect Pool
        this.muzzleEffectPool = new ObjectPool(() => {
            return new MuzzleEffect(this.scene, this.particlePool, this.spritePool);
        }, 6);

        // Impact Effect Pool
        this.impactEffectPool = new ObjectPool(() => {
            return new ImpactEffect(this);
        }, 10);
    }

    getNextParticle() {
        if (this.availableIndices.length === 0) return null;
        const index = this.availableIndices.pop();
        const p = this.particles[index];
        p.active = true;
        p.isProjectile = false;
        p.isTracer = false;
        p.isSprite = false;
        p.isDebris = false;
        p.isPersistent = false;
        p.isDecal = false;
        p.growSpeed = 0;
        p.damage = 0;
        p.bounds = null;
        p.bounce = 0;
        p.pool = null;
        this.activeParticles.push(p);
        return p;
    }

    releaseParticle(p, indexInActive) {
        if (!p.active) return;
        p.active = false;
        if (p.mesh) {
            p.mesh.visible = false;
            // PERFORMANCE FIX: Actually remove mesh from scene to prevent bloating scene graph
            if (p.mesh.parent) {
                p.mesh.parent.remove(p.mesh);
            }
            if (p.pool) p.pool.release(p.mesh);
            p.mesh = null;
        }
        this.availableIndices.push(p.id);
        if (indexInActive !== -1) {
            const last = this.activeParticles.pop();
            if (indexInActive < this.activeParticles.length) {
                this.activeParticles[indexInActive] = last;
            }
        }
    }

    getMaterial(color) {
        if (!this.materialPool.has(color)) {
            this.materialPool.set(color, new THREE.MeshBasicMaterial({ color: color, transparent: true }));
        }
        return this.materialPool.get(color);
    }

    flashLight(position, color, intensity, distance, duration) {
        const light = this.lightPool.get();
        if (!light) return;
        light.position.copy(position);
        light.color.set(color);
        light.intensity = intensity;
        light.distance = distance;
        light.visible = true;
        light.userData.timer = duration / 1000;
        this.activeLights.push(light);
    }

    createExplosion(position, color, count = 10, speed = 2) {
        const effect = this.explosionEffectPool.get();
        if (effect) {
            effect.spawn(position, color, Math.min(count, 6), Math.min(speed, 2.0));
            if (!this.activeEffects.includes(effect)) {
                this.activeEffects.push(effect);
            }
        }
    }

    createSteamCloud(position, color = 0xffffff, count = 5) {
        for (let i = 0; i < count; i++) {
            const p = this.getNextParticle();
            if (!p) break;

            const mesh = this.particlePool.get();
            if (!mesh) {
                this.releaseParticle(p, this.activeParticles.length - 1);
                continue;
            }
            mesh.material.color.set(color);
            mesh.material.opacity = 0.6;
            mesh.scale.setScalar(0.5 + Math.random() * 1.5);
            
            mesh.position.copy(position).add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5
            ));
            mesh.visible = true;
            mesh.matrixAutoUpdate = true;
            
            p.mesh = mesh;
            p.velocity.set(
                (Math.random() - 0.5) * 1.0,
                2.0 + Math.random() * 3.0, 
                (Math.random() - 0.5) * 1.0
            );
            p.life = 1.5;
            p.decay = 0.02 + Math.random() * 0.02;
            p.growSpeed = 1.0;
            p.pool = this.particlePool;
        }
    }

    createLargeCloud(position, color = 0xffffff, count = 10, size = 2) {
        for (let i = 0; i < count; i++) {
            const p = this.getNextParticle();
            if (!p) break;

            const mesh = this.particlePool.get();
            if (!mesh) {
                this.releaseParticle(p, this.activeParticles.length - 1);
                continue;
            }
            mesh.material.color.set(color);
            mesh.material.opacity = 0.4;
            mesh.scale.setScalar(size * (0.5 + Math.random()));
            
            MATH.v1.set(
                (Math.random() - 0.5) * size,
                (Math.random() - 0.5) * size,
                (Math.random() - 0.5) * size
            );
            mesh.position.copy(position).add(MATH.v1);
            mesh.visible = true;
            mesh.matrixAutoUpdate = true;
            
            p.mesh = mesh;
            p.velocity.set(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5
            );
            p.life = 2.0;
            p.decay = 0.01;
            p.growSpeed = size * 0.2;
            p.pool = this.particlePool;
        }
    }

    createDebris(position, color = 0x333333, count = 5, type = 'GENERIC') {
        if (!position || typeof position.clone !== 'function') return;
        for (let i = 0; i < count; i++) {
            const p = this.getNextParticle();
            if (!p) break;

            const mesh = this.debrisPool.get();
            if (!mesh || !mesh.material) {
                this.releaseParticle(p, this.activeParticles.length - 1);
                continue;
            }
            mesh.material.color.set(color);
            mesh.position.copy(position);
            
            const emissive = mesh.material.emissive;
            if (type === 'MONITOR') {
                mesh.scale.set(0.2 + Math.random() * 0.4, 0.05 + Math.random() * 0.1, 0.2 + Math.random() * 0.4);
                if (emissive) emissive.set(color).multiplyScalar(0.5);
            } else if (type === 'PIPE') {
                mesh.scale.set(0.1, 0.4 + Math.random() * 0.6, 0.1);
                if (emissive) emissive.set(0x000000);
            } else {
                mesh.scale.setScalar(0.3 + Math.random() * 0.5);
                if (emissive) emissive.set(0x000000);
            }

            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            mesh.visible = true;
            mesh.matrixAutoUpdate = true;

            p.mesh = mesh;
            p.velocity.set(
                (Math.random() - 0.5) * 8,
                Math.random() * 10 + 2,
                (Math.random() - 0.5) * 8
            );
            p.life = 3.0;
            p.decay = 0.01;
            p.isDebris = true;
            p.bounce = 0.5;
            p.pool = this.debrisPool;
        }
    }

    createImpact(position, normal, color = 0xffffff) {
        const effect = this.impactEffectPool.get();
        if (effect) {
            effect.spawn(position, normal, color);
            if (!this.activeEffects.includes(effect)) {
                this.activeEffects.push(effect);
            }
        }
    }

    createDecal(position, normal, color = 0x000000, size = 0.4) {
        const p = this.getNextParticle();
        if (!p) return;

        const mesh = this.decalPool.get();
        if (!mesh) {
            this.releaseParticle(p, this.activeParticles.length - 1);
            return;
        }

        mesh.material.color.set(color);
        mesh.material.opacity = 0.8;
        mesh.scale.setScalar(size);
        
        MATH.v1.copy(normal).multiplyScalar(0.01);
        mesh.position.copy(position).add(MATH.v1);
        
        MATH.v2.copy(mesh.position).add(normal);
        mesh.lookAt(MATH.v2);
        mesh.updateMatrix();
        
        mesh.visible = true;
        p.mesh = mesh;
        p.velocity.set(0, 0, 0);
        p.life = 10.0;
        p.decay = 0.01;
        p.isDecal = true;
        p.pool = this.decalPool;
    }

    createThermalPulse(position, radius = 10, color = 0x00d0ff) {
        this.flashLight(position, color, 15, radius * 1.5, 300);
        
        const count = 40;
        for (let i = 0; i < count; i++) {
            const p = this.getNextParticle();
            if (!p) break;

            const mesh = this.particlePool.get();
            if (!mesh) {
                this.releaseParticle(p, this.activeParticles.length - 1);
                continue;
            }

            const angle = (i / count) * Math.PI * 2;
            MATH.v1.set(Math.cos(angle), 0, Math.sin(angle));
            
            mesh.material.color.set(color);
            mesh.material.opacity = 1.0;
            mesh.scale.set(0.2, 0.2, 0.5);
            mesh.position.copy(position);
            
            MATH.v2.copy(position).add(MATH.v1);
            mesh.lookAt(MATH.v2);
            mesh.updateMatrix();
            mesh.visible = true;
            mesh.matrixAutoUpdate = true;
            
            p.mesh = mesh;
            p.velocity.copy(MATH.v1).multiplyScalar(radius * 2.5);
            p.life = 1.0;
            p.decay = 0.05;
            p.pool = this.particlePool;
            p.growSpeed = 2.0;
        }
        this.createExplosion(position, color, 8, 3);
    }

    createEnemyProjectile(start, end, color = 0xff0000, speed = 12) {
        const p = this.getNextParticle();
        if (!p) return;

        const mesh = this.projectilePool.get();
        if (!mesh) {
            this.releaseParticle(p, this.activeParticles.length - 1);
            return;
        }
        mesh.material.color.set(color); 
        mesh.material.opacity = 1.0;
        mesh.scale.setScalar(1.0);
        mesh.position.copy(start);
        
        MATH.v1.subVectors(end, start).normalize();
        MATH.v2.copy(mesh.position).add(MATH.v1);
        mesh.lookAt(MATH.v2);
        mesh.updateMatrix();
        mesh.visible = true;
        mesh.matrixAutoUpdate = true;
        
        p.mesh = mesh;
        p.velocity.copy(MATH.v1).multiplyScalar(speed);
        p.life = 4.0;
        p.decay = 0.005;
        p.isProjectile = true;
        p.damage = 15;
        p.pool = this.projectilePool;
    }

    createTracer(start, end, color = 0xffffff, life = 1.0, scale = 2.0) {
        const p = this.getNextParticle();
        if (!p) return;

        const distance = start.distanceTo(end);
        const mesh = this.tracerPool.get();
        if (!mesh) {
            this.releaseParticle(p, this.activeParticles.length - 1);
            return;
        }
        
        mesh.material.color.set(color);
        mesh.position.copy(start).lerp(end, 0.5);
        mesh.scale.set(scale, scale, distance); 
        mesh.lookAt(end);
        mesh.updateMatrix();
        mesh.visible = true;
        
        p.mesh = mesh;
        p.velocity.set(0, 0, 0);
        p.life = life;
        p.decay = 0.01 / life;
        p.isTracer = true;
        p.pool = this.tracerPool;
    }

    createMuzzleFlash(position, direction, color = 0x00ffff) {
        const distSq = window.game && window.game.player ? position.distanceToSquared(window.game.player.mesh.position) : 0;
        if (distSq > 400) return; // Tightened range (20m)

        const effect = this.muzzleEffectPool.get();
        if (effect) {
            effect.spawn(position, direction, color);
            if (!this.activeEffects.includes(effect)) {
                this.activeEffects.push(effect);
            }
        }

        if (this.player && this.player.camera.position.distanceToSquared(position) < 400) {
            this.flashLight(position, color, 4, 6, 40);
        }
    }

    createAtmosphericParticles(chamber, count = 10) {
        const group = new THREE.Group();
        const size = chamber.size || 20;
        const halfSize = size / 2;
        
        for (let i = 0; i < count; i++) {
            const p = this.getNextParticle();
            if (!p) break;

            const mesh = this.particlePool.get();
            if (!mesh) {
                this.releaseParticle(p, this.activeParticles.length - 1);
                continue;
            }

            const pSize = 0.05 + Math.random() * 0.15;
            mesh.scale.setScalar(pSize);
            mesh.material.color.set(0x00d0ff);
            mesh.material.opacity = 0.1 + Math.random() * 0.2;
            mesh.material.map = this.dustTexture;
            
            mesh.position.set(
                chamber.x + (Math.random() - 0.5) * size,
                1 + Math.random() * 4,
                chamber.z + (Math.random() - 0.5) * size
            );
            mesh.updateMatrix();
            mesh.visible = true;
            
            p.mesh = mesh;
            p.velocity.set(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
            );
            p.life = 1.0;
            p.isPersistent = true;
            p.bounds = {
                minX: chamber.x - halfSize, maxX: chamber.x + halfSize,
                minY: 0.5, maxY: 6,
                minZ: chamber.z - halfSize, maxZ: chamber.z + halfSize
            };
            p.pool = this.particlePool;
            group.add(mesh);
        }
        return group;
    }

    clearAll() {
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            this.releaseParticle(this.activeParticles[i], i);
        }
        
        // Release all active effects back to their pools
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            effect.active = false;
            if (effect instanceof ExplosionEffect) this.explosionEffectPool.release(effect);
            else if (effect instanceof MuzzleEffect) this.muzzleEffectPool.release(effect);
            else if (effect instanceof ImpactEffect) this.impactEffectPool.release(effect);
        }
        this.activeEffects = [];
    }

    update(deltaTime) {
        if (!this.frameCounter) this.frameCounter = 0;
        this.frameCounter++;

        const now = Date.now();
        const timeScale = now * 0.001;
        const playerPos = this.player && this.player.camera ? this.player.camera.position : null;

        // ... rest of effect updates ...

        // Update Effect Pools
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            effect.update(deltaTime);
            if (!effect.active) {
                // Release back to its pool if it has one
                if (effect instanceof ExplosionEffect) this.explosionEffectPool.release(effect);
                else if (effect instanceof MuzzleEffect) this.muzzleEffectPool.release(effect);
                else if (effect instanceof ImpactEffect) this.impactEffectPool.release(effect);

                const last = this.activeEffects.pop();
                if (i < this.activeEffects.length) {
                    this.activeEffects[i] = last;
                }
            }
        }

        // Update active lights
        for (let i = this.activeLights.length - 1; i >= 0; i--) {
            const light = this.activeLights[i];
            light.userData.timer -= deltaTime;
            if (light.userData.timer <= 0) {
                // PERFORMANCE FIX: Remove expired lights from scene before pooling
                if (light.parent) {
                    light.parent.remove(light);
                }
                const last = this.activeLights.pop();
                if (i < this.activeLights.length) {
                    this.activeLights[i] = last;
                }
                this.lightPool.release(light);
            }
        }

        let singularityPos = null;
        let singularityRange = 0;
        let singularityForce = 0;
        
        if (window.game && window.game.activeSingularities) {
            window.game.activeSingularities.forEach(s => {
                singularityPos = s.pos;
                singularityRange = s.range;
                singularityForce = s.force;
            });
        }

        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            
            if (!p.isPersistent) {
                p.life -= p.decay;
                
                if (p.life <= 0) {
                    this.releaseParticle(p, i);
                    continue;
                }

                if (singularityPos && !p.isProjectile) {
                    const distToSingSq = p.mesh.position.distanceToSquared(singularityPos);
                    if (distToSingSq < singularityRange * singularityRange) {
                        MATH.v1.subVectors(singularityPos, p.mesh.position).normalize();
                        const pullFactor = 1.0 - (Math.sqrt(distToSingSq) / singularityRange);
                        p.velocity.add(MATH.v1.multiplyScalar(singularityForce * pullFactor * deltaTime * 100));
                    }
                }

                MATH.v1.copy(p.velocity).multiplyScalar(deltaTime);
                MATH.v2.copy(p.mesh.position).add(MATH.v1);
                
                if (p.isProjectile && this.map) {
                    if ((i + this.frameCounter) % 2 === 0) {
                        if (this.map.checkCollision(MATH.v2, 0.5)) {
                            if (playerPos && MATH.v2.distanceToSquared(playerPos) < 400) {
                                this.createImpact(p.mesh.position, MATH.vUp, p.mesh.material.color);
                            }
                            this.releaseParticle(p, i);
                            continue;
                        }
                    }
                }

                if (p.velocity.x !== 0 || p.velocity.y !== 0 || p.velocity.z !== 0) {
                    p.mesh.position.copy(MATH.v2);
                    p.mesh.updateMatrix();
                } else if (p.growSpeed !== 0) {
                     // Still update matrix if growing
                     p.mesh.updateMatrix();
                }

                if (p.isDebris) {
                    const distSq = playerPos ? p.mesh.position.distanceToSquared(playerPos) : 0;
                    if (distSq > 900) {
                        continue; 
                    }

                    if (p.mesh.position.y <= 0.201 && Math.abs(p.velocity.y) < 0.1 && p.velocity.lengthSq() < 0.01) {
                        // Sleep
                    } else {
                        p.velocity.y -= 25 * deltaTime;
                        if (p.mesh.position.y < 0.2) {
                            p.mesh.position.y = 0.2;
                            p.velocity.y *= -p.bounce;
                            p.velocity.x *= 0.8;
                            p.velocity.z *= 0.8;
                        }
                        
                        if (distSq < 225) {
                            p.mesh.rotation.x += p.velocity.y * deltaTime;
                            p.mesh.rotation.z += p.velocity.x * deltaTime;
                            if (p.mesh.material && p.mesh.material.emissiveIntensity > 0) {
                                p.mesh.material.emissiveIntensity = 0.5 + Math.random() * 2.0;
                            }
                        }
                    }
                }

                if (p.isProjectile) {
                    if (playerPos && !this.player.isDead) {
                        const dx = p.mesh.position.x - playerPos.x;
                        const dy = p.mesh.position.y - playerPos.y;
                        const dz = p.mesh.position.z - playerPos.z;
                        const distSq = dx*dx + dy*dy + dz*dz;
                        
                        if (distSq < 2.5) { 
                            this.player.takeDamage(p.damage || 10);
                            this.createImpact(p.mesh.position, MATH.vUp, p.mesh.material.color);
                            this.releaseParticle(p, i);
                            continue;
                        }
                    }
                }

                if (p.growSpeed) {
                    p.mesh.scale.addScalar(p.growSpeed * deltaTime);
                } else if (!p.isTracer && !p.isProjectile) { 
                    p.mesh.scale.multiplyScalar(0.98); 
                }
                
                if (p.mesh.material) {
                    p.mesh.material.opacity = Math.min(1.0, p.life);
                }
            } else {
                if ((i + Math.floor(now/16)) % 2 === 0) { 
                    MATH.v1.copy(p.velocity).multiplyScalar(deltaTime * 2);
                    p.mesh.position.add(MATH.v1);
                    
                    const b = p.bounds;
                    if (p.mesh.position.x < b.minX) p.mesh.position.x = b.maxX;
                    if (p.mesh.position.x > b.maxX) p.mesh.position.x = b.minX;
                    if (p.mesh.position.y < b.minY) p.mesh.position.y = b.maxY;
                    if (p.mesh.position.y > b.maxY) p.mesh.position.y = b.minY;
                    if (p.mesh.position.z < b.minZ) p.mesh.position.z = b.maxZ;
                    if (p.mesh.position.z > b.maxZ) p.mesh.position.z = b.minZ;
                    
                    if (p.mesh.material) {
                        p.mesh.material.opacity = 0.15 + Math.sin(timeScale + i) * 0.1;
                    }
                    p.mesh.updateMatrix();
                }
            }
        }
    }
}
