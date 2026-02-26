import * as THREE from 'three';
import { Config } from './Config.js';
import { Car } from './Car.js';
import { Track } from './Track.js';
import { CampaignData } from './CampaignData.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();
        this.input = { forward: false, backward: false, left: false, right: false };
        
        this.currentTrackIndex = 0;
        this.completedTracks = JSON.parse(localStorage.getItem('neon_campaign_progress') || '[]');
        this.username = localStorage.getItem('neon_username') || Config.DEFAULT_PLAYER_NAME;

        this.setupLights();
        this.setupSkybox();
        this.setupEvents();
        this.createUI();
        
        this.gameState = 'menu';
        this.animate();

        if (!localStorage.getItem('neon_username')) {
            this.showUsernamePrompt();
        }
    }

    showUsernamePrompt() {
        const modal = document.createElement('div');
        modal.id = 'usernameModal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.9); display: flex; align-items: center; justify-content: center;
            z-index: 1000; font-family: 'Orbitron', sans-serif;
        `;
        modal.innerHTML = `
            <div style="background: #111; border: 2px solid #00ffff; padding: 40px; text-align: center; box-shadow: 0 0 30px #00ffff;">
                <h2 style="color: #00ffff; margin-top: 0;">ENTER PILOT ID</h2>
                <input type="text" id="usernameInput" maxlength="12" placeholder="PILOT NAME" style="
                    background: #000; border: 1px solid #00ffff; color: #00ffff; padding: 10px; 
                    font-family: 'Orbitron'; font-size: 18px; text-align: center; margin-bottom: 20px;
                    outline: none;
                ">
                <br>
                <button id="saveUsername" style="
                    background: #00ffff; color: #000; border: none; padding: 10px 30px; 
                    font-family: 'Orbitron'; font-size: 16px; cursor: pointer; font-weight: bold;
                ">INITIALIZE</button>
            </div>
        `;
        document.body.appendChild(modal);

        const input = modal.querySelector('#usernameInput');
        const btn = modal.querySelector('#saveUsername');

        const save = () => {
            const val = input.value.trim().toUpperCase();
            if (val) {
                this.username = val;
                localStorage.setItem('neon_username', val);
                document.body.removeChild(modal);
                // Refresh menu if in menu state
                if (this.gameState === 'menu') {
                    this.renderCampaignMenu(document.getElementById('menu'));
                }
            }
        };

        btn.onclick = save;
        input.onkeydown = (e) => { if (e.key === 'Enter') save(); };
    }

    initLevel(index) {
        if (this.track) this.track.destroy();
        this.currentTrackIndex = index;
        const trackData = CampaignData.tracks[index];
        this.track = new Track(this.scene, index);

        // Update Laps from data
        this.lapsToWin = trackData.laps || Config.LAPS_TO_WIN;
        
        // Update Skybox from data
        const loader = new THREE.TextureLoader();
        const texture = loader.load(trackData.skybox);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.background = texture;
        this.scene.environment = texture;

        // Initial positions and angles based on track direction
        const startPos = this.track.waypoints[0];
        const nextPos = this.track.waypoints[1];
        const startDir = nextPos.clone().sub(startPos).normalize();
        const startAngle = Math.atan2(startDir.x, startDir.z);
        const lateralDir = new THREE.Vector3(-startDir.z, 0, startDir.x);

        if (this.player) this.scene.remove(this.player.mesh);
        this.player = new Car(this.scene, Config.COLORS.PLAYER, true, this.username);
        this.player.mesh.position.copy(startPos).add(lateralDir.clone().multiplyScalar(-4));
        this.player.angle = startAngle;
        this.player.mesh.rotation.y = startAngle;

        // Randomize AI names for this race
        const shuffledNames = [...Config.AI_NAMES].sort(() => 0.5 - Math.random());

        if (this.aiCars) this.aiCars.forEach(ai => this.scene.remove(ai.mesh));
        this.aiCars = [
            new Car(this.scene, Config.COLORS.AI1, false, shuffledNames[0]),
            new Car(this.scene, Config.COLORS.AI2, false, shuffledNames[1])
        ];
        
        this.aiCars[0].mesh.position.copy(startPos).add(lateralDir.clone().multiplyScalar(4));
        this.aiCars[0].angle = startAngle;
        this.aiCars[0].mesh.rotation.y = startAngle;
        
        this.aiCars[1].mesh.position.copy(startPos).sub(startDir.clone().multiplyScalar(15));
        this.aiCars[1].angle = startAngle;
        this.aiCars[1].mesh.rotation.y = startAngle;

        this.gameState = 'countdown';
        this.startCountdown();
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
        mainLight.position.set(100, 200, 100);
        this.scene.add(mainLight);

        // Neon Glow Fog
        this.scene.fog = new THREE.FogExp2(0x00050a, 0.002);
    }

    setupSkybox() {
        const loader = new THREE.TextureLoader();
        const texture = loader.load(Config.ASSETS.SKYBOX);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.background = texture;
        this.scene.environment = texture; // For PBR reflections
    }

    setupEvents() {
        window.addEventListener('keydown', (e) => this.handleKey(e.code, true));
        window.addEventListener('keyup', (e) => this.handleKey(e.code, false));
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    handleKey(code, isDown) {
        if (code === 'ArrowUp' || code === 'KeyW') this.input.forward = isDown;
        if (code === 'ArrowDown' || code === 'KeyS') this.input.backward = isDown;
        if (code === 'ArrowLeft' || code === 'KeyA') this.input.left = isDown;
        if (code === 'ArrowRight' || code === 'KeyD') this.input.right = isDown;
    }

    createUI() {
        // Hud
        const hud = document.createElement('div');
        hud.id = 'hud';
        hud.style.cssText = `
            position: absolute; top: env(safe-area-inset-top, 20px); left: env(safe-area-inset-left, 20px); color: #00ffff;
            font-family: 'Orbitron', sans-serif; font-size: 16px;
            text-shadow: 0 0 10px #00ffff; pointer-events: none; display: none;
            max-width: 90vw;
        `;
        hud.innerHTML = `
            <div id="pilotName" style="color: #ff00ff; margin-bottom: 5px;"></div>
            <div id="trackName"></div>
            <div id="lap">LAP: 1 / ${Config.LAPS_TO_WIN}</div>
            <div id="time">TIME: 0.0s</div>
            <div id="speed">SPEED: 0</div>
            <div id="standings" style="margin-top: 10px; font-size: 14px; opacity: 0.9;"></div>
            <canvas id="minimap" width="120" height="120" style="
                margin-top: 10px; border: 2px solid rgba(0,255,255,0.3);
                background: rgba(0,0,0,0.5); width: 120px; height: 120px;
            "></canvas>
        `;
        document.body.appendChild(hud);

        // Mobile Controls
        const mobileControls = document.createElement('div');
        mobileControls.id = 'mobileControls';
        mobileControls.style.cssText = `
            position: absolute; bottom: 30px; left: 0; width: 100%; height: 160px;
            display: none; justify-content: space-between; padding: 0 30px;
            box-sizing: border-box; z-index: 100;
        `;
        mobileControls.innerHTML = `
            <div style="display: flex; gap: 20px;">
                <div id="btnLeft" style="width: 70px; height: 70px; background: rgba(0,255,255,0.2); border: 2px solid #00ffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; color: #00ffff;">←</div>
                <div id="btnRight" style="width: 70px; height: 70px; background: rgba(0,255,255,0.2); border: 2px solid #00ffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; color: #00ffff;">→</div>
            </div>
            <div style="display: flex; gap: 20px;">
                <div id="btnBackward" style="width: 70px; height: 70px; background: rgba(255,0,255,0.2); border: 2px solid #ff00ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #ff00ff;">BRAKE</div>
                <div id="btnForward" style="width: 80px; height: 80px; background: rgba(0,255,255,0.2); border: 2px solid #00ffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #00ffff; font-weight: bold;">GAS</div>
            </div>
        `;
        document.body.appendChild(mobileControls);
        this.setupMobileControls(mobileControls);

        // Campaign Menu
        const menu = document.createElement('div');
        menu.id = 'menu';
        menu.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url('assets/game_thumbnail.webp');
            background-size: cover;
            background-position: center;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 200; overflow-y: auto; padding: 40px 0;
        `;
        this.renderCampaignMenu(menu);
        document.body.appendChild(menu);

        // Countdown
        const countdownDisplay = document.createElement('div');
        countdownDisplay.id = 'countdown';
        countdownDisplay.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            color: #00ffff; font-family: 'Orbitron', sans-serif; font-size: 150px;
            text-shadow: 0 0 40px #00ffff; display: none; z-index: 150;
        `;
        document.body.appendChild(countdownDisplay);

        // Messages
        const msg = document.createElement('div');
        msg.id = 'message';
        msg.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            color: #ff00ff; font-family: 'Orbitron', sans-serif; font-size: 60px;
            text-shadow: 0 0 20px #ff00ff; display: none; text-align: center; z-index: 160;
        `;
        document.body.appendChild(msg);
    }

    setupMobileControls(container) {
        const bind = (id, key) => {
            const el = document.getElementById(id);
            el.addEventListener('touchstart', (e) => { e.preventDefault(); this.input[key] = true; el.style.background = 'rgba(0,255,255,0.5)'; });
            el.addEventListener('touchend', (e) => { e.preventDefault(); this.input[key] = false; el.style.background = 'rgba(0,255,255,0.2)'; });
        };
        bind('btnLeft', 'left');
        bind('btnRight', 'right');
        bind('btnForward', 'forward');
        bind('btnBackward', 'backward');

        // Only show if touch is supported
        if ('ontouchstart' in window) {
            container.style.display = 'flex';
        }
    }

    renderCampaignMenu(container) {
        const isMobile = window.innerWidth < 768;
        container.innerHTML = `
            <style>
                @keyframes pulse-neon {
                    0% { box-shadow: 0 0 5px var(--glow); border-color: var(--glow); }
                    50% { box-shadow: 0 0 20px var(--glow); border-color: #fff; }
                    100% { box-shadow: 0 0 5px var(--glow); border-color: var(--glow); }
                }
                .track-btn {
                    position: relative;
                    overflow: hidden;
                    background: rgba(0, 20, 40, 0.6);
                    backdrop-filter: blur(8px);
                    border: 1px solid #333;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    clip-path: polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%);
                }
                .track-btn.unlocked { 
                    --glow: #00ffff;
                    border-color: #00ffff;
                    box-shadow: 0 0 10px rgba(0, 255, 255, 0.2);
                }
                .track-btn.completed {
                    --glow: #00ff00;
                    border-color: #00ff00;
                }
                .track-btn.locked {
                    --glow: #444;
                    opacity: 0.6;
                    cursor: default;
                }
                .track-btn.unlocked:hover {
                    transform: scale(1.05);
                    background: rgba(0, 255, 255, 0.1);
                    animation: pulse-neon 1.5s infinite;
                }
                .track-btn::before {
                    content: '';
                    position: absolute;
                    top: 0; left: -100%;
                    width: 100%; height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    transition: 0.5s;
                }
                .track-btn:hover::before {
                    left: 100%;
                }
            </style>
            <div style="width: 100%; max-width: 800px; margin-bottom: 30px; text-align: center; padding: 0 20px;">
                <h1 style="color: #00ffff; font-family: 'Orbitron'; font-size: ${isMobile ? '28px' : '56px'}; text-shadow: 0 0 30px #00ffff; margin: 0; letter-spacing: 6px; font-weight: 900;">NEON RACING</h1>
                <div style="color: #ff00ff; font-family: 'Orbitron'; font-size: 14px; letter-spacing: 4px; margin-top: 5px; opacity: 0.8;">WELCOME PILOT: ${this.username}</div>
                <div style="color: #00ffff; font-family: 'Orbitron'; font-size: 12px; letter-spacing: 2px; margin-top: 10px; opacity: 0.6; cursor: pointer;" onclick="window.gameInstance.showUsernamePrompt()">[ CHANGE ID ]</div>
            </div>
            <div id="trackList" style="display: grid; grid-template-columns: ${isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'}; gap: 15px; width: 95%; max-width: 900px;"></div>
			            
            <div style="margin-top: 40px; width: 100%; display: flex; justify-content: center;">
                <button onclick="window.location.href='/index.html'" style="
                    background: transparent;
                    border: 1px solid #ff00ff;
                    color: #ff00ff;
                    padding: 10px 25px;
                    font-family: 'Orbitron', sans-serif;
                    font-size: 14px;
                    letter-spacing: 2px;
                    cursor: pointer;
                    transition: all 0.3s;
                    clip-path: polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%);
                    text-transform: uppercase;
                " onmouseover="this.style.background='rgba(255,0,255,0.1)'; this.style.boxShadow='0 0 15px #ff00ff';" onmouseout="this.style.background='transparent'; this.style.boxShadow='none';">
                    Return to Hub
                </button>
            </div>
        `;
        const list = container.querySelector('#trackList');
        CampaignData.tracks.forEach((track, i) => {
            const isUnlocked = i === 0 || this.completedTracks.includes(i - 1);
            const isCompleted = this.completedTracks.includes(i);
            
            const btn = document.createElement('div');
            btn.className = `track-btn ${isUnlocked ? 'unlocked' : 'locked'} ${isCompleted ? 'completed' : ''}`;
            btn.style.padding = isMobile ? '15px 10px' : '20px 15px';
            
            btn.innerHTML = `
                <div style="font-size: ${isMobile ? '13px' : '16px'}; color: #fff; font-family: 'Orbitron'; font-weight: bold; text-shadow: 0 0 10px var(--glow); text-transform: uppercase; letter-spacing: 1px;">${track.name}</div>
                <div style="font-size: 10px; margin-top: 8px; color: var(--glow); font-family: 'Orbitron'; letter-spacing: 1px; font-weight: bold;">
                    ${isCompleted ? '✓ CLEARED' : (isUnlocked ? 'ENGAGE >' : 'ACCESS DENIED')}
                </div>
            `;
            if (isUnlocked) {
                btn.onclick = () => {
                    container.style.display = 'none';
                    document.getElementById('hud').style.display = 'block';
                    this.initLevel(i);
                };
            }
            list.appendChild(btn);
        });
    }

    startCountdown() {
        this.gameState = 'countdown';
        let count = 3;
        const display = document.getElementById('countdown');
        display.style.display = 'block';
        display.innerText = count;

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                display.innerText = count;
            } else if (count === 0) {
                display.innerText = 'GO!';
                this.gameState = 'playing';
                this.startTime = Date.now();
            } else {
                display.style.display = 'none';
                clearInterval(interval);
            }
        }, 1000);
    }

    updateUI() {
        if (!this.player) return;
        document.getElementById('pilotName').innerText = `PILOT: ${this.username}`;
        document.getElementById('trackName').innerText = CampaignData.tracks[this.currentTrackIndex].name.toUpperCase();
        document.getElementById('lap').innerText = `LAP: ${Math.max(1, Math.min(this.player.lap + 1, this.lapsToWin))} / ${this.lapsToWin}`;
        const elapsed = (Date.now() - this.startTime) / 1000;
        document.getElementById('time').innerText = `TIME: ${elapsed.toFixed(1)}s`;
        document.getElementById('speed').innerText = `SPEED: ${Math.abs(Math.floor(this.player.speed * 120))}`;

        // Simple Rankings
        const allCars = [this.player, ...this.aiCars];
        allCars.sort((a, b) => {
            if (a.lap !== b.lap) return b.lap - a.lap;
            return b.currentWaypointIndex - a.currentWaypointIndex;
        });

        let standingsHTML = 'STANDINGS:<br>';
        allCars.forEach((car, i) => {
            const color = car.isPlayer ? '#00ffff' : (car === this.aiCars[0] ? '#ff00ff' : '#ffff00');
            standingsHTML += `<span style="color: ${color}">${i + 1}. ${car.name}</span><br>`;
        });
        document.getElementById('standings').innerHTML = standingsHTML;

        if (this.gameState === 'playing' && this.player.lap >= this.lapsToWin) {
            this.handleWin();
        }

        this.aiCars.forEach(ai => {
            if (this.gameState === 'playing' && ai.lap >= this.lapsToWin) {
                this.handleLoss(ai);
            }
        });

        this.drawMinimap();
    }

    drawMinimap() {
        const canvas = document.getElementById('minimap');
        if (!canvas || !this.track) return;
        const ctx = canvas.getContext('2d');
        const size = canvas.width;
        ctx.clearRect(0, 0, size, size);

        // Calculate bounds
        const waypoints = this.track.waypoints;
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        waypoints.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minZ = Math.min(minZ, p.z);
            maxZ = Math.max(maxZ, p.z);
        });

        const padding = 20;
        const trackW = (maxX - minX) || 1;
        const trackH = (maxZ - minZ) || 1;
        const scale = Math.min((size - padding * 2) / trackW, (size - padding * 2) / trackH);
        
        const toUX = (x) => padding + (x - minX) * scale;
        const toUZ = (z) => padding + (z - minZ) * scale;

        // Draw track
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const curvePoints = this.track.curve.getPoints(100);
        ctx.moveTo(toUX(curvePoints[0].x), toUZ(curvePoints[0].z));
        curvePoints.forEach(p => ctx.lineTo(toUX(p.x), toUZ(p.z)));
        ctx.closePath();
        ctx.stroke();

        // Draw Player
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(toUX(this.player.mesh.position.x), toUZ(this.player.mesh.position.z), 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw AI
        this.aiCars.forEach(ai => {
            ctx.fillStyle = ai.color === Config.COLORS.AI1 ? '#ff00ff' : '#ffff00';
            ctx.beginPath();
            ctx.arc(toUX(ai.mesh.position.x), toUZ(ai.mesh.position.z), 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    handleWin() {
        this.gameState = 'won';
        if (!this.completedTracks.includes(this.currentTrackIndex)) {
            this.completedTracks.push(this.currentTrackIndex);
            localStorage.setItem('neon_campaign_progress', JSON.stringify(this.completedTracks));
        }
        const msg = document.getElementById('message');
        msg.innerHTML = `${this.username} WINS!<br><span style="font-size: 24px; color: #00ffff">TRACK COMPLETED</span>`;
        msg.style.display = 'block';
        setTimeout(() => this.returnToMenu(), 3000);
    }

    handleLoss(winner) {
        this.gameState = 'lost';
        const msg = document.getElementById('message');
        msg.innerHTML = `${winner.name} WON!<br><span style="font-size: 24px; color: #ff0000">TRY AGAIN</span>`;
        msg.style.display = 'block';
        setTimeout(() => this.returnToMenu(), 3000);
    }

    returnToMenu() {
        document.getElementById('message').style.display = 'none';
        document.getElementById('hud').style.display = 'none';
        const menu = document.getElementById('menu');
        this.renderCampaignMenu(menu);
        menu.style.display = 'flex';
        this.gameState = 'menu';
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const dt = this.clock.getDelta() * 1000;

        if (this.gameState === 'playing') {
            this.player.update(dt, this.input);
            this.aiCars.forEach(ai => ai.update(dt, null, this.track.waypoints));
            this.track.checkCollisions(this.player);
            this.aiCars.forEach(ai => this.track.checkCollisions(ai));

            // Collision logic...
            const allCars = [this.player, ...this.aiCars];
            for (let i = 0; i < allCars.length; i++) {
                for (let j = i + 1; j < allCars.length; j++) {
                    const c1 = allCars[i];
                    const c2 = allCars[j];
                    const dist = c1.mesh.position.distanceTo(c2.mesh.position);
                    if (dist < 3.5) {
                        const pushDir = c1.mesh.position.clone().sub(c2.mesh.position);
                        pushDir.y = 0;
                        pushDir.normalize();
                        c1.mesh.position.add(pushDir.clone().multiplyScalar(0.5));
                        c2.mesh.position.sub(pushDir.clone().multiplyScalar(0.5));
                        c1.speed *= 0.8;
                        c2.speed *= 0.8;
                    }
                }
            }
        }

        if (this.player) {
            const targetPos = this.player.mesh.position.clone();
            const cameraOffset = new THREE.Vector3(
                -Math.sin(this.player.angle) * 18,
                9,
                -Math.cos(this.player.angle) * 18
            );
            this.camera.position.lerp(targetPos.clone().add(cameraOffset), 0.1);
            const lookAtPos = targetPos.clone().add(new THREE.Vector3(
                Math.sin(this.player.angle) * 8,
                2,
                Math.cos(this.player.angle) * 8
            ));
            this.camera.lookAt(lookAtPos);
            this.updateUI();
        }

        this.renderer.render(this.scene, this.camera);
    }
}

window.gameInstance = new Game();
