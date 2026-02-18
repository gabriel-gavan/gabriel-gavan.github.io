import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Map {
    constructor(scene, facility = null) {
        this.scene = scene;
        this.facility = facility;
        this.walls = [];
        this.barrels = [];
        this.pipes = [];
        this.extinguishers = [];
        this.chambers = [];
        this.doors = [];
        this.terminals = [];
        this.shopTerminals = [];
        this.hazards = [];
        this.ceilingGroups = [];
        this.floor = null; // Track floor specifically
        this.init();
    }

    init() {
        const loader = new THREE.TextureLoader();
        this.floorTex = loader.load('https://rosebud.ai/assets/floor_metal_tiles.webp?M8T3');
        this.floorTex.wrapS = this.floorTex.wrapT = THREE.RepeatWrapping;
        this.floorTex.repeat.set(400, 400);

        const floorGeo = new THREE.PlaneGeometry(2000, 2000);
        this.floorMat = new THREE.MeshStandardMaterial({ 
            map: this.floorTex,
            emissive: 0x001100,
            emissiveIntensity: 0.1,
            roughness: 0.4,
            metalness: 0.6
        });
        
        this.floor = new THREE.Mesh(floorGeo, this.floorMat);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);

        // Pre-load textures ONCE
        this.wallTexture = loader.load('https://rosebud.ai/assets/wall_server_rack.webp?xds8');
        this.wallTexture.wrapS = this.wallTexture.wrapT = THREE.RepeatWrapping;
        this.wallTexture.repeat.set(4, 2); // Default repeat
        
        this.ceilingTexture = loader.load('https://rosebud.ai/assets/ceiling_conduit.webp?WX9c');
        this.ceilingTexture.wrapS = this.ceilingTexture.wrapT = THREE.RepeatWrapping;
        this.ceilingTexture.repeat.set(4, 4);

        // Shared Materials to prevent memory bloat and freezing
        this.sharedWallMat = new THREE.MeshStandardMaterial({ map: this.wallTexture, metalness: 0.6, roughness: 0.4 });
        this.sharedCeilMat = new THREE.MeshStandardMaterial({ map: this.ceilingTexture, metalness: 0.8, roughness: 0.2, emissive: 0x111111, emissiveIntensity: 0.2 });
        this.sharedBeamMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });

        this.terminalTexture = loader.load('https://rosebud.ai/assets/terminal_screen_ui.webp?bzBE');
        this.shopTerminalTexture = loader.load('https://rosebud.ai/assets/terminal_screen_ui.webp?bzBE'); 

        // Generate rooms
        const roomSize = CONFIG.MAP.ROOM_SIZE;
        const wallHeight = CONFIG.MAP.WALL_HEIGHT;

        // Generate rooms (chambers) in a sequence
        let currentX = 0;
        let currentZ = 0;

        for (let i = 0; i < CONFIG.MAP.NUM_ROOMS; i++) {
            const isBossRoom = (i + 1) % (CONFIG.MAP.BOSS_INTERVAL || 5) === 0;
            const currentRoomSize = isBossRoom ? roomSize * 1.5 : roomSize;
            
            this.createChamber(currentX, currentZ, currentRoomSize, wallHeight, i, isBossRoom);
            
            // Connect to next room
            if (i < CONFIG.MAP.NUM_ROOMS - 1) {
                const nextIsBoss = (i + 2) % (CONFIG.MAP.BOSS_INTERVAL || 5) === 0;
                const nextRoomSize = nextIsBoss ? roomSize * 1.5 : roomSize;
                
                // Randomly turn or go straight
                const turnChance = Math.random();
                let nextX = currentX;
                let nextZ = currentZ;
                let corridorX1 = currentX;
                let corridorZ1 = currentZ;
                let corridorX2 = currentX;
                let corridorZ2 = currentZ;

                if (turnChance < 0.2 && currentX === 0) { // Turn Right
                    nextX = currentX + (currentRoomSize + nextRoomSize) * 0.75;
                    corridorX1 = currentX + currentRoomSize * 0.5;
                    corridorZ1 = currentZ;
                    corridorX2 = nextX - nextRoomSize * 0.5;
                    corridorZ2 = currentZ;
                    this.createCorridorHorizontal(corridorX1, corridorZ1, corridorX2, corridorZ2, 4, wallHeight, i);
                } else if (turnChance < 0.4 && currentX === 0) { // Turn Left
                    nextX = currentX - (currentRoomSize + nextRoomSize) * 0.75;
                    corridorX1 = currentX - currentRoomSize * 0.5;
                    corridorZ1 = currentZ;
                    corridorX2 = nextX + nextRoomSize * 0.5;
                    corridorZ2 = currentZ;
                    this.createCorridorHorizontal(corridorX1, corridorZ1, corridorX2, corridorZ2, 4, wallHeight, i);
                } else { // Straight
                    nextZ = currentZ + (currentRoomSize + nextRoomSize) * 0.75;
                    corridorX1 = currentX;
                    corridorZ1 = currentZ + currentRoomSize * 0.5;
                    corridorX2 = currentX;
                    corridorZ2 = nextZ - nextRoomSize * 0.5;
                    this.createCorridorVertical(corridorX1, corridorZ1, corridorX2, corridorZ2, 4, wallHeight, i);
                }

                currentX = nextX;
                currentZ = nextZ;
            }
        }
    }

    cleanup() {
        if (this.floor) {
            this.scene.remove(this.floor);
            this.floor.geometry.dispose();
            this.floor.material.dispose();
        }
        
        this.walls.forEach(w => {
            this.scene.remove(w);
            if (w.geometry) w.geometry.dispose();
            if (w.material) w.material.dispose();
        });

        this.ceilingGroups.forEach(cg => {
            cg.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    if (child.material.dispose) child.material.dispose();
                }
            });
            this.scene.remove(cg);
        });

        this.doors.forEach(d => this.scene.remove(d.mesh));
        this.terminals.forEach(t => this.scene.remove(t.mesh));
        this.shopTerminals.forEach(t => this.scene.remove(t.mesh));
        this.pipes.forEach(p => this.scene.remove(p));
        this.barrels.forEach(b => this.scene.remove(b));
        this.hazards.forEach(h => this.scene.remove(h.mesh));
        
        if (this.extractionPortal) this.scene.remove(this.extractionPortal.mesh);

        this.walls = [];
        this.ceilingGroups = [];
        this.doors = [];
        this.terminals = [];
        this.shopTerminals = [];
        this.pipes = [];
        this.barrels = [];
        this.hazards = [];
    }

    createCorridorHorizontal(x1, z1, x2, z2, width, height, chamberIndex) {
        const wallMat = this.sharedWallMat;
        const floorMat = this.floorMat;
        
        const length = Math.abs(x2 - x1);
        const centerX = (x1 + x2) / 2;

        // Corridor Floor
        const fGeo = new THREE.BoxGeometry(length, 0.1, width);
        const floor = new THREE.Mesh(fGeo, floorMat);
        floor.position.set(centerX, 0.05, z1);
        this.scene.add(floor);

        // Corridor Walls
        const wGeo = new THREE.BoxGeometry(length, height, 0.2);
        const wallF = new THREE.Mesh(wGeo, wallMat);
        wallF.position.set(centerX, height / 2, z1 - width / 2);
        this.scene.add(wallF);
        this.walls.push(wallF);

        const wallB = wallF.clone();
        wallB.position.z = z1 + width / 2;
        this.scene.add(wallB);
        this.walls.push(wallB);

        // Corridor Ceiling - Slightly lower than chambers to avoid overlap
        const cGeo = new THREE.BoxGeometry(length, 0.05, width);
        const ceil = new THREE.Mesh(cGeo, this.sharedCeilMat);
        ceil.position.set(centerX, height - 0.025, z1);
        this.ceilingGroups.push(ceil);
        this.scene.add(ceil);

        // Door
        this.createDoor(x1, height / 2, z1, width, height, chamberIndex, true);
    }

    createCorridorVertical(x1, z1, x2, z2, width, height, chamberIndex) {
        const wallMat = this.sharedWallMat;
        const floorMat = this.floorMat;
        
        const length = Math.abs(z2 - z1);
        const centerZ = (z1 + z2) / 2;

        // Corridor Floor
        const fGeo = new THREE.BoxGeometry(width, 0.1, length);
        const floor = new THREE.Mesh(fGeo, floorMat);
        floor.position.set(x1, 0.05, centerZ);
        this.scene.add(floor);

        // Corridor Walls
        const wGeo = new THREE.BoxGeometry(0.2, height, length);
        const wallL = new THREE.Mesh(wGeo, wallMat);
        wallL.position.set(x1 - width / 2, height / 2, centerZ);
        this.scene.add(wallL);
        this.walls.push(wallL);

        const wallR = wallL.clone();
        wallR.position.x = x1 + width / 2;
        this.scene.add(wallR);
        this.walls.push(wallR);

        // Corridor Ceiling - Slightly lower than chambers
        const cGeo = new THREE.BoxGeometry(width, 0.05, length);
        const ceil = new THREE.Mesh(cGeo, this.sharedCeilMat);
        ceil.position.set(x1, height - 0.025, centerZ);
        this.ceilingGroups.push(ceil);
        this.scene.add(ceil);

        // Door
        this.createDoor(x1, height / 2, z1, width, height, chamberIndex, false);
    }

    createDoor(x, y, z, width, height, chamberIndex, horizontal = false) {
        const doorGroup = new THREE.Group();
        const doorMat = new THREE.MeshStandardMaterial({ 
            color: 0x333333, 
            metalness: 1, 
            roughness: 0.1,
            emissive: 0x00ffff,
            emissiveIntensity: 0.5
        });

        // Two sliding panels
        let panelGeo;
        if (horizontal) {
            panelGeo = new THREE.BoxGeometry(0.4, height, width / 2);
        } else {
            panelGeo = new THREE.BoxGeometry(width / 2, height, 0.4);
        }

        const panelL = new THREE.Mesh(panelGeo, doorMat);
        const panelR = panelL.clone();

        if (horizontal) {
            panelL.position.z = -width / 4;
            panelR.position.z = width / 4;
        } else {
            panelL.position.x = -width / 4;
            panelR.position.x = width / 4;
        }

        doorGroup.add(panelL);
        doorGroup.add(panelR);

        doorGroup.position.set(x, y, z);
        this.scene.add(doorGroup);

        const doorObj = {
            mesh: doorGroup,
            panelL,
            panelR,
            isOpen: false,
            chamberIndex: chamberIndex,
            width: width,
            horizontal: horizontal,
            update: (dt) => {
                const targetOffset = doorObj.isOpen ? doorObj.width / 2 : 0;
                if (doorObj.horizontal) {
                    doorObj.panelL.position.z = THREE.MathUtils.lerp(doorObj.panelL.position.z, -doorObj.width / 4 - targetOffset, dt * 2);
                    doorObj.panelR.position.z = THREE.MathUtils.lerp(doorObj.panelR.position.z, doorObj.width / 4 + targetOffset, dt * 2);
                } else {
                    doorObj.panelL.position.x = THREE.MathUtils.lerp(doorObj.panelL.position.x, -doorObj.width / 4 - targetOffset, dt * 2);
                    doorObj.panelR.position.x = THREE.MathUtils.lerp(doorObj.panelR.position.x, doorObj.width / 4 + targetOffset, dt * 2);
                }
            }
        };

        this.doors.push(doorObj);
        this.walls.push(panelL, panelR);
    }

    createTerminal(x, z, size, chamberIndex) {
        const termGroup = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9 });
        const screenMat = new THREE.MeshStandardMaterial({ 
            map: this.terminalTexture,
            emissive: 0x00ffff, 
            emissiveIntensity: 0.8
        });

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.4), bodyMat);
        termGroup.add(body);

        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.1), screenMat);
        screen.position.set(0, 0.3, 0.16);
        termGroup.add(screen);

        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), bodyMat);
        stand.position.y = -0.9;
        termGroup.add(stand);

        termGroup.position.set(x, 1, z);
        
        // Find chamber to face its center
        const chamber = this.chambers.find(c => c.index === chamberIndex);
        if (chamber) {
            termGroup.lookAt(chamber.x, 1, chamber.z);
        }

        this.scene.add(termGroup);
        
        const terminal = {
            mesh: termGroup,
            chamberIndex: chamberIndex,
            isUsed: false,
            light: screen
        };

        this.terminals.push(terminal);
    }

    createChamber(x, z, size, height, index, isBossRoom) {
        const halfSize = size / 2;
        const doorGap = 4;
        const segmentLen = (size - doorGap) / 2;
        const segmentOffset = doorGap / 2 + segmentLen / 2;

        const wallMat = new THREE.MeshStandardMaterial({ 
            map: this.wallTexture,
            metalness: 0.6,
            roughness: 0.4
        });

        const applyWallRepeat = (tex) => {
            const wallTex = tex.clone();
            wallTex.repeat.set(size / 4, height / 2);
            wallTex.needsUpdate = true;
            // Note: Each segment might need its own material or specific UVs if we want it perfect,
            // but for a boomer shooter, a cloned texture is usually fine.
        };

        if (this.wallTexture.image) {
            applyWallRepeat(this.wallTexture);
        } else {
            this.wallTexture.addEventListener('load', () => applyWallRepeat(this.wallTexture));
        }

        // Create walls with gaps for doors
        const createWallWithGap = (cx, cz, isHorizontal) => {
            const wallGeo = isHorizontal ? 
                new THREE.BoxGeometry(segmentLen, height, 0.5) : 
                new THREE.BoxGeometry(0.5, height, segmentLen);
            
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -1 : 1;
                const wall = new THREE.Mesh(wallGeo, wallMat);
                if (isHorizontal) {
                    wall.position.set(cx + side * segmentOffset, height / 2, cz);
                } else {
                    wall.position.set(cx, height / 2, cz + side * segmentOffset);
                }
                this.scene.add(wall);
                this.walls.push(wall);
            }
        };

        // 4 Walls
        createWallWithGap(x, z + halfSize, true);  // North
        createWallWithGap(x, z - halfSize, true);  // South
        createWallWithGap(x + halfSize, z, false); // East
        createWallWithGap(x - halfSize, z, false); // West

        this.createComplexCeiling(x, z, size, height, index);
        this.createComplexProps(x, z, size);
        this.createPipes(x, z, size, height);

        this.chambers.push({ x, z, size, index, enemiesSpawned: 0, isCleared: false, isBossRoom });

        // Add a terminal to each chamber
        this.createTerminal(x + size/2 - 2, z + size/2 - 2, size, index);

        // Add extraction portal to the final chamber
        if (index === CONFIG.MAP.NUM_ROOMS - 1) {
            this.createExtractionPortal(x, z);
        }

        // Add a shop terminal every 3 chambers
        if (index > 0 && index % 3 === 0) {
            this.createShopTerminal(x - size/2 + 2, z + size/2 - 2, size, index);
        }

        // Environmental Hazards 2.0
        if (this.facility) {
            this.createEnvironmentalHazards(x, z, size, index);
        }
    }

    createExtractionPortal(x, z) {
        const portalGroup = new THREE.Group();
        const texture = new THREE.TextureLoader().load('https://rosebud.ai/assets/extraction_portal_sprite.webp?OBBJ');
        const material = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true,
            color: 0x00ffff // SpriteMaterial uses color instead of emissive
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.1, 0.1, 0.1); // Start small for spawn animation
        sprite.position.y = 3;
        portalGroup.add(sprite);

        // Rotating rings effect
        const ringGeo = new THREE.TorusGeometry(3, 0.05, 16, 100);
        const ringMat = new THREE.MeshStandardMaterial({ 
            color: 0x00ffff, 
            emissive: 0x00ffff, 
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.5
        });
        const ring1 = new THREE.Mesh(ringGeo, ringMat);
        ring1.rotation.x = Math.PI / 2;
        portalGroup.add(ring1);

        const ring2 = ring1.clone();
        ring2.rotation.y = Math.PI / 2;
        portalGroup.add(ring2);

        portalGroup.position.set(x, 0.5, z);
        portalGroup.visible = false; // Initially hidden
        this.scene.add(portalGroup);
        
        this.extractionPortal = {
            mesh: portalGroup,
            sprite: sprite,
            ring1: ring1,
            ring2: ring2,
            isActivating: false,
            targetScale: 6,
            currentScale: 0.1,
            update: (dt) => {
                if (!portalGroup.visible) return;
                
                if (this.extractionPortal.isActivating) {
                    this.extractionPortal.currentScale = THREE.MathUtils.lerp(this.extractionPortal.currentScale, this.extractionPortal.targetScale, dt * 2);
                    sprite.scale.set(this.extractionPortal.currentScale, this.extractionPortal.currentScale, 1);
                    if (Math.abs(this.extractionPortal.currentScale - this.extractionPortal.targetScale) < 0.1) {
                        this.extractionPortal.isActivating = false;
                    }
                }

                ring1.rotation.z += dt * 2;
                ring2.rotation.x += dt * 1.5;
                sprite.material.opacity = 0.7 + Math.sin(Date.now() * 0.005) * 0.3;
            },
            activate: () => {
                portalGroup.visible = true;
                this.extractionPortal.isActivating = true;
            }
        };
    }

    createEnvironmentalHazards(x, z, size, chamberIndex) {
        if (!this.facility) return;

        // Obsidian Vault: High-Voltage Floor Panels
        if (this.facility.id === 'obsidian' && Math.random() > 0.4) {
            const numPanels = 1 + Math.floor(Math.random() * 3);
            for (let i = 0; i < numPanels; i++) {
                const px = x + (Math.random() - 0.5) * (size - 8);
                const pz = z + (Math.random() - 0.5) * (size - 8);
                const panelGeo = new THREE.PlaneGeometry(3, 3);
                const panelMat = new THREE.MeshStandardMaterial({ 
                    color: 0x333333,
                    emissive: 0xffaa00,
                    emissiveIntensity: 0.5,
                    metalness: 0.8
                });
                const panel = new THREE.Mesh(panelGeo, panelMat);
                panel.rotation.x = -Math.PI / 2;
                panel.position.set(px, 0.11, pz);
                this.scene.add(panel);
                
                // Hazard object for GameScene to track
                this.hazards.push({
                    type: 'VOLTAGE',
                    mesh: panel,
                    radius: 1.5,
                    damage: 15,
                    lastTick: 0,
                    pulseTime: Math.random() * Math.PI * 2
                });

                // Add some detail to the panel (striped borders)
                const border = new THREE.Mesh(
                    new THREE.PlaneGeometry(3.2, 3.2),
                    new THREE.MeshBasicMaterial({ color: 0xffff00 })
                );
                border.rotation.x = -Math.PI / 2;
                border.position.set(px, 0.1, pz);
                this.scene.add(border);
            }
        }

        // Cryo-Link: Coolant Leaks (Slow player)
        if (this.facility.id === 'cryo' && Math.random() > 0.4) {
            const px = x + (Math.random() - 0.5) * (size - 8);
            const pz = z + (Math.random() - 0.5) * (size - 8);
            
            // Visual for the leak (puddle/mist)
            const leakGeo = new THREE.CircleGeometry(4, 16);
            const leakMat = new THREE.MeshStandardMaterial({ 
                color: 0x00ffff, 
                transparent: true, 
                opacity: 0.4,
                emissive: 0x00ffff,
                emissiveIntensity: 0.5
            });
            const leak = new THREE.Mesh(leakGeo, leakMat);
            leak.rotation.x = -Math.PI / 2;
            leak.position.set(px, 0.11, pz);
            this.scene.add(leak);

            this.hazards.push({
                type: 'CRYO',
                mesh: leak,
                radius: 4,
                slowFactor: 0.4,
                pulseTime: Math.random() * Math.PI * 2
            });
        }
    }

    createShopTerminal(x, z, size, chamberIndex) {
        const termGroup = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x332211, metalness: 0.9 }); // Darker bronzy color
        const screenMat = new THREE.MeshStandardMaterial({ 
            map: this.shopTerminalTexture,
            color: 0xffaa00, // Tint it orange
            emissive: 0xffaa00, 
            emissiveIntensity: 1.2
        });

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.4), bodyMat);
        termGroup.add(body);

        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.1), screenMat);
        screen.position.set(0, 0.3, 0.16);
        termGroup.add(screen);

        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), bodyMat);
        stand.position.y = -0.9;
        termGroup.add(stand);

        termGroup.position.set(x, 1, z);
        
        const chamber = this.chambers.find(c => c.index === chamberIndex);
        if (chamber) {
            termGroup.lookAt(chamber.x, 1, chamber.z);
        }

        this.scene.add(termGroup);
        
        const terminal = {
            mesh: termGroup,
            chamberIndex: chamberIndex,
            isShop: true,
            light: screen
        };

        this.shopTerminals.push(terminal);
    }

    createComplexCeiling(x, z, size, height, index) {
        const ceilingGroup = new THREE.Group();
        
        // Main ceiling base - use Shared material to prevent memory leaks and freezing
        const ceilGeo = new THREE.BoxGeometry(size, 0.1, size);
        const ceil = new THREE.Mesh(ceilGeo, this.sharedCeilMat);
        // Positioned at height + 0.05 so it is vertically separated from corridor ceilings
        ceil.position.set(x, height + 0.05, z);
        ceilingGroup.add(ceil);

        // Structural Support Beams - Use Shared material
        const numBeams = 5;
        const spacing = size / (numBeams - 1);
        for (let i = 0; i < numBeams; i++) {
            // Longitudinal beams
            const lBeam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, size), this.sharedBeamMat);
            lBeam.position.set(x - size / 2 + i * spacing, height - 0.15, z);
            ceilingGroup.add(lBeam);

            // Transverse beams (fewer)
            if (i % 2 === 0) {
                const tBeam = new THREE.Mesh(new THREE.BoxGeometry(size, 0.2, 0.3), this.sharedBeamMat);
                tBeam.position.set(x, height - 0.1, z - size / 2 + i * spacing);
                ceilingGroup.add(tBeam);
            }
        }

        // Industrial Ventilation Ducts - Make them narrower and slightly higher
        const ductMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9, roughness: 0.2 });
        const duct = new THREE.Mesh(new THREE.BoxGeometry(size * 0.9, 0.4, 0.8), ductMat);
        // Positioned so it doesn't overlap the lights which are at x +/- 0.25*size
        duct.position.set(x, height - 0.2, z + (Math.random() - 0.5) * size * 0.2);
        ceilingGroup.add(duct);

        // Hanging Data Cables
        const cableMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
        for (let i = 0; i < 8; i++) {
            const length = 0.5 + Math.random() * 1.5;
            const cableGeo = new THREE.CylinderGeometry(0.02, 0.02, length, 6);
            const cable = new THREE.Mesh(cableGeo, cableMat);
            const cx = x + (Math.random() - 0.5) * size * 0.8;
            const cz = z + (Math.random() - 0.5) * size * 0.8;
            cable.position.set(cx, height - length / 2, cz);
            cable.rotation.z = (Math.random() - 0.5) * 0.3;
            cable.rotation.x = (Math.random() - 0.5) * 0.3;
            ceilingGroup.add(cable);

            if (Math.random() > 0.5) {
                const hub = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), cableMat);
                hub.position.set(0, -length / 2, 0);
                cable.add(hub);
                
                const led = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
                led.position.set(0, -0.08, 0.08);
                led.rotation.x = Math.PI / 2;
                hub.add(led);
            }
        }

        // Recessed Environmental Lighting
        const lightColor = index % 2 === 0 ? 0x00ffaa : 0x00aaff;
        const lightMat = new THREE.MeshStandardMaterial({
            color: lightColor,
            emissive: lightColor,
            emissiveIntensity: 2
        });
        const lightGeo = new THREE.BoxGeometry(2, 0.05, 0.5);
        for (let i = 0; i < 2; i++) {
            const l1 = new THREE.Mesh(lightGeo, lightMat);
            // Lowered slightly to be clearly visible and below structural elements
            l1.position.set(x - size * 0.25, height - 0.03, z + (i - 0.5) * size * 0.4);
            ceilingGroup.add(l1);

            const l2 = l1.clone();
            l2.position.x = x + size * 0.25;
            ceilingGroup.add(l2);
        }

        this.ceilingGroups.push(ceilingGroup);
        this.scene.add(ceilingGroup);
    }

    createComplexProps(x, z, size) {
        // Server Racks (Destructible cover)
        const rackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8 });
        const ledMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        
        for (let i = 0; i < 4; i++) {
            const rack = new THREE.Group();
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.5, 0.8), rackMat);
            rack.add(body);
            
            for (let row = 0; row < 10; row++) {
                const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), ledMat);
                led.position.set(-0.6 + Math.random() * 1.2, -1.5 + row * 0.3, 0.41);
                rack.add(led);
            }
            
            // Random positions along walls
            const side = i % 2 === 0 ? -1 : 1;
            rack.position.set(x + side * (size / 2 - 1.5), 1.75, z + (i - 1.5) * (size / 5));
            rack.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
            
            body.userData.isDestructible = true;
            body.userData.health = 50;
            body.userData.isServerRack = true;
            
            this.scene.add(rack);
            this.walls.push(body);
        }

        // Add some explosive barrels too
        const numBarrels = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numBarrels; i++) {
            const barrel = this.createBarrel(
                x + (Math.random() - 0.5) * (size - 6),
                0.5,
                z + (Math.random() - 0.5) * (size - 6)
            );
            this.barrels.push(barrel);
        }
    }

    createBarrel(x, y, z) {
        const geo = new THREE.CylinderGeometry(0.4, 0.4, 1, 12);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0xcc3300, 
            emissive: 0x441100, 
            metalness: 0.7 
        });
        const barrel = new THREE.Mesh(geo, mat);
        barrel.position.set(x, y, z);
        barrel.userData.isBarrel = true;
        barrel.userData.health = 20;
        this.scene.add(barrel);
        this.walls.push(barrel);
        return barrel;
    }

    createPipes(x, z, size, height) {
        const pipeMat = new THREE.MeshStandardMaterial({ 
            color: 0x888888, 
            metalness: 0.8, 
            roughness: 0.2 
        });
        const halfSize = size / 2;

        const numPipes = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numPipes; i++) {
            const side = Math.floor(Math.random() * 4);
            const pipeGeo = new THREE.CylinderGeometry(0.15, 0.15, size - 2, 8);
            const pipe = new THREE.Mesh(pipeGeo, pipeMat);
            
            let pX = x, pZ = z, pY = 1 + Math.random() * (height - 2);
            let rot = [0, 0, 0];

            switch(side) {
                case 0: pX += halfSize - 0.3; rot = [Math.PI / 2, 0, 0]; break;
                case 1: pX -= halfSize - 0.3; rot = [Math.PI / 2, 0, 0]; break;
                case 2: pZ += halfSize - 0.3; rot = [0, 0, Math.PI / 2]; break;
                case 3: pZ -= halfSize - 0.3; rot = [0, 0, Math.PI / 2]; break;
            }

            pipe.position.set(pX, pY, pZ);
            pipe.rotation.set(...rot);
            pipe.userData.isPipe = true;
            pipe.userData.isGasTriggered = false;
            
            this.scene.add(pipe);
            this.walls.push(pipe);
            this.pipes.push(pipe);
        }
    }

    destroyObject(obj) {
        // If part of a group (like server racks), remove the group
        const target = obj.parent && obj.parent.type === 'Group' ? obj.parent : obj;

        const wallIndex = this.walls.indexOf(obj);
        if (wallIndex > -1) {
            this.walls.splice(wallIndex, 1);
        }
        
        const barrelIndex = this.barrels.indexOf(obj);
        if (barrelIndex > -1) {
            this.barrels.splice(barrelIndex, 1);
        }

        const extIndex = this.extinguishers.indexOf(obj);
        if (extIndex > -1) {
            this.extinguishers.splice(extIndex, 1);
        }
        
        this.scene.remove(target);
    }

    checkCollision(position, radius = 0.5) {
        // Simple bounding box check for walls
        for (const wall of this.walls) {
            const box = new THREE.Box3().setFromObject(wall);
            const sphere = new THREE.Sphere(position, radius);
            if (box.intersectsSphere(sphere)) {
                return true;
            }
        }
        return false;
    }

    getRandomSpawnPoint() {
        const chamber = this.chambers[Math.floor(Math.random() * this.chambers.length)];
        return new THREE.Vector3(
            chamber.x + (Math.random() - 0.5) * (chamber.size - 4),
            0,
            chamber.z + (Math.random() - 0.5) * (chamber.size - 4)
        );
    }
}
