import * as THREE from 'three';

class ObjectPool {
    constructor(createFn, initialSize = 10) {
        this.createFn = createFn;
        this.pool = [];
        
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }

    get() {
        return this.pool.length > 0 ? this.pool.pop() : this.createFn();
    }

    release(obj) {
        this.pool.push(obj);
    }
}

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.player = null; 
        this.particles = [];
        this.MAX_PARTICLES = 500;
        this.activeCount = 0;
        
        // Initialize fixed-size array for particles
        for (let i = 0; i < this.MAX_PARTICLES; i++) {
            this.particles[i] = {
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
                growSpeed: 0,
                damage: 0,
                bounds: null,
                bounce: 0
            };
        }

        this.textureLoader = new THREE.TextureLoader();
        
        // Pre-load textures
        this.muzzleTexture = this.textureLoader.load('assets/muzzle_flash_sprite.webp');
        this.dustTexture = this.textureLoader.load('assets/data_dust_particle.webp');

        // Optimization: Shared geometries
        this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
        this.tracerGeo = new THREE.BoxGeometry(0.02, 0.02, 1);
        
        // Optimization: Material pools
        this.materialPool = new Map(); // Color -> Material
        
        // Reusable vectors
        this.tempVec = new THREE.Vector3();
        this.tempVec2 = new THREE.Vector3();

        // --- Pools ---
        
        // Light Pool
        this.lightPool = new ObjectPool(() => {
            const light = new THREE.PointLight(0xffffff, 0, 5);
            light.castShadow = false;
            this.scene.add(light);
            return light;
        }, 15);

        // Particle Mesh Pool
        this.particlePool = new ObjectPool(() => {
            const mesh = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
            mesh.visible = false;
            this.scene.add(mesh);
            return mesh;
        }, 200);

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
        }, 60);

        // Projectile Pool
        // MINIMAL projectile pool (NO SHELL, NO LIGHT, NO GLOW)
		this.projectilePool = new ObjectPool(() => {
			const geo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6);
			geo.rotateX(Math.PI / 2);

			const mat = new THREE.MeshBasicMaterial({
				color: 0xff0000,
				transparent: true,
				opacity: 0.9,
				blending: THREE.AdditiveBlending,
				depthWrite: false
			});

			const mesh = new THREE.Mesh(geo, mat);
			mesh.visible = false;
			this.scene.add(mesh);
			return mesh;
		}, 40);

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
        }, 30);

        // Debris Pool
        this.debrisPool = new ObjectPool(() => {
            const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
            const mat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.visible = false;
            this.scene.add(mesh);
            return mesh;
        }, 30);
    }

    getNextParticle() {
        for (let i = 0; i < this.MAX_PARTICLES; i++) {
            if (!this.particles[i].active) {
                const p = this.particles[i];
                p.active = true;
                p.isProjectile = false;
                p.isTracer = false;
                p.isSprite = false;
                p.isDebris = false;
                p.isPersistent = false;
                p.growSpeed = 0;
                p.damage = 0;
                p.bounds = null;
                p.bounce = 0;
                p.pool = null;
                return p;
            }
        }
        return null;
    }

    getMaterial(color) {
        if (!this.materialPool.has(color)) {
            this.materialPool.set(color, new THREE.MeshBasicMaterial({ color: color, transparent: true }));
        }
        return this.materialPool.get(color);
    }

    flashLight(position, color, intensity, distance, duration) {
        const light = this.lightPool.get();
        light.position.copy(position);
        light.color.set(color);
        light.intensity = 0;
        light.distance = distance;
        light.visible = true;

        setTimeout(() => {
            light.intensity = 0;
            light.visible = false;
            this.lightPool.release(light);
        }, duration);
    }


    createDebris(position, color = 0x333333, count = 5, type = 'GENERIC') {
        for (let i = 0; i < count; i++) {
            const p = this.getNextParticle();
            if (!p) break;

            const mesh = this.debrisPool.get();
            mesh.material.color.set(color);
            mesh.position.copy(position);
            
            // Special scaling for different debris types
            if (type === 'MONITOR') {
                mesh.scale.set(0.2 + Math.random() * 0.4, 0.05 + Math.random() * 0.1, 0.2 + Math.random() * 0.4);
                mesh.material.emissive.set(color).multiplyScalar(0.5);
            } else if (type === 'PIPE') {
                mesh.scale.set(0.1, 0.4 + Math.random() * 0.6, 0.1);
                mesh.material.emissive.set(0x000000);
            } else {
                mesh.scale.setScalar(0.3 + Math.random() * 0.5);
                mesh.material.emissive.set(0x000000);
            }

            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            mesh.visible = true;

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

    createSteamCloud(position, color = 0xffffff, count = 5) {
        for (let i = 0; i < count; i++) {
            const p = this.getNextParticle();
            if (!p) break;

            const mesh = this.particlePool.get();
            mesh.material.color.set(color);
            mesh.material.opacity = 0.4;
            mesh.scale.setScalar(0.5);
            mesh.position.copy(position);
            mesh.visible = true;
            
            p.mesh = mesh;
            p.velocity.set(
                (Math.random() - 0.5) * 2,
                Math.random() * 3 + 1,
                (Math.random() - 0.5) * 2
            );
            p.life = 1.5;
            p.decay = 0.02;
            p.growSpeed = 2.0;
            p.pool = this.particlePool;
        }
    }

    createImpact(position, normal, color = 0xffffff) {
    // tiny, cheap spark
    const p = this.getNextParticle();
    if (!p) return;

    const mesh = this.particlePool.get();
    mesh.material.color.set(color);
    mesh.material.opacity = 0.6;
    mesh.scale.setScalar(0.05);
    mesh.position.copy(position);
    mesh.visible = true;

    p.mesh = mesh;
    p.velocity.copy(normal).multiplyScalar(0.2);
    p.life = 0.08;
    p.decay = 0.1;
    p.pool = this.particlePool;
}
    createEnemyProjectile(start, end, color = 0xff0000, speed = 8) {
        const p = this.getNextParticle();
        if (!p) return;

        const mesh = this.projectilePool.get();
        mesh.material.color.set(0xffffff);
        mesh.material.opacity = 1.0;
        mesh.scale.setScalar(1.0);
        mesh.position.copy(start);
        
        const shell = mesh.getObjectByName('projShell');
        if (shell) {
            shell.material.color.set(color);
            shell.material.opacity = 0.15;
            shell.visible = false;
        }

        const light = mesh.getObjectByName('projLight');
			if (light) {
				light.intensity = 0;
				light.visible = false;
			}

        const glow = mesh.getObjectByName('projGlow');
        if (glow) {
            glow.material.color.set(color);
            glow.material.opacity = 1.0;
            glow.scale.setScalar(1.2);
            glow.visible = false;
        }

        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        mesh.lookAt(mesh.position.clone().add(direction));
        mesh.visible = true;
        
        p.mesh = mesh;
        p.velocity.copy(direction).multiplyScalar(speed);
        p.life = 4.0;
        p.decay = 0.005;
        p.isProjectile = true;
        p.damage = 20;
        p.pool = this.projectilePool;
        
        this.flashLight(start, color, 40, 20, 300);
    }

    createTracer(start, end, color = 0xffffff) {
		return; // FULLY DISABLED – no tracer creation
	}

    createPersistentTracer(start, end, color = 0xffffff) {
    // Persistent but still should fade and be removed
		// const p = this.getNextParticle();
		// if (!p) return;

		// const distance = start.distanceTo(end);
		// const mesh = this.tracerPool.get();
		// mesh.material.color.set(color);

		// mesh.position.copy(start).lerp(end, 0.5);
		// mesh.scale.set(0.5, 0.5, distance);
		// mesh.lookAt(end);
		// mesh.visible = true;

		// p.mesh = mesh;
		// p.velocity.set(0, 0, 0);
		// p.life = 1.5;          // ENEMY TRACERS DIE AFTER 1.5s
		// p.decay = 0.02;        // RATE OF FADEOUT
		// p.isTracer = true;
		// p.isPersistent = false; // ← VERY IMPORTANT!
		// p.pool = this.tracerPool;
		  return;
	}

    createMuzzleFlash(position, direction, color = 0xffff00, isEnemy = false) {
			const pSprite = this.getNextParticle();
			if (!pSprite) return;

			const sprite = this.spritePool.get();
			sprite.material.color.set(color);

			if (isEnemy) {
				sprite.scale.set(0.15, 0.15, 0.15);
				sprite.material.opacity = 0.15;
			} else {
				sprite.scale.set(0.25, 0.25, 0.25);
				sprite.material.opacity = 0.25;
			}

			sprite.position.copy(position);
			sprite.visible = true;

			pSprite.mesh = sprite;
			pSprite.velocity.set(0, 0, 0);
			pSprite.life = 0.08;
			pSprite.decay = 0.05;
			pSprite.isSprite = true;
			pSprite.growSpeed = 0;
			pSprite.pool = this.spritePool;
		}



    createAtmosphericParticles(chamber, count = 20) {
        const mat = new THREE.SpriteMaterial({ 
            map: this.dustTexture, 
            color: chamber.isBoss ? 0xff4400 : 0x00ffff, 
            transparent: true, 
            opacity: 0.4,
            blending: THREE.AdditiveBlending 
        });

        const group = new THREE.Group();
        for (let i = 0; i < count; i++) {
            const p = this.getNextParticle();
            if (!p) break;

            const sprite = new THREE.Sprite(mat.clone()); 
            
            const x = chamber.x + (Math.random() - 0.5) * chamber.size;
            const y = 1 + Math.random() * 4;
            const z = chamber.z + (Math.random() - 0.5) * chamber.size;
            
            sprite.position.set(x, y, z);
            sprite.scale.setScalar(0.05 + Math.random() * 0.1);
            group.add(sprite);
            
            p.mesh = sprite;
            p.velocity.set(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
            );
            p.life = 1.0;
            p.decay = 0; 
            p.isPersistent = true;
            p.bounds = {
                minX: chamber.x - chamber.size / 2,
                maxX: chamber.x + chamber.size / 2,
                minY: 0.5,
                maxY: 5.5,
                minZ: chamber.z - chamber.size / 2,
                maxZ: chamber.z + chamber.size / 2
            };
        }
        this.scene.add(group);
        return group;
    }

    update(deltaTime) {
        const now = Date.now();
        const timeScale = now * 0.001;
        
        for (let i = 0; i < this.MAX_PARTICLES; i++) {
            const p = this.particles[i];
            if (!p.active) continue;
            
            if (!p.isPersistent) {
                p.life -= p.decay;
                
                if (p.life <= 0) {
                    p.mesh.visible = false;
                    if (p.pool) p.pool.release(p.mesh);
                    p.active = false;
                    continue;
                }

                this.tempVec.copy(p.velocity).multiplyScalar(deltaTime);
                p.mesh.position.add(this.tempVec);

                // Apply Gravity to Debris
                if (p.isDebris) {
                    p.velocity.y -= 25 * deltaTime; // Gravity
                    if (p.mesh.position.y < 0.2) {
                        p.mesh.position.y = 0.2;
                        p.velocity.y *= -p.bounce; // Bounce
                        p.velocity.x *= 0.8; // Friction
                        p.velocity.z *= 0.8; // Friction
                    }
                    p.mesh.rotation.x += p.velocity.y * deltaTime;
                    p.mesh.rotation.z += p.velocity.x * deltaTime;

                    // Flicker emission for monitor shards
                    if (p.mesh.material.emissiveIntensity > 0) {
                        p.mesh.material.emissiveIntensity = 0.5 + Math.random() * 2.0;
                    }
                }

                if (p.isProjectile) {

					// ---- ONLY COLLISION CHECK REMAINS ----
					if (this.player && !this.player.isDead) {
						const distToPlayer = p.mesh.position.distanceTo(this.player.camera.position);
						if (distToPlayer < 1.5) { 
							this.player.takeDamage(p.damage || 10);
							p.life = 0; 
							this.createImpact(p.mesh.position, new THREE.Vector3(0, 1, 0), 0xff0000);
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
                // Persistent particle logic - Throttled update
                if (i % 2 === 0) { 
                    this.tempVec.copy(p.velocity).multiplyScalar(deltaTime * 2);
                    p.mesh.position.add(this.tempVec);
                    
                    if (p.mesh.position.x < p.bounds.minX) p.mesh.position.x = p.bounds.maxX;
                    if (p.mesh.position.x > p.bounds.maxX) p.mesh.position.x = p.bounds.minX;
                    if (p.mesh.position.y < p.bounds.minY) p.mesh.position.y = p.bounds.maxY;
                    if (p.mesh.position.y > p.bounds.maxY) p.mesh.position.y = p.bounds.minY;
                    if (p.mesh.position.z < p.bounds.minZ) p.mesh.position.z = p.bounds.maxZ;
                    if (p.mesh.position.z > p.bounds.maxZ) p.mesh.position.z = p.bounds.minZ;
                    
                    if (p.mesh.material) {
                        p.mesh.material.opacity = 0.15 + Math.sin(timeScale + i) * 0.1;
                    }
                }
            }
        }
    }
}



