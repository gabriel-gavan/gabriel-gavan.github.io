import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Turret {
    constructor(scene, position, direction, particleSystem, type = 'LASER') {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.type = type;
        
        this.mesh = this.createMesh();
        this.mesh.position.copy(position);
        
        // Face the deployment direction but stay upright
        const lookTarget = position.clone().add(direction);
        this.mesh.lookAt(lookTarget.x, position.y, lookTarget.z);
        
        this.scene.add(this.mesh);

        const stats = CONFIG.TURRETS[this.type];
        this.health = 100;
        this.maxHealth = 100;
        this.isDead = false;
        this.lastFireTime = 0;
        this.fireRate = stats.FIRE_RATE; 
        this.range = stats.RANGE;
        this.damage = stats.DAMAGE;
        
        this.target = null;

        // Visual for SLOW field
        if (this.type === 'SLOW') {
            this.slowField = this.createSlowFieldMesh();
            this.mesh.add(this.slowField);
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
        
        let accentColor = 0x00ffaa;
        if (this.type === 'EMP') accentColor = 0x00ffff;
        if (this.type === 'SLOW') accentColor = 0xaa00ff;

        const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
        const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 1 });

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
        const geo = new THREE.CylinderGeometry(this.range, this.range, 0.1, 32);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0xaa00ff, 
            transparent: true, 
            opacity: 0.1, 
            side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = -0.9; // Sit on ground
        return mesh;
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

    update(deltaTime, enemies) {
        if (this.isDead) return;

        // Reset support flags
        const isOverclocked = this.supportOverclocked;
        this.supportOverclocked = false;

        // Special handling for SLOW field type
        if (this.type === 'SLOW') {
            const rotSpeed = isOverclocked ? 4 : 2;
            this.head.rotation.y += deltaTime * rotSpeed;
            enemies.forEach(e => {
                if (!e.isAlly && !e.isDead) {
                    const d = e.mesh.position.distanceTo(this.mesh.position);
                    if (d < this.range) {
                        const slowFactor = isOverclocked ? 0.2 : 0.4;
                        e.timeScale = Math.min(e.timeScale, slowFactor); 
                        
                        // Adaptive feedback for SLOW
                        if (e.type === 'HEAVY_SEC_BOT') {
                            e.takeDamage(1 * deltaTime, enemies, 'SLOW'); // Minor tick to track "damage" for adaptation
                        }
                    }
                }
            });
            return;
        }

        // Find nearest enemy
        let nearest = null;
        let minDist = this.range;

        enemies.forEach(e => {
            if (!e.isAlly && !e.isDead) {
                const d = e.mesh.position.distanceTo(this.mesh.position);
                if (d < minDist) {
                    minDist = d;
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

        if (this.type === 'LASER') {
            // Visual flash
            const flash = new THREE.PointLight(color, 5, 3);
            const barrelPos = new THREE.Vector3(0, 0, 0.6);
            this.head.localToWorld(barrelPos);
            flash.position.copy(barrelPos);
            this.scene.add(flash);
            setTimeout(() => this.scene.remove(flash), 50);

            // Trace line
            const endPos = this.target.mesh.position.clone();
            const points = [barrelPos, endPos];
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.5 });
            const line = new THREE.Line(geo, mat);
            this.scene.add(line);
            setTimeout(() => this.scene.remove(line), 50);

            // Damage
            this.target.takeDamage(this.damage, enemies, 'LASER');
            
            if (this.particleSystem) {
                this.particleSystem.createExplosion(endPos, color, 5, 0.5);
            }
        } else if (this.type === 'EMP') {
            // AOE Blast
            const pos = this.mesh.position.clone();
            pos.y += 1;
            
            if (this.particleSystem) {
                this.particleSystem.createExplosion(pos, 0x00ffff, 20, 5);
            }

            const light = new THREE.PointLight(0x00ffff, 10, 10);
            light.position.copy(pos);
            this.scene.add(light);
            setTimeout(() => this.scene.remove(light), 200);

            enemies.forEach(e => {
                if (!e.isAlly && !e.isDead && e.mesh.position.distanceTo(pos) < 10) {
                    e.takeDamage(this.damage, enemies, 'EMP');
                    e.applyEMP(2000); // 2 second stun
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
