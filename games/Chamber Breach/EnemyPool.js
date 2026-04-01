import { Enemy } from './Enemy.js';

/**
 * EnemyPool — Object Pool for Enemy AI Units
 * 
 * Eliminates per-spawn construction costs by recycling dead Enemy instances.
 * The expensive LOD mesh hierarchy (sprites, hitbox, lights) is preserved;
 * only game-state properties are reset via Enemy.reset().
 * 
 * Architecture:
 *  - Typed pools: Each enemy type has its own bucket (different sprite textures/scales)
 *  - Lazy growth: Pools start empty and grow on-demand via cold construction
 *  - Warm recycling: Dead enemies are returned to pool with mesh detached from scene
 *  - Pool cap: Prevents unbounded growth; excess enemies are truly discarded
 * 
 * Integration Points:
 *  - GameScene.spawnEnemy / triggerHackingWave / spawnFinalBoss / spawnHunter / spawnAllyDrone
 *  - Enemy.executeTitanAttack (decoy spawns)
 *  - Death pipeline: GameScene update loop → splice → pool.release()
 *  - Mission cleanup: pool.releaseAll() instead of discarding
 */

const MAX_POOL_SIZE_PER_TYPE = 12; // Cap per enemy type bucket
const MAX_TOTAL_POOLED = 40; // Absolute cap across all types

export class EnemyPool {
    constructor() {
        // Map<string, Enemy[]> — keyed by composite key (type + elite + ally)
        this.pools = new Map();
        this.totalPooled = 0;
        this.stats = {
            hits: 0,   // Recycled from pool
            misses: 0, // Cold-constructed
            releases: 0,
            discards: 0
        };
    }

    /**
     * Get a pool key for an enemy configuration.
     * Elite and ally enemies get separate pools since their mesh setup differs.
     */
    _key(type, isElite, isAlly) {
        return `${type}_${isElite ? 'E' : 'N'}_${isAlly ? 'A' : 'H'}`;
    }

    /**
     * Acquire an enemy — recycle from pool or cold-construct.
     * Returns a fully initialized Enemy ready for scene insertion.
     * 
     * @param {THREE.Scene} scene
     * @param {Player} player
     * @param {THREE.Vector3} position
     * @param {string} type
     * @param {string} facilityId
     * @param {Navigation} navigation
     * @param {ParticleSystem} particleSystem
     * @param {number} heatLevel
     * @param {boolean} isElite
     * @returns {Enemy}
     */
    acquire(scene, player, position, type = 'SENTRY', facilityId = 'meridian', navigation = null, particleSystem = null, heatLevel = 1, isElite = false) {
        const isAlly = facilityId === 'ally';
        const key = this._key(type, isElite, isAlly);
        const bucket = this.pools.get(key);

        if (bucket && bucket.length > 0) {
            // WARM PATH — recycle existing enemy
            const enemy = bucket.pop();
            this.totalPooled--;
            this.stats.hits++;

            enemy.reset(scene, player, position, type, facilityId, navigation, particleSystem, heatLevel, isElite);
            return enemy;
        }

        // COLD PATH — construct new enemy
        this.stats.misses++;
        return new Enemy(scene, player, position, type, facilityId, navigation, particleSystem, heatLevel, isElite);
    }

    /**
     * Release a dead enemy back into the pool for recycling.
     * The mesh is detached from the scene but preserved in memory.
     * 
     * @param {Enemy} enemy
     */
    release(enemy) {
        if (!enemy || !enemy.mesh) return;

        const isAlly = enemy.isAlly;
        const key = this._key(enemy.type, enemy.isElite, isAlly);

        // Check caps
        let bucket = this.pools.get(key);
        if (!bucket) {
            bucket = [];
            this.pools.set(key, bucket);
        }

        if (bucket.length >= MAX_POOL_SIZE_PER_TYPE || this.totalPooled >= MAX_TOTAL_POOLED) {
            // Over cap — truly discard this enemy
            this.stats.discards++;
            this._hardDispose(enemy);
            return;
        }

        // Detach from scene but keep mesh hierarchy alive
        if (enemy.mesh.parent) {
            enemy.mesh.parent.remove(enemy.mesh);
        }
        // Detach targeting line if present
        if (enemy.targetingLine && enemy.targetingLine.parent) {
            enemy.targetingLine.parent.remove(enemy.targetingLine);
        }

        // Clean up micro drones (these are small enough to not pool)
        if (enemy.microDrones && enemy.microDrones.length > 0) {
            for (let i = 0; i < enemy.microDrones.length; i++) {
                const d = enemy.microDrones[i];
                if (d.destroy) d.destroy();
            }
            enemy.microDrones = [];
        }

        bucket.push(enemy);
        this.totalPooled++;
        this.stats.releases++;
    }

    /**
     * Release all enemies in an array back to the pool.
     * Used during mission transitions.
     */
    releaseAll(enemies) {
        for (let i = 0; i < enemies.length; i++) {
            this.release(enemies[i]);
        }
    }

    /**
     * Hard dispose — when pool is full, actually free GPU resources.
     */
    _hardDispose(enemy) {
        if (enemy.mesh && enemy.mesh.parent) {
            enemy.mesh.parent.remove(enemy.mesh);
        }
        if (enemy.targetingLine && enemy.targetingLine.parent) {
            enemy.targetingLine.parent.remove(enemy.targetingLine);
            enemy.targetingLine.geometry?.dispose();
            enemy.targetingLine.material?.dispose();
        }

        // Dispose per-enemy cloned high-res material (low-res is shared/cached)
        if (enemy.sprites && enemy.sprites[0] && enemy.sprites[0].material) {
            enemy.sprites[0].material.dispose();
        }
        // Medium detail sprite shares high-res material, already disposed above

        // Dispose boss material if any
        if (enemy.bossMaterial) {
            enemy.bossMaterial.dispose();
        }
        if (enemy.bossEmergenceMesh && enemy.bossEmergenceMesh.geometry) {
            enemy.bossEmergenceMesh.geometry.dispose();
        }
    }

    /**
     * Drain all pools and truly dispose everything.
     * Called on full game shutdown.
     */
    drainAll() {
        this.pools.forEach((bucket, key) => {
            bucket.forEach(enemy => this._hardDispose(enemy));
            bucket.length = 0;
        });
        this.pools.clear();
        this.totalPooled = 0;
    }

    /**
     * Get diagnostic info for debug overlay.
     */
    getStats() {
        const poolSizes = {};
        this.pools.forEach((bucket, key) => {
            if (bucket.length > 0) poolSizes[key] = bucket.length;
        });
        return {
            ...this.stats,
            totalPooled: this.totalPooled,
            poolSizes
        };
    }
}