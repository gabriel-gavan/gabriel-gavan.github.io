import * as THREE from 'three';

/**
 * A simple 2D Spatial Grid for optimizing proximity checks.
 * Entities are expected to have a 'mesh' property with a 'position'.
 */
export class SpatialGrid {
    constructor(cellSize = 10) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    /**
     * Clear the grid
     */
    clear() {
        this.grid.clear();
    }

    /**
     * Get cell key for a position
     */
    _getKey(x, z) {
        const cx = Math.floor(x / this.cellSize);
        const cz = Math.floor(z / this.cellSize);
        return (cx << 16) | (cz & 0xFFFF);
    }

    /**
     * Add or update an entity in the grid
     */
    updateEntity(entity) {
        if (!entity.mesh) return;
        
        const pos = entity.mesh.position;
        const key = this._getKey(pos.x, pos.z);
        
        // Only update if the cell changed or if it hasn't been added yet
        if (entity._lastGridKey === key) return;

        // Remove from old cell
        if (entity._lastGridKey !== undefined) {
            const oldCell = this.grid.get(entity._lastGridKey);
            if (oldCell) {
                oldCell.delete(entity);
                if (oldCell.size === 0) this.grid.delete(entity._lastGridKey);
            }
        }
        
        // Add to new cell
        let cell = this.grid.get(key);
        if (!cell) {
            cell = new Set();
            this.grid.set(key, cell);
        }
        
        cell.add(entity);
        entity._lastGridKey = key;
    }

    /**
     * Remove entity from grid
     */
    removeEntity(entity) {
        if (entity._lastGridKey !== undefined) {
            const cell = this.grid.get(entity._lastGridKey);
            if (cell) {
                cell.delete(entity);
                if (cell.size === 0) this.grid.delete(entity._lastGridKey);
            }
            delete entity._lastGridKey;
        }
    }

    static _reusableResults = [];
    static _reusableResultsIndex = 0;
    static _MAX_REUSABLE_ARRAYS = 20; // Pool of arrays to handle nested calls
    static _resultsPool = Array.from({ length: 20 }, () => []);

    /**
     * Get all entities in a radius around a position
     * Uses a rotating pool of arrays to minimize GC while supporting a few nested calls.
     */
    getNearby(position, radius) {
        const poolIndex = SpatialGrid._reusableResultsIndex;
        SpatialGrid._reusableResultsIndex = (SpatialGrid._reusableResultsIndex + 1) % SpatialGrid._MAX_REUSABLE_ARRAYS;
        
        const results = SpatialGrid._resultsPool[poolIndex];
        results.length = 0;
        const radiusSq = radius * radius;
        
        const minX = Math.floor((position.x - radius) / this.cellSize);
        const maxX = Math.floor((position.x + radius) / this.cellSize);
        const minZ = Math.floor((position.z - radius) / this.cellSize);
        const maxZ = Math.floor((position.z + radius) / this.cellSize);
        
        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                const key = (x << 16) | (z & 0xFFFF);
                const cell = this.grid.get(key);
                if (cell) {
                    for (const entity of cell) {
                        if (entity.mesh) {
                            const ePos = entity.mesh.position;
                            const dx = ePos.x - position.x;
                            const dz = ePos.z - position.z;
                            if (dx*dx + dz*dz <= radiusSq) {
                                results.push(entity);
                            }
                        }
                    }
                }
            }
        }
        return results;
    }
}
