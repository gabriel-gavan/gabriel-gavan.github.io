import * as THREE from 'three';
import { CONFIG } from './config.js';
import { LaserGrid } from './LaserGrid.js';
import { CryoVent } from './CryoVent.js';

export class GameMap {
    constructor(scene, facility = null) {
        this.scene = scene;
        this.facility = facility;
        this.walls = [];
        this.wallBoxes = [];
        this.spatialGrid = new Map(); // chamberIndex -> [indices in wallBoxes]
        
        this.barrels = [];
        this.pipes = [];
        this.extinguishers = [];
        this.chambers = [];
        this.doors = [];
        this.terminals = [];
        this.shopTerminals = [];
        this.hazards = [];
        this.ceilingGroups = [];
        this.floor = null;
        
        this.init();
    }

    init() {
        const loader = new THREE.TextureLoader();
        const theme = this.facility || { accent: 0x00ffaa };
        
        // Floor Setup
        this.floorTex = loader.load('https://rosebud.ai/assets/floor_metal_tiles.webp?M8T3');
        this.floorTex.wrapS = this.floorTex.wrapT = THREE.RepeatWrapping;
        this.floorTex.repeat.set(400, 400);

        this.floorMat = new THREE.MeshStandardMaterial({ 
            map: this.floorTex,
            emissive: theme.accent,
            emissiveIntensity: 0.1,
            roughness: 0.4,
            metalness: 0.6
        });
        
        // Localized floor geometry is handled in createChamber
        // Pre-load textures ONCE
        this.wallTexture = loader.load('https://rosebud.ai/assets/wall_server_rack.webp?xds8');
        this.wallTexture.wrapS = this.wallTexture.wrapT = THREE.RepeatWrapping;
        
        this.sharedWallMat = new THREE.MeshStandardMaterial({ 
            map: this.wallTexture, 
            color: theme.accent, 
            metalness: 0.5, 
            roughness: 0.5,
            emissive: theme.accent,
            emissiveIntensity: 0.3
        });
        
        this.ceilingTexture = loader.load('https://rosebud.ai/assets/ceiling_conduit.webp?WX9c');
        this.ceilingTexture.wrapS = this.ceilingTexture.wrapT = THREE.RepeatWrapping;
        
        this.sharedCeilMat = new THREE.MeshStandardMaterial({ 
            map: this.ceilingTexture, 
            color: theme.accent,
            metalness: 0.5, 
            roughness: 0.5, 
            emissive: theme.accent, 
            emissiveIntensity: 0.4,
            side: THREE.FrontSide
        });
        
        this.sharedBeamMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.9, roughness: 0.1 });
        this.terminalTexture = loader.load('https://rosebud.ai/assets/terminal_screen_ui.webp?bzBE');

        // Generation
        const roomSize = CONFIG.MAP.ROOM_SIZE;
        const wallHeight = CONFIG.MAP.WALL_HEIGHT;
        let currentX = 0, currentZ = 0, lastExitDir = null;

        for (let i = 0; i < CONFIG.MAP.NUM_ROOMS; i++) {
            const isBossRoom = (i + 1) % (CONFIG.MAP.BOSS_INTERVAL || 5) === 0;
            const currentRoomSize = isBossRoom ? roomSize * 1.5 : roomSize;
            
            const exits = [];
            if (lastExitDir === 'NORTH') exits.push('SOUTH');
            else if (lastExitDir === 'SOUTH') exits.push('NORTH');
            else if (lastExitDir === 'EAST') exits.push('WEST');
            else if (lastExitDir === 'WEST') exits.push('EAST');

            let nextExitDir = null, nextX = currentX, nextZ = currentZ;
            let cX1 = currentX, cZ1 = currentZ, cX2 = currentX, cZ2 = currentZ;

            if (i < CONFIG.MAP.NUM_ROOMS - 1) {
                const nextRoomSize = (i + 2) % (CONFIG.MAP.BOSS_INTERVAL || 5) === 0 ? roomSize * 1.5 : roomSize;
                const turn = Math.random();

                if (turn < 0.2 && currentX === 0) { // East
                    nextExitDir = 'EAST';
                    nextX = currentX + (currentRoomSize + nextRoomSize) * 0.75;
                    cX1 = currentX + currentRoomSize / 2; cZ1 = currentZ;
                    cX2 = nextX - nextRoomSize / 2; cZ2 = currentZ;
                } else if (turn < 0.4 && currentX === 0) { // West
                    nextExitDir = 'WEST';
                    nextX = currentX - (currentRoomSize + nextRoomSize) * 0.75;
                    cX1 = currentX - currentRoomSize / 2; cZ1 = currentZ;
                    cX2 = nextX + nextRoomSize / 2; cZ2 = currentZ;
                } else { // North
                    nextExitDir = 'NORTH';
                    nextZ = currentZ + (currentRoomSize + nextRoomSize) * 0.75;
                    cX1 = currentX; cZ1 = currentZ + currentRoomSize / 2;
                    cX2 = currentX; cZ2 = nextZ - nextRoomSize / 2;
                }
                exits.push(nextExitDir);
            }

            this.createChamber(currentX, currentZ, currentRoomSize, wallHeight, i, isBossRoom, exits);
            
            if (nextExitDir) {
                if (nextExitDir === 'EAST' || nextExitDir === 'WEST') {
                    this.createCorridor(cX1, cZ1, cX2, cZ2, 4, wallHeight, i, true);
                } else {
                    this.createCorridor(cX1, cZ1, cX2, cZ2, 4, wallHeight, i, false);
                }
                currentX = nextX; currentZ = nextZ; lastExitDir = nextExitDir;
            }
        }
    }

    addWall(wall, chamberIndex) {
        this.walls.push(wall);
        const box = new THREE.Box3().setFromObject(wall);
        this.wallBoxes.push(box);
        const idx = this.walls.length - 1;
        if (chamberIndex !== undefined) {
            if (!this.spatialGrid.has(chamberIndex)) this.spatialGrid.set(chamberIndex, []);
            this.spatialGrid.get(chamberIndex).push(idx);
        }
    }

    destroyObject(obj) {
        if (!obj) return;
        
        // Remove from scene
        if (obj.parent) obj.parent.remove(obj);
        else this.scene.remove(obj);

        // Remove from collision lists
        const wallIdx = this.walls.indexOf(obj);
        if (wallIdx !== -1) {
            this.walls.splice(wallIdx, 1);
            this.wallBoxes.splice(wallIdx, 1);
            
            // Rebuild spatial grid since indices changed
            this.spatialGrid.clear();
            this.walls.forEach((w, i) => {
                const chamberIdx = w.userData.chamberIndex;
                if (chamberIdx !== undefined) {
                    if (!this.spatialGrid.has(chamberIdx)) this.spatialGrid.set(chamberIdx, []);
                    this.spatialGrid.get(chamberIdx).push(i);
                }
            });
        }
    }

    createChamber(x, z, size, height, index, isBossRoom, exits) {
        const half = size / 2;
        const wallDepth = 1.0;
        const gap = 4;
        const seg = (size - gap) / 2;
        const off = gap / 2 + seg / 2;

        const makeWall = (cx, cz, isH, side) => {
            const hasExit = exits.includes(side);
            if (hasExit) {
                const geo = isH ? new THREE.BoxGeometry(seg, height, wallDepth) : new THREE.BoxGeometry(wallDepth, height, seg);
                [-1, 1].forEach(s => {
                    const w = new THREE.Mesh(geo, this.sharedWallMat);
                    w.position.set(isH ? cx + s * off : cx, height / 2, isH ? cz : cz + s * off);
                    this.scene.add(w); this.addWall(w, index);
                });
            } else {
                const geo = isH ? new THREE.BoxGeometry(size, height, wallDepth) : new THREE.BoxGeometry(wallDepth, height, size);
                const w = new THREE.Mesh(geo, this.sharedWallMat);
                w.position.set(cx, height / 2, cz);
                this.scene.add(w); this.addWall(w, index);
            }
        };

        // Airtight Pillars
        const pGeo = new THREE.BoxGeometry(wallDepth + 0.1, height, wallDepth + 0.1);
        [[-half, -half], [half, -half], [-half, half], [half, half]].forEach(c => {
            const p = new THREE.Mesh(pGeo, this.sharedBeamMat);
            p.position.set(x + c[0], height / 2, z + c[1]);
            this.scene.add(p); this.addWall(p, index);
        });

        makeWall(x, z + half, true, 'NORTH');
        makeWall(x, z - half, true, 'SOUTH');
        makeWall(x + half, z, false, 'EAST');
        makeWall(x - half, z, false, 'WEST');

        // Chamber floor specifically for visibility
        const f = new THREE.Mesh(new THREE.BoxGeometry(size, 0.1, size), this.floorMat);
        f.position.set(x, 0.05, z);
        this.scene.add(f);

        this.createComplexCeiling(x, z, size, height, index);
        this.createComplexProps(x, z, size, index);
        
        const isVault = !isBossRoom && index > 0 && Math.random() < CONFIG.MAP.VAULT_CHANCE;
        this.chambers.push({ x, z, size, index, enemiesSpawned: 0, isCleared: false, isBossRoom, isVault });
        
        if (isVault) {
            // Vaults have two terminals that must both be hacked
            this.createTerminal(x + half - 2, z + half - 2, size, index, 'VAULT_1');
            this.createTerminal(x - half + 2, z - half + 2, size, index, 'VAULT_2');
            
            // Vaults have extra loot caches
            for (let i = 0; i < 3; i++) {
                const lx = x + (Math.random() - 0.5) * (size - 8);
                const lz = z + (Math.random() - 0.5) * (size - 8);
                this.createLootCache(lx, lz, index);
            }
        } else {
            this.createTerminal(x + half - 2, z + half - 2, size, index);
        }

        if (index === CONFIG.MAP.NUM_ROOMS - 1) this.createExtractionPortal(x, z);
        if (index > 0 && index % 3 === 0) this.createShopTerminal(x - half + 2, z + half - 2, size, index);
        if (this.facility) this.createEnvironmentalHazards(x, z, size, index);
        
        // Add localized voltage plates
        if (Math.random() < 0.3) {
            let px = x + (Math.random() - 0.5) * (size - 6);
            let pz = z + (Math.random() - 0.5) * (size - 6);
            
            // Keep center clear for player spawn in first chamber
            if (index === 0) {
                while (Math.abs(px) < 4 && Math.abs(pz) < 4) {
                    px = x + (Math.random() - 0.5) * (size - 6);
                    pz = z + (Math.random() - 0.5) * (size - 6);
                }
            }
            this.createVoltagePlate(px, pz, index);
        }
    }

    createVoltagePlate(x, z, index) {
        const g = new THREE.Group();
        const plateGeo = new THREE.BoxGeometry(3, 0.2, 3);
        const plateMat = new THREE.MeshStandardMaterial({ 
            color: 0x222222, 
            emissive: 0x0088ff, 
            emissiveIntensity: 1.0,
            metalness: 0.8,
            roughness: 0.2
        });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        g.add(plate);

        // Caution Hologram (Vertical Beam)
        const beamGeo = new THREE.CylinderGeometry(1.5, 1.5, 4, 16, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.1, 
            side: THREE.DoubleSide 
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = 2;
        g.add(beam);

        const detailGeo = new THREE.PlaneGeometry(2.5, 2.5);
        const detailMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
        const detail = new THREE.Mesh(detailGeo, detailMat);
        detail.rotation.x = -Math.PI / 2;
        detail.position.y = 0.11;
        g.add(detail);

        g.position.set(x, 0.05, z);
        this.scene.add(g);
        
        const hazard = { 
            mesh: plate, 
            group: g,
            beam: beam,
            detail: detail,
            type: 'VOLTAGE', 
            damage: 25, 
            radius: 1.8, 
            pulseTime: Math.random() * 10,
            chamberIndex: index,
            isActive: true,
            update: (dt) => {
                if (!hazard.isActive) {
                    plate.material.emissiveIntensity = 0;
                    detail.material.opacity = 0;
                    beam.visible = false;
                    return;
                }
                hazard.pulseTime += dt * 5;
                const intensity = 0.5 + Math.sin(hazard.pulseTime) * 0.5;
                plate.material.emissiveIntensity = intensity * 3;
                detail.material.opacity = 0.1 + intensity * 0.5;
                beam.material.opacity = 0.05 + intensity * 0.1;
                beam.scale.set(1 + intensity * 0.1, 1, 1 + intensity * 0.1);
            }
        };
        this.hazards.push(hazard);
        
        // Chance to create a switch for this hazard elsewhere in the room
        if (Math.random() < 0.5) {
            const sx = x + (Math.random() > 0.5 ? 4 : -4);
            const sz = z + (Math.random() > 0.5 ? 4 : -4);
            this.createHazardSwitch(sx, sz, hazard);
        }
    }

    createHazardSwitch(x, z, targetHazard) {
        const g = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        const lever = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
        lever.position.y = 0.1;
        lever.position.z = 0.1;
        g.add(base); g.add(lever);
        g.position.set(x, 1, z);
        this.scene.add(g);
        
        const sw = {
            mesh: g,
            lever,
            targetHazard,
            isUsed: false,
            type: 'HAZARD_SWITCH',
            interact: () => {
                sw.isUsed = true;
                sw.lever.rotation.x = Math.PI / 4;
                sw.lever.material.color.set(0x00ff00);
                if (sw.targetHazard) {
                    sw.targetHazard.isActive = false;
                    if (sw.targetHazard.instance && sw.targetHazard.instance.destroy) {
                        sw.targetHazard.instance.destroy();
                    }
                }
            }
        };
        this.terminals.push(sw);
    }

    createCorridor(x1, z1, x2, z2, width, height, chamberIndex, isH) {
        const len = isH ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
        const cX = (x1 + x2) / 2, cZ = (z1 + z2) / 2;
        const theme = this.facility || { accent: 0x00ffaa };

        // Floor and Ceiling (extra overlap to prevent gaps)
        const f = new THREE.Mesh(new THREE.BoxGeometry(isH ? len + 2 : width, 0.1, isH ? width : len + 2), this.floorMat);
        f.position.set(cX, 0.05, cZ);
        this.scene.add(f);

        const c = new THREE.Mesh(new THREE.BoxGeometry(isH ? len + 2 : width + 0.2, 0.1, isH ? width + 0.2 : len + 2), this.sharedCeilMat);
        c.position.set(cX, height - 0.05, cZ);
        this.scene.add(c);
        this.ceilingGroups.push(c);

        // Bulkhead Walls
        const wGeo = isH ? new THREE.BoxGeometry(len, height, 1.0) : new THREE.BoxGeometry(1.0, height, len);
        const w1 = new THREE.Mesh(wGeo, this.sharedWallMat);
        w1.position.set(isH ? cX : cX - width / 2, height / 2, isH ? cZ - width / 2 : cZ);
        this.scene.add(w1); this.addWall(w1, chamberIndex);
        
        const w2 = w1.clone();
        w2.position.set(isH ? cX : cX + width / 2, height / 2, isH ? cZ + width / 2 : cZ);
        this.scene.add(w2); this.addWall(w2, chamberIndex);

        // Runway Lights
        const light = new THREE.PointLight(theme.accent, 15, 20);
        light.position.set(cX, height - 1.5, cZ);
        this.scene.add(light);
        this.walls.push(light);

        this.createDoor(x1, height / 2, z1, width, height, chamberIndex, isH);
    }

    createDoor(x, y, z, width, height, chamberIndex, isH) {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 1, roughness: 0.1, emissive: 0x00ffff, emissiveIntensity: 0.5 });
        const pGeo = isH ? new THREE.BoxGeometry(0.5, height, width / 2) : new THREE.BoxGeometry(width / 2, height, 0.5);
        const pL = new THREE.Mesh(pGeo, mat), pR = pL.clone();
        if (isH) { pL.position.z = -width / 4; pR.position.z = width / 4; } else { pL.position.x = -width / 4; pR.position.x = width / 4; }
        group.add(pL); group.add(pR); group.position.set(x, y, z); this.scene.add(group);
        const door = { mesh: group, pL, pR, boxL: new THREE.Box3(), boxR: new THREE.Box3(), isOpen: false, chamberIndex, width, isH, update: (dt) => {
            const off = door.isOpen ? door.width / 2 : 0;
            if (door.isH) {
                door.pL.position.z = THREE.MathUtils.lerp(door.pL.position.z, -door.width / 4 - off, dt * 2);
                door.pR.position.z = THREE.MathUtils.lerp(door.pR.position.z, door.width / 4 + off, dt * 2);
            } else {
                door.pL.position.x = THREE.MathUtils.lerp(door.pL.position.x, -door.width / 4 - off, dt * 2);
                door.pR.position.x = THREE.MathUtils.lerp(door.pR.position.x, door.width / 4 + off, dt * 2);
            }
            door.boxL.setFromObject(door.pL); door.boxR.setFromObject(door.pR);
        }};
        this.doors.push(door); this.addWall(pL, chamberIndex); this.addWall(pR, chamberIndex);
        door.boxL = this.wallBoxes[this.wallBoxes.length - 2]; door.boxR = this.wallBoxes[this.wallBoxes.length - 1];
    }

    checkCollision(pos, rad = 0.5, chamberIdx = null) {
        const sphere = new THREE.Sphere(pos, rad);
        const list = [];
        if (chamberIdx !== null) {
            [chamberIdx, chamberIdx - 1, chamberIdx + 1].forEach(idx => {
                if (this.spatialGrid.has(idx)) list.push(...this.spatialGrid.get(idx));
            });
        } else {
            for (let i = 0; i < this.wallBoxes.length; i++) list.push(i);
        }
        for (let i of list) { if (this.wallBoxes[i] && this.wallBoxes[i].intersectsSphere(sphere)) return true; }
        return false;
    }

    createComplexCeiling(x, z, size, height, index) {
        const g = new THREE.Group();
        const c = new THREE.Mesh(new THREE.BoxGeometry(size + 2, 0.1, size + 2), this.sharedCeilMat);
        c.position.set(x, height - 0.05, z); g.add(c);
        const n = 5, s = size / (n - 1);
        for (let i = 0; i < n; i++) {
            const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, size), this.sharedBeamMat);
            b1.position.set(x - size / 2 + i * s, height - 0.15, z); g.add(b1);
            if (i % 2 === 0) {
                const b2 = new THREE.Mesh(new THREE.BoxGeometry(size, 0.2, 0.3), this.sharedBeamMat);
                b2.position.set(x, height - 0.1, z - size / 2 + i * s); g.add(b2);
            }
        }
        this.ceilingGroups.push(g); this.scene.add(g);
    }

    createComplexProps(x, z, size, chamberIndex) {
        // 1. Existing Server Racks
        for (let i = 0; i < 4; i++) {
            const r = new THREE.Group();
            const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.5, 0.8), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8 }));
            r.add(b); r.position.set(x + (i % 2 === 0 ? -1 : 1) * (size / 2 - 1.5), 1.75, z + (i - 1.5) * (size / 5));
            r.rotation.y = (i % 2 === 0) ? Math.PI / 2 : -Math.PI / 2;
            b.userData.isDestructible = true; b.userData.health = 50;
            b.userData.chamberIndex = chamberIndex;
            this.scene.add(r); this.addWall(b, chamberIndex);
        }

        // 2. Add Monitors to the walls
        const monitorGeo = new THREE.BoxGeometry(1.2, 0.8, 0.1);
        const monitorMat = new THREE.MeshStandardMaterial({ 
            color: 0x000000, 
            emissive: 0x00ffff, 
            emissiveIntensity: 0.5,
            metalness: 0.9,
            roughness: 0.1
        });
        
        for (let i = 0; i < 3; i++) {
            const m = new THREE.Mesh(monitorGeo, monitorMat.clone());
            const side = Math.random() > 0.5 ? 1 : -1;
            const isX = Math.random() > 0.5;
            
            if (isX) {
                m.position.set(x + side * (size/2 - 0.55), 2 + Math.random(), z + (Math.random() - 0.5) * (size - 4));
                m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            } else {
                m.position.set(x + (Math.random() - 0.5) * (size - 4), 2 + Math.random(), z + side * (size/2 - 0.55));
                m.rotation.y = side > 0 ? Math.PI : 0;
            }
            
            m.userData.isMonitor = true;
            m.userData.isDestructible = true;
            m.userData.health = 10;
            m.userData.chamberIndex = chamberIndex;
            this.scene.add(m);
            this.addWall(m, chamberIndex);
        }

        // 3. Add Ceiling/Wall Pipes
        const pipeGeo = new THREE.CylinderGeometry(0.15, 0.15, size, 8);
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.2 });
        
        for (let i = 0; i < 2; i++) {
            const p = new THREE.Mesh(pipeGeo, pipeMat);
            const isGas = Math.random() < 0.3;
            if (isGas) p.material.color.set(0x00ff00);
            
            const side = Math.random() > 0.5 ? 1 : -1;
            p.position.set(x + (Math.random()-0.5)*size, 4.5, z + side * (size/2 - 1.5));
            p.rotation.z = Math.PI / 2;
            
            p.userData.isPipe = true;
            p.userData.isGasPipe = isGas;
            p.userData.chamberIndex = chamberIndex;
            this.scene.add(p);
            this.addWall(p, chamberIndex);
            this.pipes.push(p);
        }
    }

    createTerminal(x, z, size, chamberIndex, type = 'CHAMBER_UNLOCK') {
        const g = new THREE.Group();
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9 }));
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.1), new THREE.MeshStandardMaterial({ map: this.terminalTexture, emissive: type.startsWith('VAULT') ? 0xff00ff : 0x00ffff, emissiveIntensity: 0.8 }));
        s.position.set(0, 0.3, 0.16); g.add(b); g.add(s); g.position.set(x, 1, z);
        this.scene.add(g); this.terminals.push({ mesh: g, chamberIndex, isUsed: false, light: s, type });
    }

    createLootCache(x, z, chamberIndex) {
        const g = new THREE.Group();
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.1 }));
        const s = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.6), new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 1.0 }));
        s.position.y = 0.41;
        g.add(b); g.add(s);
        g.position.set(x, 0.4, z);
        this.scene.add(g);
        
        // Add to walls for collision
        this.addWall(b, chamberIndex);
        
        // Mark as loot cache
        b.userData.isLootCache = true;
        b.userData.chamberIndex = chamberIndex;
        b.userData.isLocked = true;
        b.userData.light = s;
    }

    createShopTerminal(x, z, size, chamberIndex) {
        const g = new THREE.Group();
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x332211, metalness: 0.9 }));
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.1), new THREE.MeshStandardMaterial({ map: this.terminalTexture, color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 1.2 }));
        s.position.set(0, 0.3, 0.16); g.add(b); g.add(s); g.position.set(x, 1, z);
        this.scene.add(g); this.shopTerminals.push({ mesh: g, chamberIndex, isShop: true, light: s });
    }

    createEnvironmentalHazards(x, z, size, idx) {
        if (!this.facility) return;
        
        // Laser Grids for Meridian and Neon
        if ((this.facility.id === 'meridian' || this.facility.id === 'neon') && Math.random() < CONFIG.MAP.HAZARD_CHANCE) {
            const grid = new LaserGrid(this.scene, { x, z, size }, Math.random() > 0.5);
            this.hazards.push({ 
                type: 'LASER_GRID', 
                instance: grid,
                mesh: grid.mesh,
                position: grid.mesh.position
            });
        }
        
        // Cryo Vents for Cryo-Link
        if (this.facility.id === 'cryo' && Math.random() < 0.5) {
            // Spawn 2-3 vents per room
            const numVents = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < numVents; i++) {
                const vx = x + (Math.random() - 0.5) * (size - 6);
                const vz = z + (Math.random() - 0.5) * (size - 6);
                this.createCryoVent(vx, vz, idx);
            }
        }
    }

    createCryoVent(x, z, index) {
        // We'll need access to particleSystem, but GameMap doesn't have it directly.
        // It's usually passed via GameScene. Let's assume for now.
        // If we don't have it, we'll pass null.
        const vent = new CryoVent(this.scene, new THREE.Vector3(x, 0, z), window.game?.particleSystem);
        this.hazards.push({ 
            type: 'CRYO_VENT', 
            instance: vent,
            mesh: vent.mesh,
            triggerMesh: vent.triggerMesh,
            position: vent.position,
            freeze: () => vent.freeze(),
            chamberIndex: index
        });
    }

    createExtractionPortal(x, z) {
        const g = new THREE.Group();
        const tex = new THREE.TextureLoader().load('https://rosebud.ai/assets/extraction_portal_sprite.webp?OBBJ');
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, color: 0x00ffff }));
        s.scale.set(0.1, 0.1, 0.1); s.position.y = 3; g.add(s);
        const rGeo = new THREE.TorusGeometry(3, 0.05, 16, 100), rMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 2.0, transparent: true, opacity: 0.5 });
        const r1 = new THREE.Mesh(rGeo, rMat); r1.rotation.x = Math.PI / 2; g.add(r1);
        const r2 = r1.clone(); r2.rotation.y = Math.PI / 2; g.add(r2);
        g.position.set(x, 0.5, z); g.visible = false; this.scene.add(g);
        this.extractionPortal = { mesh: g, sprite: s, r1, r2, isActivating: false, targetScale: 6, currentScale: 0.1, update: (dt) => {
            if (!g.visible) return;
            if (this.extractionPortal.isActivating) {
                this.extractionPortal.currentScale = THREE.MathUtils.lerp(this.extractionPortal.currentScale, this.extractionPortal.targetScale, dt * 2);
                s.scale.set(this.extractionPortal.currentScale, this.extractionPortal.currentScale, 1);
                if (Math.abs(this.extractionPortal.currentScale - this.extractionPortal.targetScale) < 0.1) this.extractionPortal.isActivating = false;
            }
            r1.rotation.z += dt * 2; r2.rotation.x += dt * 1.5; s.material.opacity = 0.7 + Math.sin(Date.now() * 0.005) * 0.3;
        }, activate: () => { g.visible = true; this.extractionPortal.isActivating = true; }};
    }

    cleanup() {
        this.walls.forEach(w => { if (w.isLight) this.scene.remove(w); else if (w.parent) w.parent.remove(w); });
        this.ceilingGroups.forEach(cg => this.scene.remove(cg));
        this.doors.forEach(d => this.scene.remove(d.mesh));
        this.terminals.forEach(t => this.scene.remove(t.mesh));
        this.shopTerminals.forEach(t => this.scene.remove(t.mesh));
        this.pipes.forEach(p => this.scene.remove(p));
        this.barrels.forEach(b => this.scene.remove(b));
        this.hazards.forEach(h => { if(h.instance) h.instance.destroy(); else this.scene.remove(h.mesh); });
        if (this.extractionPortal) this.scene.remove(this.extractionPortal.mesh);
        this.walls = []; this.wallBoxes = []; this.spatialGrid.clear(); this.ceilingGroups = []; this.doors = []; this.terminals = []; this.shopTerminals = []; this.pipes = []; this.barrels = []; this.hazards = [];
    }

    getRandomSpawnPoint() {
        const c = this.chambers[Math.floor(Math.random() * this.chambers.length)];
        return new THREE.Vector3(c.x + (Math.random() - 0.5) * (c.size - 4), 0, c.z + (Math.random() - 0.5) * (c.size - 4));
    }
}