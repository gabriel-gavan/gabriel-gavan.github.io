import * as THREE from 'three';
import { CONFIG } from './config.js';

export class EMPGrenade {
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

        // Pulse the emissive color based on timer
        const pulse = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
        this.mesh.children[0].material.emissive.setRGB(0, pulse * 0.5, pulse);

        // Physics
        this.velocity.y -= this.gravity * deltaTime;
        const nextPos = this.mesh.position.clone().add(this.velocity.clone().multiplyScalar(deltaTime));

        // Basic collision with floor
        if (nextPos.y < 0.2) {
            nextPos.y = 0.2;
            this.velocity.y *= -0.3; // Less bouncy than frag
            this.velocity.multiplyScalar(0.6);
        }

        // Basic collision with walls
        const sphere = new THREE.Sphere(nextPos, 0.3);
        for (const wall of walls) {
            const box = new THREE.Box3().setFromObject(wall);
            if (box.intersectsSphere(sphere)) {
                this.velocity.multiplyScalar(-0.4);
                break;
            }
        }

        this.mesh.position.copy(nextPos);
        this.mesh.rotation.x += deltaTime * 8;
        this.mesh.rotation.z += deltaTime * 5;

        if (this.timer <= 0) {
            this.explode();
        }
    }

    explode() {
        this.isExploded = true;
        this.mesh.visible = false;

        // Visual Explosion: Electric Blue Shockwave
        if (this.particleSystem) {
            this.particleSystem.createExplosion(this.mesh.position, 0x00ffff, 40, 15);
            this.particleSystem.flashLight(this.mesh.position, 0x00ffff, 20, 20, 200);
            
            // Add some "sparks"
            const tempVec = new THREE.Vector3();
            for (let i = 0; i < 5; i++) {
                tempVec.set(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2
                ).add(this.mesh.position);
                this.particleSystem.createImpact(tempVec, new THREE.Vector3(0, 1, 0), 0x00ffff);
            }
        }

        if (this.onExplode) {
            this.onExplode(this.mesh.position);
        }
    }
}