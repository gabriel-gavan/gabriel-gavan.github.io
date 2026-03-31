// NavigationWorker.js - High-performance A* pathfinding in a background thread
// Uses a flat array for the grid to minimize memory overhead and postMessage latency

let grid = null;
let gridWidth = 0;
let gridHeight = 0;
let minX = 0;
let minZ = 0;
let gridSize = 1.0;

// Reusable structures to avoid GC
const openSet = [];
const gScore = new Float32Array(0);
const fScore = new Float32Array(0);
const cameFrom = new Int32Array(0);
const closedSet = new Uint8Array(0);

self.onmessage = function(e) {
    const { type, data } = e.data;

    if (type === 'INIT_GRID') {
        const { nodes, width, height, minX: mx, minZ: mz, size } = data;
        grid = nodes; // Uint8Array: 0=blocked, 1=walkable, 2=door
        gridWidth = width;
        gridHeight = height;
        minX = mx;
        minZ = mz;
        gridSize = size;
        
        // Resize reusable arrays
        const totalNodes = width * height;
        // Re-allocating if needed
        if (gScore.length < totalNodes) {
            // We use global variables here but let's just re-declare for simplicity in this worker scope
            self.gScore = new Float32Array(totalNodes);
            self.fScore = new Float32Array(totalNodes);
            self.cameFrom = new Int32Array(totalNodes);
            self.closedSet = new Uint8Array(totalNodes);
        }
        return;
    }

    if (type === 'FIND_PATH') {
        const { id, start, target, doorStates, hazards } = data;
        const path = findPath(start, target, doorStates, hazards);
        self.postMessage({ type: 'PATH_RESULT', id, path });
    }
};

function getGridIndex(x, z) {
    const gx = Math.round((x - minX) / gridSize);
    const gz = Math.round((z - minZ) / gridSize);
    if (gx < 0 || gx >= gridWidth || gz < 0 || gz >= gridHeight) return -1;
    return gz * gridWidth + gx;
}

function getXFromIndex(index) {
    return minX + (index % gridWidth) * gridSize;
}

function getZFromIndex(index) {
    return minZ + Math.floor(index / gridWidth) * gridSize;
}

function heuristic(idxA, idxB) {
    const ax = getXFromIndex(idxA);
    const az = getZFromIndex(idxA);
    const bx = getXFromIndex(idxB);
    const bz = getZFromIndex(idxB);
    return Math.abs(ax - bx) + Math.abs(az - bz);
}

function distance(idxA, idxB) {
    const ax = getXFromIndex(idxA);
    const az = getZFromIndex(idxA);
    const bx = getXFromIndex(idxB);
    const bz = getZFromIndex(idxB);
    const dx = ax - bx;
    const dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
}

function isWalkable(index, doorStates, hazards) {
    const cellType = grid[index];
    if (cellType === 0) return false; // Static wall
    
    // Check doors
    if (cellType >= 2) {
        const doorId = cellType - 2;
        if (doorStates && !doorStates[doorId]) return false;
    }

    // Check hazards
    if (hazards && hazards.length > 0) {
        const px = getXFromIndex(index);
        const pz = getZFromIndex(index);
        for (let i = 0; i < hazards.length; i++) {
            const h = hazards[i];
            const dx = px - h.x;
            const dz = pz - h.z;
            if (dx * dx + dz * dz < h.radiusSq) return false;
        }
    }

    return true;
}

function findPath(start, target, doorStates, hazards) {
    const startIndex = getGridIndex(start.x, start.z);
    const targetIndex = getGridIndex(target.x, target.z);

    if (startIndex === -1 || targetIndex === -1) return null;
    if (startIndex === targetIndex) return [target];

    const totalNodes = gridWidth * gridHeight;
    self.gScore.fill(Infinity);
    self.fScore.fill(Infinity);
    self.cameFrom.fill(-1);
    self.closedSet.fill(0);
    
    openSet.length = 0;
    openSet.push(startIndex);
    
    self.gScore[startIndex] = 0;
    self.fScore[startIndex] = heuristic(startIndex, targetIndex);

    let iterations = 0;
    // PERFORMANCE FIX: Reduced MAX_ITERATIONS for faster pathfinding
    const MAX_ITERATIONS = 250; // Reduced from 400 to prevent stalls

    while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        
        let currentIndex = 0;
        let lowestF = Infinity;
        for (let i = 0; i < openSet.length; i++) {
            const score = self.fScore[openSet[i]];
            if (score < lowestF) {
                lowestF = score;
                currentIndex = i;
            }
        }
        
        const current = openSet.splice(currentIndex, 1)[0];
        if (current === targetIndex) {
            return reconstructPath(current);
        }

        self.closedSet[current] = 1;

        const neighbors = getNeighbors(current);
        for (let i = 0; i < neighbors.length; i++) {
            const neighbor = neighbors[i];
            if (self.closedSet[neighbor]) continue;
            if (!isWalkable(neighbor, doorStates, hazards)) continue;

            const tentativeGScore = self.gScore[current] + distance(current, neighbor);

            if (tentativeGScore < self.gScore[neighbor]) {
                self.cameFrom[neighbor] = current;
                self.gScore[neighbor] = tentativeGScore;
                self.fScore[neighbor] = tentativeGScore + heuristic(neighbor, targetIndex);
                
                if (openSet.indexOf(neighbor) === -1) {
                    openSet.push(neighbor);
                }
            }
        }
    }

    return [target];
}

function getNeighbors(index) {
    const neighbors = [];
    const gx = index % gridWidth;
    const gz = Math.floor(index / gridWidth);

    // 8-way connectivity
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            if (dx === 0 && dz === 0) continue;
            const nx = gx + dx;
            const nz = gz + dz;
            if (nx >= 0 && nx < gridWidth && nz >= 0 && nz < gridHeight) {
                neighbors.push(nz * gridWidth + nx);
            }
        }
    }
    return neighbors;
}

function reconstructPath(current) {
    const path = [];
    while (current !== -1) {
        path.unshift({
            x: getXFromIndex(current),
            z: getZFromIndex(current)
        });
        current = self.cameFrom[current];
    }
    return path;
}
