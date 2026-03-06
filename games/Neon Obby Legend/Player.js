import * as THREE from 'three';
import { PlayerController } from './rosie/controls/rosieControls.js';
import { CONFIG } from './config.js';

export class Player {
    constructor(scene, onDeath, options = {}) {
        this.scene = scene;
        this.onDeath = onDeath;
        this.onCheckpoint = options.onCheckpoint || null;
        
        // Create player mesh (Roblox-style blocky character)
        const group = new THREE.Group();
        
        // Torso
        const bodyGeo = new THREE.BoxGeometry(0.8, 1, 0.4);
        const bodyMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.PLAYER });
        const torso = new THREE.Mesh(bodyGeo, bodyMat);
        torso.position.y = 0; // Center origin
        torso.castShadow = true;
        group.add(torso);

        // Coat (Outer layer)
        const coatGeo = new THREE.BoxGeometry(0.85, 1.05, 0.45);
        const coatMat = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            roughness: 0.7
        });
        const coat = new THREE.Mesh(coatGeo, coatMat);
        coat.position.y = 0.02; // Center origin
        coat.castShadow = true;
        group.add(coat);

        // --- BACK LOGO "G.G." ---
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 100px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
        ctx.fillText('G.G.', 128, 64);

        const logoTex = new THREE.CanvasTexture(canvas);
        const logoMat = new THREE.MeshBasicMaterial({ 
            map: logoTex, 
            transparent: true,
            side: THREE.FrontSide
        });
        const logoGeo = new THREE.PlaneGeometry(0.8, 0.4);
        const logo = new THREE.Mesh(logoGeo, logoMat);
        logo.position.set(0, 0.15, -0.231); // Slightly pushed out more to prevent Z-fighting
        logo.rotation.y = Math.PI; 
        group.add(logo);
        
        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.75; // Offset from center
        head.castShadow = true;
        group.add(head);

        // Hair
        const hairGeo = new THREE.BoxGeometry(0.55, 0.2, 0.55);
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x2b1d0e }); // Dark brown
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.y = 0.2; 
        head.add(hair);

        // Hair fringe
        const fringeGeo = new THREE.BoxGeometry(0.55, 0.15, 0.1);
        const fringe = new THREE.Mesh(fringeGeo, hairMat);
        fringe.position.set(0, 0.15, 0.23);
        head.add(fringe);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.35, 0.5, 0.4);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        
        this.leftLeg = new THREE.Mesh(legGeo, legMat);
        this.leftLeg.position.set(-0.2, -0.75, 0); // Offset from center
        this.leftLeg.castShadow = true;
        group.add(this.leftLeg);
        
        this.rightLeg = new THREE.Mesh(legGeo, legMat);
        this.rightLeg.position.set(0.2, -0.75, 0); // Offset from center
        this.rightLeg.castShadow = true;
        group.add(this.rightLeg);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x222222 }); // Match coat
        
        this.leftArm = new THREE.Mesh(armGeo, armMat);
        this.leftArm.position.set(-0.55, 0.1, 0); // Offset from center
        this.leftArm.castShadow = true;
        group.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeo, armMat);
        this.rightArm.position.set(0.55, 0.1, 0); // Offset from center
        this.rightArm.castShadow = true;
        group.add(this.rightArm);

        // Hands
        const handGeo = new THREE.BoxGeometry(0.25, 0.2, 0.25);
        const handMat = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
        
        const leftHand = new THREE.Mesh(handGeo, handMat);
        leftHand.position.y = -0.4;
        this.leftArm.add(leftHand);

        const rightHand = new THREE.Mesh(handGeo, handMat);
        rightHand.position.y = -0.4;
        this.rightArm.add(rightHand);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.1);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.12, 0.1, 0.26); // Relative to head
        head.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.12, 0.1, 0.26); // Relative to head
        head.add(rightEye);

        this.mesh = group;
        this.scene.add(this.mesh);
        
        this.controller = new PlayerController(this.mesh, {
            moveSpeed: CONFIG.PLAYER.MOVE_SPEED,
            jumpForce: CONFIG.PLAYER.JUMP_FORCE,
            gravity: CONFIG.PLAYER.GRAVITY,
            groundLevel: -100 // We handle grounding manually for obby platforms
        });

        this.checkpoint = new THREE.Vector3(0, 2, 0);
        this.mesh.position.copy(this.checkpoint);
        
        this.speedBoostTimer = 0;
        this.invincibilityTimer = 0;
        this.health = CONFIG.PLAYER.MAX_HEALTH;
        this.baseMoveSpeed = CONFIG.PLAYER.MOVE_SPEED;
        this.coins = 0;
        this.unlockedPrizes = JSON.parse(localStorage.getItem('unlockedPrizes') || '[]');
        this.activePrizes = new Set();
        
        // Setup Prize Meshes
        this.prizeMeshes = {};
        this._setupCrown();
        this._setupCape();
        this._setupTrail();
        
        // Shield effect for invincibility
        this._setupShield();
        
        // Apply existing prizes
        this.unlockedPrizes.forEach(id => this.applyPrize(id));
    }

    _setupShield() {
        const shieldGeo = new THREE.SphereGeometry(1.5, 32, 32);
        const shieldMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide,
            emissive: 0x00ffff,
            emissiveIntensity: 0.5
        });
        this.shield = new THREE.Mesh(shieldGeo, shieldMat);
        this.shield.visible = false;
        this.mesh.add(this.shield);
    }

    _setupCrown() {
        const crownGroup = new THREE.Group();
        const baseGeo = new THREE.TorusGeometry(0.2, 0.05, 8, 24);
        const goldMat = new THREE.MeshStandardMaterial({ 
            color: 0xffd700, 
            metalness: 0.9, 
            roughness: 0.1,
            emissive: 0xffd700,
            emissiveIntensity: 0.5
        });
        const base = new THREE.Mesh(baseGeo, goldMat);
        base.rotation.x = Math.PI / 2;
        crownGroup.add(base);

        // Points
        for (let i = 0; i < 5; i++) {
            const pointGeo = new THREE.ConeGeometry(0.05, 0.15, 4);
            const point = new THREE.Mesh(pointGeo, goldMat);
            const angle = (i / 5) * Math.PI * 2;
            point.position.set(Math.cos(angle) * 0.2, 0.08, Math.sin(angle) * 0.2);
            crownGroup.add(point);
        }

        crownGroup.position.y = 2.1;
        crownGroup.visible = false;
        this.mesh.add(crownGroup);
        this.prizeMeshes['crown'] = crownGroup;
    }

    _setupCape() {
        const capeGeo = new THREE.PlaneGeometry(0.6, 1.2);
        const capeMat = new THREE.MeshStandardMaterial({ 
            color: 0xff00ff, 
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
            emissive: 0xff00ff,
            emissiveIntensity: 0.5
        });
        const cape = new THREE.Mesh(capeGeo, capeMat);
        cape.position.set(0, 0.8, -0.25);
        cape.rotation.x = Math.PI * 0.05;
        cape.visible = false;
        this.mesh.add(cape);
        this.prizeMeshes['legend_cape'] = cape;
    }

    _setupTrail() {
        this.trailPoints = [];
        this.trailMaxPoints = 20;
        const trailGeo = new THREE.BufferGeometry();
        const trailMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 });
        this.trailLine = new THREE.Line(trailGeo, trailMat);
        this.trailLine.frustumCulled = false;
        this.trailLine.visible = false;
        this.scene.add(this.trailLine);
        this.prizeMeshes['trail'] = this.trailLine;
    }

    unlockPrize(id) {
        if (!this.unlockedPrizes.includes(id)) {
            this.unlockedPrizes.push(id);
            localStorage.setItem('unlockedPrizes', JSON.stringify(this.unlockedPrizes));
            this.applyPrize(id);
            return true;
        }
        return false;
    }

    applyPrize(id) {
        this.activePrizes.add(id);
        if (id === 'neon_glow') {
            this.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material.emissive = new THREE.Color(0x00ffff);
                    child.material.emissiveIntensity = 0.3;
                }
            });
        }
        if (this.prizeMeshes[id]) {
            this.prizeMeshes[id].visible = true;
        }
    }

    takeDamage(amount) {
        if (this.invincibilityTimer > 0) return;
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0; // Prevent multiple deaths
            if (this.onDeath) this.onDeath();
            this.respawn();
        }
    }

    applyInvincibility(duration = CONFIG.PLAYER.INVINCIBILITY_DURATION) {
        this.invincibilityTimer = duration;
        this.shield.visible = true;
    }

    addCoin() {
        this.coins++;
    }

    respawn() {
        this.mesh.position.copy(this.checkpoint);
        this.controller.velocity.set(0, 0, 0);
        this.controller.groundLevel = this.checkpoint.y; // Temporary grounding to prevent one-frame drop
        this.speedBoostTimer = 0;
        this.invincibilityTimer = 0;
        this.shield.visible = false;
        this.health = CONFIG.PLAYER.MAX_HEALTH;
        this.controller.moveSpeed = this.baseMoveSpeed;
        
        // Reset trail on respawn
        if (this.trailPoints) {
            this.trailPoints = [];
            this.trailLine.geometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
            this.trailLine.visible = false;
        }
    }

    setCheckpoint(pos) {
        const newCP = pos.clone().add(new THREE.Vector3(0, 1.6, 0));
        if (this.checkpoint.distanceTo(newCP) > 1.0) {
            this.checkpoint.copy(newCP);
            if (this.onCheckpoint) this.onCheckpoint();
        }
    }

    applySpeedBoost(duration = 2) {
        this.speedBoostTimer = duration;
        this.controller.moveSpeed = this.baseMoveSpeed * 2;
    }

    update(deltaTime, rotation) {
        if (this.speedBoostTimer > 0) {
            this.speedBoostTimer -= deltaTime;
            if (this.speedBoostTimer <= 0) {
                this.controller.moveSpeed = this.baseMoveSpeed;
            }
        }

        if (this.invincibilityTimer > 0) {
            this.invincibilityTimer -= deltaTime;
            if (this.invincibilityTimer <= 0) {
                this.shield.visible = false;
            } else {
                this.shield.rotation.y += deltaTime * 5;
                this.shield.material.opacity = 0.2 + Math.sin(this.animTime * 10) * 0.1;
            }
        }

        this.controller.update(deltaTime, rotation);

        // Trail Update
        if (this.activePrizes.has('trail')) {
            const isMoving = Math.abs(this.controller.velocity.x) > 0.1 || Math.abs(this.controller.velocity.z) > 0.1;
            if (isMoving) {
                this.trailLine.visible = true;
                this.trailPoints.push(this.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)));
                if (this.trailPoints.length > this.trailMaxPoints) this.trailPoints.shift();
                this.trailLine.geometry.setFromPoints(this.trailPoints);
            } else {
                this.trailLine.visible = false;
            }
        }

        // Cape Animation
        if (this.activePrizes.has('legend_cape')) {
            const cape = this.prizeMeshes['legend_cape'];
            const speed = this.controller.velocity.length();
            cape.rotation.x = (Math.PI * 0.05) + (speed * 0.05);
            cape.rotation.y = Math.sin(this.animTime * 5) * 0.05;
        }

        // Character Animations
        const isMoving = Math.abs(this.controller.velocity.x) > 0.1 || Math.abs(this.controller.velocity.z) > 0.1;
        this.animTime = (this.animTime || 0) + deltaTime;

        if (this.controller.isOnGround) {
            if (isMoving) {
                // Swing arms and legs when walking
                const swingSpeed = this.speedBoostTimer > 0 ? 15 : 10;
                const swing = Math.sin(this.animTime * swingSpeed) * 0.8;
                this.leftArm.rotation.x = swing;
                this.rightArm.rotation.x = -swing;
                this.leftLeg.rotation.x = -swing;
                this.rightLeg.rotation.x = swing;
            } else {
                // Return arms and legs to rest
                this.leftArm.rotation.x *= 0.9;
                this.rightArm.rotation.x *= 0.9;
                this.leftLeg.rotation.x *= 0.9;
                this.rightLeg.rotation.x *= 0.9;
            }
        } else {
            // Raise arms while jumping, adjust legs
            const jumpPose = -Math.PI / 2.5;
            this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, jumpPose, 0.2);
            this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, jumpPose, 0.2);
            
            const legJumpPose = Math.PI / 6;
            this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, legJumpPose, 0.2);
            this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, -legJumpPose, 0.2);
        }
        
        // Death floor
        if (this.mesh.position.y < -10) {
            if (this.onDeath) this.onDeath();
            this.respawn();
        }
    }
}
