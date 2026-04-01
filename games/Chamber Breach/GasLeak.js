import * as THREE from 'three';
import { CONFIG } from './config.js';

const GAS_OFFSET = new THREE.Vector3();
const GAS_TIME_SCALE = 0.002;
const GAS_SCALE_TIME = 0.001;

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
        const now = Date.now();
        const pulse = Math.sin(now * GAS_TIME_SCALE) * 0.05 + 0.15;
        this.mesh.material.opacity = pulse * (1 - elapsed / this.duration);
        this.mesh.scale.setScalar(1 + Math.sin(now * GAS_SCALE_TIME) * 0.1);

        // Occasional gas particles
        if (this.particleSystem && Math.random() < 0.3) {
            GAS_OFFSET.set(
                (Math.random() - 0.5) * this.radius,
                (Math.random() - 0.5) * this.radius,
                (Math.random() - 0.5) * this.radius
            );
            this.particleSystem.createExplosion(this.position.clone().add(GAS_OFFSET), 0x00ff33, 1, 0.5);
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