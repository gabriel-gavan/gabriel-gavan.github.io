import * as THREE from 'three';
import { PuzzleBoard } from './PuzzleBoard.js';
import { PUZZLES, COLORS, SKYBOX_URL } from './config.js';
import * as Tone from 'tone';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(COLORS.background);
        document.body.appendChild(this.renderer.domElement);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredTile = null;
        this.draggedTile = null;
        this.isDragging = false;
        this.dragStartTime = 0;
        this.dragStartPos = new THREE.Vector2();
        
        this.currentPuzzleIndex = 0;
        this.board = null;
        this.isGameActive = false;
        this.moves = 0;
        this.startTime = 0;
        this.timerInterval = null;

        // Particle system for win effect
        this.particles = [];
        this.particleGroup = new THREE.Group();
        this.scene.add(this.particleGroup);

        this.initLights();
        this.initSkybox();
        this.initAudio();
        this.setupEventListeners();
        this.renderHub();

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    initLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambient);
        const point = new THREE.PointLight(0xf472b6, 1.2, 50);
        point.position.set(5, 5, 10);
        this.scene.add(point);
        const point2 = new THREE.PointLight(0x38bdf8, 1, 50);
        point2.position.set(-5, -5, 10);
        this.scene.add(point2);
    }

    initSkybox() {
        const loader = new THREE.TextureLoader();
        loader.load(SKYBOX_URL, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.background = texture;
            this.scene.backgroundBlurriness = 0.1;
        });
    }

    initAudio() {
        this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
        this.synth.set({
            volume: -12,
            envelope: { attack: 0.05, decay: 0.2, sustain: 0.2, release: 1 }
        });

        // Ambient Drone System
        this.reverb = new Tone.Reverb(4).toDestination();
        this.ambientSynth = new Tone.FMSynth({
            harmonicity: 3,
            modulationIndex: 10,
            oscillator: { type: "sine" },
            envelope: { attack: 4, decay: 1, sustain: 1, release: 4 },
            modulation: { type: "square" },
            modulationEnvelope: { attack: 2, decay: 0.5, sustain: 1, release: 2 }
        }).connect(this.reverb);
        this.ambientSynth.volume.value = -25;

        // Slow evolving loop
        const notes = ["C2", "G2", "Ab1", "F1", "Eb2", "Bb1"];
        let index = 0;
        
        this.ambientLoop = new Tone.Loop(time => {
            if (this.isGameActive) {
                const note = notes[index % notes.length];
                this.ambientSynth.triggerAttackRelease(note, "2n", time);
                // Randomly tweak modulation for "shimmer"
                this.ambientSynth.modulationIndex.setValueAtTime(10 + Math.random() * 20, time);
                index++;
            }
        }, "4n");

        Tone.Transport.bpm.value = 40;
    }

    playNote(note = "C4", type = "click") {
        if (Tone.context.state !== 'running') Tone.start();
        const duration = type === "click" ? "16n" : "2n";
        const vel = type === "click" ? 0.3 : 0.6;
        this.synth.triggerAttackRelease(note, duration, undefined, vel);
    }

    renderHub() {
        const grid = document.getElementById('puzzle-grid');
        if (!grid) return;
        grid.innerHTML = '';
        PUZZLES.forEach((p, i) => {
            const item = document.createElement('div');
            item.className = `puzzle-item ${i === this.currentPuzzleIndex ? 'selected' : ''}`;
            item.innerHTML = `
                <img src="${p.url}" alt="${p.name}">
                <div class="puzzle-info">${p.name} - ${p.type.toUpperCase()}</div>
            `;
            item.onclick = () => {
                this.currentPuzzleIndex = i;
                document.querySelectorAll('.puzzle-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                this.playNote("E4");
                
                // Update preview image in the HUD too
                const previewImg = document.getElementById('preview-img');
                if (previewImg) previewImg.src = p.url;
            };
            grid.appendChild(item);
        });
        
        // Set initial preview to first puzzle
        const previewImg = document.getElementById('preview-img');
        if (previewImg && PUZZLES[this.currentPuzzleIndex]) {
            previewImg.src = PUZZLES[this.currentPuzzleIndex].url;
        }
    }

    async startLevel(index) {
        if (Tone.context.state !== 'running') await Tone.start();
        Tone.Transport.start();
        this.ambientLoop.start(0);

        if (this.board) this.board.destroy();
        
        const config = PUZZLES[index];
        this.board = new PuzzleBoard(this.scene, config.size, config.url, config.type);
        await this.board.init();
        
        this.board.shuffle();
        this.moves = 0;
        this.isGameActive = true;
        this.updateHUD();
        
        const overlay = document.getElementById('menu-overlay');
        if (overlay) overlay.classList.add('hidden');
        
        const startMenu = document.getElementById('start-menu');
        const winMenu = document.getElementById('win-menu');
        const loseMenu = document.getElementById('lose-menu');
        
        if (startMenu) startMenu.classList.remove('hidden');
        if (winMenu) winMenu.classList.add('hidden');
        if (loseMenu) loseMenu.classList.add('hidden');
        
        const protocolText = document.getElementById('protocol-text');
        if (protocolText) protocolText.textContent = config.type.toUpperCase();
        
        const previewImg = document.getElementById('preview-img');
        if (previewImg) previewImg.src = config.url;
        
        this.startTime = Date.now();
        this.startTimer();
        this.playNote("G4", "win");
        
        this.adjustCamera();
    }

    adjustCamera() {
        if (!this.board) return;
        const multiplier = this.board.type === 'scatter' ? 2.5 : 1.5;
        const size = this.board.size * 2.5;
        const dist = size / (2 * Math.tan(Math.PI * this.camera.fov / 360));
        this.camera.position.set(0, 0, dist * multiplier);
        this.camera.lookAt(0, 0, 0);
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const s = (elapsed % 60).toString().padStart(2, '0');
            const timerText = document.getElementById('timer-text');
            if (timerText) timerText.textContent = `${m}:${s}`;
        }, 1000);
    }

    updateHUD() {
        const movesText = document.getElementById('moves-text');
        if (movesText) movesText.textContent = this.moves;

        const progressFill = document.getElementById('progress-fill');
        if (progressFill && this.board) {
            const progress = this.board.getProgress();
            progressFill.style.width = `${progress}%`;
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            if (this.board) this.adjustCamera();
        });

        const updateMouse = (x, y) => {
            this.mouse.x = (x / window.innerWidth) * 2 - 1;
            this.mouse.y = -(y / window.innerHeight) * 2 + 1;
            
            if (this.board) {
                if (this.isDragging && this.draggedTile) {
                    this.raycaster.setFromCamera(this.mouse, this.camera);
                    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
                    const worldPoint = new THREE.Vector3();
                    this.raycaster.ray.intersectPlane(plane, worldPoint);
                    this.board.handleDragMove(worldPoint);
                } else {
                    this.board.container.rotation.y = this.mouse.x * 0.1;
                    this.board.container.rotation.x = -this.mouse.y * 0.1;
                }
            }
        };

        window.addEventListener('mousemove', (e) => updateMouse(e.clientX, e.clientY));
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) updateMouse(e.touches[0].clientX, e.touches[0].clientY);
        });

        const handleStart = (clientX, clientY) => {
            if (!this.isGameActive || !this.board) return;
            updateMouse(clientX, clientY);
            this.dragStartPos.set(clientX, clientY);
            this.dragStartTime = Date.now();

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.board.tiles.map(t => t.mesh));
            if (intersects.length > 0) {
                const tileMesh = intersects[0].object;
                const tile = this.board.tiles.find(t => t.mesh === tileMesh);
                
                if (this.board.type === 'scatter') {
                    this.isDragging = true;
                    this.draggedTile = this.board.handleDragStart(tile);
                } else {
                    const result = this.board.handleClick(intersects[0].point);
                    if (result) {
                        if (result !== "selected" && result !== "deselected") {
                            this.moves++;
                        }
                        this.updateHUD(); // Always update HUD to capture progress
                        this.playNote(result === "win" ? "C5" : "C4");
                        if (result === "win") this.onWin();
                    }
                }
            }
        };

        const handleEnd = (clientX, clientY) => {
            if (this.isDragging && this.board) {
                // Check if it was a quick tap
                const duration = Date.now() - this.dragStartTime;
                const dist = this.dragStartPos.distanceTo(new THREE.Vector2(clientX, clientY));
                
                if (duration < 250 && dist < 10) {
                    // Tap -> Rotate
                    this.draggedTile.rotate();
                    this.playNote("E4");
                    const result = this.board.handleDragEnd(); 
                    if (result === "win") this.onWin();
                } else {
                    const result = this.board.handleDragEnd();
                    if (result && result !== true) { 
                        this.moves++;
                        this.updateHUD();
                        if (result === "win") this.onWin();
                        this.playNote(result === "win" ? "C5" : "G4");
                    } else if (result === true) {
                        this.playNote("D4");
                    }
                }
            }
            this.isDragging = false;
            this.draggedTile = null;
        };

        window.addEventListener('mousedown', (e) => handleStart(e.clientX, e.clientY));
        window.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) handleStart(e.touches[0].clientX, e.touches[0].clientY);
        });
        window.addEventListener('mouseup', (e) => handleEnd(e.clientX, e.clientY));
        window.addEventListener('touchend', (e) => {
            if (e.changedTouches.length > 0) handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        });

        const startBtn = document.getElementById('start-btn');
        if (startBtn) startBtn.onclick = () => this.startLevel(this.currentPuzzleIndex);

        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) nextBtn.onclick = () => {
            this.currentPuzzleIndex = (this.currentPuzzleIndex + 1) % PUZZLES.length;
            this.startLevel(this.currentPuzzleIndex);
        };

        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) retryBtn.onclick = () => this.startLevel(this.currentPuzzleIndex);

        const hintBtn = document.getElementById('hint-btn');
        if (hintBtn) hintBtn.onclick = () => {
            if (this.board) {
                this.board.showHint();
                this.playNote("A4");
            }
        };
    }

    createWinExplosion() {
        const count = 100;
        const geometry = new THREE.SphereGeometry(0.05, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: COLORS.successGlow });
        
        for (let i = 0; i < count; i++) {
            const particle = new THREE.Mesh(geometry, material.clone());
            particle.position.set(0, 0, 0);
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                Math.random() * 0.5
            );
            this.particles.push({ mesh: particle, velocity, life: 1.0 });
            this.particleGroup.add(particle);
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.mesh.position.add(p.velocity);
            p.life -= 0.01;
            if (p.mesh.material.opacity !== undefined) {
                p.mesh.material.opacity = p.life;
                p.mesh.material.transparent = true;
            }
            if (p.life <= 0) {
                this.particleGroup.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }

    showHub() {
        this.isGameActive = false;
        Tone.Transport.stop();
        if (this.timerInterval) clearInterval(this.timerInterval);
        const overlay = document.getElementById('menu-overlay');
        if (overlay) overlay.classList.remove('hidden');
        
        const startMenu = document.getElementById('start-menu');
        const winMenu = document.getElementById('win-menu');
        const loseMenu = document.getElementById('lose-menu');
        
        if (startMenu) startMenu.classList.remove('hidden');
        if (winMenu) winMenu.classList.add('hidden');
        if (loseMenu) loseMenu.classList.add('hidden');
        
        this.renderHub();
    }

    onWin() {
        this.isGameActive = false;
        Tone.Transport.stop();
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.createWinExplosion();
        
        setTimeout(() => {
            const overlay = document.getElementById('menu-overlay');
            if (overlay) overlay.classList.remove('hidden');
            const winMenu = document.getElementById('win-menu');
            if (winMenu) winMenu.classList.remove('hidden');
            const startMenu = document.getElementById('start-menu');
            if (startMenu) startMenu.classList.add('hidden');
            const finalTime = document.getElementById('final-time');
            const timerText = document.getElementById('timer-text');
            if (finalTime && timerText) finalTime.textContent = timerText.textContent;
            const finalMoves = document.getElementById('final-moves');
            if (finalMoves) finalMoves.textContent = this.moves;
        }, 1500);

        this.playNote("C5", "win");
    }

    animate() {
        requestAnimationFrame(this.animate);
        
        if (this.isGameActive && this.board) {
            this.updateHUD(); // Constantly update to show progress bar filling
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.board.tiles.map(t => t.mesh));
            
            if (intersects.length > 0) {
                const tileMesh = intersects[0].object;
                const tile = this.board.tiles.find(t => t.mesh === tileMesh);
                if (tile !== this.hoveredTile) {
                    if (this.hoveredTile) {
                        this.hoveredTile.mesh.scale.set(1, 1, 1);
                        this.hoveredTile.isHovered = false;
                    }
                    this.hoveredTile = tile;
                    if (tile) {
                        tile.mesh.scale.set(1.05, 1.05, 1.05);
                        tile.isHovered = true;
                    }
                }
            } else if (this.hoveredTile) {
                this.hoveredTile.mesh.scale.set(1, 1, 1);
                this.hoveredTile.isHovered = false;
                this.hoveredTile = null;
            }
        }

        this.updateParticles();
        if (this.board) this.board.update(0.016);
        this.renderer.render(this.scene, this.camera);
    }
}

new Game();
