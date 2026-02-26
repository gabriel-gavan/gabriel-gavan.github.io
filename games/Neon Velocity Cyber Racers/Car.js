import * as THREE from 'three';
import { Config } from './Config.js';

export class Car {
    constructor(scene, color, isPlayer = false, name = '') {
        this.scene = scene;
        this.isPlayer = isPlayer;
        this.color = color;
        this.name = name;

        this.velocity = new THREE.Vector3();
        this.speed = 0;
        this.angle = 0;
        
        this.isBoosting = false;
        this.isSlipping = false;
        this.slipTime = 0;
        this.boostTime = 0;

        this.mesh = this.createMesh();
        this.scene.add(this.mesh);

        // For Lap logic
        this.currentWaypointIndex = 0;
        this.lap = 0;
        // Initial positions and orientation
        this.mesh.rotation.y = this.angle;
        this.mesh.position.y = 0.5; // Ensure on ground
    }

    createMesh() {
        const group = new THREE.Group();

        // High-end Car Paint Material with better realism
        const carPaintMat = new THREE.MeshPhysicalMaterial({
            color: this.color,
            metalness: 1.0,
            roughness: 0.15,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            emissive: this.color,
            emissiveIntensity: 0.1,
            reflectivity: 1.0
        });

        // Chassis / Main Body - More sculpted
        const bodyGeo = new THREE.BoxGeometry(2.4, 0.4, 4.8);
        const body = new THREE.Mesh(bodyGeo, carPaintMat);
        body.position.y = 0.45;
        group.add(body);

        // Slanted Hood / Nose - Sharper
        const hoodGeo = new THREE.BoxGeometry(2.4, 0.25, 1.8);
        const hood = new THREE.Mesh(hoodGeo, carPaintMat);
        hood.position.set(0, 0.35, 1.8);
        hood.rotation.x = -0.15;
        group.add(hood);

        // Lower Front Splitter
        const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 0.8), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 }));
        splitter.position.set(0, 0.2, 2.3);
        group.add(splitter);

        // Roof / Cockpit - More aerodynamic teardrop shape
        const roofGeo = new THREE.SphereGeometry(1.1, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const roof = new THREE.Mesh(roofGeo, carPaintMat);
        roof.scale.set(1.0, 0.7, 1.8);
        roof.position.set(0, 0.6, -0.2);
        group.add(roof);

        // Windows (Deep Black Reflective)
        const windowMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 1, roughness: 0, opacity: 0.9, transparent: true });
        const windscreen = new THREE.Mesh(new THREE.SphereGeometry(1.12, 16, 16, 0, Math.PI, 0, Math.PI / 2), windowMat);
        windscreen.scale.set(0.95, 0.65, 1.3);
        windscreen.position.set(0, 0.62, 0.1);
        group.add(windscreen);

        // Massive Aerodynamic Rear Wing
        const wingPlate = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.05, 1.2), carPaintMat);
        wingPlate.position.set(0, 1.4, -2.1);
        const wingSupportL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.4), carPaintMat);
        wingSupportL.position.set(1.1, 0.8, -2.0);
        const wingSupportR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.4), carPaintMat);
        wingSupportR.position.set(-1.1, 0.8, -2.0);
        group.add(wingPlate, wingSupportL, wingSupportR);

        // Realistic Wheel Assemblies
        const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.6, 32);
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.9 });
        const rimMat = new THREE.MeshPhysicalMaterial({ color: 0x888888, metalness: 1.0, roughness: 0.1 });
        
        const wheelPositions = [
            [1.25, 0.55, 1.6], [-1.25, 0.55, 1.6],
            [1.25, 0.55, -1.6], [-1.25, 0.55, -1.6]
        ];
        
        wheelPositions.forEach(pos => {
            const wheelGroup = new THREE.Group();
            const tire = new THREE.Mesh(wheelGeo, tireMat);
            tire.rotation.z = Math.PI / 2;
            wheelGroup.add(tire);
            
            // Rim Detail (Multi-spoke look)
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.62, 16), rimMat);
            rim.rotation.z = Math.PI / 2;
            wheelGroup.add(rim);
            
            wheelGroup.position.set(...pos);
            group.add(wheelGroup);
        });

        // Lights
        const headLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.1), headLightMat);
        hl1.position.set(0.9, 0.4, 2.6);
        const hl2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.1), headLightMat);
        hl2.position.set(-0.9, 0.4, 2.6);
        group.add(hl1, hl2);

        const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const tl1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.1), tailLightMat);
        tl1.position.set(0.8, 0.55, -2.4);
        const tl2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.1), tailLightMat);
        tl2.position.set(-0.8, 0.55, -2.4);
        group.add(tl1, tl2);

        // Powerful Neon Underglow (PointLight)
        const glow = new THREE.PointLight(this.color, 25, 12);
        glow.position.set(0, 0.2, 0);
        group.add(glow);

        return group;
    }

    update(dt, input, waypoints) {
        if (this.isSlipping) {
            this.slipTime -= dt;
            if (this.slipTime <= 0) this.isSlipping = false;
            // Loss of control: rotate randomly
            this.angle += Math.sin(Date.now() * 0.01) * 0.1;
        } else if (this.isPlayer) {
            this.handlePlayerInput(input, dt);
        } else {
            this.handleAI(waypoints, dt);
        }

        // Apply physics
        if (this.isBoosting) {
            this.boostTime -= dt;
            if (this.boostTime <= 0) this.isBoosting = false;
        }

        const maxSpeed = this.isBoosting ? Config.CAR_MAX_SPEED * 1.5 : Config.CAR_MAX_SPEED;
        
        // Deceleration
        const frictionFactor = Math.pow(Config.CAR_DECELERATION, dt / 16.6);
        this.speed *= frictionFactor;
        if (Math.abs(this.speed) < 0.01) this.speed = 0;

        // Cap speed
        this.speed = Math.max(-Config.CAR_REVERSE_SPEED, Math.min(this.speed, maxSpeed));

        // Update position based on angle
        const frameSpeed = this.speed * (dt / 16.6); // Normalize to ~60fps
        this.mesh.position.x += Math.sin(this.angle) * frameSpeed;
        this.mesh.position.z += Math.cos(this.angle) * frameSpeed;
        
        // Update mesh rotation and sprite orientation
        this.mesh.rotation.y = this.angle;
    }

    handlePlayerInput(input, dt) {
        const factor = dt / 16.6;
        if (input.forward) this.speed += Config.CAR_ACCELERATION * factor;
        if (input.backward) this.speed -= Config.CAR_ACCELERATION * factor;
        
        if (Math.abs(this.speed) > 0.1) {
            const dir = this.speed > 0 ? 1 : -1;
            if (input.left) this.angle += Config.CAR_STEER_SPEED * dir * factor;
            if (input.right) this.angle -= Config.CAR_STEER_SPEED * dir * factor;
        }
    }

    handleAI(waypoints, dt) {
        const factor = dt / 16.6;
        const target = waypoints[this.currentWaypointIndex];
        const dx = target.x - this.mesh.position.x;
        const dz = target.z - this.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < Config.AI_WAYPOINT_THRESHOLD) {
            this.currentWaypointIndex = (this.currentWaypointIndex + 1) % waypoints.length;
        }

        const targetAngle = Math.atan2(dx, dz);
        let angleDiff = targetAngle - this.angle;

        // Normalize angle
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // AI Steering and speed adjustment
        const steerPower = Math.min(Math.abs(angleDiff), 1.0);
        if (Math.abs(angleDiff) > 0.05) {
            this.angle += Math.sign(angleDiff) * Config.AI_STEER_SPEED * factor;
        }

        // Slow down if taking a sharp turn
        const speedMultiplier = 1.0 - (steerPower * 0.5);
        this.speed += Config.AI_ACCELERATION * speedMultiplier * factor;
    }

    applyBoost() {
        this.isBoosting = true;
        this.boostTime = 1000; // ms
    }

    applyOil() {
        this.isSlipping = true;
        this.slipTime = 1500; // ms
        this.speed *= 0.5;
    }
}
