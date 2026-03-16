import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.textureLoader = new THREE.TextureLoader();
        this.obstacles = [];
        this.barrels = []; // Track exploding barrels
        this.objectives = []; // Track objective items
        this.staticProps = []; // Track non-obstacle decorations
        this.hazards = []; // Track environmental hazards
        this.buildGround();
        this.buildWalls();
        this.buildSky();
        this.buildRuins();
        this.addLights();
    }

    clearWorld() {
        // Remove all obstacles and props except boundary walls
        this.obstacles.forEach(obj => {
            if (this.boundaryWalls.includes(obj)) return;
            this.scene.remove(obj);
        });
        
        // Filter out non-boundary obstacles
        this.obstacles = this.obstacles.filter(obj => this.boundaryWalls.includes(obj));

        this.barrels.forEach(b => {
            if (b.sprite) this.scene.remove(b.sprite);
            if (b.mesh) this.scene.remove(b.mesh);
            if (b.glow) this.scene.remove(b.glow);
        });
        this.barrels = [];

        this.staticProps.forEach(p => this.scene.remove(p));
        this.staticProps = [];

        this.hazards.forEach(h => {
            if (h.mesh) this.scene.remove(h.mesh);
            if (h.beams) h.beams.forEach(b => this.scene.remove(b));
        });
        this.hazards = [];

        this.clearObjectives();
        
        // Also remove any existing ruins/buildings
        this.scene.children.forEach(child => {
            if (child.isMesh && child.userData.isProcedural) {
                this.scene.remove(child);
            }
        });
    }

    generateProceduralArena(type = 'random', campaignIndex = 0) {
        this.clearWorld();
        this.currentCampaignIndex = campaignIndex;

        const types = ['Labyrinth', 'Arena', 'Scatter', 'Fortress'];
        const selectedType = type === 'random' ? types[Math.floor(Math.random() * types.length)] : type;

        console.log(`Generating Procedural Arena: ${selectedType} for Biome: ${campaignIndex}`);

        const wallTexture = this.textureLoader.load(CONFIG.ASSETS.WALLS[campaignIndex % CONFIG.ASSETS.WALLS.length]);
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            map: wallTexture,
            side: THREE.DoubleSide
        });
        
        const crateTexture = this.textureLoader.load(CONFIG.ASSETS.CRATE);
        // Darkened tactical biome colors (neutral grays and very dark tints)
        const biomeColors = [0x444444, 0x223333, 0x223322, 0x222233, 0x332222];
        const crateMaterial = new THREE.MeshStandardMaterial({ 
            map: crateTexture,
            color: biomeColors[campaignIndex % biomeColors.length]
        });

        const barrelTexture = this.textureLoader.load(CONFIG.ASSETS.BARREL);

        if (selectedType === 'Labyrinth') {
            this.buildLabyrinth(wallMaterial, crateMaterial, barrelTexture);
        } else if (selectedType === 'Arena') {
            this.buildColosseum(wallMaterial, crateMaterial, barrelTexture);
        } else if (selectedType === 'Scatter') {
            this.buildRuins(); // Scatter uses multiple texture sources
        } else if (selectedType === 'Fortress') {
            this.buildFortress(wallMaterial, crateMaterial, barrelTexture);
        }

        // Add some hazards
        this.spawnHazards(campaignIndex);

        // Add Rising Sludge if it's the Toxic or Volcanic biome
        if (campaignIndex === 2 || campaignIndex === 4) {
            this.createRisingSludge(campaignIndex);
            this.addHighGround(campaignIndex, crateMaterial);
        }
    }

    addHighGround(campaignIndex, crateMaterial) {
        // Add extra jumpable structures specifically for hazard biomes
        const count = 15;
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * 400;
            const z = (Math.random() - 0.5) * 400;
            if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;

            const rand = Math.random();
            if (rand < 0.4) {
                // Stack of crates
                this.createCrate(x, z, crateMaterial);
                this.createCrate(x + 1, z + 1, crateMaterial);
                const tallCrate = this.createCrate(x, z, crateMaterial);
                tallCrate.position.y += 3;
            } else if (rand < 0.7) {
                // Elevated Platform / Scaffold
                this.createScaffold(x, z, crateMaterial);
            } else {
                // Large Rock/Crystal formation
                const crystalTexture = this.textureLoader.load(CONFIG.ASSETS.CRYSTAL);
                this.createStaticObstacle(x, z, crystalTexture, 8, 6, 6, true);
            }
        }
    }

    createScaffold(x, z, material) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.userData.isProcedural = true;
        this.scene.add(group);

        const height = 4;
        const size = 8;

        // Platform top
        const topGeom = new THREE.BoxGeometry(size, 0.5, size);
        const top = new THREE.Mesh(topGeom, material);
        top.position.y = height;
        group.add(top);
        this.obstacles.push(top);

        // Legs
        const legGeom = new THREE.BoxGeometry(0.5, height, 0.5);
        const legOffsets = [[-size/2 + 0.5, -size/2 + 0.5], [size/2 - 0.5, -size/2 + 0.5], [-size/2 + 0.5, size/2 - 0.5], [size/2 - 0.5, size/2 - 0.5]];
        legOffsets.forEach(offset => {
            const leg = new THREE.Mesh(legGeom, material);
            leg.position.set(offset[0], height/2, offset[1]);
            group.add(leg);
            this.obstacles.push(leg);
        });
    }

    createRisingSludge(campaignIndex) {
        // Use extremely muted, dark versions of the biome colors
        const color = campaignIndex === 2 ? 0x052205 : 0x220505; // Dark forest green or Dark dried lava
        const geom = new THREE.PlaneGeometry(500, 500);
        const mat = new THREE.MeshStandardMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.7, // Higher opacity but darker color
            emissive: 0x000000, 
            emissiveIntensity: 0
        });
        const sludge = new THREE.Mesh(geom, mat);
        sludge.rotation.x = -Math.PI / 2;
        sludge.position.y = -1; // Start below ground
        this.scene.add(sludge);

        this.hazards.push({
            type: 'sludge',
            mesh: sludge,
            active: true,
            timer: 0,
            baseY: -1,
            targetY: 1.5,
            cycle: 15.0, // Rises/falls every 15 seconds
            damage: 15
        });
    }

    spawnHazards(campaignIndex) {
        // More hazards in later campaigns
        const hazardCount = 2 + Math.floor(campaignIndex / 2);
        for (let i = 0; i < hazardCount; i++) {
            const x = (Math.random() - 0.5) * 300;
            const z = (Math.random() - 0.5) * 300;
            if (Math.abs(x) < 40 && Math.abs(z) < 40) continue;
            
            if (Math.random() > 0.5) {
                this.createLaserGrid(x, z);
            } else {
                this.createToxicVent(x, z);
            }
        }
    }

    createLaserGrid(x, z) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        this.scene.add(group);

        const beams = [];
        const beamCount = 3;
        const spacing = 4;
        const beamGeom = new THREE.CylinderGeometry(0.1, 0.1, 40, 8);
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });

        for (let i = 0; i < beamCount; i++) {
            const beam = new THREE.Mesh(beamGeom, beamMat);
            beam.rotation.z = Math.PI / 2;
            beam.position.y = 2 + i * spacing;
            group.add(beam);
            beams.push(beam);
        }

        // Add base pillars
        const pillarGeom = new THREE.BoxGeometry(1, 15, 1);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
        const p1 = new THREE.Mesh(pillarGeom, pillarMat);
        p1.position.set(-20, 7.5, 0);
        group.add(p1);
        const p2 = new THREE.Mesh(pillarGeom, pillarMat);
        p2.position.set(20, 7.5, 0);
        group.add(p2);

        this.hazards.push({
            type: 'laser',
            group: group,
            beams: beams,
            active: true,
            disabledTimer: 0,
            timer: Math.random() * Math.PI * 2,
            speed: 1 + Math.random() * 2,
            damage: 20
        });
    }

    createToxicVent(x, z) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        this.scene.add(group);

        const ventGeom = new THREE.CylinderGeometry(3, 4, 1, 16);
        const ventMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const vent = new THREE.Mesh(ventGeom, ventMat);
        vent.position.y = 0.5;
        group.add(vent);

        // Toxic cloud sprite (visual only, collision handled by distance)
        const cloudTexture = this.textureLoader.load(CONFIG.ASSETS.EXPLOSION); // Use explosion as base for now
        const cloudMat = new THREE.SpriteMaterial({ 
            map: cloudTexture, 
            color: 0x224422, // Muted dark green instead of glowy 0x00ff00
            transparent: true, 
            opacity: 0.4 
        });
        const cloud = new THREE.Sprite(cloudMat);
        cloud.scale.set(10, 10, 1);
        cloud.position.y = 5;
        group.add(cloud);

        this.hazards.push({
            type: 'toxic',
            group: group,
            cloud: cloud,
            active: true,
            timer: 0,
            cycle: 4.0, // Active every 4 seconds
            damage: 10,
            radius: 8
        });
    }

    updateHazards(deltaTime, playerPosition, activeDome) {
        let playerDamage = 0;
        let hazardImminent = false;

        this.hazards.forEach(h => {
            if (h.type === 'laser') {
                if (h.disabledTimer > 0) {
                    h.disabledTimer -= deltaTime;
                    h.beams.forEach(b => b.material.opacity = 0.1);
                    return;
                }
                h.beams.forEach(b => b.material.opacity = 0.8);

                h.timer += deltaTime * h.speed;
                // Swing back and forth
                h.group.position.z += Math.sin(h.timer) * 0.1;
                
                // Check collision (simple distance to line)
                const distToPlane = Math.abs(playerPosition.z - h.group.position.z);
                const distToCenter = Math.abs(playerPosition.x - h.group.position.x);
                
                if (distToPlane < 0.5 && distToCenter < 20) {
                    // Check if player is at the height of any beam
                    h.beams.forEach(beam => {
                        const beamHeight = beam.position.y;
                        if (Math.abs(playerPosition.y - beamHeight) < 1.0) {
                            playerDamage = Math.max(playerDamage, h.damage);
                        }
                    });
                }
            } else if (h.type === 'toxic') {
                h.timer += deltaTime;
                const state = (h.timer % h.cycle) / h.cycle;
                let isActive = state < 0.5; // Active half the time

                // --- Synergy Check: Guardian Dome Clears Toxic ---
                if (activeDome) {
                    const distToDome = h.group.position.distanceTo(activeDome.position);
                    if (distToDome < 8) isActive = false;
                }
                
                h.cloud.scale.setScalar(isActive ? 10 + Math.sin(h.timer * 5) * 2 : 0.01);
                h.cloud.material.opacity = isActive ? 0.6 : 0;

                if (isActive) {
                    const dist = playerPosition.distanceTo(h.group.position);
                    if (dist < h.radius) {
                        playerDamage = Math.max(playerDamage, h.damage * deltaTime);
                        hazardImminent = true;
                    }
                }
            } else if (h.type === 'sludge') {
                h.timer += deltaTime;
                const state = (h.timer % h.cycle) / h.cycle;
                const rising = state < 0.4; // Rises for 40% of cycle
                const staying = state >= 0.4 && state < 0.7; // Stays for 30%
                
                if (rising) {
                    const alpha = state / 0.4;
                    h.mesh.position.y = h.baseY + (h.targetY - h.baseY) * alpha;
                } else if (!staying) {
                    const alpha = (state - 0.7) / 0.3;
                    h.mesh.position.y = h.targetY - (h.targetY - h.baseY) * alpha;
                }

                // If sludge is above ground level, show warning
                if (h.mesh.position.y > 0.0) {
                    hazardImminent = true;
                }

                if (h.mesh.position.y > 0.1 && playerPosition.y < h.mesh.position.y) {
                    playerDamage = Math.max(playerDamage, h.damage * deltaTime);
                }
            }
        });
        return { playerDamage, hazardImminent };
    }

    buildLabyrinth(wallMat, crateMat, barrelTex) {
        const size = 400;
        const gridCount = 6;
        const step = size / gridCount;

        for (let i = -gridCount/2; i < gridCount/2; i++) {
            for (let j = -gridCount/2; j < gridCount/2; j++) {
                if (Math.abs(i) < 1 && Math.abs(j) < 1) continue; // Keep center clear
                
                const x = i * step + (Math.random() - 0.5) * 20;
                const z = j * step + (Math.random() - 0.5) * 20;

                if (Math.random() > 0.4) {
                    const wall = new THREE.Mesh(new THREE.BoxGeometry(step * 0.8, 10, 2), wallMat);
                    wall.position.set(x, 5, z);
                    wall.rotation.y = Math.random() > 0.5 ? 0 : Math.PI / 2;
                    wall.userData.isProcedural = true;
                    this.scene.add(wall);
                    this.obstacles.push(wall);
                }
            }
        }
        // Fill with some props
        this.spawnRandomProps(20, 15, barrelTex, crateMat);
    }

    buildColosseum(wallMat, crateMat, barrelTex) {
        const radius = 60;
        const count = 12;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 15, 8), wallMat);
            pillar.position.set(x, 7.5, z);
            pillar.userData.isProcedural = true;
            this.scene.add(pillar);
            this.obstacles.push(pillar);
        }
        // Central cluster
        for (let i = 0; i < 5; i++) {
            this.createCrate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, crateMat);
        }
        this.spawnRandomProps(30, 10, barrelTex, crateMat);
    }

    buildFortress(wallMat, crateMat, barrelTex) {
        const offsets = [-40, 40];
        offsets.forEach(ox => {
            offsets.forEach(oz => {
                this.createBuilding(ox, oz, wallMat);
            });
        });
        this.spawnRandomProps(15, 20, barrelTex, crateMat);
    }

    spawnRandomProps(crateCount, barrelCount, barrelTex, crateMat) {
        for (let i = 0; i < crateCount; i++) {
            const x = (Math.random() - 0.5) * 450;
            const z = (Math.random() - 0.5) * 450;
            if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;
            this.createCrate(x, z, crateMat);
        }
        for (let i = 0; i < barrelCount; i++) {
            const x = (Math.random() - 0.5) * 450;
            const z = (Math.random() - 0.5) * 450;
            if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;
            this.createBarrel(x, z, barrelTex);
        }
    }

    clearObjectives() {
        this.objectives.forEach(obj => {
            if (obj.sprite) this.scene.remove(obj.sprite);
            if (obj.glow) this.scene.remove(obj.glow);
            if (obj.mesh) {
                this.scene.remove(obj.mesh);
                const obsIdx = this.obstacles.indexOf(obj.mesh);
                if (obsIdx > -1) this.obstacles.splice(obsIdx, 1);
            }
        });
        this.objectives = [];
    }

    spawnObjectives(type, count) {
        this.clearObjectives();
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 100;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            
            if (type === 'Retrieval') {
                this.createObjectiveCore(x, z);
            } else if (type === 'Sabotage') {
                this.createObjectiveHive(x, z);
            }
        }
    }

    createObjectiveCore(x, z) {
        const texture = this.textureLoader.load(CONFIG.ASSETS.ENERGY_CORE);
        const mat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(3, 3, 1);
        sprite.position.set(x, 2, z);
        this.scene.add(sprite);
        this.objectives.push({ type: 'core', sprite, alive: true });
    }

    createObjectiveHive(x, z) {
        const texture = this.textureLoader.load(CONFIG.ASSETS.ALIEN_HIVE);
        const mat = new THREE.SpriteMaterial({ 
            map: texture,
            color: 0xffaaaa,
            transparent: true,
            opacity: 1
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(6, 8, 1);
        sprite.position.set(x, 4, z);
        this.scene.add(sprite);

        // Add glow
        const glowGeo = new THREE.SphereGeometry(4, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, transparent: true, opacity: 0.05 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(sprite.position);
        this.scene.add(glow);

        // Physics box for shooting
        const geom = new THREE.BoxGeometry(4, 8, 4);
        const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ visible: false }));
        mesh.position.set(x, 4, z);
        this.scene.add(mesh);
        this.obstacles.push(mesh);
        
        this.objectives.push({ type: 'hive', sprite, mesh, glow, health: 100, alive: true });
    }

    buildRuins() {
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            map: this.textureLoader.load(CONFIG.ASSETS.RUIN_WALL),
            side: THREE.DoubleSide
        });

        // Create a few ruined buildings
        for (let i = 0; i < 8; i++) {
            const bx = (Math.random() - 0.5) * 400;
            const bz = (Math.random() - 0.5) * 400;
            if (Math.abs(bx) < 30 && Math.abs(bz) < 30) continue; 

            this.createBuilding(bx, bz, wallMaterial);
        }

        // Add some jumpable crates
        const crateTexture = this.textureLoader.load(CONFIG.ASSETS.CRATE);
        const crateMaterial = new THREE.MeshStandardMaterial({ map: crateTexture });
        for (let i = 0; i < 20; i++) {
            const cx = (Math.random() - 0.5) * 450;
            const cz = (Math.random() - 0.5) * 450;
            this.createCrate(cx, cz, crateMaterial);
        }

        // Add fuel barrels
        const barrelTexture = this.textureLoader.load(CONFIG.ASSETS.BARREL);
        for (let i = 0; i < 20; i++) {
            const bx = (Math.random() - 0.5) * 450;
            const bz = (Math.random() - 0.5) * 450;
            if (Math.abs(bx) < 30 && Math.abs(bz) < 30) continue; 
            this.createBarrel(bx, bz, barrelTexture);
        }

        // Add crystals
        const crystalTexture = this.textureLoader.load(CONFIG.ASSETS.CRYSTAL);
        for (let i = 0; i < 20; i++) {
            const px = (Math.random() - 0.5) * 450;
            const pz = (Math.random() - 0.5) * 450;
            this.createStaticObstacle(px, pz, crystalTexture, 5, 5, 2, false);
        }

        // Add barriers
        const barrierTexture = this.textureLoader.load(CONFIG.ASSETS.BARRIER);
        for (let i = 0; i < 15; i++) {
            const bx = (Math.random() - 0.5) * 450;
            const bz = (Math.random() - 0.5) * 450;
            this.createStaticObstacle(bx, bz, barrierTexture, 4, 3, 2, true); // Fixed orientation for barriers
        }

        // Add wreckage
        const wreckageTexture = this.textureLoader.load(CONFIG.ASSETS.WRECKAGE);
        for (let i = 0; i < 10; i++) {
            const wx = (Math.random() - 0.5) * 450;
            const wz = (Math.random() - 0.5) * 450;
            this.createStaticObstacle(wx, wz, wreckageTexture, 10, 8, 6, true);
        }

        // Add some pillars
        const pillarTexture = this.textureLoader.load(CONFIG.ASSETS.PILLAR);
        for (let i = 0; i < 15; i++) {
            const px = (Math.random() - 0.5) * 450;
            const pz = (Math.random() - 0.5) * 450;
            this.createPillar(px, pz, pillarTexture);
        }

        // Add Landed Ships
        const shipTexture = this.textureLoader.load(CONFIG.ASSETS.SHIP_STATIC);
        for (let i = 0; i < 8; i++) {
            const sx = (Math.random() - 0.5) * 400;
            const sz = (Math.random() - 0.5) * 400;
            if (Math.abs(sx) < 40 && Math.abs(sz) < 40) continue; 
            this.createStaticObstacle(sx, sz, shipTexture, 40, 15, 20, true);
        }
    }

    createStaticObstacle(x, z, texture, width, height, collisionSize, fixed = false) {
        if (!fixed) {
            // Use Sprite for small organic things like crystals if preferred
            const mat = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(width, height, 1);
            sprite.position.set(x, height / 2, z);
            this.scene.add(sprite);
        } else {
            // Create fixed 3D volume using cross-planes
            const mat = new THREE.MeshStandardMaterial({ 
                map: texture, 
                transparent: true, 
                side: THREE.DoubleSide,
                alphaTest: 0.5
            });
            const geom = new THREE.PlaneGeometry(width, height);
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(x, height / 2, z);
            mesh.rotation.y = Math.random() * Math.PI * 2;
            this.scene.add(mesh);

            // Cross plane for volume
            const mesh2 = mesh.clone();
            mesh2.rotation.y += Math.PI / 2;
            this.scene.add(mesh2);
        }

        // Physical collision box
        const geom = new THREE.BoxGeometry(collisionSize, height, collisionSize);
        const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ visible: false }));
        mesh.position.set(x, height / 2, z);
        this.scene.add(mesh);
        this.obstacles.push(mesh);
    }

    createBuilding(x, z, material) {
        const size = 15;
        const height = 10;
        
        // Walls (L-shaped or U-shaped to walk inside)
        const wallGeom = new THREE.PlaneGeometry(size, height);
        
        const walls = [
            { pos: [x - size/2, height/2, z], rot: [0, Math.PI/2, 0] },
            { pos: [x, height/2, z - size/2], rot: [0, 0, 0] },
            { pos: [x + size/2, height/2, z + size/4], rot: [0, Math.PI/2, 0] } // Partial wall
        ];

        walls.forEach(w => {
            const mesh = new THREE.Mesh(wallGeom, material);
            mesh.position.set(...w.pos);
            mesh.rotation.set(...w.rot);
            this.scene.add(mesh);
            this.obstacles.push(mesh);
        });
    }

    createCrate(x, z, material) {
        const size = 2 + Math.random() * 2;
        const geom = new THREE.BoxGeometry(size, size, size);
        // Remove emissive for tactical darkness
        const crateMat = material.clone();
        crateMat.emissive = new THREE.Color(0x000000);
        crateMat.emissiveIntensity = 0;
        
        const mesh = new THREE.Mesh(geom, crateMat);
        mesh.position.set(x, size/2, z);
        mesh.userData.isProcedural = true;
        this.scene.add(mesh);
        this.obstacles.push(mesh);
        return mesh;
    }

    createBarrel(x, z, texture) {
        const mat = new THREE.SpriteMaterial({ map: texture, color: 0xffaaaa });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(1.5, 2, 1);
        sprite.position.set(x, 1, z);
        this.scene.add(sprite);

        // Add small glow to barrel
        const glowGeo = new THREE.SphereGeometry(1, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.05 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(sprite.position);
        this.scene.add(glow);

        // Invisible physical collision for shooting
        const geom = new THREE.BoxGeometry(1.5, 2, 1.5);
        const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ visible: false }));
        mesh.position.set(x, 1, z);
        this.scene.add(mesh);
        
        const barrel = { sprite, mesh, glow, alive: true };
        this.barrels.push(barrel);
        this.obstacles.push(mesh);
    }

    createPillar(x, z, texture) {
        // Using a sprite for the pillar to match the style, but we'll add a physical box for it
        const mat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(4, 12, 1);
        sprite.position.set(x, 6, z);
        this.scene.add(sprite);

        // Invisible physical collision
        const geom = new THREE.BoxGeometry(2, 12, 2);
        const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ visible: false }));
        mesh.position.set(x, 6, z);
        this.scene.add(mesh);
        this.obstacles.push(mesh);
    }

    buildGround() {
        const groundTexture = this.textureLoader.load(CONFIG.ASSETS.GROUNDS[0]);
        groundTexture.wrapS = THREE.RepeatWrapping;
        groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(10, 10);

        const groundGeometry = new THREE.PlaneGeometry(500, 500);
        this.groundMaterial = new THREE.MeshStandardMaterial({ 
            map: groundTexture,
            roughness: 0.8,
            metalness: 0.2
        });
        
        const ground = new THREE.Mesh(groundGeometry, this.groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    buildWalls() {
        const wallTexture = this.textureLoader.load(CONFIG.ASSETS.WALLS[0]);
        wallTexture.wrapS = THREE.RepeatWrapping;
        wallTexture.wrapT = THREE.RepeatWrapping;
        wallTexture.repeat.set(5, 1);

        this.wallMaterial = new THREE.MeshStandardMaterial({ map: wallTexture });
        
        const wallThickness = 2;
        const wallHeight = 40;
        const wallLength = 500;

        const walls = [
            { pos: [0, wallHeight/2, -250], size: [wallLength, wallHeight, wallThickness] },
            { pos: [0, wallHeight/2, 250], size: [wallLength, wallHeight, wallThickness] },
            { pos: [-250, wallHeight/2, 0], size: [wallThickness, wallHeight, wallLength] },
            { pos: [250, wallHeight/2, 0], size: [wallThickness, wallHeight, wallLength] }
        ];

        this.boundaryWalls = [];
        walls.forEach(w => {
            const geometry = new THREE.BoxGeometry(...w.size);
            const mesh = new THREE.Mesh(geometry, this.wallMaterial);
            mesh.position.set(...w.pos);
            this.scene.add(mesh);
            this.obstacles.push(mesh);
            this.boundaryWalls.push(mesh);
        });
    }

    buildSky() {
        this.updateSky(0);
    }

    updateEnvironment(index) {
        const campaignIndex = index % CONFIG.CAMPAIGNS.length;
        
        // Update Sky
        this.updateSky(campaignIndex);

        // Update Ground
        const groundUrl = CONFIG.ASSETS.GROUNDS[campaignIndex];
        this.textureLoader.load(groundUrl, (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(10, 10);
            this.groundMaterial.map = texture;
            // Apply a global dark tint to reduce inherent texture brightness
            this.groundMaterial.color.set(0x222222); 
            this.groundMaterial.needsUpdate = true;
        });

        // Update Walls
        const wallUrl = CONFIG.ASSETS.WALLS[campaignIndex];
        this.textureLoader.load(wallUrl, (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(5, 1);
            this.wallMaterial.map = texture;
            // Tint walls darker as well
            this.wallMaterial.color.set(0x333333);
            this.wallMaterial.needsUpdate = true;
        });
    }

    updateSky(index) {
        const skyUrl = CONFIG.ASSETS.SKIES[index % CONFIG.ASSETS.SKIES.length];
        this.textureLoader.load(skyUrl, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            this.scene.background = texture;
            this.scene.environment = texture;
        });
    }

    addLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffccaa, 0.5);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // Add some dim, neutral point lights for tactical visibility
        const pointLight1 = new THREE.PointLight(0xaaaaaa, 2, 50); // Dim white instead of neon green
        pointLight1.position.set(20, 5, 20);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x666666, 2, 50); // Dim grey instead of neon purple
        pointLight2.position.set(-20, 5, -20);
        this.scene.add(pointLight2);
    }
}
