import * as THREE from 'three';

export class Navigation {
    constructor(map, gridSize = 1.0) {
        this.map = map;
        this.gridSize = gridSize;
        this.grid = new Map(); // key: "x,z", value: { x, z, walkable, door: doorObj }
        this.bounds = new THREE.Box3();
        this.init();
    }

    init() {
        // Calculate total level bounds
        this.map.chambers.forEach(chamber => {
            const halfSize = chamber.size / 2;
            this.bounds.expandByPoint(new THREE.Vector3(chamber.x - halfSize - 2, 0, chamber.z - halfSize - 2));
            this.bounds.expandByPoint(new THREE.Vector3(chamber.x + halfSize + 2, 5, chamber.z + halfSize + 2));
        });

        this.generateGrid();
    }

    generateGrid() {
        // 1. Generate nodes for all chambers
        this.map.chambers.forEach(chamber => {
            const halfSize = chamber.size / 2 + 1; // Slight padding
            for (let x = chamber.x - halfSize; x <= chamber.x + halfSize; x += this.gridSize) {
                for (let z = chamber.z - halfSize; z <= chamber.z + halfSize; z += this.gridSize) {
                    this.addNodeAt(x, z);
                }
            }
        });

        // 2. Generate nodes for the areas between chambers (where corridors likely are)
        // Since corridors are straight between chambers, we can just check the bounding boxes
        // of corridors if we had them. Instead, let's just use the global bounds but filter.
        const min = this.bounds.min;
        const max = this.bounds.max;
        
        // We iterate and only add if not already there and if it's "probably" a corridor
        for (let x = Math.floor(min.x); x <= Math.ceil(max.x); x += this.gridSize) {
            for (let z = Math.floor(min.z); z <= Math.ceil(max.z); z += this.gridSize) {
                const gx = Math.round(x / this.gridSize);
                const gz = Math.round(z / this.gridSize);
                const key = `${gx},${gz}`;
                if (this.grid.has(key)) continue;

                // Check if it's a corridor area: if it aligns with at least one chamber's X or Z
                // This is a heuristic because corridors in Map.js are straight.
                let nearChamberAxis = false;
                for (const chamber of this.map.chambers) {
                    if (Math.abs(x - chamber.x) < 4 || Math.abs(z - chamber.z) < 4) {
                        nearChamberAxis = true;
                        break;
                    }
                }

                if (nearChamberAxis) {
                    this.addNodeAt(x, z);
                }
            }
        }
    }

    addNodeAt(x, z) {
        const gx = Math.round(x / this.gridSize);
        const gz = Math.round(z / this.gridSize);
        const key = `${gx},${gz}`;
        if (this.grid.has(key)) return;

        const pos = new THREE.Vector3(gx * this.gridSize, 0.5, gz * this.gridSize);
        // Clearance check: node must be far enough from walls
        const isWall = this.map.checkCollision(pos, this.gridSize * 0.7); // Increased clearance
        
        let door = null;
        for (const d of this.map.doors) {
            // Check if pos is within door panels
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

    isNodeWalkable(node) {
        if (!node) return false;
        if (node.isStaticWall) return false;
        if (node.door) return node.door.isOpen;
        
        // Hazard Check: AI should avoid active hazards
        if (this.map.hazards) {
            for (let i = 0; i < this.map.hazards.length; i++) {
                const h = this.map.hazards[i];
                if (!h) continue;
                
                // Hazard check logic (supports various hazard types)
                const isHazardActive = h.isActive !== undefined ? h.isActive : 
                                      (h.isExpired !== undefined ? !h.isExpired : true);
                
                if (!isHazardActive) continue;
                
                const hPos = h.position || (h.group ? h.group.position : (h.mesh ? h.mesh.position : null));
                if (!hPos) continue;

                const dx = node.x - hPos.x;
                const dz = node.z - hPos.z;
                const distSq = dx*dx + dz*dz;
                const rad = h.radius || 2.5;
                
                if (distSq < rad * rad) return false; 
            }
        }

        return node.walkable;
    }

    findPath(startPos, targetPos) {
        const startNode = this.getGridNode(startPos);
        const targetNode = this.getGridNode(targetPos);

        if (!startNode || !targetNode) return null;
        if (startNode === targetNode) return [targetPos];

        const openSet = [startNode];
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${Math.round(startNode.x/this.gridSize)},${Math.round(startNode.z/this.gridSize)}`;
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startNode, targetNode));

        while (openSet.length > 0) {
            // Get node with lowest fScore
            openSet.sort((a, b) => {
                const fa = fScore.get(`${Math.round(a.x/this.gridSize)},${Math.round(a.z/this.gridSize)}`) ?? Infinity;
                const fb = fScore.get(`${Math.round(b.x/this.gridSize)},${Math.round(b.z/this.gridSize)}`) ?? Infinity;
                return fa - fb;
            });
            
            const current = openSet.shift();
            const currentKey = `${Math.round(current.x/this.gridSize)},${Math.round(current.z/this.gridSize)}`;

            if (current === targetNode) {
                return this.reconstructPath(cameFrom, current);
            }

            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                if (!this.isNodeWalkable(neighbor)) continue;

                const neighborKey = `${Math.round(neighbor.x/this.gridSize)},${Math.round(neighbor.z/this.gridSize)}`;
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

        return null; // No path found
    }

    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
    }

    distance(a, b) {
        return Math.sqrt((a.x - b.x)**2 + (a.z - b.z)**2);
    }

    getNeighbors(node) {
        const neighbors = [];
        const directions = [
            {x: 1, z: 0}, {x: -1, z: 0}, {x: 0, z: 1}, {x: 0, z: -1},
            {x: 1, z: 1}, {x: 1, z: -1}, {x: -1, z: 1}, {x: -1, z: -1}
        ];

        directions.forEach(dir => {
            const gx = Math.round(node.x / this.gridSize) + dir.x;
            const gz = Math.round(node.z / this.gridSize) + dir.z;
            const neighbor = this.grid.get(`${gx},${gz}`);
            if (neighbor) neighbors.push(neighbor);
        });

        return neighbors;
    }

    reconstructPath(cameFrom, current) {
        const path = [new THREE.Vector3(current.x, 0.5, current.z)];
        let currentKey = `${Math.round(current.x/this.gridSize)},${Math.round(current.z/this.gridSize)}`;
        
        while (cameFrom.has(currentKey)) {
            current = cameFrom.get(currentKey);
            currentKey = `${Math.round(current.x/this.gridSize)},${Math.round(current.z/this.gridSize)}`;
            path.unshift(new THREE.Vector3(current.x, 0.5, current.z));
        }
        return path;
    }
}
