import * as THREE from 'three';
import { CONFIG } from './config.js';

export class FireField {
    constructor(scene, position, radius, particleSystem) {
        this.scene = scene;
        this.position = position.clone();
        this.position.y = 0.1; // Just above ground
        this.radius = radius;
        this.particleSystem = particleSystem;
        this.duration = CONFIG.PLAYER.BARREL.FIRE_DURATION;
        this.isExpired = false;
        this.startTime = Date.now();
        
        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
        
        // Initial burst
        if (this.particleSystem) {
            this.particleSystem.createExplosion(this.position, 0xffaa00, 10, 2);
        }
    }

    createMesh() {
        const geo = new THREE.CircleGeometry(this.radius * 0.8, 16);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0xff3300, 
            transparent: true, 
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        return mesh;
    }

    update(deltaTime) {
        const elapsed = Date.now() - this.startTime;
        if (elapsed > this.duration) {
            this.destroy();
            return;
        }

        // Pulse opacity and color
        const pulse = Math.sin(Date.now() * 0.01) * 0.1 + 0.3;
        this.mesh.material.opacity = pulse * (1 - elapsed / this.duration);
        
        // Occasional particles
        if (this.particleSystem && Math.random() < 0.2) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * this.radius * 0.7;
            const p = new THREE.Vector3(
                this.position.x + Math.cos(angle) * r,
                0.2,
                this.position.z + Math.sin(angle) * r
            );
            this.particleSystem.createExplosion(p, 0xffaa00, 1, 1);
        }
    }

    checkCollision(targetPos) {
        // Distance check in 2D (xz plane)
        const dx = targetPos.x - this.position.x;
        const dz = targetPos.z - this.position.z;
        const distSq = dx * dx + dz * dz;
        return distSq < (this.radius * 0.8) * (this.radius * 0.8);
    }

    destroy() {
        this.isExpired = true;
        this.scene.remove(this.mesh);
    }
}
