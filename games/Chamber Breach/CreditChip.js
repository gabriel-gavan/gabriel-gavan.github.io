import * as THREE from 'three';
import { CONFIG } from './config.js';

const CREDIT_CHIP_URL = 'https://rosebud.ai/assets/credit_chip_sprite.png.webp?pwu0';
const CREDIT_MAGNET_RADIUS = 5.0;
const CREDIT_COLLECTION_RADIUS = 1.0;
const CREDIT_MAGNET_RADIUS_SQ = CREDIT_MAGNET_RADIUS * CREDIT_MAGNET_RADIUS;
const CREDIT_COLLECTION_RADIUS_SQ = CREDIT_COLLECTION_RADIUS * CREDIT_COLLECTION_RADIUS;
const CREDIT_FLOAT_SPEED = 2.0;
const CREDIT_FLOAT_AMPLITUDE = 0.1;
const CREDIT_HOVER_HEIGHT = 0.5;
const CREDIT_PULL_SPEED = 12.0;
const CREDIT_SCALE = 0.6;
const CREDIT_LIGHT_COLOR = 0xffaa00;
const CREDIT_LIGHT_INTENSITY = 2;
const CREDIT_LIGHT_DISTANCE = 2;
const CREDIT_HOVER_RADIUS = 0.1;
const CREDIT_INITIAL_SPIN = Math.PI * 2;
const CREDIT_HOVER_SCALE = 1.0;

export class CreditChip {
    constructor(scene, position, value) {
        this.scene = scene;
        this.value = value;
        this.isCollected = false;
        
        const loader = new THREE.TextureLoader();
        const map = loader.load(CREDIT_CHIP_URL);
        const material = new THREE.SpriteMaterial({ map: map, transparent: true });
        this.mesh = new THREE.Sprite(material);
        this.mesh.position.copy(position);
        this.mesh.position.y = CREDIT_HOVER_HEIGHT;
        this.mesh.scale.set(CREDIT_SCALE, CREDIT_SCALE, 1);
        
        this.scene.add(this.mesh);
        
        this.light = new THREE.PointLight(CREDIT_LIGHT_COLOR, CREDIT_LIGHT_INTENSITY, CREDIT_LIGHT_DISTANCE);
        this.light.position.copy(this.mesh.position);
        this.scene.add(this.light);

        this.floatTime = Math.random() * CREDIT_INITIAL_SPIN;
    }

    update(deltaTime, playerPos) {
        if (this.isCollected || !playerPos) return;

        this.floatTime += deltaTime * CREDIT_FLOAT_SPEED;
        this.mesh.position.y = CREDIT_HOVER_HEIGHT + Math.sin(this.floatTime) * CREDIT_FLOAT_AMPLITUDE;
        this.light.position.y = this.mesh.position.y;

        const dx = playerPos.x - this.mesh.position.x;
        const dy = playerPos.y - this.mesh.position.y;
        const dz = playerPos.z - this.mesh.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < CREDIT_MAGNET_RADIUS_SQ) {
            const invLen = 1 / Math.sqrt(distSq || 1);
            this.mesh.position.x += dx * invLen * deltaTime * CREDIT_PULL_SPEED;
            this.mesh.position.y += dy * invLen * deltaTime * CREDIT_PULL_SPEED;
            this.mesh.position.z += dz * invLen * deltaTime * CREDIT_PULL_SPEED;
        }

        if (distSq < CREDIT_COLLECTION_RADIUS_SQ) {
            this.isCollected = true;
        }
    }

    destroy() {
        this.scene.remove(this.mesh);
        this.scene.remove(this.light);
    }
}