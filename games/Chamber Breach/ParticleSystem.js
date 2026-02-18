import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.textureLoader = new THREE.TextureLoader();
        
        // Pre-load textures
        this.muzzleTexture = this.textureLoader.load('https://rosebud.ai/assets/muzzle_flash_sprite.png.webp?cmmK');
        this.dustTexture = this.textureLoader.load('https://rosebud.ai/assets/data_dust_particle.png.webp?K9IH');
    }

    createExplosion(position, color, count = 10, speed = 2) {
        for (let i = 0; i < count; i++) {
            const size = 0.05 + Math.random() * 0.1;
            const geo = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshBasicMaterial({ color: color });
            const particle = new THREE.Mesh(geo, mat);
            
            particle.position.copy(position);
            
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed
            );

            this.particles.push({
                mesh: particle,
                velocity: velocity,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.05
            });

            this.scene.add(particle);
        }
    }

    createImpact(position, normal, color = 0xffffff) {
        // Create a small burst of particles at impact point
        this.createExplosion(position, color, 8, 1.5);
        
        // Add a temporary "scorch mark" or point light
        const light = new THREE.PointLight(color, 1, 2);
        light.position.copy(position);
        this.scene.add(light);
        setTimeout(() => this.scene.remove(light), 50);
    }

    createMuzzleFlash(position, direction, color = 0xffff00) {
        // Main flash sprite
        const spriteMat = new THREE.SpriteMaterial({ 
            map: this.muzzleTexture, 
            color: color, 
            transparent: true, 
            blending: THREE.AdditiveBlending 
        });
        const flashSprite = new THREE.Sprite(spriteMat);
        flashSprite.position.copy(position);
        flashSprite.scale.set(0.5, 0.5, 0.5);
        
        this.scene.add(flashSprite);
        this.particles.push({
            mesh: flashSprite,
            velocity: new THREE.Vector3(),
            life: 1.0,
            decay: 0.15, // Very fast
            isSprite: true,
            growSpeed: 2.0
        });

        // Small focused burst for muzzle
        for (let i = 0; i < 5; i++) {
            const size = 0.02 + Math.random() * 0.05;
            const geo = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshBasicMaterial({ color: color });
            const particle = new THREE.Mesh(geo, mat);
            
            particle.position.copy(position);
            
            // Velocity mostly in shooting direction
            const velocity = direction.clone().multiplyScalar(2 + Math.random() * 2);
            velocity.x += (Math.random() - 0.5) * 0.5;
            velocity.y += (Math.random() - 0.5) * 0.5;
            velocity.z += (Math.random() - 0.5) * 0.5;

            this.particles.push({
                mesh: particle,
                velocity: velocity,
                life: 0.5,
                decay: 0.1 + Math.random() * 0.1
            });

            this.scene.add(particle);
        }
    }

    createAtmosphericParticles(chamber, count = 20) {
        const mat = new THREE.SpriteMaterial({ 
            map: this.dustTexture, 
            color: chamber.isBoss ? 0xff4400 : 0x00ffff, 
            transparent: true, 
            opacity: 0.4,
            blending: THREE.AdditiveBlending 
        });

        for (let i = 0; i < count; i++) {
            const sprite = new THREE.Sprite(mat.clone());
            
            const x = chamber.x + (Math.random() - 0.5) * chamber.size;
            const y = 1 + Math.random() * 4;
            const z = chamber.z + (Math.random() - 0.5) * chamber.size;
            
            sprite.position.set(x, y, z);
            sprite.scale.setScalar(0.05 + Math.random() * 0.1);
            
            this.scene.add(sprite);
            
            this.particles.push({
                mesh: sprite,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2
                ),
                life: 1.0,
                decay: 0, // Never dies
                isPersistent: true,
                bounds: {
                    minX: chamber.x - chamber.size / 2,
                    maxX: chamber.x + chamber.size / 2,
                    minY: 0.5,
                    maxY: 5.5,
                    minZ: chamber.z - chamber.size / 2,
                    maxZ: chamber.z + chamber.size / 2
                }
            });
        }
    }

    update(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            if (!p.isPersistent) {
                p.life -= p.decay;
                
                if (p.life <= 0) {
                    this.scene.remove(p.mesh);
                    this.particles.splice(i, 1);
                    continue;
                }

                p.mesh.position.add(p.velocity.clone().multiplyScalar(deltaTime));

                if (p.growSpeed) {
                    p.mesh.scale.addScalar(p.growSpeed * deltaTime);
                } else {
                    p.mesh.scale.setScalar(p.life);
                }
                
                if (p.mesh.material) {
                    p.mesh.material.opacity = p.life;
                    p.mesh.material.transparent = true;
                }
            } else {
                // Persistent particle logic (drifting and wrapping)
                p.mesh.position.add(p.velocity.clone().multiplyScalar(deltaTime));
                
                // Wrap within chamber bounds
                if (p.mesh.position.x < p.bounds.minX) p.mesh.position.x = p.bounds.maxX;
                if (p.mesh.position.x > p.bounds.maxX) p.mesh.position.x = p.bounds.minX;
                if (p.mesh.position.y < p.bounds.minY) p.mesh.position.y = p.bounds.maxY;
                if (p.mesh.position.y > p.bounds.maxY) p.mesh.position.y = p.bounds.minY;
                if (p.mesh.position.z < p.bounds.minZ) p.mesh.position.z = p.bounds.maxZ;
                if (p.mesh.position.z > p.bounds.maxZ) p.mesh.position.z = p.bounds.minZ;
                
                // Subtle opacity pulsing
                p.mesh.material.opacity = 0.2 + Math.sin(Date.now() * 0.001 + i) * 0.15;
            }
        }
    }
}


