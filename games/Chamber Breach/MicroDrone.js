import * as THREE from 'three';

export class MicroDrone {
    constructor(scene, player, orbitIndex, totalDrones) {
        this.scene = scene;
        this.player = player;
        this.orbitIndex = orbitIndex;
        this.totalDrones = totalDrones;
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
        
        const light = new THREE.PointLight(0x00ffff, 1, 2);
        mesh.add(light);
        
        return mesh;
    }

    update(deltaTime, enemies, forcedTarget = null) {
        if (this.isDead) return;

        // Orbit logic
        this.angle += this.orbitSpeed * deltaTime;
        const playerPos = this.player.mesh.position;
        
        this.mesh.position.set(
            playerPos.x + Math.cos(this.angle) * this.orbitRadius,
            playerPos.y + this.yOffset + Math.sin(this.angle * 0.5) * 0.3, // Slight bobbing
            playerPos.z + Math.sin(this.angle) * this.orbitRadius
        );

        // Face movement direction
        this.mesh.rotation.y = -this.angle;

        // Attack logic
        if (Date.now() - this.lastAttack > this.attackCooldown) {
            let target = forcedTarget;
            
            if (!target || target.isDead) {
                let nearest = null;
                let minDist = 12;

                enemies.forEach(e => {
                    if (!e.isAlly && !e.isDead) {
                        const d = e.mesh.position.distanceTo(this.mesh.position);
                        if (d < minDist) {
                            minDist = d;
                            nearest = e;
                        }
                    }
                });
                target = nearest;
            }

            if (target) {
                this.shoot(target);
                this.lastAttack = Date.now();
            }
        }
    }

    shoot(target) {
        // Visual bolt
        const points = [this.mesh.position.clone(), target.mesh.position.clone()];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 1 });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);

        setTimeout(() => {
            this.scene.remove(line);
        }, 50);

        target.takeDamage(this.damage);
    }

    destroy() {
        this.isDead = true;
        this.scene.remove(this.mesh);
    }
}
