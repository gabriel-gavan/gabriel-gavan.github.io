import * as THREE from 'three';
import { CONFIG } from './config.js';

export class TrackManager {
    constructor(scene) {
        this.scene = scene;
        this.segments = [];
        this.obstacles = [];
        this.items = []; // Coins and Power-ups
        this.currentWorld = CONFIG.WORLDS.NEON;
        this.textureLoader = new THREE.TextureLoader();
        this.trackTexture = this.textureLoader.load(CONFIG.ASSETS.TRACK_TEXTURE);
        this.trackTexture.wrapS = THREE.RepeatWrapping;
        this.trackTexture.wrapT = THREE.RepeatWrapping;
        this.trackTexture.repeat.set(1, 5);

        this.barrierTexture = this.textureLoader.load(CONFIG.ASSETS.BARRIER_TEXTURE);
        this.coinTexture = this.textureLoader.load(CONFIG.ASSETS.COIN_TEXTURE);
        this.trainTexture = this.textureLoader.load(CONFIG.ASSETS.TRAIN_TEXTURE);
        this.trainFrontTexture = this.textureLoader.load(CONFIG.ASSETS.TRAIN_FRONT_TEXTURE);
        this.trainSideTexture = this.textureLoader.load(CONFIG.ASSETS.TRAIN_SIDE_TEXTURE);
        this.buildingTexture = this.textureLoader.load(CONFIG.ASSETS.BUILDING_TEXTURE);
        this.coneTexture = this.textureLoader.load(CONFIG.ASSETS.CONE_TEXTURE);
        this.crateTexture = this.textureLoader.load(CONFIG.ASSETS.CRATE_TEXTURE);
        this.arrowTexture = this.textureLoader.load(CONFIG.ASSETS.ARROW_TEXTURE);
        this.particleTexture = this.textureLoader.load(CONFIG.ASSETS.PARTICLE_TEXTURE); // Pre-load
        
        this.buildingTexture.wrapS = THREE.RepeatWrapping;
        this.buildingTexture.wrapT = THREE.RepeatWrapping;
        this.buildingTexture.repeat.set(1, 1);

        this.powerUpTextures = {
            magnet: this.textureLoader.load(CONFIG.ASSETS.ICONS.MAGNET),
            jetpack: this.textureLoader.load(CONFIG.ASSETS.ICONS.JETPACK),
            sneakers: this.textureLoader.load(CONFIG.ASSETS.ICONS.SNEAKERS),
            hoverboard: this.textureLoader.load(CONFIG.ASSETS.ICONS.HOVERBOARD)
        };

        this.init();
    }

    setWorld(worldKey) {
        this.currentWorld = CONFIG.WORLDS[worldKey] || CONFIG.WORLDS.NEON;
        // Update existing segments
        this.segments.forEach(segment => {
            if (segment.material) {
                segment.material.color.setHex(this.currentWorld.trackColor);
                segment.material.emissive.setHex(this.currentWorld.trackColor);
            }
            // Update walls if needed
            segment.children.forEach(child => {
                if (child.material && child.material.name !== 'glow') { // Simplified check
                   if (child.position.x < -6 || child.position.x > 6) { // It's a wall
                       child.material.color.setHex(this.currentWorld.wallColor);
                       child.material.emissive.setHex(this.currentWorld.wallColor);
                   }
                }
            });
        });
    }

    init() {
        for (let i = 0; i < CONFIG.TRACK_SEGMENTS_COUNT; i++) {
            const z = i * CONFIG.TRACK_SEGMENT_LENGTH;
            const segment = this._createSegment(z);
            // Allow obstacles even on the first segment, but with a safety offset
            this._spawnObstaclesOnSegment(segment, i === 0);
        }
    }

    _createSegment(zPos) {
        const geometry = new THREE.PlaneGeometry(12, CONFIG.TRACK_SEGMENT_LENGTH);
        geometry.rotateX(-Math.PI / 2); // Rotate geometry so Y is up and plane is on XZ
        
        const material = new THREE.MeshStandardMaterial({ 
            map: this.trackTexture,
            color: this.currentWorld.trackColor,
            emissive: this.currentWorld.trackColor,
            emissiveIntensity: 0.5
        });
        const segment = new THREE.Mesh(geometry, material);
        segment.position.z = zPos;
        this.scene.add(segment);
        this.segments.push(segment);

        // Glowing Lanes & Rail Tracks
        CONFIG.LANES.forEach(laneX => {
            // Main Lane Surface Glow
            const laneGlowGeom = new THREE.PlaneGeometry(3.5, CONFIG.TRACK_SEGMENT_LENGTH);
            laneGlowGeom.rotateX(-Math.PI / 2);
            const laneGlowMat = new THREE.MeshBasicMaterial({ 
                color: CONFIG.COLORS.LANE_GLOW, 
                transparent: true, 
                opacity: 0.15 
            });
            const laneGlow = new THREE.Mesh(laneGlowGeom, laneGlowMat);
            laneGlow.position.set(laneX, 0.005, 0);
            segment.add(laneGlow);

            // Literal Rails (Train Tracks)
            const railGeom = new THREE.BoxGeometry(0.15, 0.15, CONFIG.TRACK_SEGMENT_LENGTH);
            const railMat = new THREE.MeshStandardMaterial({ 
                color: 0x888888, 
                metalness: 1.0, 
                roughness: 0.1,
                emissive: CONFIG.COLORS.LANE_GLOW,
                emissiveIntensity: 0.5
            });

            // Left Rail
            const railL = new THREE.Mesh(railGeom, railMat);
            railL.position.set(laneX - 0.7, 0.075, 0);
            segment.add(railL);

            // Right Rail
            const railR = new THREE.Mesh(railGeom, railMat);
            railR.position.set(laneX + 0.7, 0.075, 0);
            segment.add(railR);

            // Sleepers (Cross-beams)
            const sleeperGeom = new THREE.BoxGeometry(1.6, 0.05, 0.4);
            const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
            for (let j = 0; j < 10; j++) {
                const sleeper = new THREE.Mesh(sleeperGeom, sleeperMat);
                sleeper.position.set(laneX, 0.025, (j / 10) * CONFIG.TRACK_SEGMENT_LENGTH - CONFIG.TRACK_SEGMENT_LENGTH / 2);
                segment.add(sleeper);
            }

            // Add directional arrows on the track
            if (Math.random() > 0.5) {
                const arrowGeom = new THREE.PlaneGeometry(1.5, 1.5);
                arrowGeom.rotateX(-Math.PI / 2);
                const arrowMat = new THREE.MeshBasicMaterial({ 
                    map: this.arrowTexture, 
                    transparent: true, 
                    opacity: 0.6 
                });
                const arrow = new THREE.Mesh(arrowGeom, arrowMat);
                arrow.position.set(laneX, 0.02, (Math.random() - 0.5) * CONFIG.TRACK_SEGMENT_LENGTH);
                segment.add(arrow);
            }
        });

        // Wall & Pillars logic - Correctly oriented now that segment isn't rotated
        const wallGeom = new THREE.BoxGeometry(0.5, 6, CONFIG.TRACK_SEGMENT_LENGTH); 
        const wallMat = new THREE.MeshStandardMaterial({ 
            map: this.buildingTexture,
            color: this.currentWorld.wallColor, 
            emissive: this.currentWorld.wallColor, 
            emissiveIntensity: 0.3 
        });
        
        const leftWall = new THREE.Mesh(wallGeom, wallMat);
        leftWall.position.set(-15, 3, 0); // Pushed further out
        segment.add(leftWall);

        const rightWall = new THREE.Mesh(wallGeom, wallMat);
        rightWall.position.set(15, 3, 0); // Pushed further out
        segment.add(rightWall);

        // Procedural Tunnel - Raised much higher to prevent camera clipping during jetpack use
        if (Math.random() > 0.7) {
            const roofGeom = new THREE.BoxGeometry(30, 0.5, CONFIG.TRACK_SEGMENT_LENGTH);
            const roof = new THREE.Mesh(roofGeom, wallMat);
            roof.position.set(0, 25, 0); // Raised from 10 to 25
            segment.add(roof);
        }

        for (let i = 0; i < 4; i++) {
            const pillarGeom = new THREE.BoxGeometry(0.5, 30, 0.5); // Taller pillars
            const pillarMat = new THREE.MeshStandardMaterial({ 
                color: this.currentWorld.pillarColor, 
                emissive: this.currentWorld.pillarColor, 
                emissiveIntensity: 1 
            });
            const pZ = (i / 4) * CONFIG.TRACK_SEGMENT_LENGTH - CONFIG.TRACK_SEGMENT_LENGTH / 2;
            
            const pL = new THREE.Mesh(pillarGeom, pillarMat);
            pL.position.set(-15, 15, pZ); // Adjusted to match new height
            segment.add(pL);

            const pR = new THREE.Mesh(pillarGeom, pillarMat);
            pR.position.set(15, 15, pZ); // Adjusted to match new height
            segment.add(pR);
        }

        return segment;
    }

    update(playerPos, moveSpeed, dt, isMagnetActive, camera) {
        const playerZ = playerPos.z;
        
        // Recycle segments along +Z
        for (let segment of this.segments) {
            if (playerZ - segment.position.z > CONFIG.TRACK_SEGMENT_LENGTH) {
                // Find current furthest segment
                let maxZ = -Infinity;
                this.segments.forEach(s => { if(s.position.z > maxZ) maxZ = s.position.z; });
                
                segment.position.z = maxZ + CONFIG.TRACK_SEGMENT_LENGTH;
                this._spawnObstaclesOnSegment(segment);
            }
        }

        // Update obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            
            if (obs.type === 'train') {
                obs.mesh.position.z -= obs.speed * dt; // Trains move TOWARDS player in +Z flow
            }

            // Pulse the ground glow
            obs.mesh.children.forEach(child => {
                if (child.material && child.material.blending === THREE.AdditiveBlending) {
                    // Hazards pulse more aggressively (faster and wider range)
                    child.material.opacity = 0.5 + Math.sin(Date.now() * 0.015) * 0.3;
                }
            });

            if (obs.mesh.isBillboard && camera) {
                // Smoothly rotate to face camera on Y axis
                obs.mesh.quaternion.copy(camera.quaternion);
                obs.mesh.rotation.x = 0;
                obs.mesh.rotation.z = 0;
            }

            // Cleanup obstacles far behind
            if (playerZ - obs.mesh.position.z > 20) {
                this.scene.remove(obs.mesh);
                this.obstacles.splice(i, 1);
            }
        }

        // Update items
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            
            // Soft Magnet: Even without powerup, items pull slightly when very close
            const dist = item.mesh.position.distanceTo(playerPos);
            const magnetRadius = isMagnetActive ? 15 : 4;
            
            if (dist < magnetRadius) {
                // CRITICAL FIX: The magnet speed must be faster than the moveSpeed to actually catch the player
                // We use a lerp factor that scales with moveSpeed and dt
                const catchUpFactor = Math.max(15, (moveSpeed / dist) * 2); 
                item.mesh.position.lerp(playerPos, catchUpFactor * dt);
                item.isBeingPulled = true; // Mark for GameScene to prioritize collision
            } else {
                // Regular idle spin
                item.mesh.rotation.y += dt * 3;
                item.isBeingPulled = false;
            }

            // Cleanup items far behind
            if (playerZ - item.mesh.position.z > 15) {
                this.scene.remove(item.mesh);
                this.items.splice(i, 1);
            }
        }
    }

    _spawnObstaclesOnSegment(segment, isFirstSegment = false) {
        const z = segment.position.z;
        // Standard spawn points relative to segment center
        let spawnPoints = [
            z - CONFIG.TRACK_SEGMENT_LENGTH * 0.35, 
            z, 
            z + CONFIG.TRACK_SEGMENT_LENGTH * 0.35
        ];

        // For the first segment, ensure we don't spawn behind or on the player (z=0)
        // and keep a safety zone for the menu camera (which sits at z+6)
        if (isFirstSegment) {
            spawnPoints = [z + 12, z + 25, z + 38]; 
        }

        // Add Sky Coins for Jetpack users (only a small chance so it doesn't look like floating errors)
        if (Math.random() > 0.5) {
            for (let i = 0; i < 3; i++) {
                const lane = Math.floor(Math.random() * 3);
                const skyZ = z + (i/3) * CONFIG.TRACK_SEGMENT_LENGTH - CONFIG.TRACK_SEGMENT_LENGTH/2;
                this.spawnItem('coin', lane, skyZ, 12); // Spawn at jetpack height
            }
        }

        spawnPoints.forEach((spawnZ, index) => {
            const pattern = Math.random();

            // Force first obstacle of the first segment for immediate challenge
            const isForcedStart = isFirstSegment && index === 0;

            if (pattern < 0.75 || isForcedStart) { // Increased obstacle probability at the start
                const patternType = Math.random();
                
                if (patternType < 0.2) {
                    // Train Pattern: Sometimes multiple cars
                    const cars = Math.floor(Math.random() * 2) + 1;
                    this.spawnObstacle('train', Math.floor(Math.random() * 3), spawnZ, { cars });
                } else if (patternType < 0.45) {
                    // Roadblock Pattern: Block 2 lanes
                    const openLane = Math.floor(Math.random() * 3);
                    [0, 1, 2].forEach(lane => {
                        if (lane !== openLane) {
                            this.spawnObstacle(Math.random() > 0.5 ? 'barrier' : 'cube', lane, spawnZ);
                        }
                    });
                } else if (patternType < 0.7 || isForcedStart) {
                    // Slalom Pattern: Cones in a line (or just cones if forced)
                    const lane = Math.floor(Math.random() * 3);
                    for(let i=0; i<3; i++) {
                        this.spawnObstacle('cone', lane, spawnZ + (i * 3));
                    }
                } else {
                    // Single random obstacle
                    const types = ['cube', 'barrier', 'low_bar', 'cone'];
                    this.spawnObstacle(types[Math.floor(Math.random() * types.length)], Math.floor(Math.random() * 3), spawnZ);
                }
            } else if (pattern < 0.8) { // Power-up
                const powerUps = Object.keys(CONFIG.ITEMS).filter(k => k !== 'COIN' && k !== 'KEY').map(k => k.toLowerCase());
                const type = powerUps[Math.floor(Math.random() * powerUps.length)];
                this.spawnItem(type, Math.floor(Math.random() * 3), spawnZ, 1.5);
            } else { // Coins
                const coinPattern = Math.random();
                const lane = Math.floor(Math.random() * 3);
                if (coinPattern < 0.5) {
                    // Straight line - Lowered to 0.75 for better collection feel
                    for (let i = 0; i < 5; i++) {
                        this.spawnItem('coin', lane, spawnZ + (i * 2.5), 0.75);
                    }
                } else {
                    // Arc (requires jumping) - Calibrated for new jump height
                    for (let i = 0; i < 5; i++) {
                        const h = 0.75 + Math.sin((i / 4) * Math.PI) * 2.5; 
                        this.spawnItem('coin', lane, spawnZ + (i * 2.5), h);
                    }
                }
            }
        });
    }

    _createGlowBase(color = 0xff0000) {
        const geom = new THREE.PlaneGeometry(2, 2);
        geom.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.4,
            map: this.particleTexture, // Circular glow
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const glow = new THREE.Mesh(geom, mat);
        glow.position.y = 0.05;
        return glow;
    }

    spawnObstacle(type, lane, z, options = {}) {
        let geometry, material, mesh;
        const x = CONFIG.LANES[lane];
        let speed = 0;
        let glowColor = CONFIG.COLORS.OBSTACLE;

        if (type === 'cube') {
            geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
            // Use MeshBasicMaterial for the crate to ensure the hazard lights are vivid and clear
            material = new THREE.MeshBasicMaterial({ 
                map: this.crateTexture
            });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, 0.75, z);
        } else if (type === 'barrier') {
            glowColor = CONFIG.COLORS.BARRIER;
            const group = new THREE.Group();
            
            // The main energy wall - made much taller and more opaque
            geometry = new THREE.BoxGeometry(4, 2.5, 0.8);
            material = new THREE.MeshStandardMaterial({ 
                map: this.barrierTexture, 
                transparent: true, 
                opacity: 0.9,
                color: CONFIG.COLORS.BARRIER,
                emissive: CONFIG.COLORS.BARRIER, 
                emissiveIntensity: 2.5 
            });
            const wall = new THREE.Mesh(geometry, material);
            wall.position.y = 1.25;
            group.add(wall);

            // Side warning pillars to mark the edges clearly
            const edgePillarGeom = new THREE.BoxGeometry(0.3, 3, 0.3);
            const edgePillarMat = new THREE.MeshStandardMaterial({ 
                color: 0xffffff,
                emissive: 0xffffff,
                emissiveIntensity: 1.0
            });
            const pL = new THREE.Mesh(edgePillarGeom, edgePillarMat);
            pL.position.set(-1.9, 1.5, 0);
            group.add(pL);
            const pR = new THREE.Mesh(edgePillarGeom, edgePillarMat);
            pR.position.set(1.9, 1.5, 0);
            group.add(pR);

            mesh = group;
            mesh.position.set(x, 0, z);
        } else if (type === 'low_bar') {
            glowColor = CONFIG.COLORS.LOW_BAR;
            const group = new THREE.Group();
            // The Bar - Thicker and more prominent
            const barGeom = new THREE.BoxGeometry(4, 0.8, 0.8);
            const barMat = new THREE.MeshStandardMaterial({ 
                color: CONFIG.COLORS.LOW_BAR, 
                emissive: CONFIG.COLORS.LOW_BAR, 
                emissiveIntensity: 2.5 
            });
            const bar = new THREE.Mesh(barGeom, barMat);
            bar.position.y = 2.4; // Slightly higher for clear visibility
            group.add(bar);

            const poleGeom = new THREE.BoxGeometry(0.3, 3.5, 0.3);
            const poleL = new THREE.Mesh(poleGeom, barMat);
            poleL.position.set(-1.9, 1.75, 0);
            group.add(poleL);
            const poleR = new THREE.Mesh(poleGeom, barMat);
            poleR.position.set(1.9, 1.75, 0);
            group.add(poleR);

            mesh = group;
            mesh.position.set(x, 0, z); 
        } else if (type === 'cone') {
            glowColor = 0xff0000; // Danger Red
            geometry = new THREE.PlaneGeometry(2, 2);
            material = new THREE.MeshBasicMaterial({ 
                map: this.coneTexture, 
                transparent: true,
                side: THREE.DoubleSide 
            });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, 1.0, z);
            mesh.isBillboard = true; // Mark for update loop
        } else if (type === 'train') {
            glowColor = CONFIG.COLORS.TRAIN;
            const group = new THREE.Group();
            const cars = options.cars || 1;
            const carLen = 15;
            
            const sideMat = new THREE.MeshStandardMaterial({ map: this.trainSideTexture, metalness: 0.8, roughness: 0.2, emissive: 0x222222 });
            const topMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.1 });
            const frontMat = new THREE.MeshBasicMaterial({ map: this.trainFrontTexture });
            const backMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });

            const trainMaterials = [sideMat, sideMat, topMat, topMat, backMat, backMat];

            for(let i=0; i<cars; i++) {
                geometry = new THREE.BoxGeometry(3.5, 4.5, carLen);
                let carMats = [...trainMaterials];
                
                // The "front" of the train is the car with the lowest local Z (the last one in the loop)
                // The face facing the player is the -Z face (Index 5)
                if (i === cars - 1) {
                    carMats[5] = frontMat;
                }

                const body = new THREE.Mesh(geometry, carMats);
                body.position.z = -i * (carLen + 0.1);
                group.add(body);
                
                // Tail lights go on the "back" of the train (the first car in the loop, +Z face)
                if (i === 0) {
                    const tailGeom = new THREE.BoxGeometry(0.8, 0.8, 0.1);
                    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                    const tL = new THREE.Mesh(tailGeom, tailMat);
                    tL.position.set(-1.0, 0.5, carLen/2 + 0.01);
                    body.add(tL);
                    const tR = new THREE.Mesh(tailGeom, tailMat);
                    tR.position.set(1.0, 0.5, carLen/2 + 0.01);
                    body.add(tR);
                }
            }

            mesh = group;
            mesh.position.set(x, 2.25, z - carLen/2);
            speed = 18;
        }

        // Add a ground glow for all obstacles to make them stand out
        const glow = this._createGlowBase(glowColor);
        if (type === 'train') {
            glow.scale.set(2, 8, 1); // Long glow for trains
            mesh.add(glow);
            glow.position.set(0, -2.2, 0); 
        } else if (type === 'low_bar' || type === 'barrier') {
            glow.scale.set(2.5, 1, 1);
            mesh.add(glow);
            glow.position.y = 0.05;
        } else {
            mesh.add(glow);
            glow.position.y = -mesh.position.y + 0.05;
        }

        this.scene.add(mesh);
        this.obstacles.push({ mesh, type, speed });
    }

    spawnItem(type, lane, z, y = 1) {
        const x = CONFIG.LANES[lane];
        let geometry, material;

        if (type === 'coin') {
            geometry = new THREE.PlaneGeometry(1.2, 1.2); // Slightly larger
            material = new THREE.MeshBasicMaterial({ 
                map: this.coinTexture, 
                transparent: true,
                side: THREE.DoubleSide
            });
        } else {
            const textureKey = type === 'super_jump' ? 'sneakers' : 
                               type === 'boost' ? 'jetpack' : type;
            geometry = new THREE.PlaneGeometry(1.5, 1.5);
            material = new THREE.MeshBasicMaterial({ 
                map: this.powerUpTextures[textureKey] || this.powerUpTextures.magnet, 
                transparent: true,
                side: THREE.DoubleSide
            });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        
        // Add a soft golden ground glow for coins to distinguish from red hazard cones
        if (type === 'coin') {
            const glow = this._createGlowBase(0xffff88); // Golden White
            glow.scale.set(0.8, 0.8, 0.8);
            mesh.add(glow);
            glow.position.y = -y + 0.05;
        }

        this.scene.add(mesh);
        this.items.push({ mesh, type });
    }

    reset() {
        this.obstacles.forEach(obs => this.scene.remove(obs.mesh));
        this.obstacles = [];
        this.items.forEach(item => this.scene.remove(item.mesh));
        this.items = [];
        this.segments.forEach((seg, i) => {
            seg.position.z = i * CONFIG.TRACK_SEGMENT_LENGTH;
        });
    }
}
