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
        const available = this.available;
        let bullet;
        if (available.length > 0) {
            bullet = available.pop();
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
        const active = this.active;
        const index = active.indexOf(bullet);
        if (index !== -1) {
            // Fast splice
            const last = active.pop();
            if (index < active.length) {
                active[index] = last;
            }

            bullet.recycle();
            this.available.push(bullet);
        }
    }

    /**
     * Bulk update for all active projectiles.
     */
    update(deltaTime, map, player, enemies, spatialGrid) {
        const active = this.active;
        for (let i = active.length - 1; i >= 0; i--) {
            const b = active[i];
            b.update(deltaTime, map, player, enemies, spatialGrid);

            if (b.isDead) {
                // Remove from active and move to available
                const last = active.pop();
                if (i < active.length) {
                    active[i] = last;
                }
                this.available.push(b);
            }
        }
    }

    /**
     * Cleanup everything for mission transition.
     */
    releaseAll() {
        const active = this.active;
        const available = this.available;
        for (let i = 0; i < active.length; i++) {
            active[i].recycle();
            available.push(active[i]);
        }
        active.length = 0;
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