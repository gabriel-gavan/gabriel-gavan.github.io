import * as THREE from 'three';

export class MicroDrone {
    constructor(scene, player, orbitIndex, totalDrones, particleSystem = null) {
        this.scene = scene;
        this.player = player;
        this.orbitIndex = orbitIndex;
        this.totalDrones = totalDrones;
        this.particleSystem = particleSystem;
        this.mesh = this.createMesh();
        this.scene.add(this.mesh);
        
        this.orbitRadius = 2.5;
        this.orbitSpeed = 2;
        this.angle = (orbitIndex / totalDrones) * Math.PI * 2;
        this.yOffset = 1.5;
        this.lastAttack = 0;
        this.attackCooldown = 1500;
        this.damage = 10;
        this.isDead = false;
        this._lastUpdateTime = 0;
        this._nextLightCheck = 0;
    }

    createMesh() {
        const geo = new THREE.IcosahedronGeometry(0.15, 0);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0x00ffff, 
            emissive: 0x00aaff,
            metalness: 0.9,
            roughness: 0.1
        });
        const mesh = new THREE.Mesh(geo, mat);
        
        // Low-intensity point light
        this.light = new THREE.PointLight(0x00ffff, 0.5, 2);
        mesh.add(this.light);
        
        return mesh;
    }

    update(deltaTime, enemies, forcedTarget = null) {
        if (this.isDead) return;

        const now = Date.now();

        // Shared Target Sync: If player has a target, we focus it
        let target = forcedTarget;
        
        // Swarm logic: If multiple drones focus one target, fire faster
        let swarmBonus = 1;
        if (target && !target.isDead) {
            let dronesFocusing = 0;
            const gameEnemies = window.game?.enemies;
            if (gameEnemies) {
                for (let i = 0; i < gameEnemies.length; i++) {
                    const e = gameEnemies[i];
                    if (e.isAlly && e.microDrones) {
                        for (let j = 0, len = e.microDrones.length; j < len; j++) {
                            const d = e.microDrones[j];
                            if (d !== this && d.currentTarget === target) dronesFocusing++;
                        }
                    }
                }
            }
            if (dronesFocusing > 0) swarmBonus = 1 + (dronesFocusing * 0.15); // Scale fire rate
        }
        this.currentTarget = target;

        // Orbit logic
        this.angle += this.orbitSpeed * deltaTime;
        const playerPos = this.player.mesh.position;
        
        const targetRadius = this.orbitRadius + (Math.sin(now * 0.001 + this.orbitIndex) * 0.5);
        this.mesh.position.set(
            playerPos.x + Math.cos(this.angle) * targetRadius,
            playerPos.y + this.yOffset + Math.sin(this.angle * 0.5) * 0.3,
            playerPos.z + Math.sin(this.angle) * targetRadius
        );

        // Face movement direction or target
        if (target) {
            this.mesh.lookAt(target.mesh.position);
        } else {
            this.mesh.rotation.y = -this.angle;
        }

        // Throttled light visibility
        if (now >= this._nextLightCheck) {
            this._nextLightCheck = now + 30;
            this.light.visible = this.player.mesh.position.distanceToSquared(this.mesh.position) < 400;
        }

        // Attack logic
        const currentCooldown = this.attackCooldown / swarmBonus;
        if (now - this.lastAttack > currentCooldown) {
            if (!target || target.isDead) {
                let nearest = null;
                let minDistSq = 225; // 15m range (increased from 12)

                for (let i = 0; i < enemies.length; i++) {
                    const e = enemies[i];
                    if (!e.isAlly && !e.isDead) {
                        const dSq = e.mesh.position.distanceToSquared(this.mesh.position);
                        if (dSq < minDistSq) {
                            minDistSq = dSq;
                            nearest = e;
                        }
                    }
                }
                target = nearest;
                this.currentTarget = target;
            }

            if (target) {
                this.shoot(target);
                this.lastAttack = now;
            }
        }
    }

    shoot(target) {
        if (this.particleSystem) {
            this.particleSystem.createTracer(this.mesh.position, target.mesh.position, 0x00ffff, 0.5);
        } else {
            // Fallback if particle system not available
            const points = [this.mesh.position.clone(), target.mesh.position.clone()];
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 1 });
            const line = new THREE.Line(geo, mat);
            this.scene.add(line);
            setTimeout(() => {
                if (line.geometry) line.geometry.dispose();
                if (line.material) line.material.dispose();
                this.scene.remove(line);
            }, 50);
        }

        target.takeDamage(this.damage);
    }

    destroy() {
        if (this.isDead) return;
        this.isDead = true;
        
        if (this.mesh) {
            this.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
            this.scene.remove(this.mesh);
        }
    }
}
