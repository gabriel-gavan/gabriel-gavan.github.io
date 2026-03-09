import * as THREE from 'three';
import { CONFIG } from './config.js';
import { MovingPlatform, SwingingHammer, ArrowTrap, Ladder, RotatingBlade, LaserTrap, StaticProp, DragonBoss, Torch, SpikeTrap, Gargoyle, Archer, EnemyProjectile } from './Obstacle.js';
import { CAMPAIGNS } from './GameData.js';

export class LevelManager {
    constructor(scene) {
        this.scene = scene;
        this.segments = [];
        this.obstacles = [];
        this.currentLevel = 1;
        this.segmentCounter = 0;
        
        // Generation state for turns
        this.currentPos = new THREE.Vector3(0, 0, 0);
        this.currentDir = new THREE.Vector3(0, 0, -1);
        this.currentRight = new THREE.Vector3(1, 0, 0);
        this.totalDistanceGenerated = 0;
        
        // Texture setup
        const textureLoader = new THREE.TextureLoader();
        this.wallTexture = textureLoader.load(CONFIG.ASSETS.STONE_WALL);
        this.wallTexture.wrapS = THREE.RepeatWrapping;
        this.wallTexture.wrapT = THREE.RepeatWrapping;
        this.wallTexture.repeat.set(5, 5);
        
        this.floorTexture = textureLoader.load(CONFIG.ASSETS.STONE_FLOOR);
        this.floorTexture.wrapS = THREE.RepeatWrapping;
        this.floorTexture.wrapT = THREE.RepeatWrapping;
        this.floorTexture.repeat.set(5, 5);

        this.wallMaterial = new THREE.MeshStandardMaterial({ map: this.wallTexture, roughness: 0.8 });
        this.floorMaterial = new THREE.MeshStandardMaterial({ map: this.floorTexture, roughness: 0.8 });
        this.lavaMaterial = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff4400, emissiveIntensity: 2 });
    }

    generateAtDistance(targetDist) {
        this.resetGeneration();
        // Clear existing segments and obstacles
        this.segments.forEach(s => this.scene.remove(s.mesh));
        this.segments = [];
        this.obstacles.forEach(o => o.destroy(this.scene));
        this.obstacles = [];

        // Generate up to targetDist + a bit of buffer
        while (this.totalDistanceGenerated < targetDist + 60) {
            // First segment is always safe, others are safe if they're before the targetDist (roughly)
            const safe = this.totalDistanceGenerated < 15;
            this.addSegment(safe);
        }

        // Return the segment at targetDist for positioning
        return this.segments.find(s => targetDist >= s.dist && targetDist < s.dist + s.length) || this.segments[0];
    }

    resetGeneration() {
        this.currentPos.set(0, 0, 0);
        this.currentDir.set(0, 0, -1);
        this.currentRight.set(1, 0, 0);
        this.totalDistanceGenerated = 0;
        this.segmentCounter = 0;
    }

    setLevel(levelNum, scene) {
        this.currentLevel = levelNum;
        this.resetGeneration();
        const campaign = CAMPAIGNS.find(c => c.levels.includes(levelNum));
        if (campaign && campaign.env) {
            this.wallMaterial.color.setHex(campaign.env.wall);
            this.floorMaterial.color.setHex(campaign.env.floor);
            
            if (scene) {
                scene.fog.color.setHex(campaign.env.fog);
                if (scene.background) scene.background.setHex(campaign.env.fog);
                scene.traverse(obj => {
                    if (obj.isAmbientLight) obj.color.setHex(campaign.env.ambient);
                });
            }
        }
    }

    getDifficultyFactor() {
        // Returns a value starting at 1.0, increasing by 0.1 every DIFFICULTY_STEP_DISTANCE (250m)
        return 1.0 + Math.floor(this.totalDistanceGenerated / CONFIG.LEVEL.DIFFICULTY_STEP_DISTANCE) * 0.15;
    }

    addSegment(safe = false) {
        const length = CONFIG.LEVEL.SEGMENT_LENGTH;
        const width = CONFIG.LEVEL.HALLWAY_WIDTH;
        const height = CONFIG.LEVEL.WALL_HEIGHT;
        const diffFactor = this.getDifficultyFactor();
        
        const segment = new THREE.Group();
        
        // Force Y to 0 for perfect floor alignment
        const pos = this.currentPos.clone().add(this.currentDir.clone().multiplyScalar(length / 2));
        pos.y = 0; 
        segment.position.copy(pos);
        
        const angle = Math.atan2(this.currentDir.x, this.currentDir.z);
        segment.rotation.y = angle;
        
        const segmentIndex = this.segmentCounter++;
        const seed = (this.currentLevel * 1000) + segmentIndex;
        let localCounter = 0;
        const rng = () => {
            const x = Math.sin(seed + segmentIndex + (localCounter++)) * 10000;
            return x - Math.floor(x);
        };

        const lavaChance = Math.min(0.3 + (this.currentLevel * 0.04) + (diffFactor - 1) * 0.2, 0.7);
        const spikePitChance = Math.min(0.2 + (this.currentLevel * 0.03) + (diffFactor - 1) * 0.15, 0.5);
        const obstacleChance = Math.min(0.8 + (this.currentLevel * 0.02) + (diffFactor - 1) * 0.1, 0.99);

        // Floor Logic
        let floor;
        let isHoleOrLava = false;
        if (safe || segmentIndex < 2) {
            floor = new THREE.Mesh(new THREE.BoxGeometry(width, 1, length), this.floorMaterial);
        } else {
            const roll = rng();
            if (roll < spikePitChance) {
                isHoleOrLava = true;
                const holeGroup = new THREE.Group();
                const pitDepth = 4.0;
                const deepFloor = new THREE.Mesh(new THREE.BoxGeometry(width, 1.0, length), this.wallMaterial.clone());
                deepFloor.material.color.multiplyScalar(0.3);
                deepFloor.position.y = -pitDepth; 
                holeGroup.add(deepFloor);

                const pitWallMat = this.wallMaterial.clone();
                pitWallMat.color.multiplyScalar(0.2);
                const leftPitWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, pitDepth, length), pitWallMat);
                leftPitWall.position.set(-width / 2 + 0.25, -pitDepth / 2, 0);
                holeGroup.add(leftPitWall);
                const rightPitWall = leftPitWall.clone();
                rightPitWall.position.x *= -1;
                holeGroup.add(rightPitWall);

                const frontPitWall = new THREE.Mesh(new THREE.BoxGeometry(width, pitDepth, 0.5), pitWallMat);
                frontPitWall.position.set(0, -pitDepth / 2, -length / 2 + 0.25);
                holeGroup.add(frontPitWall);
                const backPitWall = frontPitWall.clone();
                backPitWall.position.z = length / 2 - 0.25;
                holeGroup.add(backPitWall);

                const curbMat = this.wallMaterial;
                const curbL = new THREE.Mesh(new THREE.BoxGeometry(1, 1, length), curbMat);
                curbL.position.set(-width/2 + 0.5, 0, 0);
                holeGroup.add(curbL);
                const curbR = curbL.clone(); curbR.position.x *= -1;
                holeGroup.add(curbR);

                this.addSpikesToSegment(segment, length, width - 2, rng, pos, -pitDepth + 0.5, diffFactor);
                this.addPlatformsToSegment(segment, length, width, rng, pos, true, diffFactor); 
                floor = holeGroup;
                floor.isPit = true;
            } else if (roll < spikePitChance + lavaChance) {
                isHoleOrLava = true;
                const lavaGroup = new THREE.Group();
                const lavaHeight = 10;
                const lavaPool = new THREE.Mesh(new THREE.BoxGeometry(width - 2, lavaHeight, length), this.lavaMaterial);
                lavaPool.position.y = -lavaHeight / 2 + 0.1; 
                lavaGroup.add(lavaPool);
                
                const curbMat = this.wallMaterial;
                const curbL = new THREE.Mesh(new THREE.BoxGeometry(1, 1, length), curbMat);
                curbL.position.set(-width/2 + 0.5, 0, 0);
                lavaGroup.add(curbL);
                const curbR = curbL.clone(); curbR.position.x *= -1;
                lavaGroup.add(curbR);

                const pitWallMat = this.wallMaterial.clone();
                pitWallMat.color.multiplyScalar(0.2);
                const wallDepth = 5;
                const leftPitWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, wallDepth, length), pitWallMat);
                leftPitWall.position.set(-width/2 + 0.25, -wallDepth/2, 0);
                lavaGroup.add(leftPitWall);
                const rightPitWall = leftPitWall.clone();
                rightPitWall.position.x *= -1;
                lavaGroup.add(rightPitWall);

                const frontRetainingWall = new THREE.Mesh(new THREE.BoxGeometry(width, wallDepth, 0.5), pitWallMat);
                frontRetainingWall.position.set(0, -wallDepth / 2, -length / 2 + 0.25);
                lavaGroup.add(frontRetainingWall);
                const backRetainingWall = frontRetainingWall.clone();
                backRetainingWall.position.z = length / 2 - 0.25;
                lavaGroup.add(backRetainingWall);

                floor = lavaGroup;
                floor.isDanger = true;
                this.addPlatformsToSegment(segment, length, width, rng, pos, false, diffFactor);
            } else {
                floor = new THREE.Mesh(new THREE.BoxGeometry(width, 1, length), this.floorMaterial);
            }
        }
        
        if (floor) {
            floor.receiveShadow = true;
            segment.add(floor);
        }

        // Side Walls - Full length to prevent abyss gaps
        const wallLength = length; 
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, height, wallLength), this.wallMaterial);
        leftWall.position.x = -width / 2 - 0.5;
        leftWall.position.y = height / 2 - 0.5;
        leftWall.position.z = 0;
        segment.add(leftWall);

        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, height, wallLength), this.wallMaterial);
        rightWall.position.x = width / 2 + 0.5;
        rightWall.position.y = height / 2 - 0.5;
        rightWall.position.z = 0;
        segment.add(rightWall);

        this.addWallDecor(segment, length, width, height, rng, segmentIndex);

        const distFromStart = this.totalDistanceGenerated;
        if (distFromStart > 0 && Math.floor(distFromStart) % CONFIG.LEVEL.STAGE_DISTANCE === 0) {
            if (this.currentLevel === 200) this.addDragonBoss(segment, width);
        }

        if (distFromStart === 0) {
            const backWall = new THREE.Mesh(new THREE.BoxGeometry(width + 2, height, 1), this.wallMaterial);
            backWall.position.z = -length / 2;
            backWall.position.y = height / 2 - 0.5;
            segment.add(backWall);
        }

        if (rng() > 0.3) {
            const side = rng() > 0.5 ? 1 : -1;
            this.addTorch(segment, side * (width / 2 + 0.45), 3, (rng() - 0.5) * length);
        }

        if (!isHoleOrLava && rng() > 0.6) {
            const propPos = pos.clone().add(this.currentRight.clone().multiplyScalar((rng() - 0.5) * (width - 2)));
            propPos.y = 0.5;
            const prop = new StaticProp(this.scene, {
                position: propPos,
                width: 1.5 + rng() * 2,
                height: 1 + rng() * 2,
                depth: 1.5 + rng() * 2,
                material: this.wallMaterial
            });
            this.obstacles.push(prop);
        }

        if (!safe && rng() < obstacleChance) {
            this.addObstaclesToSegment(segment, length, width, rng, pos, isHoleOrLava, diffFactor, segmentIndex);
        }

        this.scene.add(segment);
        const segmentData = { 
            mesh: segment, 
            center: pos, 
            direction: this.currentDir.clone(),
            right: this.currentRight.clone(),
            length: length,
            width: width,
            floor: floor,
            dist: this.totalDistanceGenerated,
            index: segmentIndex
        };
        this.segments.push(segmentData);
        
        this.currentPos.add(this.currentDir.clone().multiplyScalar(length));
        this.totalDistanceGenerated += length;

        // NEW: Much more conservative turn chance to prevent self-intersection "chaos"
        const turnChance = 0.08 + (this.currentLevel * 0.002); // Reduced from 0.15+
        if (!safe && segmentIndex > 5 && rng() < turnChance) {
            this.addCornerSegment(width, height, rng);
        }
    }

    addWallDecor(segment, length, width, height, rng, segmentIndex) {
        const decoMaterial = this.wallMaterial.clone();
        decoMaterial.color.multiplyScalar(0.7);

        const style = this.currentLevel % 3;
        const safeLength = length * 0.8;

        // 1. ADD PHYSICAL SIDE OBSTACLES (To prevent wall-hugging)
        // These are small stone blocks poking out from the walls at floor level
        const blockGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        const blockMat = this.wallMaterial.clone();
        blockMat.color.multiplyScalar(0.6);

        // Place 2 blocks per side in alternating patterns, slightly inward from ends
        // This prevents them from "popping" into intersections
        for (let i = 0; i < 2; i++) {
            const zOff = (i === 0 ? -0.25 : 0.25) * length;
            
            // Left Wall Block
            const lb = new THREE.Mesh(blockGeo, blockMat);
            lb.position.set(-width / 2 + 0.4, 0.6, zOff);
            lb.rotation.y = rng() * Math.PI;
            segment.add(lb);
            
            // Right Wall Block (Staggered)
            const rb = new THREE.Mesh(blockGeo, blockMat);
            rb.position.set(width / 2 - 0.4, 0.6, -zOff);
            rb.rotation.y = rng() * Math.PI;
            segment.add(rb);
        }

        if (style === 0) {
            // Pillars and Trims
            [-safeLength / 2, 0, safeLength / 2].forEach(pz => {
                const p1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, height, 0.8), decoMaterial);
                p1.position.set(-width / 2 - 0.2, height / 2 - 0.5, pz);
                segment.add(p1);
                const p2 = p1.clone(); p2.position.x *= -1;
                segment.add(p2);
            });
        } else if (style === 1) {
            // Arched Alcoves (represented by recessed wall panels)
            for (let i = -1; i <= 1; i += 2) {
                const alcove = new THREE.Mesh(new THREE.BoxGeometry(0.4, height * 0.7, safeLength), decoMaterial);
                alcove.position.set(i * (width / 2 + 0.1), height / 2, 0);
                segment.add(alcove);
            }
        } else {
            // Horizontal bands
            [1, 3, 5].forEach(y => {
                const band = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, length - 2.0), decoMaterial);
                band.position.set(-width / 2 - 0.3, y, 0);
                segment.add(band);
                const band2 = band.clone(); band2.position.x *= -1;
                segment.add(band2);
            });
        }
    }

    addCornerSegment(width, height, rng) {
        const segment = new THREE.Group();
        const size = width; 
        const wallThick = 1.0;
        
        // The corner center is size/2 from the entry point
        const cornerPos = this.currentPos.clone().add(this.currentDir.clone().multiplyScalar(size / 2));
        segment.position.copy(cornerPos);
        
        const angle = Math.atan2(this.currentDir.x, this.currentDir.z);
        segment.rotation.y = angle;

        // Corner Floor - Slightly oversized to prevent gaps (10.1 x 10.1)
        const floor = new THREE.Mesh(new THREE.BoxGeometry(size + 0.1, 1, size + 0.1), this.floorMaterial);
        floor.receiveShadow = true;
        segment.add(floor);

        // Turn direction
        const isRightTurn = rng() > 0.5;
        const turnAngle = isRightTurn ? -Math.PI / 2 : Math.PI / 2;
        
        // Wall Materials
        const wallMat = this.wallMaterial;
        
        // 1. The Outer Corner (L-shape)
        // One wall along the side, one wall blocking the front
        const sideWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, size + wallThick), wallMat);
        const frontWall = new THREE.Mesh(new THREE.BoxGeometry(size + wallThick, height, wallThick), wallMat);
        
        if (isRightTurn) {
            // Right Turn (Exit local -X)
            // Outer corner is at local +X and +Z
            sideWall.position.set(size / 2 + wallThick / 2, height / 2 - 0.5, 0);
            frontWall.position.set(0, height / 2 - 0.5, size / 2 + wallThick / 2);
        } else {
            // Left Turn (Exit local +X)
            // Outer corner is at local -X and +Z
            sideWall.position.set(-size / 2 - wallThick / 2, height / 2 - 0.5, 0);
            frontWall.position.set(0, height / 2 - 0.5, size / 2 + wallThick / 2);
        }
        segment.add(sideWall);
        segment.add(frontWall);

        // 2. The Inner Corner (Pillar)
        // Positioned at the inner junction to fill the gap
        const pillarSize = 1.2;
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(pillarSize, height, pillarSize), wallMat);
        if (isRightTurn) {
            // Inner corner is local -X and -Z
            pillar.position.set(-size / 2 - pillarSize / 2, height / 2 - 0.5, -size / 2 - pillarSize / 2);
        } else {
            // Inner corner is local +X and -Z
            pillar.position.set(size / 2 + pillarSize / 2, height / 2 - 0.5, -size / 2 - pillarSize / 2);
        }
        segment.add(pillar);

        this.scene.add(segment);
        
        const segmentIndex = this.segmentCounter++;
        const segmentData = {
            mesh: segment,
            center: cornerPos,
            direction: this.currentDir.clone(),
            right: this.currentRight.clone(),
            length: size,
            width: size,
            floor: floor,
            isCorner: true,
            isRightTurn: isRightTurn,
            dist: this.totalDistanceGenerated,
            index: segmentIndex
        };
        this.segments.push(segmentData);

        // Update vectors for next segments
        const rotationMatrix = new THREE.Matrix4().makeRotationY(turnAngle);
        this.currentDir.applyMatrix4(rotationMatrix).normalize();
        this.currentRight.applyMatrix4(rotationMatrix).normalize();
        
        // Set next currentPos at the exit face of the corner square
        this.currentPos.copy(cornerPos).add(this.currentDir.clone().multiplyScalar(size / 2));
        this.totalDistanceGenerated += size;
    }

    addPlatformsToSegment(segment, length, width, rng, segmentCenter, isStatic = false, diffFactor = 1) {
        const numPlatforms = isStatic ? 2 : 3; 
        const segmentRotation = segment.rotation.clone();
        for (let i = 0; i < numPlatforms; i++) {
            const zOffset = (length / 2) - ((i + 1) * (length / (numPlatforms + 1)));
            const platPos = segmentCenter.clone();
            platPos.y = 1.2; 
            platPos.add(this.currentDir.clone().multiplyScalar(zOffset));
            
            const platform = new MovingPlatform(this.scene, {
                position: platPos.clone().add(this.currentRight.clone().multiplyScalar((rng() - 0.5) * (width - 4))),
                rotation: segmentRotation,
                width: 4.5,
                depth: 4.5,
                amplitude: isStatic ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(rng() * 4 * diffFactor, 0, 0), 
                speed: (1.2 + rng()) * diffFactor
            });
            this.obstacles.push(platform);
        }
    }

    addSpikesToSegment(segment, length, width, rng, segmentCenter, yLevel = 0, diffFactor = 1) {
        const numSpikes = Math.max(1, Math.floor((length / 24) * diffFactor)); 
        for (let i = 0; i < numSpikes; i++) {
            const zOffset = (rng() - 0.5) * (length * 0.8);
            const subPos = segmentCenter.clone().add(this.currentDir.clone().multiplyScalar(zOffset));
            subPos.y = yLevel;
            const spike = new SpikeTrap(this.scene, {
                position: subPos.clone().add(this.currentRight.clone().multiplyScalar((rng() - 0.5) * (width - 3))),
                size: 3,
                speed: (1.5 + rng() * 2) * diffFactor
            });
            this.obstacles.push(spike);
        }
    }

    addObstaclesToSegment(segmentGroup, length, width, rng, segmentCenter, isHoleOrLava = false, diffFactor = 1, segmentIndex) {
        // Reduced hazard density: 1 hazard per 20m of level progress, capped at 3 per segment
        const numHazards = Math.min(3, Math.floor((1 + Math.floor(this.totalDistanceGenerated / 200)) * diffFactor)); 
        const totalTime = performance.now() / 1000;

        for (let i = 0; i < numHazards; i++) {
            const zOffset = (rng() - 0.5) * (length * 0.7); 
            const roll = rng();

            if (roll > 0.85) {
                // Swinging Hammer (Pendulum)
                const hammer = new SwingingHammer(segmentGroup, {
                    position: new THREE.Vector3(0, 0, zOffset),
                    pivotHeight: 12,
                    handleLength: 10,
                    speed: (1.2 + (this.currentLevel * 0.05)) * diffFactor,
                    angle: Math.PI / 3 + (rng() * 0.2)
                });
                hammer.segmentIndex = segmentIndex; // Tag for isolation
                this.obstacles.push(hammer);
            } else if (roll > 0.7) {
                // Rotating Blade (Floor-based)
                if (isHoleOrLava) continue;
                const blade = new RotatingBlade(segmentGroup, {
                    position: new THREE.Vector3((rng() - 0.5) * 4, 1.4, zOffset),
                    height: 1.4,
                    speed: (4 + (this.currentLevel * 0.15)) * diffFactor
                });
                blade.segmentIndex = segmentIndex; 
                this.obstacles.push(blade);
            } else if (roll > 0.55) {
                // Laser Trap
                const laser = new LaserTrap(segmentGroup, {
                    position: new THREE.Vector3(-width / 2 + 0.5, 1.6, zOffset),
                    direction: new THREE.Vector3(1, 0, 0), 
                    length: width - 1.0,
                    blinkRate: (1.0 + (this.currentLevel * 0.08)) * diffFactor
                });
                laser.segmentIndex = segmentIndex;
                this.obstacles.push(laser);
            } else if (roll > 0.4) {
                // Arrow Trap
                const arrow = new ArrowTrap(segmentGroup, {
                    position: new THREE.Vector3(-width / 2, 1.8, zOffset),
                    direction: new THREE.Vector3(1, 0, 0), 
                    fireRate: Math.max(1.0, (2.5 - (this.currentLevel * 0.05)) / diffFactor),
                    startTime: totalTime + rng() * 2,
                    parentSegment: segmentGroup // NEW: Logical Isolation
                });
                arrow.segmentIndex = segmentIndex;
                this.obstacles.push(arrow);
            } else if (roll > 0.25) {
                // Archer
                if (isHoleOrLava) continue;
                const worldPos = segmentCenter.clone().add(this.currentDir.clone().multiplyScalar(zOffset))
                                .add(this.currentRight.clone().multiplyScalar((rng() - 0.5) * (width - 2)));
                worldPos.y = 0.5;
                const archer = new Archer(this.scene, { position: worldPos });
                archer.segmentIndex = segmentIndex;
                this.obstacles.push(archer);
            } else if (roll > 0.1) {
                // Gargoyle
                const worldPos = segmentCenter.clone().add(this.currentDir.clone().multiplyScalar(zOffset));
                worldPos.y = 5 + rng() * 3;
                const gargoyle = new Gargoyle(this.scene, { position: worldPos });
                gargoyle.segmentIndex = segmentIndex;
                this.obstacles.push(gargoyle);
            } else {
                // Spike Trap (Floor-based)
                if (isHoleOrLava) continue;
                const spike = new SpikeTrap(segmentGroup, {
                    position: new THREE.Vector3((rng() - 0.5) * (width - 2), 0.5, zOffset),
                    speed: (1.5 + rng() * 2) * diffFactor
                });
                spike.segmentIndex = segmentIndex;
                this.obstacles.push(spike);
            }
        }
    }

    addDragonBoss(segment, width) {
        const pos = this.currentPos.clone().add(this.currentDir.clone().multiplyScalar(15));
        const dragon = new DragonBoss(this.scene, {
            position: pos,
            onDeath: () => {}
        });
        dragon.group.rotation.copy(segment.rotation);
        // Boss should face the player approaching (flip rotation)
        dragon.group.rotateY(Math.PI);
        this.obstacles.push(dragon);

        const arena = new THREE.Mesh(new THREE.BoxGeometry(width * 2, 0.5, 40), this.floorMaterial);
        arena.position.copy(pos);
        arena.rotation.copy(segment.rotation);
        this.scene.add(arena);

        // Add dramatic torches around arena
        for (let i = -1; i <= 1; i += 2) {
            for (let j = -1; j <= 1; j += 2) {
                const tPos = new THREE.Vector3(i * width, 4, j * 15);
                const torch = new Torch(null, {
                    position: tPos,
                    side: i > 0 ? 'right' : 'left',
                    fireTexture: CONFIG.ASSETS.TORCH_FIRE
                });
                // Arena is separate from segment, but we can add to a temporary group or segment
                // Let's add them to segment so they are relative to the arena position
                torch.group.position.add(pos);
                torch.group.rotation.copy(segment.rotation);
                this.scene.add(torch.group);
                this.obstacles.push(torch);
            }
        }
    }

    addMilestoneGate(segment, width, height, stageNum) {
        const gateGroup = new THREE.Group();
        const arch = new THREE.Mesh(new THREE.BoxGeometry(width + 2, 2, 2), this.wallMaterial);
        arch.position.y = height - 1;
        gateGroup.add(arch);
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), new THREE.MeshStandardMaterial({ 
            color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 2, side: THREE.DoubleSide
        }));
        banner.position.y = height - 3; banner.position.z = 0.1;
        gateGroup.add(banner);
        segment.add(gateGroup);
    }

    addTorch(segment, x, y, z) {
        const side = x > 0 ? 'right' : 'left';
        const torch = new Torch(null, {
            position: new THREE.Vector3(x, y, z),
            side: side,
            fireTexture: CONFIG.ASSETS.TORCH_FIRE
        });
        segment.add(torch.group);
        this.obstacles.push(torch);
    }

    update(deltaTime, currentDist, playerPos) {
        // Keep generating segments ahead of the player (at least 300m ahead)
        while (this.totalDistanceGenerated < currentDist + 300) {
            this.addSegment();
        }

        const totalTime = performance.now() / 1000;
        this.obstacles.forEach(o => {
            if (o instanceof Gargoyle || o instanceof Archer) {
                o.update(deltaTime, totalTime, playerPos);
                // Also update any projectiles they've fired
                for (let i = o.projectiles.length - 1; i >= 0; i--) {
                    const p = o.projectiles[i];
                    p.update(deltaTime);
                    if (p.isDead) o.projectiles.splice(i, 1);
                }
            } else {
                o.update(deltaTime, totalTime);
            }
        });
        
        // Cleanup segments far behind the player (at least 100m past)
        if (this.segments.length > 20) {
            const oldest = this.segments[0];
            if (currentDist > oldest.dist + oldest.length + 100) {
                // Remove the segment mesh from scene
                this.scene.remove(oldest.mesh);
                
                // Destroy all obstacles belonging to this segment index
                this.obstacles = this.obstacles.filter(o => {
                    if (o.segmentIndex === oldest.index) {
                        o.destroy(this.scene);
                        return false;
                    }
                    return true;
                });
                
                this.segments.shift();
            }
        }
    }

    checkCollision(playerPos, currentDist = 0) {
        const result = { 
            isLethal: false, 
            lethalDamage: 20, 
            groundY: -20, 
            isGrounded: false, 
            platform: null, 
            currentDist: currentDist, 
            activeSegment: null,
            nearSegments: [] 
        };
        
        this.scene.updateMatrixWorld(true);

        // 1. Find the active segment and near segments
        // CRITICAL FIX: We only consider segments that are logically near the player's PATH distance.
        // This prevents "ghost collisions" if the path loops back near an old segment in 3D space.
        for (let i = this.segments.length - 1; i >= 0; i--) {
            const s = this.segments[i];
            
            // Only check segments within a reasonable path-distance window (e.g., +/- 40m)
            const pathDistDiff = Math.abs(s.dist - currentDist);
            if (pathDistDiff > 60 && currentDist > 20) continue; 

            const toCenter = playerPos.clone().sub(s.center);
            const distForward = toCenter.dot(s.direction);
            const distRight = toCenter.dot(s.right);
            
            const halfL = s.length / 2;
            const halfW = s.width / 2;

            // Strict check for active segment
            if (!result.activeSegment && Math.abs(distForward) <= halfL + 0.5 && Math.abs(distRight) <= halfW + 0.5) {
                result.activeSegment = s;
            }

            // Near check for clamping and collision
            if (Math.abs(distForward) <= halfL + 1.5 && Math.abs(distRight) <= halfW + 1.5) {
                result.nearSegments.push(s);
            }
        }

        // Fallback for active segment if strict check fails
        if (!result.activeSegment && result.nearSegments.length > 0) {
            result.activeSegment = result.nearSegments[0];
        }

        if (result.activeSegment) {
            const trackingSeg = result.activeSegment;
            const toCenter = playerPos.clone().sub(trackingSeg.center);
            const distForward = toCenter.dot(trackingSeg.direction);
            const distRight = toCenter.dot(trackingSeg.right);

            if (trackingSeg.isCorner) {
                // In a corner, progress is forward then lateral
                const fwdProgress = Math.min(distForward + trackingSeg.length / 2, trackingSeg.length / 2);
                // For Right Turn (to local -X), latProgress is positive when distRight is negative
                // For Left Turn (to local +X), latProgress is positive when distRight is positive
                const latProgress = trackingSeg.isRightTurn ? Math.max(0, -distRight) : Math.max(0, distRight);
                result.currentDist = trackingSeg.dist + fwdProgress + latProgress;
            } else {
                result.currentDist = trackingSeg.dist + (distForward + trackingSeg.length / 2);
            }
        }

        // 2. Physical Segment (Strict grounding and hazards)
        // Use the active segment for primary grounding logic
        const physicalSeg = result.activeSegment;

        if (physicalSeg && physicalSeg.floor) {
            const toCenter = playerPos.clone().sub(physicalSeg.center);
            const distRight = toCenter.dot(physicalSeg.right);
            const distForward = toCenter.dot(physicalSeg.direction);
            
            // Safe if on side curbs OR on front/back retaining walls (REDUCED SAFE ZONE TO PREVENT CHEATING)
            const isOnCurb = Math.abs(distRight) > physicalSeg.width / 2 - 0.2;
            const isOnEndWall = Math.abs(distForward) > physicalSeg.length / 2 - 0.2;
            const isSafeFloor = isOnCurb || isOnEndWall;

            if (physicalSeg.floor.isPit) {
                if (isSafeFloor) {
                    result.groundY = 0.5;
                    if (playerPos.y <= 0.7) result.isGrounded = true;
                } else {
                    result.groundY = -4.0 + 0.5; 
                    if (playerPos.y <= -3.25) result.isGrounded = true;
                }
            } else if (physicalSeg.floor.isDanger) {
                if (isSafeFloor) {
                    result.groundY = 0.5;
                    if (playerPos.y <= 0.7) result.isGrounded = true;
                } else {
                    result.groundY = -20;
                    result.isGrounded = false;
                }
            } else {
                result.groundY = 0.5;
                if (playerPos.y <= 0.7) result.isGrounded = true;
            }
        } else if (playerPos.y < -15) {
            result.isLethal = true;
            return result;
        }

        // 4. Check for grounding on platforms/props (overrides segment grounding)
        let isOnSafeObject = false;
        for (const o of this.obstacles) {
            if (o instanceof MovingPlatform || o instanceof StaticProp) {
                const mesh = o.mesh;
                const localPos = playerPos.clone().sub(mesh.getWorldPosition(new THREE.Vector3()));
                const worldQuat = new THREE.Quaternion();
                mesh.getWorldQuaternion(worldQuat);
                localPos.applyQuaternion(worldQuat.invert());
                
                const halfW = o.width / 2;
                const halfD = o.depth / 2;
                
                if (Math.abs(localPos.x) < halfW + 0.5 && Math.abs(localPos.z) < halfD + 0.5) {
                    const top = mesh.getWorldPosition(new THREE.Vector3()).y + (o.height / 2);
                    if (playerPos.y >= top - 0.6) {
                        if (top > result.groundY - 0.1) {
                            result.groundY = top;
                            if (playerPos.y <= top + 0.5) {
                                result.isGrounded = true;
                                isOnSafeObject = true;
                                if (o instanceof MovingPlatform) result.platform = o;
                            }
                        }
                    }
                }
            }
        }

        // 5. Lethal Hazard Checks
        for (const o of this.obstacles) {
            // NEW: Logical Isolation Pass
            // Only check hazards that are in segments physically and logically near the player
            const hazardSegmentIndex = o.segmentIndex;
            if (hazardSegmentIndex !== undefined) {
                const seg = result.nearSegments.find(s => s.index === hazardSegmentIndex);
                if (!seg) continue; // Skip hazard if its segment is not near the player logically
            }

            if (o instanceof SwingingHammer) {
                const headPos = new THREE.Vector3();
                o.headGroup.getWorldPosition(headPos);
                const hammerRadius = o.headSize || 2.2;
                const playerCenter = new THREE.Vector3(playerPos.x, playerPos.y + 1.4, playerPos.z);
                if (headPos.distanceTo(playerCenter) < hammerRadius + 0.8) { result.isLethal = true; return result; }
            }
            if (o instanceof RotatingBlade) {
                const playerCenter = new THREE.Vector3(playerPos.x, playerPos.y + 1.4, playerPos.z);
                const bladePos = new THREE.Vector3();
                if (o.group) o.group.getWorldPosition(bladePos);
                else o.mesh.getWorldPosition(bladePos);

                if (playerCenter.distanceTo(bladePos) < o.bladeRadius + 0.5 && Math.abs(playerCenter.y - bladePos.y) < 1.2) {
                    result.isLethal = true; return result;
                }
            }
            if (o instanceof LaserTrap && o.isOn) {
                const playerCenter = new THREE.Vector3(playerPos.x, playerPos.y + 1.4, playerPos.z);
                const beamStart = new THREE.Vector3();
                o.group.getWorldPosition(beamStart);
                
                const worldQuat = new THREE.Quaternion();
                o.group.getWorldQuaternion(worldQuat);
                const worldDir = o.direction.clone().applyQuaternion(worldQuat);
                
                const beamEnd = beamStart.clone().add(worldDir.multiplyScalar(o.length));
                const line = new THREE.Line3(beamStart, beamEnd);
                const cp = new THREE.Vector3(); 
                line.closestPointToPoint(playerCenter, true, cp);
                if (cp.distanceTo(playerCenter) < 1.0) { result.isLethal = true; return result; }
            }
            if (o instanceof DragonBoss) {
                const playerCenter = new THREE.Vector3(playerPos.x, playerPos.y + 1.4, playerPos.z);
                for (const fireball of o.fireballs) {
                    if (fireball.position.distanceTo(playerCenter) < 1.8) { result.isLethal = true; return result; }
                }
                const bossPos = new THREE.Vector3();
                o.group.getWorldPosition(bossPos);
                if (playerCenter.distanceTo(bossPos) < 8) { result.isLethal = true; return result; }
            }
            if (o instanceof SpikeTrap && o.isExtended) {
                const trapPos = new THREE.Vector3();
                o.group.getWorldPosition(trapPos);
                const dx = Math.abs(playerPos.x - trapPos.x);
                const dz = Math.abs(playerPos.z - trapPos.z);
                const dy = playerPos.y - trapPos.y;
                const buffer = 1.0; 
                if (dx < (o.width / 2 + buffer) && dz < (o.depth / 2 + buffer)) {
                    const spikesTopY = trapPos.y + 2.4;
                    const playerBottomY = playerPos.y;
                    const playerTopY = playerPos.y + 2.5;
                    if (spikesTopY > playerBottomY && playerTopY > trapPos.y) {
                        result.isLethal = true;
                        return result;
                    }
                }
            }
            if (o instanceof ArrowTrap) {
                const pMin = new THREE.Vector3(playerPos.x - 0.45, playerPos.y, playerPos.z - 0.45);
                const pMax = new THREE.Vector3(playerPos.x + 0.45, playerPos.y + 2.5, playerPos.z + 0.45);
                for (const arrow of o.arrows) {
                    const arrowPos = new THREE.Vector3();
                    arrow.getWorldPosition(arrowPos);
                    
                    // NEW: Logical Arrow Mask - Only collide if arrow is within a nearby segment
                    if (arrowPos.x >= pMin.x && arrowPos.x <= pMax.x &&
                        arrowPos.y >= pMin.y && arrowPos.y <= pMax.y &&
                        arrowPos.z >= pMin.z && arrowPos.z <= pMax.z) {
                        result.isLethal = true;
                        return result;
                    }
                }
            }
            if (o instanceof Gargoyle || o instanceof Archer) {
                if (o.isDead) continue;
                const playerCenter = new THREE.Vector3(playerPos.x, playerPos.y + 1.4, playerPos.z);
                const enemyPos = new THREE.Vector3();
                o.group.getWorldPosition(enemyPos);
                
                // Physical collision with enemy
                if (playerCenter.distanceTo(enemyPos.clone().add(new THREE.Vector3(0, 1, 0))) < 1.5) {
                    result.isLethal = true;
                    return result;
                }

                // Collision with enemy projectiles
                for (const p of o.projectiles) {
                    const projectilePos = new THREE.Vector3();
                    p.group.getWorldPosition(projectilePos);
                    if (playerCenter.distanceTo(projectilePos) < 1.0) {
                        result.isLethal = true;
                        p.destroy();
                        return result;
                    }
                }
            }
        }

        // 6. Lava check (only kill if NOT on a safe object/platform AND physically over danger)
        if (!isOnSafeObject && physicalSeg && physicalSeg.floor && physicalSeg.floor.isDanger) {
            const toCenter = playerPos.clone().sub(physicalSeg.center);
            const distRight = toCenter.dot(physicalSeg.right);
            const distForward = toCenter.dot(physicalSeg.direction);
            
            // Safe if on side curbs OR on front/back retaining walls
            const isOnCurb = Math.abs(distRight) > physicalSeg.width / 2 - 1.05;
            const isOnEndWall = Math.abs(distForward) > physicalSeg.length / 2 - 0.55;
            const isSafeFloor = isOnCurb || isOnEndWall;
            
            if (!isSafeFloor && playerPos.y < 1.0) {
                result.isLethal = true;
                result.lethalDamage = 100; // Instant death in lava
                return result;
            }
        }

        return result;
    }
}
