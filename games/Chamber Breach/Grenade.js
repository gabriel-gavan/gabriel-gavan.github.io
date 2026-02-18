import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Grenade {
    constructor(scene, position, velocity, particleSystem, onExplode) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.onExplode = onExplode;
        
        this.mesh = this.createMesh();
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);
        
        this.velocity = velocity;
        this.isExploded = false;
        this.timer = 2000; // 2 seconds fuse
        this.gravity = CONFIG.PLAYER.GRENADE.GRAVITY;
    }

    createMesh() {
        const group = new THREE.Group();
        const bodyGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x224422, roughness: 0.8 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        const topGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.1);
        const topMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.y = 0.15;
        group.add(top);

        return group;
    }

    update(deltaTime, walls) {
        if (this.isExploded) return;

        this.timer -= deltaTime * 1000;

        // Physics
        this.velocity.y -= this.gravity * deltaTime;
        const nextPos = this.mesh.position.clone().add(this.velocity.clone().multiplyScalar(deltaTime));

        // Basic collision with floor
        if (nextPos.y < 0.2) {
            nextPos.y = 0.2;
            this.velocity.y *= -0.4; // Bounce
            this.velocity.multiplyScalar(0.7); // Friction
        }

        // Basic collision with walls/obstacles
        const sphere = new THREE.Sphere(nextPos, 0.3);
        for (const wall of walls) {
            const box = new THREE.Box3().setFromObject(wall);
            if (box.intersectsSphere(sphere)) {
                // Reflect velocity (naive bounce)
                this.velocity.multiplyScalar(-0.5);
                break;
            }
        }

        this.mesh.position.copy(nextPos);
        this.mesh.rotation.x += deltaTime * 5;
        this.mesh.rotation.z += deltaTime * 3;

        if (this.timer <= 0) {
            this.explode();
        }
    }

    explode() {
        this.isExploded = true;
        this.scene.remove(this.mesh);

        // Visual Explosion
        if (this.particleSystem) {
            this.particleSystem.createExplosion(this.mesh.position, 0xff6600, 30, 10);
            this.particleSystem.createExplosion(this.mesh.position, 0xffff00, 20, 5);
        }

        // Flash Light
        const light = new THREE.PointLight(0xffaa00, 10, 15);
        light.position.copy(this.mesh.position);
        this.scene.add(light);
        setTimeout(() => this.scene.remove(light), 150);

        if (this.onExplode) {
            this.onExplode(this.mesh.position);
        }
    }
}
