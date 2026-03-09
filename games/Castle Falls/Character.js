import * as THREE from 'three';

export class RobloxCharacter {
    constructor() {
        this.group = new THREE.Group();
        
        // Materials
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });
        const shirtMat = new THREE.MeshStandardMaterial({ color: 0xff69b4 }); // Pink shirt
        const pantsMat = new THREE.MeshStandardMaterial({ color: 0x333333 }); // Darker gray for contrast
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x442200 }); // Brunette
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const blackMat = new THREE.MeshStandardMaterial({ color: 0x000000 });

        // Anchor for the whole body to rotate around the center of mass
        this.anchor = new THREE.Group();
        this.anchor.position.y = 1.45; // Center of torso
        this.group.add(this.anchor);

        // --- Torso ---
        this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), shirtMat);
        this.torso.position.y = 0; // Relative to anchor
        this.torso.castShadow = true;
        this.torso.receiveShadow = true;
        this.anchor.add(this.torso);

        // --- Back Text "STEFI" ---
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Dark background patch for neon to pop
        ctx.fillStyle = 'rgba(20, 0, 40, 0.8)'; 
        ctx.roundRect ? ctx.roundRect(10, 10, 492, 236, 20) : ctx.rect(10, 10, 492, 236);
        ctx.fill();

        // Neon Blue Glow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.fillStyle = '#00ffff'; // Solid blue for text
        ctx.font = 'bold 120px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw flat text
        ctx.fillText('STEFI', canvas.width / 2, canvas.height / 2);
        
        const textTex = new THREE.CanvasTexture(canvas);
        const textMat = new THREE.MeshBasicMaterial({ map: textTex, transparent: true });
        const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.35), textMat);
        textPlane.position.set(0, -0.05, -0.206); // Moved down slightly
        textPlane.rotation.y = Math.PI; // Face outwards
        this.torso.add(textPlane);

        // --- Head ---
        this.head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
        this.head.position.y = 0.75; // Top of torso
        this.head.castShadow = true;
        this.head.receiveShadow = true;
        this.torso.add(this.head);

        // --- Eyes ---
        const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02);

        this.leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        this.leftEye.position.set(-0.12, 0.05, 0.23);
        this.head.add(this.leftEye);
        const lp = new THREE.Mesh(pupilGeo, blackMat);
        lp.position.z = 0.04;
        this.leftEye.add(lp);

        this.rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        this.rightEye.position.set(0.12, 0.05, 0.23);
        this.head.add(this.rightEye);
        const rp = new THREE.Mesh(pupilGeo, blackMat);
        rp.position.z = 0.04;
        this.rightEye.add(rp);

        // --- Mouth ---
        const mouthGeo = new THREE.BoxGeometry(0.18, 0.04, 0.02);
        const mouthMat = new THREE.MeshStandardMaterial({ color: 0x662222 }); // Deep red/brown for mouth
        this.mouth = new THREE.Mesh(mouthGeo, mouthMat);
        this.mouth.position.set(0, -0.12, 0.24);
        this.head.add(this.mouth);

        // --- Hair (Girlish/Longer) ---
        const mainHair = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.55), hairMat);
        mainHair.position.y = 0.2;
        this.head.add(mainHair);

        // Long back hair
        const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.15), hairMat);
        backHair.position.set(0, -0.25, -0.25);
        this.head.add(backHair);

        // Side hair
        const sideHairL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.55), hairMat);
        sideHairL.position.set(-0.25, -0.15, 0);
        this.head.add(sideHairL);
        const sideHairR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.55), hairMat);
        sideHairR.position.set(0.25, -0.15, 0);
        this.head.add(sideHairR);

        // --- Arms ---
        const armGeo = new THREE.BoxGeometry(0.32, 0.9, 0.32);
        
        // Left Arm
        this.leftArmPivot = new THREE.Group();
        this.leftArmPivot.position.set(-0.55, 0.3, 0); // Shoulder
        this.torso.add(this.leftArmPivot);
        this.leftArm = new THREE.Mesh(armGeo, shirtMat); // Pink sleeves
        this.leftArm.position.y = -0.4;
        this.leftArm.castShadow = true;
        this.leftArm.receiveShadow = true;
        this.leftArmPivot.add(this.leftArm);

        // Right Arm
        this.rightArmPivot = new THREE.Group();
        this.rightArmPivot.position.set(0.55, 0.3, 0); // Shoulder
        this.torso.add(this.rightArmPivot);
        this.rightArm = new THREE.Mesh(armGeo, shirtMat); // Pink sleeves
        this.rightArm.position.y = -0.4;
        this.rightArm.castShadow = true;
        this.rightArm.receiveShadow = true;
        this.rightArmPivot.add(this.rightArm);

        // --- Legs ---
        const legGeo = new THREE.BoxGeometry(0.28, 1.0, 0.28); // Thinner legs to avoid blocky shape

        // Left Leg
        this.leftLegPivot = new THREE.Group();
        this.leftLegPivot.position.set(-0.2, -0.45, 0); 
        this.torso.add(this.leftLegPivot);
        this.leftLeg = new THREE.Mesh(legGeo, pantsMat);
        this.leftLeg.position.y = -0.5;
        this.leftLeg.castShadow = true;
        this.leftLeg.receiveShadow = true;
        this.leftLegPivot.add(this.leftLeg);

        // Right Leg
        this.rightLegPivot = new THREE.Group();
        this.rightLegPivot.position.set(0.2, -0.45, 0); 
        this.torso.add(this.rightLegPivot);
        this.rightLeg = new THREE.Mesh(legGeo, pantsMat);
        this.rightLeg.position.y = -0.5;
        this.rightLeg.castShadow = true;
        this.rightLeg.receiveShadow = true;
        this.rightLegPivot.add(this.rightLeg);

        this.walkCycle = 0;
        this.isClimbing = false;
        this.isDead = false;
        this.wallRunSide = null; // 'left' or 'right'
    }

    setClimbing(val) {
        this.isClimbing = val;
    }

    setDead(val) {
        this.isDead = val;
        if (val) {
            // Collapse pose
            this.anchor.rotation.x = -Math.PI / 2;
            this.anchor.position.y = 0.3;
            this.leftArmPivot.rotation.x = -1;
            this.rightArmPivot.rotation.x = 1;
            this.leftLegPivot.rotation.x = 0.5;
            this.rightLegPivot.rotation.x = -0.5;
        }
    }

    resetPose() {
        this.isDead = false;
        this.isClimbing = false;
        this.wallRunSide = null;
        this.group.rotation.set(0, this.group.rotation.y, 0); // Preserve current facing but reset tilt
        this.anchor.rotation.set(0, 0, 0);
        this.anchor.position.set(0, 1.45, 0); // Absolute relative to group
        this.leftArmPivot.rotation.set(0, 0, 0);
        this.rightArmPivot.rotation.set(0, 0, 0);
        this.leftLegPivot.rotation.set(0, 0, 0);
        this.rightLegPivot.rotation.set(0, 0, 0);
        this.walkCycle = 0;
    }

    setWallRunning(side) {
        this.wallRunSide = side;
    }

    update(deltaTime, velocity, isOnGround) {
        if (this.isDead) return;

        this.anchor.rotation.x = 0;
        this.anchor.position.y = 1.45;

        // Handle climbing animation override
        if (this.isClimbing) {
            this.walkCycle += deltaTime * 8;
            const swing = Math.sin(this.walkCycle) * 0.8;
            
            // Alternate arms and legs for climbing
            this.leftArmPivot.rotation.x = -0.5 + swing;
            this.rightArmPivot.rotation.x = -0.5 - swing;
            this.leftLegPivot.rotation.x = -swing * 0.5;
            this.rightLegPivot.rotation.x = swing * 0.5;
            
            this.anchor.position.y = 1.45;
            return;
        }

        // Handle wall-run animation override
        if (this.wallRunSide) {
            const lerpVal = 0.2;
            const tiltAngle = this.wallRunSide === 'left' ? -0.4 : 0.4;
            this.anchor.rotation.z = THREE.MathUtils.lerp(this.anchor.rotation.z, tiltAngle, lerpVal);
            
            // Wall run leg pose: spread wide and cycling
            this.walkCycle += deltaTime * 12;
            const swing = Math.sin(this.walkCycle) * 0.5;
            this.leftLegPivot.rotation.x = -swing;
            this.rightLegPivot.rotation.x = swing;
            this.leftArmPivot.rotation.x = swing;
            this.rightArmPivot.rotation.x = -swing;
            
            this.anchor.position.y = 1.45;
            return;
        } else {
            this.anchor.rotation.z = THREE.MathUtils.lerp(this.anchor.rotation.z, 0, 0.2);
        }

        // Calculate speed for animation
        const speed = new THREE.Vector2(velocity.x, velocity.z).length();
        const isMoving = speed > 0.5;

        if (isOnGround && isMoving) {
            // Strong movement: animate limbs
            this.walkCycle += deltaTime * speed * 0.8;
            const swing = Math.sin(this.walkCycle) * 0.6;
            
            this.leftLegPivot.rotation.x = swing;
            this.rightLegPivot.rotation.x = -swing;
            
            this.leftArmPivot.rotation.x = -swing;
            this.rightArmPivot.rotation.x = swing;
            
            // Body bobbing (added to base height)
            this.anchor.position.y = 1.45 + (Math.abs(Math.cos(this.walkCycle * 2)) * 0.1);
        } else if (!isOnGround) {
            // New "Athletic" Jump pose: One leg slightly up, one trailing, arms high
            const lerpVal = 0.15;
            
            // Legs: one tucked, one straight/trailing
            this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, -0.6, lerpVal);
            this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, 0.2, lerpVal);
            
            // Arms: Reaching forward/up, not back
            this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -1.2, lerpVal);
            this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -1.0, lerpVal);
            this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, -0.2, lerpVal);
            this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, 0.2, lerpVal);
            
            this.anchor.position.y = 1.45;
        } else {
            // Idle: reset rotations
            const lerpVal = 0.2;
            this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, 0, lerpVal);
            this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, 0, lerpVal);
            this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, 0, lerpVal);
            this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, 0, lerpVal);
            this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, 0, lerpVal);
            this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, 0, lerpVal);
            this.anchor.position.y = 1.45;
            this.walkCycle = 0;
        }
    }
}
