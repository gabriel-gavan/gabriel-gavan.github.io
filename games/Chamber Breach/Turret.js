import * as THREE from 'three';
import { CONFIG } from './config.js';

const MATH = {
    v1: new THREE.Vector3(),
    v2: new THREE.Vector3(),
    v3: new THREE.Vector3()
};

export class Turret {
    constructor(scene, position, direction, particleSystem, type = 'LASER', isOmega = false) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.type = type;
        this.isOmega = isOmega;
        
        let accentColor = 0x00ffaa;
        if (this.type === 'EMP') accentColor = 0x00ffff;
        if (this.type === 'SLOW') accentColor = 0xaa00ff;
        this.accentColor = accentColor;

        this.mesh = this.createMesh();
        this.mesh.position.copy(position);
        
        // Face the deployment direction but stay upright
        const lookTarget = position.clone().add(direction);
        this.mesh.lookAt(lookTarget.x, position.y, lookTarget.z);
        
        this.scene.add(this.mesh);

        const configKey = isOmega ? (type === 'LASER' ? 'OMEGA_SENTRY' : `OMEGA_${type}`) : type;
        const stats = CONFIG.TURRETS[configKey];
        
        this.maxHealth = stats.HEALTH || (isOmega ? 1500 : 150);
        this.health = this.maxHealth;
        this.isDead = false;
        this.lastFireTime = 0;
        this.fireRate = stats.FIRE_RATE;
        this.range = stats.RANGE;
        this.damage = stats.damage || stats.DAMAGE; // Handle inconsistent casing
        this.slowFactor = stats.SLOW_FACTOR || 0.4;
        
        this.target = null;

        // Visual for SLOW field
        if (this.type === 'SLOW') {
            this.slowField = this.createSlowFieldMesh();
            this.mesh.add(this.slowField);
        }

        if (this.isOmega) {
            this.mesh.scale.set(1.5, 1.5, 1.5);
            this.createOmegaVisuals();
            
            // Deployment feedback using newly optimized emitters
            if (this.particleSystem) {
                this.particleSystem.createThermalPulse(position, 12, this.accentColor);
                this.particleSystem.createLargeCloud(position, this.accentColor, 8, 4);
            }
        }

        // Upgrade Levels
        this.levels = {
            damage: 1,
            fireRate: 1,
            health: 1
        };
    }

    createMesh() {
        const group = new THREE.Group();
        
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
        const accentMat = new THREE.MeshStandardMaterial({ color: this.accentColor, emissive: this.accentColor, emissiveIntensity: 1 });

        // Base
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.4, 8), baseMat);
        base.position.y = 0.2;
        group.add(base);

        // Neck
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), baseMat);
        neck.position.y = 0.7;
        group.add(neck);

        // Head/Turret
        this.head = new THREE.Group();
        this.head.position.y = 1.0;
        group.add(this.head);

        if (this.type === 'LASER') {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.6), baseMat);
            this.head.add(body);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), baseMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.z = 0.4;
            this.head.add(barrel);
        } else if (this.type === 'EMP') {
            const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), baseMat);
            this.head.add(body);
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 24), accentMat);
            ring.rotation.x = Math.PI / 2;
            this.head.add(ring);
        } else if (this.type === 'SLOW') {
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 6), baseMat);
            this.head.add(body);
            const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), accentMat);
            crystal.position.y = 0.4;
            this.head.add(crystal);
        }

        const light = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), accentMat);
        light.position.set(0, 0.2, 0);
        this.head.add(light);

        return group;
    }

    createSlowFieldMesh() {
        const radius = this.range;
        const geo = new THREE.CylinderGeometry(radius, radius, 0.1, 32);
        const mat = new THREE.MeshBasicMaterial({ 
            color: this.isOmega ? 0xff00ff : 0xaa00ff, 
            transparent: true, 
            opacity: this.isOmega ? 0.2 : 0.1, 
            side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = -0.9; // Sit on ground
        return mesh;
    }

    createOmegaVisuals() {
        const accentMat = new THREE.MeshStandardMaterial({ color: this.accentColor, emissive: this.accentColor, emissiveIntensity: 2 });
        
        // Add dual barrels or extra crystals
        if (this.type === 'LASER') {
            const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), this.head.children[1].material);
            barrel2.rotation.x = Math.PI / 2;
            barrel2.position.set(0.15, 0.1, 0.4);
            const barrel3 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), this.head.children[1].material);
            barrel3.rotation.x = Math.PI / 2;
            barrel3.position.set(-0.15, 0.1, 0.4);
            this.head.add(barrel2, barrel3);
        } else {
            const orbit = new THREE.Group();
            this.head.add(orbit);
            for (let i = 0; i < 4; i++) {
                const cry = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), accentMat);
                const angle = (i / 4) * Math.PI * 2;
                cry.position.set(Math.cos(angle) * 0.6, 0.5, Math.sin(angle) * 0.6);
                orbit.add(cry);
            }
            this.orbit = orbit;
        }
    }

    repair(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    upgrade(stat) {
        if (stat === 'damage') {
            this.levels.damage++;
            this.damage += 5;
        } else if (stat === 'fireRate') {
            this.levels.fireRate++;
            this.fireRate = Math.max(100, this.fireRate - 50);
        } else if (stat === 'health') {
            this.levels.health++;
            const healthBoost = 50;
            this.maxHealth += healthBoost;
            this.health += healthBoost;
        }
        
        // Visual feedback for upgrade
        const accentMat = new THREE.MeshStandardMaterial({ 
            color: this.levels.damage > 2 ? 0xff0000 : 0x00ffaa, 
            emissive: this.levels.damage > 2 ? 0xff0000 : 0x00ffaa, 
            emissiveIntensity: 2 
        });
        this.head.traverse(child => {
            if (child.isMesh && child.material && child.material.emissive) {
                child.material = accentMat;
            }
        });
    }

    update(deltaTime, enemies, spatialGrid = null) {
        if (this.isDead) return;

        if (this.orbit) {
            this.orbit.rotation.y += deltaTime * 5;
        }

        // Reset support flags
        const isOverclocked = this.supportOverclocked;
        this.supportOverclocked = false;

        // Optimized enemy searching using spatial grid if available
        const searchRange = this.range;
        const potentialEnemies = spatialGrid ? spatialGrid.getNearby(this.mesh.position, searchRange) : enemies;

        // Special handling for SLOW field type
        if (this.type === 'SLOW') {
            const rotSpeed = isOverclocked ? 4 : 2;
            this.head.rotation.y += deltaTime * rotSpeed;
            
            potentialEnemies.forEach(e => {
                if (!e.isAlly && !e.isDead) {
                    const dSq = e.mesh.position.distanceToSquared(this.mesh.position);
                    if (dSq < searchRange * searchRange) {
                        const slowFactor = isOverclocked ? this.slowFactor * 0.5 : this.slowFactor;
                        e.timeScale = Math.min(e.timeScale, slowFactor); 
                        
                        // Adaptive feedback for SLOW
                        if (this.isOmega) {
                            // Omega SLOW also deals minor DOT
                            e.takeDamage(this.damage * deltaTime, enemies, 'SLOW');
                            // Apply fragile debuff
                            e.isFragile = true;
                            e.fragileTimer = 1000;
                        } else {
                            e.takeDamage(this.damage * deltaTime, enemies, 'SLOW');
                        }
                    }
                }
            });
            return;
        }

        // Find nearest enemy
        let nearest = null;
        let minDistSq = searchRange * searchRange;

        potentialEnemies.forEach(e => {
            if (!e.isAlly && !e.isDead) {
                const dSq = e.mesh.position.distanceToSquared(this.mesh.position);
                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    nearest = e;
                }
            }
        });

        this.target = nearest;

        if (this.target) {
            // Track target
            const targetPos = this.target.mesh.position.clone();
            targetPos.y += 0.5; // Aim at body
            
            this.head.lookAt(targetPos);

            // Fire
            const currentFireRate = isOverclocked ? this.fireRate * 0.5 : this.fireRate;
            if (Date.now() - this.lastFireTime > currentFireRate) {
                this.fire(enemies);
            }
        } else {
            // Idle rotation
            const rotSpeed = isOverclocked ? 1.5 : 0.5;
            this.head.rotation.y += deltaTime * rotSpeed;
        }
    }

    fire(enemies) {
        this.lastFireTime = Date.now();
        
        let color = 0x00ffaa;
        if (this.type === 'EMP') color = 0x00ffff;
        if (this.isOmega) {
            color = this.type === 'LASER' ? 0xff00ff : 0xffffff;
        }

        if (this.type === 'LASER') {
            // Use MATH pool for zero-allocation position calculations
            MATH.v1.set(0, 0, 0.6);
            this.head.localToWorld(MATH.v1);
            
            MATH.v2.copy(this.target.mesh.position);
            MATH.v2.y += 0.5;

            if (this.particleSystem) {
                this.particleSystem.flashLight(MATH.v1, color, 5, 3, 50);
                this.particleSystem.createTracer(MATH.v1, MATH.v2, color, this.isOmega ? 0.3 : 0.1, 1.0);
                this.particleSystem.createExplosion(MATH.v2, color, this.isOmega ? 15 : 5, 0.5);
            }

            // Damage
            const dmg = this.damage;
            this.target.takeDamage(dmg, enemies, 'LASER');
            
            // Omega Laser also pierces (deals damage in line)
            if (this.isOmega) {
                // Zero-allocation direction calculation
                MATH.v3.subVectors(MATH.v2, MATH.v1).normalize();
                enemies.forEach(e => {
                    if (e !== this.target && !e.isAlly && !e.isDead) {
                        const d = e.mesh.position.distanceTo(MATH.v1);
                        if (d < this.range) {
                            // Re-use v2 for toEnemy vector
                            MATH.v2.subVectors(e.mesh.position, MATH.v1).normalize();
                            const dot = MATH.v3.dot(MATH.v2);
                            if (dot > 0.99) { // Tight line
                                e.takeDamage(dmg * 0.5, enemies, 'LASER');
                            }
                        }
                    }
                });
            }
        } else if (this.type === 'EMP') {
            // Zero-allocation position
            MATH.v1.copy(this.mesh.position);
            MATH.v1.y += 1;
            
            const radius = this.isOmega ? 20 : 10;
            const stunDur = this.isOmega ? 10000 : 2000;

            if (this.particleSystem) {
                this.particleSystem.createExplosion(MATH.v1, color, this.isOmega ? 50 : 20, 5);
                this.particleSystem.flashLight(MATH.v1, color, 15, radius, 300);
            }

            enemies.forEach(e => {
                if (!e.isAlly && !e.isDead && e.mesh.position.distanceTo(MATH.v1) < radius) {
                    e.takeDamage(this.damage, enemies, 'EMP');
                    e.applyEMP(stunDur);
                }
            });
        }
    }

    takeDamage(amt) {
        this.health -= amt;
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.isDead = true;
        if (this.particleSystem) {
            this.particleSystem.createExplosion(this.mesh.position, 0x555555, 20, 2);
        }
        this.scene.remove(this.mesh);
    }
}
