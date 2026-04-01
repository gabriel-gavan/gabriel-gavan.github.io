import * as THREE from 'three';
import { CONFIG } from './config.js';

const AMMO_HOVER_HEIGHT = 1.1;
const AMMO_COLLECTION_RADIUS = 1.8;
const AMMO_MAGNET_RADIUS = 5.0;
const AMMO_MAGNET_SPEED = 12.0;
const AMMO_HOVER_SPEED = 0.005;
const AMMO_BOUNCE_SPEED = 0.01;
const AMMO_HOVER_AMPLITUDE = 0.15;
const AMMO_BOUNCE_AMPLITUDE = 0.05;
const AMMO_SCALE = 1.2;
const AMMO_MESH_Y = 1;

export class AmmoCrate {
    constructor(scene, position, type = 'RIFLE') {
        this.scene = scene;
        this.type = type; // 'RIFLE' or 'SNIPER'
        this.mesh = this.createMesh();
        this.mesh.position.copy(position);
        this.mesh.position.y = AMMO_MESH_Y;
        this.scene.add(this.mesh);
        this.isCollected = false;
    }

    createMesh() {
        const loader = new THREE.TextureLoader();
        const map = loader.load('https://rosebud.ai/assets/ammo_box_sprite.webp?plqH');
        const color = this.type === 'RIFLE' ? 0xffffff : 0x00ffff; // Tint sniper blue
        const material = new THREE.SpriteMaterial({ map: map, color: color });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(AMMO_SCALE, AMMO_SCALE, 1);
        return sprite;
    }

    update(deltaTime, playerPos) {
        if (this.isCollected || !playerPos) return;

        const now = Date.now();

        // Rotation and hover
        this.mesh.rotation.y += CONFIG.PICKUPS.ROTATION_SPEED * deltaTime;
        this.mesh.position.y = AMMO_HOVER_HEIGHT + Math.sin(now * AMMO_HOVER_SPEED + 1) * AMMO_HOVER_AMPLITUDE;

        // Visual "Item" bounce
        const scalePulse = 1.0 + Math.sin(now * AMMO_BOUNCE_SPEED) * AMMO_BOUNCE_AMPLITUDE;
        const scale = AMMO_SCALE * scalePulse;
        this.mesh.scale.set(scale, scale, 1);

        // Simple distance check for collection
        const dist = this.mesh.position.distanceTo(playerPos);

        // Magnetic pull if close
        if (dist < AMMO_MAGNET_RADIUS) {
            const dx = playerPos.x - this.mesh.position.x;
            const dy = playerPos.y - this.mesh.position.y;
            const dz = playerPos.z - this.mesh.position.z;
            const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz || 1);
            this.mesh.position.x += dx * invLen * deltaTime * AMMO_MAGNET_SPEED;
            this.mesh.position.y += dy * invLen * deltaTime * AMMO_MAGNET_SPEED;
            this.mesh.position.z += dz * invLen * deltaTime * AMMO_MAGNET_SPEED;
        }

        if (dist < AMMO_COLLECTION_RADIUS) {
            this.isCollected = true;
        }
    }

    destroy() {
        this.scene.remove(this.mesh);
    }
}