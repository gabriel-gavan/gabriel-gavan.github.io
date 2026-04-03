import * as THREE from 'three';

const MATH = {
    v1: new THREE.Vector3(),
    v2: new THREE.Vector3()
};

// --- Shared Assets for Zero Allocation ---
const SHARED_GEO = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 4);
SHARED_GEO.rotateX(Math.PI / 2);

const MATERIAL_CACHE = {
    'PLAYER': new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 1.0, depthWrite: false }),
    'ENEMY': new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 1.0, depthWrite: false }),
    'NEUTRAL': new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false })
};

export class Bullet {
    constructor(scene) {
        this.scene = scene;
        this.isActive = false;
        this.isDead = true;
        this.life = 0;
        this.maxLife = 2.0;
        this.velocity = new THREE.Vector3();
        this.damage = 0;
        this.owner = 'NEUTRAL'; 
        this.color = 0xffffff;
        this.penetration = 0;
        this.ricochet = false;
        this.damageType = 'PLAYER';
        this.hitObjects = new Set();
        
        // --- Mesh (Using Shared Geometry) ---
        this.mesh = new THREE.Mesh(SHARED_GEO, MATERIAL_CACHE['NEUTRAL']);
        this.mesh.visible = false;
        this.mesh.matrixAutoUpdate = false; // Performance optimization
        this.scene.add(this.mesh);
    }

    spawn(position, direction, speed, damage, owner, color = 0xffffff) {
        this.mesh.position.copy(position);
        this.velocity.copy(direction).multiplyScalar(speed);
        this.damage = damage;
        this.owner = owner;
        this.color = color;
        
        // Reset properties for pooling
        this.penetration = 0;
        this.ricochet = false;
        this.damageType = 'PLAYER';
        this.hitObjects.clear(); // Clear existing Set to prevent allocation
        
        // Swap material based on owner for batching efficiency
        this.mesh.material = MATERIAL_CACHE[owner] || MATERIAL_CACHE['NEUTRAL'];
        
        this.life = this.maxLife;
        this.isActive = true;
        this.isDead = false;
        
        // Orient mesh and update matrix
        MATH.v1.copy(position).add(direction);
        this.mesh.lookAt(MATH.v1);
        this.mesh.updateMatrix();
        
        this.mesh.visible = true;
    }

    update(deltaTime, map, player, enemies, spatialGrid) {
        if (!this.isActive || this.isDead) return;

        this.life -= deltaTime;
        if (this.life <= 0) {
            this.recycle();
            return;
        }

        const prevPos = MATH.v2.copy(this.mesh.position);

        // Move
        MATH.v1.copy(this.velocity).multiplyScalar(deltaTime);
        this.mesh.position.add(MATH.v1);
        this.mesh.updateMatrix();
        
        const currentPos = this.mesh.position;
        
        // Collision Detection
        if (this.owner === 'ENEMY') {
            const distToPlayerSq = currentPos.distanceToSquared(player.mesh.position);
            if (distToPlayerSq < 2.5) {
                player.takeDamage(this.damage, false, this.damageType);
                this.handleImpact(currentPos, new THREE.Vector3(0, 1, 0));
                return;
            }
        } else {
            // Player Bullet: Optimized check using spatial grid
            const checkRadius = 2.0;
            const nearby = spatialGrid ? spatialGrid.getNearby(currentPos, checkRadius) : enemies;
            
            for (let i = 0; i < nearby.length; i++) {
                const enemy = nearby[i];
                if (!enemy || enemy.isDead || enemy.isAlly || this.hitObjects.has(enemy)) continue;
                
                const distToEnemySq = currentPos.distanceToSquared(enemy.mesh.position);
                if (distToEnemySq < checkRadius * checkRadius) {
                    enemy.takeDamage(this.damage, enemies, this.damageType, spatialGrid);
                    this.hitObjects.add(enemy);
                    
                    if (this.penetration > 0) {
                        this.penetration--;
                    } else {
                        this.recycle();
                        return;
                    }
                }
            }
        }

        // Map Collision
        if (map && map.checkCollision(currentPos, 0.3)) {
            if (this.ricochet) {
                this.ricochet = false; // Only one ricochet
                // Simple ricochet: reflect velocity
                // In a full implementation, we'd need the surface normal here.
                // Since checkCollision doesn't return normal, we'll just flip Y for now
                // or just recycle to keep it simple and stable.
                this.handleImpact(currentPos, new THREE.Vector3(0, 1, 0));
            } else {
                this.handleImpact(currentPos, new THREE.Vector3(0, 1, 0));
            }
            return;
        }
    }

    handleImpact(pos, normal, isEnemyHit = false) {
        if (window.game?.particleSystem) {
            window.game.particleSystem.createImpact(pos, normal, isEnemyHit ? 0x00d0ff : this.color);
        }
        
        if (!isEnemyHit || this.penetration <= 0) {
            this.recycle();
        }
    }

    recycle() {
        this.isActive = false;
        this.isDead = true;
        this.mesh.visible = false;
    }
}
