import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Target {
    constructor(type, textureLoader) {
        this.type = type; // 'bandit', 'woman', 'prospector', 'boss'
        this.textureLoader = textureLoader;
        this.isShot = false;
        this.hp = 1;
        this.maxHp = 1;
        this.mesh = this.createMesh(textureLoader);
    }

    createMesh(textureLoader) {
        const texture = textureLoader.load(this.getTextureUrl());
        const material = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true,
            side: THREE.DoubleSide
        });

        const size = this.type === 'boss' ? 24 : 18;
        const geometry = new THREE.PlaneGeometry(size, size);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.isTarget = true;
        mesh.userData.target = this;
        
        return mesh;
    }

    getTextureUrl(variant = 0) {
        if (this.type === 'boss') return CONFIG.ASSETS.BOSS;
        if (this.type === 'woman') return CONFIG.ASSETS.WOMAN;
        if (this.type === 'prospector') return CONFIG.ASSETS.PROSPECTOR;
        
        // Bandit variants
        const variants = [
            CONFIG.ASSETS.BANDIT_V1,
            CONFIG.ASSETS.BANDIT_V2,
            CONFIG.ASSETS.BANDIT_V3,
            CONFIG.ASSETS.BANDIT_V4,
            CONFIG.ASSETS.BANDIT_V5
        ];
        return variants[variant % variants.length];
    }

    onShoot() {
        if (this.isShot) return;
        
        this.hp--;
        
        // Visual feedback for being hit
        this.mesh.material.color.setHex(0xff0000);
        setTimeout(() => {
            if (this.hp > 0) this.mesh.material.color.setHex(0xffffff);
        }, 100);

        if (this.hp <= 0) {
            this.isShot = true;
            
            // Dramatic "Fall over" effect
            const fallAngle = (Math.random() - 0.5) * 1.5; 
            const fallDistance = 15;
            const startTime = Date.now();
            const duration = 250;
            const startY = this.mesh.position.y;

            const animateFall = () => {
                if (!this.isShot) return; // Stop if reset mid-animation
                const elapsed = Date.now() - startTime;
                const t = Math.min(1, elapsed / duration);
                const ease = t * t;
                
                this.mesh.rotation.z = ease * fallAngle;
                this.mesh.position.y = startY - (ease * fallDistance);
                
                if (t < 1) {
                    requestAnimationFrame(animateFall);
                } else {
                    this.mesh.visible = false;
                }
            };
            animateFall();
            return this.type;
        }
        
        return 'hit'; // Hit but not dead
    }

    reset(variant = 0, hp = 1) {
        this.isShot = false;
        this.hp = hp;
        this.maxHp = hp;
        this.mesh.material.map = this.textureLoader.load(this.getTextureUrl(variant));
        this.mesh.material.color.setHex(0xffffff);
        this.mesh.rotation.z = 0;
        this.mesh.position.y = 10;
        this.mesh.visible = true;
    }
}
