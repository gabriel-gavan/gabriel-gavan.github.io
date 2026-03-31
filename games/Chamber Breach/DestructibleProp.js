import * as THREE from 'three';
import { CONFIG } from './config.js';

const PROP_ASSETS = {
    SERVER_RACK: 'https://rosebud.ai/assets/standalone_server_rack.webp.webp?6eWM',
    SERVER_SIDE: 'https://rosebud.ai/assets/scifi_wall_paneled_metal.webp.webp?bMd0',
    DATA_TERMINAL: 'https://rosebud.ai/assets/terminal_screen_ui.webp?bzBE'
};

const TEXTURE_CACHE = {};
const loader = new THREE.TextureLoader();
const DESCTRUCTIBLE_FLASH = { value: 0 };

export class DestructibleProp {
    static pool = {
        SERVER_RACK: [],
        DATA_TERMINAL: []
    };

    static get(scene, position, type, particleSystem) {
        let prop;
        if (this.pool[type] && this.pool[type].length > 0) {
            prop = this.pool[type].pop();
            prop.reset(position);
        } else {
            prop = new DestructibleProp(scene, position, type, particleSystem);
        }
        prop.mesh.visible = true;
        return prop;
    }

    constructor(scene, position, type = 'SERVER_RACK', particleSystem = null) {
        this.scene = scene;
        this.type = type;
        this.particleSystem = particleSystem;
        
        const config = CONFIG.ENVIRONMENT.DESTRUCTIBLE[type];
        this.health = config.HEALTH;
        this.maxHealth = config.HEALTH;
        this.scoreValue = config.SCORE;
        this.particleType = config.PARTICLE_TYPE;

        this.mesh = this.createMesh(position);
        this.isDead = false;
        
        this.scene.add(this.mesh);
    }

    reset(position) {
        this.mesh.position.copy(position);
        const config = CONFIG.ENVIRONMENT.DESTRUCTIBLE[this.type];
        this.health = config.HEALTH;
        this.isDead = false;
        this.mesh.visible = true;
        
        const mesh = this.mesh.children[0];
        if (mesh && mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (let i = 0; i < mats.length; i++) {
                const m = mats[i];
                if (m.emissive) m.emissive.set(this.type === 'SERVER_RACK' ? 0x00ffaa : 0xffffff);
                m.color.set(0xffffff);
            }
            mesh.rotation.x = 0;
        }
        
        const hitbox = this.mesh.children.find(c => c.userData.isDestructible !== undefined);
        if (hitbox) hitbox.userData.isDestructible = true;
        
        if (this.light) {
            this.light.visible = false;
            this.light.intensity = 0.6;
        }
    }

    deactivate() {
        this.mesh.visible = false;
        DestructibleProp.pool[this.type].push(this);
    }

    createMesh(position) {
        const group = new THREE.Group();
        group.position.copy(position);

        let geometry, material;
        if (this.type === 'SERVER_RACK') {
            geometry = new THREE.BoxGeometry(1.2, 3.2, 0.8);
            
            const rackTex = this.getTexture('SERVER_RACK');
            const sideTex = this.getTexture('SERVER_SIDE');
            sideTex.wrapS = sideTex.wrapT = THREE.RepeatWrapping;
            sideTex.repeat.set(1, 2);

            const casingMat = new THREE.MeshStandardMaterial({
                map: sideTex,
                color: 0x222222,
                metalness: 0.9,
                roughness: 0.2
            });

            const frontMat = new THREE.MeshStandardMaterial({
                map: rackTex,
                metalness: 0.8,
                roughness: 0.2,
                emissive: new THREE.Color(0x00ffaa),
                emissiveIntensity: 0.4,
                transparent: true
            });

            material = [
                casingMat,
                casingMat,
                casingMat,
                casingMat,
                frontMat,
                casingMat
            ];
        } else {
            geometry = new THREE.BoxGeometry(1, 1.2, 0.5);
            material = new THREE.MeshStandardMaterial({
                map: this.getTexture('DATA_TERMINAL'),
                metalness: 0.5,
                roughness: 0.5,
                emissive: new THREE.Color(0xffffff),
                emissiveIntensity: 0.1
            });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        if (this.type === 'SERVER_RACK') {
            const serverLight = new THREE.PointLight(0x00ffaa, 1.5, 3);
            serverLight.position.set(0, 0, 0.5);
            serverLight.visible = false;
            group.add(serverLight);
            this.light = serverLight;
        }

        const hitboxGeo = geometry.clone();
        const hitboxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, visible: false });
        const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
        hitbox.userData.isDestructible = true;
        hitbox.userData.parentProp = this;
        group.add(hitbox);

        return group;
    }

    getTexture(type) {
        if (!TEXTURE_CACHE[type]) {
            TEXTURE_CACHE[type] = loader.load(PROP_ASSETS[type]);
        }
        return TEXTURE_CACHE[type];
    }

    takeDamage(amount, point, normal) {
        if (this.isDead) return;

        this.health -= amount;

        if (this.particleSystem && point) {
            this.particleSystem.createImpact(point, normal, 0x00ffff);
        }

        const mesh = this.mesh.children[0];
        if (mesh && mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (let i = 0; i < mats.length; i++) {
                const m = mats[i];
                if (m.emissive) {
                    const originalColor = m.emissive.clone();
                    m.emissive.set(0xffffff);
                    setTimeout(() => {
                        if (m) m.emissive.copy(originalColor);
                    }, 50);
                }
            }
        }

        if (this.health <= 0) {
            this.destroy();
        }
    }

    destroy() {
        if (this.isDead) return;
        this.isDead = true;

        if (this.particleSystem) {
            this.particleSystem.createExplosion(this.mesh.position, 0x333333, 15, 2);
            this.particleSystem.createDebris(this.mesh.position, 0x333333, 8, 'SERVER_RACK');
        }

        if (this.light) this.light.visible = false;

        const mesh = this.mesh.children[0];
        if (mesh && mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (let i = 0; i < mats.length; i++) {
                const m = mats[i];
                if (m.emissive) m.emissive.set(0x000000);
                m.color.set(0x111111);
            }
            mesh.rotation.x += 0.2;
        }

        const hitbox = this.mesh.children.find(c => c.userData.isDestructible);
        if (hitbox) hitbox.userData.isDestructible = false;
    }

    update(deltaTime, playerPos = null) {
        if (!this.isDead) {
            if (playerPos) {
                const distSq = this.mesh.position.distanceToSquared(playerPos);
                if (distSq > 900) {
                    return;
                }
            }

            const mesh = this.mesh.children[0];
            if (mesh && mesh.material) {
                const baseIntensity = this.type === 'SERVER_RACK' ? 0.3 : 0.4;
                const flash = Math.random() < 0.1 ? Math.random() : 0;
                
                DESCTRUCTIBLE_FLASH.value = baseIntensity + flash;
                
                if (Array.isArray(mesh.material)) {
                    for (let i = 0; i < mesh.material.length; i++) {
                        const m = mesh.material[i];
                        if (m.emissive && m.map) m.emissiveIntensity = DESCTRUCTIBLE_FLASH.value;
                    }
                } else if (mesh.material.emissive) {
                    mesh.material.emissiveIntensity = DESCTRUCTIBLE_FLASH.value;
                }
                
                if (this.light) {
                    this.light.intensity = DESCTRUCTIBLE_FLASH.value * 2;
                }
            }
        }
    }
}
