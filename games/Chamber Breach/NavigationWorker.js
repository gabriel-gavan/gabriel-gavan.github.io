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
let gScore = new Float32Array(0);
let fScore = new Float32Array(0);
let cameFrom = new Int32Array(0);
let closedSet = new Uint8Array(0);

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
        
        const totalNodes = width * height;
        if (gScore.length < totalNodes) {
            gScore = new Float32Array(totalNodes);
            fScore = new Float32Array(totalNodes);
            cameFrom = new Int32Array(totalNodes);
            closedSet = new Uint8Array(totalNodes);
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
    
    if (cellType >= 2) {
        const doorId = cellType - 2;
        if (doorStates && !doorStates[doorId]) return false;
    }

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
    gScore.fill(Infinity, 0, totalNodes);
    fScore.fill(Infinity, 0, totalNodes);
    cameFrom.fill(-1, 0, totalNodes);
    closedSet.fill(0, 0, totalNodes);
    
    openSet.length = 0;
    openSet.push(startIndex);
    
    gScore[startIndex] = 0;
    fScore[startIndex] = heuristic(startIndex, targetIndex);

    let iterations = 0;
    const MAX_ITERATIONS = 250;

    while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        
        let currentIndex = 0;
        let lowestF = Infinity;
        for (let i = 0; i < openSet.length; i++) {
            const nodeIndex = openSet[i];
            const score = fScore[nodeIndex];
            if (score < lowestF) {
                lowestF = score;
                currentIndex = i;
            }
        }
        
        const current = openSet[currentIndex];
        const lastOpen = openSet.pop();
        if (currentIndex < openSet.length) {
            openSet[currentIndex] = lastOpen;
        }

        if (current === targetIndex) {
            return reconstructPath(current);
        }

        closedSet[current] = 1;

        const currentG = gScore[current];
        const neighbors = getNeighbors(current);
        for (let i = 0; i < neighbors.length; i++) {
            const neighbor = neighbors[i];
            if (closedSet[neighbor]) continue;
            if (!isWalkable(neighbor, doorStates, hazards)) continue;

            const tentativeGScore = currentG + distance(current, neighbor);

            if (tentativeGScore < gScore[neighbor]) {
                cameFrom[neighbor] = current;
                gScore[neighbor] = tentativeGScore;
                fScore[neighbor] = tentativeGScore + heuristic(neighbor, targetIndex);
                
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
        current = cameFrom[current];
    }
    return path;
}