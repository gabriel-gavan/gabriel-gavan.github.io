import * as THREE from 'three';
import { CONFIG } from './config.js';

const DATA_CORE_URL = 'https://rosebud.ai/assets/legendary_data_core.webp?nNzu';
const DATA_CORE_BASE = 1.0;
const DATA_CORE_FLOAT_AMP = 0.2;
const DATA_CORE_RING_SCALE = 0.1;
const DATA_CORE_PULL_RADIUS = 6.0;
const DATA_CORE_COLLECT_RADIUS = 2.0;
const DATA_CORE_PULL_SPEED = 15.0;
const DATA_CORE_CYCLE = { t: 0 };

export class DataCore {
    constructor(scene, position, value = 1) {
        this.scene = scene;
        this.value = value;
        this.isCollected = false;

        this.mesh = this.createMesh();
        this.mesh.position.copy(position);
        this.mesh.position.y = DATA_CORE_BASE;
        this.scene.add(this.mesh);
    }

    createMesh() {
        const group = new THREE.Group();
        const loader = new THREE.TextureLoader();
        const texture = loader.load(DATA_CORE_URL);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 1.0
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 2, 1);
        group.add(sprite);

        const light = new THREE.PointLight(0xffff00, 5, 5);
        light.position.y = 0;
        group.add(light);
        this.light = light;

        const ringGeo = new THREE.TorusGeometry(0.8, 0.05, 16, 100);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
        this.ring = ring;

        return group;
    }

    update(dt, playerPos) {
        if (this.isCollected || !playerPos) return;

        DATA_CORE_CYCLE.t += dt;
        const time = DATA_CORE_CYCLE.t;

        this.mesh.position.y = DATA_CORE_BASE + Math.sin(time * 3) * DATA_CORE_FLOAT_AMP;
        this.mesh.rotation.y += dt;
        
        if (this.ring) {
            this.ring.rotation.z += dt * 2;
            this.ring.scale.setScalar(1 + Math.sin(time * 5) * DATA_CORE_RING_SCALE);
        }

        if (this.light) {
            this.light.intensity = 5 + Math.sin(time * 10) * 2;
        }

        const dist = this.mesh.position.distanceTo(playerPos);
        if (dist < DATA_CORE_PULL_RADIUS) {
            this._pullVector = this._pullVector || new THREE.Vector3();
            this._pullVector.subVectors(playerPos, this.mesh.position).normalize();
            this.mesh.position.add(this._pullVector.multiplyScalar(dt * DATA_CORE_PULL_SPEED));
        }

        if (dist < DATA_CORE_COLLECT_RADIUS) {
            this.isCollected = true;
        }
    }

    destroy() {
        this.scene.remove(this.mesh);
    }
}
