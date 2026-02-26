import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Target } from './Target.js';

export class Door {
    constructor(id, position, textureLoader) {
        this.id = id;
        this.position = position;
        this.textureLoader = textureLoader;
        this.group = new THREE.Group();
        this.group.position.copy(position);

        this.state = 'closed'; // 'closed', 'opening', 'open', 'closing'
        this.animationId = null;
        this.currentTarget = null;
        this.doorMeshLeft = this.createDoorMesh(true);
        this.doorMeshRight = this.createDoorMesh(false);

        this.group.add(this.doorMeshLeft);
        this.group.add(this.doorMeshRight);

        // Pre-create targets for this door
        this.targets = {
            bandit: new Target('bandit', textureLoader),
            woman: new Target('woman', textureLoader),
            prospector: new Target('prospector', textureLoader),
            boss: new Target('boss', textureLoader)
        };

        // All targets are initially hidden
        Object.values(this.targets).forEach(target => {
            target.mesh.position.set(0, 10, -0.1); 
            target.mesh.visible = false;
            this.group.add(target.mesh);
        });
    }

    get isOpen() {
        return this.state === 'open' || this.state === 'opening';
    }

    createDoorMesh(isLeft) {
        const texture = this.textureLoader.load(CONFIG.ASSETS.WOOD_TEXTURE);
        // Add a fallback color in case texture fails - BRIGHT for debug
        const material = new THREE.MeshBasicMaterial({ map: texture, color: 0xffff00 });
        const width = 13; 
        const height = 32; // Lowered to fit arcade peak
        
        // Create an arched shape for the door
        const shape = new THREE.Shape();
        if (isLeft) {
            shape.moveTo(0, 0);
            shape.lineTo(width, 0);
            shape.lineTo(width, height);
            // Curve from center peak (width, height) to outer side (0, height - width)
            shape.absarc(width, height - width, width, Math.PI / 2, Math.PI, false);
            shape.lineTo(0, 0);
        } else {
            shape.moveTo(0, 0);
            shape.lineTo(width, 0);
            shape.lineTo(width, height - width);
            // Curve from outer side (width, height-width) to center peak (0, height)
            shape.absarc(0, height - width, width, 0, Math.PI / 2, false);
            shape.lineTo(0, 0);
        }

        const geometry = new THREE.ShapeGeometry(shape);
        const pos = geometry.attributes.position;
        const uvs = geometry.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
            uvs.setXY(i, pos.getX(i) / width, pos.getY(i) / height);
        }

        const mesh = new THREE.Mesh(geometry, material);
        
        // Pivot around the outer edge
        const pivot = new THREE.Group();
        pivot.position.x = isLeft ? -width : width;
        mesh.position.x = isLeft ? 0 : -width;
        pivot.add(mesh);
        
        return pivot;
    }

    resetTargets() {
        Object.values(this.targets).forEach(target => {
            target.reset();
            target.mesh.visible = false;
        });
    }

    open(type, variant = 0, hp = 1) {
        if (this.state !== 'closed') return;
        this.state = 'opening';
        
        // Ensure ALL targets are hidden first
        this.resetTargets();
        
        this.currentTarget = this.targets[type];
        this.currentTarget.reset(variant, hp);
        this.currentTarget.mesh.visible = true;

        // Animate door swing
        this.animateDoor(Math.PI / 1.5, () => {
            this.state = 'open';
        });

        return type; 
    }

    close() {
        if (this.state === 'closed' || this.state === 'closing') return;
        this.state = 'closing';

        // Animate door swing back
        this.animateDoor(0, () => {
            this.state = 'closed';
            // Hide current target after fully closed
            if (this.currentTarget) {
                this.currentTarget.mesh.visible = false;
                this.currentTarget = null;
            }
        });
    }

    animateDoor(targetAngle, onComplete) {
        // Cancel any existing animation
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        const duration = 200;
        const startLeft = this.doorMeshLeft.rotation.y;
        const startRight = this.doorMeshRight.rotation.y;
        const startTime = Date.now();

        const update = () => {
            const now = Date.now();
            const t = Math.min(1, (now - startTime) / duration);
            this.doorMeshLeft.rotation.y = startLeft + ((-targetAngle) - startLeft) * t;
            this.doorMeshRight.rotation.y = startRight + (targetAngle - startRight) * t;

            if (t < 1) {
                this.animationId = requestAnimationFrame(update);
            } else {
                this.animationId = null;
                if (onComplete) onComplete();
            }
        };
        this.animationId = requestAnimationFrame(update);
    }

    onShoot(clickedMesh) {
        // This old method is now replaced by direct userData checking in GameScene
        return null;
    }
}
