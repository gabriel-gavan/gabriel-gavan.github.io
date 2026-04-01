import * as THREE from 'three';

const NEURAL_RADIUS = 6.0;
const NEURAL_RADIUS_SQ = NEURAL_RADIUS * NEURAL_RADIUS;
const NEURAL_DAMAGE = 60;
const NEURAL_MAX_HEALTH = 500;
const NEURAL_PULSE_RATE = 8.0;
const NEURAL_ROT_Y = 2.0;
const NEURAL_ROT_Z = 1.5;
const NEURAL_EMISSIVE_RATE = 15.0;
const NEURAL_EMISSIVE_BASE = 2.0;
const NEURAL_EMISSIVE_VARIATION = 1.5;
const NEURAL_GROUND_OPACITY_BASE = 0.1;
const NEURAL_GROUND_OPACITY_VARIATION = 0.05;
const NEURAL_LIGHT_MULTIPLIER = 2;
const NEURAL_PLAYER_GLITCH = 0.3;
const NEURAL_ENEMY_HEAL = 50;
const NEURAL_ENEMY_DAMAGE = 0.5;
const NEURAL_ENEMY_SCALE = 1.2;
const NEURAL_PARTICLE_CHANCE = 0.3;
const NEURAL_TRACER_CHANCE = 0.2;
const NEURAL_PARTICLE_COLOR = 0xff00ff;
const NEURAL_PLAYER_DAMAGE_COLOR = 'rgba(255, 0, 255, 0.4)';

export class NeuralDisruptor {
    constructor(scene, particleSystem) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.isActive = false;
        this.isDead = true;
        this.timer = 0;
        this.radius = NEURAL_RADIUS;
        this.damage = NEURAL_DAMAGE;
        this.health = NEURAL_MAX_HEALTH;
        this.position = new THREE.Vector3();
        
        const geo = new THREE.IcosahedronGeometry(1.5, 1);
        const groundGeo = new THREE.CircleGeometry(this.radius, 32);

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

        this.mesh = new THREE.Mesh(geo, this.mat);
        this.mesh.visible = false;
        this.scene.add(this.mesh);

        this.groundIndicator = new THREE.Mesh(groundGeo, this.groundMat);
        this.groundIndicator.rotation.x = -Math.PI / 2;
        this.groundIndicator.visible = false;
        this.scene.add(this.groundIndicator);

        this.light = new THREE.PointLight(0xff00ff, 0, 12);
        this.scene.add(this.light);

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
        
        this.health = NEURAL_MAX_HEALTH;
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
        
        const pulse = 1.0 + Math.sin(this.timer * NEURAL_PULSE_RATE) * 0.2;
        this.mesh.scale.set(pulse, pulse, pulse);
        this.mesh.rotation.y += deltaTime * NEURAL_ROT_Y;
        this.mesh.rotation.z += deltaTime * NEURAL_ROT_Z;
        this.mat.emissiveIntensity = NEURAL_EMISSIVE_BASE + Math.sin(this.timer * NEURAL_EMISSIVE_RATE) * NEURAL_EMISSIVE_VARIATION;
        this.light.intensity = this.mat.emissiveIntensity * NEURAL_LIGHT_MULTIPLIER;
        this.groundMat.opacity = NEURAL_GROUND_OPACITY_BASE + Math.sin(this.timer * 4.0) * NEURAL_GROUND_OPACITY_VARIATION;

        const playerPos = player.mesh.position;
        const dx = playerPos.x - this.position.x;
        const dz = playerPos.z - this.position.z;
        const distSq = dx * dx + dz * dz;
        
        if (distSq < NEURAL_RADIUS_SQ) {
            player.takeDamage(this.damage * deltaTime, true, NEURAL_PLAYER_DAMAGE_COLOR);
            
            if (window.game && window.game.heatVisuals) {
                window.game.heatVisuals.glitchIntensity = Math.max(window.game.heatVisuals.glitchIntensity, NEURAL_PLAYER_GLITCH);
            }
        }

        if (enemies) {
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                if (enemy.isDead || enemy.isAlly) continue;
                
                const edx = enemy.mesh.position.x - this.position.x;
                const edz = enemy.mesh.position.z - this.position.z;
                const eDistSq = edx * edx + edz * edz;
                
                if (eDistSq < NEURAL_RADIUS_SQ) {
                    if (enemy.isElite || enemy.isBoss) {
                        enemy.damageMultiplier = 2.0;
                        if (!enemy._neuralOverloadVisual) {
                            enemy._neuralOverloadVisual = true;
                            enemy.mesh.scale.multiplyScalar(NEURAL_ENEMY_SCALE);
                            if (enemy.mesh.material) {
                                enemy.mesh.material.emissive.set(NEURAL_PARTICLE_COLOR);
                                enemy.mesh.material.emissiveIntensity = 2.0;
                            }
                        }
                        enemy.health = Math.min(enemy.maxHealth, enemy.health + NEURAL_ENEMY_HEAL * deltaTime);
                    } else {
                        enemy.takeDamage(this.damage * NEURAL_ENEMY_DAMAGE * deltaTime, enemies, 'PLAYER');
                    }
                } else if (enemy._neuralOverloadVisual) {
                    enemy._neuralOverloadVisual = false;
                    enemy.damageMultiplier = 1.0;
                    enemy.mesh.scale.divideScalar(NEURAL_ENEMY_SCALE);
                    if (enemy.mesh.material && enemy.typeData) {
                        enemy.mesh.material.emissive.set(enemy.typeData.emissive);
                        enemy.mesh.material.emissiveIntensity = 1.0;
                    }
                }
            }
        }

        if (this.particleSystem && Math.random() < NEURAL_PARTICLE_CHANCE) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * this.radius;
            const px = this.position.x + Math.cos(angle) * r;
            const pz = this.position.z + Math.sin(angle) * r;
            
            this.particleSystem.createExplosion({ x: px, y: 0.1, z: pz }, NEURAL_PARTICLE_COLOR, 1, 0.5);
            
            if (distSq < NEURAL_RADIUS_SQ && Math.random() < NEURAL_TRACER_CHANCE) {
                this.particleSystem.createTracer(this.mesh.position, player.camera.position, NEURAL_PARTICLE_COLOR, 0.5);
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
            this.particleSystem.createExplosion(this.mesh.position, NEURAL_PARTICLE_COLOR, 100, 10);
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