import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.sphereGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        this.boxGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        this.defaultMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 });
    }

    emit(position, count = 20, color = 0xff0000, options = {}) {
        const { 
            speed = 15, 
            gravity = 15, 
            life = 1.0, 
            scale = 1.0, 
            spread = 1.0,
            geometryType = 'sphere'
        } = options;

        const mat = this.defaultMaterial.clone();
        mat.color.setHex(color);
        mat.emissive.setHex(color);
        mat.transparent = true;

        const geo = geometryType === 'box' ? this.boxGeometry : this.sphereGeometry;

        for (let i = 0; i < count; i++) {
            const particle = new THREE.Mesh(geo, mat);
            particle.position.copy(position);
            
            // Random initial velocity
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * speed * spread,
                (Math.random() - 0.5) * speed * spread,
                (Math.random() - 0.5) * speed * spread
            );
            
            particle.life = life * (0.8 + Math.random() * 0.4); 
            particle.maxLife = particle.life;
            particle.gravity = gravity;
            particle.initialScale = scale;

            this.scene.add(particle);
            this.particles.push(particle);
        }
    }

    emitDustCloud(position) {
        this.emit(position, 12, 0xaaaaaa, {
            speed: 3,
            gravity: 1,
            life: 0.8,
            scale: 2.0,
            spread: 1.5,
            geometryType: 'sphere'
        });
    }

    emitMagicSparks(position, color = 0x00ffff) {
        this.emit(position, 15, color, {
            speed: 12,
            gravity: 5,
            life: 0.5,
            scale: 1.5,
            spread: 2.0,
            geometryType: 'box'
        });
    }

    update(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= deltaTime;
            
            if (p.life <= 0) {
                this.scene.remove(p);
                // Not disposing geometry as it is shared
                p.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }

            // Move particle
            p.position.add(p.velocity.clone().multiplyScalar(deltaTime));
            
            // Apply gravity
            p.velocity.y -= p.gravity * deltaTime;
            
            // Fade out and shrink
            const lifeRatio = p.life / p.maxLife;
            p.material.opacity = lifeRatio;
            p.scale.setScalar(p.initialScale * lifeRatio);
        }
    }
}
