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
        return `${cx},${cz}`;
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
        if (entity._lastGridKey) {
            const oldCell = this.grid.get(entity._lastGridKey);
            if (oldCell) {
                oldCell.delete(entity);
                // Clean up empty cells to keep Map size small
                if (oldCell.size === 0) this.grid.delete(entity._lastGridKey);
            }
        }
        
        // Add to new cell
        if (!this.grid.has(key)) {
            this.grid.set(key, new Set());
        }
        
        const cell = this.grid.get(key);
        cell.add(entity);
        entity._lastGridKey = key;
    }

    /**
     * Remove entity from grid
     */
    removeEntity(entity) {
        if (entity._lastGridKey) {
            const cell = this.grid.get(entity._lastGridKey);
            if (cell) {
                cell.delete(entity);
                if (cell.size === 0) this.grid.delete(entity._lastGridKey);
            }
            delete entity._lastGridKey;
        }
    }

    /**
     * Get all entities in a radius around a position
     */
    getNearby(position, radius) {
        const results = [];
        const radiusSq = radius * radius;
        
        const minX = Math.floor((position.x - radius) / this.cellSize);
        const maxX = Math.floor((position.x + radius) / this.cellSize);
        const minZ = Math.floor((position.z - radius) / this.cellSize);
        const maxZ = Math.floor((position.z + radius) / this.cellSize);
        
        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                const key = `${x},${z}`;
                const cell = this.grid.get(key);
                if (cell) {
                    for (const entity of cell) {
                        // distanceToSquared is fast, but we should ensure entity and entity.mesh exist
                        if (entity.mesh && entity.mesh.position.distanceToSquared(position) <= radiusSq) {
                            results.push(entity);
                        }
                    }
                }
            }
        }
        
        return results;
    }
}
