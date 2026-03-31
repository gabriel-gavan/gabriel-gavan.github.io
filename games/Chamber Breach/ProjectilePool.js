import * as THREE from 'three';
import { Bullet } from './Bullet.js';

/**
 * ProjectilePool — Manager for Bullet/Projectile instances.
 * 
 * Consistent with EnemyPool architecture:
 * - Lazy growth: Grows on demand if pool is empty.
 * - Warm recycling: Reuses existing Bullet instances.
 * - Centralized logic: Handles acquisition and release.
 */
export class ProjectilePool {
    constructor(scene) {
        this.scene = scene;
        this.available = [];
        this.active = [];
        this.stats = {
            hits: 0,
            misses: 0
        };
    }

    /**
     * Acquire a bullet and spawn it.
     */
    acquire(position, direction, speed, damage, owner, color = 0xffffff) {
        let bullet;
        if (this.available.length > 0) {
            bullet = this.available.pop();
            this.stats.hits++;
        } else {
            bullet = new Bullet(this.scene);
            this.stats.misses++;
        }

        this.active.push(bullet);
        bullet.spawn(position, direction, speed, damage, owner, color);
        return bullet;
    }

    /**
     * Release a bullet back to the pool.
     */
    release(bullet) {
        const index = this.active.indexOf(bullet);
        if (index !== -1) {
            // Fast splice
            const last = this.active.pop();
            if (index < this.active.length) {
                this.active[index] = last;
            }
            
            bullet.recycle();
            this.available.push(bullet);
        }
    }

    /**
     * Bulk update for all active projectiles.
     */
    update(deltaTime, map, player, enemies, spatialGrid) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const b = this.active[i];
            b.update(deltaTime, map, player, enemies, spatialGrid);
            
            if (b.isDead) {
                // Remove from active and move to available
                const last = this.active.pop();
                if (i < this.active.length) {
                    this.active[i] = last;
                }
                this.available.push(b);
            }
        }
    }

    /**
     * Cleanup everything for mission transition.
     */
    releaseAll() {
        for (let i = 0; i < this.active.length; i++) {
            this.active[i].recycle();
            this.available.push(this.active[i]);
        }
        this.active.length = 0;
    }
    
    /**
     * Hard cleanup - truly dispose of meshes.
     */
    drain() {
        this.releaseAll();
        this.available.forEach(b => {
            if (b.mesh && b.mesh.parent) {
                b.mesh.parent.remove(b.mesh);
            }
        });
        this.available.length = 0;
    }
}
