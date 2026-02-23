import * as THREE from 'three';
import { Navigation } from './Navigation.js';
import { PlayerController, FirstPersonCameraController } from './rosie/controls/rosieControls.js';
import { CONFIG } from './config.js';
import { GameMap } from './Map.js';
import { Turret } from './Turret.js';
import { Player } from './Player.js';
import { Enemy } from './Enemy.js';
import { HealthPack } from './HealthPack.js';
import { AmmoCrate } from './AmmoCrate.js';
import { ParticleSystem } from './ParticleSystem.js';
import { Grenade } from './Grenade.js';
import { FireField } from './FireField.js';
import { GasLeak } from './GasLeak.js';
import { SmokeScreen } from './SmokeScreen.js';
import { EMPGrenade } from './EMPGrenade.js';
import { CreditChip } from './CreditChip.js';
import { DataCore } from './DataCore.js';
import { CryoVent } from './CryoVent.js';
import { SpatialGrid } from './SpatialGrid.js';

export class GameScene {
    constructor() {
        this.init();
    }

    init() {
        // Meta Progression
        this.metaCredits = 0;
        this.metaUpgrades = {
            health: 0,
            ammo: 0,
            cores: 0,
            scrap: 0
        };
        this.META_UPGRADES = [
            { id: 'health', name: 'Starting HP', desc: 'Persistent integrity reinforcement (+20 HP).', baseCost: 1000, max: 10 },
            { id: 'ammo', name: 'Reserve Ammo', desc: 'Expanded magazine storage for all systems (+1 mag).', baseCost: 1500, max: 5 },
            { id: 'cores', name: 'Initial Cores', desc: 'Pre-load tactical hacking cores (+1 Core).', baseCost: 3000, max: 3 },
            { id: 'scrap', name: 'Starting Credits', desc: 'Secure initial black market funds (+100 Scrap).', baseCost: 1200, max: 5 }
        ];
        this.loadMetaState();

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.game = this; // Expose game instance to entities
        this.scene.background = new THREE.Color(0x0a0a0c);
        this.scene.fog = new THREE.FogExp2(0x0a0a0c, 0.02); // Reduced fog density for better visibility

        // Particle System
        this.particleSystem = new ParticleSystem(this.scene);

        // Spatial Grid for performance optimization
        this.spatialGrid = new SpatialGrid(10);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.scene.add(this.camera);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = false; // Disable shadows for significant performance boost
        this.renderer.domElement.tabIndex = 1; // Allow canvas to receive focus for keyboard events
        document.body.appendChild(this.renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(10, 20, 10);
        this.scene.add(sunLight);

        // Map
        this.map = null;
        this.navigation = null;
        this.missionLights = [];
        this.missionParticles = [];

        // Shake state
        this.shakeAmount = 0;

        // Player
        this.player = new Player(this.scene, this.camera, this.particleSystem, (amt) => {
            this.shakeAmount = Math.max(this.shakeAmount, amt);
        }, (barrel) => {
            this.handleBarrelExplosion(barrel);
        }, (pipe, point) => {
            this.handlePipeHit(pipe, point);
        }, (gasLeak) => {
            this.handleGasIgnite(gasLeak);
        }, (extProp) => {
            this.handleExtinguisherBurst(extProp);
        }, (enemy) => {
            this.handleEnemyKilled(enemy);
        }, (obj) => {
            this.handleObjectDestruction(obj);
        });
        this.player.mesh.position.set(0, 1, 0); // Start at origin
        
        // Critical: Set player reference in particle system AFTER player is created
        this.particleSystem.player = this.player; 
        
        // Rosie Controls
        this.playerController = new PlayerController(this.player.mesh, {
            moveSpeed: CONFIG.PLAYER.MOVE_SPEED,
            jumpForce: CONFIG.PLAYER.JUMP_FORCE,
            gravity: CONFIG.PLAYER.GRAVITY,
            groundLevel: 1, // Matches player mesh center height
            ceilingLevel: CONFIG.MAP.WALL_HEIGHT - 1.05,
            radius: 0.6 // Consistent collision radius
        });
        
        this.cameraController = new FirstPersonCameraController(this.camera, this.player.mesh, this.renderer.domElement, {
            eyeHeight: CONFIG.PLAYER.EYE_HEIGHT
        });
        this.cameraController.enable();
        this.playerController.setCameraMode('first-person');

        // Enemies
        this.enemies = [];
        this.turrets = [];
        this.pickups = [];
        this.activeGrenades = [];
        this.grenadePool = [];
        this.empGrenadePool = [];
        
        for (let i = 0; i < 5; i++) {
            this.grenadePool.push(new Grenade(this.scene, this.particleSystem));
            this.empGrenadePool.push(new EMPGrenade(this.scene, this.particleSystem));
        }

        this.activeFireFields = [];
        this.activeGasLeaks = [];
        this.activeSmokeScreens = [];
        this.lastEnemySpawn = Date.now() + 5000; // 5 second grace period at start
        this.lastPickupSpawnCheck = 0;

        // Hacking state
        this.isHacking = false;
        this.hackingDrone = null;
        this.hackingProgress = 0;
        this.hackingNeedleRotation = 0;
        this.hackingTargetRotation = 0;
        this.hackingTargetSize = 40; // degrees
        this.hackingNeedleSpeed = 300; // degrees per second

        // Command Menu state
        this.isMenuOpen = false;
        this.selectedCommand = null;
        this.commandMarker = this.createCommandMarker();

        // Optimized Raycasting Targets
        this.raycastTargets = [];
        this.lastRaycastUpdate = 0;

        // Progression state
        this.currentFacility = CONFIG.FACILITIES[0];
        this.currentChamberIndex = 0;
        this.enemiesPerChamber = this.currentFacility.enemies;
        this.chamberClearingStatus = 'ACTIVE'; // ACTIVE, CLEARED, UNLOCKED

        // Neural Sync state
        this.isNeuralSyncing = false;
        this.syncLevel = 0; // 0, 1, 2, 3
        this.ringRotations = [0, 0, 0];
        this.ringSpeeds = [120, -180, 240];
        this.ringLocked = [false, false, false];

        // Terminal hacking state
        this.isTerminalMenuOpen = false;
        this.isShopOpen = false;
        this.isHackingTerminal = false;
        this.terminalHackProgress = 0;
        this.terminalHackDuration = 20.0; // Increased for defense event
        this.currentTerminal = null;
        this.hackingWavesTriggered = [false, false, false]; // 0%, 33%, 66%
        this.finalBossSpawned = false;
        this.finalBossAlive = false;
        
        // Heat System state
        this.heatLevel = 1;
        this.missionStartTime = 0;
        this.heatVisuals = {
            targetFogColor: new THREE.Color(CONFIG.HEAT.VISUALS.FOG_COLOR_START),
            currentFogColor: new THREE.Color(CONFIG.HEAT.VISUALS.FOG_COLOR_START),
            targetAmbientIntensity: CONFIG.HEAT.VISUALS.AMBIENT_INTENSITY_START,
            currentAmbientIntensity: CONFIG.HEAT.VISUALS.AMBIENT_INTENSITY_START,
            glitchIntensity: 0
        };
        
        this.shopItems = [
            { id: 'medkit', name: 'MEDICAL NANITES', desc: 'Instantly restores 50% health.', price: 30, currency: 'scrap' },
            { id: 'ammo_rifle', name: 'RIFLE CALIBER CASE', desc: 'Full reserve refill for Rifle.', price: 20, currency: 'scrap' },
            { id: 'ammo_sniper', name: 'PRECISION CORES', desc: 'Full reserve refill for Sniper.', price: 30, currency: 'scrap' },
            { id: 'grenade', name: 'FRAG GRENADE', desc: 'Standard high-explosive ordnance.', price: 15, currency: 'scrap' },
            { id: 'emp', name: 'EMP CAPACITOR', desc: 'Disrupts electronic systems.', price: 20, currency: 'scrap' },
            { id: 'tech_core', name: 'BLACK MARKET TECH CORE', desc: 'Illegal drone hardware upgrade component.', price: 150, currency: 'scrap' },
            { id: 'armor', name: 'REINFORCED PLATING', desc: 'Increases max health by 25.', price: 2, currency: 'cores' },
            { id: 'mod_rifle_rof', name: 'RIFLE: RAPID-FIRE', desc: 'Increases fire rate by 10%. (Max Lvl 5)', price: 1, currency: 'cores' },
            { id: 'mod_rifle_dmg', name: 'RIFLE: KINETIC AMPS', desc: 'Increases damage by 15%. (Max Lvl 5)', price: 2, currency: 'cores' },
            { id: 'mod_rifle_reload', name: 'RIFLE: FAST-MAG', desc: 'Increases reload speed by 10%. (Max Lvl 5)', price: 1, currency: 'cores' },
            { id: 'mod_sniper_rof', name: 'SNIPER: HAIR-TRIGGER', desc: 'Increases fire rate by 10%. (Max Lvl 5)', price: 2, currency: 'cores' },
            { id: 'mod_sniper_dmg', name: 'SNIPER: RAIL ACCELERATOR', desc: 'Increases damage by 15%. (Max Lvl 5)', price: 3, currency: 'cores' },
            { id: 'mod_sniper_reload', name: 'SNIPER: SPEED-LOADER', desc: 'Increases reload speed by 10%. (Max Lvl 5)', price: 2, currency: 'cores' },
            { id: 'ammo_incendiary', name: 'INCENDIARY ROUNDS', desc: '30 rounds that burn enemies over time.', price: 40, currency: 'scrap' },
            { id: 'ammo_shock', name: 'SHOCK ROUNDS', desc: '20 rounds that stun and arc to nearby hostiles.', price: 50, currency: 'scrap' },
        ];

        // Audio Setup
        this.hackSynth = null;
        this.successSynth = null;
        this.shootSynth = null;
        this.impactSynth = null;
        this.ambientHum = null;
        this.hazardHiss = null;
        this.shieldHum = null;
        this.eliteScreech = null; // High-pitched digital screech for elites
        this.tacticalHandshake = null; // Command feedback audio

        // Tactical Radar state
        this.radarUpdateTimer = 0;
        this.radarDots = [];
        this.missionCredits = 500;
        this.scrap = 0;
        this.techCores = 0;
        this.currentChamberIndex = 0;
        this.enemiesPerChamber = 10;

        this.initScreenEvents();
        this.initMetaStoreEvents(); 
        this.initAchievementGalleryEvents(); 

        // Intro lines
        this.introLines = [
            "ESTABLISHING ENCRYPTED LINK...",
            "TARGET: MERIDIAN NETWORK INFRASTRUCTURE.",
            "YOUR MISSION: INFILTRATE AND BREACH THE CORE CHAMBERS.",
            "DATA RECOVERY IS PARAMOUNT. HOSTILES ARE AUTHORIZED FOR LETHAL FORCE.",
            "YOU ARE A GHOST IN THE MACHINE. MAKE IT COUNT.",
            "INITIALIZING INFILTRATION PROTOCOL..."
        ];
        this.currentIntroLine = 0;
        this.introCharIndex = 0;
        this.introTextElement = null;
        this.introTypeSpeed = 20; // ms per char
        this.introLineDelay = 800; // ms between lines

        // Inventory & Upgrades
        this.isInventoryOpen = false;
        this.isTurretMenuOpen = false;
        this.selectedTurret = null;
        this.selectedModule = null;
        this.activeDrone = null; // Drone currently being upgraded

        // Input
        this.mouseDelta = { x: 0, y: 0 };
        this.mouseIsDown = false;
        
        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.renderer.domElement) {
                this.mouseDelta.x = e.movementX;
                this.mouseDelta.y = e.movementY;
            }
        });

        window.addEventListener('mousedown', (e) => {
            if (this.gameState !== 'PLAYING') return;
            if (document.pointerLockElement === this.renderer.domElement) {
                this.mouseIsDown = true;
                if (e.button === 0) { // Left click
                    this.player.shoot(this.raycastTargets, (pos, dir, type) => {
                        const t = new Turret(this.scene, pos, dir, this.particleSystem, type);
                        this.turrets.push(t);
                    });
                } else if (e.button === 2) { // Right click
                    this.player.isAiming = true;
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            this.mouseIsDown = false;
            if (e.button === 2) { // Right click release
                this.player.isAiming = false;
            }
        });

        // Prevent context menu on right click
        window.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('keydown', (e) => {
            if (this.gameState === 'INTRO') {
                if (e.code === 'Space') {
                    this.endIntro();
                    e.preventDefault();
                }
                return;
            }
            if (this.gameState !== 'PLAYING') return;
            if (e.code === 'KeyR') {
                if (this.player.currentWeaponKey === 'SNIPER' && this.player.isAiming) {
                    this.player.secondaryShoot(this.raycastTargets);
                } else {
                    this.player.reload();
                }
            }
            if (e.code === 'Digit1') {
                this.player.switchWeapon('RIFLE');
            }
            if (e.code === 'Digit2') {
                this.player.switchWeapon('SNIPER');
            }
            if (e.code === 'Digit3') {
                this.player.switchWeapon('EXTINGUISHER');
            }
            if (e.code === 'Digit4') {
                this.player.switchWeapon('TURRET');
            }
            if (e.code === 'KeyQ') {
                this.player.swapWeapon();
            }
            if (e.code === 'KeyV') {
                this.player.melee(this.enemies);
            }
            if (e.code === 'KeyX') {
                this.toggleCommandMenu(true);
            }
            if (e.code === 'KeyE') {
                this.tryInteract();
            }
            if (e.code === 'Space') {
                if (this.isHacking) {
                    this.checkHackingHit();
                    e.preventDefault();
                }
                if (this.isNeuralSyncing) {
                    this.checkNeuralSyncHit();
                    e.preventDefault();
                }
            }
            if (e.code === 'KeyG') {
                this.player.isAimingGrenade = true;
            }
            if (e.code === 'KeyF') {
                this.player.isAimingEMP = true;
            }
            if (e.code === 'KeyT') {
                this.player.toggleThermal();
            }
            if (e.code === 'KeyL') {
                this.player.toggleFlashlight();
            }
            if (e.code === 'Escape') {
                if (this.isInventoryOpen) {
                    this.toggleInventory(false);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyX') {
                this.toggleCommandMenu(false);
            }
            if (e.code === 'KeyG') {
                if (this.player.isAimingGrenade) {
                    this.player.isAimingGrenade = false;
                    this.player.throwGrenade((pos, vel) => {
                        const grenade = this.grenadePool.find(g => g.isExploded);
                        if (grenade) {
                            grenade.spawn(pos, vel, (explodePos) => {
                                this.handleExplosion(explodePos);
                            });
                            this.activeGrenades.push(grenade);
                        }
                    });
                }
            }
            if (e.code === 'KeyF') {
                if (this.player.isAimingEMP) {
                    this.player.isAimingEMP = false;
                    this.player.throwEMP((pos, vel) => {
                        const emp = this.empGrenadePool.find(g => g.isExploded);
                        if (emp) {
                            emp.spawn(pos, vel, (explodePos) => {
                                this.handleEMPExplosion(explodePos);
                            });
                            this.activeGrenades.push(emp);
                        }
                    });
                }
            }
        });

        window.addEventListener('wheel', (e) => {
            if (this.player.isAiming && this.player.currentWeaponKey === 'SNIPER') {
                this.player.cycleSniperZoom();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            const instructions = document.getElementById('instructions');
            if (document.pointerLockElement === this.renderer.domElement) {
                if (instructions) instructions.style.display = 'none';
            } else {
                if (this.gameState === 'PLAYING') {
                    if (instructions) instructions.style.display = 'block';
                }
            }
        });

        window.addEventListener('resize', () => this.onWindowResize());

        this.initRadialMenuEvents();
        this.clock = new THREE.Clock();
        this.frameCounter = 0; // Added for throttling
        this.animate();
    }

    initScreenEvents() {
        const startBtn = document.getElementById('start-btn');
        const skipAllBtn = document.getElementById('skip-all-btn');
        const deployBtn = document.getElementById('deploy-btn');
        const startScreen = document.getElementById('start-screen');
        const introScreen = document.getElementById('intro-screen');
        const skipIntroBtn = document.getElementById('skip-intro-btn');
        const facilityScreen = document.getElementById('facility-screen');
        const briefingScreen = document.getElementById('briefing-screen');
        const loadoutScreen = document.getElementById('loadout-screen');
        const facilityGrid = document.getElementById('facility-grid');
        const facilityBackBtn = document.getElementById('facility-back-btn');
        const briefBackBtn = document.getElementById('brief-back-btn');
        const briefProceedBtn = document.getElementById('brief-proceed-btn');
        const extractReturnBtn = document.getElementById('extract-return-btn');
        const deathRestartBtn = document.getElementById('death-restart-btn');
        const ui = document.getElementById('ui');

        extractReturnBtn.addEventListener('click', () => {
            location.reload(); // Simplest way to reset game state for now
        });

        deathRestartBtn.addEventListener('click', () => {
            this.resetMission();
        });

        startBtn.addEventListener('click', async () => {
            try {
                // Dynamic import to avoid top-level AudioContext creation
                const Tone = await import('tone');
                await Tone.start();
                this.setupAudio(Tone); 
                console.log('Audio Context Resumed and Synths Initialized');
            } catch (err) {
                console.warn('Audio Context failed to start:', err);
            }
            startScreen.style.display = 'none';
            this.startIntro();
        });

        skipAllBtn.addEventListener('click', async () => {
            try {
                const Tone = await import('tone');
                await Tone.start();
                this.setupAudio(Tone);
            } catch (err) {}
            startScreen.style.display = 'none';
            this.gameState = 'INTRO'; 
            this.endIntro();
        });

        skipIntroBtn.addEventListener('click', () => {
            this.endIntro();
        });

        facilityBackBtn.addEventListener('click', () => {
            facilityScreen.style.display = 'none';
            startScreen.style.display = 'flex';
            this.gameState = 'START_SCREEN';
        });

        briefBackBtn.addEventListener('click', () => {
            briefingScreen.style.display = 'none';
            facilityScreen.style.display = 'flex';
            this.gameState = 'FACILITY_SCREEN';
        });

        briefProceedBtn.addEventListener('click', () => {
            briefingScreen.style.display = 'none';
            loadoutScreen.style.display = 'flex';
            this.gameState = 'LOADOUT_SCREEN';
            this.updateArmoryUI();
            this.successSynth?.triggerAttackRelease("G4", "8n");
        });

        // Deployment Logic
        deployBtn.addEventListener('click', () => {
            // First: Request pointer lock immediately on user gesture
            this.renderer.domElement.requestPointerLock();
            
            this.applyMetaUpgrades();
            
            loadoutScreen.style.display = 'none';
            const uiOverlay = document.getElementById('ui');
            if (uiOverlay) uiOverlay.style.opacity = '1';
            this.gameState = 'PLAYING';
            this.deploymentTime = Date.now();
            this.missionStartTime = Date.now();
            this.heatLevel = 1;
            this.resetHeatVisuals();
            
            // Critical: Force capture focus 
            this.renderer.domElement.focus();
            window.focus();
            
        // Reset controller states
        if (this.playerController) {
            this.playerController.velocity.set(0, 0, 0);
            this.playerController.isOnGround = true;
            this.playerController.canJump = true;
            // Removed clearing of keys to prevent initial movement delay when holding keys
        }
            if (this.cameraController) {
                this.cameraController.enable();
                this.cameraController.rotationY = 0;
                this.cameraController.rotationX = 0;
            }

            this.refreshRaycastTargets();
            this.successSynth?.triggerAttackRelease("G4", "8n");
            this.showProgressionMessage(`INFILTRATION COMMENCED - ${this.currentFacility.name}`);
        });

        // Add a general click listener to the canvas to ensure lock recovery
        this.renderer.domElement.addEventListener('mousedown', () => {
            if (this.gameState === 'PLAYING' && document.pointerLockElement !== this.renderer.domElement) {
                this.renderer.domElement.requestPointerLock();
            }
        });

        // Expose for facility selection
        window.game = this; 
    }

    startIntro() {
        this.gameState = 'INTRO';
        const introScreen = document.getElementById('intro-screen');
        introScreen.style.display = 'flex';
        this.introTextElement = document.getElementById('intro-text');
        this.introTextElement.innerHTML = '';
        this.currentIntroLine = 0;
        this.introCharIndex = 0;
        this.showNextIntroLine();
    }

    showNextIntroLine() {
        if (this.gameState !== 'INTRO') return;

        if (this.currentIntroLine >= this.introLines.length) {
            setTimeout(() => this.endIntro(), this.introLineDelay);
            return;
        }

        const line = this.introLines[this.currentIntroLine];
        const lineElement = document.createElement('div');
        lineElement.style.marginBottom = '10px';
        this.introTextElement.appendChild(lineElement);

        let charIdx = 0;
        const typeChar = () => {
            if (this.gameState !== 'INTRO') return;
            if (charIdx < line.length) {
                lineElement.innerText += line[charIdx];
                charIdx++;
                // Play subtle typing sound
                if (charIdx % 2 === 0 && this.hackSynth) {
                    this.hackSynth?.triggerAttackRelease("C5", "32n", undefined, 0.1);
                }
                setTimeout(typeChar, this.introTypeSpeed);
            } else {
                this.currentIntroLine++;
                setTimeout(() => this.showNextIntroLine(), this.introLineDelay);
            }
        };
        typeChar();
    }

    endIntro() {
        if (this.gameState !== 'INTRO') return;
        
        const introScreen = document.getElementById('intro-screen');
        const facilityScreen = document.getElementById('facility-screen');
        introScreen.style.display = 'none';
        facilityScreen.style.display = 'flex';
        this.gameState = 'FACILITY_SCREEN';
        this.updateFacilityGrid();
        this.successSynth?.triggerAttackRelease("C4", "8n");
    }

    updateFacilityGrid() {
        const container = document.getElementById('facility-map-container');
        if (!container) return;
        
        // Clear previous nodes/lines
        const items = container.querySelectorAll('.map-node, .map-line');
        items.forEach(n => n.remove());
        
        const facilities = CONFIG.FACILITIES;
        const coords = [
            { x: 25, y: 35 },
            { x: 55, y: 25 },
            { x: 75, y: 55 },
            { x: 45, y: 75 },
            { x: 20, y: 65 }
        ];

        // Draw connections
        facilities.forEach((fac, i) => {
            const start = coords[i];
            const nextIdx = (i + 1) % facilities.length;
            const end = coords[nextIdx];

            const dx = (end.x - start.x) * (container.clientWidth / 100);
            const dy = (end.y - start.y) * (container.clientHeight / 100);
            const dist = Math.sqrt(dx*dx + dy*dy);
            const angle = Math.atan2(dy, dx);

            const line = document.createElement('div');
            line.className = 'map-line';
            line.style.width = `${dist}px`;
            line.style.left = `${start.x}%`;
            line.style.top = `${start.y}%`;
            line.style.transform = `rotate(${angle}rad)`;
            line.style.opacity = '0.1';
            container.appendChild(line);
        });

        // Draw nodes
        facilities.forEach((fac, i) => {
            const node = document.createElement('div');
            node.className = 'map-node';
            node.style.left = `${coords[i].x}%`;
            node.style.top = `${coords[i].y}%`;
            node.style.borderColor = `#${fac.accent.toString(16).padStart(6, '0')}`;
            node.style.width = '20px';
            node.style.height = '20px';
            node.style.backgroundColor = 'rgba(0,0,0,0.8)';
            node.style.zIndex = '10';
            
            const label = document.createElement('div');
            label.className = 'map-node-label';
            label.innerText = fac.name;
            label.style.top = '25px';
            label.style.fontSize = '10px';
            node.appendChild(label);

            node.onmouseenter = () => {
                this.showFacilityDetail(fac, coords[i]);
                this.successSynth?.triggerAttackRelease("C5", "32n", undefined, 0.1);
                node.style.boxShadow = `0 0 20px #${fac.accent.toString(16).padStart(6, '0')}`;
            };
            
            node.onmouseleave = () => {
                node.style.boxShadow = 'none';
            };

            node.onclick = () => {
                this.selectFacility(fac);
            };

            container.appendChild(node);
        });
    }

    showFacilityDetail(facility, coords) {
        const panel = document.getElementById('facility-detail-panel');
        const name = document.getElementById('detail-name');
        const location = document.getElementById('detail-location');
        const desc = document.getElementById('detail-desc');
        const stats = document.getElementById('detail-stats');
        const confirmBtn = document.getElementById('detail-confirm-btn');
        const image = document.getElementById('detail-image');

        const accentHex = `#${facility.accent.toString(16).padStart(6, '0')}`;
        name.innerText = facility.name;
        name.style.color = accentHex;
        name.style.borderColor = accentHex;
        location.innerText = `COORDINATES: X-${coords.x} Y-${coords.y}`;
        desc.innerText = facility.desc;
        
        if (image && facility.image) {
            image.src = facility.image;
            image.style.borderColor = accentHex;
            const glow = panel.querySelector('div > div:nth-child(3)');
            if (glow) glow.style.background = accentHex;
        }
        
        const riskLevel = facility.bossInterval <= 5 ? 'HIGH' : 'EXTREME';
        const securityClass = facility.rooms >= 50 ? 'TITAN-IV' : 'GUARDIAN-II';
        
        stats.innerHTML = `
            SECURITY CLASS: ${securityClass}<br>
            ROOM COUNT: ${facility.rooms}<br>
            RISK LEVEL: ${riskLevel}<br>
            SIGNAL: ENCRYPTED-L3
        `;

        confirmBtn.onclick = () => {
            this.selectFacility(facility);
        };

        panel.style.transform = 'translateX(0)';
    }

    hideFacilityDetail() {
        const panel = document.getElementById('facility-detail-panel');
        panel.style.transform = 'translateX(100%)';
    }

    selectFacility(facility) {
        this.currentFacility = facility;
        this.hideFacilityDetail();
        document.getElementById('facility-screen').style.display = 'none';
        this.startBreachLoading(facility);
    }

    startBreachLoading(facility) {
        this.gameState = 'BREACH_LOADING';
        const screen = document.getElementById('breach-loading-screen');
        const logContainer = document.getElementById('terminal-logs');
        const progressBar = document.getElementById('breach-loading-bar');
        const percentText = document.getElementById('breach-percent');
        
        screen.style.display = 'flex';
        logContainer.innerHTML = '';
        
        let progress = 0;
        const duration = 4000; // 4 seconds
        const startTime = Date.now();
        
        const logs = [
            { text: "> INITIATING HANDSHAKE PROTOCOL...", type: 'info' },
            { text: `> TARGET NODE: ${facility.name.toUpperCase()}`, type: 'info' },
            { text: "> BYPASSING ENCRYPTION LAYER 1...", type: 'info' },
            { text: "> LAYER 1 CLEAR. INJECTING PACKET SNIFFER...", type: 'success' },
            { text: "> WARNING: HEURISTIC DETECTION ACTIVE", type: 'warning' },
            { text: "> REROUTING VIA PROXY MESH...", type: 'info' },
            { text: "> BYPASSING ENCRYPTION LAYER 2...", type: 'info' },
            { text: "> DATA STREAM ESTABLISHED", type: 'success' },
            { text: "> DECRYPTING FACILITY SCHEMATICS...", type: 'info' },
            { text: "> WARNING: LATENCY SPIKE DETECTED", type: 'warning' },
            { text: "> STABILIZING CONNECTION...", type: 'info' },
            { text: "> DOWNLOADING TACTICAL OVERLAY...", type: 'info' },
            { text: "> INFILTRATION POINT SECURED", type: 'success' },
            { text: "> UPLOADING MISSION PARAMETERS...", type: 'info' },
            { text: "> NEURAL LINK SYNCHRONIZED", type: 'success' }
        ];

        let logIdx = 0;
        const addLog = () => {
            if (this.gameState !== 'BREACH_LOADING' || logIdx >= logs.length) return;
            
            const log = logs[logIdx];
            const entry = document.createElement('div');
            entry.className = `terminal-log-entry ${log.type}`;
            entry.innerText = log.text;
            logContainer.appendChild(entry);
            logContainer.scrollTop = logContainer.scrollHeight;
            
            this.successSynth?.triggerAttackRelease("C6", "64n", undefined, 0.05);
            
            logIdx++;
            setTimeout(addLog, Math.random() * 300 + 100);
        };

        addLog();

        const updateLoading = () => {
            if (this.gameState !== 'BREACH_LOADING') return;
            
            const elapsed = Date.now() - startTime;
            progress = Math.min(1, elapsed / duration);
            
            progressBar.style.width = `${progress * 100}%`;
            percentText.innerText = `${Math.floor(progress * 100)}%`;
            
            if (progress < 1) {
                requestAnimationFrame(updateLoading);
            } else {
                setTimeout(() => this.finishBreachLoading(facility), 500);
            }
        };

        updateLoading();
    }

    finishBreachLoading(facility) {
        document.getElementById('breach-loading-screen').style.display = 'none';
        document.getElementById('briefing-screen').style.display = 'flex';
        this.gameState = 'BRIEFING_SCREEN';
        
        // Populate Briefing
        this.updateBriefingMap(facility);
        
        const nameEl = document.getElementById('brief-facility-name');
        const descEl = document.getElementById('brief-desc');
        const statsEl = document.getElementById('brief-stats');
        const objectiveEl = document.getElementById('brief-objective');
        const imageEl = document.getElementById('brief-image');
        
        const accentHex = `#${facility.accent.toString(16).padStart(6, '0')}`;
        nameEl.innerText = facility.name;
        nameEl.style.color = accentHex;
        nameEl.style.borderColor = accentHex;
        descEl.innerText = facility.desc;
        
        if (imageEl && facility.image) {
            imageEl.src = facility.image;
            imageEl.style.borderColor = accentHex;
            const bar = imageEl.nextElementSibling;
            if (bar) bar.style.background = accentHex;
        }
        
        const riskLevel = facility.bossInterval <= 5 ? 'HIGH' : 'EXTREME';
        const securityClass = facility.rooms >= 50 ? 'TITAN-IV' : 'GUARDIAN-II';
        const specialUnit = facility.id === 'neon' ? 'CLOAKED STALKER' : (facility.id === 'obsidian' ? 'HEAVY TANK' : 'SENTRY SWARM');

        statsEl.innerHTML = `
            SECURITY CLASS: ${securityClass}<br>
            ROOM COUNT: ${facility.rooms}<br>
            RISK LEVEL: ${riskLevel}<br>
            SIGNAL PROFILE: ENCRYPTED-L3<br>
            SPECIALIZED UNIT: ${specialUnit}
        `;

        const objectives = [
            "NEUTRALIZE CORE SYSTEMS",
            "RECOVER DATA SPINE",
            "BREACH SECURITY HUB",
            "OVERRIDE MAINFIREWALL"
        ];
        objectiveEl.innerText = objectives[Math.floor(Math.random() * objectives.length)];

        // Update MAP configs based on facility
        CONFIG.MAP.NUM_ROOMS = facility.rooms;
        CONFIG.MAP.BOSS_INTERVAL = facility.bossInterval;
        this.enemiesPerChamber = facility.enemies;

        // Re-init map with new settings
        this.reinitMap(facility);
        
        this.successSynth?.triggerAttackRelease("E4", "8n");
    }

    updateBriefingMap(currentFacility) {
        const container = document.getElementById('brief-map-container');
        if (!container) return;

        // Clear previous nodes/lines
        const nodes = container.querySelectorAll('.map-node, .map-line');
        nodes.forEach(n => n.remove());

        const facilities = CONFIG.FACILITIES;
        const coords = [
            { x: 30, y: 30 },
            { x: 70, y: 50 },
            { x: 40, y: 80 },
            { x: 20, y: 60 },
            { x: 80, y: 20 }
        ];

        // Draw connections first
        facilities.forEach((fac, i) => {
            const start = coords[i];
            // Connect to next in list for a "network" look
            const nextIdx = (i + 1) % facilities.length;
            const end = coords[nextIdx];

            const dx = (end.x - start.x) * (container.clientWidth / 100);
            const dy = (end.y - start.y) * (container.clientHeight / 100);
            const dist = Math.sqrt(dx*dx + dy*dy);
            const angle = Math.atan2(dy, dx);

            const line = document.createElement('div');
            line.className = 'map-line';
            line.style.width = `${dist}px`;
            line.style.left = `${start.x}%`;
            line.style.top = `${start.y}%`;
            line.style.transform = `rotate(${angle}rad)`;
            container.appendChild(line);
        });

        // Draw nodes
        facilities.forEach((fac, i) => {
            const node = document.createElement('div');
            node.className = `map-node ${fac.id === currentFacility.id ? 'active' : ''}`;
            node.style.left = `${coords[i].x}%`;
            node.style.top = `${coords[i].y}%`;
            node.style.borderColor = `#${fac.accent.toString(16).padStart(6, '0')}`;
            
            const label = document.createElement('div');
            label.className = 'map-node-label';
            label.innerText = fac.name.split(' ')[1] || fac.name; // Get shorter name
            node.appendChild(label);

            node.onclick = () => {
                this.successSynth?.triggerAttackRelease("G4", "16n");
                this.selectFacility(fac);
            };

            container.appendChild(node);
        });
    }

    refreshRaycastTargets() {
        if (!this.map || (this.lastRaycastUpdate && Date.now() - this.lastRaycastUpdate < 100)) return;
        
        // Rebuild the target list: Walls + Enemies
        const targets = [];
        
        // Only include walls in the player's current and adjacent chambers to massively reduce raycast overhead
        const currentChamber = this.currentChamberIndex;
        if (this.map.walls) {
            for (let i = 0; i < this.map.walls.length; i++) {
                const wall = this.map.walls[i];
                if (currentChamber !== null) {
                    const wallChamber = wall.userData.chamberIndex;
                    if (wallChamber !== undefined && Math.abs(wallChamber - currentChamber) > 1) continue;
                }
                targets.push(wall);
            }
        }
        
        // Enemy Hitboxes
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (!e.isDead && e.mesh) {
                const hitbox = e.mesh.getObjectByName('hitbox');
                if (hitbox) targets.push(hitbox);
            }
        }
        
        // Door panels in current vicinity
        if (this.map.doors) {
            this.map.doors.forEach(d => {
                if (!d.isOpen) {
                    if (currentChamber === null || Math.abs(d.chamberIndex - currentChamber) <= 1) {
                        targets.push(d.pL, d.pR);
                    }
                }
            });
        }

        // Props (Barrels, Pipes, etc.) in current vicinity
        if (this.map.props) {
            this.map.props.forEach(p => {
                if (p.mesh) {
                    if (currentChamber === null || Math.abs(p.userData.chamberIndex - currentChamber) <= 1) {
                        targets.push(p.mesh);
                    }
                }
            });
        }

        this.raycastTargets = targets.filter(Boolean);
        this.lastRaycastUpdate = Date.now();
    }

    reinitMap(facility) {
        // Clear all map geometry and entities
        if (this.map) this.map.cleanup();
        
        // Clear mission-specific lights
        this.missionLights.forEach(l => this.scene.remove(l));
        this.missionLights = [];

        // Clear mission-specific particles
        this.missionParticles.forEach(p => {
            if (p.parent) p.parent.remove(p);
            if (p.geometry) p.geometry.dispose();
            if (p.material) p.material.dispose();
        });
        this.missionParticles = [];
        
        // Clear GameScene's dynamic entity arrays
        this.enemies.forEach(e => {
            if (e.mesh) this.scene.remove(e.mesh);
            if (e.hpBar) this.scene.remove(e.hpBar);
        });
        this.enemies = [];
        
        this.turrets.forEach(t => this.scene.remove(t.mesh));
        this.turrets = [];
        
        this.pickups.forEach(p => this.scene.remove(p.mesh));
        this.pickups = [];
        
        this.activeGrenades.forEach(g => { if(g.mesh) this.scene.remove(g.mesh) });
        this.activeGrenades = [];
        
        this.activeFireFields.forEach(f => f.destroy());
        this.activeFireFields = [];
        
        this.activeGasLeaks.forEach(g => g.destroy());
        this.activeGasLeaks = [];

        // Create new map
        this.map = new GameMap(this.scene, facility);
        this.navigation = new Navigation(this.map);
        
        // Reset player position and health for new map
        this.player.mesh.position.set(0, 1, 0);
        this.player.health = this.player.maxHealth;
        this.player.isDead = false;
        this.player.updateUI();
        
        this.currentChamberIndex = 0;
        this.chamberClearingStatus = 'ACTIVE';
        this.lastEnemySpawn = Date.now() + 5000; // 5 second grace period on each new floor

        // Add new atmospheric room lights and particles for this mission
        this.map.chambers.forEach((chamber, i) => {
            const isBossRoom = (i + 1) % facility.bossInterval === 0;
            const color = isBossRoom ? 0xff3300 : facility.accent;
            const pLight = new THREE.PointLight(color, isBossRoom ? 60 : 40, 30);
            pLight.position.set(chamber.x, 4, chamber.z); 
            this.scene.add(pLight);
            this.missionLights.push(pLight);
            
            const dust = this.particleSystem.createAtmosphericParticles(chamber, isBossRoom ? 15 : 8);
            if (dust) this.missionParticles.push(dust);
        });

        this.refreshRaycastTargets();
    }

    armoryUpgrade(weaponKey, modType) {
        if (this.gameState !== 'LOADOUT_SCREEN') return;

        const costs = {
            'RIFLE': { 'damage': 150, 'fireRate': 100, 'magazine': 100, 'reload': 100 },
            'SNIPER': { 'damage': 200, 'fireRate': 150, 'magazine': 150, 'reload': 150 }
        };

        const cost = costs[weaponKey][modType];
        if (this.missionCredits >= cost) {
            const success = this.player.upgradeWeapon(weaponKey, modType);
            if (success) {
                this.missionCredits -= cost;
                this.updateArmoryUI();
                this.successSynth?.triggerAttackRelease("E5", "16n");
            } else {
                alert("MODULE AT MAXIMUM CAPACITY");
            }
        } else {
            alert("INSUFFICIENT MISSION CREDITS");
        }
    }

    updateArmoryUI() {
        const creditEl = document.getElementById('mission-credits');
        if (creditEl) creditEl.innerText = `CREDITS: ${this.missionCredits}`;

        const rifleStats = document.getElementById('rifle-stats-armory');
        const rifle = this.player.weapons.RIFLE;
        if (rifleStats) {
            rifleStats.innerHTML = `
                DAMAGE: ${rifle.DAMAGE}<br>
                FIRE RATE: ${Math.round(rifle.COOLDOWN)}ms<br>
                MAG SIZE: ${rifle.MAGAZINE_SIZE}<br>
                MODS: ${(rifle.mods.damage || 0) + (rifle.mods.fireRate || 0) + (rifle.mods.magazine || 0) + (rifle.mods.reload || 0)} / 20
            `;
        }

        const sniperStats = document.getElementById('sniper-stats-armory');
        const sniper = this.player.weapons.SNIPER;
        if (sniperStats) {
            sniperStats.innerHTML = `
                DAMAGE: ${sniper.DAMAGE}<br>
                FIRE RATE: ${Math.round(sniper.COOLDOWN)}ms<br>
                MAG SIZE: ${sniper.MAGAZINE_SIZE}<br>
                MODS: ${(sniper.mods.damage || 0) + (sniper.mods.fireRate || 0) + (sniper.mods.magazine || 0) + (sniper.mods.reload || 0)} / 20
            `;
        }
    }

    initRadialMenuEvents() {
        const options = [
            { id: 'radial-opt-follow', cmd: 'FOLLOW' },
            { id: 'radial-opt-strike', cmd: 'STRIKE' },
            { id: 'radial-opt-defend', cmd: 'DEFEND' },
            { id: 'radial-opt-inventory', cmd: 'TECH_INVENTORY' },
            { id: 'radial-opt-aggressive', cmd: 'STANCE_AGGRESSIVE' },
            { id: 'radial-opt-defensive', cmd: 'STANCE_DEFENSIVE' }
        ];

        options.forEach(opt => {
            const el = document.getElementById(opt.id);
            if (el) {
                el.addEventListener('mouseenter', () => {
                    if (this.isMenuOpen) {
                        el.classList.add('hover');
                        this.selectedCommand = opt.cmd;
                    }
                });
                el.addEventListener('mouseleave', () => {
                    el.classList.remove('hover');
                    if (this.selectedCommand === opt.cmd) this.selectedCommand = null;
                });
            }
        });

        this.initInventoryEvents();
    }

    initInventoryEvents() {
        const moduleItems = document.querySelectorAll('.module-item');
        moduleItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation(); // Don't close when clicking item
                if (item.classList.contains('owned')) return;
                
                moduleItems.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                this.selectedModule = item.dataset.type;
                
                document.getElementById('apply-upgrade-btn').style.display = 'block';
            });
        });

        document.getElementById('inventory-ui').addEventListener('click', () => {
            this.toggleInventory(false);
        });

        document.getElementById('apply-upgrade-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.applyUpgrade();
        });

        this.initTurretMenuEvents();
    }

    initTurretMenuEvents() {
        document.getElementById('turret-repair-btn').addEventListener('click', () => this.interactTurret('repair'));
        document.getElementById('turret-dmg-btn').addEventListener('click', () => this.interactTurret('damage'));
        document.getElementById('turret-fire-btn').addEventListener('click', () => this.interactTurret('fireRate'));
        document.getElementById('turret-hp-btn').addEventListener('click', () => this.interactTurret('health'));
        
        document.getElementById('turret-menu-ui').addEventListener('click', () => this.toggleTurretMenu(false));
        document.querySelector('.turret-menu-content').addEventListener('click', (e) => e.stopPropagation());

        this.initTerminalMenuEvents();
    }

    initTerminalMenuEvents() {
        document.getElementById('term-hack-btn').addEventListener('click', () => {
            this.toggleTerminalMenu(false);
            if (this.currentTerminal) this.startNeuralSync(this.currentTerminal);
        });

        document.getElementById('term-shop-btn').addEventListener('click', () => {
            this.toggleTerminalMenu(false);
            this.toggleShopMenu(true);
        });

        document.getElementById('term-close-btn').addEventListener('click', () => {
            this.toggleTerminalMenu(false);
        });

        document.getElementById('shop-back-btn').addEventListener('click', () => {
            this.toggleShopMenu(false);
            this.toggleTerminalMenu(true);
        });

        document.getElementById('terminal-menu-ui').addEventListener('click', () => this.toggleTerminalMenu(false));
        document.getElementById('terminal-shop-ui').addEventListener('click', () => this.toggleShopMenu(false));
        
        // Prevent clicking inside from closing
        document.querySelector('#terminal-menu-ui > div').addEventListener('click', (e) => e.stopPropagation());
        document.querySelector('#terminal-shop-ui > div').addEventListener('click', (e) => e.stopPropagation());
    }

    toggleTerminalMenu(open, terminal = null) {
        this.isTerminalMenuOpen = open;
        if (terminal) this.currentTerminal = terminal;
        const ui = document.getElementById('terminal-menu-ui');
        if (ui) ui.style.display = open ? 'block' : 'none';

        if (open) {
            document.exitPointerLock();
        } else if (!this.isShopOpen && !this.isInventoryOpen && !this.isTurretMenuOpen) {
            this.renderer.domElement.requestPointerLock();
        }
    }

    toggleShopMenu(open) {
        this.isShopOpen = open;
        const ui = document.getElementById('terminal-shop-ui');
        if (ui) ui.style.display = open ? 'block' : 'none';

        if (open) {
            document.exitPointerLock();
            this.updateShopUI();
        } else if (!this.isTerminalMenuOpen && !this.isInventoryOpen && !this.isTurretMenuOpen) {
            this.renderer.domElement.requestPointerLock();
        }
    }

    updateShopUI() {
        const grid = document.getElementById('shop-items-grid');
        grid.innerHTML = '';
        
        document.getElementById('shop-scrap-val').innerText = `SCRAP: ${this.scrap}`;
        document.getElementById('shop-cores-val').innerText = `CORES: ${this.techCores}`;

        this.shopItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-item-card';
            const priceText = item.currency === 'scrap' ? `${item.price} SCRAP` : `${item.price} CORES`;
            
            card.innerHTML = `
                <div class="name">${item.name}</div>
                <div class="desc">${item.desc}</div>
                <div class="price">${priceText}</div>
            `;
            
            card.onclick = () => this.buyShopItem(item);
            grid.appendChild(card);
        });
    }

    buyShopItem(item) {
        const hasCurrency = item.currency === 'scrap' ? this.scrap >= item.price : this.techCores >= item.price;
        
        if (!hasCurrency) {
            alert('INSUFFICIENT FUNDS');
            return;
        }

        // Apply effect
        let success = true;
        switch(item.id) {
            case 'medkit':
                if (this.player.health >= this.player.maxHealth) {
                    alert('HEALTH ALREADY AT MAXIMUM');
                    success = false;
                } else {
                    this.player.heal(50);
                }
                break;
            case 'ammo_rifle':
                this.player.replenishAmmo('RIFLE');
                break;
            case 'ammo_sniper':
                this.player.replenishAmmo('SNIPER');
                break;
            case 'grenade':
                this.player.replenishGrenades(1);
                break;
            case 'emp':
                this.player.empCount++;
                this.player.updateUI();
                break;
            case 'tech_core':
                this.techCores++;
                break;
            case 'armor':
                this.player.maxHealth += 25;
                this.player.heal(25);
                break;
            case 'mod_rifle_rof':
                success = this.player.upgradeWeapon('RIFLE', 'fireRate');
                if (!success) alert('MOD AT MAXIMUM LEVEL');
                break;
            case 'mod_rifle_dmg':
                success = this.player.upgradeWeapon('RIFLE', 'damage');
                if (!success) alert('MOD AT MAXIMUM LEVEL');
                break;
            case 'mod_rifle_reload':
                success = this.player.upgradeWeapon('RIFLE', 'reload');
                if (!success) alert('MOD AT MAXIMUM LEVEL');
                break;
            case 'mod_sniper_rof':
                success = this.player.upgradeWeapon('SNIPER', 'fireRate');
                if (!success) alert('MOD AT MAXIMUM LEVEL');
                break;
            case 'mod_sniper_dmg':
                success = this.player.upgradeWeapon('SNIPER', 'damage');
                if (!success) alert('MOD AT MAXIMUM LEVEL');
                break;
            case 'mod_sniper_reload':
                success = this.player.upgradeWeapon('SNIPER', 'reload');
                if (!success) alert('MOD AT MAXIMUM LEVEL');
                break;
            case 'ammo_incendiary':
                this.player.currentWeapon.elementalAmmo = { type: 'INCENDIARY', count: 30 };
                break;
            case 'ammo_shock':
                this.player.currentWeapon.elementalAmmo = { type: 'SHOCK', count: 20 };
                break;
        }

        if (success) {
            if (item.currency === 'scrap') this.scrap -= item.price;
            else this.techCores -= item.price;
            
            this.updateShopUI();
            this.player.updateUI();
            this.successSynth?.triggerAttackRelease("C5", "16n");
        }
    }

    toggleTurretMenu(open, turret = null) {
        this.isTurretMenuOpen = open;
        this.selectedTurret = turret;
        const ui = document.getElementById('turret-menu-ui');
        if (ui) ui.style.display = open ? 'block' : 'none';

        if (open) {
            document.exitPointerLock();
            this.updateTurretMenuUI();
        } else {
            this.renderer.domElement.requestPointerLock();
        }
    }

    updateTurretMenuUI() {
        if (!this.selectedTurret) return;
        
        const scrapEl = document.getElementById('turret-scrap-val');
        const hpEl = document.getElementById('turret-info-hp');
        const dmgEl = document.getElementById('turret-info-dmg');
        const fireEl = document.getElementById('turret-info-fire');
        
        scrapEl.innerText = `SCRAP: ${this.scrap}`;
        hpEl.innerText = `HEALTH: ${Math.floor(this.selectedTurret.health)} / ${this.selectedTurret.maxHealth} (LVL ${this.selectedTurret.levels.health})`;
        dmgEl.innerText = `DAMAGE: ${this.selectedTurret.damage} (LVL ${this.selectedTurret.levels.damage})`;
        fireEl.innerText = `FIRE RATE: ${this.selectedTurret.fireRate}ms (LVL ${this.selectedTurret.levels.fireRate})`;
    }

    interactTurret(action) {
        if (!this.selectedTurret) return;

        const costs = {
            repair: 10,
            damage: 25,
            fireRate: 30,
            health: 40
        };

        const cost = costs[action];
        if (this.scrap >= cost) {
            if (action === 'repair') {
                if (this.selectedTurret.health >= this.selectedTurret.maxHealth) {
                    alert('TURRET AT FULL HEALTH');
                    return;
                }
                this.selectedTurret.repair(50);
            } else {
                this.selectedTurret.upgrade(action);
            }
            
            this.scrap -= cost;
            this.updateTurretMenuUI();
            this.player.updateUI();
            this.particleSystem.createExplosion(this.selectedTurret.mesh.position, 0x00ffaa, 10, 1);
            this.successSynth?.triggerAttackRelease("G5", "16n");
        } else {
            alert('NOT ENOUGH SCRAP');
        }
    }

    toggleInventory(open) {
        this.isInventoryOpen = open;
        const ui = document.getElementById('inventory-ui');
        if (ui) ui.style.display = open ? 'block' : 'none';

        if (open) {
            document.exitPointerLock();
            this.updateInventoryUI();
        } else {
            this.renderer.domElement.requestPointerLock();
        }
    }

    updateInventoryUI() {
        // Find nearest ally drone to upgrade
        let nearestAlly = null;
        let minDist = 10;
        this.enemies.forEach(e => {
            if (e.isAlly && !e.isDead) {
                const d = e.mesh.position.distanceTo(this.player.mesh.position);
                if (d < minDist) {
                    minDist = d;
                    nearestAlly = e;
                }
            }
        });

        this.activeDrone = nearestAlly;
        const nameEl = document.getElementById('drone-status-name');
        const modsEl = document.getElementById('drone-status-mods');
        const coreEl = document.getElementById('tech-cores-val');
        const applyBtn = document.getElementById('apply-upgrade-btn');
        
        coreEl.innerText = `CORES: ${this.techCores}`;

        if (this.activeDrone) {
            nameEl.innerText = `DRONE STATUS: ACTIVE`;
            modsEl.innerText = this.activeDrone.modules.length > 0 
                ? `INSTALLED: ${this.activeDrone.modules.join(', ')}` 
                : 'NO MODULES INSTALLED';
            
            // Highlight owned modules for this drone
            document.querySelectorAll('.module-item').forEach(item => {
                if (this.activeDrone.modules.includes(item.dataset.type)) {
                    item.classList.add('owned');
                } else {
                    item.classList.remove('owned');
                }
            });
        } else {
            nameEl.innerText = `NO ACTIVE DRONE NEARBY`;
            modsEl.innerText = `MOVE CLOSER TO A HACKED DRONE`;
            applyBtn.style.display = 'none';
        }
    }

    applyUpgrade() {
        if (!this.activeDrone || !this.selectedModule) return;

        const costs = {
            'SHIELD': 1,
            'RAPID_FIRE': 2,
            'HEAVY_LASER': 2,
            'REPAIR': 3,
            'CLOAK': 4,
            'EMP_BURST': 3,
            'SELF_DESTRUCT': 2,
            'CHAIN_LIGHTNING': 3,
            'SWARM': 5,
            'REPAIR_FIELD': 4,
            'OVERCLOCK': 4,
            'GRAVITY_SINGULARITY': 5,
            'VOLATILE_DETONATION': 3,
            'KINETIC_CHAIN': 4,
            'MAGNETIC_SIPHON': 3,
            'SINGULARITY_ECHO': 4,
            'GRAVITY_WELL': 3,
            'CRUSHING_PRESSURE': 4,
            'SINGULARITY_COLLAPSE': 3,
            'NEUTRON_FLUX': 5,
            'CHRONO_DILATION': 4,
            'GAMMA_BURST': 4
        };

        const cost = costs[this.selectedModule];
        if (this.techCores >= cost) {
            this.techCores -= cost;
            this.activeDrone.applyModule(this.selectedModule);
            this.updateInventoryUI();
            
            // Visual effect
            this.particleSystem.createExplosion(this.activeDrone.mesh.position, 0x00ffff, 15, 3);
        } else {
            alert('NOT ENOUGH TECH CORES');
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    setupAudio(Tone) {
        this.Tone = Tone;
        // Hacking synth
        this.hackSynth = new Tone.PolySynth(Tone.Synth).toDestination();
        this.hackSynth.set({
            oscillator: { type: "square8" },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.1 }
        });
        this.hackSynth.volume.value = -15;

        // Success sound
        this.successSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.8 }
        }).toDestination();
        this.successSynth.volume.value = -10;

        // Weapon Fire (Noise-based for impact/crunch)
        this.shootSynth = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
        }).toDestination();
        this.shootSynth.volume.value = -12;

        // Impact Synths (Low-end punch) - Using PolySynth to allow overlapping sounds
        this.impactSynth = new Tone.PolySynth(Tone.MembraneSynth, {
            pitchDecay: 0.05,
            octaves: 4,
            oscillator: { type: 'sine' }
        }).toDestination();
        this.impactSynth.volume.value = -15;

        this.fireImpactSynth = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 4,
            oscillator: { type: 'sine' }
        }).toDestination();
        this.fireImpactSynth.volume.value = -15;

        // Ambient Atmosphere (Deep Facility Drone)
        this.ambientHum = new Tone.Oscillator(45, "triangle").toDestination();
        this.ambientHum.volume.value = -45; 
        
        // Low-pass filter to keep it deep and non-intrusive
        const ambientFilter = new Tone.Filter(120, "lowpass").toDestination();
        this.ambientHum.connect(ambientFilter);
        this.ambientHum.start();

        // Secondary texture layer (Very subtle "air")
        this.ambientAir = new Tone.Noise("pink").toDestination();
        this.ambientAir.volume.value = -65;
        const airFilter = new Tone.Filter(200, "lowpass").toDestination();
        this.ambientAir.connect(airFilter);
        this.ambientAir.start();

        // Hazard Warning (Replacing the "fsssss" with a modulated electronic hum)
        this.hazardHiss = new Tone.Oscillator(120, "sawtooth").toDestination();
        this.hazardHiss.volume.value = -100; // Start silent
        
        // Use an AutoFilter to give it a "pulsing/spinning" hazard quality
        this.hazardFilter = new Tone.AutoFilter({
            frequency: "4n",
            baseFrequency: 400,
            octaves: 2,
            type: "sine"
        }).toDestination().start();
        
        this.hazardHiss.connect(this.hazardFilter);
        this.hazardHiss.start();

        // Shield Hum (Drone/Player energy field)
        this.shieldHum = new Tone.Oscillator(60, "sine").toDestination();
        this.shieldHum.volume.value = -100; // Start silent
        this.shieldHum.start();

        // Portal Rumble (Low-frequency extraction portal cue)
        this.portalRumble = new Tone.Oscillator(30, "sine").toDestination();
        this.portalRumble.volume.value = -100;
        this.portalRumble.start();

        // Elite Screech: Modulated FM Synth for "horrific digital" sounds
        this.eliteScreech = new Tone.FMSynth({
            harmonicity: 3.5,
            modulationIndex: 10,
            oscillator: { type: "sine" },
            modulation: { type: "square" },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 }
        }).toDestination();
        this.eliteScreech.volume.value = -15;

        // Tactical Handshake: Clean, authoritative UI feedback
        this.tacticalHandshake = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
        }).toDestination();
        this.tacticalHandshake.volume.value = -10;

        // Pass sounds to player
        if (this.player) {
            this.player.setAudio({
                shoot: () => {
                    const now = this.Tone ? this.Tone.now() : undefined;
                    const type = this.player.currentWeaponKey;
                    if (type === 'SNIPER') {
                        this.shootSynth.triggerAttackRelease("16n", now);
                        this.fireImpactSynth.triggerAttackRelease("G1", "8n", now);
                    } else if (type === 'RIFLE') {
                        this.shootSynth.triggerAttackRelease("32n", now);
                        this.fireImpactSynth.triggerAttackRelease("C2", "16n", now);
                    } else if (type === 'TURRET') {
                        this.successSynth.triggerAttackRelease("G5", "32n", now);
                    }
                },
                hit: (isEnemy) => {
                    // Use a tiny offset to ensure Tone.js doesn't clash with the shot sound
                    const time = this.Tone ? this.Tone.now() + 0.01 : undefined;
                    if (isEnemy) {
                        this.impactSynth.triggerAttackRelease("E1", "32n", time);
                    } else {
                        this.impactSynth.triggerAttackRelease("C1", "64n", time);
                    }
                },
                reload: () => {
                    const now = this.Tone ? this.Tone.now() : undefined;
                    this.hackSynth.triggerAttackRelease(["C3", "E3"], "16n", now);
                }
            });
        }
    }

    tryInteract() {
        if (this.isHackingTerminal || this.isTerminalMenuOpen || this.isShopOpen) return;

        // 1. Try turret interaction
        let nearestTurret = null;
        let minDistT = 3;
        this.turrets.forEach(t => {
            const d = t.mesh.position.distanceTo(this.player.mesh.position);
            if (d < minDistT) {
                minDistT = d;
                nearestTurret = t;
            }
        });

        if (nearestTurret) {
            this.toggleTurretMenu(true, nearestTurret);
            return;
        }

        // 2. Try hacking nearest drone
        this.tryStartHacking();
        if (this.isHacking) return;

        // 3. Try interacting with shop terminal
        for (const shopTerm of this.map.shopTerminals) {
            const dist = this.player.mesh.position.distanceTo(shopTerm.mesh.position);
            if (dist < 3) {
                this.toggleShopMenu(true);
                return;
            }
        }

        // 4. Try interacting with hacking terminal or switches
        const currentChamberIdx = this.currentChamberIndex;
        const terminal = this.map.terminals.find(t => {
            const d = this.player.mesh.position.distanceTo(t.mesh.position);
            return d < 3;
        });

        if (terminal) {
            if (terminal.type === 'HAZARD_SWITCH') {
                if (!terminal.isUsed) {
                    terminal.interact();
                    this.showProgressionMessage("LOCAL HAZARD SYSTEMS OFFLINE");
                    this.successSynth?.triggerAttackRelease("G5", "16n");
                }
                return;
            }

            const chamber = this.map.chambers[terminal.chamberIndex];
            if (chamber && chamber.isCleared && this.chamberClearingStatus === 'CLEARED') {
                if (!terminal.isUsed) {
                    if (terminal.chamberIndex === CONFIG.MAP.NUM_ROOMS - 1 && this.finalBossAlive) {
                        this.showProgressionMessage("CRITICAL ERROR: NEUTRALIZE TERMINAL GUARD FIRST");
                        this.successSynth?.triggerAttackRelease("C3", "8n");
                        return;
                    }
                    this.toggleTerminalMenu(true, terminal);
                }
            }
        }
    }

    startNeuralSync(terminal) {
        this.isNeuralSyncing = true;
        this.currentTerminal = terminal;
        this.syncLevel = 1;
        this.ringRotations = [0, 0, 0];
        this.ringLocked = [false, false, false];
        
        const ui = document.getElementById('neural-sync-ui');
        if (ui) ui.style.display = 'block';
        document.exitPointerLock();
        
        this.updateNeuralSyncUI();
    }

    updateNeuralSync(deltaTime) {
        if (!this.isNeuralSyncing) return;
        
        for (let i = 0; i < 3; i++) {
            if (!this.ringLocked[i]) {
                this.ringRotations[i] += this.ringSpeeds[i] * deltaTime;
                const ringEl = document.getElementById(`sync-ring-${i+1}`);
                if (ringEl) ringEl.style.transform = `rotate(${this.ringRotations[i]}deg)`;
            }
        }
    }

    checkNeuralSyncHit() {
        const ringIdx = this.syncLevel - 1;
        if (ringIdx < 0 || ringIdx >= 3) return;
        
        const rotation = (this.ringRotations[ringIdx] % 360 + 360) % 360;
        
        // Target is at 0 degrees (top)
        const target = 0;
        let diff = Math.abs(rotation - target);
        if (diff > 180) diff = 360 - diff;
        
        const threshold = 15; // Degrees of tolerance
        
        if (diff < threshold) {
            this.ringLocked[ringIdx] = true;
            const ringEl = document.getElementById(`sync-ring-${this.syncLevel}`);
            if (ringEl) ringEl.classList.add('locked');
            
            this.successSynth?.triggerAttackRelease(200 + this.syncLevel * 100, "16n");
            
            this.syncLevel++;
            if (this.syncLevel > 3) {
                setTimeout(() => this.completeNeuralSync(true), 500);
            } else {
                this.updateNeuralSyncUI();
            }
        } else {
            // Shake core on miss
            const core = document.getElementById('sync-core');
            if (core) {
                core.style.background = '#ff0000';
                setTimeout(() => core.style.background = '#00ffaa', 200);
            }
            this.successSynth?.triggerAttackRelease(100, "8n");
            // Reset current level or just allow retry? 
            // Let's allow retry but maybe slow down slightly to penalize?
        }
    }

    updateNeuralSyncUI() {
        const status = document.getElementById('sync-status');
        if (status) status.innerText = `ALIGNMENT: STAGE ${Math.min(3, this.syncLevel)} / 3`;
    }

    completeNeuralSync(success) {
        this.isNeuralSyncing = false;
        const ui = document.getElementById('neural-sync-ui');
        if (ui) ui.style.display = 'none';
        
        // Clean up classes for next time
        for(let i=1; i<=3; i++) {
            const el = document.getElementById(`sync-ring-${i}`);
            if (el) el.classList.remove('locked');
        }

        if (success) {
            this.renderer.domElement.requestPointerLock();
            this.startTerminalHack(this.currentTerminal);
        } else {
            this.renderer.domElement.requestPointerLock();
        }
    }

    async startTerminalHack(terminal) {
        const Tone = await import('tone');
        if (Tone.getContext().state !== 'running') await Tone.start();
        
        this.isHackingTerminal = true;
        this.currentTerminal = terminal;
        this.terminalHackProgress = 0;
        this.hackingWavesTriggered = [false, false, false];
        
        const ui = document.getElementById('terminal-hack-ui');
        if (ui) ui.style.display = 'block';

        // CRT Filter Polish
        const crt = document.getElementById('crt-overlay');
        if (crt) crt.classList.add('hacking');

        // Play start sound
        this.hackSynth?.triggerAttackRelease(["C4", "E4", "G4"], "16n");

        this.showProgressionMessage("SECURITY BYPASS INITIATED - DEFEND THE TERMINAL!");
    }

    triggerHackingWave() {
        const chamber = this.map.chambers[this.currentChamberIndex];
        if (!chamber) return;

        const isBossRoom = (this.currentChamberIndex + 1) % CONFIG.MAP.BOSS_INTERVAL === 0;

        // Spawn a cluster of enemies - Staggered to prevent main-thread blocking
        const spawnCount = 3 + Math.floor(this.currentChamberIndex / 2);
        
        for (let i = 0; i < spawnCount; i++) {
            // Use setTimeout to stagger spawns every 200ms
            setTimeout(() => {
                // Ensure we are still playing and in the right chamber
                if (this.gameState !== 'PLAYING') return;

                // Increased buffer (chamber.size - 6) to prevent wall clipping on spawn
                const spawnPos = new THREE.Vector3(
                    chamber.x + (Math.random() - 0.5) * (chamber.size - 6),
                    0,
                    chamber.z + (Math.random() - 0.5) * (chamber.size - 6)
                );
                
                let type = Math.random() > 0.7 ? 'STALKER' : 'SENTRY';
                
                if (isBossRoom && i === 0 && !this.hackingWavesTriggered[1] && this.currentChamberIndex !== CONFIG.MAP.NUM_ROOMS - 1) {
                    type = 'HEAVY_SEC_BOT';
                    this.showProgressionMessage("BOSS DETECTED: HEAVY SECURITY UNIT ENGAGED");
                } else if (this.currentChamberIndex >= 2 && i === 0 && Math.random() > 0.5) {
                    type = 'TANK';
                }

                // Elite Spawn Logic
                let isElite = false;
                if (this.heatLevel >= 5) {
                    const eliteChance = Math.min(0.4, 0.1 + (this.heatLevel - 5) * 0.05);
                    if (Math.random() < eliteChance && type !== 'HEAVY_SEC_BOT') {
                        isElite = true;
                        this.showProgressionMessage("WARNING: ELITE UNIT-X DETECTED");
                        // Trigger elite sound and glitch immediately on spawn
                        setTimeout(() => this.triggerEliteSound(type), 100);
                    }
                }

                const enemy = new Enemy(this.scene, this.player, spawnPos, type, this.currentFacility?.id || 'meridian', this.navigation, this.particleSystem, this.heatLevel, isElite);
                enemy.onDeath = (e) => this.handleEnemyDeath(e);
                enemy.onSingularityDetonate = (e, type) => this.handleSingularityDetonate(e, type);
                this.enemies.push(enemy);
                
                // Only refresh on last spawn of wave
                if (i === spawnCount - 1) {
                    this.refreshRaycastTargets();
                }
            }, i * 300); // Stagger by 300ms each
        }

        // Audio cue for wave
        this.hackSynth?.triggerAttackRelease(["G3", "G4"], "8n");
    }

    updateTerminalHack(deltaTime) {
        if (!this.isHackingTerminal) return;

        // Throttled enemy check (every 300ms) - Using Spatial Grid
        if (!this.lastTerminalEnemiesCheck || Date.now() - this.lastTerminalEnemiesCheck > 300) {
            this.lastTerminalEnemiesCheck = Date.now();
            this.terminalBlocked = false;
            const blockRadius = 8;
            const blockRadiusSq = blockRadius * blockRadius;
            const termPos = this.currentTerminal.mesh.position;
            
            const nearbyEnemies = this.spatialGrid.getNearby(termPos, blockRadius);
            for (let i = 0; i < nearbyEnemies.length; i++) {
                const e = nearbyEnemies[i];
                if (!e.isAlly && !e.isDead && e.mesh.position.distanceToSquared(termPos) < blockRadiusSq) {
                    this.terminalBlocked = true;
                    break;
                }
            }
        }

        if (this.terminalBlocked) {
            const bar = document.getElementById('terminal-hack-bar');
            if (bar) bar.style.background = '#ff0000'; // Flash red when blocked
            const percent = document.getElementById('terminal-hack-percent');
            if (percent) percent.style.display = 'none';
            const alert = document.getElementById('terminal-hack-blocked-alert');
            if (alert) alert.style.display = 'block';
        } else {
            this.terminalHackProgress += deltaTime / this.terminalHackDuration;
            const bar = document.getElementById('terminal-hack-bar');
            if (bar) bar.style.background = '#00ffaa';
            const percent = document.getElementById('terminal-hack-percent');
            if (percent) percent.style.display = 'block';
            const alert = document.getElementById('terminal-hack-blocked-alert');
            if (alert) alert.style.display = 'none';
        }

        // Trigger waves based on progress
        const p = this.terminalHackProgress;
        if (p >= 0 && !this.hackingWavesTriggered[0]) {
            this.hackingWavesTriggered[0] = true;
            this.triggerHackingWave();
        } else if (p >= 0.33 && !this.hackingWavesTriggered[1]) {
            this.hackingWavesTriggered[1] = true;
            this.triggerHackingWave();
        } else if (p >= 0.66 && !this.hackingWavesTriggered[2]) {
            this.hackingWavesTriggered[2] = true;
            this.triggerHackingWave();
        }
        
        // Progress UI
        const bar = document.getElementById('terminal-hack-bar');
        const percent = document.getElementById('terminal-hack-percent');
        const progress = Math.min(100, Math.floor(this.terminalHackProgress * 100));
        if (bar) bar.style.width = `${progress}%`;
        if (percent && !this.terminalBlocked) percent.innerText = `${progress}%`;

        // Interactive audio feedback
        if (!this.terminalBlocked && Math.random() < 0.1) {
            const notes = ["C5", "D5", "E5", "G5"];
            const note = notes[Math.floor(Math.random() * notes.length)];
            this.hackSynth?.triggerAttackRelease(note, "32n");
        } else if (this.terminalBlocked && Math.random() < 0.05) {
            this.hackSynth?.triggerAttackRelease("C2", "16n"); // Warning low note
        }

        // Cancel if too far
        if (this.currentTerminal) {
            const dist = this.player.mesh.position.distanceTo(this.currentTerminal.mesh.position);
            if (dist > 6) { // Increased leash slightly
                this.isHackingTerminal = false;
                const ui = document.getElementById('terminal-hack-ui');
                if (ui) ui.style.display = 'none';
                
                const crt = document.getElementById('crt-overlay');
                if (crt) crt.classList.remove('hacking');

                this.showProgressionMessage("TERMINAL CONNECTION LOST");
                return;
            }
        }

        if (this.terminalHackProgress >= 1.0) {
            this.isHackingTerminal = false;
            const ui = document.getElementById('terminal-hack-ui');
            if (ui) ui.style.display = 'none';

            const crt = document.getElementById('crt-overlay');
            if (crt) crt.classList.remove('hacking');
            
            // Success sound
            this.successSynth?.triggerAttackRelease("C6", "8n");
            setTimeout(() => this.successSynth?.triggerAttackRelease("G6", "4n"), 100);

            this.unlockNextChamber(this.currentTerminal);
        }
    }

    unlockNextChamber(terminal) {
        terminal.isUsed = true;
        terminal.light.material.emissive.set(0x00ff00);
        
        const chamber = this.map.chambers[this.currentChamberIndex];
        
        if (chamber.isVault) {
            // Check if all vault terminals are hacked
            const vaultTerminals = this.map.terminals.filter(t => t.chamberIndex === this.currentChamberIndex && t.type.startsWith('VAULT'));
            const allHacked = vaultTerminals.every(t => t.isUsed);
            
            if (!allHacked) {
                this.showProgressionMessage("VAULT SECURITY LAYER 1 BYPASSED - LOCATE SECONDARY TERMINAL");
                this.successSynth?.triggerAttackRelease("C5", "8n");
                return; // Don't unlock chamber yet
            } else {
                this.showProgressionMessage("VAULT BREACH SUCCESSFUL - HIGH-VALUE ASSETS EXPOSED");
                this.unlockVaultLoot(this.currentChamberIndex);
            }
        }

        this.chamberClearingStatus = 'UNLOCKED';
        
        // Open the door for this chamber
        const door = this.map.doors.find(d => d.chamberIndex === this.currentChamberIndex);
        if (door) {
            door.isOpen = true;
            // Remove panels from walls to allow passage
            this.map.walls = this.map.walls.filter(w => w !== door.pL && w !== door.pR);
        }

        // Show UI message
        if (this.currentChamberIndex === CONFIG.MAP.NUM_ROOMS - 1) {
            this.map.extractionPortal?.activate();
            this.showProgressionMessage("CRITICAL ASSETS SECURED - EXTRACTION PORTAL ONLINE");
            this.successSynth?.triggerAttackRelease("C5", "2n");
        } else {
            if (!chamber.isVault) {
                this.showProgressionMessage("SECURITY OVERRIDE SUCCESSFUL - PROCEED TO NEXT CHAMBER");
            }
        }
    }

    unlockVaultLoot(chamberIndex) {
        // Find loot caches in this chamber
        this.map.walls.forEach(w => {
            if (w.userData.isLootCache && w.userData.chamberIndex === chamberIndex) {
                w.userData.isLocked = false;
                if (w.userData.light) {
                    w.userData.light.material.color.set(0x00ff00);
                    w.userData.light.material.emissive.set(0x00ff00);
                }
                
                // Spawn a cluster of high-value pickups nearby
                for (let i = 0; i < 5; i++) {
                    const pos = w.position.clone();
                    pos.x += (Math.random() - 0.5) * 3;
                    pos.z += (Math.random() - 0.5) * 3;
                    pos.y = 0.5;
                    
                    const rand = Math.random();
                    if (rand > 0.7) {
                        this.pickups.push(new CreditChip(this.scene, pos, 100)); // Large chip
                    } else if (rand > 0.4) {
                        this.pickups.push(new DataCore(this.scene, pos, 1));
                    } else {
                        this.pickups.push(new HealthPack(this.scene, pos));
                    }
                }
            }
        });
        
        this.successSynth?.triggerAttackRelease("G5", "2n");
    }

    spawnFinalBoss() {
        this.finalBossSpawned = true;
        this.finalBossAlive = true;
        
        const chamber = this.map.chambers[this.currentChamberIndex];
        const terminal = this.map.terminals.find(t => t.chamberIndex === this.currentChamberIndex);
        
        // Spawn boss slightly in front of terminal
        const spawnPos = terminal.mesh.position.clone();
        spawnPos.y = 0;
        const dirToCenter = new THREE.Vector3(chamber.x, 0, chamber.z).sub(spawnPos).normalize();
        spawnPos.add(dirToCenter.multiplyScalar(4)); 
        
        const boss = new Enemy(this.scene, this.player, spawnPos, 'HEAVY_SEC_BOT', this.currentFacility?.id || 'meridian', this.navigation, this.particleSystem, this.heatLevel);
        boss.onDeath = (e) => {
            this.finalBossAlive = false;
            this.handleEnemyDeath(e);
            this.showProgressionMessage("TERMINAL GUARD NEUTRALIZED - SECURITY HUB EXPOSED");
            
            // Drop Legendary Loot
            const dropPos = e.mesh.position.clone();
            dropPos.y = 1.0;
            this.pickups.push(new DataCore(this.scene, dropPos, 5)); // 5 Tech Cores value
            
            // Unlock Achievement
            this.unlockAchievement('TITAN SLAYER', 'Defeat the Heavy Security Titan in Room 50.');

            // Hide boss health
            const healthUI = document.getElementById('boss-health-container');
            if (healthUI) healthUI.style.display = 'none';
        };
        boss.onSingularityDetonate = (e, type) => this.handleSingularityDetonate(e, type);
        this.enemies.push(boss);
        
        // Final boss is extra beefy
        boss.health *= 1.5;
        boss.maxHealth *= 1.5;
        
        this.showProgressionMessage("WARNING: TITAN-CLASS SECURITY BOT DETECTED");
        this.successSynth?.triggerAttackRelease("C2", "2n");
        
        // Show Boss Health UI
        const healthUI = document.getElementById('boss-health-container');
        if (healthUI) {
            healthUI.style.display = 'block';
            this.updateBossHealthUI(boss);
        }
    }

    updateBossHealthUI(boss) {
        const bar = document.getElementById('boss-health-bar');
        const name = document.getElementById('boss-name');
        if (bar) bar.style.width = `${(boss.health / boss.maxHealth) * 100}%`;
        if (name) name.innerText = `TITAN UNIT: ${this.currentFacility?.name || 'SECURITY CORE'}`;
    }

    unlockAchievement(name, desc) {
        const achId = name.toUpperCase().replace(/ /g, '_');
        const saved = JSON.parse(localStorage.getItem('chamber_breach_achievements') || '[]');
        if (saved.includes(achId)) return;

        saved.push(achId);
        localStorage.setItem('chamber_breach_achievements', JSON.stringify(saved));
        
        const ui = document.getElementById('achievement-ui');
        const nameEl = document.getElementById('achievement-name');
        const descEl = document.getElementById('achievement-desc');
        
        if (ui && nameEl && descEl) {
            nameEl.innerText = name;
            descEl.innerText = desc;
            ui.style.display = 'block';
            
            this.successSynth?.triggerAttackRelease("C6", "8n");
            setTimeout(() => this.successSynth?.triggerAttackRelease("E6", "8n"), 100);
            
            setTimeout(() => {
                ui.style.animation = 'slideOutRight 0.5s ease-in forwards';
                setTimeout(() => {
                    ui.style.display = 'none';
                    ui.style.animation = ''; // Reset for next time
                }, 500);
            }, 5000);
        }
    }

    showProgressionMessage(msg) {
        const el = document.createElement('div');
        el.style.position = 'fixed';
        el.style.top = '12%'; // Moved higher to clear the center-view
        el.style.left = '50%';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.color = '#00ffaa';
        el.style.fontFamily = 'monospace';
        el.style.fontSize = '18px'; // Slightly smaller font
        el.style.textAlign = 'center';
        el.style.pointerEvents = 'none';
        el.style.textShadow = '0 0 8px #00ffaa';
        el.style.zIndex = '1000';
        el.innerText = msg;
        document.body.appendChild(el);
        setTimeout(() => {
            el.style.transition = 'opacity 1s';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 1000);
        }, 3000);
    }

    spawnEnemy() {
        const chamber = this.map.chambers[this.currentChamberIndex];
        if (!chamber || chamber.enemiesSpawned >= this.enemiesPerChamber) return;

        let spawnPos = new THREE.Vector3();
        let validSpawn = false;
        let attempts = 0;
        
        while (!validSpawn && attempts < 10) {
            // Increased wall buffer (chamber.size - 6) to prevent wall clipping on spawn
            spawnPos.set(
                chamber.x + (Math.random() - 0.5) * (chamber.size - 6),
                0,
                chamber.z + (Math.random() - 0.5) * (chamber.size - 6)
            );
            
            // Ensure enemy doesn't spawn too close to the player (min 8 units away)
            if (spawnPos.distanceTo(this.player.mesh.position) > 8) {
                validSpawn = true;
            }
            attempts++;
        }
        
        // Randomly pick a type based on difficulty/chamber index
        const rand = Math.random();
        let type = 'SENTRY';
        if (rand > 0.8) type = 'TANK';
        else if (rand > 0.5) type = 'STALKER';

        // Elite Spawn Logic
        let isElite = false;
        if (this.heatLevel >= 5) {
            const eliteChance = Math.min(0.4, 0.1 + (this.heatLevel - 5) * 0.05);
            if (Math.random() < eliteChance && type !== 'HEAVY_SEC_BOT') {
                isElite = true;
                this.showProgressionMessage("ELITE UNIT BREACH DETECTED");
            }
        }

        const enemy = new Enemy(this.scene, this.player, spawnPos, type, this.currentFacility?.id || 'meridian', this.navigation, this.particleSystem, this.heatLevel, isElite);
        enemy.onDeath = (e) => this.handleEnemyDeath(e);
        enemy.onSingularityDetonate = (e, type) => this.handleSingularityDetonate(e, type);
        this.enemies.push(enemy);
        this.refreshRaycastTargets();
        chamber.enemiesSpawned++;
    }

    handleSingularityDetonate(enemy, type = 'VOLATILE') {
        if (!enemy || !enemy.mesh) return;
        const pos = enemy.mesh.position.clone();
        
        if (type === 'NEUTRON') {
            const radius = 15;
            const damage = 500;
            const empDuration = 4000;
            let killsCount = 0;

            if (this.particleSystem) {
                this.particleSystem.createExplosion(pos, 0x00ffff, 60, 15);
                this.particleSystem.createExplosion(pos, 0xffffff, 30, 8);
                this.particleSystem.flashLight(pos, 0x00ffff, 30, radius * 2, 500);
            }

            // Damage and EMP
            this.enemies.forEach(e => {
                if (!e.isAlly && !e.isDead && e.mesh.position.distanceTo(pos) < radius) {
                    const healthBefore = e.health;
                    e.takeDamage(damage, this.enemies);
                    e.applyEMP(empDuration);
                    if (e.isDead) {
                        killsCount++;
                        this.player.score += 100;
                        this.handleEnemyKilled(e);
                    }
                }
            });

            // Gamma Burst Synergy
            if (killsCount > 0 && enemy.modules.includes('GAMMA_BURST')) {
                // Grant 10% damage buff per kill for 12 seconds
                this.player.buffs.push({
                    multiplier: killsCount * 0.1,
                    duration: 12
                });
                this.player.updateUI();
                
                // Visual feedback for buff activation
                const buffFlash = new THREE.PointLight(0x00ff00, 10, 10);
                buffFlash.position.copy(this.player.mesh.position);
                this.scene.add(buffFlash);
                setTimeout(() => this.scene.remove(buffFlash), 300);
            }

            this.shakeAmount = Math.max(this.shakeAmount, 0.8);
        } else {
            const radius = 12;
            const damage = 300;

            if (this.particleSystem) {
                this.particleSystem.createExplosion(pos, 0x6600ff, 40, 10);
                this.particleSystem.createExplosion(pos, 0xff0000, 20, 5);
                this.particleSystem.flashLight(pos, 0xaa00ff, 20, radius * 1.5, 400);
            }

            this.handleAreaDamage(pos, radius, damage);
        }
    }

    handleEnemyDeath(enemy) {
        this.refreshRaycastTargets();
        if (enemy.isAlly && enemy.modules.includes('SELF_DESTRUCT')) {
            const pos = enemy.mesh.position.clone();
            const radius = 10;
            const damage = 200;

            // Massive Visual Explosion
            if (this.particleSystem) {
                this.particleSystem.createExplosion(pos, 0xff4400, 50, 15);
                this.particleSystem.createExplosion(pos, 0xffaa00, 30, 8);
            }

            const light = new THREE.PointLight(0xffaa00, 20, radius * 2);
            light.position.copy(pos);
            this.scene.add(light);
            setTimeout(() => this.scene.remove(light), 300);

            // Area Damage
            this.handleAreaDamage(pos, radius, damage);
        }
    }

    checkAndSpawnPickups() {
        // Only check every few seconds
        if (Date.now() - this.lastPickupSpawnCheck < 5000) return;
        this.lastPickupSpawnCheck = Date.now();

        // Check each chamber to see if it's "cleared" (no enemies inside)
        this.map.chambers.forEach(chamber => {
            const enemiesInChamber = this.enemies.filter(e => {
                const dx = Math.abs(e.mesh.position.x - chamber.x);
                const dz = Math.abs(e.mesh.position.z - chamber.z);
                return dx < chamber.size / 2 && dz < chamber.size / 2;
            });

            // If chamber is empty of enemies, chance to spawn a health pack or ammo crate
            if (enemiesInChamber.length === 0 && Math.random() < 0.6) {
                const existingPickup = this.pickups.find(p => {
                    const dx = Math.abs(p.mesh.position.x - chamber.x);
                    const dz = Math.abs(p.mesh.position.z - chamber.z);
                    return dx < chamber.size / 2 && dz < chamber.size / 2;
                });

                if (!existingPickup && this.pickups.length < 8) {
                    const spawnPos = new THREE.Vector3(
                        chamber.x + (Math.random() - 0.5) * (chamber.size - 6),
                        0,
                        chamber.z + (Math.random() - 0.5) * (chamber.size - 6)
                    );
                    
                    const rand = Math.random();
                    if (rand > 0.6) {
                        this.pickups.push(new AmmoCrate(this.scene, spawnPos, 'RIFLE'));
                    } else if (rand > 0.3) {
                        this.pickups.push(new AmmoCrate(this.scene, spawnPos, 'SNIPER'));
                    } else {
                        this.pickups.push(new HealthPack(this.scene, spawnPos));
                    }
                }
            }
        });
    }

    createCommandMarker() {
        const geo = new THREE.RingGeometry(0.8, 1, 32);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.visible = false;
        this.scene.add(mesh);
        return mesh;
    }

    handleExplosion(pos) {
        const radius = CONFIG.PLAYER.GRENADE.RADIUS;
        const damage = CONFIG.PLAYER.GRENADE.DAMAGE;
        this.handleAreaDamage(pos, radius, damage);
        this.shakeAmount = Math.max(this.shakeAmount, 0.5);
    }

    handleBarrelExplosion(barrel) {
        if (!barrel || !barrel.parent) return; // Already destroyed

        const pos = barrel.position.clone();
        const radius = CONFIG.PLAYER.BARREL.RADIUS;
        const damage = CONFIG.PLAYER.BARREL.DAMAGE;

        // Visual Explosion
        if (this.particleSystem) {
            this.particleSystem.createExplosion(pos, 0xff3300, 25, 8);
            this.particleSystem.createExplosion(pos, 0xffaa00, 15, 4);
        }

        // Flash Light
        const light = new THREE.PointLight(0xff3300, 8, 12);
        light.position.copy(pos);
        this.scene.add(light);
        setTimeout(() => this.scene.remove(light), 150);

        // Remove the barrel before processing AOE to prevent recursion issues
        this.map.destroyObject(barrel);

        // Spawn fire field
        this.activeFireFields.push(new FireField(this.scene, pos, radius * 0.5, this.particleSystem));

        // Damage things in range
        this.handleAreaDamage(pos, radius, damage);
        
        this.shakeAmount = Math.max(this.shakeAmount, 0.4);
    }

    handlePipeHit(pipe, point) {
        if (pipe.userData.isGasTriggered) return;
        pipe.userData.isGasTriggered = true;
        
        if (pipe.material) {
            pipe.material.color.set(0x00ff00);
            pipe.material.emissive.set(0x003300);
        }

        const leak = new GasLeak(this.scene, point, this.particleSystem);
        this.activeGasLeaks.push(leak);
        this.shakeAmount = Math.max(this.shakeAmount, 0.1);
    }

    handleGasIgnite(gasLeak) {
        if (!gasLeak || gasLeak.isExploded || gasLeak.isExpired) return;
        
        const pos = gasLeak.position.clone();

        // Check if gas is inside a smoke screen (smoke prevents ignition)
        const inSmoke = this.activeSmokeScreens.some(s => s.checkCollision(pos));
        if (inSmoke) {
            // Gas is smothered, just dissipate
            gasLeak.destroy();
            return;
        }

        gasLeak.ignite();
        
        const radius = CONFIG.HAZARDS.GAS.EXPLOSION_RADIUS;
        const damage = CONFIG.HAZARDS.GAS.EXPLOSION_DAMAGE;

        if (this.particleSystem) {
            this.particleSystem.createExplosion(pos, 0x00ff00, 40, 12);
            this.particleSystem.createExplosion(pos, 0xffaa00, 20, 8);
        }

        const light = new THREE.PointLight(0x00ff33, 10, radius * 1.5);
        light.position.copy(pos);
        this.scene.add(light);
        setTimeout(() => this.scene.remove(light), 200);

        this.handleAreaDamage(pos, radius, damage);
        this.activeFireFields.push(new FireField(this.scene, pos, radius * 0.4, this.particleSystem));
        this.shakeAmount = Math.max(this.shakeAmount, 0.7);
    }

    handleEMPExplosion(pos) {
        const radius = CONFIG.PLAYER.EMP.RADIUS;
        const duration = CONFIG.PLAYER.EMP.DURATION;

        // Visual distortion flash
        const light = new THREE.PointLight(0x00ffff, 30, radius * 2);
        light.position.copy(pos);
        this.scene.add(light);
        setTimeout(() => this.scene.remove(light), 300);

        // Affect Enemies
        this.enemies.forEach(enemy => {
            if (enemy.mesh.position.distanceTo(pos) < radius) {
                enemy.applyEMP(duration);
            }
        });

        // Affect Hazards (Extinguish fire, trigger gas leaks)
        this.activeFireFields.forEach(fire => {
            if (fire.position.distanceTo(pos) < radius) {
                fire.duration *= 0.5; // EMP disrupts chemical fire fields
            }
        });

        this.shakeAmount = Math.max(this.shakeAmount, 0.3);
    }

    handleExtinguisherBurst(extProp) {
        if (!extProp || !extProp.parent) return;

        const pos = extProp.position.clone();
        const radius = CONFIG.HAZARDS.EXTINGUISHER.RADIUS;

        // Visual
        if (this.particleSystem) {
            this.particleSystem.createExplosion(pos, 0xffffff, 40, 6);
        }

        // Spawn Smoke Screen
        const smoke = new SmokeScreen(this.scene, pos, this.particleSystem);
        this.activeSmokeScreens.push(smoke);

        // Extinguish nearby fire fields and gas leaks
        this.activeFireFields.forEach(fire => {
            if (fire.position.distanceTo(pos) < radius) {
                fire.duration = 0; // Immediate expiry
            }
        });

        this.activeGasLeaks.forEach(leak => {
            if (leak.position.distanceTo(pos) < radius) {
                leak.destroy(); // Smothered
            }
        });

        // Remove prop
        this.map.destroyObject(extProp);
        
        this.shakeAmount = Math.max(this.shakeAmount, 0.2);
    }

    handleEnemyKilled(enemy) {
        if (!enemy) return;
        
        // Spawn Credit Chips based on enemy type
        const creditValue = enemy.type === 'TANK' ? 50 : (enemy.type === 'STALKER' ? 25 : 15);
        const chipCount = enemy.type === 'TANK' ? 3 : 1;
        
        for (let i = 0; i < chipCount; i++) {
            const spreadPos = enemy.mesh.position.clone();
            if (chipCount > 1) {
                spreadPos.x += (Math.random() - 0.5) * 1;
                spreadPos.z += (Math.random() - 0.5) * 1;
            }
            this.pickups.push(new CreditChip(this.scene, spreadPos, Math.floor(creditValue / chipCount)));
        }

        // Random chance for tech core (physical drop or auto?)
        if (Math.random() < 0.3) {
            this.techCores++;
            if (this.particleSystem) {
                this.particleSystem.createExplosion(enemy.mesh.position, 0xffff00, 10, 2);
            }
        }
        this.player.updateUI();
    }

    handleAreaDamage(pos, radius, damage) {
        const radiusSq = radius * radius;
        
        // Damage enemies using spatial grid
        const nearbyEnemies = this.spatialGrid.getNearby(pos, radius);
        for (let i = 0; i < nearbyEnemies.length; i++) {
            const enemy = nearbyEnemies[i];
            if (enemy.isDead) continue;
            const distSq = enemy.mesh.position.distanceToSquared(pos);
            if (distSq < radiusSq) {
                const dist = Math.sqrt(distSq);
                const factor = 1 - (dist / radius);
                enemy.takeDamage(damage * factor, this.enemies);
                if (enemy.isDead) {
                    this.player.score += 100;
                    this.player.updateUI();
                    this.handleEnemyKilled(enemy);
                    this.spatialGrid.removeEntity(enemy);
                }
            }
        }

        // Damage player
        const distToPlayerSq = this.player.mesh.position.distanceToSquared(pos);
        if (distToPlayerSq < radiusSq) {
            const dist = Math.sqrt(distToPlayerSq);
            const factor = 1 - (dist / radius);
            this.player.takeDamage(damage * 0.4 * factor);
        }

        // Damage environment (Throttled/Optimized)
        for (let i = this.map.walls.length - 1; i >= 0; i--) {
            const wall = this.map.walls[i];
            const distSq = wall.position.distanceToSquared(pos);
            if (distSq < radiusSq) {
                const dist = Math.sqrt(distSq);
                if (wall.userData.isDestructible) {
                    wall.userData.health -= damage * (1 - dist / radius);
                    if (wall.userData.health <= 0) {
                        if (this.particleSystem) {
                            this.particleSystem.createExplosion(wall.position, 0x664422, 10, 3);
                        }
                        this.map.destroyObject(wall);
                    }
                } else if (wall.userData.isBarrel) {
                    setTimeout(() => this.handleBarrelExplosion(wall), 50 + Math.random() * 150);
                } else if (wall.userData.isPipe && !wall.userData.isGasTriggered) {
                    this.handlePipeHit(wall, wall.position.clone());
                }
            }
        }

        // Ignite other gas leaks
        this.activeGasLeaks.forEach(leak => {
            if (!leak.isExploded && leak.position.distanceToSquared(pos) < radiusSq) {
                setTimeout(() => this.handleGasIgnite(leak), 100 + Math.random() * 100);
            }
        });
    }


    tryStartHacking() {
        if (this.isHacking) return;
        
        // Find nearest disabled drone using spatial grid
        let nearest = null;
        const hackRange = 3;
        const hackRangeSq = hackRange * hackRange;
        const playerPos = this.player.mesh.position;
        
        const nearby = this.spatialGrid.getNearby(playerPos, hackRange);
        for (let i = 0; i < nearby.length; i++) {
            const e = nearby[i];
            if (e.isDisabled && !e.isAlly && !e.isDead) {
                const dSq = e.mesh.position.distanceToSquared(playerPos);
                if (dSq < hackRangeSq) {
                    nearest = e;
                    break; // Found one close enough
                }
            }
        }

        if (nearest) {
            this.startHacking(nearest);
        }
    }

    startHacking(drone) {
        this.isHacking = true;
        this.hackingDrone = drone;
        this.hackingProgress = 0;
        this.hackingNeedleRotation = 0;
        this.generateNewHackingTarget();
        
        const ui = document.getElementById('hacking-ui');
        if (ui) ui.style.display = 'block';
        document.getElementById('hacking-progress').innerText = `0 / 3`;
    }

    generateNewHackingTarget() {
        this.hackingTargetRotation = Math.random() * 360;
        const targetZone = document.getElementById('hacking-target-zone');
        if (targetZone) {
            targetZone.style.transform = `rotate(${this.hackingTargetRotation}deg)`;
        }
    }

    checkHackingHit() {
        const needle = this.hackingNeedleRotation % 360;
        const target = this.hackingTargetRotation;
        
        // Circular distance
        let diff = Math.abs(needle - target);
        if (diff > 180) diff = 360 - diff;

        if (diff < this.hackingTargetSize / 2) {
            this.hackingProgress++;
            document.getElementById('hacking-progress').innerText = `${this.hackingProgress} / 3`;
            this.hackingNeedleSpeed += 50; // Speed up
            
            if (this.hackingProgress >= 3) {
                this.completeHacking(true);
            } else {
                this.generateNewHackingTarget();
            }
        } else {
            // Miss - fail hacking or reset progress?
            this.completeHacking(false);
        }
    }

    completeHacking(success) {
        this.isHacking = false;
        const ui = document.getElementById('hacking-ui');
        if (ui) ui.style.display = 'none';

        if (success && this.hackingDrone) {
            this.hackingDrone.isAlly = true;
            this.hackingDrone.isDisabled = false; // Wake up immediately
            this.hackingDrone.command = 'FOLLOW';
            this.player.score += 500;
            this.player.updateUI();
            
            // Visual burst for success
            this.particleSystem.createExplosion(this.hackingDrone.mesh.position, 0x00ff00, 20, 5);
        } else {
            // Failure - drone wakes up and shocks player
            if (this.hackingDrone) {
                this.player.takeDamage(20);
                this.hackingDrone.isDisabled = false;
            }
        }
        this.hackingDrone = null;
    }

    toggleCommandMenu(open) {
        if (open && !this.enemies.some(e => e.isAlly && !e.isDead)) return; // No allies to command

        this.isMenuOpen = open;
        const menu = document.getElementById('radial-menu');
        if (menu) menu.style.display = open ? 'block' : 'none';
        
        if (!open && this.selectedCommand) {
            this.issueCommand(this.selectedCommand);
        }

        if (open) {
            document.exitPointerLock();
        } else {
            this.renderer.domElement.requestPointerLock();
        }
    }

    triggerEliteSound(type) {
        if (!this.eliteScreech) return;
        const now = this.Tone ? this.Tone.now() : 0;
        
        // Trigger a visual glitch
        this.heatVisuals.glitchIntensity = Math.max(this.heatVisuals.glitchIntensity, 0.8);
        this.shakeAmount = Math.max(this.shakeAmount, 0.4);

        switch(type) {
            case 'SENTRY':
                // Rapid stuttering beep
                this.eliteScreech.triggerAttackRelease("C6", "32n", now);
                this.eliteScreech.triggerAttackRelease("G6", "32n", now + 0.1);
                this.eliteScreech.triggerAttackRelease("C7", "32n", now + 0.2);
                break;
            case 'STALKER':
                // Creepy slide
                this.eliteScreech.triggerAttackRelease("E6", "16n", now);
                this.eliteScreech.frequency.exponentialRampToValueAtTime(100, now + 0.5);
                break;
            case 'TANK':
                // Industrial low crunch screech
                this.eliteScreech.triggerAttackRelease("C3", "8n", now);
                this.eliteScreech.modulationIndex.value = 50;
                setTimeout(() => { if(this.eliteScreech) this.eliteScreech.modulationIndex.value = 10; }, 500);
                break;
            case 'SHIELD_PROJECTOR':
                // Static burst
                this.eliteScreech.triggerAttackRelease("G5", "4n", now);
                break;
            default:
                this.eliteScreech.triggerAttackRelease("A5", "8n", now);
        }
    }

    updateRadar() {
        if (this.gameState !== 'PLAYING') return;
        
        const radarContent = document.getElementById('radar-content');
        if (!radarContent) return;

        // Throttled UI update
        if (Date.now() - this.radarUpdateTimer < 100) return;
        this.radarUpdateTimer = Date.now();

        // Clear existing dots
        radarContent.innerHTML = '';

        const radarRadius = 60; // half of radar-ui size (120px)
        const detectionRadius = 40; // Meters to show on radar

        const playerPos = this.player.mesh.position;
        const playerRot = this.cameraController.rotationY;

        // Draw allies
        this.enemies.forEach(e => {
            if (e.isAlly && !e.isDead) {
                const relX = e.mesh.position.x - playerPos.x;
                const relZ = e.mesh.position.z - playerPos.z;
                
                // Rotate based on player heading
                const rotatedX = relX * Math.cos(playerRot) - relZ * Math.sin(playerRot);
                const rotatedZ = relX * Math.sin(playerRot) + relZ * Math.cos(playerRot);

                const dist = Math.sqrt(rotatedX * rotatedX + rotatedZ * rotatedZ);
                if (dist < detectionRadius) {
                    const dot = document.createElement('div');
                    dot.className = 'radar-dot ally';
                    const screenX = radarRadius + (rotatedX / detectionRadius) * radarRadius;
                    const screenZ = radarRadius + (rotatedZ / detectionRadius) * radarRadius;
                    dot.style.left = `${screenX}px`;
                    dot.style.top = `${screenZ}px`;
                    radarContent.appendChild(dot);
                }
            }
        });

        // Draw Hostiles (if heat is high or scanning?)
        if (this.heatLevel >= 3 || this.player.isThermalActive) {
            this.enemies.forEach(e => {
                if (!e.isAlly && !e.isDead) {
                    const relX = e.mesh.position.x - playerPos.x;
                    const relZ = e.mesh.position.z - playerPos.z;
                    
                    const rotatedX = relX * Math.cos(playerRot) - relZ * Math.sin(playerRot);
                    const rotatedZ = relX * Math.sin(playerRot) + relZ * Math.cos(playerRot);

                    const dist = Math.sqrt(rotatedX * rotatedX + rotatedZ * rotatedZ);
                    if (dist < detectionRadius) {
                        const dot = document.createElement('div');
                        dot.className = 'radar-dot hostile';
                        const screenX = radarRadius + (rotatedX / detectionRadius) * radarRadius;
                        const screenZ = radarRadius + (rotatedZ / detectionRadius) * radarRadius;
                        dot.style.left = `${screenX}px`;
                        dot.style.top = `${screenZ}px`;
                        radarContent.appendChild(dot);
                    }
                }
            });
        }
    }

    handleObjectDestruction(obj) {
        if (!obj) return;
        
        // Visuals
        const isMonitor = obj.userData.isMonitor;
        const color = isMonitor ? 0x00ffff : 0x444444;
        
        this.particleSystem.createExplosion(obj.position, color, 15, 3);
        this.particleSystem.createDebris(obj.position, color, 8, isMonitor ? 'MONITOR' : 'GENERIC');
        
        if (isMonitor) {
            this.particleSystem.createExplosion(obj.position, 0xffffff, 5, 10); // Glass/Spark shards
            this.shakeAmount = Math.max(this.shakeAmount, 0.5);
        } else {
            this.shakeAmount = Math.max(this.shakeAmount, 0.3);
        }
        
        // Sounds
        if (this.impactSynth) {
            this.impactSynth.triggerAttackRelease(isMonitor ? "C4" : "C2", "8n");
        }

        // Logic
        this.scene.remove(obj);
        // Remove from raycast targets
        this.raycastTargets = this.raycastTargets.filter(t => t !== obj);
    }

    handlePipeHit(pipe, point) {
        if (!pipe) return;
        
        const isGasPipe = pipe.userData.isGasPipe;
        const effectColor = isGasPipe ? 0x00ff00 : 0xffaa00;
        
        // Steam/Gas cloud
        this.particleSystem.createSteamCloud(point, isGasPipe ? 0x00ff00 : 0xdddddd, 10);
        
        if (isGasPipe) {
            // Spawn a gas leak logic
            if (!pipe.userData.isGasTriggered) {
                const leak = new GasLeak(this.scene, point, this.particleSystem);
                this.activeGasLeaks.push(leak);
                pipe.userData.isGasTriggered = true;
            }
        } else {
            // High-voltage sparks
            this.particleSystem.createExplosion(point, 0xffffff, 8, 5);
            this.particleSystem.createTracer(point, point.clone().add(new THREE.Vector3(Math.random()-0.5, 2, Math.random()-0.5)), 0x00ffff, 0.5);
        }

        // Add debris
        this.particleSystem.createDebris(point, 0x888888, 3, 'PIPE');

        if (this.impactSynth) {
            this.impactSynth.triggerAttackRelease(isGasPipe ? "G2" : "G4", "16n");
        }
    }

    issueCommand(command) {
        if (command === 'CANCEL') return;
        if (command === 'TECH_INVENTORY') {
            this.toggleInventory(true);
            return;
        }

        // Trigger Tactical Handshake audio
        if (this.tacticalHandshake) {
            const now = this.Tone ? this.Tone.now() : 0;
            this.tacticalHandshake.triggerAttackRelease(["C5", "G5"], "32n", now);
        }

        if (command.startsWith('STANCE_')) {
            const stance = command.split('_')[1].toLowerCase();
            this.enemies.forEach(e => {
                if (e.isAlly && !e.isDead) {
                    if (e.setStance) e.setStance(stance);
                }
            });
            this.showProgressionMessage(`DRONE SQUAD: ${stance.toUpperCase()} MODE ACTIVE`);
            this.successSynth?.triggerAttackRelease("C5", "16n");
            this.selectedCommand = null;
            return;
        }

        let targetPos = null;
        let targetEnemy = null;

        // Perform raycast to find target or position
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        
        // We want to check enemies first for STRIKE, otherwise floor/walls
        const enemiesHitboxes = this.enemies.filter(e => !e.isDead && !e.isAlly).map(e => e.mesh.getObjectByName('hitbox')).filter(Boolean);
        const environment = [...this.map.walls, this.scene.getObjectByName('FLOOR')].filter(Boolean);
        
        if (command === 'STRIKE') {
            const hits = raycaster.intersectObjects(enemiesHitboxes, true);
            if (hits.length > 0) {
                targetEnemy = hits[0].object.userData.enemyRef;
                targetPos = targetEnemy.mesh.position.clone();
                this.showProgressionMessage(`COMMAND: FOCUS FIRE ON ${targetEnemy.type}`);
                this.successSynth?.triggerAttackRelease("G5", "16n");
                
                // Red marker for strike
                this.commandMarker.material.color.set(0xff0000);
                this.commandMarker.scale.setScalar(1.5);
            } else {
                // If no enemy hit, maybe player just wanted to move them there?
                // Or maybe cancel strike if nothing hit?
                this.showProgressionMessage("COMMAND FAILED: NO TARGET ACQUIRED");
                return;
            }
        } else if (command === 'DEFEND') {
            const hits = raycaster.intersectObjects(environment, true);
            if (hits.length > 0) {
                targetPos = hits[0].point.clone();
                this.showProgressionMessage("COMMAND: DEFEND POSITION");
                this.successSynth?.triggerAttackRelease("C5", "16n");
                
                // Blue marker for defend
                this.commandMarker.material.color.set(0x00aaff);
                this.commandMarker.scale.setScalar(1.0);
            } else {
                return;
            }
        } else if (command === 'FOLLOW') {
            this.showProgressionMessage("COMMAND: FOLLOWING OPERATOR");
            this.successSynth?.triggerAttackRelease("E5", "16n");
        }

        if (targetPos) {
            this.commandMarker.position.copy(targetPos).y += 0.1;
            this.commandMarker.visible = true;
            setTimeout(() => this.commandMarker.visible = false, 2000);
        }

        this.enemies.forEach(e => {
            if (e.isAlly && !e.isDead) {
                e.command = command;
                if (targetPos) e.commandPos.copy(targetPos);
                if (targetEnemy) e.commandTarget = targetEnemy;
                else e.commandTarget = null;
            }
        });
        
        this.selectedCommand = null;
    }

    updateChamberHUD() {
        const chamber = this.map.chambers[this.currentChamberIndex];
        const bar = document.getElementById('chamber-progress-bar');
        const label = document.getElementById('chamber-progress-label');
        if (!chamber || !bar || !label) return;

        const enemiesAlive = this.enemies.filter(e => !e.isAlly && !e.isDead).length;
        const enemiesKilled = Math.max(0, chamber.enemiesSpawned - enemiesAlive);
        const totalEnemies = this.enemiesPerChamber;
        
        let progressPercent = Math.min(100, (enemiesKilled / totalEnemies) * 100);
        
        if (this.chamberClearingStatus === 'CLEARED' || this.chamberClearingStatus === 'UNLOCKED') {
            progressPercent = 100;
        }

        bar.style.width = `${progressPercent}%`;
        
        if (this.chamberClearingStatus === 'CLEARED') {
            label.innerText = `CHAMBER ${this.currentChamberIndex + 1} SECURED - ACCESS TERMINAL`;
            label.style.color = '#ffff00';
            bar.style.background = '#ffff00';
        } else if (this.chamberClearingStatus === 'UNLOCKED') {
            label.innerText = `CHAMBER ${this.currentChamberIndex + 1} UNLOCKED - PROCEED TO EXIT`;
            label.style.color = '#00ffff';
            bar.style.background = '#00ffff';
        } else {
            label.innerText = `CHAMBER ${this.currentChamberIndex + 1} INTEGRITY: ${Math.floor(100 - progressPercent)}%`;
            label.style.color = '#00ffaa';
            bar.style.background = '#00ffaa';
        }
    }

    update(deltaTime) {
        if (this.gameState !== 'PLAYING' && this.gameState !== 'BRIEFING_SCREEN' && !this.isNeuralSyncing) {
            // Lower ambient when not playing
            if (this.ambientHum) this.ambientHum.volume.rampTo(-60, 0.5);
            if (this.ambientAir) this.ambientAir.volume.rampTo(-80, 0.5);
            return;
        } else {
            if (this.ambientHum) this.ambientHum.volume.rampTo(-45, 0.5);
            if (this.ambientAir) this.ambientAir.volume.rampTo(-65, 0.5);
        }

        // Update Radar HUD
        this.updateRadar();

        // --- Heat System Update ---
        if (this.gameState === 'PLAYING') {
            const elapsed = Date.now() - this.missionStartTime;
            const newHeat = Math.min(CONFIG.HEAT.MAX_LEVEL, 1 + Math.floor(elapsed / CONFIG.HEAT.LEVEL_UP_INTERVAL));
            
            if (newHeat > this.heatLevel) {
                this.heatLevel = newHeat;
                this.showProgressionMessage(`SECURITY LEVEL INCREASED: HEAT LEVEL ${this.heatLevel}`);
                this.successSynth?.triggerAttackRelease("C3", "4n");
                
                // Visual feedback for heat increase
                const hud = document.getElementById('heat-hud');
                if (hud) {
                    hud.style.display = 'block';
                    hud.style.animation = 'pulse 1s 3';
                    const heatVal = document.getElementById('heat-val');
                    if (heatVal) heatVal.innerText = this.heatLevel;
                }
                
                // Trigger a burst glitch
                this.heatVisuals.glitchIntensity = 1.0;
            }
            
            this.updateHeatVisuals(deltaTime);
        }

        if (!this.map) return;

        // Check for player death
        if (this.player.isDead && this.gameState === 'PLAYING') {
            // Short grace period after deployment to avoid instant glitch deaths
            if (Date.now() - (this.deploymentTime || 0) > 1000) {
                this.showDeathScreen();
                return;
            } else {
                // If they "died" during grace period, just reset health
                this.player.health = this.player.maxHealth;
                this.player.isDead = false;
                this.player.updateUI();
            }
        }

        // Reset per-frame player states
        this.player.isPhased = false;

        // Update Neural Sync logic
        this.updateNeuralSync(deltaTime);

        // Update Terminal Hack
        this.updateTerminalHack(deltaTime);

        // Update Doors
        this.map.doors.forEach(d => d.update(deltaTime));

        // Update Extraction Portal
        if (this.map.extractionPortal) {
            this.map.extractionPortal.update(deltaTime);
            
            // Check for extraction
            if (this.map.extractionPortal.mesh.visible) {
                const dist = this.player.mesh.position.distanceTo(this.map.extractionPortal.mesh.position);
                if (dist < 2.5) {
                    this.showExtractionScreen();
                }
            }
        }

        // Progress logic
        const currentChamber = this.map.chambers[this.currentChamberIndex];
        if (currentChamber) {
            // Check for chamber clearing
            if (this.chamberClearingStatus === 'ACTIVE') {
                const enemiesInChamber = this.enemies.filter(e => !e.isAlly && !e.isDead);
                if (currentChamber.enemiesSpawned >= this.enemiesPerChamber && enemiesInChamber.length === 0) {
                    this.chamberClearingStatus = 'CLEARED';
                    currentChamber.isCleared = true;
                    this.showProgressionMessage("CHAMBER SECURED - LOCATE TERMINAL TO OVERRIDE LOCKS");
                }
            }

            // Check if player moved to next chamber
            if (this.chamberClearingStatus === 'UNLOCKED' && this.currentChamberIndex < this.map.chambers.length - 1) {
                const nextChamber = this.map.chambers[this.currentChamberIndex + 1];
                if (this.player.mesh.position.distanceTo(new THREE.Vector3(nextChamber.x, 0, nextChamber.z)) < nextChamber.size / 2) {
                    this.currentChamberIndex++;
                    this.enemiesPerChamber += 2; // Base increase
                    if (nextChamber.isVault) this.enemiesPerChamber += 4; // Extra security for vaults
                    
                    this.chamberClearingStatus = 'ACTIVE';
                    this.showProgressionMessage(nextChamber.isVault ? `WARNING: BREACHING HIGH-SECURITY VAULT` : `ENTERING CHAMBER ${this.currentChamberIndex + 1}`);

                    // Final Boss Room Logic
                    if (this.currentChamberIndex === CONFIG.MAP.NUM_ROOMS - 1 && !this.finalBossSpawned) {
                        this.spawnFinalBoss();
                    }
                }
            }
        }

        // Show interaction prompts - Throttled (every 10 frames)
        if (this.frameCounter % 10 === 0) {
            this.performProximityChecks();
        }
        this.frameCounter++;

        // Hacking UI update
        if (this.isHacking) {
            this.hackingNeedleRotation += this.hackingNeedleSpeed * deltaTime;
            const needleEl = document.getElementById('hacking-needle');
            if (needleEl) needleEl.style.transform = `translate(-50%, -100%) rotate(${this.hackingNeedleRotation}deg)`;
        }

        // Handle Extinguisher Spray
        if (this.player.currentWeaponKey === 'EXTINGUISHER' && this.mouseIsDown) {
            this.player.spray(deltaTime, this.activeFireFields, this.map.barrels, this.map.hazards);
        } else {
            this.player.isSpraying = false;
        }

        // Update Environmental Hazards 2.0
        let targetMoveSpeed = CONFIG.PLAYER.MOVE_SPEED;
        if (this.map.hazards) {
            this.map.hazards.forEach(hazard => {
                if (hazard.update) {
                    // Update hazard and it can handle its own player damage/detection if it wants
                    // We pass a takeDamage callback that uses the environmental blue flash
                    const envTakeDamage = (amt, isDOT) => this.player.takeDamage(amt, isDOT, 'rgba(0, 150, 255, 0.4)');
                    hazard.update(deltaTime, this.player.mesh.position, envTakeDamage);
                }
                
                if (hazard.instance && hazard.instance.update) {
                    hazard.instance.update(deltaTime, this.player, this.enemies, this.gameState === 'PLAYING');
                }
                
                if (!hazard.isActive) return;

                if (hazard.type === 'VOLTAGE') {
                    // Collision check - use group position because mesh is relative
                    const hazardPos = hazard.group ? hazard.group.position : hazard.mesh.position;
                    const dist = this.player.mesh.position.distanceTo(hazardPos);
                    if (dist < (hazard.radius || 1.8)) {
                        if (this.gameState === 'PLAYING' && Date.now() - (hazard.lastTick || 0) > 800) {
                            this.player.takeDamage(hazard.damage || 25, true, 'rgba(0, 150, 255, 0.4)');
                            hazard.lastTick = Date.now();
                            this.shakeAmount = Math.max(this.shakeAmount, 0.3);
                        }
                    }
                } else if (hazard.type === 'CRYO' || (hazard.instance && hazard.instance.isActive && hazard.type === 'CRYO_VENT')) {
                    // Slow player if standing in cryo
                    const hazardPos = hazard.group ? hazard.group.position : (hazard.position || hazard.mesh.position);
                    const dist = this.player.mesh.position.distanceTo(hazardPos);
                    const rad = hazard.radius || 2.5;
                    if (dist < rad && this.gameState === 'PLAYING') {
                        targetMoveSpeed = CONFIG.PLAYER.MOVE_SPEED * (hazard.slowFactor || 0.5);
                    }
                }
            });
        }
        this.playerController.moveSpeed = targetMoveSpeed;

        // Particle update
        this.particleSystem.update(deltaTime);

        // Update Grenades
        for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
            const g = this.activeGrenades[i];
            g.update(deltaTime, this.map.walls);
            if (g.isExploded) {
                this.activeGrenades.splice(i, 1);
            }
        }

        // Update Fire Fields
        const fireDamage = CONFIG.PLAYER.BARREL.FIRE_DAMAGE * deltaTime;
        for (let i = this.activeFireFields.length - 1; i >= 0; i--) {
            const fire = this.activeFireFields[i];
            fire.update(deltaTime);
            if (fire.isExpired) {
                this.activeFireFields.splice(i, 1);
                continue;
            }

            // Damage player
            if (fire.checkCollision(this.player.mesh.position)) {
                this.player.takeDamage(fireDamage, true);
            }

            // Damage enemies
            this.enemies.forEach(enemy => {
                if (fire.checkCollision(enemy.mesh.position)) {
                    enemy.takeDamage(fireDamage);
                }
            });

            // Ignite gas leaks if fire field overlaps
            this.activeGasLeaks.forEach(leak => {
                if (!leak.isExploded && fire.checkCollision(leak.position)) {
                    this.handleGasIgnite(leak);
                }
            });
        }

        // Update Gas Leaks
        for (let i = this.activeGasLeaks.length - 1; i >= 0; i--) {
            const leak = this.activeGasLeaks[i];
            leak.update(deltaTime);
            if (leak.isExpired) {
                this.activeGasLeaks.splice(i, 1);
            }
        }

        // Update Smoke Screens
        for (let i = this.activeSmokeScreens.length - 1; i >= 0; i--) {
            const smoke = this.activeSmokeScreens[i];
            smoke.update(deltaTime);
            if (smoke.isExpired) {
                this.activeSmokeScreens.splice(i, 1);
            }
        }

        // Update Controls
        let rotation = 0;
        if (this.gameState === 'PLAYING') {
            rotation = this.cameraController.update();
            const walls = this.map ? this.map.walls : [];
            this.playerController.update(deltaTime, rotation, walls);
        } else {
            this.cameraController.update(); 
        }

        // Apply camera shake AFTER controller update
        if (this.shakeAmount > 0) {
            this.camera.position.x += (Math.random() - 0.5) * this.shakeAmount;
            this.camera.position.y += (Math.random() - 0.5) * this.shakeAmount;
            this.camera.position.z += (Math.random() - 0.5) * this.shakeAmount;
            
            // Decay shake
            this.shakeAmount *= 0.85; 
            if (this.shakeAmount < 0.001) this.shakeAmount = 0;
        }

        // Determine current chamber index based on player position
        const curPos = this.player.mesh.position;
        const detectedChamber = this.map.chambers.find(c => 
            Math.abs(curPos.x - c.x) < c.size / 2 + 5 && 
            Math.abs(curPos.z - c.z) < c.size / 2 + 5
        );
        this.currentChamberIndex = detectedChamber ? detectedChamber.index : null;

        // Player state for swaying/bobbing
        const isMoving = this.playerController.velocity.x !== 0 || this.playerController.velocity.z !== 0;
        this.player.update(deltaTime, isMoving, this.mouseDelta);
        
        // Reset mouse delta after passing it to player update
        this.mouseDelta = { x: 0, y: 0 };

        // Spawn Enemies
        const activeEnemies = this.enemies.filter(e => !e.isDead && !e.isAlly).length;
        const currentSpawnRate = Math.max(2000, CONFIG.ENEMY.SPAWN_RATE - (this.heatLevel - 1) * CONFIG.HEAT.SPAWN_RATE_REDUCTION_PER_LEVEL);
        
        if (activeEnemies < (CONFIG.ENEMY.MAX_ACTIVE || 15) && Date.now() - this.lastEnemySpawn > currentSpawnRate) {
            this.spawnEnemy();
            this.lastEnemySpawn = Date.now();
        }

        // Update Extraction Portal
        if (this.map.extractionPortal && this.map.extractionPortal.mesh.visible) {
            this.map.extractionPortal.update(deltaTime);
            const dist = this.player.mesh.position.distanceTo(this.map.extractionPortal.mesh.position);
            if (dist < 3 && this.gameState === 'PLAYING') {
                this.showExtractionScreen();
            }
        }

        this.checkAndSpawnPickups();

        // Update Pickups
        let playedPickupSoundInFrame = false;
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const pickup = this.pickups[i];
            pickup.update(deltaTime, this.player.mesh.position);
            if (pickup.isCollected) {
                if (pickup instanceof HealthPack) {
                    this.player.heal(CONFIG.PICKUPS.HEALTH_AMOUNT);
                } else if (pickup instanceof AmmoCrate) {
                    this.player.replenishAmmo(pickup.type);
                } else if (pickup instanceof CreditChip) {
                    this.scrap += pickup.value;
                    if (!playedPickupSoundInFrame) {
                        try { this.successSynth?.triggerAttackRelease("C5", "32n"); } catch (e) {}
                        playedPickupSoundInFrame = true;
                    }
                    this.player.updateUI();
                } else if (pickup instanceof DataCore) {
                    this.techCores += pickup.value;
                    if (!playedPickupSoundInFrame) {
                        try { this.successSynth?.triggerAttackRelease("G6", "16n"); } catch (e) {}
                        playedPickupSoundInFrame = true;
                    }
                    this.player.updateUI();
                    this.showProgressionMessage(`LEGENDARY DATA CORE RECOVERED: +${pickup.value} CORES`);
                }
                pickup.destroy();
                this.pickups.splice(i, 1);
            }
        }

        // Update Chamber HUD
        this.updateChamberHUD();

        // Update Turrets
        for (let i = this.turrets.length - 1; i >= 0; i--) {
            const turret = this.turrets[i];
            turret.update(deltaTime, this.enemies);
            if (turret.isDead) {
                this.turrets.splice(i, 1);
            }
        }

        // Reset enemy transient factors before update
        this.player.isPhased = false; // Reset player phase
        this.enemies.forEach(e => {
            if (!e.isAlly) {
                e.gravityWellFactor = 1.0;
                e.timeScale = 1.0;
                e.resonanceOwner = null;
            } else {
                e.isPhased = false; // Reset ally drone phase
            }
        });

        // Update Enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            // Register in spatial grid if alive - Throttle indexing to every 4 frames per enemy
            if (!enemy.isDead) {
                if ((this.frameCounter + i) % 4 === 0) {
                    this.spatialGrid.updateEntity(enemy);
                }
            } else {
                this.spatialGrid.removeEntity(enemy);
            }

            enemy.update(deltaTime, this.player.mesh.position, this.activeSmokeScreens, this.player.isThermalActive, this.enemies, this.turrets, this.map, this.spatialGrid);
            
            // Update Boss UI if this is the final boss
            if (this.finalBossAlive && enemy.type === 'HEAVY_SEC_BOT' && this.currentChamberIndex === CONFIG.MAP.NUM_ROOMS - 1) {
                this.updateBossHealthUI(enemy);
            }

            if (enemy.isDead && (enemy.deathTimer === undefined || enemy.deathTimer <= 0)) {
                this.enemies.splice(i, 1);
            }
        }

        // Periodically refresh raycast targets to account for enemy movement and destruction
        if (this.frameCounter % 30 === 0) {
            this.refreshRaycastTargets();
        }

        // --- Audio Proximity Updates (Throttled) ---
        if (this.frameCounter % 5 === 0) {
            if (this.hazardHiss) {
                let maxHiss = -100;
                // Check hazards from map in vicinity
                const currentHazards = (this.map.hazards || []).filter(h => {
                   const hPos = h.position || (h.group ? h.group.position : (h.mesh ? h.mesh.position : null));
                   return hPos && hPos.distanceToSquared(this.player.mesh.position) < 400; // 20m range
                });

                [...this.activeGasLeaks, ...currentHazards].forEach(h => {
                    const hPos = h.position || (h.group ? h.group.position : (h.mesh ? h.mesh.position : null));
                    if (!hPos) return;
                    const d = this.player.mesh.position.distanceTo(hPos);
                    if (d < 10) {
                        const vol = THREE.MathUtils.lerp(-100, -35, 1.0 - (d / 10));
                        maxHiss = Math.max(maxHiss, vol);
                    }
                });
                this.hazardHiss.volume.rampTo(maxHiss, 0.2);
            }

            if (this.shieldHum) {
                let maxHum = -100;
                // Player shield
                if (this.player.hasProjectedShield) maxHum = -35;
                // Enemy shields in vicinity
                this.enemies.forEach(e => {
                    if (!e.isDead && (e.shieldHealth > 0 || e.hasProjectedShield)) {
                        const dSq = this.player.mesh.position.distanceToSquared(e.mesh.position);
                        if (dSq < 64) { // dist < 8
                            const d = Math.sqrt(dSq);
                            const vol = THREE.MathUtils.lerp(-100, -40, 1.0 - (d / 8));
                            maxHum = Math.max(maxHum, vol);
                        }
                    }
                });
                this.shieldHum.volume.rampTo(maxHum, 0.2);
            }

            if (this.portalRumble) {
                let portalVol = -100;
                if (this.map.extractionPortal && this.map.extractionPortal.mesh.visible) {
                    const dist = this.player.mesh.position.distanceTo(this.map.extractionPortal.mesh.position);
                    if (dist < 15) {
                        portalVol = THREE.MathUtils.lerp(-100, -20, 1.0 - (dist / 15));
                    }
                }
                this.portalRumble.volume.rampTo(portalVol, 0.3);
            }
        }
    }

    updateHeatVisuals(deltaTime) {
        const visualConfig = CONFIG.HEAT.VISUALS;
        const heatFactor = (this.heatLevel - 1) / (CONFIG.HEAT.MAX_LEVEL - 1);
        
        // 1. Interpolate Fog Color and Density
        const fogColorStart = new THREE.Color(visualConfig.FOG_COLOR_START);
        const fogColorEnd = new THREE.Color(visualConfig.FOG_COLOR_END);
        this.heatVisuals.targetFogColor.copy(fogColorStart).lerp(fogColorEnd, heatFactor);
        this.heatVisuals.currentFogColor.lerp(this.heatVisuals.targetFogColor, deltaTime * 0.5);
        
        if (this.scene.fog) {
            this.scene.fog.color.copy(this.heatVisuals.currentFogColor);
            this.scene.background.copy(this.heatVisuals.currentFogColor);
            
            const targetDensity = 0.02 + (visualConfig.FOG_DENSITY_MAX - 0.02) * heatFactor;
            this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, targetDensity, deltaTime * 0.5);
        }
        
        // 2. Interpolate Ambient Light
        this.heatVisuals.targetAmbientIntensity = visualConfig.AMBIENT_INTENSITY_START + 
            (visualConfig.AMBIENT_INTENSITY_END - visualConfig.AMBIENT_INTENSITY_START) * heatFactor;
        
        this.scene.children.forEach(child => {
            if (child instanceof THREE.AmbientLight) {
                child.intensity = THREE.MathUtils.lerp(child.intensity, this.heatVisuals.targetAmbientIntensity, deltaTime * 0.5);
            }
        });

        // 3. Screen-space Filters (CSS)
        const filters = visualConfig.COLOR_FILTERS;
        const contrast = THREE.MathUtils.lerp(filters.CONTRAST_START, filters.CONTRAST_END, heatFactor);
        const hueRotate = THREE.MathUtils.lerp(filters.HUE_ROTATE_START, filters.HUE_ROTATE_END, heatFactor);
        const saturate = THREE.MathUtils.lerp(filters.SATURATE_START, filters.SATURATE_END, heatFactor);
        
        if (this.renderer.domElement) {
            this.renderer.domElement.style.filter = `contrast(${contrast}%) hue-rotate(${hueRotate}deg) saturate(${saturate}%)`;
        }

        // 4. Glitch and Vignette
        const vignette = document.getElementById('heat-vignette');
        if (vignette) {
            const vignetteOpacity = heatFactor * 0.5;
            vignette.style.boxShadow = `inset 0 0 ${100 + heatFactor * 200}px rgba(255, 0, 0, ${vignetteOpacity})`;
        }

        const glitchOverlay = document.getElementById('heat-glitch-overlay');
        if (glitchOverlay) {
            // Decaying glitch intensity
            this.heatVisuals.glitchIntensity = Math.max(0, this.heatVisuals.glitchIntensity - deltaTime * 1.5);
            
            // Base glitch level from heat
            const baseGlitch = heatFactor * 0.15;
            const totalGlitch = Math.min(1.0, baseGlitch + this.heatVisuals.glitchIntensity);
            
            glitchOverlay.style.opacity = totalGlitch;
            if (totalGlitch > 0.05) {
                glitchOverlay.style.animation = `glitch-flicker ${0.5 - heatFactor * 0.3}s infinite`;
            } else {
                glitchOverlay.style.animation = 'none';
            }
        }
    }

    showExtractionScreen() {
        if (this.gameState === 'EXTRACTION') return;
        this.gameState = 'EXTRACTION';
        document.exitPointerLock();

        const screen = document.getElementById('extraction-screen');
        const chambersEl = document.getElementById('extract-chambers');
        const scoreEl = document.getElementById('extract-score');
        const metaEl = document.getElementById('extract-meta');
        const totalEl = document.getElementById('meta-total');

        const chambersBreached = this.currentChamberIndex + 1;
        const totalChambers = CONFIG.MAP.NUM_ROOMS;
        
        // Calculate meta-credits: 10% of score + bonus for full clear
        const metaEarned = Math.floor(this.player.score * 0.1) + (chambersBreached === totalChambers ? 500 : 0);
        this.metaCredits += metaEarned;
        localStorage.setItem('chamber_breach_meta_credits', this.metaCredits.toString());

        if (chambersEl) chambersEl.innerText = `${chambersBreached} / ${totalChambers}`;
        if (scoreEl) scoreEl.innerText = this.player.score.toLocaleString();
        if (metaEl) metaEl.innerText = `+ ${metaEarned.toLocaleString()}`;
        if (totalEl) totalEl.innerText = `TOTAL PERSISTENT CREDITS: ${this.metaCredits.toLocaleString()}`;

        // Populate Meta-Upgrade Breakdown
        const breakdownEl = document.getElementById('extract-meta-breakdown');
        if (breakdownEl) {
            breakdownEl.innerHTML = '';
            this.META_UPGRADES.forEach(upgrade => {
                const level = this.metaUpgrades[upgrade.id] || 0;
                const bonusText = this.getUpgradeBonusText(upgrade.id, level);
                const item = document.createElement('div');
                item.style.color = level > 0 ? '#00ffff' : '#444';
                item.innerHTML = `
                    <span style="opacity: 0.5;">[${upgrade.name}]</span><br>
                    LVL ${level} ${level > 0 ? '» ' + bonusText : ''}
                `;
                breakdownEl.appendChild(item);
            });
        }

        if (screen) screen.style.display = 'flex';
        
        const now = this.Tone ? this.Tone.now() : undefined;
        this.successSynth?.triggerAttackRelease("C5", "4n", now);
    }

    getUpgradeBonusText(id, level) {
        if (level === 0) return "";
        switch(id) {
            case 'health': return `+${level * 20} HP`;
            case 'ammo': return `+${level} MAGS`;
            case 'cores': return `+${level} CORES`;
            case 'scrap': return `+${level * 100} SCRAP`;
            default: return "";
        }
    }

    showDeathScreen() {
        if (this.gameState === 'DEAD') return;
        this.gameState = 'DEAD';
        document.exitPointerLock();

        const screen = document.getElementById('death-screen');
        const chambersEl = document.getElementById('death-chambers');
        const scoreEl = document.getElementById('death-score');
        const scrapLostEl = document.getElementById('death-scrap-lost');

        const chambersBreached = this.currentChamberIndex + 1;
        const totalChambers = CONFIG.MAP.NUM_ROOMS;

        if (chambersEl) chambersEl.innerText = `${chambersBreached} / ${totalChambers}`;
        if (scoreEl) scoreEl.innerText = this.player.score.toLocaleString();
        if (scrapLostEl) scrapLostEl.innerText = this.scrap.toLocaleString();

        // Populate Death Meta Breakdown
        const breakdownEl = document.getElementById('death-meta-breakdown');
        if (breakdownEl) {
            breakdownEl.innerHTML = '';
            this.META_UPGRADES.forEach(upgrade => {
                const level = this.metaUpgrades[upgrade.id] || 0;
                const bonusText = this.getUpgradeBonusText(upgrade.id, level);
                const item = document.createElement('div');
                item.style.color = level > 0 ? '#ff3300' : '#442222';
                item.innerHTML = `
                    <span style="opacity: 0.5;">[${upgrade.name}]</span><br>
                    LVL ${level} ${level > 0 ? '» ' + bonusText : ''}
                `;
                breakdownEl.appendChild(item);
            });
        }

        if (screen) screen.style.display = 'flex';
        
        // Play death sound
        const now = this.Tone ? this.Tone.now() : undefined;
        this.impactSynth?.triggerAttackRelease("C2", "2n", now);
        if (this.shootSynth) {
            this.shootSynth.triggerAttackRelease("1n", now);
        }

        // Add a red flicker effect to the screen
        const overlay = document.getElementById('death-glitch-overlay');
        if (overlay) {
            let flickerCount = 0;
            const flickerInterval = setInterval(() => {
                overlay.style.opacity = Math.random() * 0.2;
                if (++flickerCount > 20) clearInterval(flickerInterval);
            }, 50);
        }
    }

    resetHeatVisuals() {
        this.heatVisuals = {
            targetFogColor: new THREE.Color(CONFIG.HEAT.VISUALS.FOG_COLOR_START),
            currentFogColor: new THREE.Color(CONFIG.HEAT.VISUALS.FOG_COLOR_START),
            targetAmbientIntensity: CONFIG.HEAT.VISUALS.AMBIENT_INTENSITY_START,
            currentAmbientIntensity: CONFIG.HEAT.VISUALS.AMBIENT_INTENSITY_START,
            glitchIntensity: 0
        };

        if (this.renderer.domElement) {
            this.renderer.domElement.style.filter = 'none';
        }
        
        const vignette = document.getElementById('heat-vignette');
        if (vignette) vignette.style.boxShadow = 'none';
        
        const glitchOverlay = document.getElementById('heat-glitch-overlay');
        if (glitchOverlay) {
            glitchOverlay.style.opacity = '0';
            glitchOverlay.style.animation = 'none';
        }
    }

    resetMission() {
        // Reset non-persistent stats
        this.scrap = 0;
        this.techCores = this.metaUpgrades.cores || 0; // Respect starting cores upgrade
        this.currentChamberIndex = 0;
        this.finalBossSpawned = false;
        this.finalBossAlive = false;
        this.chamberClearingStatus = 'ACTIVE';
        this.heatLevel = 1;
        this.resetHeatVisuals();

        // Reset player
        this.player.health = this.player.maxHealth;
        this.player.isDead = false;
        this.player.score = 0;
        this.player.mesh.position.set(0, 1, 0);
        this.player.updateUI();

        // Clear scene objects
        this.enemies.forEach(e => {
            if (e.mesh.parent) this.scene.remove(e.mesh);
        });
        this.enemies = [];

        this.turrets.forEach(t => {
            if (t.mesh.parent) this.scene.remove(t.mesh);
        });
        this.turrets = [];

        this.pickups.forEach(p => {
            if (p.mesh.parent) this.scene.remove(p.mesh);
        });
        this.pickups = [];

        this.activeGrenades.forEach(g => {
            if (g.mesh.parent) this.scene.remove(g.mesh);
        });
        this.activeGrenades = [];

        // Clear hazards and environmental effects
        this.activeFireFields.forEach(f => {
            if (f.mesh.parent) this.scene.remove(f.mesh);
        });
        this.activeFireFields = [];

        this.activeGasLeaks.forEach(l => {
            if (l.mesh.parent) this.scene.remove(l.mesh);
        });
        this.activeGasLeaks = [];

        this.activeSmokeScreens.forEach(s => {
            if (s.mesh.parent) this.scene.remove(s.mesh);
        });
        this.activeSmokeScreens = [];

        // Hide UI screens
        document.getElementById('death-screen').style.display = 'none';
        document.getElementById('ui').style.opacity = '0';

        // Return to facility selection
        this.showFacilitySelection();
        this.successSynth?.triggerAttackRelease("G4", "8n");
    }

    showFacilitySelection() {
        this.gameState = 'FACILITY_SCREEN';
        const facilityScreen = document.getElementById('facility-screen');
        if (facilityScreen) facilityScreen.style.display = 'flex';
        this.updateFacilityGrid();
        
        const creditsDisplay = document.getElementById('global-meta-credits');
        if (creditsDisplay) creditsDisplay.innerText = `META-CREDITS: ${this.metaCredits.toLocaleString()}`;
    }

    performProximityChecks() {
        if (!this.player || !this.player.mesh) return;
        const playerPos = this.player.mesh.position;

        // Terminal proximity
        let nearTerminal = false;
        for (const terminal of this.map.terminals) {
            if (terminal && !terminal.isUsed) {
                if (playerPos.distanceToSquared(terminal.mesh.position) < 9) { // dist < 3
                    nearTerminal = true;
                    break;
                }
            }
        }
        const termPrompt = document.getElementById('terminal-prompt');
        if (termPrompt) termPrompt.style.display = nearTerminal ? 'block' : 'none';

        // Shop proximity
        let nearShop = false;
        for (const shopTerm of this.map.shopTerminals) {
            if (playerPos.distanceToSquared(shopTerm.mesh.position) < 9) {
                nearShop = true;
                break;
            }
        }
        const shopPrompt = document.getElementById('shop-prompt');
        if (shopPrompt) shopPrompt.style.display = nearShop ? 'block' : 'none';

        // Turret proximity
        let nearTurret = false;
        for (const t of this.turrets) {
            if (playerPos.distanceToSquared(t.mesh.position) < 9) {
                nearTurret = true;
                break;
            }
        }
        const turretPrompt = document.getElementById('turret-prompt');
        if (turretPrompt) turretPrompt.style.display = nearTurret ? 'block' : 'none';

        // Hack proximity - Using spatial grid
        let canHack = false;
        const nearby = this.spatialGrid.getNearby(playerPos, 3);
        for (let i = 0; i < nearby.length; i++) {
            const e = nearby[i];
            if (e.isDisabled && !e.isAlly && !e.isDead) {
                if (playerPos.distanceToSquared(e.mesh.position) < 9) {
                    canHack = true;
                    break;
                }
            }
        }
        const hackPrompt = document.getElementById('hack-prompt');
        if (hackPrompt) hackPrompt.style.display = (canHack && !this.isHacking) ? 'block' : 'none';
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const deltaTime = this.clock.getDelta();
        this.update(deltaTime);
        this.renderer.render(this.scene, this.camera);
    }

    loadMetaState() {
        const savedCredits = localStorage.getItem('chamber_breach_meta_credits');
        if (savedCredits) this.metaCredits = parseInt(savedCredits);

        const savedCores = localStorage.getItem('chamber_breach_meta_cores');
        if (savedCores) this.techCores = parseInt(savedCores);

        const savedUpgrades = localStorage.getItem('chamber_breach_meta_upgrades');
        if (savedUpgrades) {
            try {
                const parsed = JSON.parse(savedUpgrades);
                Object.assign(this.metaUpgrades, parsed);
            } catch (e) {
                console.error("Failed to parse meta upgrades:", e);
            }
        }
    }

    saveMetaState() {
        localStorage.setItem('chamber_breach_meta_credits', this.metaCredits.toString());
        localStorage.setItem('chamber_breach_meta_cores', this.techCores.toString());
        localStorage.setItem('chamber_breach_meta_upgrades', JSON.stringify(this.metaUpgrades));
    }

    initMetaStoreEvents() {
        const openBtn = document.getElementById('open-meta-store-btn');
        const closeBtn = document.getElementById('meta-store-close-btn');
        const panel = document.getElementById('meta-store-panel');

        if (openBtn) {
            openBtn.onclick = () => {
                panel.style.transform = 'translateX(0)';
                this.renderMetaStore();
                this.successSynth?.triggerAttackRelease("G4", "16n");
            };
        }

        if (closeBtn) {
            closeBtn.onclick = () => {
                panel.style.transform = 'translateX(-100%)';
            };
        }
    }

    renderMetaStore() {
        const list = document.getElementById('meta-upgrades-list');
        const creditsDisplay = document.getElementById('global-meta-credits');
        if (creditsDisplay) creditsDisplay.innerText = `META-CREDITS: ${this.metaCredits.toLocaleString()}`;
        if (!list) return;

        list.innerHTML = '';
        this.META_UPGRADES.forEach(upgrade => {
            const currentLevel = this.metaUpgrades[upgrade.id] || 0;
            const cost = upgrade.baseCost * (currentLevel + 1);
            const isMaxed = currentLevel >= upgrade.max;
            
            const card = document.createElement('div');
            card.className = 'facility-card';
            card.style.borderColor = isMaxed ? '#555' : '#ffff00';
            card.style.background = 'rgba(255, 255, 0, 0.05)';
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div class="name" style="color: #ffff00;">${upgrade.name}</div>
                        <div class="desc" style="color: #aaa; margin-top: 5px;">${upgrade.desc}</div>
                    </div>
                    <div style="text-align: right; color: #ffff00;">
                        LVL ${currentLevel} / ${upgrade.max}
                    </div>
                </div>
                <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="color: #ffff00; font-size: 14px;">${isMaxed ? 'MAX LEVEL' : `COST: ${cost.toLocaleString()} MC`}</div>
                    <button class="upgrade-btn" ${isMaxed || this.metaCredits < cost ? 'disabled style="opacity:0.3; cursor:default;"' : ''} 
                            style="padding: 8px 20px; border-color: #ffff00; color: #ffff00; cursor: pointer;">
                        ${isMaxed ? 'MAXED' : 'UPGRADE'}
                    </button>
                </div>
            `;
            
            const btn = card.querySelector('button');
            if (!isMaxed && this.metaCredits >= cost) {
                btn.onclick = () => this.buyMetaUpgrade(upgrade, cost);
            }
            
            list.appendChild(card);
        });
    }

    buyMetaUpgrade(upgrade, cost) {
        if (this.metaCredits < cost) return;
        
        this.metaCredits -= cost;
        this.metaUpgrades[upgrade.id] = (this.metaUpgrades[upgrade.id] || 0) + 1;
        this.saveMetaState();
        this.renderMetaStore();
        
        this.successSynth?.triggerAttackRelease("C5", "8n");
        setTimeout(() => this.successSynth?.triggerAttackRelease("E5", "16n"), 50);
    }

    applyMetaUpgrades() {
        // Apply persistent bonuses to player
        if (this.metaUpgrades.health > 0) {
            const bonus = this.metaUpgrades.health * 20;
            this.player.maxHealth += bonus;
            this.player.health = this.player.maxHealth;
        }

        if (this.metaUpgrades.cores > 0) {
            this.techCores += this.metaUpgrades.cores;
        }

        if (this.metaUpgrades.scrap > 0) {
            this.scrap += this.metaUpgrades.scrap * 100;
        }
        
        // Starting ammo will be applied in player weapon logic
        if (this.metaUpgrades.ammo > 0) {
            this.player.bonusMags = this.metaUpgrades.ammo;
            // Refill ammo with bonus mags
            this.player.weapons.RIFLE.magazine = this.player.weapons.RIFLE.MAGAZINE_SIZE;
            this.player.weapons.RIFLE.reserve = this.player.weapons.RIFLE.MAGAZINE_SIZE * (2 + this.player.bonusMags);
            this.player.weapons.SNIPER.magazine = this.player.weapons.SNIPER.MAGAZINE_SIZE;
            this.player.weapons.SNIPER.reserve = this.player.weapons.SNIPER.MAGAZINE_SIZE * (2 + this.player.bonusMags);
        }

        this.player.updateUI();
    }

    initAchievementGalleryEvents() {
        const openBtn = document.getElementById('open-achievement-gallery-btn');
        const closeBtn = document.getElementById('achievement-gallery-close-btn');
        const panel = document.getElementById('achievement-gallery-panel');

        if (openBtn) {
            openBtn.onclick = () => {
                panel.style.display = 'flex';
                this.renderAchievementGallery();
                this.successSynth?.triggerAttackRelease("G4", "16n");
            };
        }

        if (closeBtn) {
            closeBtn.onclick = () => {
                panel.style.display = 'none';
            };
        }
    }

    renderAchievementGallery() {
        const list = document.getElementById('achievement-list');
        if (!list) return;

        const allAchievements = [
            { id: 'FIRST_BREACH', name: 'GHOST IN THE MACHINE', desc: 'Successfully breach your first chamber.' },
            { id: 'TITAN SLAYER', name: 'TITAN SLAYER', desc: 'Defeat the Heavy Security Titan in Room 50.' },
            { id: 'DRONE_LORD', name: 'DRONE LORD', desc: 'Fully upgrade a drone with 5 modules.' },
            { id: 'NETWORK_GHOST', name: 'NETWORK GHOST', desc: 'Extract with over 10,000 data packets.' }
        ];

        const unlocked = JSON.parse(localStorage.getItem('chamber_breach_achievements') || '[]');

        list.innerHTML = '';
        allAchievements.forEach(ach => {
            const isUnlocked = unlocked.includes(ach.id);
            const item = document.createElement('div');
            item.className = 'facility-card';
            item.style.borderColor = isUnlocked ? '#ffff00' : '#333';
            item.style.opacity = isUnlocked ? '1' : '0.5';
            item.style.background = isUnlocked ? 'rgba(255, 255, 0, 0.1)' : 'rgba(0, 0, 0, 0.5)';
            
            item.innerHTML = `
                <div class="name" style="color: ${isUnlocked ? '#ffff00' : '#555'}; font-size: 16px;">${ach.name}</div>
                <div class="desc" style="color: #aaa; font-size: 11px; margin-top: 5px;">${ach.desc}</div>
                <div style="margin-top: 10px; font-size: 10px; color: ${isUnlocked ? '#ffff00' : '#444'}; text-align: right;">
                    ${isUnlocked ? 'SECURED' : 'LOCKED'}
                </div>
            `;
            list.appendChild(item);
        });
    }
}
