import * as THREE from 'three';
import { CONFIG } from './config.js';

export class AmmoCrate {
    constructor(scene, position, type = 'RIFLE') {
        this.scene = scene;
        this.type = type; // 'RIFLE' or 'SNIPER'
        this.mesh = this.createMesh();
        this.mesh.position.copy(position);
        this.mesh.position.y = 1;
        this.scene.add(this.mesh);
        this.isCollected = false;
    }

    createMesh() {
        const loader = new THREE.TextureLoader();
        const map = loader.load('assets/ammo_box_sprite.webp');
        const color = this.type === 'RIFLE' ? 0xffffff : 0x00ffff; // Tint sniper blue
        const material = new THREE.SpriteMaterial({ map: map, color: color });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(1.2, 1.2, 1);
        return sprite;
    }

    update(deltaTime, playerPos) {
        if (this.isCollected) return;

        // Rotation and hover
        this.mesh.rotation.y += CONFIG.PICKUPS.ROTATION_SPEED * deltaTime;
        const hover = Math.sin(Date.now() * 0.005 + 1) * 0.15;
        this.mesh.position.y = 1.1 + hover; 

        // Visual "Item" bounce
        const scaleBase = 1.2;
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
