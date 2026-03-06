import * as THREE from 'three';
import { CONFIG } from './config.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.platforms = [];
        this.coins = [];
        this.currentLevel = 0;
        
        // Performance: Reuse objects to avoid GC pressure
        this._tmpBox1 = new THREE.Box3();
        this._tmpBox2 = new THREE.Box3();
        this._tmpVec1 = new THREE.Vector3();
        this._playerBox = new THREE.Box3();
        this._groundingBox = new THREE.Box3();
        
        this.textureLoader = new THREE.TextureLoader();
        this.textures = {
            platform: this.textureLoader.load(CONFIG.PLATFORM_TEXTURE),
            hazard: this.textureLoader.load(CONFIG.HAZARD_TEXTURE),
            speed: this.textureLoader.load(CONFIG.SPEED_PAD_TEXTURE),
            coin: this.textureLoader.load(CONFIG.COIN_TEXTURE),
            laserBase: this.textureLoader.load(CONFIG.LASER_BASE_TEXTURE),
            stair: this.textureLoader.load(CONFIG.STAIR_TEXTURE),
            hazardStripes: this.textureLoader.load(CONFIG.HAZARD_STRIPES_TEXTURE),
            circuitBlue: this.textureLoader.load(CONFIG.CIRCUIT_BLUE_TEXTURE),
            invincibility: this.textureLoader.load(CONFIG.INVINCIBILITY_TEXTURE)
        };

        // Prepare textures
        this.textures.platform.wrapS = this.textures.platform.wrapT = THREE.RepeatWrapping;
        this.textures.hazard.wrapS = this.textures.hazard.wrapT = THREE.RepeatWrapping;
        this.textures.stair.wrapS = this.textures.stair.wrapT = THREE.RepeatWrapping;
        this.textures.hazardStripes.wrapS = this.textures.hazardStripes.wrapT = THREE.RepeatWrapping;
        this.textures.circuitBlue.wrapS = this.textures.circuitBlue.wrapT = THREE.RepeatWrapping;

        // Add some ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        
        const sunLight = new THREE.PointLight(0xffffff, 1, 200);
        sunLight.position.set(0, 50, 0);
        this.scene.add(sunLight);

        // Skybox - New vibrant nebula
        this.textureLoader.load(CONFIG.SKYBOX_URL, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            this.scene.background = texture;
            this.scene.environment = texture;
        });
        
        this.scene.fog = new THREE.Fog(0x220044, 50, 250);

        this.loadLevel(0);
        this.addDecorations();
    }

    addDecorations() {
        this.textureLoader.load(CONFIG.CRYSTAL_URL, (texture) => {
            for (let i = 0; i < 20; i++) {
                const material = new THREE.SpriteMaterial({ 
                    map: texture,
                    transparent: true,
                    opacity: 0.6
                });
                const sprite = new THREE.Sprite(material);
                
                // Random position far away
                const angle = Math.random() * Math.PI * 2;
                const radius = 60 + Math.random() * 40;
                sprite.position.set(
                    Math.cos(angle) * radius,
                    Math.random() * 40 - 10,
                    Math.sin(angle) * radius
                );
                
                const scale = 5 + Math.random() * 5;
                sprite.scale.set(scale, scale, 1);
                this.scene.add(sprite);
                
                // Add floating logic via mesh userData
                sprite.userData = { 
                    originalY: sprite.position.y,
                    speed: 0.5 + Math.random(),
                    phase: Math.random() * Math.PI * 2
                };
                this.decorations = this.decorations || [];
                this.decorations.push(sprite);
            }
        });
    }

    loadLevel(index, difficultyOffset = 0) {
        // Clear existing level
        this.platforms.forEach(p => this.scene.remove(p));
        this.coins.forEach(c => this.scene.remove(c));
        this.platforms = [];
        this.coins = [];
        this.segmentBoundaries = [];
        
        this.currentLevel = index;
        
        // Starting platform (Easy)
        const startPlatform = this.createPlatform(0, 0, 0, 10, 1, 10, CONFIG.LEVEL_TYPES.CHECKPOINT);
        
        // Generate procedural level content based on index and campaign difficulty
        let currentPos = new THREE.Vector3(0, 0, -10);
        const segments = this.getSegmentsForLevel(index, difficultyOffset);
        this.totalSegments = segments.length;
        
        segments.forEach((segment, i) => {
            const startZ = currentPos.z;
            currentPos = segment.generate(this, currentPos);
            this.segmentBoundaries.push({ startZ, endZ: currentPos.z });

            // Add periodic checkpoints more frequently (every 3 segments)
            if ((i + 1) % 3 === 0 && i < segments.length - 1) {
                this.createPlatform(currentPos.x, currentPos.y, currentPos.z, 10, 1, 10, CONFIG.LEVEL_TYPES.CHECKPOINT);
                currentPos.z -= 12;
            }
        });

        // Win platform
        this.createPlatform(currentPos.x, currentPos.y, currentPos.z - 5, 12, 1, 12, CONFIG.LEVEL_TYPES.WIN);
        this.winZ = currentPos.z - 5;
    }

    getSegmentProgress(playerZ) {
        let currentSegment = 0;
        for (let i = 0; i < this.segmentBoundaries.length; i++) {
            if (playerZ <= this.segmentBoundaries[i].startZ && playerZ >= this.segmentBoundaries[i].endZ) {
                currentSegment = i + 1;
                break;
            }
            if (playerZ < this.segmentBoundaries[i].endZ) {
                currentSegment = i + 1;
            }
        }
        return Math.min(currentSegment, this.totalSegments);
    }

    getSegmentsForLevel(levelIndex, difficultyOffset = 0) {
        const segments = [];
        const baseDifficulty = levelIndex + 1;
        const totalDifficulty = baseDifficulty + difficultyOffset;
        
        // Progression: mega long levels
        const numSegments = 15 + (levelIndex * 2);
        
        // Pool of available segments - Rearranged for variety in early levels
        const pool = [
            this.segmentBasicJumps,     // 0: Basic
            this.segmentStairs,         // 1: Basic
            this.segmentWindingPath,    // 2: Floating Path
            this.segmentParallelPaths,  // 3: Shape Variety
            this.segmentHexPipes,       // 4: Shape Variety
            this.segmentSpheres,        // 5: Shape Variety
            this.segmentMovingPlatforms,// 6: Moving X/Z
            this.segmentVerticalMovers, // 7: Moving Y
            this.segmentLavaPass,       // 8: Hazard
            this.segmentSpinners,       // 9: Lethal
            this.segmentLasers,         // 10: Lethal
            this.segmentBlades,         // 11: Lethal
            this.segmentRollers,        // 12: Lethal
            this.segmentHammers,        // 13: Lethal
            this.segmentAdvancedLasers  // 14: Lethal
        ];

        // Level scaling based on totalDifficulty
        let maxPoolIndex = 6; 
        if (totalDifficulty >= 10) maxPoolIndex = 9;
        if (totalDifficulty >= 25) maxPoolIndex = pool.length;

        for (let i = 0; i < numSegments; i++) {
            // First segment is always basic jumps for level 0 campaign 0
            const isStart = (levelIndex === 0 && difficultyOffset === 0 && i === 0);
            const segmentFunc = isStart ? this.segmentBasicJumps : pool[Math.floor(Math.random() * maxPoolIndex)];
            segments.push({ generate: (world, pos) => segmentFunc.call(world, pos, totalDifficulty) });
        }

        return segments;
    }

    // --- SEGMENT GENERATORS ---

    segmentBasicJumps(startPos, difficulty) {
        const numJumps = 3 + Math.floor(difficulty / 10);
        const gap = 4 + Math.min(difficulty * 0.1, 4.5); // Cap at 8.5
        const size = Math.max(4 - difficulty * 0.05, 2.5); // Slightly larger minimum size
        
        for (let i = 0; i < numJumps; i++) {
            this.createPlatform(startPos.x, startPos.y, startPos.z, size, 1, size);
            if (Math.random() > 0.7) this.createCoin(startPos.x, startPos.y + 1, startPos.z);
            // Occasional invincibility power-up
            if (difficulty > 5 && Math.random() > 0.95) {
                this.createPlatform(startPos.x, startPos.y + 1, startPos.z, 2, 0.5, 2, CONFIG.LEVEL_TYPES.INVINCIBILITY);
            }
            startPos.z -= gap;
        }
        return startPos;
    }

    segmentStairs(startPos, difficulty) {
        const numSteps = 4 + Math.floor(difficulty / 8);
        const stepSize = Math.max(3 - difficulty * 0.05, 2);
        
        for (let i = 0; i < numSteps; i++) {
            this.createPlatform(startPos.x, startPos.y, startPos.z, stepSize, 0.5, stepSize, CONFIG.LEVEL_TYPES.NORMAL, { texture: 'stair' });
            startPos.y += 0.8;
            startPos.z -= 4;
        }
        this.createPlatform(startPos.x, startPos.y, startPos.z, 6, 1, 6, CONFIG.LEVEL_TYPES.CHECKPOINT);
        startPos.z -= 8;
        return startPos;
    }

    segmentLavaPass(startPos, difficulty) {
        const length = 15 + difficulty * 1.5;
        this.createPlatform(startPos.x, startPos.y - 0.5, startPos.z - length/2, 15, 0.5, length, CONFIG.LEVEL_TYPES.LAVA);
        
        const numPlatforms = 4 + Math.floor(difficulty / 8);
        const step = length / (numPlatforms + 1);
        
        for (let i = 1; i <= numPlatforms; i++) {
            const offset = (Math.random() - 0.5) * 6;
            this.createPlatform(startPos.x + offset, startPos.y + 0.5, startPos.z - i * step, 3.5, 1, 3.5);
        }
        startPos.z -= length + 6;
        return startPos;
    }

    segmentMovingPlatforms(startPos, difficulty) {
        const numPlatforms = 2 + Math.floor(difficulty / 12);
        const speed = 0.5 + difficulty * 0.02; // Further reduced for comfort
        const range = 4 + Math.min(difficulty * 0.2, 10);
        
        for (let i = 0; i < numPlatforms; i++) {
            const platform = this.createPlatform(startPos.x, startPos.y, startPos.z, 4, 1, 4, CONFIG.LEVEL_TYPES.MOVING, { axis: 'x', range, speed });
            
            // Expert difficulty: Add rotating blades to the moving platforms
            if (difficulty > 5 && Math.random() > 0.5) {
                this.createPlatform(startPos.x, startPos.y + 1.2, startPos.z, 8, 0.2, 0.5, CONFIG.LEVEL_TYPES.BLADE, { 
                    speed: 0.5 + difficulty * 0.05, // Adjusted for time-based rotation
                    followPlatform: platform 
                });
            }
            startPos.z -= 10;
        }
        this.createPlatform(startPos.x, startPos.y, startPos.z, 6, 1, 6, CONFIG.LEVEL_TYPES.CHECKPOINT);
        startPos.z -= 8;
        return startPos;
    }

    segmentSpinners(startPos, difficulty) {
        const numSpinners = 1 + Math.floor(difficulty / 15);
        const speed = 0.6 + Math.min(difficulty * 0.05, 1.5); // Adjusted for time-based rotation
        
        for (let i = 0; i < numSpinners; i++) {
            this.createPlatform(startPos.x, startPos.y, startPos.z, 15, 1, 2, CONFIG.LEVEL_TYPES.SPINNER, { speed });
            startPos.z -= 15;
        }
        return startPos;
    }

    segmentLasers(startPos, difficulty) {
        const numLasers = 2 + Math.floor(difficulty / 10);
        const spacing = 8;
        
        for (let i = 0; i < numLasers; i++) {
            this.createPlatform(startPos.x, startPos.y + 2, startPos.z, 1, 10, 1, CONFIG.LEVEL_TYPES.LASER, { texture: 'laserBase' });
            this.createPlatform(startPos.x, startPos.y, startPos.z, 4, 0.5, 4);
            startPos.z -= spacing;
        }
        return startPos;
    }

    segmentAdvancedLasers(startPos, difficulty) {
        const numLasers = 1 + Math.floor(difficulty / 15);
        const spacing = 15;
        for (let i = 0; i < numLasers; i++) {
            this.createPlatform(startPos.x, startPos.y, startPos.z, 6, 1, 6);
            this.createPlatform(startPos.x, startPos.y + 1, startPos.z, 1, 0.5, 6, CONFIG.LEVEL_TYPES.LASER_EMITTER, { speed: 2 + difficulty * 0.1, range: 4 });
            startPos.z -= spacing;
        }
        return startPos;
    }

    segmentParallelPaths(startPos, difficulty) {
        const length = 20 + Math.min(difficulty, 10);
        const numPaths = 2 + (difficulty > 15 ? 1 : 0);
        const spacing = 6;
        const platformSize = 4;

        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < numPaths; j++) {
                const offsetX = (j - (numPaths - 1) / 2) * spacing;
                const type = (i % 2 === 0 && j === 1) ? CONFIG.LEVEL_TYPES.LAVA : CONFIG.LEVEL_TYPES.NORMAL;
                this.createPlatform(startPos.x + offsetX, startPos.y, startPos.z, platformSize, 0.5, platformSize, type);
                if (Math.random() > 0.8) this.createCoin(startPos.x + offsetX, startPos.y + 1, startPos.z);
            }
            startPos.z -= 8;
        }
        return startPos;
    }

    segmentHexPipes(startPos, difficulty) {
        const numPipes = 3 + Math.floor(difficulty / 10);
        const pipeLen = 10;
        const pipeWidth = 2.5; // Increased from 2

        for (let i = 0; i < numPipes; i++) {
            const side = (i % 2 === 0) ? -1 : 1;
            this.createPlatform(startPos.x + (side * 2.5), startPos.y, startPos.z, pipeWidth, 1, pipeLen, CONFIG.LEVEL_TYPES.NORMAL, { shape: 'hex' });
            startPos.z -= pipeLen + 4.5;
        }
        return startPos;
    }

    segmentSpheres(startPos, difficulty) {
        const numSpheres = 3 + Math.floor(difficulty / 12);
        const radius = 3.5; // Increased from 3
        for (let i = 0; i < numSpheres; i++) {
            const offsetX = (Math.random() - 0.5) * 8;
            this.createPlatform(startPos.x + offsetX, startPos.y, startPos.z, radius, radius, radius, CONFIG.LEVEL_TYPES.NORMAL, { shape: 'sphere' });
            startPos.z -= 8.5;
        }
        return startPos;
    }

    segmentWindingPath(startPos, difficulty) {
        const numNodes = 6 + Math.floor(difficulty / 5);
        const stepZ = 6;
        const width = 3;
        
        for (let i = 0; i < numNodes; i++) {
            const offsetX = Math.sin(i * 0.8) * 5;
            this.createPlatform(startPos.x + offsetX, startPos.y, startPos.z, width, 0.5, width, CONFIG.LEVEL_TYPES.NORMAL, { texture: 'circuitBlue' });
            if (i % 3 === 0) this.createCoin(startPos.x + offsetX, startPos.y + 1, startPos.z);
            startPos.z -= stepZ;
        }
        return startPos;
    }

    segmentVerticalMovers(startPos, difficulty) {
        const numPlatforms = 3 + Math.floor(difficulty / 10);
        const speed = 1.0 + difficulty * 0.05; // Reduced from 1.5 + 0.1
        const range = 3 + Math.min(difficulty * 0.2, 6);
        
        for (let i = 0; i < numPlatforms; i++) {
            const platform = this.createPlatform(startPos.x, startPos.y, startPos.z, 4, 1, 4, CONFIG.LEVEL_TYPES.MOVING, { axis: 'y', range, speed });
            
            // Expert difficulty: Add swinging hammers over vertical movers
            if (difficulty > 8 && Math.random() > 0.5) {
                this.createPlatform(startPos.x, startPos.y + 5, startPos.z, 1, 4, 1, CONFIG.LEVEL_TYPES.NORMAL); // Support
                this.createPlatform(startPos.x, startPos.y + 1, startPos.z, 3, 2, 3, CONFIG.LEVEL_TYPES.HAMMER, { 
                    speed: 1.2 + difficulty * 0.05, // Reduced from 2 + 0.1
                    originalY: startPos.y + 1, 
                    range: 4,
                    followPlatform: platform 
                });
            }
            startPos.z -= 10;
        }
        return startPos;
    }

    segmentBlades(startPos, difficulty) {
        const numBlades = 1 + Math.floor(difficulty / 20);
        const spacing = 15;
        for (let i = 0; i < numBlades; i++) {
            this.createPlatform(startPos.x, startPos.y, startPos.z, 8, 1, 8); // Increased from 6
            this.createPlatform(startPos.x, startPos.y + 1.2, startPos.z, 7, 0.2, 0.5, CONFIG.LEVEL_TYPES.BLADE, { 
                speed: 0.03 + difficulty * 0.003 // Reduced from 0.05 + 0.005
            }); 
            startPos.z -= spacing;
        }
        return startPos;
    }

    segmentRollers(startPos, difficulty) {
        const numRollers = 1 + Math.floor(difficulty / 18);
        const spacing = 16;
        for (let i = 0; i < numRollers; i++) {
            this.createPlatform(startPos.x, startPos.y, startPos.z, 12, 1, 6); // Increased width from 10
            this.createPlatform(startPos.x, startPos.y + 1.5, startPos.z, 8, 1, 1, CONFIG.LEVEL_TYPES.ROLLER, { speed: 1.5 + difficulty * 0.1, range: 4.5 });
            startPos.z -= spacing;
        }
        return startPos;
    }

    segmentHammers(startPos, difficulty) {
        const numHammers = 1 + Math.floor(difficulty / 12);
        const spacing = 15;
        for (let i = 0; i < numHammers; i++) {
            this.createPlatform(startPos.x, startPos.y, startPos.z, 8, 1, 8); // Increased from 6
            this.createPlatform(startPos.x, startPos.y + 5, startPos.z, 1, 4, 1, CONFIG.LEVEL_TYPES.NORMAL); // Support
            this.createPlatform(startPos.x, startPos.y + 1, startPos.z, 3, 2, 3, CONFIG.LEVEL_TYPES.HAMMER, { speed: 2 + difficulty * 0.1, originalY: startPos.y + 1, range: 4 });
            startPos.z -= spacing;
        }
        return startPos;
    }

    createPlatform(x, y, z, w, h, d, type = CONFIG.LEVEL_TYPES.NORMAL, props = {}) {
        let geometry;
        if (props.shape === 'cylinder') {
            geometry = new THREE.CylinderGeometry(w / 2, w / 2, d, 16);
            geometry.rotateX(Math.PI / 2);
        } else if (props.shape === 'sphere') {
            geometry = new THREE.SphereGeometry(w / 2, 16, 16);
        } else if (props.shape === 'hex') {
            geometry = new THREE.CylinderGeometry(w / 2, w / 2, d, 6);
            geometry.rotateX(Math.PI / 2);
        } else {
            geometry = new THREE.BoxGeometry(w, h, d);
        }

        let color = CONFIG.COLORS.PLATFORM;
        let map = this.textures.platform;
        if (props.texture === 'stair') map = this.textures.stair;
        else if (props.texture === 'laserBase') map = this.textures.laserBase;
        else if (props.texture === 'circuitBlue') map = this.textures.circuitBlue;
        
        let emissiveMap = null;
        
        switch(type) {
            case CONFIG.LEVEL_TYPES.LAVA: 
                color = CONFIG.COLORS.LAVA; 
                map = this.textures.hazard;
                emissiveMap = this.textures.hazard;
                break;
            case CONFIG.LEVEL_TYPES.CHECKPOINT: 
                color = CONFIG.COLORS.NEON_GREEN;
                emissiveMap = map;
                break;
            case CONFIG.LEVEL_TYPES.SPEED_BOOST: 
                color = CONFIG.COLORS.NEON_PINK; 
                map = this.textures.speed;
                emissiveMap = this.textures.speed;
                break;
            case CONFIG.LEVEL_TYPES.INVINCIBILITY:
                color = CONFIG.COLORS.INVINCIBILITY;
                // Use a sprite for the icon instead of a flat texture on a box
                const spriteMat = new THREE.SpriteMaterial({ 
                    map: this.textures.invincibility,
                    transparent: true,
                    color: 0x00ffff
                });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.scale.set(3, 3, 1);
                sprite.position.set(0, 1.5, 0);
                
                // Still need a base platform to stand on
                geometry = new THREE.BoxGeometry(w, 0.2, d);
                const baseMat = new THREE.MeshStandardMaterial({ 
                    color: 0x222222, 
                    metalness: 0.8, 
                    roughness: 0.2,
                    transparent: true,
                    opacity: 0.5 
                });
                const mesh = new THREE.Mesh(geometry, baseMat);
                mesh.add(sprite);
                mesh.position.set(x, y, z);
                mesh.receiveShadow = true;
                mesh.userData = { type, w, h: 0.2, d, originalY: y, originalX: x, originalZ: z, sprite, ...props };
                this.scene.add(mesh);
                this.platforms.push(mesh);
                return mesh;
            case CONFIG.LEVEL_TYPES.WIN: color = CONFIG.COLORS.WIN; break;
            case CONFIG.LEVEL_TYPES.SPINNER: color = CONFIG.COLORS.NEON_BLUE; break;
            case CONFIG.LEVEL_TYPES.LASER: 
                color = CONFIG.COLORS.LASER; 
                map = this.textures.hazard;
                emissiveMap = this.textures.hazard;
                break;
            case CONFIG.LEVEL_TYPES.MOVING: 
                color = CONFIG.COLORS.NEON_BLUE; 
                map = this.textures.hazardStripes;
                break;
            case CONFIG.LEVEL_TYPES.BLADE:
            case CONFIG.LEVEL_TYPES.ROLLER:
            case CONFIG.LEVEL_TYPES.HAMMER:
            case CONFIG.LEVEL_TYPES.LASER_EMITTER:
                color = CONFIG.COLORS.LASER;
                map = this.textures.hazard;
                emissiveMap = this.textures.hazard;
                break;
        }

        const isNeon = [
            CONFIG.LEVEL_TYPES.SPEED_BOOST, 
            CONFIG.LEVEL_TYPES.INVINCIBILITY,
            CONFIG.LEVEL_TYPES.SPINNER, 
            CONFIG.LEVEL_TYPES.LASER, 
            CONFIG.LEVEL_TYPES.MOVING, 
            CONFIG.LEVEL_TYPES.CHECKPOINT, 
            CONFIG.LEVEL_TYPES.WIN,
            CONFIG.LEVEL_TYPES.BLADE,
            CONFIG.LEVEL_TYPES.ROLLER,
            CONFIG.LEVEL_TYPES.HAMMER,
            CONFIG.LEVEL_TYPES.LASER_EMITTER
        ].includes(type);

        const material = new THREE.MeshStandardMaterial({ 
            color,
            map: map,
            emissive: isNeon ? color : 0x000000,
            emissiveMap: emissiveMap,
            emissiveIntensity: isNeon ? 1.0 : 0,
            roughness: 0.2,
            metalness: 0.8
        });
        
        // Scale texture repetition
        const m = material.clone();
        if (m.map) {
            m.map = m.map.clone();
            // Only mark for update if image data is actually present
            // This prevents "Texture marked for update but no image data found" errors
            const repeatX = (props.texture === 'stair' || type === CONFIG.LEVEL_TYPES.MOVING) ? 1 : w / 4;
            const repeatY = (props.texture === 'stair' || type === CONFIG.LEVEL_TYPES.MOVING) ? 1 : d / 4;
            m.map.repeat.set(repeatX, repeatY);
            if (m.map.image) {
                m.map.needsUpdate = true;
            }
        }
        if (m.emissiveMap) {
            m.emissiveMap = m.emissiveMap.clone();
            m.emissiveMap.repeat.set(w / 4, d / 4);
            if (m.emissiveMap.image) {
                m.emissiveMap.needsUpdate = true;
            }
        }

        const mesh = new THREE.Mesh(geometry, m);
        mesh.position.set(x, y, z);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        
        // Cache the bounding box for high-performance collision detection
        mesh.updateMatrixWorld();
        const box = new THREE.Box3().setFromObject(mesh);
        
        mesh.userData = { 
            type, w, h, d, 
            originalY: y, originalX: x, originalZ: z, 
            boundingBox: box, // Pre-computed box
            ...props 
        };
        this.scene.add(mesh);
        this.platforms.push(mesh);
        return mesh;
    }

    createCoin(x, y, z) {
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
        geometry.rotateX(Math.PI / 2);
        const material = new THREE.MeshStandardMaterial({ 
            color: CONFIG.COLORS.COIN, 
            map: this.textures.coin,
            emissive: CONFIG.COLORS.COIN,
            emissiveIntensity: 0.5,
            metalness: 1,
            roughness: 0
        });
        const coin = new THREE.Mesh(geometry, material);
        coin.position.set(x, y, z);
        this.scene.add(coin);
        this.coins.push(coin);
        return coin;
    }


    update(time) {
        this.platforms.forEach(p => {
            const data = p.userData;

            // Handle following platforms (for hazards attached to movers)
            if (data.followPlatform) {
                p.position.x = data.followPlatform.position.x;
                // Only follow Y if it's a vertical mover or specifically configured
                if (data.followPlatform.userData.axis === 'y') {
                    p.position.y = data.followPlatform.position.y + (data.originalY - data.followPlatform.userData.originalY);
                } else {
                    p.position.z = data.followPlatform.position.z;
                }
            }

            if (data.type === CONFIG.LEVEL_TYPES.CHECKPOINT) {
                // Pulsate neon green checkpoints
                const pulse = 0.5 + Math.sin(time * 4) * 0.5;
                p.material.emissiveIntensity = 0.5 + pulse * 1.5;
            }

            if (data.type === CONFIG.LEVEL_TYPES.INVINCIBILITY) {
                if (data.sprite) {
                    data.sprite.position.y = 1.5 + Math.sin(time * 3) * 0.3;
                    data.sprite.material.opacity = 0.7 + Math.sin(time * 5) * 0.3;
                }
            }
            
            if (data.type === CONFIG.LEVEL_TYPES.SPEED_BOOST) {
                p.position.y = data.originalY + Math.sin(time * 3) * 0.2;
                p.rotation.y = time * 1.5; // Deterministic rotation
            }
            if (data.type === CONFIG.LEVEL_TYPES.WIN) {
                p.rotation.y = time * 2; // Deterministic rotation
                p.position.y = data.originalY + Math.sin(time) * 0.5;
            }
            if (data.type === CONFIG.LEVEL_TYPES.SPINNER) {
                p.rotation.y = time * (data.speed || 0.8); // Time-based rotation
            }
            if (data.type === CONFIG.LEVEL_TYPES.MOVING) {
                const axis = data.axis || 'x';
                const range = data.range || 5;
                const speed = data.speed || 1.5;
                p.position[axis] = data[`original${axis.toUpperCase()}`] + Math.sin(time * speed) * range;
            }
            if (data.type === CONFIG.LEVEL_TYPES.BLADE) {
                p.rotation.y = time * (data.speed || 1.5); // Time-based rotation
            }
            if (data.type === CONFIG.LEVEL_TYPES.ROLLER) {
                const spinSpeed = data.speed * 0.5;
                p.position.x = data.originalX + Math.sin(time * data.speed) * data.range;
                p.rotation.z = time * spinSpeed; // Time-based rotation
            }
            if (data.type === CONFIG.LEVEL_TYPES.HAMMER) {
                // Swinging motion
                p.position.y = data.originalY + Math.abs(Math.sin(time * data.speed)) * data.range;
                p.rotation.z = Math.sin(time * data.speed) * 0.5;
            }
            if (data.type === CONFIG.LEVEL_TYPES.LASER_EMITTER) {
                // Moving back and forth
                p.position.x = data.originalX + Math.sin(time * data.speed) * data.range;
                // Blinking effect
                p.material.emissiveIntensity = Math.sin(time * 10) > 0 ? 1 : 0.2;
            }
        });

        this.coins.forEach(c => {
            c.rotation.y += 0.05;
            c.position.y += Math.sin(time * 4) * 0.005;
        });

        // Update background decorations
        if (this.decorations) {
            this.decorations.forEach(d => {
                d.position.y = d.userData.originalY + Math.sin(time * d.userData.speed + d.userData.phase) * 2;
            });
        }
    }

    createLevel1() {
        return [
            { x: 0, y: 0, z: 0, w: 10, h: 1, d: 10, type: 'checkpoint' },
            { x: 0, y: 1, z: -12, w: 4, h: 1, d: 4, type: 'normal' },
            { x: 0, y: 1.5, z: -12, type: 'coin' },
            { x: 5, y: 2, z: -18, w: 4, h: 1, d: 4, type: 'normal' },
            { x: -5, y: 3, z: -24, w: 4, h: 1, d: 4, type: 'normal' },
            { x: -5, y: 4, z: -24, type: 'coin' },
            { x: 0, y: 4, z: -32, w: 10, h: 1, d: 10, type: 'checkpoint' },
            { x: 0, y: 5, z: -45, w: 15, h: 1, d: 2, type: 'spinner', props: { speed: 0.03 } },
            { x: 0, y: 6, z: -55, w: 6, h: 1, d: 6, type: 'speedBoost' },
            { x: 0, y: 5, z: -85, w: 12, h: 1, d: 12, type: 'win' }
        ];
    }

    createLevel2() {
        return [
            { x: 0, y: 0, z: 0, w: 10, h: 1, d: 10, type: 'checkpoint' },
            { x: 0, y: 1, z: -15, w: 4, h: 1, d: 4, type: 'moving', props: { axis: 'x', range: 8, speed: 2 } },
            { x: 0, y: 2.5, z: -15, type: 'coin' },
            { x: 0, y: 3, z: -30, w: 4, h: 1, d: 4, type: 'moving', props: { axis: 'z', range: 5, speed: 1.5 } },
            { x: 0, y: 4, z: -45, w: 10, h: 1, d: 10, type: 'checkpoint' },
            { x: -6, y: 5.5, z: -60, w: 3, h: 1, d: 3, type: 'normal' },
            { x: 0, y: 6.5, z: -60, w: 3, h: 1, d: 3, type: 'normal' },
            { x: 6, y: 7.5, z: -60, w: 3, h: 1, d: 3, type: 'normal' },
            { x: 0, y: 7.5, z: -60, type: 'coin' },
            { x: 0, y: 8, z: -75, w: 20, h: 0.5, d: 5, type: 'lava' },
            { x: 0, y: 9, z: -75, w: 2, h: 2, d: 2, type: 'spinner', props: { speed: 0.1 } },
            { x: 0, y: 9, z: -95, w: 12, h: 1, d: 12, type: 'win' }
        ];
    }

    createLevel3() {
        return [
            { x: 0, y: 0, z: 0, w: 10, h: 1, d: 10, type: 'checkpoint' },
            { x: 0, y: 2, z: -15, w: 1, h: 10, d: 1, type: 'laser' },
            { x: -5, y: 1, z: -25, w: 3, h: 1, d: 3, type: 'normal' },
            { x: 5, y: 3, z: -35, w: 3, h: 1, d: 3, type: 'normal' },
            { x: 5, y: 4.5, z: -35, type: 'coin' },
            { x: 0, y: 5, z: -50, w: 10, h: 1, d: 10, type: 'checkpoint' },
            { x: 0, y: 6, z: -65, w: 3, h: 1, d: 3, type: 'moving', props: { axis: 'y', range: 4, speed: 3 } },
            { x: -8, y: 8, z: -80, w: 4, h: 1, d: 4, type: 'normal' },
            { x: 8, y: 10, z: -95, w: 4, h: 1, d: 4, type: 'normal' },
            { x: 0, y: 11, z: -95, type: 'coin' },
            { x: 0, y: 12, z: -110, w: 20, h: 1, d: 2, type: 'spinner', props: { speed: 0.15 } },
            { x: -10, y: 14, z: -125, w: 4, h: 1, d: 4, type: 'speedBoost' },
            { x: 10, y: 16, z: -150, w: 15, h: 1, d: 15, type: 'win' }
        ];
    }

    checkCollisions(player, deltaTime) {
        const playerPos = player.mesh.position;
        
        // Performance: Reuse pre-allocated boxes
        // FIX: Don't use the same temp vector for both center and size in one call
        const playerSize = this._tmpVec1.set(0.6, 2.0, 0.6);
        this._playerBox.setFromCenterAndSize(playerPos, playerSize);
        
        const groundingCenter = this._tmpBox1.min.set(playerPos.x, playerPos.y - 0.2, playerPos.z);
        const groundingSize = this._tmpBox2.min.set(0.5, 2.2, 0.5);
        this._groundingBox.setFromCenterAndSize(groundingCenter, groundingSize);

        let grounded = false;
        let onWin = false;

        const playerZ = playerPos.z;

        // Optimized coin collection (reuse box)
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const coin = this.coins[i];
            if (Math.abs(coin.position.z - playerZ) < 5) {
                this._tmpBox1.setFromObject(coin);
                if (this._playerBox.intersectsBox(this._tmpBox1)) {
                    this.scene.remove(coin);
                    this.coins.splice(i, 1);
                    player.addCoin();
                }
            }
        }

        // Optimized platform collisions
        for (let i = 0; i < this.platforms.length; i++) {
            const platform = this.platforms[i];
            const data = platform.userData;
            
            // Only check platforms near the player (performance)
            if (Math.abs(platform.position.z - playerZ) > 20) continue;

            // Use cached box for static objects, update for moving ones
            let platformBox = data.boundingBox;
            if (data.type === CONFIG.LEVEL_TYPES.MOVING || data.followPlatform) {
                this._tmpBox1.setFromObject(platform);
                platformBox = this._tmpBox1;
            }
            
            if (this._playerBox.intersectsBox(platformBox)) {
                const type = data.type;
                const isHazard = [
                    CONFIG.LEVEL_TYPES.LAVA, CONFIG.LEVEL_TYPES.LASER, CONFIG.LEVEL_TYPES.BLADE,
                    CONFIG.LEVEL_TYPES.ROLLER, CONFIG.LEVEL_TYPES.HAMMER, CONFIG.LEVEL_TYPES.LASER_EMITTER
                ].includes(type);

                if (isHazard && player.invincibilityTimer <= 0) {
                    player.takeDamage(deltaTime * 100);
                }
            }

            if (this._groundingBox.intersectsBox(platformBox)) {
                const type = data.type;
                const topY = platformBox.max.y;
                const footLevel = playerPos.y - 1.0;
                
                let isOver = true;
                if (data.shape === 'sphere') {
                    const dx = playerPos.x - platform.position.x;
                    const dz = playerPos.z - platform.position.z;
                    const distSq = dx * dx + dz * dz;
                    const radius = data.w / 2;
                    isOver = distSq <= (radius * radius);
                } else if (data.shape === 'hex' || data.shape === 'cylinder') {
                    const dx = Math.abs(playerPos.x - platform.position.x);
                    const dz = Math.abs(playerPos.z - platform.position.z);
                    const radius = data.w / 2;
                    const halfLen = data.d / 2;
                    isOver = dx <= radius && dz <= halfLen;
                }

                if (isOver && footLevel >= topY - 0.5) {
                    grounded = true;
                    player.controller.groundLevel = topY + 1.0;
                    
                    if (type === CONFIG.LEVEL_TYPES.CHECKPOINT) player.setCheckpoint(platform.position);
                    else if (type === CONFIG.LEVEL_TYPES.SPEED_BOOST) player.applySpeedBoost();
                    else if (type === CONFIG.LEVEL_TYPES.INVINCIBILITY) {
                        player.applyInvincibility();
                        platform.visible = false;
                        platform.position.y = -100;
                    } else if (type === CONFIG.LEVEL_TYPES.WIN) onWin = true;

                    if (type === CONFIG.LEVEL_TYPES.MOVING) {
                        const axis = data.axis;
                        const lastPos = data[`last${axis.toUpperCase()}`];
                        if (lastPos !== undefined) {
                            const delta = platform.position[axis] - lastPos;
                            player.mesh.position[axis] += delta;
                        }
                    }
                }
            }
            
            if (data.type === CONFIG.LEVEL_TYPES.MOVING) {
                const axis = data.axis;
                data[`last${axis.toUpperCase()}`] = platform.position[axis];
            }
        }

        if (!grounded) player.controller.groundLevel = -100;
        return { grounded, onWin };
    }
}
