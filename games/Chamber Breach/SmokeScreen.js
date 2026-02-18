import * as THREE from 'three';
import { CONFIG } from './config.js';

export class SmokeScreen {
    constructor(scene, position, particleSystem) {
        this.scene = scene;
        this.position = position.clone();
        this.particleSystem = particleSystem;
        this.radius = CONFIG.HAZARDS.EXTINGUISHER.RADIUS;
        this.duration = CONFIG.HAZARDS.EXTINGUISHER.SMOKE_DURATION;
        this.startTime = Date.now();
        this.isExpired = false;

        // Visual cloud mesh
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(this.radius, 16, 16),
            new THREE.MeshBasicMaterial({ 
                color: 0xffffff, 
                transparent: true, 
                opacity: 0.2 
            })
        );
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        // Burst of particles
        if (this.particleSystem) {
            this.particleSystem.createExplosion(this.position, 0xeeeeee, 30, 4);
        }
    }

    update(deltaTime) {
        const elapsed = Date.now() - this.startTime;
        if (elapsed > this.duration) {
            this.destroy();
            return;
        }

        const lifeFactor = 1 - (elapsed / this.duration);
        this.mesh.material.opacity = 0.2 * lifeFactor;
        this.mesh.scale.setScalar(1 + (1 - lifeFactor) * 0.5); // Cloud grows as it dissipates

        // Lingering particles
        if (this.particleSystem && Math.random() < 0.4) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * this.radius * 1.5,
                (Math.random() - 0.5) * this.radius * 1.5,
                (Math.random() - 0.5) * this.radius * 1.5
            );
            this.particleSystem.createExplosion(this.position.clone().add(offset), 0xeeeeee, 1, 0.2);
        }
    }

    checkCollision(targetPos) {
        const dx = targetPos.x - this.position.x;
        const dy = targetPos.y - this.position.y;
        const dz = targetPos.z - this.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        return distSq < (this.radius * 1.2) * (this.radius * 1.2);
    }

    destroy() {
        this.isExpired = true;
        this.scene.remove(this.mesh);
    }
}