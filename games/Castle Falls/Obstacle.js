import * as THREE from 'three';

export class EnemyProjectile {
    constructor(scene, position, direction, options = {}) {
        this.scene = scene;
        this.group = new THREE.Group();
        
        const color = options.color || 0xff00ff;
        const speed = options.speed || 20;

        // Glowing bolt
        const boltGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const boltMat = new THREE.MeshStandardMaterial({ 
            color: color, 
            emissive: color, 
            emissiveIntensity: 3 
        });
        const bolt = new THREE.Mesh(boltGeo, boltMat);
        this.group.add(bolt);

        this.group.position.copy(position);
        this.velocity = direction.clone().multiplyScalar(speed);
        this.scene.add(this.group);
        
        this.isDead = false;
        this.lifeTime = 4.0;
        this.timeAlive = 0;
        this.damage = options.damage || 10;
    }

    update(deltaTime) {
        this.group.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        this.timeAlive += deltaTime;
        if (this.timeAlive > this.lifeTime) {
            this.destroy(this.scene);
        }
    }

    destroy(scene) {
        if (this.isDead) return;
        this.isDead = true;
        const parent = this.group.parent || scene;
        if (parent) parent.remove(this.group);
        
        this.group.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}

export class Gargoyle {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.position.copy(options.position || new THREE.Vector3());
        
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.9 });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.8), stoneMat);
        body.position.y = 0.75;
        this.group.add(body);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), stoneMat);
        head.position.y = 1.8;
        this.group.add(head);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const lEye = new THREE.Mesh(eyeGeo, eyeMat);
        lEye.position.set(-0.15, 0.1, 0.35);
        head.add(lEye);
        const rEye = lEye.clone();
        rEye.position.x *= -1;
        head.add(rEye);

        // Wings
        const wingGeo = new THREE.BoxGeometry(2, 1, 0.1);
        this.leftWing = new THREE.Mesh(wingGeo, stoneMat);
        this.leftWing.position.set(-1.2, 1.2, -0.2);
        this.leftWing.rotation.y = Math.PI / 4;
        this.group.add(this.leftWing);

        this.rightWing = this.leftWing.clone();
        this.rightWing.position.x *= -1;
        this.rightWing.rotation.y *= -1;
        this.group.add(this.rightWing);

        scene.add(this.group);

        this.health = 40;
        this.isDead = false;
        this.lastFireTime = 0;
        this.fireRate = 2.5;
        this.range = 45;
        this.projectiles = [];
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;
        if (this.health <= 0) this.die();
        
        // Flash effect
        this.group.traverse(child => {
            if (child.isMesh) {
                const oldColor = child.material.color.clone();
                child.material.color.set(0xffffff);
                setTimeout(() => { if (child.material) child.material.color.copy(oldColor); }, 100);
            }
        });
    }

    die() {
        this.isDead = true;
    }

    update(deltaTime, totalTime, playerPos) {
        if (this.isDead) {
            this.group.position.y -= deltaTime * 10;
            this.group.rotation.x += deltaTime * 5;
            return;
        }

        // Hover bobbing
        this.group.position.y += Math.sin(totalTime * 2) * 0.01;
        this.leftWing.rotation.z = Math.sin(totalTime * 4) * 0.4;
        this.rightWing.rotation.z = -Math.sin(totalTime * 4) * 0.4;

        // Look at player
        if (playerPos) {
            const dist = this.group.position.distanceTo(playerPos);
            if (dist < this.range) {
                this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
                
                if (totalTime - this.lastFireTime > this.fireRate) {
                    this.shoot(playerPos);
                    this.lastFireTime = totalTime;
                }
            }
        }
    }

    shoot(playerPos) {
        const firePos = this.group.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        const direction = playerPos.clone().sub(firePos).normalize();
        const bolt = new EnemyProjectile(this.scene, firePos, direction, { color: 0x8800ff, speed: 15 });
        this.projectiles.push(bolt);
    }

    destroy(scene) {
        if (this.isDead) return;
        this.isDead = true;
        const parent = this.group.parent || scene;
        if (parent) parent.remove(this.group);
        this.projectiles?.forEach(p => p.destroy(scene));
        
        this.group.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}

export class Archer {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.position.copy(options.position || new THREE.Vector3());
        
        const clothMat = new THREE.MeshStandardMaterial({ color: 0x224422, roughness: 0.8 });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.4), clothMat);
        body.position.y = 0.7;
        this.group.add(body);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
        head.position.y = 1.65;
        this.group.add(head);

        // Bow
        const bowCurve = new THREE.TorusGeometry(0.6, 0.05, 8, 24, Math.PI);
        const bow = new THREE.Mesh(bowCurve, new THREE.MeshStandardMaterial({ color: 0x3d2b1f }));
        bow.position.set(0.5, 1.2, 0.3);
        bow.rotation.y = Math.PI / 2;
        this.group.add(bow);

        scene.add(this.group);

        this.health = 30;
        this.isDead = false;
        this.lastFireTime = 0;
        this.fireRate = 3.0;
        this.range = 50;
        this.projectiles = [];
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;
        if (this.health <= 0) this.die();
        
        // Flash effect
        this.group.traverse(child => {
            if (child.isMesh) {
                const oldColor = child.material.color.clone();
                child.material.color.set(0xffffff);
                setTimeout(() => { if (child.material) child.material.color.copy(oldColor); }, 100);
            }
        });
    }

    die() {
        this.isDead = true;
    }

    update(deltaTime, totalTime, playerPos) {
        if (this.isDead) {
            this.group.rotation.x = -Math.PI / 2;
            this.group.position.y = 0.2;
            return;
        }

        if (playerPos) {
            const dist = this.group.position.distanceTo(playerPos);
            if (dist < this.range) {
                this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
                
                if (totalTime - this.lastFireTime > this.fireRate) {
                    this.shoot(playerPos);
                    this.lastFireTime = totalTime;
                }
            }
        }
    }

    shoot(playerPos) {
        const firePos = this.group.position.clone().add(new THREE.Vector3(0, 1.2, 0.4));
        const direction = playerPos.clone().sub(firePos).normalize();
        const arrow = new EnemyProjectile(this.scene, firePos, direction, { color: 0xffaa00, speed: 25, damage: 15 });
        this.projectiles.push(arrow);
    }

    destroy(scene) {
        if (this.isDead) return;
        this.isDead = true;
        const parent = this.group.parent || scene;
        if (parent) parent.remove(this.group);
        this.projectiles?.forEach(p => p.destroy(scene));
        
        this.group.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}

export class MovingPlatform {
    constructor(scene, options = {}) {
        this.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(options.width || 4, 0.5, options.depth || 4),
            new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8, metalness: 0.2 })
        );
        this.mesh.position.copy(options.position || new THREE.Vector3());
        if (options.rotation) this.mesh.rotation.copy(options.rotation);
        
        scene.add(this.mesh);

        this.startPos = this.mesh.position.clone();
        this.amplitude = options.amplitude || new THREE.Vector3(5, 0, 0);
        this.speed = options.speed || 1;
        this.time = Math.random() * Math.PI * 2; // Offset
        this.width = options.width || 4;
        this.depth = options.depth || 4;
        this.height = 0.5;
    }

    update(deltaTime) {
        this.time += deltaTime * this.speed;
        
        // Move relative to start position
        // We need to account for the platform's orientation when applying amplitude
        const offset = new THREE.Vector3(
            Math.sin(this.time) * this.amplitude.x,
            Math.sin(this.time * 0.7) * this.amplitude.y,
            Math.cos(this.time * 0.5) * this.amplitude.z
        );
        // Rotate the offset if the platform is rotated
        offset.applyEuler(this.mesh.rotation);
        
        this.mesh.position.copy(this.startPos).add(offset);
    }

    destroy(scene) {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

export class SwingingHammer {
    constructor(scene, options = {}) {
        this.group = new THREE.Group();
        this.group.position.copy(options.position || new THREE.Vector3());
        
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.2 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xaa8800, metalness: 1.0, roughness: 0.1 });
        const runeMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 2 });

        // Ceiling Mount
        const mount = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), metalMat);
        const pivotHeight = options.pivotHeight || 10;
        mount.position.y = pivotHeight;
        this.group.add(mount);

        // Pivot point
        this.pivot = new THREE.Group();
        this.pivot.position.y = pivotHeight;
        this.group.add(this.pivot);

        const handleLength = options.handleLength || 8;
        
        // Handle with gold bands
        const handleGroup = new THREE.Group();
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, handleLength), metalMat);
        handle.position.y = -handleLength / 2;
        handleGroup.add(handle);

        for (let i = 1; i < 4; i++) {
            const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2), goldMat);
            band.position.y = -handleLength * (i/4);
            handleGroup.add(band);
        }
        this.pivot.add(handleGroup);

        // Mace Head
        this.headGroup = new THREE.Group();
        this.headGroup.position.y = -handleLength;
        this.pivot.add(this.headGroup);

        this.headSize = options.headSize || 2.4; // Slightly larger head
        const headCore = new THREE.Mesh(new THREE.IcosahedronGeometry(this.headSize, 1), metalMat);
        this.headGroup.add(headCore);

        this.angle = options.angle || Math.PI / 2.2; 

        // Glowing Runes
        this.runes = [];
        const runeGeo = new THREE.BoxGeometry(0.5, 0.1, 0.5);
        for (let i = 0; i < 4; i++) {
            const rune = new THREE.Mesh(runeGeo, runeMat);
            rune.position.setFromSphericalCoords(this.headSize + 0.05, Math.PI/2, (i/4) * Math.PI * 2);
            this.headGroup.add(rune);
            this.runes.push(rune);
        }

        scene.add(this.group);

        this.speed = options.speed || 1.5;
        this.time = Math.random() * Math.PI * 2;
    }

    update(deltaTime, totalTime) {
        // Use provided totalTime or fallback to performance.now()
        const time = totalTime || (performance.now() / 1000);
        this.pivot.rotation.z = Math.sin(time * this.speed) * this.angle;
        
        // Pulse runes
        const pulse = 1.0 + Math.sin(time * 4) * 0.5;
        this.runes.forEach(r => {
            if (r.material) r.material.emissiveIntensity = 2 * pulse;
        });

        // Force update world matrix to ensure physics engine sees movement
        this.group.updateMatrixWorld(true);
        this.headGroup.updateMatrixWorld(true);
    }

    destroy(scene) {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}

export class RotatingBlade {
    constructor(scene, options = {}) {
        this.group = new THREE.Group();
        this.group.position.copy(options.position || new THREE.Vector3());
        
        this.bladeRadius = options.radius || 2.5;
        this.height = options.height || 1.5; // Raised to player torso level
        
        // Support post
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.2, this.height),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        post.position.y = -this.height / 2;
        this.group.add(post);

        // Central hub
        const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x444444 })
        );
        this.group.add(hub);

        // The blades - EXTENDED TO COVER CURBS
        this.blades = new THREE.Group();
        this.group.add(this.blades);

        const fullWidth = 10; // CONFIG.LEVEL.HALLWAY_WIDTH
        this.bladeRadius = fullWidth / 2 + 0.5;
        const bladeGeo = new THREE.BoxGeometry(this.bladeRadius * 2, 0.1, 0.4);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9, roughness: 0.1 });
        
        const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
        this.blades.add(blade1);
        
        const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
        blade2.rotation.y = Math.PI / 2;
        this.blades.add(blade2);

        scene.add(this.group);
        this.speed = options.speed || 4;
    }

    update(deltaTime, totalTime) {
        const time = totalTime || (performance.now() / 1000);
        this.blades.rotation.y = time * this.speed;
        
        // Ensure world matrices are up to date for physics and rendering
        this.group.updateMatrixWorld(true);
        this.blades.updateMatrixWorld(true);
    }

    destroy(scene) {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}

export class LaserTrap {
    constructor(scene, options = {}) {
        this.group = new THREE.Group();
        this.group.position.copy(options.position || new THREE.Vector3());
        
        this.direction = options.direction || new THREE.Vector3(1, 0, 0);
        this.length = options.length || 11; // Ensure it reaches both walls
        
        // Emitter box
        const emitter = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        this.group.add(emitter);

        // The beam
        const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, this.length); // Thicker beam
        this.beamMat = new THREE.MeshStandardMaterial({ 
            color: 0xff0000, 
            emissive: 0xff0000, 
            emissiveIntensity: 5,
            transparent: true,
            opacity: 0.8
        });
        this.beam = new THREE.Mesh(beamGeo, this.beamMat);
        
        // Rotate beam to match direction
        this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.direction);
        this.beam.position.copy(this.direction.clone().multiplyScalar(this.length / 2));
        this.group.add(this.beam);

        scene.add(this.group);
        
        this.blinkRate = options.blinkRate || 0; // 0 means always on
        this.time = 0;
        this.isOn = true;
    }

    update(deltaTime) {
        if (this.blinkRate > 0) {
            this.time += deltaTime;
            this.isOn = Math.floor(this.time * this.blinkRate) % 2 === 0;
            this.beam.visible = this.isOn;
        }
    }

    destroy(scene) {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}

export class ArrowTrap {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.position = options.position || new THREE.Vector3();
        this.direction = options.direction || new THREE.Vector3(0, 0, 1);
        this.fireRate = options.fireRate || 2; // seconds
        this.lastFireTime = options.startTime || (performance.now() / 1000); 
        this.arrows = [];
        this.parentSegment = options.parentSegment || null; // NEW: Logical Isolation

        // Simple trap visual
        this.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x555555 })
        );
        this.mesh.position.copy(this.position);
        this.mesh.lookAt(this.position.clone().add(this.direction));
        scene.add(this.mesh);
    }

    update(deltaTime, totalTime) {
        if (this.lastFireTime === 0) this.lastFireTime = totalTime;

        if (totalTime - this.lastFireTime > this.fireRate) {
            this.fireArrow();
            this.lastFireTime = totalTime;
        }

        for (let i = this.arrows.length - 1; i >= 0; i--) {
            const arrow = this.arrows[i];
            arrow.position.add(arrow.velocity.clone().multiplyScalar(deltaTime));
            
            // NEW: Logical Path Mask - Arrows only move/exist if logically near the player path
            // This is handled in LevelManager's checkCollision by filtering obstacles.
            
            // Cleanup old arrows
            if (arrow.position.distanceTo(this.position) > 40) {
                this.scene.remove(arrow);
                this.arrows.splice(i, 1);
            }
        }
    }

    fireArrow() {
        const arrow = new THREE.Group();
        
        const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x888888 })
        );
        shaft.rotation.x = Math.PI / 2;
        arrow.add(shaft);

        const tip = new THREE.Mesh(
            new THREE.ConeGeometry(0.12, 0.3, 8),
            new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 2 })
        );
        tip.position.z = 0.6;
        tip.rotation.x = Math.PI / 2;
        arrow.add(tip);

        // Shoot in the local direction specified (already relative to segment if added to segmentGroup)
        const shootDir = this.direction.clone().normalize();
        arrow.position.copy(this.position);
        arrow.lookAt(this.position.clone().add(shootDir));
        arrow.velocity = shootDir.multiplyScalar(18); 
        this.scene.add(arrow);
        this.arrows.push(arrow);
    }

    destroy(scene) {
        scene.remove(this.mesh);
        this.arrows.forEach(a => scene.remove(a));
    }
}

export class StaticProp {
    constructor(scene, options = {}) {
        const width = options.width || 2;
        const height = options.height || 1;
        const depth = options.depth || 2;
        
        this.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            options.material || new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 })
        );
        this.mesh.position.copy(options.position || new THREE.Vector3());
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;
        scene.add(this.mesh);
        
        this.width = width;
        this.height = height;
        this.depth = depth;
    }

    update() {}

    destroy(scene) {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

export class PlayerProjectile {
    constructor(scene, position, direction) {
        this.scene = scene;
        this.group = new THREE.Group();
        
        // Glowing magic bolt
        const boltGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const boltMat = new THREE.MeshStandardMaterial({ 
            color: 0x00ffff, 
            emissive: 0x00ffff, 
            emissiveIntensity: 5 
        });
        const bolt = new THREE.Mesh(boltGeo, boltMat);
        this.group.add(bolt);

        // Trail
        const trailGeo = new THREE.CylinderGeometry(0.05, 0.2, 1.5, 8);
        const trailMat = new THREE.MeshStandardMaterial({ 
            color: 0x0088ff, 
            transparent: true, 
            opacity: 0.6 
        });
        const trail = new THREE.Mesh(trailGeo, trailMat);
        trail.rotation.x = Math.PI / 2;
        trail.position.z = -0.75;
        this.group.add(trail);

        this.group.position.copy(position);
        this.group.lookAt(position.clone().add(direction));
        this.velocity = direction.clone().multiplyScalar(40);
        this.scene.add(this.group);
        
        this.isDead = false;
        this.lifeTime = 3.0;
        this.timeAlive = 0;
    }

    update(deltaTime) {
        this.group.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        this.timeAlive += deltaTime;
        if (this.timeAlive > this.lifeTime) {
            this.destroy(this.scene);
        }
    }

    destroy(scene) {
        if (this.isDead) return;
        this.isDead = true;
        const parent = this.group.parent || scene;
        if (parent) parent.remove(this.group);
        
        this.group.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}

export class DragonBoss {
    constructor(scene, options = {}) {
        this.group = new THREE.Group();
        this.group.position.copy(options.position || new THREE.Vector3());
        
        const scale = 3.0;
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xaa2222, roughness: 0.6 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x881111, transparent: true, opacity: 0.8 });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 2 });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(2 * scale, 1.5 * scale, 4 * scale), bodyMat);
        body.position.y = 1.5 * scale;
        this.group.add(body);

        // Head
        this.head = new THREE.Group();
        this.head.position.set(0, 2.5 * scale, 2 * scale);
        this.group.add(this.head);

        const skull = new THREE.Mesh(new THREE.BoxGeometry(1.2 * scale, 1.2 * scale, 1.8 * scale), bodyMat);
        this.head.add(skull);

        const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.2 * scale, 0.2 * scale), eyeMat);
        lEye.position.set(-0.4 * scale, 0.3 * scale, 0.8 * scale);
        this.head.add(lEye);

        const rEye = lEye.clone();
        rEye.position.x *= -1;
        this.head.add(rEye);

        // Mouth (for fire origin)
        this.mouth = new THREE.Group();
        this.mouth.position.set(0, -0.2 * scale, 0.9 * scale);
        this.head.add(this.mouth);

        // Wings
        this.leftWing = new THREE.Mesh(new THREE.BoxGeometry(4 * scale, 0.1 * scale, 2 * scale), wingMat);
        this.leftWing.position.set(-3 * scale, 2 * scale, 0);
        this.group.add(this.leftWing);

        this.rightWing = this.leftWing.clone();
        this.rightWing.position.x *= -1;
        this.group.add(this.rightWing);

        scene.add(this.group);
        
        this.fireballs = [];
        this.lastFireTime = 0;
        this.fireRate = 1.2;
        this.scene = scene;

        // Health system
        this.maxHealth = 200;
        this.health = 200;
        this.isDead = false;
        this.onDeath = options.onDeath;
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
        
        // Flash red
        this.group.traverse(child => {
            if (child.isMesh && child.material.emissive) {
                const oldColor = child.material.emissive.clone();
                const oldIntensity = child.material.emissiveIntensity;
                child.material.emissive.set(0xff0000);
                child.material.emissiveIntensity = 5;
                setTimeout(() => {
                    if (child.material) {
                        child.material.emissive.copy(oldColor);
                        child.material.emissiveIntensity = oldIntensity;
                    }
                }, 100);
            }
        });
    }

    die() {
        this.isDead = true;
        if (this.onDeath) this.onDeath();
    }

    update(deltaTime, totalTime) {
        if (this.isDead) {
            // Death animation: sink and rotate
            this.group.position.y -= deltaTime * 5;
            this.group.rotation.z += deltaTime * 2;
            return;
        }

        // Subtle hover and wing flap
        this.group.position.y += Math.sin(totalTime * 2) * 0.02;
        this.leftWing.rotation.z = Math.sin(totalTime * 3) * 0.3;
        this.rightWing.rotation.z = -Math.sin(totalTime * 3) * 0.3;

        // Breathe fire every few seconds
        if (totalTime - this.lastFireTime > this.fireRate) {
            this.shootFire();
            this.lastFireTime = totalTime;
        }

        // Update fireballs
        for (let i = this.fireballs.length - 1; i >= 0; i--) {
            const f = this.fireballs[i];
            f.position.add(f.velocity.clone().multiplyScalar(deltaTime));
            f.rotation.x += deltaTime * 5;
            f.rotation.y += deltaTime * 5;
            
            if (f.position.distanceTo(this.group.position) > 100) {
                this.scene.remove(f);
                this.fireballs.splice(i, 1);
            }
        }
    }

    shootFire() {
        const fire = new THREE.Mesh(
            new THREE.SphereGeometry(1.5, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xffaa00, emissiveIntensity: 5 })
        );
        
        // Get mouth world position
        const mouthPos = new THREE.Vector3();
        this.mouth.getWorldPosition(mouthPos);
        fire.position.copy(mouthPos);
        
        // Velocity towards the player (who is in the dragon's local +Z after 180 deg flip)
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion);
        fire.velocity = forward.multiplyScalar(25).add(new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 5));
        
        this.scene.add(fire);
        this.fireballs.push(fire);
    }

    destroy(scene) {
        scene.remove(this.group);
        this.fireballs.forEach(f => scene.remove(f));
        this.group.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}

export class SpikeTrap {
    constructor(scene, options = {}) {
        this.group = new THREE.Group();
        this.group.position.copy(options.position || new THREE.Vector3());
        
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
        const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.4 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xaa8800, metalness: 1.0, roughness: 0.1 });
        const energyMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 2, transparent: true, opacity: 0.6 });

        const size = options.size || 3;
        
        // Frame
        const frame = new THREE.Mesh(new THREE.BoxGeometry(size, 0.4, size), metalMat);
        this.group.add(frame);

        // Inner recessed bed
        const bed = new THREE.Mesh(new THREE.BoxGeometry(size - 0.4, 0.2, size - 0.4), darkMetalMat);
        bed.position.y = 0.15;
        this.group.add(bed);

        // Energy Grate (Glow)
        this.grate = new THREE.Mesh(new THREE.PlaneGeometry(size - 0.6, size - 0.6), energyMat);
        this.grate.rotation.x = -Math.PI / 2;
        this.grate.position.y = 0.26;
        this.group.add(this.grate);

        // Rivets
        const rivetGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8);
        const rivetOffsets = [-(size/2 - 0.2), size/2 - 0.2];
        rivetOffsets.forEach(x => {
            rivetOffsets.forEach(z => {
                const rivet = new THREE.Mesh(rivetGeo, goldMat);
                rivet.position.set(x, 0.2, z);
                this.group.add(rivet);
            });
        });

        this.spikes = new THREE.Group();
        this.group.add(this.spikes);

        // Ornate Spikes
        const spikeGeo = new THREE.ConeGeometry(0.12, 2.0, 6); // Taller spikes
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.05 });
        
        const count = 4;
        for (let i = 0; i < count; i++) {
            for (let j = 0; j < count; j++) {
                const spike = new THREE.Mesh(spikeGeo, chromeMat);
                spike.position.set(
                    (i - (count-1)/2) * ((size-0.8)/count),
                    1.0, // local y: center of 2.0 height cone
                    (j - (count-1)/2) * ((size-0.8)/count)
                );
                this.spikes.add(spike);
            }
        }

        scene.add(this.group);
        
        this.speed = options.speed || 1.8;
        this.time = Math.random() * Math.PI * 2;
        this.isExtended = false;
        this.height = 2.0;
        this.width = size;
        this.depth = size;
    }

    update(deltaTime, totalTime) {
        const time = totalTime || (performance.now() / 1000);
        const cycle = Math.sin(time * this.speed);
        
        // Mechanical pop animation (stays up briefly)
        let t = cycle;
        if (t > 0.3) t = 1; 
        else if (t < -0.3) t = -1;
        else t = t * (1 / 0.3);
        
        this.spikes.position.y = Math.max(-2.2, t * 0.4);
        this.isExtended = this.spikes.position.y > -0.5; // Slightly stricter
        
        // Pulse the energy grate
        const pulse = 1.0 + Math.sin(time * 4) * 0.5;
        this.grate.material.emissiveIntensity = (this.isExtended ? 4 : 1) * pulse;
        
        // Ensure world matrices are up to date for physics
        this.group.updateMatrixWorld(true);
        this.spikes.updateMatrixWorld(true);
    }

    destroy(scene) {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}

export class Torch {
    constructor(scene, options = {}) {
        this.group = new THREE.Group();
        this.group.position.copy(options.position || new THREE.Vector3());
        
        // Holder/Bracket
        const bracketGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        const bracketMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
        const bracket = new THREE.Mesh(bracketGeo, bracketMat);
        bracket.rotation.z = Math.PI / 6 * (options.side === 'left' ? -1 : 1);
        this.group.add(bracket);

        // Stick
        const stickGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8);
        const stickMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
        const stick = new THREE.Mesh(stickGeo, stickMat);
        stick.position.set(options.side === 'left' ? 0.2 : -0.2, 0.3, 0);
        stick.rotation.z = Math.PI / 4 * (options.side === 'left' ? -1 : 1);
        this.group.add(stick);

        // Fire Sprite
        const loader = new THREE.TextureLoader();
        const fireMat = new THREE.SpriteMaterial({
            map: loader.load(options.fireTexture || 'https://rosebud.ai/assets/torch-fire.webp?62X4'),
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        this.fire = new THREE.Sprite(fireMat);
        this.fire.scale.set(1.5, 1.8, 1);
        this.fire.position.set(options.side === 'left' ? 0.45 : -0.45, 0.65, 0);
        this.group.add(this.fire);

        // Point Light
        this.light = new THREE.PointLight(0xffaa00, 4, 15);
        this.light.position.copy(this.fire.position);
        this.group.add(this.light);

        if (scene) scene.add(this.group);
        
        this.baseIntensity = 4;
        this.time = Math.random() * 10;
    }

    update(deltaTime) {
        this.time += deltaTime * 10;
        // Flicker effect
        const flicker = Math.sin(this.time) * 0.5 + Math.sin(this.time * 0.7) * 0.2;
        this.light.intensity = this.baseIntensity + flicker;
        
        // Subtle fire pulse
        const pulse = 1.0 + Math.sin(this.time * 0.5) * 0.1;
        this.fire.scale.set(1.5 * pulse, 1.8 * pulse, 1);
    }

    destroy(scene) {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child.isMesh || child.isSprite) {
                child.geometry?.dispose();
                child.material?.dispose();
            }
        });
    }
}

export class Ladder {
    constructor(scene, options = {}) {
        this.group = new THREE.Group();
        this.group.position.copy(options.position || new THREE.Vector3());
        
        const height = options.height || 6;
        const width = 1.2;
        
        const railGeo = new THREE.BoxGeometry(0.1, height, 0.1);
        const railMat = new THREE.MeshStandardMaterial({ color: 0x332211 });
        
        const leftRail = new THREE.Mesh(railGeo, railMat);
        leftRail.position.x = -width / 2;
        this.group.add(leftRail);
        
        const rightRail = new THREE.Mesh(railGeo, railMat);
        rightRail.position.x = width / 2;
        this.group.add(rightRail);
        
        const rungGeo = new THREE.BoxGeometry(width, 0.1, 0.1);
        const numRungs = Math.floor(height * 2);
        for (let i = 0; i < numRungs; i++) {
            const rung = new THREE.Mesh(rungGeo, railMat);
            rung.position.y = -height / 2 + (i / (numRungs - 1)) * height;
            this.group.add(rung);
        }
        
        scene.add(this.group);
        this.height = height;
        this.width = width;
    }

    update() {}

    destroy(scene) {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}
