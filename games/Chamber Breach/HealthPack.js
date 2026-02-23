import * as THREE from 'three';
import { CONFIG } from './config.js';

export class HealthPack {
    constructor(scene, position) {
        this.scene = scene;
        this.mesh = this.createMesh();
        this.mesh.position.copy(position);
        this.mesh.position.y = 1;
        this.scene.add(this.mesh);
        this.isCollected = false;
    }

    createMesh() {
        const loader = new THREE.TextureLoader();
        const map = loader.load('https://rosebud.ai/assets/medkit_sprite.webp?KHNa');
        const material = new THREE.SpriteMaterial({ map: map });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(1.2, 1.2, 1);
        return sprite;
    }

    update(deltaTime, playerPos) {
        if (this.isCollected) return;

        // Rotation and hover
        this.mesh.rotation.y += CONFIG.PICKUPS.ROTATION_SPEED * deltaTime;
        const hover = Math.sin(Date.now() * 0.005) * 0.15;
        this.mesh.position.y = 1.1 + hover;

        // Visual "Item" bounce
        const scaleBase = 1.0;
        const scalePulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.05;
        this.mesh.scale.set(scaleBase * scalePulse, scaleBase * scalePulse, 1);

        // Simple distance check for collection
        const dist = this.mesh.position.distanceTo(playerPos);
        if (dist < 1.8) {
            this.isCollected = true;
        }
    }

    destroy() {
        this.scene.remove(this.mesh);
    }
}
