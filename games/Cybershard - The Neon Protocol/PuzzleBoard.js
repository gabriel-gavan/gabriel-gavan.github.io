import * as THREE from 'three';
import { Tile } from './Tile.js';
import { TILE_SIZE, TILE_SPACING, COLORS } from './config.js';

export class PuzzleBoard {
    constructor(scene, size, textureUrl, type, extraData = {}) {
        this.scene = scene;
        this.size = size;
        this.type = type; // 'slide', 'swap', 'rotate', 'memory', 'hidden'
        this.grid = Array.from({ length: size }, () => Array(size).fill(null));
        this.tiles = [];
        this.emptyPos = { x: size - 1, y: 0 }; 
        this.textureUrl = textureUrl;
        this.extraData = extraData;
        
        this.container = new THREE.Group();
        this.scene.add(this.container);
        
        this.selectedTile = null;
        this.isSolving = false;
        this.isShuffled = false;

        this.memoryMatches = 0;
        this.memoryFlipped = [];
        this.hiddenTargetsFound = 0;
        this.hiddenMarkers = [];
    }

    async init() {
        const texture = await new Promise((resolve, reject) => {
            new THREE.TextureLoader().load(this.textureUrl, resolve, undefined, reject);
        });

        // 0: straight, 1: outie, -1: innie
        // Horizontal segments (boundaries between rows)
        const hSegments = Array.from({ length: this.size + 1 }, () => Array(this.size).fill(0));
        // Vertical segments (boundaries between columns)
        const vSegments = Array.from({ length: this.size }, () => Array(this.size + 1).fill(0));

        // Randomize internal boundaries
        for (let i = 1; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                hSegments[i][j] = Math.random() > 0.5 ? 1 : -1;
            }
        }
        for (let i = 0; i < this.size; i++) {
            for (let j = 1; j < this.size; j++) {
                vSegments[i][j] = Math.random() > 0.5 ? 1 : -1;
            }
        }

        // Jigsaw pieces should have no spacing to interlock
        const spacing = 0; 

        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                if (this.type === 'slide' && x === this.emptyPos.x && y === this.emptyPos.y) continue;
                
                let tileType = 'normal';
                if (this.type === 'memory') tileType = 'memory';
                if (this.type === 'blur') tileType = 'blur';
                
                // Piece at (x, y) coordinates
                // x is horizontal (col), y is vertical (row)
                const shapeEdges = {
                    t: hSegments[y + 1][x],   // Top boundary
                    r: vSegments[y][x + 1],   // Right boundary
                    b: -hSegments[y][x],      // Bottom boundary (inverted shared edge)
                    l: -vSegments[y][x]       // Left boundary (inverted shared edge)
                };
                
                const tile = new Tile(this.tiles.length, this.size, TILE_SIZE, texture, x, y, tileType, shapeEdges);
                tile.setGridPosition(x, y, TILE_SIZE, spacing);
                tile.mesh.position.copy(tile.targetPosition);
                this.grid[x][y] = tile;
                this.tiles.push(tile);
                this.container.add(tile.mesh);
            }
        }
        if (this.type === 'memory') this.setupMemoryPairs();
        
        const boardSize = this.size * TILE_SIZE;
        const backplaneGeo = new THREE.BoxGeometry(boardSize + 0.1, boardSize + 0.1, 0.05);
        const backplaneMat = new THREE.MeshStandardMaterial({ 
            color: 0x000000, 
            transparent: false,
            opacity: 1.0,
            roughness: 0.8,
            metalness: 0.2
        });
        const backplane = new THREE.Mesh(backplaneGeo, backplaneMat);
        backplane.position.z = -0.15;
        this.container.add(backplane);
    }

    setupMemoryPairs() {
        if (this.type !== 'memory') return;
        const totalTiles = this.size * this.size;
        const half = totalTiles / 2;
        const ids = [];
        for (let i = 0; i < half; i++) {
            ids.push(i, i);
        }
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        this.tiles.forEach((tile, index) => {
            tile.id = ids[index];
            const u = ids[index] % this.size;
            const v = Math.floor(ids[index] / this.size);
            const uvSize = 1 / this.size;
            const uvAttribute = tile.mesh.geometry.attributes.uv;
            uvAttribute.setXY(16, u * uvSize, (v + 1) * uvSize);
            uvAttribute.setXY(17, (u + 1) * uvSize, (v + 1) * uvSize);
            uvAttribute.setXY(18, u * uvSize, v * uvSize);
            uvAttribute.setXY(19, (u + 1) * uvSize, v * uvSize);
            uvAttribute.needsUpdate = true;
        });
    }

    createHiddenTargets() {
        const targets = this.extraData.targets || [];
        const boardSize = 5 * TILE_SIZE;
        targets.forEach(t => {
            const markerGeo = new THREE.RingGeometry(0.1, 0.15, 32);
            const markerMat = new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0 });
            const marker = new THREE.Mesh(markerGeo, markerMat);
            marker.position.set((t.x - 0.5) * boardSize, (t.y - 0.5) * boardSize, 0.1);
            marker.userData = { label: t.label, found: false };
            this.hiddenMarkers.push(marker);
            this.container.add(marker);
        });
    }

    shuffle(moves = 100) {
        if (this.type === 'scatter') {
            this.scatterTiles();
            this.isShuffled = true;
            return;
        }
        if (this.type === 'slide') {
            for (let i = 0; i < moves; i++) {
                const neighbors = this.getValidNeighbors(this.emptyPos);
                const move = neighbors[Math.floor(Math.random() * neighbors.length)];
                this.moveTile(move.x, move.y, false);
            }
        } else if (this.type === 'swap' || this.type === 'blur') {
            for (let i = 0; i < moves; i++) {
                const x1 = Math.floor(Math.random() * this.size);
                const y1 = Math.floor(Math.random() * this.size);
                const x2 = Math.floor(Math.random() * this.size);
                const y2 = Math.floor(Math.random() * this.size);
                this.performSwap(x1, y1, x2, y2, false);
            }
        } else if (this.type === 'rotate') {
            this.tiles.forEach(tile => {
                const rotations = Math.floor(Math.random() * 3) + 1;
                for (let i = 0; i < rotations; i++) tile.rotate();
            });
        }
        this.isShuffled = true;
    }

    scatterTiles() {
        const range = this.size * TILE_SIZE * 2.5;
        this.tiles.forEach(tile => {
            const rx = (Math.random() - 0.5) * range;
            const ry = (Math.random() - 0.5) * range;
            const rr = (Math.floor(Math.random() * 4) * Math.PI) / 2;
            tile.setScatterPosition(rx, ry, rr);
            tile.isLocked = false;
        });
    }

    handleDragStart(tile) {
        if (this.isSolving || tile.isLocked) return null;
        this.selectedTile = tile;
        tile.setSelected(true);
        tile.targetPosition.z = 0.5; // Lift while dragging
        return tile;
    }

    handleDragMove(worldPoint) {
        if (!this.selectedTile) return;
        const localPoint = this.container.worldToLocal(worldPoint.clone());
        this.selectedTile.targetPosition.x = localPoint.x;
        this.selectedTile.targetPosition.y = localPoint.y;
    }

    handleDragEnd() {
        if (!this.selectedTile) return;
        
        const snapped = this.selectedTile.snapToGrid(TILE_SIZE, 0);
        this.selectedTile.setSelected(false);
        this.selectedTile.targetPosition.z = snapped ? 0 : 0.1;
        
        const tile = this.selectedTile;
        this.selectedTile = null;
        
        if (snapped) {
            const winResult = this.handleWinCheck(true);
            return winResult === "win" ? "win" : "snapped";
        }
        return true;
    }

    handleClick(intersectPoint) {
        if (this.isSolving) return;

        const localPoint = this.container.worldToLocal(intersectPoint.clone());
        
        const boardWidth = this.size * (TILE_SIZE + TILE_SPACING);
        const halfBoard = boardWidth / 2;
        
        const x = Math.floor((localPoint.x + halfBoard) / (TILE_SIZE + TILE_SPACING));
        const y = Math.floor((localPoint.y + halfBoard) / (TILE_SIZE + TILE_SPACING));
        
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) return false;

        if (this.type === 'slide') return this.moveTile(x, y);
        if (this.type === 'rotate') { this.grid[x][y].rotate(); return this.handleWinCheck(true); }
        if (this.type === 'memory') return this.handleMemoryClick(x, y);
        if (this.type === 'swap' || this.type === 'blur') {
            const clickedTile = this.grid[x][y];
            if (!this.selectedTile) {
                this.selectedTile = clickedTile;
                this.selectedTile.setSelected(true);
                return "selected";
            } else {
                if (this.selectedTile === clickedTile) {
                    this.selectedTile.setSelected(false);
                    this.selectedTile = null;
                    return "deselected";
                }
                const sPos = { ...this.selectedTile.currentGridPos };
                const result = this.performSwap(sPos.x, sPos.y, x, y);
                this.selectedTile.setSelected(false);
                this.selectedTile = null;
                return result;
            }
        }
        return false;
    }

    handleMemoryClick(x, y) {
        const tile = this.grid[x][y];
        if (!tile || tile.isFlipped || tile.isLocked || this.memoryFlipped.length >= 2) return false;

        tile.flip(true);
        this.memoryFlipped.push(tile);

        if (this.memoryFlipped.length === 2) {
            const [t1, t2] = this.memoryFlipped;
            const match = t1.id === t2.id;
            
            setTimeout(() => {
                if (match) {
                    t1.isLocked = t2.isLocked = true;
                    this.memoryMatches++;
                    if (this.memoryMatches === this.tiles.length / 2) {
                        this.handleWinCheck(true);
                    }
                } else {
                    t1.flip(false);
                    t2.flip(false);
                }
                this.memoryFlipped = [];
            }, 1000);
            return true;
        }
        return true;
    }

    getValidNeighbors(pos) {
        const neighbors = [];
        if (pos.x > 0) neighbors.push({ x: pos.x - 1, y: pos.y });
        if (pos.x < this.size - 1) neighbors.push({ x: pos.x + 1, y: pos.y });
        if (pos.y > 0) neighbors.push({ x: pos.x, y: pos.y - 1 });
        if (pos.y < this.size - 1) neighbors.push({ x: pos.x, y: pos.y + 1 });
        return neighbors;
    }

    moveTile(x, y, checkWin = true) {
        if (this.type !== 'slide') return false;
        
        const isEmptyRow = x === this.emptyPos.x;
        const isEmptyCol = y === this.emptyPos.y;
        
        if (!isEmptyRow && !isEmptyCol) return false;
        
        const tilesToMove = [];
        if (isEmptyRow) {
            const start = Math.min(y, this.emptyPos.y);
            const end = Math.max(y, this.emptyPos.y);
            for (let i = start; i <= end; i++) {
                if (i !== this.emptyPos.y) tilesToMove.push({ x, y: i });
            }
            // Sort by proximity to empty slot
            tilesToMove.sort((a, b) => Math.abs(a.y - this.emptyPos.y) - Math.abs(b.y - this.emptyPos.y));
        } else {
            const start = Math.min(x, this.emptyPos.x);
            const end = Math.max(x, this.emptyPos.x);
            for (let i = start; i <= end; i++) {
                if (i !== this.emptyPos.x) tilesToMove.push({ x: i, y });
            }
            // Sort by proximity to empty slot
            tilesToMove.sort((a, b) => Math.abs(a.x - this.emptyPos.x) - Math.abs(b.x - this.emptyPos.x));
        }

        if (tilesToMove.length === 0) return false;

        // Move tiles in sequence
        for (const pos of tilesToMove) {
            const tile = this.grid[pos.x][pos.y];
            const targetPos = { ...this.emptyPos };
            
            this.grid[targetPos.x][targetPos.y] = tile;
            this.grid[pos.x][pos.y] = null;
            this.emptyPos = { ...pos };
            
            tile.setGridPosition(targetPos.x, targetPos.y, TILE_SIZE, TILE_SPACING);
            tile.bounce();
        }
        
        return this.handleWinCheck(checkWin);
    }
    
    performSwap(x1, y1, x2, y2, checkWin = true) {
        const tile1 = this.grid[x1][y1];
        const tile2 = this.grid[x2][y2];
        
        this.grid[x1][y1] = tile2;
        this.grid[x2][y2] = tile1;
        
        tile1.setGridPosition(x2, y2, TILE_SIZE, TILE_SPACING);
        tile2.setGridPosition(x1, y1, TILE_SIZE, TILE_SPACING);
        
        tile1.bounce();
        tile2.bounce();
        
        return this.handleWinCheck(checkWin);
    }

    handleWinCheck(checkWin) {
        if (checkWin && this.isShuffled && this.checkWinCondition()) {
            this.isSolving = true;
            this.tiles.forEach(t => t.isLocked = true);
            return "win";
        }
        return true;
    }

    checkWinCondition() {
        if (this.type === 'hidden') return this.hiddenTargetsFound === this.extraData.targets.length;
        if (this.type === 'memory') return this.memoryMatches === this.tiles.length / 2;
        return this.tiles.every(tile => tile.isAtCorrectPosition());
    }

    getProgress() {
        if (this.type === 'memory') return (this.memoryMatches / (this.tiles.length / 2)) * 100;
        if (this.type === 'hidden') return (this.hiddenTargetsFound / this.extraData.targets.length) * 100;
        
        const correctCount = this.tiles.filter(tile => tile.isAtCorrectPosition()).length;
        return (correctCount / this.tiles.length) * 100;
    }

    update(dt) {
        this.tiles.forEach(tile => tile.update(dt));
    }

    destroy() {
        this.scene.remove(this.container);
        this.tiles.forEach(tile => {
            tile.mesh.geometry.dispose();
            tile.mesh.material.forEach(m => { if(m.dispose) m.dispose(); });
        });
        this.hiddenMarkers.forEach(m => {
            m.geometry.dispose();
            m.material.dispose();
        });
    }

    showHint(duration = 1000) {
        if (this.type === 'hidden') {
            this.hiddenMarkers.forEach(m => {
                if (!m.userData.found) m.material.opacity = 0.5;
            });
            setTimeout(() => {
                this.hiddenMarkers.forEach(m => {
                    if (!m.userData.found) m.material.opacity = 0;
                });
            }, duration);
            return;
        }

        this.tiles.forEach(tile => {
            tile.tempPos = tile.targetPosition.clone();
            tile.tempRot = tile.targetRotation.z;
            tile.tempFlip = tile.targetRotation.y;
            tile.setGridPosition(tile.correctGridPos.x, tile.correctGridPos.y, TILE_SIZE, TILE_SPACING);
            tile.targetRotation.z = 0;
            tile.targetRotation.y = 0;
        });
        
        setTimeout(() => {
            this.tiles.forEach(tile => {
                tile.targetPosition.copy(tile.tempPos);
                tile.targetRotation.z = tile.tempRot;
                tile.targetRotation.y = tile.tempFlip;
            });
        }, duration);
    }
}
