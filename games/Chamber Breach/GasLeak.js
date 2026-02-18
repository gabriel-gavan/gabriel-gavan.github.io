import * as THREE from 'three';
import { CONFIG } from './config.js';

export class GasLeak {
    constructor(scene, position, particleSystem) {
        this.scene = scene;
        this.position = position.clone();
        this.particleSystem = particleSystem;
        this.radius = 4;
        this.isExploded = false;
        this.isExpired = false;
        this.startTime = Date.now();
        this.duration = CONFIG.HAZARDS.GAS.LEAK_DURATION;

        // Visual cloud
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(this.radius, 16, 16),
            new THREE.MeshBasicMaterial({ 
                color: 0x00ff00, 
                transparent: true, 
                opacity: 0.1, 
                visible: true 
            })
        );
        this.mesh.position.copy(this.position);
        this.mesh.userData.isGas = true;
        this.mesh.userData.gasLeak = this;
        this.scene.add(this.mesh);
    }

    update(deltaTime) {
        if (this.isExploded || this.isExpired) return;

        const elapsed = Date.now() - this.startTime;
        if (elapsed > this.duration) {
            this.destroy();
            return;
        }

        // Pulse the gas cloud
        const pulse = Math.sin(Date.now() * 0.002) * 0.05 + 0.15;
        this.mesh.material.opacity = pulse * (1 - elapsed / this.duration);
        this.mesh.scale.setScalar(1 + Math.sin(Date.now() * 0.001) * 0.1);

        // Occasional gas particles
        if (this.particleSystem && Math.random() < 0.3) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * this.radius,
                (Math.random() - 0.5) * this.radius,
                (Math.random() - 0.5) * this.radius
            );
            this.particleSystem.createExplosion(this.position.clone().add(offset), 0x00ff33, 1, 0.5);
        }
    }

    ignite() {
        if (this.isExploded || this.isExpired) return;
        this.isExploded = true;
        this.destroy();
    }

    destroy() {
        this.isExpired = true;
        this.scene.remove(this.mesh);
    }
}