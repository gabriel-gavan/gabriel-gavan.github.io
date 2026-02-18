import * as THREE from 'three';
import { CONFIG } from './config.js';

export class CreditChip {
    constructor(scene, position, value) {
        this.scene = scene;
        this.value = value;
        this.isCollected = false;
        
        const loader = new THREE.TextureLoader();
        const map = loader.load('https://rosebud.ai/assets/credit_chip_sprite.png.webp?pwu0');
        const material = new THREE.SpriteMaterial({ map: map, transparent: true });
        this.mesh = new THREE.Sprite(material);
        this.mesh.position.copy(position);
        this.mesh.position.y = 0.5; // Hover height
        this.mesh.scale.set(0.6, 0.6, 1);
        
        this.scene.add(this.mesh);
        
        // Add a small light
        this.light = new THREE.PointLight(0xffaa00, 2, 2);
        this.light.position.copy(this.mesh.position);
        this.scene.add(this.light);

        this.floatTime = Math.random() * Math.PI * 2;
    }

    update(deltaTime, playerPos) {
        if (this.isCollected) return;

        // Floating animation
        this.floatTime += deltaTime * 2;
        this.mesh.position.y = 0.5 + Math.sin(this.floatTime) * 0.1;
        this.light.position.y = this.mesh.position.y;

        // Detection distance for collection
        const dist = this.mesh.position.distanceTo(playerPos);
        
        // Magnetic pull if close
        if (dist < 3) {
            const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
            this.mesh.position.add(dir.multiplyScalar(deltaTime * 10));
        }

        if (dist < 1) {
            this.isCollected = true;
        }
    }

    destroy() {
        this.scene.remove(this.mesh);
        this.scene.remove(this.light);
    }
}
