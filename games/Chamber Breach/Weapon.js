import * as THREE from 'three';
import { CONFIG } from './config.js';

// Zero-allocation scratch vectors
const _fireDir = new THREE.Vector3();

/**
 * Weapon — Unified Weapon System
 * 
 * Handles firing rates, accuracy, projectile instantiation via ProjectilePool,
 * and visual/audio feedback integration.
 */
export class Weapon {
    /**
     * @param {Object} options
     * @param {string} options.name
     * @param {number} options.cooldown - Time between shots in ms.
     * @param {number} options.damage
     * @param {number} options.projectileSpeed
     * @param {number} options.projectileColor
     * @param {string} options.owner - 'PLAYER' or 'ENEMY'
     * @param {THREE.Vector3} options.muzzleOffset - Offset from weapon mesh for muzzle flash/projectile start.
     * @param {Function} options.onShoot - Callback for audio/additional effects.
     */
    constructor(options = {}) {
        this.name = options.name || 'GENERIC';
        this.cooldown = options.cooldown || 200;
        this.damage = options.damage || 10;
        this.projectileSpeed = options.projectileSpeed || 40;
        this.projectileColor = options.projectileColor || 0xffffff;
        this.owner = options.owner || 'ENEMY';
        this.muzzleOffset = options.muzzleOffset || new THREE.Vector3(0, 0, 0);
        this.accuracy = options.accuracy || 1.0; // 1.0 = perfect, lower = more spread
        this.shake = options.shake || 0.05;
        
        this.lastFireTime = 0;
        this.onShoot = options.onShoot || (() => {});
        this.lastShotFxTime = 0;
        
        // Internal state
        this.isFiring = false;
        this.target = null;
    }

    /**
     * Set weapon firing state.
     */
    setFiring(state) {
        this.isFiring = state;
    }

    /**
     * Main fire logic.
     * @param {THREE.Vector3} muzzlePos - World position of muzzle.
     * @param {THREE.Vector3} direction - Normalized world direction.
     * @param {Object} game - Reference to game instance for pool access.
     * @param {Object} options - Additional fire options.
     */
    fire(muzzlePos, direction, game, options = {}) {
        const now = Date.now();
        if (now - this.lastFireTime < this.cooldown) return false;

        this.lastFireTime = now;

        // Apply spread based on accuracy — zero allocation
        _fireDir.copy(direction);
        if (this.accuracy < 1.0) {
            const spread = (1.0 - this.accuracy) * 0.1;
            _fireDir.x += (Math.random() - 0.5) * spread;
            _fireDir.y += (Math.random() - 0.5) * spread;
            _fireDir.z += (Math.random() - 0.5) * spread;
            _fireDir.normalize();
        }

        // Spawn projectile via pool
        const projectilePool = game && game.projectilePool;
        if (projectilePool) {
            const bullet = projectilePool.acquire(
                muzzlePos,
                _fireDir,
                this.projectileSpeed,
                this.damage,
                this.owner,
                this.projectileColor
            );

            // Apply special properties
            if (bullet) {
                if (options.penetration !== undefined) bullet.penetration = options.penetration;
                if (options.ricochet !== undefined) bullet.ricochet = options.ricochet;
                if (options.damageType !== undefined) bullet.damageType = options.damageType;
            }
        }

        // Muzzle Flash
        const particleSystem = game && game.particleSystem;
        if (particleSystem && particleSystem.createMuzzleFlash && now - this.lastShotFxTime > 120) {
            this.lastShotFxTime = now;
            particleSystem.createMuzzleFlash(muzzlePos, _fireDir, this.projectileColor);
        }

        // Feedback
        if (this.owner === 'PLAYER' && game.shakeAmount !== undefined) {
            game.shakeAmount = Math.max(game.shakeAmount, this.shake);
        }

        this.onShoot();
        return true;
    }

    /**
     * Update weapon internal state.
     */
    update(deltaTime) {
        // Handle continuous fire logic here if needed
    }
}
