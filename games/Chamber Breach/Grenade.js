import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Grenade {
    constructor(scene, particleSystem) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.onExplode = null;
        this.mesh = this.createMesh();
        this.mesh.visible = false;
        this.scene.add(this.mesh);
        this.isExploded = true;
    }

    spawn(position, velocity, onExplode) {
        this.mesh.position.copy(position);
        this.velocity = velocity.clone();
        this.onExplode = onExplode;
        this.isExploded = false;
        this.timer = 2000;
        this.gravity = CONFIG.PLAYER.GRENADE.GRAVITY;
        this.mesh.visible = true;
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
        this.mesh.visible = false;

        // Visual Explosion
        if (this.particleSystem) {
            this.particleSystem.createExplosion(this.mesh.position, 0xff6600, 30, 10);
            this.particleSystem.createExplosion(this.mesh.position, 0xffff00, 20, 5);
            this.particleSystem.flashLight(this.mesh.position, 0xffaa00, 10, 15, 150);
        }

        if (this.onExplode) {
            this.onExplode(this.mesh.position);
        }
    }
}
