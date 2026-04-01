import * as THREE from 'three';
import { CONFIG } from './config.js';

const MATH = {
    v1: new THREE.Vector3(),
    v2: new THREE.Vector3()
};

// --- Reusable Math Objects for Zero Allocation ---
const REUSABLE_SPHERE = new THREE.Sphere();
const REUSABLE_BOX = new THREE.Box3();
const EMP_PULSE_RATE = 0.02;
const EMP_BODY_PULSE_SCALE = 0.5;
const EMP_EMISSIVE_G = 0.5;
const EMP_EMISSIVE_B = 1.0;
const EMP_FLOOR_HEIGHT = 0.2;
const EMP_FLOOR_BOUNCE = -0.3;
const EMP_FLOOR_FRICTION = 0.6;
const EMP_COLLISION_RADIUS = 0.3;
const EMP_COLLISION_RADIUS_SQ = EMP_COLLISION_RADIUS * EMP_COLLISION_RADIUS;
const EMP_ROT_X = 8;
const EMP_ROT_Z = 5;
const EMP_EXPLOSION_COLOR = 0x00ffff;

export class EMPGrenade {
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
        this.timer = 1500;
        this.gravity = CONFIG.PLAYER.GRENADE.GRAVITY;
        this.mesh.visible = true;
    }

    createMesh() {
        const group = new THREE.Group();
        const bodyGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0x00ccff, 
            emissive: 0x002244,
            roughness: 0.5 
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        const ringGeo = new THREE.TorusGeometry(0.22, 0.02, 8, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        return group;
    }

    update(deltaTime, walls) {
        if (this.isExploded) return;

        this.timer -= deltaTime * 1000;

        const pulse = Math.sin(Date.now() * EMP_PULSE_RATE) * 0.5 + 0.5;
        this.mesh.children[0].material.emissive.setRGB(0, pulse * EMP_BODY_PULSE_SCALE, pulse);

        this.velocity.y -= this.gravity * deltaTime;
        MATH.v1.copy(this.velocity).multiplyScalar(deltaTime);
        this.mesh.position.add(MATH.v1);

        const currentPos = this.mesh.position;

        if (currentPos.y < EMP_FLOOR_HEIGHT) {
            currentPos.y = EMP_FLOOR_HEIGHT;
            this.velocity.y *= EMP_FLOOR_BOUNCE;
            this.velocity.x *= EMP_FLOOR_FRICTION;
            this.velocity.z *= EMP_FLOOR_FRICTION;
        }

        REUSABLE_SPHERE.set(currentPos, EMP_COLLISION_RADIUS);
        for (let i = 0; i < walls.length; i++) {
            const wall = walls[i];
            REUSABLE_BOX.setFromObject(wall);
            if (REUSABLE_BOX.intersectsSphere(REUSABLE_SPHERE)) {
                this.velocity.multiplyScalar(-0.4);
                break;
            }
        }

        this.mesh.rotation.x += deltaTime * EMP_ROT_X;
        this.mesh.rotation.z += deltaTime * EMP_ROT_Z;

        if (this.timer <= 0) {
            this.explode();
        }
    }

    explode() {
        this.isExploded = true;
        this.mesh.visible = false;

        if (this.particleSystem) {
            this.particleSystem.createExplosion(this.mesh.position, EMP_EXPLOSION_COLOR, 40, 15);
            this.particleSystem.flashLight(this.mesh.position, EMP_EXPLOSION_COLOR, 20, 20, 200);
            
            for (let i = 0; i < 5; i++) {
                MATH.v1.set(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2
                ).add(this.mesh.position);
                this.particleSystem.createImpact(MATH.v1, new THREE.Vector3(0, 1, 0), EMP_EXPLOSION_COLOR);
            }
        }

        if (this.onExplode) {
            this.onExplode(this.mesh.position);
        }
    }
}