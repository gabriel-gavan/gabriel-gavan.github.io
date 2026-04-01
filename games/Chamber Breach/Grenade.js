import * as THREE from 'three';
import { CONFIG } from './config.js';

const MATH = {
    v1: new THREE.Vector3(),
    v2: new THREE.Vector3()
};

// --- Reusable Math Objects for Zero Allocation ---
const REUSABLE_SPHERE = new THREE.Sphere();
const REUSABLE_BOX = new THREE.Box3();
const GRENADE_COLLISION_RADIUS = 0.3;
const GRENADE_FLOOR_HEIGHT = 0.2;
const GRENADE_FLOOR_BOUNCE = -0.4;
const GRENADE_FLOOR_FRICTION = 0.7;
const GRENADE_COLLISION_MULTIPLIER = -0.5;
const GRENADE_ROT_X = 5;
const GRENADE_ROT_Z = 3;

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

        this.velocity.y -= this.gravity * deltaTime;
        MATH.v1.copy(this.velocity).multiplyScalar(deltaTime);
        this.mesh.position.add(MATH.v1);

        const currentPos = this.mesh.position;

        if (currentPos.y < GRENADE_FLOOR_HEIGHT) {
            currentPos.y = GRENADE_FLOOR_HEIGHT;
            this.velocity.y *= GRENADE_FLOOR_BOUNCE;
            this.velocity.x *= GRENADE_FLOOR_FRICTION;
            this.velocity.z *= GRENADE_FLOOR_FRICTION;
        }

        REUSABLE_SPHERE.set(currentPos, GRENADE_COLLISION_RADIUS);
        for (let i = 0; i < walls.length; i++) {
            const wall = walls[i];
            REUSABLE_BOX.setFromObject(wall);
            if (REUSABLE_BOX.intersectsSphere(REUSABLE_SPHERE)) {
                this.velocity.multiplyScalar(GRENADE_COLLISION_MULTIPLIER);
                break;
            }
        }

        this.mesh.rotation.x += deltaTime * GRENADE_ROT_X;
        this.mesh.rotation.z += deltaTime * GRENADE_ROT_Z;

        if (this.timer <= 0) {
            this.explode();
        }
    }

    explode() {
        this.isExploded = true;
        this.mesh.visible = false;

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