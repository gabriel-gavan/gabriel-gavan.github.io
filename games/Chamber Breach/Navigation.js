import * as THREE from 'three';

export class Navigation {
    constructor(map, gridSize = 1.0) {
        this.map = map;
        this.gridSize = gridSize;
        this.grid = new Map(); // key: "gx,gz", value: { x, z, walkable, door: doorObj }
        this.bounds = new THREE.Box3();
        
        // Worker support
        this.worker = new Worker('./NavigationWorker.js', { type: 'module' });
        this.pendingRequests = new Map(); // id -> callback
        this.requestIdCounter = 0;
        
        this.worker.onmessage = (e) => {
            const { type, id, path } = e.data;
            if (type === 'PATH_RESULT') {
                const callback = this.pendingRequests.get(id);
                if (callback) {
                    this.pendingRequests.delete(id);
                    callback(path);
                }
            }
        };

        this.init();
    }

    init() {
        // Calculate total level bounds
        if (!this.map.chambers || this.map.chambers.length === 0) {
            console.warn('Navigation: No chambers found in map, skipping init.');
            return;
        }

        // Reset bounds and grid before calculation
        this.bounds.makeEmpty();
        this.grid.clear();

        this.map.chambers.forEach(chamber => {
            const halfSize = chamber.size / 2;
            this.bounds.expandByPoint(new THREE.Vector3(chamber.x - halfSize - 2, 0, chamber.z - halfSize - 2));
            this.bounds.expandByPoint(new THREE.Vector3(chamber.x + halfSize + 2, 5, chamber.z + halfSize + 2));
        });

        this.generateGrid();
        this.syncGridToWorker();
    }

    syncGridToWorker() {
        // Convert Map grid to a flat Uint8Array for worker
        const min = this.bounds.min;
        const max = this.bounds.max;
        
        const width = Math.round((max.x - min.x) / this.gridSize) + 1;
        const height = Math.round((max.z - min.z) / this.gridSize) + 1;

        if (width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) {
            console.warn('Navigation: Invalid grid dimensions', width, height);
            return;
        }

        const nodes = new Uint8Array(width * height);
        
        // Map door objects to indices for worker
        this.doorToIndex = new Map();
        this.map.doors.forEach((door, index) => {
            this.doorToIndex.set(door, index);
        });

        for (let x = 0; x < width; x++) {
            for (let z = 0; z < height; z++) {
                const worldX = min.x + x * this.gridSize;
                const worldZ = min.z + z * this.gridSize;
                const node = this.getGridNode({ x: worldX, z: worldZ });
                const index = z * width + x;
                
                if (!node) {
                    nodes[index] = 0; // Blocked
                } else if (node.door) {
                    const doorIdx = this.doorToIndex.get(node.door);
                    nodes[index] = 2 + doorIdx; // 2+ is door ID
                } else if (node.isStaticWall) {
                    nodes[index] = 0;
                } else {
                    nodes[index] = 1; // Walkable
                }
            }
        }

        this.worker.postMessage({
            type: 'INIT_GRID',
            data: {
                nodes,
                width,
                height,
                minX: min.x,
                minZ: min.z,
                size: this.gridSize
            }
        });
    }

    findPathAsync(startPos, targetPos, callback) {
        const id = this.requestIdCounter++;
        this.pendingRequests.set(id, callback);

        // Prepare door states
        const doorStates = this.map.doors.map(d => d.isOpen);

        // Prepare relevant hazards
        const hazards = (this.map.hazards || []).filter(h => {
            if (!h) return false;
            const isHazardActive = h.isActive !== undefined ? h.isActive : 
                                  (h.isExpired !== undefined ? !h.isExpired : true);
            if (!isHazardActive) return false;
            
            const hPos = h.position || (h.group ? h.group.position : (h.mesh ? h.mesh.position : null));
            if (!hPos) return false;
            
            const distSq = Math.min(
                hPos.distanceToSquared(startPos),
                hPos.distanceToSquared(targetPos)
            );
            return distSq < 1600; 
        }).map(h => {
            const hPos = h.position || (h.group ? h.group.position : (h.mesh ? h.mesh.position : null));
            return {
                x: hPos.x,
                z: hPos.z,
                radiusSq: (h.radius || 2.5) ** 2
            };
        });

        this.worker.postMessage({
            type: 'FIND_PATH',
            data: {
                id,
                start: { x: startPos.x, z: startPos.z },
                target: { x: targetPos.x, z: targetPos.z },
                doorStates,
                hazards
            }
        });
    }

    generateGrid() {
        // Generate nodes only for chambers and corridors to avoid massive empty space checks
        this.map.chambers.forEach(chamber => {
            const halfSize = chamber.size / 2 + 1; 
            for (let x = chamber.x - halfSize; x <= chamber.x + halfSize; x += this.gridSize) {
                for (let z = chamber.z - halfSize; z <= chamber.z + halfSize; z += this.gridSize) {
                    this.addNodeAt(x, z, chamber.index);
                }
            }
        });

        if (this.map.corridorBounds) {
            this.map.corridorBounds.forEach(cb => {
                for (let x = cb.x - cb.hw; x <= cb.x + cb.hw; x += this.gridSize) {
                    for (let z = cb.z - cb.hd; z <= cb.z + cb.hd; z += this.gridSize) {
                        this.addNodeAt(x, z, cb.index);
                    }
                }
            });
        }
    }

    addNodeAt(x, z, chamberIdx = null) {
        const gx = Math.round(x / this.gridSize);
        const gz = Math.round(z / this.gridSize);
        const key = `${gx},${gz}`;
        if (this.grid.has(key)) return;

        const pos = new THREE.Vector3(gx * this.gridSize, 0.5, gz * this.gridSize);
        // Optimization: Pass chamberIdx to avoid expensive spatial lookup
        const isWall = this.map.checkCollision(pos, this.gridSize * 0.7, chamberIdx); 
        
        let door = null;
        for (const d of this.map.doors) {
            // Only check doors in relevant chambers
            if (chamberIdx !== null && d.chamberIndex !== chamberIdx && d.chamberIndex !== chamberIdx - 1 && d.chamberIndex !== chamberIdx + 1) continue;
            
            if (d.boxL.intersectsSphere(new THREE.Sphere(pos, this.gridSize * 0.5)) ||
                d.boxR.intersectsSphere(new THREE.Sphere(pos, this.gridSize * 0.5))) {
                door = d;
                break;
            }
        }

        if (!isWall || door) {
            this.grid.set(key, { 
                x: gx * this.gridSize, 
                z: gz * this.gridSize, 
                walkable: !isWall || (door && door.isOpen),
                isStaticWall: isWall && !door,
                door: door 
            });
        }
    }

    getGridNode(pos) {
        const gx = Math.round(pos.x / this.gridSize);
        const gz = Math.round(pos.z / this.gridSize);
        return this.grid.get(`${gx},${gz}`);
    }

    getScoreKey(node) {
        const gx = Math.round(node.x / this.gridSize);
        const gz = Math.round(node.z / this.gridSize);
        return (gx + 1000) << 12 | (gz + 1000);
    }

    isNodeWalkable(node, activeHazards = []) {
        if (!node) return false;
        if (node.isStaticWall) return false;
        if (node.door) return node.door.isOpen;
        
        for (let i = 0; i < activeHazards.length; i++) {
            const h = activeHazards[i];
            const hPos = h.position || (h.group ? h.group.position : (h.mesh ? h.mesh.position : null));
            if (!hPos) continue;

            const dx = node.x - hPos.x;
            const dz = node.z - hPos.z;
            const rad = h.radius || 2.5;
            
            if (dx*dx + dz*dz < rad * rad) return false; 
        }

        return node.walkable;
    }

    // Static structures to avoid GC
    static _reusableMaps = {
        cameFrom: new Map(),
        gScore: new Map(),
        fScore: new Map(),
        closedSet: new Set(),
        openSet: []
    };

    findPath(startPos, targetPos) {
        const startNode = this.getGridNode(startPos);
        const targetNode = this.getGridNode(targetPos);

        if (!startNode || !targetNode) return null;
        if (startNode === targetNode) return [targetPos];

        const { cameFrom, gScore, fScore, closedSet, openSet } = Navigation._reusableMaps;
        cameFrom.clear();
        gScore.clear();
        fScore.clear();
        closedSet.clear();
        openSet.length = 0;

        const activeHazards = (this.map.hazards || []).filter(h => {
            if (!h) return false;
            const isHazardActive = h.isActive !== undefined ? h.isActive : 
                                  (h.isExpired !== undefined ? !h.isExpired : true);
            if (!isHazardActive) return false;
            
            const hPos = h.position || (h.group ? h.group.position : (h.mesh ? h.mesh.position : null));
            if (!hPos) return false;
            
            const distSq = Math.min(
                hPos.distanceToSquared(startPos),
                hPos.distanceToSquared(targetPos)
            );
            return distSq < 1600; 
        });

        openSet.push(startNode);
        const startKey = this.getScoreKey(startNode);
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startNode, targetNode));

        let iterations = 0;
        const MAX_ITERATIONS = 200; 

        while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
            iterations++;
            
            let currentIndex = 0;
            let lowestF = Infinity;
            for (let i = 0; i < openSet.length; i++) {
                const score = fScore.get(this.getScoreKey(openSet[i])) ?? Infinity;
                if (score < lowestF) {
                    lowestF = score;
                    currentIndex = i;
                }
            }
            
            const current = openSet.splice(currentIndex, 1)[0];
            const currentKey = this.getScoreKey(current);
            
            if (current === targetNode) {
                return this.reconstructPath(cameFrom, current);
            }

            closedSet.add(currentKey);

            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                const neighborKey = this.getScoreKey(neighbor);
                if (closedSet.has(neighborKey)) continue;
                if (!this.isNodeWalkable(neighbor, activeHazards)) continue;

                const tentativeGScore = gScore.get(currentKey) + this.distance(current, neighbor);

                if (tentativeGScore < (gScore.get(neighborKey) ?? Infinity)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeGScore);
                    fScore.set(neighborKey, tentativeGScore + this.heuristic(neighbor, targetNode));
                    
                    if (!openSet.includes(neighbor)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }

        return [targetPos]; 
    }

    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
    }

    distance(a, b) {
        return Math.sqrt((a.x - b.x)**2 + (a.z - b.z)**2);
    }

    getNeighbors(node) {
        const neighbors = [];
        const gx = Math.round(node.x / this.gridSize);
        const gz = Math.round(node.z / this.gridSize);

        // Orthogonal
        let n;
        n = this.grid.get(`${gx+1},${gz}`); if(n) neighbors.push(n);
        n = this.grid.get(`${gx-1},${gz}`); if(n) neighbors.push(n);
        n = this.grid.get(`${gx},${gz+1}`); if(n) neighbors.push(n);
        n = this.grid.get(`${gx},${gz-1}`); if(n) neighbors.push(n);
        
        // Diagonals (optional, but keep for smooth movement)
        n = this.grid.get(`${gx+1},${gz+1}`); if(n) neighbors.push(n);
        n = this.grid.get(`${gx+1},${gz-1}`); if(n) neighbors.push(n);
        n = this.grid.get(`${gx-1},${gz+1}`); if(n) neighbors.push(n);
        n = this.grid.get(`${gx-1},${gz-1}`); if(n) neighbors.push(n);

        return neighbors;
    }

    reconstructPath(cameFrom, current) {
        const path = [new THREE.Vector3(current.x, 0.5, current.z)];
        let currentKey = this.getScoreKey(current);
        
        while (cameFrom.has(currentKey)) {
            current = cameFrom.get(currentKey);
            currentKey = this.getScoreKey(current);
            path.unshift(new THREE.Vector3(current.x, 0.5, current.z));
        }
        return path;
    }
}