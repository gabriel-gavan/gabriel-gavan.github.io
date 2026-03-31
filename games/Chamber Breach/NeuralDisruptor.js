import * as THREE from 'three';

export class NeuralDisruptor {
    constructor(scene, particleSystem) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.isActive = false;
        this.isDead = true;
        this.timer = 0;
        this.radius = 6.0;
        this.damage = 60;
        this.health = 500;
        this.position = new THREE.Vector3();
        
        // --- Geometries (Static) ---
        const geo = new THREE.IcosahedronGeometry(1.5, 1);
        const groundGeo = new THREE.CircleGeometry(this.radius, 32);

        // --- Materials ---
        this.mat = new THREE.MeshStandardMaterial({ 
            color: 0x000000, 
            emissive: 0xff00ff,
            emissiveIntensity: 2.0,
            metalness: 1.0,
            roughness: 0.0,
            wireframe: true
        });

        this.groundMat = new THREE.MeshBasicMaterial({ 
            color: 0xff00ff, 
            transparent: true, 
            opacity: 0.1,
            side: THREE.DoubleSide
        });

        // --- Meshes ---
        this.mesh = new THREE.Mesh(geo, this.mat);
        this.mesh.visible = false;
        this.scene.add(this.mesh);

        this.groundIndicator = new THREE.Mesh(groundGeo, this.groundMat);
        this.groundIndicator.rotation.x = -Math.PI / 2;
        this.groundIndicator.visible = false;
        this.scene.add(this.groundIndicator);

        // --- Light ---
        this.light = new THREE.PointLight(0xff00ff, 0, 12);
        this.scene.add(this.light);

        // Logic
        this.mesh.userData.isDestructible = true;
        this.mesh.userData.health = this.health;
        this.mesh.userData.isNeuralDisruptor = true;
        this.mesh.userData.parent = this;
    }

    spawn(position) {
        this.position.copy(position);
        this.mesh.position.copy(this.position);
        this.mesh.position.y = 2.5;
        this.groundIndicator.position.copy(this.position);
        this.groundIndicator.position.y = 0.1;
        this.light.position.copy(this.mesh.position);
        
        this.health = 500;
        this.mesh.userData.health = this.health;
        this.timer = 0;
        this.isActive = true;
        this.isDead = false;
        
        this.mesh.visible = true;
        this.groundIndicator.visible = true;
        this.light.intensity = 5;
        this.light.visible = true;
    }

    update(deltaTime, player, enemies) {
        if (this.isDead || !this.isActive) return;

        this.timer += deltaTime;
        
        // Visual pulses
        const pulse = 1.0 + Math.sin(this.timer * 8.0) * 0.2;
        this.mesh.scale.set(pulse, pulse, pulse);
        this.mesh.rotation.y += deltaTime * 2.0;
        this.mesh.rotation.z += deltaTime * 1.5;
        this.mat.emissiveIntensity = 2.0 + Math.sin(this.timer * 15.0) * 1.5;
        this.light.intensity = this.mat.emissiveIntensity * 2;
        this.groundMat.opacity = 0.1 + Math.sin(this.timer * 4.0) * 0.05;

        // Damage logic
        const playerPos = player.mesh.position;
        const dx = playerPos.x - this.position.x;
        const dz = playerPos.z - this.position.z;
        const distSq = dx*dx + dz*dz;
        
        if (distSq < this.radius * this.radius) {
            // Apply heavy DOT damage
            player.takeDamage(this.damage * deltaTime, true, 'rgba(255, 0, 255, 0.4)');
            
            // Visual glitch feedback when in range
            if (window.game && window.game.heatVisuals) {
                window.game.heatVisuals.glitchIntensity = Math.max(window.game.heatVisuals.glitchIntensity, 0.3);
            }
        }

        // Damage enemies
        if (enemies) {
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                if (enemy.isDead || enemy.isAlly) continue;
                
                const edx = enemy.mesh.position.x - this.position.x;
                const edz = enemy.mesh.position.z - this.position.z;
                const eDistSq = edx*edx + edz*edz;
                
                if (eDistSq < this.radius * this.radius) {
                    if (enemy.isElite || enemy.isBoss) {
                        enemy.damageMultiplier = 2.0;
                        if (!enemy._neuralOverloadVisual) {
                            enemy._neuralOverloadVisual = true;
                            enemy.mesh.scale.multiplyScalar(1.2);
                            if (enemy.mesh.material) {
                                enemy.mesh.material.emissive.set(0xff00ff);
                                enemy.mesh.material.emissiveIntensity = 2.0;
                            }
                        }
                        enemy.health = Math.min(enemy.maxHealth, enemy.health + 50 * deltaTime);
                    } else {
                        enemy.takeDamage(this.damage * 0.5 * deltaTime, enemies, 'PLAYER');
                    }
                } else if (enemy._neuralOverloadVisual) {
                    enemy._neuralOverloadVisual = false;
                    enemy.damageMultiplier = 1.0;
                    enemy.mesh.scale.divideScalar(1.2);
                    if (enemy.mesh.material && enemy.typeData) {
                        enemy.mesh.material.emissive.set(enemy.typeData.emissive);
                        enemy.mesh.material.emissiveIntensity = 1.0;
                    }
                }
            }
        }

        // Particles
        if (this.particleSystem && Math.random() < 0.3) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * this.radius;
            const px = this.position.x + Math.cos(angle) * r;
            const pz = this.position.z + Math.sin(angle) * r;
            
            // Re-use a vector if possible, but for simple explosion we pass a point
            this.particleSystem.createExplosion({ x: px, y: 0.1, z: pz }, 0xff00ff, 1, 0.5);
            
            if (distSq < this.radius * this.radius && Math.random() < 0.2) {
                this.particleSystem.createTracer(this.mesh.position, player.camera.position, 0xff00ff, 0.5);
            }
        }
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        if (this.isDead) return;
        this.isDead = true;
        this.isActive = false;
        
        if (this.particleSystem) {
            this.particleSystem.createExplosion(this.mesh.position, 0xff00ff, 100, 10);
        }
        
        this.mesh.visible = false;
        this.groundIndicator.visible = false;
        this.light.visible = false;
        this.light.intensity = 0;
        
        if (window.game) {
            window.game.shakeAmount += 2.0;
        }
    }

    destroy() {
        this.die();
    }
}
