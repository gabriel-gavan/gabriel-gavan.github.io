import * as THREE from 'three';
import { CONFIG } from './config.js';

export class DataCore {
    constructor(scene, position, value = 1) {
        this.scene = scene;
        this.value = value;
        this.isCollected = false;

        this.mesh = this.createMesh();
        this.mesh.position.copy(position);
        this.mesh.position.y = 1.0;
        this.scene.add(this.mesh);
    }

    createMesh() {
        const group = new THREE.Group();
        const loader = new THREE.TextureLoader();
        const texture = loader.load('assets/legendary_data_core.webp');
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 1.0
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 2, 1);
        group.add(sprite);

        // Add a pulsing gold light
        const light = new THREE.PointLight(0xffff00, 5, 5);
        light.position.y = 0;
        group.add(light);
        this.light = light;

        // Add a floating ring
        const ringGeo = new THREE.TorusGeometry(0.8, 0.05, 16, 100);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
        this.ring = ring;

        return group;
    }

    update(dt, playerPos) {
        if (this.isCollected) return;

        // Floating animation
        this.mesh.position.y = 1.0 + Math.sin(Date.now() * 0.003) * 0.2;
        this.mesh.rotation.y += dt;
        
        if (this.ring) {
            this.ring.rotation.z += dt * 2;
            this.ring.scale.setScalar(1 + Math.sin(Date.now() * 0.005) * 0.1);
        }

        if (this.light) {
            this.light.intensity = 5 + Math.sin(Date.now() * 0.01) * 2;
        }

        // Collection check
        const dist = this.mesh.position.distanceTo(playerPos);
        if (dist < 2.0) {
            this.isCollected = true;
        }
    }

    destroy() {
        this.scene.remove(this.mesh);
    }
}
