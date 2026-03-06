import * as THREE from 'three';
import { COLORS } from './config.js';

export class Tile {
    constructor(id, size, totalSize, texture, u, v, type = 'normal', edges = { t: 0, r: 0, b: 0, l: 0 }) {
        this.id = id;
        this.gridSize = size;
        this.totalSize = totalSize;
        this.type = type; // 'normal', 'memory', 'blur'
        
        // Jigsaw Shape Logic - Drawn in Y-Up coordinate space
        const shape = new THREE.Shape();
        const s = totalSize;
        const ts = s * 0.22; // Tab size
        const cp1 = s * 0.35; // Curve point 1
        const cp2 = s * 0.65; // Curve point 2

        // Start at top-left
        shape.moveTo(0, s);

        // Top edge (along y=s, x: 0 -> s)
        if (edges.t === 0) shape.lineTo(s, s);
        else {
            const sign = edges.t > 0 ? 1 : -1;
            shape.lineTo(cp1, s);
            shape.bezierCurveTo(cp1, s + ts * sign, cp2, s + ts * sign, cp2, s);
            shape.lineTo(s, s);
        }

        // Right edge (along x=s, y: s -> 0)
        if (edges.r === 0) shape.lineTo(s, 0);
        else {
            const sign = edges.r > 0 ? 1 : -1;
            shape.lineTo(s, cp2);
            shape.bezierCurveTo(s + ts * sign, cp2, s + ts * sign, cp1, s, cp1);
            shape.lineTo(s, 0);
        }

        // Bottom edge (along y=0, x: s -> 0)
        if (edges.b === 0) shape.lineTo(0, 0);
        else {
            const sign = edges.b > 0 ? 1 : -1;
            shape.lineTo(cp2, 0);
            shape.bezierCurveTo(cp2, -ts * sign, cp1, -ts * sign, cp1, 0);
            shape.lineTo(0, 0);
        }

        // Left edge (along x=0, y: 0 -> s)
        if (edges.l === 0) shape.lineTo(0, s);
        else {
            const sign = edges.l > 0 ? 1 : -1;
            shape.lineTo(0, cp1);
            shape.bezierCurveTo(-ts * sign, cp1, -ts * sign, cp2, 0, cp2);
            shape.lineTo(0, s);
        }

        const extrudeSettings = { depth: 0.1, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        // Center the geometry
        geometry.translate(-s/2, -s/2, 0);

        const borderMat = new THREE.MeshStandardMaterial({ 
            color: COLORS.tileBorder,
            emissive: COLORS.tileBorder,
            emissiveIntensity: 0.5
        });
        
        this.frontMat = new THREE.MeshStandardMaterial({ 
            map: texture,
            transparent: (type === 'blur' || type === 'memory'),
            opacity: 1.0,
            roughness: 0.2,
            metalness: 0.1
        });
        
        // Materials: 0 is front/back, 1 is sides
        this.mesh = new THREE.Mesh(geometry, [this.frontMat, borderMat]);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Custom UV mapping for Jigsaw Shape
        const uvAttribute = geometry.attributes.uv;
        const uvSize = 1 / size;
        const uMin = u * uvSize;
        const vMin = v * uvSize;

        for (let i = 0; i < uvAttribute.count; i++) {
            const ux = uvAttribute.getX(i); // range 0..s
            const uy = uvAttribute.getY(i); // range 0..s
            // Normalize shape coordinates and map to UV grid
            uvAttribute.setXY(i, uMin + (ux / s) * uvSize, vMin + (uy / s) * uvSize);
        }
        uvAttribute.needsUpdate = true;
        
        this.targetPosition = new THREE.Vector3();
        this.targetRotation = new THREE.Euler(0, 0, 0);
        this.currentGridPos = { x: u, y: v };
        this.correctGridPos = { x: u, y: v };
        this.rotationStep = 0; 
        this.isSelected = false;
        this.isLocked = false;
        this.isFlipped = false;
        this.isHovered = false;

        if (type === 'memory') {
            this.targetRotation.y = Math.PI;
            this.mesh.rotation.y = Math.PI;
        }

        if (type === 'blur') {
            this.frontMat.opacity = 0.2;
            this.frontMat.roughness = 1.0;
            this.frontMat.metalness = 0.8;
        }
    }

    update(dt) {
        this.mesh.position.lerp(this.targetPosition, 0.15);
        this.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        
        this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, this.targetRotation.z, 0.15);
        this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, this.targetRotation.y, 0.15);
        
        const isCorrect = this.isAtCorrectPosition();

        // Selection/Memory logic
        if (this.isSelected) {
            this.frontMat.emissive.set(COLORS.accent);
            this.frontMat.emissiveIntensity = 0.3;
        } else {
            this.frontMat.emissive.set(0x000000);
            this.frontMat.emissiveIntensity = 0;
        }

        if (this.isLocked) {
            this.mesh.material.forEach(m => {
                if (m.emissive) {
                    m.emissive.set(COLORS.successGlow);
                    m.emissiveIntensity = 0.8;
                }
            });
            if (this.type === 'blur') {
                this.frontMat.opacity = 1.0;
                this.frontMat.roughness = 0.2;
                this.frontMat.metalness = 0.1;
            }
        } else if (this.type === 'blur') {
            // Progressive clarity based on placement and hover "probe"
            let targetOpacity = isCorrect ? 1.0 : 0.3;
            let targetRoughness = isCorrect ? 0.2 : 1.0;
            
            if (this.isHovered && !isCorrect) {
                targetOpacity = 0.6; // Hovering "clears" the data slightly
                targetRoughness = 0.5;
            }

            this.frontMat.opacity = THREE.MathUtils.lerp(this.frontMat.opacity, targetOpacity, 0.1);
            this.frontMat.roughness = THREE.MathUtils.lerp(this.frontMat.roughness, targetRoughness, 0.1);
            
            // Subtle data glitch pulse when not correct
            if (!isCorrect) {
                const pulse = 0.1 + Math.sin(Date.now() * 0.003) * 0.05;
                this.frontMat.emissive.set(COLORS.tileBorder);
                this.frontMat.emissiveIntensity = pulse;
            }
        } else if (this.type === 'normal' && isCorrect) {
            const pulse = 0.2 + Math.sin(Date.now() * 0.005) * 0.1;
            this.mesh.material.forEach((m, i) => {
                if (i !== 4 && m.emissive) {
                    m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity, pulse, 0.1);
                }
            });
        }
    }

    flip(faceUp) {
        this.isFlipped = faceUp;
        this.targetRotation.y = faceUp ? 0 : Math.PI;
        this.bounce();
    }

    rotate() {
        this.rotationStep++;
        this.targetRotation.z = (this.rotationStep * Math.PI) / 2;
        this.bounce();
    }

    bounce() {
        this.mesh.scale.set(1.1, 1.1, 1.1);
    }

    setSelected(selected) {
        this.isSelected = selected;
        if (selected) this.mesh.scale.set(1.1, 1.1, 1.1);
    }

    setGridPosition(x, y, tileSize, spacing) {
        this.currentGridPos.x = x;
        this.currentGridPos.y = y;
        const boardWidth = this.gridSize * (tileSize + spacing);
        const offsetX = (x * (tileSize + spacing)) - boardWidth / 2 + tileSize / 2;
        const offsetY = (y * (tileSize + spacing)) - boardWidth / 2 + tileSize / 2;
        this.targetPosition.set(offsetX, offsetY, 0);
    }

    setScatterPosition(x, y, rotation = 0) {
        this.targetPosition.set(x, y, 0.1); // Slightly elevated while scattered
        this.targetRotation.z = rotation;
        this.rotationStep = Math.round(rotation / (Math.PI / 2));
    }

    snapToGrid(tileSize, spacing) {
        const boardWidth = this.gridSize * (tileSize + spacing);
        const halfBoard = boardWidth / 2;
        
        // Calculate which grid cell it's closest to
        const gridX = Math.round((this.targetPosition.x + halfBoard - tileSize/2) / (tileSize + spacing));
        const gridY = Math.round((this.targetPosition.y + halfBoard - tileSize/2) / (tileSize + spacing));
        
        // Check if this is the CORRECT grid cell
        if (gridX === this.correctGridPos.x && gridY === this.correctGridPos.y) {
            this.setGridPosition(gridX, gridY, tileSize, spacing);
            this.targetPosition.z = 0; // Drop it back to board level
            this.isLocked = true;
            return true;
        }
        return false;
    }

    isAtCorrectPosition() {
        const correctPos = this.currentGridPos.x === this.correctGridPos.x && 
                          this.currentGridPos.y === this.correctGridPos.y;
        const correctRot = (this.rotationStep % 4 === 0);
        return correctPos && correctRot;
    }
}
