import * as THREE from 'three';
import { CONFIG } from './config.js';
import { LaserGrid } from './LaserGrid.js';
import { CryoVent } from './CryoVent.js';
import { DestructibleProp } from './DestructibleProp.js';
import { DataTerminal } from './DataTerminal.js';
import { LORE_DATA } from './LoreData.js';

import { NeuralDisruptor } from './NeuralDisruptor.js';

export class GameMap {
    constructor(scene, facility = null, particleSystem = null) {
        this.scene = scene;
        this.facility = facility;
        this.particleSystem = particleSystem;
        
        this.mapGroup = new THREE.Group();
        this.scene.add(this.mapGroup);
        
        this.walls = [];
        this.wallBoxes = [];
        this.spatialGrid = new Map(); // chamberIndex -> [indices in wallBoxes]
        this.globalWallIndices = []; // For walls not in any chamber
        this.corridorBounds = []; // For fast corridor lookup
        
        this.floors = [];
        this.corridorFloors = [];
        this.pillarIndexToChamber = [];
        this.pillarMatrices = [];

        // Fast Chamber Lookup Grid
        this.chamberLookupGrid = new Map();
        this.chamberLookupCellSize = 20;

        // Instancing
        this.pillarInstances = null;
        this.pillarCount = 0;
        this.pillarData = []; // keep track of each pillar matrix and chamber for fast culling
        this.maxPillars = (CONFIG.MAP.NUM_ROOMS + 10) * 4; // Estimate
        
        this.barrels = [];
        this.pipes = [];
        this.extinguishers = [];
        this.chambers = [];
        this.doors = [];
        this.terminals = [];
        this.shopTerminals = [];
        this.dataTerminals = [];
        this.hazards = [];
        this.destructibleProps = [];
        this.ceilingGroups = [];
        this.lights = []; // New array to track dynamic lights
        this.floor = null;
        
        this.spawnedLoreIndices = new Set();
        
        this.init();
    }

    _registerChamber(chamber) {
        const half = chamber.size / 2 + 5; 
        const minX = Math.floor((chamber.x - half) / this.chamberLookupCellSize);
        const maxX = Math.floor((chamber.x + half) / this.chamberLookupCellSize);
        const minZ = Math.floor((chamber.z - half) / this.chamberLookupCellSize);
        const maxZ = Math.floor((chamber.z + half) / this.chamberLookupCellSize);

        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                const key = `${x},${z}`;
                if (!this.chamberLookupGrid.has(key)) this.chamberLookupGrid.set(key, []);
                this.chamberLookupGrid.get(key).push({ type: 'CHAMBER', data: chamber });
            }
        }
    }

    _registerCorridor(corridor) {
        const minX = Math.floor((corridor.x - corridor.hw) / this.chamberLookupCellSize);
        const maxX = Math.floor((corridor.x + corridor.hw) / this.chamberLookupCellSize);
        const minZ = Math.floor((corridor.z - corridor.hd) / this.chamberLookupCellSize);
        const maxZ = Math.floor((corridor.z + corridor.hd) / this.chamberLookupCellSize);

        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                const key = `${x},${z}`;
                if (!this.chamberLookupGrid.has(key)) this.chamberLookupGrid.set(key, []);
                this.chamberLookupGrid.get(key).push({ type: 'CORRIDOR', data: corridor });
            }
        }
    }

    init() {
        // This is now handled by the async generation flow
    }

    async generate(onProgress) {
        const loader = new THREE.TextureLoader();
        const theme = this.facility || { accent: 0x00d0ff };
        
        const loadTextureAsync = (url) => new Promise((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
        });
        
        if (onProgress) onProgress(0.05);
        
        const [floorTex, wallTex, ceilingTex, terminalTex] = await Promise.all([
            loadTextureAsync('https://rosebud.ai/assets/floor_metal_tiles.webp?M8T3'),
            loadTextureAsync(theme.wallTexture || 'https://rosebud.ai/assets/scifi_wall_paneled_metal.webp.webp?bMd0'),
            loadTextureAsync('https://rosebud.ai/assets/ceiling_conduit.webp?WX9c'),
            loadTextureAsync('https://rosebud.ai/assets/terminal_screen_ui.webp?bzBE')
        ]);
        
        this.floorTex = floorTex;
        this.floorTex.wrapS = this.floorTex.wrapT = THREE.RepeatWrapping;
        this.floorTex.repeat.set(400, 400);

        this.floorMat = new THREE.MeshStandardMaterial({ 
            map: this.floorTex,
            color: 0xffffff,
            roughness: 0.4,
            metalness: 0.6
        });
        
        this.wallTexture = wallTex;
        this.wallTexture.wrapS = this.wallTexture.wrapT = THREE.RepeatWrapping;
        
        this.sharedWallMat = new THREE.MeshStandardMaterial({ 
            map: this.wallTexture, 
            color: 0xffffff,
            metalness: 0.5, 
            roughness: 0.5
        });
        
        this.ceilingTexture = ceilingTex;
        this.ceilingTexture.wrapS = this.ceilingTexture.wrapT = THREE.RepeatWrapping;
        
        this.sharedCeilMat = new THREE.MeshStandardMaterial({ 
            map: this.ceilingTexture, 
            color: 0xffffff,
            metalness: 0.5, 
            roughness: 0.5, 
            side: THREE.FrontSide
        });
        
        this.sharedBeamMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.9, roughness: 0.1 });
        this.terminalTexture = terminalTex;
        
        if (onProgress) onProgress(0.10);

        const fastMode = !!CONFIG.MAP.FAST_MODE;
        const totalRooms = CONFIG.MAP.NUM_ROOMS;
        const effectiveRooms = fastMode ? Math.min(totalRooms, 18) : totalRooms;

        const roomSize = CONFIG.MAP.ROOM_SIZE;
        const wallHeight = CONFIG.MAP.WALL_HEIGHT;
        const wallDepth = 1.0;

        const pillarHeight = wallHeight;
        const pillarDepth = wallDepth + 0.1; 
        this.pillarGeo = new THREE.BoxGeometry(pillarDepth, pillarHeight, pillarDepth);
        this.pillarInstances = new THREE.InstancedMesh(this.pillarGeo, this.sharedBeamMat, this.maxPillars);
        this.pillarInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage); 
        this.mapGroup.add(this.pillarInstances);
        this.pillarCount = 0;

        let currentX = 0, currentZ = 0, lastExitDir = null;
        const progressRange = 0.89;
        const roomProgressWeight = fastMode ? 0.82 : progressRange;
        const roomProgressBase = 0.10;
        const finalizationStart = roomProgressBase + roomProgressWeight;

        for (let i = 0; i < effectiveRooms; i++) {
            const isBossRoom = (i + 1) % (CONFIG.MAP.BOSS_INTERVAL || 5) === 0;
            const isFinalRoom = i === effectiveRooms - 1;
            const currentRoomSize = isFinalRoom ? roomSize * 2.5 : (isBossRoom ? roomSize * 1.5 : roomSize);
            
            const exits = [];
            if (lastExitDir === 'NORTH') exits.push('SOUTH');
            else if (lastExitDir === 'SOUTH') exits.push('NORTH');
            else if (lastExitDir === 'EAST') exits.push('WEST');
            else if (lastExitDir === 'WEST') exits.push('EAST');

            let nextExitDir = null, nextX = currentX, nextZ = currentZ;
            let cX1 = currentX, cZ1 = currentZ, cX2 = currentX, cZ2 = currentZ;

            if (i < effectiveRooms - 1) {
                const nextRoomIndex = i + 1;
                const nextIsBoss = (nextRoomIndex + 1) % (CONFIG.MAP.BOSS_INTERVAL || 5) === 0;
                const nextIsFinal = nextRoomIndex === effectiveRooms - 1;
                const nextRoomSize = nextIsFinal ? roomSize * 2.5 : (nextIsBoss ? roomSize * 1.5 : roomSize);
                const turn = Math.random();

                if (turn < 0.2 && currentX === 0) {
                    nextExitDir = 'EAST';
                    nextX = currentX + (currentRoomSize + nextRoomSize) * 0.75;
                    cX1 = currentX + currentRoomSize / 2; cZ1 = currentZ;
                    cX2 = nextX - nextRoomSize / 2; cZ2 = currentZ;
                } else if (turn < 0.4 && currentX === 0) {
                    nextExitDir = 'WEST';
                    nextX = currentX - (currentRoomSize + nextRoomSize) * 0.75;
                    cX1 = currentX - currentRoomSize / 2; cZ1 = currentZ;
                    cX2 = nextX + nextRoomSize / 2; cZ2 = currentZ;
                } else {
                    nextExitDir = 'NORTH';
                    nextZ = currentZ + (currentRoomSize + nextRoomSize) * 0.75;
                    cX1 = currentX; cZ1 = currentZ + currentRoomSize / 2;
                    cX2 = currentX; cZ2 = nextZ - nextRoomSize / 2;
                }
                exits.push(nextExitDir);
            }

            if (isFinalRoom) {
                this.createTitanArena(currentX, currentZ, currentRoomSize, wallHeight, i, exits);
            } else {
                this.createChamber(currentX, currentZ, currentRoomSize, wallHeight, i, isBossRoom, exits);
            }
            
            if (nextExitDir) {
                if (nextExitDir === 'EAST' || nextExitDir === 'WEST') {
                    this.createCorridor(cX1, cZ1, cX2, cZ2, 4, wallHeight, i, true);
                } else {
                    this.createCorridor(cX1, cZ1, cX2, cZ2, 4, wallHeight, i, false);
                }
                currentX = nextX; currentZ = nextZ; lastExitDir = nextExitDir;
            }

            if (onProgress) onProgress(roomProgressBase + ((i + 1) / effectiveRooms) * roomProgressWeight);
            await new Promise(resolve => requestAnimationFrame(resolve));
        }

        if (fastMode && effectiveRooms < totalRooms) {
            CONFIG.MAP.NUM_ROOMS = effectiveRooms;
        }

        if (onProgress) onProgress(finalizationStart);
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (onProgress) onProgress(1.0);

    }

    addPillar(x, y, z, chamberIndex) {
        if (!this.pillarInstances || this.pillarCount >= this.maxPillars) return;

        const matrix = new THREE.Matrix4();
        matrix.setPosition(x, y, z);
        this.pillarInstances.setMatrixAt(this.pillarCount, matrix);
        
        const box = new THREE.Box3();
        const p = this.pillarGeo.parameters;
        const size = new THREE.Vector3(p.width, p.height, p.depth);
        box.setFromCenterAndSize(new THREE.Vector3(x, y, z), size);
        
        this.wallBoxes.push(box);
        this.walls.push({ position: new THREE.Vector3(x, y, z), isInstanced: true });

        const idx = this.walls.length - 1;
        if (chamberIndex !== undefined) {
            if (!this.spatialGrid.has(chamberIndex)) this.spatialGrid.set(chamberIndex, []);
            this.spatialGrid.get(chamberIndex).push(idx);
        }

        this.pillarData.push({ matrix: matrix.clone(), chamberIndex });

        this.pillarCount++;
        if (this.pillarInstances) {
            this.pillarInstances.count = this.pillarCount;
            this.pillarInstances.setMatrixAt(this.pillarCount - 1, matrix);
            this.pillarInstances.instanceMatrix.needsUpdate = true;
        }
    }

    addWall(wall, chamberIndex) {
        this.walls.push(wall);
        
        const box = new THREE.Box3();
        if (wall.geometry && wall.geometry.parameters) {
            const p = wall.geometry.parameters;
            const size = new THREE.Vector3(p.width || 1, p.height || 1, p.depth || 1);
            box.setFromCenterAndSize(wall.position, size);
        } else if (wall.userData && wall.userData.isDestructible) {
            const type = wall.userData.parentProp.type;
            const size = type === 'SERVER_RACK' ? new THREE.Vector3(1.2, 3.2, 0.8) : new THREE.Vector3(1, 1.2, 0.5);
            box.setFromCenterAndSize(wall.getWorldPosition(new THREE.Vector3()), size);
        } else {
            box.setFromObject(wall);
        }
        
        this.wallBoxes.push(box);
        const idx = this.walls.length - 1;
        if (chamberIndex !== undefined && chamberIndex !== null) {
            if (!this.spatialGrid.has(chamberIndex)) this.spatialGrid.set(chamberIndex, []);
            this.spatialGrid.get(chamberIndex).push(idx);
        } else {
            this.globalWallIndices.push(idx);
        }
    }

    destroyObject(obj) {
        if (!obj) return;
        
        if (obj.parent) obj.parent.remove(obj);
        else this.scene.remove(obj);
        
        this.disposeObject(obj);

        const wallIdx = this.walls.indexOf(obj);
        if (wallIdx !== -1) {
            this.walls.splice(wallIdx, 1);
            this.wallBoxes.splice(wallIdx, 1);
            
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

    createTitanArena(x, z, size, height, index, exits) {
        const half = size / 2;
        const wallDepth = 1.0;
        const gap = 4;
        const seg = (size - gap) / 2;
        const off = gap / 2 + seg / 2;
        if (!this._wallGeoCache) this._wallGeoCache = {};
        if (!this._arenaGeoCache) this._arenaGeoCache = {};
        const getWallGeo = (w, h, d) => {
            const key = `${w}_${h}_${d}`;
            if (!this._wallGeoCache[key]) this._wallGeoCache[key] = new THREE.BoxGeometry(w, h, d);
            return this._wallGeoCache[key];
        };
        const getArenaGeo = (k, factory) => {
            if (!this._arenaGeoCache[k]) this._arenaGeoCache[k] = factory();
            return this._arenaGeoCache[k];
        };

        const makeWall = (cx, cz, isH, side) => {
            const hasExit = exits.includes(side);
            if (hasExit) {
                const geo = isH ? getWallGeo(seg, height * 2, wallDepth) : getWallGeo(wallDepth, height * 2, seg);
                [-1, 1].forEach(s => {
                    const w = new THREE.Mesh(geo, this.sharedWallMat);
                    w.position.set(isH ? cx + s * off : cx, height, isH ? cz : cz + s * off);
                    w.userData.chamberIndex = index;
                    this.scene.add(w); this.addWall(w, index);
                });
            } else {
                const geo = isH ? getWallGeo(size, height * 2, wallDepth) : getWallGeo(wallDepth, height * 2, size);
                const w = new THREE.Mesh(geo, this.sharedWallMat);
                w.position.set(cx, height, cz);
                w.userData.chamberIndex = index;
                this.scene.add(w); this.addWall(w, index);
            }
        };

        const pGeo = getWallGeo(wallDepth + 0.5, height * 2.5, wallDepth + 0.5);
        [[-half, -half], [half, -half], [-half, half], [half, half]].forEach(c => {
            const p = new THREE.Mesh(pGeo, this.sharedBeamMat);
            p.position.set(x + c[0], height, z + c[1]);
            p.userData.chamberIndex = index;
            this.scene.add(p); this.addWall(p, index);
        });

        makeWall(x, z + half, true, 'NORTH');
        makeWall(x, z - half, true, 'SOUTH');
        makeWall(x + half, z, false, 'EAST');
        makeWall(x - half, z, false, 'WEST');

        const f = new THREE.Mesh(getArenaGeo(`arena_floor_${size}`, () => new THREE.BoxGeometry(size, 0.2, size)), this.floorMat);
        f.position.set(x, 0.1, z);
        f.userData.chamberIndex = index;
        this.scene.add(f);
        this.floors.push(f);

        const torusGeo = getArenaGeo(`arena_torus_${size}`, () => new THREE.TorusGeometry(size * 0.35, 1.5, 16, 32));
        const torusMat = getArenaGeo('arena_torus_mat', () => new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 }));
        const ring = new THREE.Mesh(torusGeo, torusMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, 0.5, z);
        ring.userData.chamberIndex = index;
        this.scene.add(ring);
        this.addWall(ring, index);

        const platGeo = getArenaGeo('arena_platform_geo', () => new THREE.BoxGeometry(6, 0.5, 6));
        const platMat = getArenaGeo('arena_platform_mat', () => new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, emissive: 0x000000, emissiveIntensity: 0 }));
        const pilGeo = getArenaGeo('arena_pillar_geo', () => new THREE.CylinderGeometry(1, 1, 2.5));
        const platOff = size * 0.3;
        [[-platOff, -platOff], [platOff, -platOff], [-platOff, platOff], [platOff, platOff]].forEach(pPos => {
            const p = new THREE.Mesh(platGeo, platMat);
            p.position.set(x + pPos[0], 2.5, z + pPos[1]);
            p.userData.chamberIndex = index;
            this.scene.add(p);
            this.addWall(p, index);
            
            const pil = new THREE.Mesh(pilGeo, this.sharedBeamMat);
            pil.position.set(x + pPos[0], 1.25, z + pPos[1]);
            pil.userData.chamberIndex = index;
            this.scene.add(pil);
            this.addWall(pil, index);
        });

        this.createComplexCeiling(x, z, size, height * 2, index);
        
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const rx = x + Math.cos(angle) * (size * 0.45);
            const rz = z + Math.sin(angle) * (size * 0.45);
            
            const spike = new THREE.Mesh(getArenaGeo('arena_spike_geo', () => new THREE.ConeGeometry(0.5, 4, 4)), this.sharedBeamMat);
            spike.position.set(rx, 2, rz);
            spike.rotation.x = Math.PI;
            spike.userData.chamberIndex = index;
            this.scene.add(spike);
            this.addWall(spike, index);
        }

        const chamber = { x, z, size, index, enemiesSpawned: 0, isCleared: false, isTerminalBreached: false, isBossRoom: true, isTitanRoom: true };
        this.chambers.push(chamber);
        this._registerChamber(chamber);
        
        this.createExtractionPortal(x, z);
        
        const titanLight = new THREE.PointLight(0xffffff, 20, 50);
        titanLight.position.set(x, height * 1.5, z);
        titanLight.userData.chamberIndex = index;
        this.scene.add(titanLight);
        this.lights.push(titanLight);
    }

    createChamber(x, z, size, height, index, isBossRoom, exits) {
        const half = size / 2;
        const wallDepth = 1.0;
        const gap = 4;
        const seg = (size - gap) / 2;
        const off = gap / 2 + seg / 2;

        if (!this._wallGeoCache) this._wallGeoCache = {};
        const getWallGeo = (w, h, d) => {
            const key = `${w}_${h}_${d}`;
            if (!this._wallGeoCache[key]) this._wallGeoCache[key] = new THREE.BoxGeometry(w, h, d);
            return this._wallGeoCache[key];
        };

        const makeWall = (cx, cz, isH, side) => {
            const hasExit = exits.includes(side);
            if (hasExit) {
                const geo = isH ? getWallGeo(seg, height, wallDepth) : getWallGeo(wallDepth, height, seg);
                [-1, 1].forEach(s => {
                    const w = new THREE.Mesh(geo, this.sharedWallMat);
                    w.position.set(isH ? cx + s * off : cx, height / 2, isH ? cz : cz + s * off);
                    w.userData.chamberIndex = index;
                    this.scene.add(w); this.addWall(w, index);
                });
            } else {
                const geo = isH ? getWallGeo(size, height, wallDepth) : getWallGeo(wallDepth, height, size);
                const w = new THREE.Mesh(geo, this.sharedWallMat);
                w.position.set(cx, height / 2, cz);
                w.userData.chamberIndex = index;
                this.scene.add(w); this.addWall(w, index);
            }
        };

        const pGeo = getWallGeo(wallDepth + 0.1, height, wallDepth + 0.1);
        [[-half, -half], [half, -half], [-half, half], [half, half]].forEach(c => {
            const p = new THREE.Mesh(pGeo, this.sharedBeamMat);
            p.position.set(x + c[0], height / 2, z + c[1]);
            p.userData.chamberIndex = index;
            this.scene.add(p); this.addWall(p, index);
        });

        makeWall(x, z + half, true, 'NORTH');
        makeWall(x, z - half, true, 'SOUTH');
        makeWall(x + half, z, false, 'EAST');
        makeWall(x - half, z, false, 'WEST');

        const floorGeo = getWallGeo(size, 0.1, size);
        const f = new THREE.Mesh(floorGeo, this.floorMat);
        f.position.set(x, 0.05, z);
        f.userData.chamberIndex = index;
        this.scene.add(f);
        this.floors.push(f);

        this.createComplexCeiling(x, z, size, height, index);
        this.createComplexProps(x, z, size, index);
        
        const isVault = !isBossRoom && index > 0 && Math.random() < CONFIG.MAP.VAULT_CHANCE;
        const chamber = { x, z, size, index, enemiesSpawned: 0, isCleared: false, isTerminalBreached: false, isBossRoom, isVault };
        this.chambers.push(chamber);
        this._registerChamber(chamber);
        
        if (isVault) {
            this.createTerminal(x + half - 2, z + half - 2, size, index, 'VAULT_1');
            this.createTerminal(x - half + 2, z - half + 2, size, index, 'VAULT_2');
            
            for (let i = 0; i < 3; i++) {
                const lx = x + (Math.random() - 0.5) * (size - 8);
                const lz = z + (Math.random() - 0.5) * (size - 8);
                this.createLootCache(lx, lz, index);
            }
        } else {
            this.createTerminal(x + half - 2, z + half - 2, size, index);
            
            const loreChance = CONFIG.MAP.FAST_MODE ? 0.15 : 0.4;
            if (Math.random() < loreChance) {
                const lx = x + (Math.random() - 0.5) * (size - 10);
                const lz = z + (Math.random() - 0.5) * (size - 10);
                
                const availableLore = LORE_DATA.filter((_, i) => !this.spawnedLoreIndices.has(i));
                if (availableLore.length > 0) {
                    const entry = availableLore[Math.floor(Math.random() * availableLore.length)];
                    const loreIdx = LORE_DATA.indexOf(entry);
                    this.spawnedLoreIndices.add(loreIdx);
                    this.createLoreTerminal(lx, lz, entry, index);
                }
            }
        }

        this.createEnvironmentalHazards(x, z, size, index);
    }

    createBarrel(x, z, index) {
        const geo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0xffaa00, 
            emissive: 0x331100,
            metalness: 0.8,
            roughness: 0.2
        });
        const barrel = new THREE.Mesh(geo, mat);
        barrel.position.set(x, 0.6, z);
        this.scene.add(barrel);
        
        barrel.userData.isBarrel = true;
        barrel.userData.health = CONFIG.PLAYER.BARREL.HEALTH;
        barrel.userData.chamberIndex = index;
        
        this.addWall(barrel, index);
        this.barrels.push(barrel);
    }

    createLoreTerminal(x, z, loreEntry, chamberIndex) {
        const isTrapped = Math.random() < 0.25;
        const terminal = new DataTerminal(this.scene, new THREE.Vector3(x, 0, z), loreEntry, (entry, trapTriggered) => {
            if (window.game) {
                if (trapTriggered) {
                    window.game.handleTerminalTrap(terminal);
                } else if (window.game.showLoreEntry) {
                    window.game.showLoreEntry(entry);
                }
            }
        }, isTrapped);
        
        const chamberCenter = this.chambers.find(c => c.index === chamberIndex) || {x: 0, z: 0};
        terminal.group.lookAt(new THREE.Vector3(chamberCenter.x, 0, chamberCenter.z));
        
        this.dataTerminals.push(terminal);
        this.addWall(terminal.mesh, chamberIndex);
    }

    createVoltagePlate(x, z, index) {
        const g = new THREE.Group();
        const plateGeo = new THREE.BoxGeometry(3, 0.2, 3);
        const plateMat = new THREE.MeshStandardMaterial({ 
            color: 0x222222, 
            emissive: 0xff3300,
            emissiveIntensity: 1.0,
            metalness: 0.8,
            roughness: 0.2
        });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        g.add(plate);

        const hazardLight = new THREE.PointLight(0xff3300, 2, 4);
        hazardLight.position.set(0, 0.5, 0);
        g.add(hazardLight);

        g.position.set(x, 0.05, z);
        this.scene.add(g);
        this.lights.push(hazardLight);
        hazardLight.userData.chamberIndex = index;
        
        const hazard = { 
            mesh: plate, 
            group: g,
            light: hazardLight,
            type: 'VOLTAGE', 
            damage: 25, 
            radius: 1.8, 
            pulseTime: Math.random() * 10,
            chamberIndex: index,
            isActive: true,
            update: (dt) => {
                if (!hazard.isActive) {
                    plate.material.emissiveIntensity = 0;
                    hazardLight.intensity = 0;
                    hazardLight.visible = false;
                    return;
                }
                hazard.pulseTime += dt * 5;
                const intensity = 0.5 + Math.sin(hazard.pulseTime) * 0.5;
                plate.material.emissiveIntensity = intensity * 4;
                hazardLight.intensity = intensity * 3;
            }
        };
        this.hazards.push(hazard);
        
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

        if (!this._corridorGeoCache) this._corridorGeoCache = {};
        const floorKey = `f_${isH ? len + 2 : width}_${isH ? width : len + 2}`;
        const ceilKey = `c_${isH ? len + 2 : width + 0.2}_${isH ? width + 0.2 : len + 2}`;
        const wallKey = `w_${isH ? len : 1.0}_${height}_${isH ? 1.0 : len}`;
        
        if (!this._corridorGeoCache[floorKey]) this._corridorGeoCache[floorKey] = new THREE.BoxGeometry(isH ? len + 2 : width, 0.1, isH ? width : len + 2);
        if (!this._corridorGeoCache[ceilKey]) this._corridorGeoCache[ceilKey] = new THREE.BoxGeometry(isH ? len + 2 : width + 0.2, 0.1, isH ? width + 0.2 : len + 2);
        if (!this._corridorGeoCache[wallKey]) this._corridorGeoCache[wallKey] = isH ? new THREE.BoxGeometry(len, height, 1.0) : new THREE.BoxGeometry(1.0, height, len);

        const f = new THREE.Mesh(this._corridorGeoCache[floorKey], this.floorMat);
        f.position.set(cX, 0.05, cZ);
        f.userData.chamberIndex = chamberIndex;
        this.scene.add(f);
        this.corridorFloors.push(f);

        const c = new THREE.Mesh(this._corridorGeoCache[ceilKey], this.sharedCeilMat);
        c.position.set(cX, height - 0.05, cZ);
        c.userData.chamberIndex = chamberIndex;
        this.scene.add(c);
        this.ceilingGroups.push(c);

        const wGeo = this._corridorGeoCache[wallKey];
        const w1 = new THREE.Mesh(wGeo, this.sharedWallMat);
        w1.position.set(isH ? cX : cX - width / 2, height / 2, isH ? cZ - width / 2 : cZ);
        this.scene.add(w1); this.addWall(w1, chamberIndex);
        
        const w2 = new THREE.Mesh(wGeo, this.sharedWallMat);
        w2.position.set(isH ? cX : cX + width / 2, height / 2, isH ? cZ + width / 2 : cZ);
        this.scene.add(w2); this.addWall(w2, chamberIndex);

        const corridor = {
            x: cX, z: cZ, 
            hw: (isH ? len : width) / 2 + 2, 
            hd: (isH ? width : len) / 2 + 2,
            index: chamberIndex
        };
        this.corridorBounds.push(corridor);
        this._registerCorridor(corridor);

        const light = new THREE.PointLight(theme.accent, 8, 15);
        light.position.set(cX, height - 1.5, cZ);
        light.userData.chamberIndex = chamberIndex; 
        this.scene.add(light);
        
        this.lights.push(light);

        this.createDoor(x1, height / 2, z1, width, height, chamberIndex, isH);
    }

    createDoor(x, y, z, width, height, chamberIndex, isH) {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 1, roughness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.1 });
        const pGeo = isH ? new THREE.BoxGeometry(0.5, height, width / 2) : new THREE.BoxGeometry(width / 2, height, 0.5);
        const pL = new THREE.Mesh(pGeo, mat), pR = pL.clone();
        if (isH) { pL.position.z = -width / 4; pR.position.z = width / 4; } else { pL.position.x = -width / 4; pR.position.x = width / 4; }
        group.add(pL); group.add(pR); group.position.set(x, y, z); this.scene.add(group);
        const door = { mesh: group, pL, pR, boxL: new THREE.Box3(), boxR: new THREE.Box3(), isOpen: false, chamberIndex, width, isH, 
            isMoving: false,
            update: (dt) => {
                const off = door.isOpen ? door.width / 2 : 0;
                const targetPos = door.isH ? -door.width / 4 - off : -door.width / 4 - off;
                const currentPos = door.isH ? door.pL.position.z : door.pL.position.x;
                
                if (Math.abs(currentPos - targetPos) > 0.01) {
                    door.isMoving = true;
                    if (door.isH) {
                        door.pL.position.z = THREE.MathUtils.lerp(door.pL.position.z, -door.width / 4 - off, dt * 2);
                        door.pR.position.z = THREE.MathUtils.lerp(door.pR.position.z, door.width / 4 + off, dt * 2);
                    } else {
                        door.pL.position.x = THREE.MathUtils.lerp(door.pL.position.x, -door.width / 4 - off, dt * 2);
                        door.pR.position.x = THREE.MathUtils.lerp(door.pR.position.x, door.width / 4 + off, dt * 2);
                    }
                    door.boxL.setFromObject(door.pL); 
                    door.boxR.setFromObject(door.pR);
                } else if (door.isMoving) {
                    if (door.isH) {
                        door.pL.position.z = -door.width / 4 - off;
                        door.pR.position.z = door.width / 4 + off;
                    } else {
                        door.pL.position.x = -door.width / 4 - off;
                        door.pR.position.x = door.width / 4 + off;
                    }
                    door.boxL.setFromObject(door.pL); 
                    door.boxR.setFromObject(door.pR);
                    door.isMoving = false;
                }
            }
        };
        this.doors.push(door); this.addWall(pL, chamberIndex); this.addWall(pR, chamberIndex);
        door.boxL = this.wallBoxes[this.wallBoxes.length - 2]; door.boxR = this.wallBoxes[this.wallBoxes.length - 1];
    }

    static _reusableWallList = [];

    checkCollision(pos, rad = 0.5, chamberIdx = null) {
        const sphere = new THREE.Sphere(pos, rad);
        let curIdx = chamberIdx;
        
        if (curIdx === null || curIdx === undefined) {
            const gx = Math.floor(pos.x / this.chamberLookupCellSize);
            const gz = Math.floor(pos.z / this.chamberLookupCellSize);
            const key = `${gx},${gz}`;
            const potentials = this.chamberLookupGrid.get(key);
            
            if (potentials) {
                for (let i = 0; i < potentials.length; i++) {
                    const p = potentials[i];
                    const d = p.data;
                    if (p.type === 'CHAMBER') {
                        if (Math.abs(pos.x - d.x) < d.size / 2 + 5 && 
                            Math.abs(pos.z - d.z) < d.size / 2 + 5) {
                            curIdx = d.index;
                            break;
                        }
                    } else {
                        if (Math.abs(pos.x - d.x) < d.hw && Math.abs(pos.z - d.z) < d.hd) {
                            curIdx = d.index;
                            break;
                        }
                    }
                }
            }
        }

        if (curIdx !== null && curIdx !== undefined) {
            for (let idx = curIdx - 1; idx <= curIdx + 1; idx++) {
                const chamberList = this.spatialGrid.get(idx);
                if (chamberList) {
                    for (let j = 0; j < chamberList.length; j++) {
                        const boxIdx = chamberList[j];
                        if (this.wallBoxes[boxIdx] && this.wallBoxes[boxIdx].intersectsSphere(sphere)) return true;
                    }
                }
            }
        } else {
            const maxChecks = Math.min(this.wallBoxes.length, 500);
            for (let i = 0; i < maxChecks; i++) {
                if (this.wallBoxes[i] && this.wallBoxes[i].intersectsSphere(sphere)) return true;
            }
        }

        for (let i = 0; i < this.globalWallIndices.length; i++) {
            const boxIdx = this.globalWallIndices[i];
            if (this.wallBoxes[boxIdx] && this.wallBoxes[boxIdx].intersectsSphere(sphere)) return true;
        }

        return false;
    }

    createComplexCeiling(x, z, size, height, index) {
        if (!this._beamGeoCache) this._beamGeoCache = {};
        const beamKeyA = `beam_0.3_0.3_${size}`;
        const beamKeyB = `beam_${size}_0.2_0.3`;
        const ceilKey = `ceil_${size + 2}`;
        
        if (!this._beamGeoCache[ceilKey]) this._beamGeoCache[ceilKey] = new THREE.BoxGeometry(size + 2, 0.1, size + 2);
        if (!this._beamGeoCache[beamKeyA]) this._beamGeoCache[beamKeyA] = new THREE.BoxGeometry(0.3, 0.3, size);
        if (!this._beamGeoCache[beamKeyB]) this._beamGeoCache[beamKeyB] = new THREE.BoxGeometry(size, 0.2, 0.3);

        const g = new THREE.Group();
        g.userData.chamberIndex = index;
        const c = new THREE.Mesh(this._beamGeoCache[ceilKey], this.sharedCeilMat);
        c.userData.chamberIndex = index;
        c.position.set(x, height - 0.05, z); g.add(c);
        const n = 5, s = size / (n - 1);
        for (let i = 0; i < n; i++) {
            const b1 = new THREE.Mesh(this._beamGeoCache[beamKeyA], this.sharedBeamMat);
            b1.userData.chamberIndex = index;
            b1.position.set(x - size / 2 + i * s, height - 0.15, z); g.add(b1);
            if (i % 2 === 0) {
                const b2 = new THREE.Mesh(this._beamGeoCache[beamKeyB], this.sharedBeamMat);
                b2.userData.chamberIndex = index;
                b2.position.set(x, height - 0.1, z - size / 2 + i * s); g.add(b2);
            }
        }
        this.ceilingGroups.push(g); this.scene.add(g);
    }

    createComplexProps(x, z, size, chamberIndex) {
        const isSmallRoom = size <= 20;
        const baseAisles = isSmallRoom ? 1 : 2;
        const baseServersPerAisle = isSmallRoom ? 2 : 3;
        const fastAisles = Math.max(1, Math.floor(baseAisles * (CONFIG.MAP.FAST_MODE ? 0.5 : 1.0)));
        const fastServers = Math.max(1, Math.floor(baseServersPerAisle * (CONFIG.MAP.FAST_MODE ? 0.5 : 1.0)));
        const numAisles = Math.min(fastAisles, CONFIG.MAP.MAX_COMPLEX_PROPS || fastAisles);
        const serversPerAisle = Math.min(fastServers, CONFIG.MAP.MAX_COMPLEX_PROPS ? fastServers : fastServers);
        const aisleSpacing = size * 0.3;
        const serverSpacing = 2.5;

        for (let a = 0; a < numAisles; a++) {
            const side = a === 0 ? -1 : 1;
            const posX = x + side * aisleSpacing;
            
            for (let i = 0; i < serversPerAisle; i++) {
                const posZ = z + (i - (serversPerAisle - 1) / 2) * serverSpacing;
                const prop = DestructibleProp.get(this.scene, new THREE.Vector3(posX, 1.6, posZ), 'SERVER_RACK', this.particleSystem);
                
                prop.chamberIndex = chamberIndex;
                prop.mesh.rotation.y = (side < 0) ? Math.PI / 2 : -Math.PI / 2;
                
                const mesh = prop.mesh.children[0];
                mesh.userData.isDestructible = true;
                mesh.userData.parentProp = prop;
                mesh.userData.chamberIndex = chamberIndex;
                this.addWall(mesh, chamberIndex);
                this.destructibleProps.push(prop);
            }
        }

        const terminalCount = CONFIG.MAP.FAST_MODE ? 1 : 2;
        for (let i = 0; i < terminalCount; i++) {
            const side = Math.random() > 0.5 ? 1 : -1;
            const isX = Math.random() > 0.5;
            let posX, posZ, rotY;

            if (isX) {
                posX = x + side * (size/2 - 0.55);
                posZ = z + (Math.random() - 0.5) * (size - 4);
                rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            } else {
                posX = x + (Math.random() - 0.5) * (size - 4);
                posZ = z + side * (size/2 - 0.55);
                rotY = side > 0 ? Math.PI : 0;
            }

            const prop = DestructibleProp.get(this.scene, new THREE.Vector3(posX, 1.6, posZ), 'DATA_TERMINAL', this.particleSystem);
            prop.mesh.rotation.y = rotY;
            
            const mesh = prop.mesh.children[0];
            mesh.userData.isDestructible = true;
            mesh.userData.parentProp = prop;
            mesh.userData.chamberIndex = chamberIndex;
            this.addWall(mesh, chamberIndex);
            this.destructibleProps.push(prop);
        }

        if (!this._pipeGeoCache) this._pipeGeoCache = {};
        if (!this._pipeGeoCache[size]) {
            this._pipeGeoCache[size] = new THREE.CylinderGeometry(0.15, 0.15, size, 6);
        }
        const pipeGeo = this._pipeGeoCache[size];
        if (!this._pipeMat) this._pipeMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
        if (!this._pipeGasMat) this._pipeGasMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        
        for (let i = 0; i < 2; i++) {
            const isGas = Math.random() < 0.3;
            const p = new THREE.Mesh(pipeGeo, isGas ? this._pipeGasMat.clone() : this._pipeMat);
            
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
        if (!this._termBodyGeo) this._termBodyGeo = new THREE.BoxGeometry(0.8, 1.2, 0.4);
        if (!this._termScreenGeo) this._termScreenGeo = new THREE.BoxGeometry(0.6, 0.4, 0.1);
        if (!this._termBodyMat) this._termBodyMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
        
        const g = new THREE.Group();
        const b = new THREE.Mesh(this._termBodyGeo, this._termBodyMat);
        const s = new THREE.Mesh(this._termScreenGeo, new THREE.MeshBasicMaterial({ 
            map: this.terminalTexture, 
            color: type.startsWith('VAULT') ? 0xff00ff : 0xffffff
        }));
        s.position.set(0, 0.3, 0.16); g.add(b); g.add(s); g.position.set(x, 1, z);
        this.scene.add(g); this.terminals.push({ mesh: g, chamberIndex, isUsed: false, light: s, type });
    }

    createLootCache(x, z, chamberIndex) {
        if (!this._lootBodyGeo) this._lootBodyGeo = new THREE.BoxGeometry(1.2, 0.8, 0.8);
        if (!this._lootLidGeo) this._lootLidGeo = new THREE.BoxGeometry(1.0, 0.1, 0.6);
        if (!this._lootBodyMat) this._lootBodyMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
        if (!this._lootLidMat) this._lootLidMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        
        const g = new THREE.Group();
        const b = new THREE.Mesh(this._lootBodyGeo, this._lootBodyMat);
        const s = new THREE.Mesh(this._lootLidGeo, this._lootLidMat);
        s.position.y = 0.41;
        g.add(b); g.add(s);
        g.position.set(x, 0.4, z);
        this.scene.add(g);
        
        this.addWall(b, chamberIndex);
        
        b.userData.isLootCache = true;
        b.userData.chamberIndex = chamberIndex;
        b.userData.isLocked = true;
        b.userData.light = s;
    }

    createShopTerminal(x, z, size, chamberIndex) {
        if (!this._shopBodyMat) this._shopBodyMat = new THREE.MeshBasicMaterial({ color: 0x332211 });
        if (!this._shopScreenMat) this._shopScreenMat = new THREE.MeshBasicMaterial({ map: this.terminalTexture, color: 0xffaa00 });
        
        const g = new THREE.Group();
        const b = new THREE.Mesh(this._termBodyGeo || new THREE.BoxGeometry(0.8, 1.2, 0.4), this._shopBodyMat);
        const s = new THREE.Mesh(this._termScreenGeo || new THREE.BoxGeometry(0.6, 0.4, 0.1), this._shopScreenMat);
        s.position.set(0, 0.3, 0.16); g.add(b); g.add(s); g.position.set(x, 1, z);
        this.scene.add(g); this.shopTerminals.push({ mesh: g, chamberIndex, isShop: true, light: s });
    }

    createEnvironmentalHazards(x, z, size, idx) {
        if (!this.facility) return;
        
        const hazardChance = CONFIG.MAP.FAST_MODE ? Math.min(0.2, CONFIG.MAP.HAZARD_CHANCE) : CONFIG.MAP.HAZARD_CHANCE;

        if ((this.facility.id === 'meridian' || this.facility.id === 'neon') && Math.random() < hazardChance) {
            const grid = new LaserGrid(this.scene, { x, z, size }, Math.random() > 0.5);
            this.hazards.push({ 
                type: 'LASER_GRID', 
                instance: grid,
                mesh: grid.mesh,
                position: grid.mesh.position
            });
        }

        if (!CONFIG.MAP.FAST_MODE && (this.facility.id === 'neon' || this.facility.id === 'obsidian') && idx >= 5 && Math.random() < 0.2) {
            this.createNeuralDisruptor(x, z, idx);
        }

        if (!CONFIG.MAP.FAST_MODE && this.facility.id === 'neon' && Math.random() < 0.4) {
            this.createPhaseGate(x, z, size, idx);
        }

        if (this.facility.id === 'cryo' && Math.random() < (CONFIG.MAP.FAST_MODE ? 0.3 : 0.5)) {
            const numVents = CONFIG.MAP.FAST_MODE ? 1 : 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < numVents; i++) {
                const vx = x + (Math.random() - 0.5) * (size - 6);
                const vz = z + (Math.random() - 0.5) * (size - 6);
                this.createCryoVent(vx, vz, idx);
            }
        }
    }

    createNeuralDisruptor(x, z, index) {
        let disruptor;
        if (window.game && window.game.spawnDisruptor) {
            disruptor = window.game.spawnDisruptor(new THREE.Vector3(x, 0, z));
        } else {
            disruptor = new NeuralDisruptor(this.scene, this.particleSystem);
            disruptor.spawn(new THREE.Vector3(x, 0, z));
            if (window.game) window.game.disruptors.push(disruptor);
        }
        
        this.hazards.push({ 
            type: 'NEURAL_DISRUPTOR', 
            instance: disruptor,
            mesh: disruptor.mesh,
            position: disruptor.position,
            chamberIndex: index
        });
        this.addWall(disruptor.mesh, index);
    }

    createCryoVent(x, z, index) {
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

    createPhaseGate(x, z, size, index) {
        const isH = Math.random() > 0.5;
        const g = new THREE.Group();
        
        const beamGeo = isH ? new THREE.BoxGeometry(size - 4, 0.1, 0.1) : new THREE.BoxGeometry(0.1, 0.1, size - 4);
        const beamMat = new THREE.MeshBasicMaterial({ 
            color: 0xff00ff, 
            transparent: true, 
            opacity: 0.6,
            blending: THREE.AdditiveBlending 
        });
        
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = 1.5;
        g.add(beam);
        
        const capGeo = new THREE.BoxGeometry(0.4, 3, 0.4);
        const capMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
        
        const cap1 = new THREE.Mesh(capGeo, capMat);
        const cap2 = cap1.clone();
        
        const off = (size - 4) / 2;
        if (isH) {
            cap1.position.set(-off, 1.5, 0);
            cap2.position.set(off, 1.5, 0);
        } else {
            cap1.position.set(0, 1.5, -off);
            cap2.position.set(0, 1.5, off);
        }
        
        g.add(cap1); g.add(cap2);
        g.position.set(x, 0, z);
        this.scene.add(g);
        
        const hazard = {
            type: 'PHASE_GATE',
            group: g,
            beam,
            isH,
            index,
            state: 'ACTIVE',
            timer: Math.random() * 2,
            update: (dt) => {
                hazard.timer += dt;
                const cycle = 3.0;
                const active = 2.0;
                
                if (hazard.timer % cycle < active) {
                    hazard.state = 'ACTIVE';
                    beam.visible = true;
                    beam.material.opacity = 0.4 + Math.sin(Date.now() * 0.01) * 0.2;
                } else {
                    hazard.state = 'INACTIVE';
                    beam.visible = false;
                }
            }
        };
        
        this.hazards.push(hazard);
        this.addWall(cap1, index);
        this.addWall(cap2, index);
    }

    createExtractionPortal(x, z) {
        const g = new THREE.Group();
        const tex = new THREE.TextureLoader().load('https://rosebud.ai/assets/extraction_portal_sprite.webp?OBBJ');
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, color: 0xffffff }));
        s.scale.set(0.1, 0.1, 0.1); s.position.y = 3; g.add(s);
        const rGeo = new THREE.TorusGeometry(3, 0.05, 16, 100), rMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0, transparent: true, opacity: 0.3 });
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

    disposeObject(obj) {
        if (!obj) return;
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => {
                    if (m && typeof m.dispose === 'function') m.dispose();
                });
            } else if (typeof obj.material.dispose === 'function') {
                obj.material.dispose();
            }
        }
    }

    cleanup() {
        this.destructibleProps.forEach(p => {
            if (p.deactivate) p.deactivate();
        });

        const disposeList = [
            ...this.walls,
            ...this.ceilingGroups,
            ...this.pipes,
            ...this.barrels,
            ...this.extinguishers
        ];

        disposeList.forEach(obj => {
            if (!obj) return;
            if (obj.userData && obj.userData.parentProp) return;

            if (obj.isLight) {
                this.scene.remove(obj);
            } else {
                this.disposeObject(obj);
                if (obj.parent) obj.parent.remove(obj);
            }
        });

        const complexGroups = [
            ...this.doors.map(d => d.mesh),
            ...this.terminals.map(t => t.mesh),
            ...this.shopTerminals.map(t => t.mesh),
            ...(this.extractionPortal ? [this.extractionPortal.mesh] : [])
        ];

        complexGroups.forEach(group => {
            if (!group || typeof group.traverse !== 'function') return;
            
            const toDispose = [];
            group.traverse(child => {
                if (child.isMesh || child.isSprite) toDispose.push(child);
            });
            
            toDispose.forEach(child => this.disposeObject(child));
            if (group.parent) group.parent.remove(group);
            else this.scene.remove(group);
        });

        this.hazards.forEach(h => {
            if (!h) return;
            if (h.instance && typeof h.instance.destroy === 'function') {
                h.instance.destroy();
            } else if (h.group) {
                const toDispose = [];
                h.group.traverse(child => {
                    if (child.isMesh || child.isSprite) toDispose.push(child);
                });
                toDispose.forEach(child => this.disposeObject(child));
                if (h.group.parent) h.group.parent.remove(h.group);
                else this.scene.remove(h.group);
            } else if (h.mesh) {
                this.disposeObject(h.mesh);
                if (h.mesh.parent) h.mesh.parent.remove(h.mesh);
                else this.scene.remove(h.mesh);
            }
        });

        this.walls = []; 
        this.wallBoxes = []; 
        this.spatialGrid.clear(); 
        this.ceilingGroups = []; 
        this.doors = []; 
        this.terminals = []; 
        this.shopTerminals = []; 
        this.pipes = []; 
        this.barrels = []; 
        this.hazards = []; 
        this.destructibleProps = [];
        this.dataTerminals = [];
        
        this._wallGeoCache = null;
        this._beamGeoCache = null;
        this._corridorGeoCache = null;
        this._pipeGeoCache = null;
        this.extractionPortal = null;
    }

    update(deltaTime, playerPos = null) {
        this.destructibleProps.forEach(p => p.update(deltaTime, playerPos));
        if (playerPos) {
            this.dataTerminals.forEach(t => t.update(deltaTime, playerPos));
        }
    }

    setChamberVisibility(currentIndex, radius = 2) {
        if (currentIndex === null || currentIndex === undefined) return;

        const minIndex = currentIndex - radius;
        const maxIndex = currentIndex + radius;

        const isVisible = (idx) => idx === undefined || idx === null || (idx >= minIndex && idx <= maxIndex);

        for (let i = 0; i < this.walls.length; i++) {
            const wall = this.walls[i];
            if (!wall || typeof wall !== 'object' || wall.isInstanced) continue;
            wall.visible = isVisible(wall.userData?.chamberIndex);
        }

        const floorLists = [this.floors, this.corridorFloors];
        for (let list of floorLists) {
            if (!list) continue;
            for (let i = 0; i < list.length; i++) {
                const floor = list[i];
                if (!floor) continue;
                floor.visible = isVisible(floor.userData?.chamberIndex);
            }
        }

        for (let i = 0; i < this.destructibleProps.length; i++) {
            const prop = this.destructibleProps[i];
            if (!prop || !prop.mesh) continue;
            const visible = isVisible(prop.chamberIndex);
            prop.mesh.visible = visible;
            if (prop.light) prop.light.visible = visible;
        }

        for (let i = 0; i < this.ceilingGroups.length; i++) {
            const group = this.ceilingGroups[i];
            if (!group) continue;
            group.visible = isVisible(group.userData?.chamberIndex);
        }

        const maybeCullGroup = (collection) => {
            if (!collection) return;
            for (let i = 0; i < collection.length; i++) {
                const item = collection[i];
                const mesh = item?.mesh;
                if (mesh && mesh.userData) {
                    mesh.visible = isVisible(mesh.userData.chamberIndex);
                }
            }
        };

        maybeCullGroup(this.doors);
        maybeCullGroup(this.terminals);
        maybeCullGroup(this.shopTerminals);
        maybeCullGroup(this.dataTerminals);

        if (this.pillarInstances && this.pillarData && this.pillarData.length > 0) {
            let visibleCount = 0;
            for (let i = 0; i < this.pillarData.length; i++) {
                const datum = this.pillarData[i];
                if (!datum || !datum.matrix) continue;

                if (isVisible(datum.chamberIndex)) {
                    this.pillarInstances.setMatrixAt(visibleCount, datum.matrix);
                    visibleCount++;
                }
            }
            this.pillarInstances.count = visibleCount;
            this.pillarInstances.instanceMatrix.needsUpdate = true;
        }
    }

    getRandomSpawnPoint() {
        const c = this.chambers[Math.floor(Math.random() * this.chambers.length)];
        return new THREE.Vector3(c.x + (Math.random() - 0.5) * (c.size - 4), 0, c.z + (Math.random() - 0.5) * (c.size - 4));
    }
}