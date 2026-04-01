import * as THREE from 'three';
import { CONFIG } from './config.js';

const HEALTH_HOVER_HEIGHT = 1.1;
const HEALTH_MAGNET_RADIUS = 5.0;
const HEALTH_COLLECTION_RADIUS = 1.8;
const HEALTH_PULL_SPEED = 12.0;
const HEALTH_HOVER_SPEED = 0.005;
const HEALTH_BOUNCE_SPEED = 0.01;
const HEALTH_HOVER_AMPLITUDE = 0.15;
const HEALTH_BOUNCE_AMPLITUDE = 0.05;
const HEALTH_SCALE = 1.2;
const HEALTH_LIGHT_Y = 0.5;
const HEALTH_MAGNET_RADIUS_SQ = HEALTH_MAGNET_RADIUS * HEALTH_MAGNET_RADIUS;
const HEALTH_COLLECTION_RADIUS_SQ = HEALTH_COLLECTION_RADIUS * HEALTH_COLLECTION_RADIUS;
const HEALTH_HOVER_OFFSET = 1.1;
const HEALTH_SCALE_BASE = 1.0;
const HEALTH_SCALE_AXIS = 1;

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
        sprite.scale.set(HEALTH_SCALE, HEALTH_SCALE, 1);
        return sprite;
    }

    update(deltaTime, playerPos) {
        if (this.isCollected || !playerPos) return;

        const now = Date.now();

        this.mesh.rotation.y += CONFIG.PICKUPS.ROTATION_SPEED * deltaTime;
        this.mesh.position.y = HEALTH_HOVER_HEIGHT + Math.sin(now * HEALTH_HOVER_SPEED) * HEALTH_HOVER_AMPLITUDE;

        const scalePulse = HEALTH_SCALE_BASE + Math.sin(now * HEALTH_BOUNCE_SPEED) * HEALTH_BOUNCE_AMPLITUDE;
        const scale = HEALTH_SCALE_BASE * scalePulse;
        this.mesh.scale.set(scale, scale, HEALTH_SCALE_AXIS);

        const dx = playerPos.x - this.mesh.position.x;
        const dy = playerPos.y - this.mesh.position.y;
        const dz = playerPos.z - this.mesh.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        
        if (distSq < HEALTH_MAGNET_RADIUS_SQ) {
            const invLen = 1 / Math.sqrt(distSq || 1);
            this.mesh.position.x += dx * invLen * deltaTime * HEALTH_PULL_SPEED;
            this.mesh.position.y += dy * invLen * deltaTime * HEALTH_PULL_SPEED;
            this.mesh.position.z += dz * invLen * deltaTime * HEALTH_PULL_SPEED;
        }

        if (distSq < HEALTH_COLLECTION_RADIUS_SQ) {
            this.isCollected = true;
        }
    }

    destroy() {
        this.scene.remove(this.mesh);
    }
}