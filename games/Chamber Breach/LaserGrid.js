import * as THREE from 'three';
import { CONFIG } from './config.js';

export class LaserGrid {
    constructor(scene, chamber, horizontal = true) {
        this.scene = scene;
        this.chamber = chamber;
        this.horizontal = horizontal;
        this.size = chamber.size - 2;
        this.width = CONFIG.HAZARDS.LASER_GRID.WIDTH;
        this.speed = CONFIG.HAZARDS.LASER_GRID.SPEED;
        this.damage = CONFIG.HAZARDS.LASER_GRID.DAMAGE;
        
        this.mesh = this.createMesh();
        this.mesh.position.set(chamber.x, 1.5, chamber.z);
        this.scene.add(this.mesh);
        
        this.time = 0;
        this.direction = 1;
        this.range = (this.size - this.width) / 2;
        
        // Offset for variety
        this.timeOffset = Math.random() * Math.PI * 2;
    }

    createMesh() {
        const group = new THREE.Group();
        const laserMat = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        
        const beamCount = 5;
        const beamSpacing = 0.5;
        
        for (let i = 0; i < beamCount; i++) {
            const beamGeo = this.horizontal ? 
                new THREE.BoxGeometry(this.width, 0.05, 0.05) :
                new THREE.BoxGeometry(0.05, 0.05, this.width);
            
            const beam = new THREE.Mesh(beamGeo, laserMat);
            beam.position.y = i * beamSpacing - (beamCount * beamSpacing) / 2;
            group.add(beam);
        }
        
        return group;
    }

    update(deltaTime, player, enemies, canDamage = true) {
        this.time += deltaTime;
        
        const offset = Math.sin(this.time * this.speed + this.timeOffset) * this.range;
        
        if (this.horizontal) {
            this.mesh.position.z = this.chamber.z + offset;
        } else {
            this.mesh.position.x = this.chamber.x + offset;
        }

        // Pulse opacity
        this.mesh.children.forEach(beam => {
            beam.material.opacity = 0.4 + Math.sin(this.time * 10) * 0.2;
        });

        // Collision Check
        if (canDamage) {
            this.checkCollision(player, enemies);
        }
    }

    checkCollision(player, enemies) {
        // Simple AABB for player
        const pPos = player.mesh.position;
        const mPos = this.mesh.position;
        
        let hitPlayer = false;
        if (this.horizontal) {
            if (Math.abs(pPos.x - mPos.x) < this.width / 2 && 
                Math.abs(pPos.z - mPos.z) < 0.5 && 
                Math.abs(pPos.y - mPos.y) < 1.5) {
                hitPlayer = true;
            }
        } else {
            if (Math.abs(pPos.z - mPos.z) < this.width / 2 && 
                Math.abs(pPos.x - mPos.x) < 0.5 && 
                Math.abs(pPos.y - mPos.y) < 1.5) {
                hitPlayer = true;
            }
        }

        if (hitPlayer) {
            player.takeDamage(this.damage * 0.1, true); // DOT damage
            // Visual for player hit
            if (Math.random() < 0.1) {
                document.body.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
            }
        }

        // Collision with enemies
        enemies.forEach(enemy => {
            if (enemy.isDead) return;
            const ePos = enemy.mesh.position;
            let hitEnemy = false;
            if (this.horizontal) {
                if (Math.abs(ePos.x - mPos.x) < this.width / 2 && 
                    Math.abs(ePos.z - mPos.z) < 0.5 && 
                    Math.abs(ePos.y - mPos.y) < 1.5) {
                    hitEnemy = true;
                }
            } else {
                if (Math.abs(ePos.z - mPos.z) < this.width / 2 && 
                    Math.abs(ePos.x - mPos.x) < 0.5 && 
                    Math.abs(ePos.y - mPos.y) < 1.5) {
                    hitEnemy = true;
                }
            }
            if (hitEnemy) {
                enemy.takeDamage(this.damage * 0.1, enemies);
            }
        });
    }

    destroy() {
        this.scene.remove(this.mesh);
        this.mesh.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}
