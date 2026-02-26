import * as THREE from 'three';

export class CryoVent {
    constructor(scene, position, particleSystem) {
        this.scene = scene;
        this.position = position.clone();
        this.particleSystem = particleSystem;
        this.timer = Math.random() * 6; // Random offset for timing
        this.activeDuration = 3.5;
        this.cooldownDuration = 2.5;
        this.isActive = false;
        this.isFrozen = false;
        this.freezeTimer = 0;
        
        // Vent visual - it's a floor hazard so it should be flat
        const ventTex = new THREE.TextureLoader().load('assets/cryo_vent_sprite.webp');
        const ventMat = new THREE.MeshBasicMaterial({ 
            map: ventTex, 
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const geo = new THREE.PlaneGeometry(2.5, 2.5);
        this.mesh = new THREE.Mesh(geo, ventMat);
        this.mesh.position.copy(this.position);
        this.mesh.position.y = 0.05; // Slightly above floor
        this.mesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.mesh);

        // Interaction mesh for Extinguisher
        this.triggerMesh = new THREE.Mesh(
            new THREE.BoxGeometry(2.5, 3, 2.5),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        this.triggerMesh.position.copy(this.position);
        this.triggerMesh.position.y = 1.5;
        this.triggerMesh.userData.isCryoVent = true;
        this.triggerMesh.userData.vent = this;
        this.scene.add(this.triggerMesh);

        // Warning light
        this.light = new THREE.PointLight(0x00aaff, 0, 5);
        this.light.position.copy(this.position);
        this.light.position.y = 1.0;
        this.scene.add(this.light);
    }

    update(deltaTime, player, enemies, canDamage = true) {
        if (this.isFrozen) {
            this.freezeTimer -= deltaTime;
            if (this.freezeTimer <= 0) {
                this.isFrozen = false;
            }
            this.mesh.material.color.set(0xaaaaaa);
            this.light.intensity = 0;
            this.isActive = false;
            return;
        }

        this.timer += deltaTime;
        const cycleTotal = this.activeDuration + this.cooldownDuration;
        const cyclePos = this.timer % cycleTotal;
        
        this.isActive = cyclePos < this.activeDuration;

        if (this.isActive) {
            this.mesh.material.color.set(0xffffff);
            const intensity = 0.5 + Math.sin(this.timer * 10) * 0.5;
            this.light.intensity = intensity * 2;
            this.light.color.set(0x00ffff);

            // Damage player if standing on vent
            const playerPos = player.mesh.position;
            const distSq = playerPos.distanceToSquared(this.position);
            if (distSq < 2.5 * 2.5 && canDamage) { // Radius 2.5
                player.takeDamage(20 * deltaTime, true, 'rgba(0, 150, 255, 0.4)'); // High DOT damage with blue flash
            }

            // Damage enemies if standing on vent
            if (enemies && canDamage) {
                enemies.forEach(enemy => {
                    if (enemy.isDead) return;
                    const enemyPos = enemy.mesh.position;
                    const eDistSq = enemyPos.distanceToSquared(this.position);
                    if (eDistSq < 2.5 * 2.5) {
                        enemy.takeDamage(15 * deltaTime, enemies);
                        // Optional: slow enemy
                    }
                });
            }

            // Particles
            if (this.particleSystem && Math.random() < 0.4) {
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * 1.5,
                    Math.random() * 3,
                    (Math.random() - 0.5) * 1.5
                );
                this.particleSystem.createExplosion(this.position.clone().add(offset), 0x88ccff, 1, 0.4);
            }
        } else {
            // Warning pulse when about to activate
            const timeToActive = cycleTotal - cyclePos;
            if (timeToActive < 1.0) {
                const pulse = Math.sin(timeToActive * 20) * 0.5 + 0.5;
                this.light.intensity = pulse;
                this.light.color.set(0x00aaff);
            } else {
                this.light.intensity = 0;
            }
            this.mesh.material.color.set(0x444444);
        }
    }

    freeze() {
        if (this.isFrozen) return;
        this.isFrozen = true;
        this.freezeTimer = 6.0; // Frozen for 6 seconds
        this.isActive = false;
        
        if (this.particleSystem) {
            this.particleSystem.createExplosion(this.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffffff, 5, 1.0);
        }
    }

    destroy() {
        this.scene.remove(this.mesh);
        this.scene.remove(this.triggerMesh);
        this.scene.remove(this.light);
    }
}