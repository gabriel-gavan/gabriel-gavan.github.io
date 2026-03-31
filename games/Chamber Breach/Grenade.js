import * as THREE from 'three';
import { CONFIG } from './config.js';

const MATH = {
    v1: new THREE.Vector3(),
    v2: new THREE.Vector3()
};

// --- Reusable Math Objects for Zero Allocation ---
const REUSABLE_SPHERE = new THREE.Sphere();
const REUSABLE_BOX = new THREE.Box3();

export class Grenade {
    constructor(scene, particleSystem) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.onExplode = null;
        this.mesh = this.createMesh();
        this.mesh.visible = false;
        this.scene.add(this.mesh);
        this.isExploded = true;
        this.velocity = new THREE.Vector3();
    }

    spawn(position, velocity, onExplode) {
        this.mesh.position.copy(position);
        this.velocity.copy(velocity);
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

        // Physics - zero allocation
        this.velocity.y -= this.gravity * deltaTime;
        MATH.v1.copy(this.velocity).multiplyScalar(deltaTime);
        this.mesh.position.add(MATH.v1);

        const currentPos = this.mesh.position;

        // Basic collision with floor
        if (currentPos.y < 0.2) {
            currentPos.y = 0.2;
            this.velocity.y *= -0.4; // Bounce
            this.velocity.x *= 0.7; // Friction
            this.velocity.z *= 0.7;
        }

        // Basic collision with walls/obstacles using reusable objects
        REUSABLE_SPHERE.set(currentPos, 0.3);
        for (let i = 0; i < walls.length; i++) {
            const wall = walls[i];
            // Only update box if visible or within a certain range
            REUSABLE_BOX.setFromObject(wall); // Still slightly expensive but better than new Box3()
            if (REUSABLE_BOX.intersectsSphere(REUSABLE_SPHERE)) {
                this.velocity.multiplyScalar(-0.5);
                break;
            }
        }

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

