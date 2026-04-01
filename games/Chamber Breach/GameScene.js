import * as THREE from 'three';
import { Navigation } from './Navigation.js';
import { PlayerController, FirstPersonCameraController } from './rosie/controls/rosieControls.js';
import { CONFIG } from './config.js';
import { GameMap } from './Map.js';
import { Turret } from './Turret.js';
import { Player } from './Player.js';
import { Enemy } from './Enemy.js';
import { EnemyPool } from './EnemyPool.js';
import { ProjectilePool } from './ProjectilePool.js';
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
import { adService } from './AdService.js';

import { NeuralDisruptor } from './NeuralDisruptor.js';
import { Bullet } from './Bullet.js';
import { PerkManager } from './PerkManager.js';
import { RoguelikeManager } from './RoguelikeManager.js';
import { LootManager } from './LootManager.js';
import { AbilityManager } from './AbilityManager.js';
import { EventManager } from './EventManager.js';
import { DailyChallengeManager } from './DailyChallengeManager.js';

export class GameScene {
    constructor() {
        // Cleanup existing game instance before creating a new one
        if (window.game) {
            console.log('Cleaning up existing game instance...');
            window.game.isShuttingDown = true; // Signal the animation loop to stop
            if (window.game.renderer) {
                try {
                    window.game.renderer.dispose();
                    if (window.game.renderer.domElement && window.game.renderer.domElement.parentNode) {
                        window.game.renderer.domElement.parentNode.removeChild(window.game.renderer.domElement);
                    }
                } catch (e) {
                    console.warn('Error during previous renderer disposal:', e);
                }
            }
        }

        // Carry over pools from previous instance for cross-mission recycling
        this._inheritedEnemyPool = window.game?.enemyPool || null;
        this._inheritedProjectilePool = window.game?.projectilePool || null;
        
        window.game = this; // Make accessible early											
        this.isShuttingDown = false;
        this.adService = adService;
        this.adService.init();
        this.init();
    }

    init() {
        // Remove any orphaned canvases that might be hanging around
        const existingCanvases = document.querySelectorAll('canvas');
        existingCanvases.forEach(canvas => {
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        });

        this.gameState = 'START_SCREEN';
        this.score = 0;
        this.highScore = localStorage.getItem('chamber_breach_highscore') || 0;
        this.credits = 0;
        this.techCores = 0;
        this.scrap = 0;
        this.insaneMomentActive = false;
        this.lastHitSoundTime = 0;
        
        this.targetTimeScale = 1.0;
        this.timeScale = 1.0;
        this.hitSlowdownTimer = 0;
        this.chromaticAberration = 0;
        this.bloomIntensity = 1.0;
        this.saturation = 1.0;
        this.rippleIntensity = 0;
        this.shockwaveTime = 0;
        this.shockwaveDuration = 1.0;
        this.shockwaveActive = false;
        this.shockwaveKickIntensity = 0;
        this.radialBlurIntensity = 0;
        this.lastFilterString = '';
        
        
        // Meta Progression
        this.metaCredits = 0;
        this.loreRecoveredCount = 0;
        this.facilityAccentColor = new THREE.Color(0x00d0ff); 
        this.metaUpgrades = {
            health: 0,
            ammo: 0,
            cores: 0,
            scrap: 0,
            scrap_scavenger: 0,
            drone_efficiency: 0,
            tactical_scanner: 0,
            rifle_ricochet: 0,
            rifle_pierce: 0,
            sniper_pierce: 0,
            sniper_recall: 0,
            synergy_duration: 0,
            synergy_potency: 0,
            omega_turret_mastery: 0,
            flash_freeze_mastery: 0
        };
        this.META_UPGRADES = [
            { id: 'health', name: 'Starting HP', desc: 'Persistent integrity reinforcement (+20 HP).', baseCost: 1000, max: 10 },
            { id: 'ammo', name: 'Reserve Ammo', desc: 'Expanded magazine storage for all systems (+1 mag).', baseCost: 1500, max: 5 },
            { id: 'cores', name: 'Initial Cores', desc: 'Pre-load tactical hacking cores (+1 Core).', baseCost: 3000, max: 3 },
            { id: 'scrap', name: 'Starting Credits', desc: 'Secure initial black market funds (+100 Scrap).', baseCost: 1200, max: 5 },
            { id: 'scrap_scavenger', name: 'Credit Siphon', desc: 'Harvest 25% more scrap from neutralized units.', baseCost: 2500, max: 4 },
            { id: 'drone_efficiency', name: 'Neural Link++', desc: 'Hacked drones gain +25% combat efficiency (HP/DMG).', baseCost: 4000, max: 2 },
            { id: 'tactical_scanner', name: 'Pulse Scanner', desc: 'Increase tactical radar range and detection sensitivity.', baseCost: 3500, max: 3 },
            { id: 'rifle_ricochet', name: 'Vector Bounce', desc: 'Permanent Rifle modification: Rounds ricochet off hard surfaces once.', baseCost: 5000, max: 1 },
            { id: 'rifle_pierce', name: 'Armor Piercing', desc: 'Permanent Rifle modification: Deals 3x damage to armored units.', baseCost: 7000, max: 1 },
            { id: 'sniper_pierce', name: 'Linear Accelerator', desc: 'Permanent Sniper modification: Rounds penetrate +1 target per level.', baseCost: 6000, max: 3 },
            { id: 'sniper_recall', name: 'Data Salvage', desc: 'Permanent Sniper modification: 50% chance to return ammo on hit.', baseCost: 8000, max: 1 },
            { id: 'synergy_duration', name: 'Core Stability', desc: 'Increase Emergency Shield duration by 2s per level.', baseCost: 4500, max: 5 },
            { id: 'synergy_potency', name: 'Synergy Amplify', desc: 'Increase potency of Vampiric and Static synergies by 20%.', baseCost: 5500, max: 5 },
            { id: 'omega_turret_mastery', name: 'Omega Protocol', desc: 'Unlocks Omega Sentry deployment via Thermal Overdrive.', baseCost: 12000, max: 1 },
            { id: 'flash_freeze_mastery', name: 'Cryo Mastery', desc: 'Unlocks Flash Freeze protocol for the Cryo-Extinguisher.', baseCost: 10000, max: 1 }
        ];
        this.loadMetaState();

        // Scene setup
        this.menuRenderAccumulator = 0;
        this.scene = new THREE.Scene();
        this.scene.game = this; // Expose game instance to entities
        this.scene.background = new THREE.Color(0x12141a);
        this.scene.fog = new THREE.FogExp2(0x12141a, 0.012); // Reduced fog density for better visibility

        // Particle System
        this.particleSystem = new ParticleSystem(this.scene);

        // Spatial Grid for performance optimization
        this.spatialGrid = new SpatialGrid(10);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
        this.scene.add(this.camera);

        // Renderer
        try {
            this.renderer = new THREE.WebGLRenderer({ 
                antialias: false, // Performance: Disabled antialiasing for GPU savings
                powerPreference: 'high-performance',
                precision: 'lowp' // Performance: Use lower precision for shaders
            });
        } catch (e) {
            console.warn('Standard WebGL creation failed, attempting fallback...', e);
            this.renderer = new THREE.WebGLRenderer();
        }
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(0.75); // Performance: keep default render resolution lower to avoid GPU saturation
        this.renderer.toneMappingExposure = 1.25;
        this.renderer.shadowMap.enabled = false; 
        this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.domElement.style.imageRendering = 'pixelated';
        this.renderer.domElement.tabIndex = 1; 
        document.body.appendChild(this.renderer.domElement);

        // Lights
        this.ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
        this.scene.add(this.ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
        sunLight.position.set(10, 20, 10);
        this.scene.add(sunLight);
        this.renderer.shadowMap.enabled = false;
        this.renderer.shadowMap.enabled = false;

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
            eyeHeight: CONFIG.PLAYER.EYE_HEIGHT,
            ceilingLevel: CONFIG.MAP.WALL_HEIGHT
        });
        this.cameraController.enable();
        this.playerController.setCameraMode('first-person');

        // Entities
        this.enemies = [];
        this.enemyPool = this.enemyPool || this._inheritedEnemyPool || new EnemyPool(); // Persist pool across missions
        
        // Projectiles
        this.projectilePool = this.projectilePool || this._inheritedProjectilePool || new ProjectilePool(this.scene);
        this.turrets = [];
        this.pickups = [];
        this.activeGrenades = [];
        this.disruptors = []; 
        this.grenadePool = [];
        this.empGrenadePool = [];
        this.disruptorPool = [];
        
        // Stack for fast O(1) acquisition from pools
        this.availableDisruptors = [];
        
        // Initializing pools with pre-warming
        for (let i = 0; i < 15; i++) {
            this.grenadePool.push(new Grenade(this.scene, this.particleSystem));
            this.empGrenadePool.push(new EMPGrenade(this.scene, this.particleSystem));
        }

        for (let i = 0; i < 10; i++) { // Increased pre-warm
            const d = new NeuralDisruptor(this.scene, this.particleSystem);
            this.disruptorPool.push(d);
            this.availableDisruptors.push(d);
        }

        this.activeFireFields = [];
        this.activeGasLeaks = [];
        this.activeSmokeScreens = [];
        this.lastEnemySpawn = performance.now() + 5000; // 5 second grace period at start
        this.lastPickupSpawnCheck = 0;

        // Audio State initialization for Arbiter safety
        this.audioWindows = {};
        this.lastPlayTime = {};

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
        this.difficultyMultiplier = 1.0;

        // Neural Sync state
        this.isNeuralSyncing = false;
        this.syncLevel = 0; // 0, 1, 2, 3
        this.ringRotations = [0, 0, 0];
        this.ringSpeeds = [120, -180, 240];
        this.ringLocked = [false, false, false];

        // Malfunction state
        this.isMalfunctioning = false;
        this.malfunctionTimer = 0;
        this.malfunctionDuration = 5.0; // seconds - longer biip

        this.dataOverloadActive = false;
        this.dataOverloadTimer = 0;

        // Terminal hacking state
        this.isTerminalMenuOpen = false;
        this.isShopOpen = false;
        this.isHackingTerminal = false;
        this.terminalHackProgress = 0;
        this.terminalHackDuration = 8.0; // Reduced for faster tactical flow
        this.currentTerminal = null;
        this.hackingWavesTriggered = [false, false, false]; // 0%, 33%, 66%
        this.finalBossSpawned = false;
        this.finalBossAlive = false;
        this.operatorName = localStorage.getItem('meridian_operator_name') || null;
        this.canRevive = true; // One revive per session
        
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
        this.initMinigameClickEvents(); // New helper

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
        this.introTypeSpeed = 15; // ms per char
        this.introLineDelay = 400; // ms between lines;

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
            if (this.adService.adInProgress) return; // Ignore input during ads
            if (this.gameState !== 'PLAYING') return;
            
            const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            if (document.pointerLockElement === this.renderer.domElement || isMobile) {
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
            if (this.adService.adInProgress) return; // Ignore input during ads
            if (this.gameState === 'INTRO') {
                if (e.code === 'Space') {
                    this.endIntro();
                    e.preventDefault();
                }
                return;
            }
            if (this.gameState !== 'PLAYING') return;
            // Handle Minigame Interactions
            if (this.isNeuralSyncing || this.isHacking) {
                if (e.code === 'Space') {
                    if (this.isNeuralSyncing) {
                        this.checkNeuralSyncHit();
                        e.preventDefault();
                        return;
                    }
                    if (this.isHacking) {
                        this.checkHackingHit();
                        e.preventDefault();
                        return;
                    }
                }
            }
			
            if (e.code === 'KeyR') {
                if (this.player.isAiming) {
                    this.player.secondaryShoot(
                        this.raycastTargets,
                        (pos, dir, type, isOmega) => {
                            const t = new Turret(this.scene, pos, dir, this.particleSystem, type, isOmega);
                            this.turrets.push(t);
                        },
                        this.enemies,
                        this.activeFireFields,
                        this.map.barrels,
                        this.map.hazards
                    );
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
            if (e.code === 'KeyC') {
                if (this.abilityManager) this.abilityManager.activate();
            }
            if (e.code === 'CapsLock') {
                if (this.abilityManager) this.abilityManager.cycle();
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
            if (e.code === 'KeyM') {
                this.triggerNeuralLinkMalfunction();
            }
            if (e.code === 'Escape') {
                if (this.isInventoryOpen) {
                    this.toggleInventory(false);
                } else if (this.isShopOpen) {
                    this.toggleShopMenu(false);
                } else if (this.isTerminalMenuOpen) {
                    this.toggleTerminalMenu(false);
                } else if (this.isTurretMenuOpen) {
                    this.toggleTurretMenu(false);
                } else if (this.isNeuralSyncing) {
                    this.completeNeuralSync(false);
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
                    // PERFORMANCE FIX: Cap active grenades to prevent unbounded growth
                    if (this.activeGrenades.length < 20) {
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
            }
            if (e.code === 'KeyF') {
                if (this.player.isAimingEMP) {
                    this.player.isAimingEMP = false;
                    // PERFORMANCE FIX: Cap active grenades to prevent unbounded growth
                    if (this.activeGrenades.length < 20) {
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
        // Perk & Roguelike Systems
        this.roguelikeManager = new RoguelikeManager(this);
        this.lootManager = new LootManager(this);
        this.abilityManager = new AbilityManager(this);
        this.eventManager = new EventManager(this);

        this.clock = new THREE.Clock();
        this._storageDirty = false;
        this._storageUpdateTimer = 0;
        this.frameCounter = 0; // Added for throttling
        this.startupGraceFrames = 180;
        this.startupWarmupActive = false;
        this.debugPerformanceLogging = false;
        
        this.consecutiveSpikes = 0;
        this.panicModeActive = false;
        this.panicModeCooldown = 0;
        this.panicModeFrames = 0;
        this.panicModeMinFrames = 30;
        this.panicModeMaxFrames = 90;
        this.cullingRadius = 2;
        this.lastSpikeMsThreshold = 250;
        this.lastRenderTime = 0;
        
        // Kill Streak state
        this.killStreak = 0;
        this.lastKillTime = 0;
        this.killStreakDuration = 5000; // 5 seconds to keep streak
        this.maxKillStreak = 0;

        this.dailyChallengeManager = new DailyChallengeManager(this);
        
        this.lastHUDValues = {
            score: -1,
            credits: -1,
            scrap: -1,
            techCores: -1,
            health: -1,
            maxHealth: -1,
            ammo: -1,
            reserve: -1,
            room: -1,
            heat: -1,
            killStreak: -1
        };

        this.enemyStatsCache = {
            frame: -1,
            aliveHostiles: 0,
            aliveAllies: 0,
            nearestAlly: null,
            nearbyShieldedEnemies: []
        };

        this.perfLimits = {
            maxEnemies: 18,
            maxPickups: 10,
            maxActiveGrenades: 12,
            maxFireFields: 8,
            maxGasLeaks: 6,
            maxSmokeScreens: 4,
            maxEnemyLogicUpdatesPerFrame: 6,
            maxHazardChecksPerFrame: 8
        };

        this.frameBuckets = {
            chamberCheck: 0,
            proximity: 0,
            radar: 0,
            hazard: 0,
            raycast: 0,
            lightCull: 0
        };

        this.currentChamberCache = {
            frame: -1,
            chamber: null
        };

        // Cache UI elements for interaction prompts
        this.uiPrompts = {
            terminal: document.getElementById('terminal-prompt'),
            shop: document.getElementById('shop-prompt'),
            turret: document.getElementById('turret-prompt'),
            hack: document.getElementById('hack-prompt'),
            lore: document.getElementById('lore-prompt')
        };

        this.animate();
    }

    bindMobileFriendlyClick(btn, callback) {
        if (!btn) return;
        btn.addEventListener('click', callback);
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            callback();
        });
    }

    initScreenEvents() {
        // ... (existing events)
        
        // Revive Ad Event
        const reviveAdBtn = document.getElementById('revive-ad-btn');
        if (reviveAdBtn) {
            this.bindMobileFriendlyClick(reviveAdBtn, () => {
                this.adService.showRewarded({
                    name: 'revive_player',
                    adViewed: () => {
                        this.revivePlayer();
                    }
                });
            });
        }

        // Emergency Shield Ad Event
        const shieldAdBtn = document.getElementById('emergency-shield-btn');
        if (shieldAdBtn) {
            this.bindMobileFriendlyClick(shieldAdBtn, () => {
                this.adService.showRewarded({
                    name: 'emergency_shield',
                    adViewed: () => {
                        this.activateEmergencyShield(10); // 10 seconds of invincibility
                    }
                });
            });
        }
        
        // Operator Registration
        const operatorScreen = document.getElementById('operator-screen');
        const operatorNameInput = document.getElementById('operator-name-input');
        const registerOperatorBtn = document.getElementById('register-operator-btn');
        const startScreen = document.getElementById('start-screen');
        const operatorHud = document.getElementById('operator-hud');

        const savedName = localStorage.getItem('meridian_operator_name');
        if (savedName) {
            this.operatorName = savedName;
            if (operatorHud) operatorHud.innerText = `OPERATOR: ${this.operatorName}`;
            startScreen.style.display = 'flex';
        } else {
            operatorScreen.style.display = 'flex';
            startScreen.style.display = 'none';
        }

        const handleRegister = () => {
            const name = operatorNameInput.value.trim();
            if (name.length >= 3) {
                this.operatorName = name;
                this._scheduleMetaSave?.();
                if (operatorHud) operatorHud.innerText = `OPERATOR: ${this.operatorName}`;
                operatorScreen.style.display = 'none';
                startScreen.style.display = 'flex';
                
                if (this.Tone) {
                    this.playUIConfirm();
                }
            } else {
                operatorNameInput.style.borderColor = '#ff4400';
                requestAnimationFrame(() => operatorNameInput.style.borderColor = '#00d0ff');
            }
        };

        this.bindMobileFriendlyClick(registerOperatorBtn, handleRegister);

        operatorNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleRegister();
        });

        const hubBtn = document.getElementById('back-to-hub-btn');
        if (hubBtn) {
            hubBtn.style.display = 'block'; // Ensure it's visible
            this.bindMobileFriendlyClick(hubBtn, () => {
                window.location.href = '/index.html';
            });
        }

        const startBtn = document.getElementById('start-btn');
        const skipAllBtn = document.getElementById('skip-all-btn');
        const deployBtn = document.getElementById('deploy-btn');
        const introScreen = document.getElementById('intro-screen');
        const skipIntroBtn = document.getElementById('skip-intro-btn');
        const facilityScreen = document.getElementById('facility-screen');
        const briefingScreen = document.getElementById('briefing-screen');
        const loadoutScreen = document.getElementById('loadout-screen');
        const loadoutBackBtn = document.getElementById('loadout-back-btn');
        const facilityGrid = document.getElementById('facility-grid');
        const facilityBackBtn = document.getElementById('facility-back-btn');
        const briefTopBackBtn = document.getElementById('brief-top-back-btn');
        const briefBackBtn = document.getElementById('brief-back-btn');
        const briefProceedBtn = document.getElementById('brief-proceed-btn');
        const extractReturnBtn = document.getElementById('extract-return-btn');
        const deathRestartBtn = document.getElementById('death-restart-btn');
        const extractLeaderboardBtn = document.getElementById('extract-leaderboard-btn');
        const deathLeaderboardBtn = document.getElementById('death-leaderboard-btn');
        const deathBackToMapBtn = document.getElementById('death-back-to-map-btn');
        const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');

        this.bindMobileFriendlyClick(extractLeaderboardBtn, () => this.showLeaderboard());
        this.bindMobileFriendlyClick(deathLeaderboardBtn, () => this.showLeaderboard());
        this.bindMobileFriendlyClick(deathBackToMapBtn, () => {
            this.hideAllScreens();
            facilityScreen.style.display = 'flex';
            this.gameState = 'FACILITY_SCREEN';
            this.updateFacilityGrid();
            this.playArbiterSound('ui', { type: 'success', note: "C4", duration: "8n" });
            
            // Clean up session state and hide HUD
            this.resetMission();
            const uiOverlay = document.getElementById('ui');
            if (uiOverlay) uiOverlay.style.opacity = '0';
            if (document.pointerLockElement) document.exitPointerLock();
        });
        this.bindMobileFriendlyClick(closeLeaderboardBtn, () => {
            document.getElementById('leaderboard-modal').style.display = 'none';
        });

        this.bindMobileFriendlyClick(extractReturnBtn, () => {
            location.reload(); // Simplest way to reset game state for now
        });

        this.bindMobileFriendlyClick(deathRestartBtn, () => {
            this.resetMission();
        });

        this.bindMobileFriendlyClick(startBtn, async () => {
            try {
                // Dynamic import to avoid top-level AudioContext creation
                const Tone = await import('tone');
                await Tone.start();
                await this.setupAudio(Tone); 
                console.log('Audio Context Resumed and Synths Initialized');
            } catch (err) {
                console.warn('Audio Context failed to start:', err);
            }
            this.hideAllScreens();
            this.startIntro();
        });

        this.bindMobileFriendlyClick(skipAllBtn, async () => {
            try {
                const Tone = await import('tone');
                await Tone.start();
                await this.setupAudio(Tone);
            } catch (err) {}
            this.hideAllScreens();
            this.gameState = 'INTRO'; 
            this.endIntro();
        });

        this.bindMobileFriendlyClick(skipIntroBtn, () => {
            this.endIntro();
        });

        this.bindMobileFriendlyClick(facilityBackBtn, () => {
            this.hideAllScreens();
            startScreen.style.display = 'flex';
            this.gameState = 'START_SCREEN';
        });

        this.bindMobileFriendlyClick(briefBackBtn, () => {
            this.hideAllScreens();
            facilityScreen.style.display = 'flex';
            this.gameState = 'FACILITY_SCREEN';
        });

        this.bindMobileFriendlyClick(briefTopBackBtn, () => {
            this.hideAllScreens();
            facilityScreen.style.display = 'flex';
            this.gameState = 'FACILITY_SCREEN';
        });

        this.bindMobileFriendlyClick(loadoutBackBtn, () => {
            this.hideAllScreens();
            briefingScreen.style.display = 'flex';
            this.gameState = 'BRIEFING_SCREEN';
        });

        this.bindMobileFriendlyClick(briefProceedBtn, () => {
            this.hideAllScreens();
            loadoutScreen.style.display = 'flex';
            this.gameState = 'LOADOUT_SCREEN';
            this.updateArmoryUI();
            this.playArbiterSound('ui', { type: 'success', note: "G4", duration: "8n" });
        });

        // Deployment Logic
        this.bindMobileFriendlyClick(deployBtn, () => {
            this.startGame();
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
            requestAnimationFrame(() => this.endIntro());
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
                // Play subtle typing sound via Arbiter
                if (charIdx % 2 === 0) {
                    this.playArbiterSound('interaction', { notes: ["C5"] });
                }
                requestAnimationFrame(typeChar);
            } else {
                this.currentIntroLine++;
                requestAnimationFrame(() => this.showNextIntroLine());
            }
        };
        typeChar();
    }

    endIntro() {
        if (this.gameState !== 'INTRO') return;
        
        // Google AdSense: Trigger an ad break when entering the main game loop (facility selection)
        this.adService.showInterstitial({
            name: 'main_menu_entry',
            adBreakDone: () => {
                const introScreen = document.getElementById('intro-screen');
                const facilityScreen = document.getElementById('facility-screen');
                introScreen.style.display = 'none';
                facilityScreen.style.display = 'flex';
                this.gameState = 'FACILITY_SCREEN';
                this.updateFacilityGrid();
                this.playArbiterSound('ui', { type: 'success', note: "C4", duration: "8n" });
            }
        });
    }

    triggerShockwave(pos = null, duration = 1.0, kickIntensity = 2.0) {
        let intensityFactor = 1.0;
        if (pos) {
            const dist = pos.distanceTo(this.player.mesh.position);
            intensityFactor = Math.max(0, 1.0 - dist / 40); // 40m falloff for shockwaves
        }
        
        if (intensityFactor <= 0) return;

        this.shockwaveTime = 0;
        this.shockwaveDuration = duration;
        this.shockwaveActive = true;
        this.shockwaveKickIntensity = kickIntensity * intensityFactor;
        
        // Immediate intensity spike for feedback
        this.rippleIntensity = Math.max(this.rippleIntensity, 0.8 * intensityFactor);
        this.radialBlurIntensity = Math.max(this.radialBlurIntensity, 1.0 * intensityFactor);
        
        // Visual feedback for the "epicenter" if we had a screen-space origin
        this._shockwaveOrigin = pos ? pos.clone() : null;
    }

    triggerInsaneMoment(type) {
        if (this.insaneMomentActive) return;
        this.insaneMomentActive = true;
        
        console.log(`INSANE MOMENT: ${type}`);
        
        const originalTimeScale = this.targetTimeScale || 1.0;
        
        // Massive Feedback Spike
        this.shakeAmount += 8.0;
        this.bloomIntensity = 6.0;
        this.saturation = 3.5;
        this.chromaticAberration = 1.5;
        this.triggerShockwave(this.player.mesh.position, 1.5, 4.0);
        this.radialBlurIntensity = 1.5;
        
        // Sound Spike
        if (this.Tone) {
            this.playArbiterSound('ui', { type: 'success', note: "C1", duration: "1n" });
            if (this.eliteScreech) this.eliteScreech.triggerAttackRelease("G2", "1n");
            if (this.detonateSynth) this.detonateSynth.triggerAttackRelease("C1", "1n");
        }

        // Environmental Shockwave: Destroy EVERYTHING nearby
        const shockRange = 40;
        const shockRangeSq = shockRange * shockRange;
        
        if (this.particleSystem) {
            this.particleSystem.createThermalPulse(this.player.mesh.position, shockRange, 0xffffff);
        }

        // 1. Destructible Props (Server Racks, Terminals)
        if (this.map && this.map.destructibleProps) {
            this.map.destructibleProps.forEach(prop => {
                if (!prop.isDead) {
                    const distSq = prop.mesh.position.distanceToSquared(this.player.mesh.position);
                    if (distSq < shockRangeSq) {
                        prop.takeDamage(1000, prop.mesh.position, new THREE.Vector3(0, 1, 0));
                    }
                }
            });
        }

        // 2. Barrels, Pipes, and Hazards - Instant Chain Reaction
        if (this.map) {
            // Barrels
            if (this.map.barrels) {
                this.map.barrels.forEach(barrel => {
                    const distSq = barrel.position.distanceToSquared(this.player.mesh.position);
                    if (distSq < shockRangeSq) {
                        if (!this._pendingBarrelExplosions) this._pendingBarrelExplosions = [];
                        this._pendingBarrelExplosions.push({ barrel, at: performance.now() + Math.random() * 500 });
                    }
                });
            }

            // Pipes (Leaking/Bursting)
            if (this.map.pipes) {
                this.map.pipes.forEach(pipe => {
                    const distSq = pipe.position.distanceToSquared(this.player.mesh.position);
                    if (distSq < shockRangeSq) {
                        this.handlePipeHit(pipe, pipe.position.clone());
                    }
                });
            }

            // Cryo Vents
            if (this.map.hazards) {
                this.map.hazards.forEach(hazard => {
                    if (hazard.type === 'CRYO_VENT' && hazard.freeze) {
                        const distSq = hazard.position.distanceToSquared(this.player.mesh.position);
                        if (distSq < shockRangeSq) {
                            hazard.freeze();
                        }
                    }
                });
            }
        }

        switch(type) {
            case 'BULLET_STORM':
                this.showProgressionMessage("CRITICAL OVERLOAD: BULLET STORM ACTIVATED!", 4000);
                this.player.buffs.push({ multiplier: 5.0, duration: 8 });
                this.player.perks.infiniteAmmo = true;
                this.targetTimeScale = 0.4;
                setTimeout(() => { 
                    this.player.perks.infiniteAmmo = false; 
                    this.targetTimeScale = originalTimeScale;
                }, 8000);
                break;
            case 'TIME_FRACTURE':
                this.showProgressionMessage("NEURAL SYNC: TIME FRACTURE!", 4000);
                this.targetTimeScale = 0.05;
                setTimeout(() => { 
                    this.targetTimeScale = originalTimeScale;
                }, 5000);
                break;
            case 'SHOCKWAVE_CHAIN':
                this.showProgressionMessage("ARCHETYPE PEAK: SHOCKWAVE CHAIN!", 4000);
                for(let i=0; i<15; i++) {
                    setTimeout(() => {
                        this.handleAreaDamage(this.player.mesh.position, 35, 300);
                        this.particleSystem.createExplosion(this.player.mesh.position, 0x00d0ff, 200, 20);
                        this.shakeAmount += 1.5;
                        this.bloomIntensity = 3.0;
                        this.playArbiterSound('hit', { isEnemy: true });
                    }, i * 300);
                }
                break;
            case 'KILL_STREAK':
                this.showProgressionMessage("COMBAT EFFICIENCY DETECTED: SYSTEM SURGE!", 2000);
                this.targetTimeScale = 0.3;
                setTimeout(() => { this.targetTimeScale = originalTimeScale; }, 500);
                break;
            case 'LEGENDARY_PICKUP':
                this.showProgressionMessage("LEGENDARY SYNC DETECTED: UNLEASHING POTENTIAL!", 4000);
                this.targetTimeScale = 0.3;
                this.handleAreaDamage(this.player.mesh.position, 50, 1000);
                this.particleSystem.createExplosion(this.player.mesh.position, 0xffd700, 300, 30);
                this.particleSystem.createThermalPulse(this.player.mesh.position, 50, 0xffd700);
                setTimeout(() => { this.targetTimeScale = originalTimeScale; }, 3000);
                break;
            case 'ELITE_NEUTRALIZED':
                this.showProgressionMessage("ELITE NEUTRALIZED: SYSTEM BURST!", 3000);
                this.handleAreaDamage(this.player.mesh.position, 40, 500);
                this.particleSystem.createExplosion(this.player.mesh.position, 0xffff00, 200, 25);
                this.particleSystem.createThermalPulse(this.player.mesh.position, 30, 0xffff00);
                break;
        }

        // Global visuals
        if (this.heatVisuals) this.heatVisuals.glitchIntensity = Math.max(this.heatVisuals.glitchIntensity, 0.8);
        
        setTimeout(() => {
            this.insaneMomentActive = false;
            if (this.heatVisuals && !this.activeEvent) this.heatVisuals.glitchIntensity = 0;
        }, 6000);
    }

    activateEmergencyShield(duration) {
        if (!this.player) return;
        
        const finalDuration = duration + (this.player.synergyDurationBonus || 0);
        
        console.log(`ACTIVATE EMERGENCY SHIELD: ${finalDuration}s (Bonus: ${this.player.synergyDurationBonus || 0}s)`);
        this.player.isInvincible = true;
        this.player.invincibilityTimer = finalDuration;
        
        // Show visual feedback
        this.showProgressionMessage(`EMERGENCY SHIELD ACTIVATED - ${Math.round(finalDuration)}s INVINCIBILITY`);
        this.player.hasProjectedShield = true;
        this.player.projectedShieldTimer = finalDuration * 1000;
        
        // Update UI
        const btn = document.getElementById('emergency-shield-btn');
        const timerContainer = document.getElementById('shield-active-timer');
        const timerVal = document.getElementById('shield-time-val');
        
        if (btn) btn.style.display = 'none';
        if (timerContainer) timerContainer.style.display = 'block';
        
        const updateTimer = () => {
            if (this.player.invincibilityTimer > 0) {
                if (timerVal) timerVal.innerText = Math.ceil(this.player.invincibilityTimer);
                requestAnimationFrame(updateTimer);
            } else {
                if (timerContainer) timerContainer.style.display = 'none';
                if (btn) {
                    btn.style.display = 'block';
                    btn.innerText = 'SHIELD RECHARGING...';
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    
                    // 60 second cooldown
                    setTimeout(() => {
                        btn.disabled = false;
                        btn.style.opacity = '1';
                        btn.innerText = 'ACTIVATE EMERGENCY SHIELD [AD]';
                    }, 60000);
                }
            }
        };
        updateTimer();
        
        // Play success sound
        this.playArbiterSound('ui', { type: 'success', note: "C6", duration: "2n" });
    }

    pauseForAd() {
        console.log('GameScene: Pausing for Ad');
        // Pause audio contexts
        if (window.Tone && Tone.getContext().state !== 'suspended') {
            Tone.getContext().suspend();
        }
        // Suspend the internal game loop if needed, but Three.js animate() can keep running
        // We just ensure inputs and gameplay updates are blocked by adService.adInProgress check in update
    }

    resumeAfterAd() {
        console.log('GameScene: Resuming after Ad');
        // Resume audio contexts
        if (window.Tone && Tone.getContext().state === 'suspended') {
            Tone.getContext().resume();
        }
    }

    updateFacilityGrid() {
        const container = document.getElementById('facility-map-container');
        if (!container) return;
        
        // Clear previous nodes/lines
        const items = container.querySelectorAll('.map-node, .map-line');
        for (let i = 0; i < items.length; i++) items[i].remove();
        
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
                this.playArbiterSound('ui', { type: 'interaction', note: "C5", duration: "32n" });
                node.style.boxShadow = `0 0 25px #${fac.accent.toString(16).padStart(6, '0')}`;
                node.style.transform = 'scale(1.2) translate(-50%, -50%)';
            };
            
            node.onmouseleave = () => {
                node.style.boxShadow = 'none';
                node.style.transform = 'translate(-50%, -50%)';
            };

            this.bindMobileFriendlyClick(node, (e) => {
                if (e) e.stopPropagation();
                this.showFacilityDetail(fac, coords[i]);
                this.playArbiterSound('ui', { type: 'interaction', note: "G4", duration: "16n" });
            });

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

        this.bindMobileFriendlyClick(confirmBtn, () => {
            this.selectFacility(facility);
        });

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

    showBriefing(facility) {
        this.hideAllScreens();
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
        if (nameEl) {
            nameEl.innerText = facility.name;
            nameEl.style.color = accentHex;
            nameEl.style.borderColor = accentHex;
        }
        if (descEl) descEl.innerText = facility.desc;
        
        if (imageEl && facility.image) {
            imageEl.src = facility.image;
            imageEl.style.borderColor = accentHex;
        }

        const riskLevel = facility.bossInterval <= 5 ? 'HIGH' : 'EXTREME';
        const securityClass = facility.rooms >= 50 ? 'TITAN-IV' : 'GUARDIAN-II';
        const specialUnit = facility.id === 'neon' ? 'CLOAKED STALKER' : (facility.id === 'obsidian' ? 'HEAVY TANK' : 'SENTRY SWARM');
        
        if (statsEl) {
            statsEl.innerHTML = `
                SECURITY CLASS: ${securityClass}<br>
                ROOM COUNT: ${facility.rooms}<br>
                HAZARD LEVEL: ${riskLevel}<br>
                SIGNAL PROFILE: ENCRYPTED-L3<br>
                SPECIALIZED UNIT: ${specialUnit}
            `;
        }

        this.playArbiterSound('ui', { type: 'success', note: "C4", duration: "8n" });
    }

    async startBreachLoading(facility) {
        this.gameState = 'BREACH_LOADING';
        const screen = document.getElementById('breach-loading-screen');
        const logContainer = document.getElementById('terminal-logs');
        const progressBar = document.getElementById('breach-loading-bar');
        const percentText = document.getElementById('breach-percent');
        
        screen.style.display = 'flex';
        logContainer.innerHTML = '';
        
        // Prepare map reset and setup
        this.prepareMapForGeneration(facility);
        
        const logMilestones = [
            { progress: 0.05, text: `> TARGET NODE: ${facility.name.toUpperCase()}`, type: 'info' },
            { progress: 0.18, text: "> BYPASSING ENCRYPTION LAYER 1...", type: 'info' },
            { progress: 0.32, text: "> LAYER 1 CLEAR. INJECTING PACKET SNIFFER...", type: 'success' },
            { progress: 0.48, text: "> WARNING: HEURISTIC DETECTION ACTIVE", type: 'warning' },
            { progress: 0.64, text: "> DATA STREAM ESTABLISHED", type: 'success' },
            { progress: 0.82, text: "> DECRYPTING FACILITY SCHEMATICS...", type: 'info' },
            { progress: 0.95, text: "> INFILTRATION POINT SECURED", type: 'success' }
        ];

        let emittedLogCount = 0;
        const appendLog = (log) => {
            if (!log || this.gameState !== 'BREACH_LOADING') return;
            const entry = document.createElement('div');
            entry.className = `terminal-log-entry ${log.type}`;
            entry.innerText = log.text;
            logContainer.appendChild(entry);

            while (logContainer.children.length > 6) {
                logContainer.removeChild(logContainer.firstChild);
            }

            logContainer.scrollTop = logContainer.scrollHeight;
            this.playArbiterSound('ui', { type: 'success', note: "C6", duration: "64n" });
        };

        appendLog(logMilestones[0]);
        emittedLogCount = 1;

        let loadingFinished = false;
        const completeLoading = () => {
            if (loadingFinished || this.gameState !== 'BREACH_LOADING') return;
            loadingFinished = true;
            this.finishBreachLoading(facility);
        };

        // Start Async Map Generation (await completion so we can transition immediately)
        await this.map.generate((progress) => {
            if (this.gameState !== 'BREACH_LOADING') return;
            
            const normalizedProgress = Math.max(progress, 0.2);
            progressBar.style.width = `${normalizedProgress * 100}%`;
            percentText.innerText = `${Math.floor(normalizedProgress * 100)}%`;

            while (
                emittedLogCount < logMilestones.length &&
                normalizedProgress >= logMilestones[emittedLogCount].progress
            ) {
                appendLog(logMilestones[emittedLogCount]);
                emittedLogCount++;
            }
            
            if (progress >= 1.0) {
                progressBar.style.width = '100%';
                percentText.innerText = '100%';
                completeLoading();
            }
        });

        completeLoading();
    }

    prepareMapForGeneration(facility) {
        // Set facility accent color for ambient lerping
        this.facilityAccentColor = new THREE.Color(facility.accent || 0x00d0ff);
        this.syncCSSTeamColor();
        
        // Clear all map geometry and entities (Same logic as reinitMap used to have)
        if (this.map) this.map.cleanup();
        
        this.missionLights.forEach(l => this.scene.remove(l));
        this.missionLights = [];
        
        // Let the particle system handle its own cleanup via pools
        if (this.particleSystem) {
            this.particleSystem.clearAll();
        }
        this.missionParticles = [];
        
        // Recycle enemies to pool instead of hard-disposing
        this.enemyPool.releaseAll(this.enemies);
        this.enemies = [];

        // Recycle projectiles to pool
        if (this.projectilePool) this.projectilePool.releaseAll();

        this.turrets.forEach(t => {
            if (t.destroy) t.destroy();
            else if (t.mesh && t.mesh.parent) this.scene.remove(t.mesh);
        });
        this.turrets = [];
        this.pickups.forEach(p => {
            if (p.destroy) p.destroy();
            else if (p.mesh && p.mesh.parent) this.scene.remove(p.mesh);
        });
        this.pickups = [];
        this.activeGrenades.forEach(g => { if(g.mesh && g.mesh.parent) this.scene.remove(g.mesh) });
        this.activeGrenades = [];
        this.activeFireFields.forEach(f => f.destroy());
        this.activeFireFields = [];
        this.activeGasLeaks.forEach(g => g.destroy());
        this.activeGasLeaks = [];

        // Update Global MAP configs BEFORE creating new map instance
        CONFIG.MAP.NUM_ROOMS = facility.rooms;
        CONFIG.MAP.BOSS_INTERVAL = facility.bossInterval;
        this.enemiesPerChamber = facility.enemies;

        // Create new map instance but DON'T generate yet
        this.map = new GameMap(this.scene, facility, this.particleSystem);
        this.navigation = new Navigation(this.map);
        this.particleSystem.map = this.map;

        // Reset player for new run
        this.player.mesh.position.set(0, 1, 0);
        this.player.health = this.player.maxHealth;
        this.player.isDead = false;
        this.player.updateUI();
        
        this.currentChamberIndex = 0;
        this.chamberClearingStatus = 'ACTIVE';
        this.lastEnemySpawn = Date.now() + 5000;
    }

    finishBreachLoading(facility) {
        document.getElementById('breach-loading-screen').style.display = 'none';
        document.getElementById('briefing-screen').style.display = 'flex';
        this.gameState = 'BRIEFING_SCREEN';
        
        // --- Navigation Init (Map is now fully generated) ---
        if (this.navigation) {
            this.navigation.init();
        }

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
            SPECIALIZED UNIT: ${specialUnit}<br>
            MUTATOR: <span style="color: #ffff00;">${facility.mutator || 'NONE'}</span>
        `;

        const objectives = [
            "NEUTRALIZE CORE SYSTEMS",
            "RECOVER DATA SPINE",
            "BREACH SECURITY HUB",
            "OVERRIDE MAIN FIREWALL"
        ];
        objectiveEl.innerText = objectives[Math.floor(Math.random() * objectives.length)];

        // Setup atmospheric lighting/particles after map is definitely ready (chunked to avoid a single long frame)
        const setupChamberEffects = async () => {
            for (let i = 0; i < this.map.chambers.length; i++) {
                const chamber = this.map.chambers[i];
                chamber.isCleared = chamber.isCleared || false;
                chamber.firewallBypassed = chamber.firewallBypassed || false;

                const isBossRoom = (i + 1) % facility.bossInterval === 0;
                const color = isBossRoom ? 0xff3300 : facility.accent;
                const pLight = new THREE.PointLight(color, isBossRoom ? 30 : 20, 25);
                pLight.position.set(chamber.x, 4, chamber.z);
                pLight.userData.chamberIndex = i;
                this.scene.add(pLight);
                this.missionLights.push(pLight);

                const dust = this.particleSystem.createAtmosphericParticles(chamber, isBossRoom ? 8 : 4);
                if (dust) {
                    this.scene.add(dust);
                    this.missionParticles.push(dust);
                }

                if (i % 4 === 0) await new Promise(resolve => requestAnimationFrame(resolve));
            }
        };

        setupChamberEffects();

        // Collect corridor and hazard lights from the map
        if (this.map.lights) {
            this.map.lights.forEach(l => {
                if (l.isPointLight && !this.missionLights.includes(l)) {
                    this.missionLights.push(l);
                }
            });
        }

        // Immediate geometry culling after load to avoid first-frame spike
        if (this.map && typeof this.map.setChamberVisibility === 'function') {
            this.map.setChamberVisibility(this.currentChamberIndex, this.cullingRadius);
        }

        // Enable frustum culling on all map meshes for GPU-side optimization
        if (this.map && this.map.mapGroup) {
            this.map.mapGroup.traverse(obj => {
                if (obj.isMesh) {
                    obj.frustumCulled = true;
                }
            });
        }

        this.applyMutator(facility.mutator);
        this.refreshRaycastTargets();
        this.successSynth?.triggerAttackRelease("E4", "8n");
    }

    applyMutator(mutator) {
        if (!this.playerController) return;

        // Reset to defaults first
        this.playerController.gravity = CONFIG.PLAYER.GRAVITY;
        this.playerController.jumpForce = CONFIG.PLAYER.JUMP_FORCE;
        this.heatVisuals.glitchIntensity = 0;

        switch(mutator) {
            case 'LOW_GRAVITY':
                this.playerController.gravity = CONFIG.PLAYER.GRAVITY * 0.4;
                this.playerController.jumpForce = CONFIG.PLAYER.JUMP_FORCE * 1.2;
                this.showProgressionMessage("MUTATOR ACTIVE: LOW GRAVITY ENVIRONMENT");
                break;
            case 'DATA_STORM':
                this.heatVisuals.glitchIntensity = 0.5;
                this.showProgressionMessage("MUTATOR ACTIVE: DATA STORM INTERFERENCE");
                break;
            case 'ATMOSPHERIC_INSTABILITY':
                this.showProgressionMessage("MUTATOR ACTIVE: ATMOSPHERIC INSTABILITY DETECTED");
                break;
        }
    }

    updateBriefingMap(currentFacility) {
        const container = document.getElementById('brief-map-container');
        if (!container) return;

        // Clear previous nodes/lines
        const nodes = container.querySelectorAll('.map-node, .map-line');
        for (let i = 0; i < nodes.length; i++) nodes[i].remove();

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
        // PERFORMANCE FIX: More aggressive throttling (333ms = ~3 times per second max)
        if (!this.map || (this.lastRaycastUpdate && Date.now() - this.lastRaycastUpdate < 333)) return;
        
        // Rebuild the target list: Walls + Enemies
        const targets = [];
        
        // Use the map's spatial grid to only include relevant walls
        let currentChamber = this.currentChamberIndex;
        
        // If currentChamber is null, try to find it using map's new fast lookup
        if (currentChamber === null && this.player && this.map.chamberLookupGrid) {
            const pos = this.player.mesh.position;
            const gx = Math.floor(pos.x / this.map.chamberLookupCellSize);
            const gz = Math.floor(pos.z / this.map.chamberLookupCellSize);
            const key = `${gx},${gz}`;
            const potentials = this.map.chamberLookupGrid.get(key);
            if (potentials && potentials.length > 0) {
                currentChamber = potentials[0].data.index;
            }
        }

        if (this.map.walls && this.map.spatialGrid) {
            // Only check current chamber and immediate neighbors
            const chambersToCheck = (currentChamber !== null) ? 
                [currentChamber, currentChamber - 1, currentChamber + 1] : [];

            chambersToCheck.forEach(idx => {
                const wallIndices = this.map.spatialGrid.get(idx);
                if (wallIndices) {
                    for (let i = 0; i < wallIndices.length; i++) {
                        const wall = this.map.walls[wallIndices[i]];
                        if (wall) targets.push(wall);
                    }
                }
            });
        }
        
        // Enemy Hitboxes - Only nearby ones? No, usually enemies are few enough to check all.
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (!e.isDead && e.mesh) {
                const hitbox = e.mesh.getObjectByName('hitbox');
                if (hitbox) targets.push(hitbox);
            }
        }
        
        // Door panels in current vicinity (use indexed loop for performance)
        if (this.map.doors) {
            for (let i = 0; i < this.map.doors.length; i++) {
                const d = this.map.doors[i];
                if (!d.isOpen) {
                    if (currentChamber === null || Math.abs(d.chamberIndex - currentChamber) <= 1) {
                        targets.push(d.pL, d.pR);
                    }
                }
            }
        }

        // Props (Barrels, Pipes, etc.) in current vicinity - already part of walls? 
        // Some are, some aren't. Let's check. 
        // In Map.js, complex props are added to walls via addWall. 
        // So we only need to add items that ARE NOT in this.map.walls.

        this.raycastTargets = targets.filter(Boolean);
        this.lastRaycastUpdate = Date.now();
    }

    _redundantMapReset(facility) { }
    /*
        
        // Clear mission-specific lights
        this.missionLights.forEach(l => this.scene.remove(l));
        this.missionLights = [];

        // Clear mission-specific particles
        this.missionParticles.forEach(p => {
            if (p.parent) p.parent.remove(p);
            p.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
        });
        this.missionParticles = [];
        
        // Clear GameScene's dynamic entity arrays
        // Recycle enemies to pool instead of hard-disposing
        this.enemyPool.releaseAll(this.enemies);
        this.enemies = [];

        if (this.projectilePool) this.projectilePool.releaseAll();
        
        this.turrets.forEach(t => {
            if (t.destroy) t.destroy();
            else if (t.mesh && t.mesh.parent) this.scene.remove(t.mesh);
        });
        this.turrets = [];
        
        this.pickups.forEach(p => {
            if (p.destroy) p.destroy();
            else if (p.mesh && p.mesh.parent) this.scene.remove(p.mesh);
        });
        this.pickups = [];
        
        this.activeGrenades.forEach(g => { if(g.mesh && g.mesh.parent) this.scene.remove(g.mesh) });
        this.activeGrenades = [];
        
        this.activeFireFields.forEach(f => f.destroy());
        this.activeFireFields = [];
        
        this.activeGasLeaks.forEach(g => g.destroy());
        this.activeGasLeaks = [];

        // Create new map
        this.map = new GameMap(this.scene, facility, this.particleSystem);
        this.navigation = new Navigation(this.map);
        
		   // Critical: Update map reference in particle system for projectile collision
        this.particleSystem.map = this.map;																	 					   
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
			// NEW: per-chamber security flags
			chamber.isCleared = chamber.isCleared || false;
			chamber.firewallBypassed = chamber.firewallBypassed || false;

			const isBossRoom = (i + 1) % facility.bossInterval === 0;
			const color = isBossRoom ? 0xff3300 : facility.accent;
			const pLight = new THREE.PointLight(color, isBossRoom ? 30 : 20, 25);
			pLight.position.set(chamber.x, 4, chamber.z); 
			this.scene.add(pLight);
			this.missionLights.push(pLight);
			
			const dust = this.particleSystem.createAtmosphericParticles(chamber, isBossRoom ? 8 : 4);
			if (dust) this.missionParticles.push(dust);
		});
    }
		
		

    */
    spawnDisruptor(position) {
        let disruptor = this.availableDisruptors.pop();
        if (!disruptor) {
            disruptor = new NeuralDisruptor(this.scene, this.particleSystem);
            this.disruptorPool.push(disruptor);
        }
        disruptor.spawn(position);
        this.disruptors.push(disruptor);
        return disruptor;
    }

    spawnBullet(position, direction, speed, damage, owner, color = 0xffffff) {
        return this.projectilePool.acquire(position, direction, speed, damage, owner, color);
    }

    updateBullets(deltaTime) {
        this.projectilePool.update(deltaTime, this.map, this.player, this.enemies, this.spatialGrid);
    }

    deployNeuralDisruptor(position) {
        const disruptor = this.spawnDisruptor(position);
        
        // Add visual cue for deployment
        this.particleSystem.createExplosion(position, 0xff00ff, 20, 5);
        this.playArbiterSound('hazard', { type: 'neural', note: "F3" });
        
        return disruptor;
    }

    spawnSmoke(position) {
        // PERFORMANCE FIX: Cap smoke screens to prevent unbounded growth
        const MAX_SMOKE_SCREENS = this.perfLimits.maxSmokeScreens;
        if (this.activeSmokeScreens.length >= MAX_SMOKE_SCREENS) {
            const oldest = this.activeSmokeScreens.shift();
            oldest.destroy();
        }
        
        const smoke = new SmokeScreen(this.scene, position);
        this.activeSmokeScreens.push(smoke);
        this.refreshRaycastTargets(); // Smoke might affect LoS checks eventually
    }

    updateDisruptors(deltaTime) {
        for (let i = this.disruptors.length - 1; i >= 0; i--) {
            const d = this.disruptors[i];
            d.update(deltaTime, this.player, this.enemies);
            if (d.isDead) {
                // O(1) removal: swap with last
                const last = this.disruptors.pop();
                if (i < this.disruptors.length) {
                    this.disruptors[i] = last;
                }
                this.availableDisruptors.push(d);
            }
        }
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
                // Touch/Click support for mobile
                this.bindMobileFriendlyClick(el, (e) => {
                    if (this.isMenuOpen) {
                        if (e) e.stopPropagation();
                        this.selectedCommand = opt.cmd;
                        this.toggleCommandMenu(false);
                    }
                });
            }
        });

        const centerBtn = document.getElementById('radial-menu-center');
        if (centerBtn) {
            this.bindMobileFriendlyClick(centerBtn, (e) => {
                if (e) e.stopPropagation();
                this.toggleCommandMenu(false);
            });
        }

        this.initInventoryEvents();
    }

    initInventoryEvents() {
        const moduleItems = document.querySelectorAll('.module-item');
        moduleItems.forEach(item => {
            this.bindMobileFriendlyClick(item, (e) => {
                if (e) e.stopPropagation(); // Don't close when clicking item
                if (item.classList.contains('owned')) return;
                
                moduleItems.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                this.selectedModule = item.dataset.type;
                
                document.getElementById('apply-upgrade-btn').style.display = 'block';
            });
        });

        this.bindMobileFriendlyClick(document.getElementById('inventory-ui'), () => {
            this.toggleInventory(false);
        });

        this.bindMobileFriendlyClick(document.getElementById('apply-upgrade-btn'), (e) => {
            if (e) e.stopPropagation();
            this.applyUpgrade();
        });

        this.initTurretMenuEvents();
    }

    initTurretMenuEvents() {
        this.bindMobileFriendlyClick(document.getElementById('turret-repair-btn'), () => this.interactTurret('repair'));
        this.bindMobileFriendlyClick(document.getElementById('turret-dmg-btn'), () => this.interactTurret('damage'));
        this.bindMobileFriendlyClick(document.getElementById('turret-fire-btn'), () => this.interactTurret('fireRate'));
        this.bindMobileFriendlyClick(document.getElementById('turret-hp-btn'), () => this.interactTurret('health'));
        
        this.bindMobileFriendlyClick(document.getElementById('turret-menu-ui'), () => this.toggleTurretMenu(false));
        const menuContent = document.querySelector('.turret-menu-content');
        if (menuContent) {
            menuContent.addEventListener('click', (e) => e.stopPropagation());
            menuContent.addEventListener('touchstart', (e) => e.stopPropagation());
        }

        this.initTerminalMenuEvents();
    }

    initTerminalMenuEvents() {
        this.bindMobileFriendlyClick(document.getElementById('term-hack-btn'), () => {
            this.toggleTerminalMenu(false);
            if (this.currentTerminal) this.startNeuralSync(this.currentTerminal);
        });

        this.bindMobileFriendlyClick(document.getElementById('term-shop-btn'), () => {
            this.toggleTerminalMenu(false);
            this.toggleShopMenu(true);
        });

        this.bindMobileFriendlyClick(document.getElementById('term-close-btn'), () => {
            this.toggleTerminalMenu(false);
        });

        this.bindMobileFriendlyClick(document.getElementById('shop-back-btn'), () => {
            this.toggleShopMenu(false);
            this.toggleTerminalMenu(true);
        });

        this.bindMobileFriendlyClick(document.getElementById('terminal-menu-ui'), () => this.toggleTerminalMenu(false));
        this.bindMobileFriendlyClick(document.getElementById('terminal-shop-ui'), () => this.toggleShopMenu(false));
        
        // Prevent clicking inside from closing
        const termMenuInner = document.querySelector('#terminal-menu-ui > div');
        if (termMenuInner) {
            termMenuInner.addEventListener('click', (e) => e.stopPropagation());
            termMenuInner.addEventListener('touchstart', (e) => e.stopPropagation());
        }
        const termShopInner = document.querySelector('#terminal-shop-ui > div');
        if (termShopInner) {
            termShopInner.addEventListener('click', (e) => e.stopPropagation());
            termShopInner.addEventListener('touchstart', (e) => e.stopPropagation());
        }
    }

    toggleTerminalMenu(open, terminal = null) {
        this.isTerminalMenuOpen = open;
        if (terminal) this.currentTerminal = terminal;
        const ui = document.getElementById('terminal-menu-ui');
        if (ui) ui.style.display = open ? 'block' : 'none';

        if (this.playerController) this.playerController.isLocked = open;

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

        if (this.playerController) this.playerController.isLocked = open;

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
            
            this.bindMobileFriendlyClick(card, () => this.buyShopItem(item));
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

        if (this.playerController) this.playerController.isLocked = open;

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

        if (this.playerController) this.playerController.isLocked = open;

        if (open) {
            if (document.pointerLockElement) document.exitPointerLock();
            this.toggleMobileControls(false);
            this.updateInventoryUI();
        } else {
            if (!('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
                this.renderer.domElement.requestPointerLock();
            }
            this.toggleMobileControls(true);
        }
    }

    updateInventoryUI() {
        // Find nearest ally drone to upgrade
        this.updateEnemyStatsCache();
        this.activeDrone = this.enemyStatsCache.nearestAlly;
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

    hideAllScreens() {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => s.style.display = 'none');
        
        // Hide mobile controls when menu is open
        this.toggleMobileControls(false);

        // Hide reward ad button when not in screens (logic handles it being visible in HUD)
        const adBtn = document.getElementById('reward-ad-container');
        if (adBtn) adBtn.style.display = 'none';
    }

    toggleMobileControls(visible) {
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (!isMobile) return;
        
        const mobileUI = document.getElementById('mobile-game-controls');
        if (mobileUI) {
            mobileUI.style.display = visible ? 'block' : 'none';
        }
    }

    initMinigameClickEvents() {
        // Hacking Minigame Click
        const hackingUI = document.getElementById('hacking-ui');
        if (hackingUI) {
            hackingUI.style.cursor = 'pointer';
            hackingUI.addEventListener('mousedown', (e) => {
                if (this.isHacking) {
                    e.stopPropagation();
                    this.checkHackingHit();
                }
            });
            // Also for touch
            hackingUI.addEventListener('touchstart', (e) => {
                if (this.isHacking) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.checkHackingHit();
                }
            });
        }

        // Neural Sync Minigame Click
        const neuralSyncUI = document.getElementById('neural-sync-ui');
        if (neuralSyncUI) {
            neuralSyncUI.style.cursor = 'pointer';
            neuralSyncUI.addEventListener('mousedown', (e) => {
                if (this.isNeuralSyncing) {
                    e.stopPropagation();
                    this.checkNeuralSyncHit();
                }
            });
            neuralSyncUI.addEventListener('touchstart', (e) => {
                if (this.isNeuralSyncing) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.checkNeuralSyncHit();
                }
            });
        }

        // Meta Store Item Hover Fix for Mobile
        // In mobile, we might need an explicit "BUY" button if the layout relies on hover
        // Looking at updateMetaStoreUI... 
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    async setupAudio(Tone) {
        this.Tone = Tone;
        
        // --- Master Output Chain ---
        // A master compressor helps glue the sounds together and prevents clipping CPU spikes
        this.masterCompressor = new Tone.Compressor({
            threshold: -20,
            ratio: 6,
            attack: 0.003,
            release: 0.25
        }).toDestination();
        
        // A final limiter for absolute safety
        this.masterLimiter = new Tone.Limiter(-1).connect(this.masterCompressor);

        // --- Neural Synergy Audio Worklet (Parallel Thread) ---
        // NOTE: Audio Worklet support is optional - game functions fine without it
        // This feature is disabled for reliability. Web Audio API synthesis is sufficient.
        this.synergyNode = null;
        // Keeping the old code commented out for reference:
        // try {
        //     const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        //     await audioContext.audioWorklet.addModule('./SynergyAudioWorker.js');
        //     this.synergyNode = new AudioWorkletNode(audioContext, 'synergy-processor');
        // } catch (e) {
        //     console.warn('Audio Worklet not supported or failed to load:', e);
        //     this.synergyNode = null;
        // }


        // --- Synths ---
        // Hacking synth - use MonoSynth because this is always a single-note UI sound
        this.hackSynth = new Tone.MonoSynth({
            oscillator: { type: "square8" },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.1 }
        }).connect(this.masterLimiter);
        this.hackSynth.volume.value = -18;

        // Success sound - single-note confirmation tone, so MonoSynth avoids wasted polyphony
        this.successSynth = new Tone.MonoSynth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.5 }
        }).connect(this.masterLimiter);
        this.successSynth.volume.value = -18;

        // Weapon Fire - keep PolySynth, but allow slightly more overlap for combat bursts
        this.shootSynth = new Tone.PolySynth(Tone.MembraneSynth, {
			envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
		}).connect(this.masterLimiter);
				
		// PERFORMANCE FIX: Slightly increased to avoid dropped shots when combat spikes overlap
        this.shootSynth.maxPolyphony = 2;
        this.shootSynth.volume.value = -24;

        // Impact Synths
        this.impactSynth = new Tone.PolySynth(Tone.MembraneSynth, {
			pitchDecay: 0.02,
			octaves: 2,
			oscillator: { type: "sine" },
			envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.1 }
		}).connect(this.masterLimiter);
		this.impactSynth.volume.value = -20;
		// PERFORMANCE FIX: Reduced polyphony from 8 to 2 to prevent note dropping while still allowing brief overlap
		this.impactSynth.maxPolyphony = 2;
		

        this.fireImpactSynth = new Tone.PolySynth(Tone.MembraneSynth, {
            pitchDecay: 0.05,
            octaves: 4,
            oscillator: { type: 'sine' }
        }).connect(this.masterLimiter);
        // PERFORMANCE FIX: Reduced polyphony from 4 to 2 to prevent note dropping
        this.fireImpactSynth.maxPolyphony = 2;
        this.fireImpactSynth.volume.value = -22;

        // --- Ambient Atmosphere ---
        // Oscillator and Noise sources connected only to their filters
        this.ambientHum = new Tone.Oscillator(45, "triangle");
        const ambientFilter = new Tone.Filter(120, "lowpass").connect(this.masterLimiter);
        this.ambientHum.connect(ambientFilter);
        this.ambientHum.volume.value = -55; 
        this.ambientHum.start();

        this.ambientAir = new Tone.Noise("pink");
        const airFilter = new Tone.Filter(200, "lowpass").connect(this.masterLimiter);
        this.ambientAir.connect(airFilter);
        this.ambientAir.volume.value = -75;
        this.ambientAir.start();

        // Hazard Warning
        this.hazardHiss = new Tone.Oscillator(120, "sawtooth");
        this.hazardFilter = new Tone.AutoFilter({
            frequency: "4n",
            baseFrequency: 400,
            octaves: 2,
            type: "sine"
        }).connect(this.masterLimiter).start();
        this.hazardHiss.connect(this.hazardFilter);
        this.hazardHiss.volume.value = -Infinity;
        this.hazardHiss.start();

        // Shield Hum
        this.shieldHum = new Tone.Oscillator(60, "sine").connect(this.masterLimiter);
        this.shieldHum.volume.value = -Infinity;
        this.shieldHum.start();

        // Portal Rumble
        this.portalRumble = new Tone.Oscillator(30, "sine").connect(this.masterLimiter);
        this.portalRumble.volume.value = -Infinity;
        this.portalRumble.start();

        // Data Storm Static
        this.dataStormStatic = new Tone.Noise("white").connect(this.masterLimiter);
        this.dataStormStatic.volume.value = -Infinity;
        this.dataStormStatic.start();

        // Elite Screech
        this.eliteScreech = new Tone.MonoSynth({
            harmonicity: 3.5,
            modulationIndex: 10,
            oscillator: { type: "sine" },
            modulation: { type: "square" },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 }
        }).connect(this.masterLimiter);
        this.eliteScreech.volume.value = -18;

        // Tactical Handshake
        this.tacticalHandshake = new Tone.MonoSynth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
        }).connect(this.masterLimiter);
        this.tacticalHandshake.volume.value = -12;

        // Neural Malfunction Biip
        this.malfunctionSynth = new Tone.Oscillator(880, "sine").connect(this.masterLimiter);
        this.malfunctionSynth.volume.value = -Infinity; // Absolute silence
        // Do not start() until needed

        // Heavy Detonate Synth for Black Holes and Insane Moments
        this.detonateSynth = new Tone.MonoSynth({
            oscillator: { type: "sawtooth" },
            envelope: { attack: 0.001, decay: 0.8, sustain: 0.1, release: 1.2 },
            filter: { Q: 6, type: "lowpass", rolloff: -24 },
            filterEnvelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.8, baseFrequency: 50, octaves: 4 }
        }).connect(this.masterLimiter);
        this.detonateSynth.volume.value = -12;

        // --- Audio Arbiter State ---
        // PERFORMANCE FIX: Audio event throttles to prevent polyphony overflow
        this.audioWindows = {
            shoot: 0.14,
            hit: 0.14,
            enemy_shoot: 0.35,
            elite: 0.5,
            ui: 0.12,
            interaction: 0.18,
            hazard: 0.16,
            perk: 0.2
        };
        this.audioQueueLimits = {
            shoot: 1,
            hit: 1,
            enemy_shoot: 1,
            elite: 1,
            ui: 1,
            interaction: 1,
            hazard: 1,
            perk: 1
        };
        this.audioInFlight = {};
        this.lastPlayTime = {};
        this.lastAudioCategory = null;
        this.lastAudioCategoryTime = 0;

        // Pass sounds to player
        if (this.player) {
            this.player.setAudio({
                shoot: () => this.playArbiterSound('shoot'),
                hit: (isEnemy) => this.playArbiterSound('hit', { isEnemy }),
                reload: () => this.playArbiterSound('ui', { type: 'reload' })
            });
        }
    
        // --- GLOBAL AUDIO QUEUE FIX ---
        this.audioQueue = [];
        this.lastAudioFlush = 0;

        this.enqueueAudio = (fn) => {
            if (this.audioQueue.length > 8) return;
            this.audioQueue.push(fn);
        };

        // Runs only a few sounds per frame
        this.flushAudio = () => {
            const now = this.Tone.now();
            if (now - this.lastAudioFlush < 0.04) return;
            this.lastAudioFlush = now;

            let c = 1;
            while (this.audioQueue.length && c--) {
                const fn = this.audioQueue.shift();
                fn();
            }
        };
    }

    playArbiterSound(category, params = {}) {
		if (!this.Tone || this.Tone.getContext().state !== 'running') return;

		const now = this.Tone.now();
		const window = this.audioWindows[category] || 0.1;
		const maxInFlight = this.audioQueueLimits[category] || 1;

		if ((this.audioInFlight[category] || 0) >= maxInFlight) return;

		// Window throttle
		if (this.lastPlayTime[category] && now - this.lastPlayTime[category] < window) return;
		this.lastPlayTime[category] = now;

		// Per-category duplicate suppression
		if (this.lastAudioCategory === category && (now - this.lastAudioCategoryTime) < 0.04) return;
		this.lastAudioCategory = category;
		this.lastAudioCategoryTime = now;

		// Global load control
		if (this.audioQueue.length > 4) return;

		this.audioInFlight[category] = (this.audioInFlight[category] || 0) + 1;
		const releaseAudioSlot = () => {
			this.audioInFlight[category] = Math.max(0, (this.audioInFlight[category] || 1) - 1);
		};

		switch(category) {

			case 'shoot': {
				const wpType = this.player.currentWeaponKey;
				
				// Priority: AudioWorklet Synthesis
				if (this.synergyNode) {
					if (wpType === 'RIFLE') {
						this.synergyNode.port.postMessage({ type: 'TRIGGER_SOUND', payload: { soundType: 'shot_rifle' } });
						releaseAudioSlot();
						return;
					} else if (wpType === 'SNIPER') {
						this.synergyNode.port.postMessage({ type: 'TRIGGER_SOUND', payload: { soundType: 'shot_sniper' } });
						releaseAudioSlot();
						return;
					}
				}

				if (wpType === 'SNIPER') {
					this.enqueueAudio(() => {
						try {
							this.shootSynth.triggerAttackRelease("C4", "32n", this.Tone.now());
							this.fireImpactSynth.triggerAttackRelease("G1", "64n", this.Tone.now());
						} finally {
							releaseAudioSlot();
						}
					});
				} else if (wpType === 'RIFLE') {
					this.enqueueAudio(() => {
						try {
							this.shootSynth.triggerAttackRelease("C3", "64n", this.Tone.now());
						} finally {
							releaseAudioSlot();
						}
					});
				} else if (wpType === 'TURRET') {
					this.enqueueAudio(() => {
						try {
							this.successSynth.triggerAttackRelease("G5", "64n", this.Tone.now());
						} finally {
							releaseAudioSlot();
						}
					});
				} else {
					releaseAudioSlot();
				}
				break;
			}

			case 'hit': {
				const freq = params.isEnemy
					? 160 + Math.random() * 40
					: 100 + Math.random() * 30;

				this.enqueueAudio(() => {
					try {
						this.impactSynth.triggerAttackRelease(freq, "32n", this.Tone.now());
					} finally {
						releaseAudioSlot();
					}
				});
				break;
			}

			case 'enemy_shoot': {
				const freq = 200 + Math.random() * 50;
				this.enqueueAudio(() => {
					try {
						this.impactSynth.triggerAttackRelease(freq, "32n", this.Tone.now());
					} finally {
						releaseAudioSlot();
					}
				});
				break;
			}

			case 'ui': {
				this.enqueueAudio(() => {
					try {
						if (params.type === 'reload') {
							this.hackSynth.triggerAttackRelease("C3", "32n", this.Tone.now());
						} else if (params.type === 'success') {
							this.successSynth.triggerAttackRelease(params.note || "C5", params.duration || "16n", this.Tone.now());
						}
					} finally {
						releaseAudioSlot();
					}
				});
				break;
			}

			case 'elite': {
				if (!this.eliteScreech) {
					releaseAudioSlot();
					return;
				}
				const type = params.type || 'SENTRY';
				const notes = {
					'SENTRY': 'C6',
					'STALKER': 'E6',
					'TANK': 'C3',
					'SHIELD_PROJECTOR': 'G5',
					'TITAN': 'G1'
				};
				this.enqueueAudio(() => {
					try {
						this.eliteScreech.triggerAttackRelease(notes[type] || 'A5', "16n", this.Tone.now());
					} finally {
						releaseAudioSlot();
					}
				});
				break;
			}

			case 'interaction': {
				this.enqueueAudio(() => {
					try {
						this.tacticalHandshake.triggerAttackRelease(params.notes?.[0] || "C5", "64n", this.Tone.now());
					} finally {
						releaseAudioSlot();
					}
				});
				break;
			}
			case 'hazard': {
				this.enqueueAudio(() => {
					try {
						if (params.type === 'neural') {
							this.hackSynth.triggerAttackRelease(params.note || "F3", "16n", this.Tone.now());
						} else if (params.type === 'heat') {
							this.impactSynth.triggerAttackRelease(params.note || "G2", "16n", this.Tone.now());
						}
					} finally {
						releaseAudioSlot();
					}
				});
				break;
			}
			case 'perk': {
				this.enqueueAudio(() => {
					try {
						if (params.type === 'sniffer') {
							this.successSynth.triggerAttackRelease("C6", "32n", this.Tone.now());
						} else if (params.type === 'multiplier') {
							this.successSynth.triggerAttackRelease("G6", "32n", this.Tone.now());
						}
					} finally {
						releaseAudioSlot();
					}
				});
				break;
			}
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
            return;
        }

        // 5. Try interacting with lore terminal
        if (this.map && this.map.dataTerminals) {
            for (const t of this.map.dataTerminals) {
                if (!t.isInteracted && this.player.mesh.position.distanceTo(t.group.position) < 3) {
                    t.interact();
                    return;
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
        
        if (this.playerController) this.playerController.isLocked = true;
        
        const ui = document.getElementById('neural-sync-ui');
        if (ui) ui.style.display = 'block';
        if (document.pointerLockElement) document.exitPointerLock();
        this.toggleMobileControls(false);
        
        // Start Worklet Audio
        if (this.synergyNode) {
            this.synergyNode.port.postMessage({ type: 'SET_SYNCING', payload: true });
            this.synergyNode.port.postMessage({ type: 'SET_GLITCH', payload: 0 });
        }
        
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
        
        // Audio modulation: Frequency of player tone depends on current rotation of active ring
        if (this.synergyNode) {
            const currentRotation = this.ringRotations[this.syncLevel - 1] || 0;
            const normRotation = ((currentRotation % 360) + 360) % 360;
            const freq = 220 + (normRotation / 360) * 440; // Variable tone
            this.synergyNode.port.postMessage({ type: 'UPDATE_PLAYER_FREQ', payload: freq });
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
            
            this.playArbiterSound('ui', { type: 'success', note: 200 + this.syncLevel * 100, duration: "16n" });
            
            if (this.synergyNode) {
                this.synergyNode.port.postMessage({ type: 'SET_RING_LOCKED', payload: { index: ringIdx, locked: true } });
            }

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
                core.classList.add('glitch-active');
                core.style.background = '#ff0000';
                setTimeout(() => {
                    core.style.background = '#00ffaa';
                    core.classList.remove('glitch-active');
                }, 200);
            }
            this.playArbiterSound('ui', { type: 'success', note: 100, duration: "8n" });
            
            if (this.synergyNode) {
                this.synergyNode.port.postMessage({ type: 'SET_GLITCH', payload: 0.5 });
                setTimeout(() => this.synergyNode.port.postMessage({ type: 'SET_GLITCH', payload: 0 }), 300);
            }
        }
    }

    updateNeuralSyncUI() {
        const status = document.getElementById('sync-status');
        if (status) status.innerText = `ALIGNMENT: STAGE ${Math.min(3, this.syncLevel)} / 3`;
    }

    completeNeuralSync(success) {
        this.isNeuralSyncing = false;
        
        // Stop Worklet Audio
        if (this.synergyNode) {
            this.synergyNode.port.postMessage({ type: 'SET_SYNCING', payload: false });
        }
        
        const ui = document.getElementById('neural-sync-ui');
        if (ui) ui.style.display = 'none';
        
        // Clean up classes for next time
        for(let i=1; i<=3; i++) {
            const el = document.getElementById(`sync-ring-${i}`);
            if (el) el.classList.remove('locked');
        }

        if (success) {
            if (!('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
                this.renderer.domElement.requestPointerLock();
            }
            this.toggleMobileControls(true);
            this.startTerminalHack(this.currentTerminal);
        } else {
            if (this.playerController) this.playerController.isLocked = false;
            if (!('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
                this.renderer.domElement.requestPointerLock();
            }
            this.toggleMobileControls(true);
        }
    }

    async startTerminalHack(terminal) {
        const Tone = await import('tone');
        if (Tone.getContext().state !== 'running') await Tone.start();
        
        this.isHackingTerminal = true;
        this.currentTerminal = terminal;
        this.terminalHackProgress = 0;
        this.hackingWavesTriggered = [false, false, false];
        
        if (this.playerController) this.playerController.isLocked = true;
        
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

		// 🚫 NEW RULE: if chamber is cleared → block hacking wave spawns too
		if (chamber.isCleared) return;

    // NEW: don't spawn hacking waves in a chamber that is cleared + firewall bypassed
		if (chamber.firewallBypassed && chamber.isCleared) return;

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

                const enemy = this.enemyPool.acquire(this.scene, this.player, spawnPos, type, this.currentFacility?.id || 'meridian', this.navigation, this.particleSystem, this.heatLevel, isElite);
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
        this.playArbiterSound('ui', { type: 'interaction', note: ["G3", "G4"], duration: "8n" });
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

        // Interactive audio feedback - Throttled by Arbiter
        if (!this.terminalBlocked && Math.random() < 0.1) {
            const notes = ["C5", "D5", "E5", "G5"];
            const note = notes[Math.floor(Math.random() * notes.length)];
            this.playArbiterSound('ui', { type: 'interaction', note: note, duration: "32n" });
        } else if (this.terminalBlocked && Math.random() < 0.05) {
            this.playArbiterSound('ui', { type: 'interaction', note: "C2", duration: "16n" }); // Warning low note
        }

        // Cancel if too far
        if (this.currentTerminal) {
            const dist = this.player.mesh.position.distanceTo(this.currentTerminal.mesh.position);
            if (dist > 6) { // Increased leash slightly
                this.isHackingTerminal = false;
                if (this.playerController) this.playerController.isLocked = false;
                
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
            if (this.playerController) this.playerController.isLocked = false;
            
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
        if (chamber) {
			chamber.firewallBypassed = true;
			}
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

    setBossGlitch(intensity) {
        if (this.synergyNode) {
            this.synergyNode.port.postMessage({ type: 'SET_GLITCH', payload: intensity });
        }
    }

    triggerEliteSound(type) {
        this.playArbiterSound('elite', { type });
        
        // Visual glitch effect when an elite sound plays
        this.heatVisuals.glitchIntensity = Math.max(this.heatVisuals.glitchIntensity, 0.4);
    }

    triggerNeuralLinkMalfunction() {
        if (this.isMalfunctioning) return;
        this.isMalfunctioning = true;
        this.malfunctionTimer = this.malfunctionDuration;
        
        // Start high-pitched biip
        if (this.malfunctionSynth) {
            this.malfunctionSynth.start();
            this.malfunctionSynth.volume.rampTo(-15, 0.1);
        }
        
        // Visual warning
        const warning = document.getElementById('malfunction-warning');
        if (warning) warning.style.display = 'block';

        const glitch = document.getElementById('heat-glitch-overlay');
        if (glitch) glitch.classList.add('malfunction');

        const ui = document.getElementById('ui');
        if (ui) ui.classList.add('malfunction');

        this.showProgressionMessage("CRITICAL: NEURAL LINK MALFUNCTION DETECTED");
        this.heatVisuals.glitchIntensity = 1.0;
        this.shakeAmount = 1.5;
    }

    spawnFinalBoss() {
        this.finalBossSpawned = true;
        this.finalBossAlive = true;
        
        const chamber = this.map.chambers[this.currentChamberIndex];
        
        // Spawn TITAN in the center of the arena
        const spawnPos = new THREE.Vector3(chamber.x, 0, chamber.z);
        
        const bossType = this.currentFacility?.bossType || 'TITAN';
        const boss = this.enemyPool.acquire(this.scene, this.player, spawnPos, bossType, this.currentFacility?.id || 'meridian', this.navigation, this.particleSystem, this.heatLevel, false);
        boss.onDeath = (e) => {
            this.finalBossAlive = false;
            this.handleEnemyDeath(e);
            this.showProgressionMessage(`${bossType.replace('_', ' ')} DESTROYED - SERVER SPINE BREACHED - EXTRACTION PORTAL INITIALIZING`);
            
            // Drop Legendary Loot
            const dropPos = e.mesh.position.clone();
            dropPos.y = 1.0;
            this.pickups.push(new DataCore(this.scene, dropPos, 10)); // 10 Tech Cores value
            
            // Unlock Achievement
            this.unlockAchievement('TITAN SLAYER', 'Defeat the Final Facility Overseer.');

            // Hide boss health
            const healthUI = document.getElementById('boss-health-container');
            if (healthUI) healthUI.style.display = 'none';
            
            // Activate Portal
            setTimeout(() => {
                this.map.extractionPortal?.activate();
                this.playArbiterSound('ui', { type: 'success', note: "C6", duration: "1n" });
            }, 2000);
        };
        boss.onSingularityDetonate = (e, type) => this.handleSingularityDetonate(e, type);
        this.enemies.push(boss);
        
        this.showProgressionMessage(`CRITICAL THREAT DETECTED: ${bossType.replace('_', ' ')}-CLASS OVERSEER ENGAGED`);
        this.playArbiterSound('elite', { type: bossType === 'CLOAK_MASTER' ? 'STALKER' : 'TANK' });
        
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
        if (name) {
            const bossDisplayName = boss.type.replace('_', ' ');
            name.innerText = `${bossDisplayName} - ${this.currentFacility?.name || 'SECURITY CORE'}`;
        }
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
		if (!chamber) return;

		// 🔥 NEW — absolute rule: Cleared = ZERO spawns
		if (chamber.isCleared) return;

		if (chamber.enemiesSpawned >= this.enemiesPerChamber) return;

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

        const enemy = this.enemyPool.acquire(this.scene, this.player, spawnPos, type, this.currentFacility?.id || 'meridian', this.navigation, this.particleSystem, this.heatLevel, isElite);
        enemy.onDeath = (e) => this.handleEnemyDeath(e);
        enemy.onSingularityDetonate = (e, type) => this.handleSingularityDetonate(e, type);
        this.enemies.push(enemy);
        this._raycastTargetsDirty = true;
        chamber.enemiesSpawned++;
    }

    spawnAllyDrone(position = null) {
        const chamber = this.map.chambers[this.currentChamberIndex];
        const spawnPos = position || new THREE.Vector3(
            this.player.mesh.position.x + (Math.random() - 0.5) * 10,
            1.8,
            this.player.mesh.position.z + (Math.random() - 0.5) * 10
        );

        // Swarm Drones are specialized Sentry units — acquire from pool
        const drone = this.enemyPool.acquire(this.scene, this.player, spawnPos, 'SENTRY', 'ally', this.navigation, this.particleSystem, 1, true);
        drone.isAlly = true;
        if (typeof drone.createTargetingLine === 'function') {
            drone.createTargetingLine();
        }
        drone.command = 'FOLLOW';
        drone.maxHealth *= 2; // Allied drones are tougher
        drone.health = drone.maxHealth;
        
        // Inherit special elite visual immediately
        if (drone.glow) {
            drone.glow.color.set(0x00ffaa);
            drone.glow.intensity = 2.0;
        }

        drone.onDeath = (e) => this.handleEnemyDeath(e);
        drone.onSingularityDetonate = (e, type) => this.handleSingularityDetonate(e, type);
        
        this.enemies.push(drone);
        this._raycastTargetsDirty = true;
        
        this.particleSystem.createExplosion(spawnPos, 0x00ffaa, 20, 5);
        this.playArbiterSound('ui', { type: 'success', note: "C5", duration: "16n" });
        
        return drone;
    }

    handleSingularityDetonate(enemy, type = 'VOLATILE') {
        if (!enemy || !enemy.mesh) return;
        const pos = enemy.mesh.position.clone();
        
        if (type === 'NEUTRON') {
            const radius = 15;
            const damage = 500;
            const empDuration = 4000;
            let killsCount = 0;

            if (this.particleSystem && typeof this.particleSystem.createExplosion === "function") {
                this.particleSystem.createExplosion(pos, 0x00ffff, 60, 15);
                this.particleSystem.createExplosion(pos, 0xffffff, 30, 8);
                this.particleSystem.flashLight(pos, 0x00ffff, 30, radius * 2, 500);
            }

            // Damage and EMP using spatial grid
            const nearby = this.spatialGrid.getNearby(pos, radius);
            const radiusSq = radius * radius;
            nearby.forEach(e => {
                if (!e.isAlly && !e.isDead && e.mesh.position.distanceToSquared(pos) < radiusSq) {
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
                if (this.particleSystem) {
                    this.particleSystem.flashLight(this.player.mesh.position, 0x00ff00, 10, 10, 300);
                }
            }

            this.shakeAmount = Math.max(this.shakeAmount, 0.8);
            this.triggerShockwave(pos, 1.0);
        } else {
            const radius = 12;
            const damage = 300;

            if (this.particleSystem&& typeof this.particleSystem.createExplosion === "function") {
                this.particleSystem.createExplosion(pos, 0x6600ff, 40, 10);
                this.particleSystem.createExplosion(pos, 0xff0000, 20, 5);
                this.particleSystem.flashLight(pos, 0xaa00ff, 20, radius * 1.5, 400);
            }

            this.triggerShockwave(pos, 0.8);
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
            if (this.particleSystem && typeof this.particleSystem.createExplosion === "function") {
                this.particleSystem.createExplosion(pos, 0xff4400, 50, 15);
                this.particleSystem.createExplosion(pos, 0xffaa00, 30, 8);
                this.particleSystem.flashLight(pos, 0xffaa00, 20, radius * 2, 300);
            }

            // Area Damage
            this.handleAreaDamage(pos, radius, damage);
        }
    }

    checkAndSpawnPickups() {
        // Only check every few seconds
        if (Date.now() - this.lastPickupSpawnCheck < 5000) return;
        this.lastPickupSpawnCheck = Date.now();

        // PERFORMANCE FIX: Cap maximum pickups to prevent unbounded growth
        const MAX_PICKUPS = this.perfLimits.maxPickups;

        // Check each chamber to see if it's "cleared" (no enemies inside)
        for (let chamberIdx = 0; chamberIdx < this.map.chambers.length; chamberIdx++) {
            const chamber = this.map.chambers[chamberIdx];
            
            // Count enemies in chamber (avoid creating temp array with filter)
            let enemyCount = 0;
            for (let i = 0; i < this.enemies.length; i++) {
                const e = this.enemies[i];
                const dx = Math.abs(e.mesh.position.x - chamber.x);
                const dz = Math.abs(e.mesh.position.z - chamber.z);
                if (dx < chamber.size / 2 && dz < chamber.size / 2) {
                    enemyCount++;
                    if (enemyCount > 0) break; // Early exit if we found any enemy
                }
            }

            // If chamber is empty of enemies, chance to spawn a health pack or ammo crate
            if (enemyCount === 0 && Math.random() < 0.6) {
                let existingPickup = null;
                for (let i = 0; i < this.pickups.length; i++) {
                    const p = this.pickups[i];
                    const dx = Math.abs(p.mesh.position.x - chamber.x);
                    const dz = Math.abs(p.mesh.position.z - chamber.z);
                    if (dx < chamber.size / 2 && dz < chamber.size / 2) {
                        existingPickup = p;
                        break;
                    }
                }

                if (!existingPickup && this.pickups.length < MAX_PICKUPS) {
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
        }
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
        this.triggerShockwave(pos, 0.8, 1.2);
    }

    spawnHunter() {
        if (!this.map || this.enemies.some(e => e.isHunter && !e.isDead)) return;

        const playerPos = this.player.mesh.position;
        // Find a random far-ish spawn point in the current or nearby room
        const spawnPos = playerPos.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 40,
            0,
            (Math.random() - 0.5) * 40
        ));
        
        const hunter = this.enemyPool.acquire(this.scene, this.player, spawnPos, 'STALKER', this.currentFacility.id, this.navigation, this.particleSystem, this.heatLevel + 2, true);
        hunter.isHunter = true;
        hunter.moveSpeed *= 1.5;
        hunter.damage *= 2.0;
        
        // Custom death callback for Hunter
        hunter.onDeath = (e) => {
            this.showProgressionMessage("HUNTER NEUTRALIZED - SECURITY THREAT REDUCED", 3000);
            this.heatVisuals.glitchIntensity = 0;
        };

        this.enemies.push(hunter);
        this.showProgressionMessage("WARNING: EXTREME THREAT DETECTED - HUNTER INBOUND", 5000);
        this.triggerNeuralLinkMalfunction(); // Visual glitch on spawn
        
        if (this.eliteScreech) {
            this.eliteScreech.triggerAttackRelease("G5", "2n");
        }
    }

    handleBarrelExplosion(barrel) {
        if (!barrel || !barrel.parent) return; // Already destroyed

        const pos = barrel.position.clone();
        const radius = CONFIG.PLAYER.BARREL.RADIUS;
        const damage = CONFIG.PLAYER.BARREL.DAMAGE;

        if (this.particleSystem && typeof this.particleSystem.createExplosion === "function") {
            this.particleSystem.createExplosion(pos, 0xff3300, 25, 8);
            this.particleSystem.createExplosion(pos, 0xffaa00, 15, 4);
            this.particleSystem.flashLight(pos, 0xff3300, 8, 12, 150);
        }

        // Remove the barrel before processing AOE to prevent recursion issues
        this.map.destroyObject(barrel);

        // PERFORMANCE FIX: Cap fire fields to prevent unbounded growth
        const MAX_FIRE_FIELDS = this.perfLimits.maxFireFields;
        if (this.activeFireFields.length >= MAX_FIRE_FIELDS) {
            const oldest = this.activeFireFields.shift();
            oldest.destroy();
        }

        // Spawn fire field
        this.activeFireFields.push(new FireField(this.scene, pos, radius * 0.5, this.particleSystem));

        // Damage things in range
        this.handleAreaDamage(pos, radius, damage);
        
        this.shakeAmount = Math.max(this.shakeAmount, 0.4);
        this.triggerShockwave(pos, 0.6, 1.0);
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

        if (this.particleSystem && typeof this.particleSystem.createExplosion === "function") {
            this.particleSystem.createExplosion(pos, 0x00ff00, 40, 12);
            this.particleSystem.createExplosion(pos, 0xffaa00, 20, 8);
            this.particleSystem.flashLight(pos, 0x00ff33, 10, radius * 1.5, 200);
        }

        this.handleAreaDamage(pos, radius, damage);
        
        // PERFORMANCE FIX: Cap fire fields to prevent unbounded growth
        const MAX_FIRE_FIELDS = this.perfLimits.maxFireFields;
        if (this.activeFireFields.length >= MAX_FIRE_FIELDS) {
            const oldest = this.activeFireFields.shift();
            oldest.destroy();
        }
        
        this.activeFireFields.push(new FireField(this.scene, pos, radius * 0.4, this.particleSystem));
        this.shakeAmount = Math.max(this.shakeAmount, 0.7);
    }

    handleEMPExplosion(pos) {
        const radius = CONFIG.PLAYER.EMP.RADIUS;
        const duration = CONFIG.PLAYER.EMP.DURATION;

        // Visual distortion flash
        if (this.particleSystem) {
            this.particleSystem.flashLight(pos, 0x00ffff, 30, radius * 2, 300);
        }

        // Affect Enemies using spatial grid
        const nearby = this.spatialGrid.getNearby(pos, radius);
        const radiusSq = radius * radius;
        nearby.forEach(enemy => {
            if (enemy.mesh.position.distanceToSquared(pos) < radiusSq) {
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
        this.triggerShockwave(pos, 0.5, 0.5);
    }

    handleExtinguisherBurst(extProp) {
        if (!extProp || !extProp.parent) return;

        const pos = extProp.position.clone();
        const radius = CONFIG.HAZARDS.EXTINGUISHER.RADIUS;

        // Visual
        if (this.particleSystem && typeof this.particleSystem.createExplosion === "function") {
            this.particleSystem.createExplosion(pos, 0xffffff, 40, 6);
        }

        // Spawn Smoke Screen
        // PERFORMANCE FIX: Cap smoke screens to prevent unbounded growth
        const MAX_SMOKE_SCREENS = this.perfLimits.maxSmokeScreens;
        if (this.activeSmokeScreens.length >= MAX_SMOKE_SCREENS) {
            const oldest = this.activeSmokeScreens.shift();
            oldest.destroy();
        }
        
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
        
        // --- Kill Streak logic ---
        const now = Date.now();
        if (now - this.lastKillTime < this.killStreakDuration) {
            this.killStreak++;
        } else {
            this.killStreak = 1;
        }
        this.lastKillTime = now;
        if (this.killStreak > this.maxKillStreak) this.maxKillStreak = this.killStreak;

        // Data Overload: Wall-hack vision at high streaks
        if (this.killStreak % 30 === 0) {
            this.triggerDataOverload();
        }

        // Insane Moment: Frequent triggers for chaos
        if (this.killStreak === 5 || this.killStreak === 10 || this.killStreak === 15) {
            this.triggerInsaneMoment('BULLET_STORM');
        }

        if (this.killStreak % 20 === 0) {
            this.triggerInsaneMoment('SHOCKWAVE_CHAIN');
        }

        // Insane Moment: Elite Neutralized
        if (enemy.isElite || enemy.isTitan) {
            this.triggerInsaneMoment('ELITE_NEUTRALIZED');
        }

        // Track for daily challenge
        if (this.dailyChallengeManager) {
            this.dailyChallengeManager.track('kills');
            if (this.killStreak >= 10) this.dailyChallengeManager.track('streak', this.killStreak);
        }

        // Use Loot Manager for drops
        if (this.lootManager) {
            this.lootManager.handleEnemyDeath(enemy);
        }

        // Random chance for tech core (auto-pickup)
        if (Math.random() < 0.2) {
            this.techCores++;
            if (this.dailyChallengeManager) this.dailyChallengeManager.track('cores');
        }
        
        // Update score and UI
        this.player.score += (enemy.scoreValue || 100) * (1 + (this.killStreak * 0.1)); // Streak score bonus
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
                        if (this.particleSystem && typeof this.particleSystem.createExplosion === "function") {
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
        
        if (this.playerController) this.playerController.isLocked = true;
        
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
        
        if (this.playerController) this.playerController.isLocked = false;
        
        const ui = document.getElementById('hacking-ui');
        if (ui) ui.style.display = 'none';

        if (success && this.hackingDrone) {
            this.hackingDrone.isAlly = true;
            
            // Meta Upgrade: Drone Efficiency
            if (this.metaUpgrades.drone_efficiency > 0) {
                const buff = 1 + this.metaUpgrades.drone_efficiency * 0.25;
                this.hackingDrone.maxHealth *= buff;
                this.hackingDrone.health = this.hackingDrone.maxHealth;
                this.hackingDrone.damage *= buff;
                
                // Visual indicator for buffed ally
                if (this.hackingDrone.glow) {
                    this.hackingDrone.glow.intensity *= 2;
                }
            }

            this.hackingDrone.isDisabled = false; // Wake up immediately
            this.hackingDrone.command = 'FOLLOW';
            this.player.score += 500;
            this.player.updateUI();
            
            // Visual burst for success
            this.particleSystem.createExplosion(this.hackingDrone.mesh.position, 0x00ff00, 20, 5);

            // Ability Steal System
            if (this.abilityManager) {
                this.abilityManager.acquire(this.hackingDrone.type);
            }
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

    updateEnemyStatsCache() {
        if (this.enemyStatsCache.frame === this.frameCounter) return;

        let aliveHostiles = 0;
        let aliveAllies = 0;
        let nearestAlly = null;
        let nearestAllyDistSq = 100;
        const nearbyShieldedEnemies = [];
        const playerPos = this.player?.mesh?.position;

        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (e.isDead || !e.mesh) continue;

            if (e.isAlly) {
                aliveAllies++;
                if (playerPos) {
                    const dSq = e.mesh.position.distanceToSquared(playerPos);
                    if (dSq < nearestAllyDistSq) {
                        nearestAllyDistSq = dSq;
                        nearestAlly = e;
                    }
                }
            } else {
                aliveHostiles++;
                if (playerPos && (e.shieldHealth > 0 || e.hasProjectedShield)) {
                    const dSq = e.mesh.position.distanceToSquared(playerPos);
                    if (dSq < 64) nearbyShieldedEnemies.push({ enemy: e, dSq });
                }
            }
        }

        this.enemyStatsCache.frame = this.frameCounter;
        this.enemyStatsCache.aliveHostiles = aliveHostiles;
        this.enemyStatsCache.aliveAllies = aliveAllies;
        this.enemyStatsCache.nearestAlly = nearestAlly;
        this.enemyStatsCache.nearbyShieldedEnemies = nearbyShieldedEnemies;
    }

    updateRadar() {
        if (this.gameState !== 'PLAYING') return;
        
        const radarCanvas = document.getElementById('radar-canvas');
        if (!radarCanvas) return;
        const ctx = radarCanvas.getContext('2d');
        if (!ctx) return;

        // Throttled UI update
        if (Date.now() - this.radarUpdateTimer < 150) return;
        this.radarUpdateTimer = Date.now();

        // Clear canvas
        ctx.clearRect(0, 0, radarCanvas.width, radarCanvas.height);

        const radarRadius = 60; // half of radar-ui size (120px)
        let detectionRadius = 40; // Meters to show on radar

        // Meta Upgrade: Tactical Scanner
        if (this.metaUpgrades.tactical_scanner > 0) {
            detectionRadius += this.metaUpgrades.tactical_scanner * 20;
        }

        const playerPos = this.player.mesh.position;
        const playerRot = this.cameraController.rotationY;
        const nearby = this.spatialGrid.getNearby(playerPos, detectionRadius);
        const detectionRadiusSq = detectionRadius * detectionRadius;

        // Draw dots on canvas
        for (let i = 0; i < nearby.length; i++) {
            const e = nearby[i];
            if (e.isDead || !e.mesh) continue;

            const relX = e.mesh.position.x - playerPos.x;
            const relZ = e.mesh.position.z - playerPos.z;
            
            // Rotate based on player heading
            const rotatedX = relX * Math.cos(playerRot) - relZ * Math.sin(playerRot);
            const rotatedZ = relX * Math.sin(playerRot) + relZ * Math.cos(playerRot);

            const distSq = rotatedX * rotatedX + rotatedZ * rotatedZ;
            if (distSq < detectionRadiusSq) {
                const dist = Math.sqrt(distSq);
                const screenX = radarRadius + (rotatedX / detectionRadius) * radarRadius;
                const screenZ = radarRadius + (rotatedZ / detectionRadius) * radarRadius;
                
                ctx.beginPath();
                ctx.arc(screenX, screenZ, 2, 0, Math.PI * 2);
                
                if (e.isAlly) {
                    ctx.fillStyle = '#00d0ff';
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = '#00d0ff';
                } else {
                    ctx.fillStyle = '#ff4400';
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = '#ff4400';
                    
                    if (!this.player.isThermalActive && this.heatLevel < 3 && dist > 15) {
                        ctx.globalAlpha = 0.4;
                    }
                }
                
                ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.shadowBlur = 0;
            }
        }
    }

    handleObjectDestruction(obj) {
        if (!obj) return;
        
        // Visuals
          const isMonitor = obj.userData.isMonitor;
        const color = isMonitor ? 0x00ffff : 0x444444;

        // Safe particle calls
        if (this.particleSystem) {
            if (typeof this.particleSystem.createExplosion === "function") {
                // main impact burst
                this.particleSystem.createExplosion(obj.position, color, 15, 3);

                // extra glass/spark burst only for monitors
                if (isMonitor) {
                    this.particleSystem.createExplosion(obj.position, 0xffffff, 5, 10);
                }
            }

            if (typeof this.particleSystem.createDebris === "function") {
                this.particleSystem.createDebris(
                    obj.position,
                    color,
                    8,
                    isMonitor ? "MONITOR" : "GENERIC"
                );
            }
        }

        this.shakeAmount = Math.max(this.shakeAmount, isMonitor ? 0.5 : 0.3);
        
        // Sounds - with slight throttle check
        const now = this.Tone ? this.Tone.now() : Date.now() / 1000;
        if (this.impactSynth && now - this.lastHitSoundTime > 0.05) {
            this.impactSynth.triggerAttackRelease(isMonitor ? "C4" : "C2", "8n", now);
            this.lastHitSoundTime = now;
        }

        // Logic
        this.scene.remove(obj);
        // Remove from raycast targets
        this.raycastTargets = this.raycastTargets.filter(t => t !== obj);
    }

    handlePipeHit(pipe, point) {
        if (!pipe) return;

        const isGasPipe = pipe.userData.isGasPipe || pipe.userData.isGasTriggered !== undefined;

        if (pipe.material) {
            if (isGasPipe) {
                pipe.material.color.set(0x00ff00);
                pipe.material.emissive?.set(0x003300);
            } else {
                pipe.material.color.set(0xffaa00);
                pipe.material.emissive?.set(0x332200);
            }
        }

        if (this.particleSystem?.createSteamCloud) {
            this.particleSystem.createSteamCloud(point, isGasPipe ? 0x00ff00 : 0xdddddd, 10);
        }

        if (isGasPipe) {
            if (pipe.userData.isGasTriggered) return;

            pipe.userData.isGasTriggered = true;

            const MAX_GAS_LEAKS = this.perfLimits.maxGasLeaks;
            if (this.activeGasLeaks.length >= MAX_GAS_LEAKS) {
                const oldest = this.activeGasLeaks.shift();
                oldest.destroy();
            }

            const leak = new GasLeak(this.scene, point, this.particleSystem);
            this.activeGasLeaks.push(leak);
        } else {
            if (this.particleSystem?.createExplosion) {
                this.particleSystem.createExplosion(point, 0xffffff, 8, 5);
            }
            if (this.particleSystem?.createTracer) {
                this.particleSystem.createTracer(point, point.clone().add(new THREE.Vector3(Math.random() - 0.5, 2, Math.random() - 0.5)), 0x00ffff, 0.5);
            }
        }

        if (this.particleSystem?.createDebris) {
            this.particleSystem.createDebris(point, 0x888888, 3, 'PIPE');
        }

        this.shakeAmount = Math.max(this.shakeAmount, isGasPipe ? 0.1 : 0.2);

        const now = this.Tone ? this.Tone.now() : Date.now() / 1000;
        if (this.impactSynth && now - this.lastHitSoundTime > 0.05) {
            this.impactSynth.triggerAttackRelease(isGasPipe ? "G2" : "G4", "16n", now);
            this.lastHitSoundTime = now;
        }
    }

    issueCommand(command) {
        if (command === 'CANCEL') return;
        if (command === 'TECH_INVENTORY') {
            this.toggleInventory(true);
            return;
        }

        // Trigger Tactical Handshake audio
        this.playArbiterSound('interaction');

        if (command.startsWith('STANCE_')) {
            const stance = command.split('_')[1].toLowerCase();
            this.enemies.forEach(e => {
                if (e.isAlly && !e.isDead) {
                    if (e.setStance) e.setStance(stance);
                }
            });
            this.showProgressionMessage(`DRONE SQUAD: ${stance.toUpperCase()} MODE ACTIVE`);
            this.playArbiterSound('ui', { type: 'success', note: "C5", duration: "16n" });
            this.selectedCommand = null;
            return;
        }

        let targetPos = null;
        let targetEnemy = null;

        // Perform raycast to find target or position
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        
        // We want to check enemies first for STRIKE, otherwise floor/walls
        // PERFORMANCE FIX: Avoid chained filter().map().filter() - create arrays efficiently
        const enemiesHitboxes = [];
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (!e.isDead && !e.isAlly) {
                const hitbox = e.mesh.getObjectByName('hitbox');
                if (hitbox) enemiesHitboxes.push(hitbox);
            }
        }
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
        if (this.frameCounter % 10 !== 0) return; // Strictly throttle to 10% of frames
        const chamber = this.map.chambers[this.currentChamberIndex];
        const bar = document.getElementById('chamber-progress-bar');
        const label = document.getElementById('chamber-progress-label');
        if (!chamber || !bar || !label) return;

        this.updateEnemyStatsCache();
        const enemiesAlive = this.enemyStatsCache.aliveHostiles;
        const enemiesKilled = Math.max(0, chamber.enemiesSpawned - enemiesAlive);
        const totalEnemies = this.enemiesPerChamber;
        
        let progressPercent = Math.min(100, (enemiesKilled / totalEnemies) * 100);
        
        if (this.chamberClearingStatus === 'CLEARED' || this.chamberClearingStatus === 'UNLOCKED') {
            progressPercent = 100;
        }

        const nextWidth = `${progressPercent}%`;
        if (bar.style.width !== nextWidth) bar.style.width = nextWidth;
        
        let nextText = '';
        let nextColor = '#00ffaa';
        if (this.chamberClearingStatus === 'CLEARED') {
            nextText = `CHAMBER ${this.currentChamberIndex + 1} SECURED - ACCESS TERMINAL`;
            nextColor = '#ffff00';
        } else if (this.chamberClearingStatus === 'UNLOCKED') {
            nextText = `CHAMBER ${this.currentChamberIndex + 1} UNLOCKED - PROCEED TO EXIT`;
            nextColor = '#00ffff';
        } else {
            nextText = `CHAMBER ${this.currentChamberIndex + 1} INTEGRITY: ${Math.floor(100 - progressPercent)}%`;
        }

        if (label.innerText !== nextText) label.innerText = nextText;
        if (label.style.color !== nextColor) label.style.color = nextColor;
        if (bar.style.background !== nextColor) bar.style.background = nextColor;
		this.updateDroneHUD();					  
    }

	updateDroneHUD() {
        const droneHUD = document.getElementById('drone-status-hud');
        if (!droneHUD) return;
        
        const droneCountVal = document.getElementById('drone-count-val');
        const droneMissionVal = document.getElementById('drone-mission-val');
        
        let allyCount = 0;
        let firstAlly = null;
        let hunting = false;

        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (e.isAlly && !e.isDead) {
                allyCount++;
                if (!firstAlly) firstAlly = e;
                if (this.isHackingTerminal && e.targetEnemy && (e.targetEnemy.type === 'STALKER' || e.targetEnemy.isElite || e.targetEnemy.isTitan)) {
                    hunting = true;
                }
            }
        }

        if (allyCount === 0) {
            droneHUD.style.display = 'none';
            return;
        }

        droneHUD.style.display = 'block';
        if (droneCountVal) droneCountVal.innerText = `ACTIVE UNITS: ${allyCount}`;

        if (droneMissionVal) {
            if (this.isHackingTerminal) {
                if (hunting) {
                    droneMissionVal.innerText = 'STATUS: NEURAL LINK HUNT ACTIVE';
                    droneMissionVal.style.color = '#ff4400';
                } else {
                    droneMissionVal.innerText = 'STATUS: DEFENDING TERMINAL';
                    droneMissionVal.style.color = '#00ffff';
                }
            } else if (firstAlly) {
                droneMissionVal.innerText = `STATUS: ${firstAlly.command}`;
                droneMissionVal.style.color = '#00ffaa';
            }
        }
    }
    hitFeedback(intensity = 1.0, isKill = false) {
        this.shakeAmount = Math.max(this.shakeAmount, 0.2 * intensity);
        
        // Slight slowdown on hits (0.9x)
        this.targetTimeScale = isKill ? 0.5 : 0.9;
        this.hitSlowdownTimer = isKill ? 0.15 : 0.05;
        
        // Chromatic aberration spike
        this.chromaticAberration = Math.max(this.chromaticAberration, 0.3 * intensity);
        
        // Bloom spike
        this.bloomIntensity = Math.max(this.bloomIntensity, 1.5 * intensity);

        // Subtle ripple on hit
        this.rippleIntensity = Math.max(this.rippleIntensity, 0.15 * intensity);
    }

    updateEnvironmentalSoundscape(deltaTime) {
        if (!this.Tone || this.Tone.getContext().state !== 'running') return;

        let nearestHazardDistSq = Infinity;
        let nearestHazardType = null;
        const playerPos = this.player.mesh.position;

        // Find nearest active hazard
        if (this.map && this.map.hazards) {
            this.map.hazards.forEach(hazard => {
                let isActive = false;
                let hazardPos = null;

                if (hazard.type === 'VOLTAGE') {
                    isActive = hazard.isActive;
                    hazardPos = hazard.group ? hazard.group.position : hazard.mesh.position;
                } else if (hazard.type === 'CRYO_VENT' || (hazard.instance && hazard.type === 'CRYO_VENT')) {
                    const inst = hazard.instance || hazard;
                    isActive = inst.isActive;
                    hazardPos = inst.position || inst.mesh.position;
                }

                if (isActive && hazardPos) {
                    const dSq = playerPos.distanceToSquared(hazardPos);
                    if (dSq < nearestHazardDistSq) {
                        nearestHazardDistSq = dSq;
                        nearestHazardType = hazard.type;
                    }
                }
            });
        }

        // Update hazard hum/hiss based on distance
        if (nearestHazardDistSq < 400) { // 20m range
            const dist = Math.sqrt(nearestHazardDistSq);
            const volume = THREE.MathUtils.lerp(-10, -60, dist / 20);
            if (this.hazardHiss) {
                this.hazardHiss.volume.rampTo(volume, 0.1);
                // Adjust frequency based on type
                const freq = nearestHazardType === 'VOLTAGE' ? 120 : 400;
                this.hazardHiss.frequency.rampTo(freq, 0.1);
            }
        } else {
            if (this.hazardHiss) this.hazardHiss.volume.rampTo(-Infinity, 0.5);
        }

        // Update Shield Hum
        if (this.player.hasProjectedShield) {
            if (this.shieldHum) this.shieldHum.volume.rampTo(-25, 0.2);
        } else {
            if (this.shieldHum) this.shieldHum.volume.rampTo(-Infinity, 0.5);
        }
    }

    updateAdaptiveResolution(deltaTime) {
        if (this.frameCounter % 60 !== 0) return; // Only check every 60 frames

        const fps = 1 / deltaTime;
        const currentPixelRatio = this.renderer.getPixelRatio();
        
        if (fps < 50 && currentPixelRatio > 0.5) {
            const nextRatio = Math.max(0.5, currentPixelRatio - 0.25);
            this.renderer.setPixelRatio(nextRatio);
            this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        }
    }

    showLoreEntry(entry) {
        if (!entry) return;
        this.loreRecoveredCount++; // Increment recovered count
        this.playArbiterSound('perk', { type: 'multiplier' });
        
        const ui = document.getElementById('lore-ui');
        const title = document.getElementById('lore-title');
        const author = document.getElementById('lore-author');
        const content = document.getElementById('lore-content');
        
        if (ui && title && author && content) {
            const hex = `#${this.facilityAccentColor.getHexString()}`;
            title.innerText = `DATA LOG: ${entry.title.toUpperCase()}`;
            title.style.color = hex;
            title.style.borderColor = hex;
            
            author.innerText = `[ ARCHIVE SOURCE: ${entry.author.toUpperCase()} ]`;
            author.style.color = hex;
            author.style.opacity = 0.6;
            
            content.innerText = ''; // Clear first
            content.style.color = hex;
            
            ui.style.display = 'flex';
            ui.children[0].style.borderColor = hex; // The container
            
            // Exit pointer lock to allow closing
            if (document.pointerLockElement) document.exitPointerLock();
            if (this.playerController) this.playerController.isLocked = true;
            
            // Typewriter effect for lore
            let charIdx = 0;
            const typeLore = () => {
                if (ui.style.display === 'none') return;
                if (charIdx < entry.content.length) {
                    content.innerText += entry.content[charIdx];
                    charIdx++;
                    if (charIdx % 3 === 0) this.playArbiterSound('interaction', { notes: ["C6"] });
                    setTimeout(typeLore, 10);
                }
            };
            typeLore();
            
            this.playArbiterSound('ui', { type: 'success', note: "C5", duration: "8n" });
        }
    }

    handleTerminalTrap(terminal) {
        this.showProgressionMessage("CRITICAL ERROR: SECURITY TRAP TRIGGERED!");
        this.triggerNeuralLinkMalfunction();
        this.shakeAmount = 2.0;
        
        // Spawn immediate security wave
        const chamber = this.map.chambers[this.currentChamberIndex];
        if (chamber) {
            for (let i = 0; i < 4; i++) {
                setTimeout(() => this.spawnEnemy(), i * 200);
            }
        }
        
        // Sound spike
        if (this.Tone) {
            this.playArbiterSound('ui', { type: 'success', note: "C1", duration: "4n" });
            if (this.eliteScreech) this.eliteScreech.triggerAttackRelease("C2", "4n");
        }
    }

    triggerDataOverload() {
        if (this.dataOverloadActive) return;
        this.dataOverloadActive = true;
        this.dataOverloadTimer = 10.0; // 10 seconds of wall-hack

        this.showProgressionMessage("NEURAL OVERLOAD: DATA SYNC STABILIZED - ALL HOSTILES TAGGED", 4000);
        this.playArbiterSound('ui', { type: 'success', note: "C7", duration: "2n" });
        this.player.toggleThermal(); // Automatically activate thermal for the duration
        
        if (this.synergyNode) {
            this.synergyNode.port.postMessage({ type: 'SET_AMBIENT', payload: 0.2 }); // Louder hum
        }
    }

    update(deltaTime) {
        // Data Overload Update
        if (this.dataOverloadActive) {
            this.dataOverloadTimer -= deltaTime;
            if (this.dataOverloadTimer <= 0) {
                this.dataOverloadActive = false;
                if (this.player.isThermalActive) this.player.toggleThermal();
                if (this.synergyNode) {
                    this.synergyNode.port.postMessage({ type: 'SET_AMBIENT', payload: 0.05 });
                }
            }
        }

        if (this.startupGraceFrames > 0) {
            this.startupGraceFrames--;
        }
        
        // Update Resolution and Soundscape
        if (!this.startupWarmupActive || this.frameCounter % 30 === 0) {
            this.updateAdaptiveResolution(deltaTime);
        }
        if (!this.startupWarmupActive || this.frameCounter % 6 === 0) {
            this.updateEnvironmentalSoundscape(deltaTime);
        }
        if (!this.startupWarmupActive || this.frameCounter % 6 === 0) {
            this.updateProgressionAtmosphere(deltaTime);
        }

        // Update Juice Visuals
        if (this.hitSlowdownTimer > 0) {
            this.hitSlowdownTimer -= deltaTime;
            if (this.hitSlowdownTimer <= 0) {
                this.targetTimeScale = 1.0;
            }
        }
        
        // Smooth time scale
        this.timeScale = THREE.MathUtils.lerp(this.timeScale, this.targetTimeScale, deltaTime * 10);
        
        // Smooth out effects
        this.chromaticAberration = THREE.MathUtils.lerp(this.chromaticAberration, 0, deltaTime * 5);
        this.bloomIntensity = THREE.MathUtils.lerp(this.bloomIntensity, 1.0, deltaTime * 3);
        this.saturation = THREE.MathUtils.lerp(this.saturation, 1.0, deltaTime * 2);
        this.rippleIntensity = THREE.MathUtils.lerp(this.rippleIntensity, 0, deltaTime * 4);
        this.radialBlurIntensity = THREE.MathUtils.lerp(this.radialBlurIntensity, 0, deltaTime * 5);
        
        // Shockwave Animation logic
        let shockwaveBaseFreq = 0.05;
        if (this.shockwaveActive) {
            this.shockwaveTime += deltaTime;
            const t = Math.min(this.shockwaveTime / this.shockwaveDuration, 1.0);
            
            // Peak Moment (0-20% of duration is the "snap")
            const peakFactor = Math.max(0, 1.0 - (t * 5.0)); // Rapidly drops after t=0.2
            if (peakFactor > 0) {
                // Apply a sharp camera kick during the peak window
                this.shakeAmount = Math.max(this.shakeAmount, this.shockwaveKickIntensity * peakFactor);
            }

            // Shockwave starts with tight waves (high freq) and expands to wide waves (low freq)
            shockwaveBaseFreq = 0.25 - (0.24 * t);
            
            // Add a slight decay to the overall rippleIntensity during shockwave
            // to ensure it clears out properly even if multiple events happen
            const shockwaveDecay = 1.0 - t;
            this.rippleIntensity = Math.max(this.rippleIntensity, shockwaveDecay * 0.8);
            
            if (t >= 1.0) {
                this.shockwaveActive = false;
            }
        }

        // Apply visual effects via CSS filter on the renderer element - CONSOLIDATED & THROTTLED
        // SIGNIFICANTLY REDUCED FILTERS: Removed Blur and SVG Ripple as they kill GPU/Compositor
        if (this.lastFilterString !== 'none') {
            this.renderer.domElement.style.filter = 'none';
            this.lastFilterString = 'none';
        }
        
        // Removed Radial Blur (backdrop-filter) logic as it is a massive GPU bottleneck.
        const rbOverlay = document.getElementById('radial-blur-overlay');
        if (rbOverlay && rbOverlay.style.display !== 'none') {
            rbOverlay.style.display = 'none';
        }
        
        // Glitch intensity maps to chromatic aberration in the shader if available, 
        // but let's use it for the aberration variable too
        this.heatVisuals.glitchIntensity = Math.max(this.heatVisuals.glitchIntensity, this.chromaticAberration);

        // Update Roguelike Systems
        if (this.roguelikeManager) this.roguelikeManager.update(deltaTime);
        if (this.abilityManager) this.abilityManager.update(deltaTime);
        
        // PERFORMANCE FIX: Deferred storage save to avoid blocking game loop
        if (this._metaStateDirty && !this._storageSaveScheduled) {
            this._storageSaveScheduled = true;
            setTimeout(() => {
                this._saveMetaStateDeferred();
                this._metaStateDirty = false;
                this._storageSaveScheduled = false;
            }, 50);
        }
        
        // Update Malfunction
        if (this.isMalfunctioning) {
            this.malfunctionTimer -= deltaTime;
            this.heatVisuals.glitchIntensity = Math.max(this.heatVisuals.glitchIntensity, 0.9);
            this.shakeAmount = Math.max(this.shakeAmount, 0.5);
            
            // Randomly flash warning
            const warning = document.getElementById('malfunction-warning');
            if (warning) {
                warning.style.display = Math.random() > 0.3 ? 'block' : 'none';
                warning.style.left = `${50 + (Math.random() - 0.5) * 5}%`;
                warning.style.top = `${20 + (Math.random() - 0.5) * 5}%`;
            }

            if (this.malfunctionTimer <= 0) {
                this.isMalfunctioning = false;
                if (this.malfunctionSynth) {
                    this.malfunctionSynth.volume.rampTo(-Infinity, 0.5);
                    setTimeout(() => {
                        if (this.malfunctionSynth) this.malfunctionSynth.stop();
                    }, 600);
                }
                const warning = document.getElementById('malfunction-warning');
                if (warning) warning.style.display = 'none';
                const glitch = document.getElementById('heat-glitch-overlay');
                if (glitch) glitch.classList.remove('malfunction');
                const ui = document.getElementById('ui');
                if (ui) ui.classList.remove('malfunction');
            }
        }

        if (this.gameState !== 'PLAYING' && !this.isNeuralSyncing) {
            // Lower ambient when not playing
            if (this.ambientHum) this.ambientHum.volume.rampTo(-60, 0.5);
            if (this.ambientAir) this.ambientAir.volume.rampTo(-80, 0.5);
            
            // Avoid burning CPU/GPU on menu/briefing screens.
            if (this.cameraController && this.frameCounter % 6 === 0) this.cameraController.update();
            return;
        } else {
            if (this.ambientHum) this.ambientHum.volume.rampTo(-45, 0.5);
            if (this.ambientAir) this.ambientAir.volume.rampTo(-65, 0.5);
        }

        // --- Kill Streak Logic ---
        const now = Date.now();
        if (this.killStreak > 0) {
            const timeSinceLastKill = now - this.lastKillTime;
            const streakHUD = document.getElementById('kill-streak-hud');
            const streakVal = document.getElementById('kill-streak-val');
            const streakBar = document.getElementById('kill-streak-bar');
            
            if (timeSinceLastKill >= this.killStreakDuration) {
                this.killStreak = 0;
                if (streakHUD) streakHUD.style.display = 'none';
            } else {
                if (streakHUD) {
                    streakHUD.style.display = 'block';
                    if (streakVal) streakVal.innerText = this.killStreak;
                    if (streakBar) {
                        const percent = 1 - (timeSinceLastKill / this.killStreakDuration);
                        streakBar.style.width = `${percent * 100}%`;
                    }
                }
            }
        }

        // --- Endless Scaling ---
        this.difficultyMultiplier = 1.0;
        if (this.currentChamberIndex >= 50) {
            this.difficultyMultiplier = 1.0 + (this.currentChamberIndex - 49) * 0.1;
        }

        // --- Daily Challenge HUD ---
            if (this.dailyChallengeManager) {
            this.dailyChallengeManager.update(deltaTime);
            this.dailyChallengeManager.track('room', this.currentChamberIndex + 1);
        }

        // Apply Mutator Effects
        if (this.gameState === 'PLAYING' && this.currentFacility) {
            const mutator = this.currentFacility.mutator;
            if (mutator === 'ATMOSPHERIC_INSTABILITY') {
                // Slight constant damage
                this.player.takeDamage(1 * deltaTime, true, 'rgba(0, 255, 255, 0.1)');
            } else if (mutator === 'DATA_STORM') {
                // Occasional extra glitching
                if (Math.random() < 0.005) { // 0.5% chance per frame
                    this.triggerNeuralLinkMalfunction();
                }
                if (this.dataStormStatic) {
                    this.dataStormStatic.volume.rampTo(-60, 0.5);
                }
            } else if (mutator === 'HEAT_DAMAGE') {
                // Thermal attrition: damage increases if not sprinting
                const dmgBase = this.playerController.isSprinting ? 1 : 4;
                this.player.takeDamage(dmgBase * deltaTime, true, 'rgba(255, 68, 0, 0.1)');
                if (this.frameCounter % 60 === 0) {
                    this.playArbiterSound('hazard', { type: 'heat', note: "G2" });
                }
            } else {
                if (this.dataStormStatic) {
                    this.dataStormStatic.volume.rampTo(-Infinity, 0.5);
                }
            }
        }

        // Update Radar HUD - Performance: Throttled harder during startup warmup
        const radarThrottle = this.startupWarmupActive ? 45 : 15;
        if (this.frameCounter % radarThrottle === 0) {
            this.updateRadar();
        }

        // --- Heat System Update ---
        if (this.gameState === 'PLAYING') {
            const elapsed = Date.now() - this.missionStartTime;
            const newHeat = Math.min(CONFIG.HEAT.MAX_LEVEL, 1 + Math.floor(elapsed / CONFIG.HEAT.LEVEL_UP_INTERVAL));
            
            if (newHeat > this.heatLevel) {
                this.heatLevel = newHeat;
                this.showProgressionMessage(`SECURITY LEVEL INCREASED: HEAT LEVEL ${this.heatLevel}`);
                
                // Spawn Hunter at high heat
                if (this.heatLevel >= 4) {
                    this.spawnHunter();
                }
                
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
            if ((this.startupGraceFrames <= 0) && Date.now() - (this.deploymentTime || 0) > 1000) {
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

        // Update Doors in current/nearby chambers only
        const current = this.currentChamberIndex;
        this.map.doors.forEach(d => {
            if (current === null || Math.abs(d.chamberIndex - current) <= 1) {
                d.update(deltaTime);
            }
        });

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

        // Update active disruptors
        this.updateDisruptors(deltaTime);
        this.updateBullets(deltaTime);

        // Update Map Props (Server Rack Flickers, etc)
        this.map.update(deltaTime, this.player?.mesh?.position);

        // Progress logic
        const currentChamber = this.map.chambers[this.currentChamberIndex];
        if (currentChamber) {
            // Chamber clearing check (PERFORMANCE FIX: avoid creating temp array with filter)
            if (this.chamberClearingStatus === 'ACTIVE') {
                let enemiesInChamber = 0;
                for (let i = 0; i < this.enemies.length; i++) {
                    const e = this.enemies[i];
                    if (!e.isAlly && !e.isDead) enemiesInChamber++;
                }
                if (currentChamber.enemiesSpawned >= this.enemiesPerChamber && enemiesInChamber === 0) {
                    this.chamberClearingStatus = 'CLEARED';
                    currentChamber.isCleared = true;
                    this.showProgressionMessage("CHAMBER SECURED - LOCATE TERMINAL TO OVERRIDE LOCKS");
                }
            }
        }

        // Show interaction prompts - Throttled (every 10 frames)
        if (this.frameCounter % 15 === 0) {
            this.performProximityChecks();
            this.updateChamberHUD();
        }

        this.frameCounter++;

        // Hacking UI update
        if (this.isHacking) {
            this.hackingNeedleRotation += this.hackingNeedleSpeed * deltaTime;
            const needleEl = document.getElementById('hacking-needle');
            if (needleEl && this.frameCounter % 2 === 0) needleEl.style.transform = `translate(-50%, -100%) rotate(${this.hackingNeedleRotation}deg)`;
        }

        // Handle Extinguisher Spray
        if (this.player.currentWeaponKey === 'EXTINGUISHER' && this.mouseIsDown) {
            this.player.spray(deltaTime, this.activeFireFields, this.map.barrels, this.map.hazards);
        } else if (this.mouseIsDown && this.gameState === 'PLAYING' && !this.adService.adInProgress) {
            // Automatic Weapon Firing
            if (this.player.currentWeaponKey !== 'TURRET') {
                this.player.shoot(this.raycastTargets, (pos, dir, type) => {
                    const t = new Turret(this.scene, pos, dir, this.particleSystem, type);
                    this.turrets.push(t);
                });
            }
            this.player.isSpraying = false;
        } else {
            this.player.isSpraying = false;
        }

        // Update Environmental Hazards 2.0 - Throttled (every 3 frames)
        let targetMoveSpeed = CONFIG.PLAYER.MOVE_SPEED;
        if (this.map.hazards && this.frameCounter % 6 === 0) {
            const hazards = this.map.hazards;
            const hazardStep = Math.max(1, Math.ceil(hazards.length / this.perfLimits.maxHazardChecksPerFrame));
            for (let h = this.frameBuckets.hazard; h < hazards.length; h += hazardStep) {
                const hazard = hazards[h];
                if (!hazard) continue;

                if (hazard.update) {
                    const envTakeDamage = (amt, isDOT) => this.player.takeDamage(amt, isDOT, 'rgba(0, 150, 255, 0.4)');
                    hazard.update(deltaTime * 6, this.player.mesh.position, envTakeDamage);
                }
                
                if (hazard.instance && hazard.instance.update) {
                    hazard.instance.update(deltaTime * 6, this.player, this.enemies, this.gameState === 'PLAYING');
                }
                
                if (!hazard.isActive) continue;

                if (hazard.type === 'VOLTAGE') {
                    const hazardPos = hazard.group ? hazard.group.position : hazard.mesh.position;
                    const distSq = this.player.mesh.position.distanceToSquared(hazardPos);
                    const rad = hazard.radius || 1.8;
                    if (distSq < rad * rad) {
                        if (this.gameState === 'PLAYING' && Date.now() - (hazard.lastTick || 0) > 800) {
                            this.player.takeDamage(hazard.damage || 25, true, 'rgba(0, 150, 255, 0.4)');
                            hazard.lastTick = Date.now();
                            this.shakeAmount = Math.max(this.shakeAmount, 0.3);
                        }
                    }
                } else if (hazard.type === 'CRYO' || (hazard.instance && hazard.instance.isActive && hazard.type === 'CRYO_VENT')) {
                    const hazardPos = hazard.group ? hazard.group.position : (hazard.position || hazard.mesh.position);
                    const rad = hazard.radius || 2.5;
                    if (this.player.mesh.position.distanceToSquared(hazardPos) < rad * rad && this.gameState === 'PLAYING') {
                        targetMoveSpeed = CONFIG.PLAYER.MOVE_SPEED * (hazard.slowFactor || 0.5);
                    }
                } else if (hazard.type === 'PHASE_GATE' && hazard.state === 'ACTIVE') {
                    const playerPos = this.player.mesh.position;
                    const hazardPos = hazard.group.position;
                    const beamY = hazardPos.y + 1.5;
                    
                    if (Math.abs(playerPos.y - beamY) < 1.0) {
                        const dx = Math.abs(playerPos.x - hazardPos.x);
                        const dz = Math.abs(playerPos.z - hazardPos.z);
                        const chamber = this.map.chambers[hazard.index];
                        const size = chamber ? chamber.size : 20;
                        const halfBeam = (size - 4) / 2;
                        
                        let isInside = false;
                        if (hazard.isH) {
                            if (dx < halfBeam && dz < 0.5) isInside = true;
                        } else {
                            if (dz < halfBeam && dx < 0.5) isInside = true;
                        }
                        
                        if (isInside && this.gameState === 'PLAYING' && Date.now() - (hazard.lastTick || 0) > 500) {
                            this.player.takeDamage(20, true, 'rgba(255, 0, 255, 0.4)');
                            hazard.lastTick = Date.now();
                            this.shakeAmount = Math.max(this.shakeAmount, 0.5);
                            this.triggerNeuralLinkMalfunction();
                        }
                    }
                }
            }
            this.frameBuckets.hazard = (this.frameBuckets.hazard + 1) % Math.max(1, this.perfLimits.maxHazardChecksPerFrame);
            this.playerController.moveSpeed = targetMoveSpeed;
        }

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

            // Damage enemies - Optimized using spatial grid (use indexed loop)
            const nearbyEnemies = this.spatialGrid.getNearby(fire.position, fire.radius + 2);
            for (let j = 0; j < nearbyEnemies.length; j++) {
                const enemy = nearbyEnemies[j];
                if (!enemy.isDead && fire.checkCollision(enemy.mesh.position)) {
                    enemy.takeDamage(fireDamage);
                }
            }

            // Ignite gas leaks if fire field overlaps - Throttled check (use indexed loop)
            if (this.frameCounter % 5 === 0) {
                for (let j = 0; j < this.activeGasLeaks.length; j++) {
                    const leak = this.activeGasLeaks[j];
                    if (!leak.isExploded && fire.checkCollision(leak.position)) {
                        this.handleGasIgnite(leak);
                    }
                }
            }
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
            
            // Optimization: Only pass nearby walls for collision detection
            let walls = [];
            if (this.map && this.map.walls && this.map.spatialGrid) {
                const cur = this.currentChamberIndex;
                const indices = new Set();
                
                // Check current and neighboring chambers
                [cur, cur - 1, cur + 1].forEach(idx => {
                    if (this.map.spatialGrid.has(idx)) {
                        this.map.spatialGrid.get(idx).forEach(wallIdx => indices.add(wallIdx));
                    }
                });
                
                indices.forEach(wallIdx => {
                    const w = this.map.walls[wallIdx];
                    if (w) walls.push(w);
                });
            }
            
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

        // Determine current chamber index based on player position - more aggressively throttled
        if (this.frameCounter % 12 === 0) {
            const curPos = this.player.mesh.position;
            let detectedChamber = null;
            for (let i = 0; i < this.map.chambers.length; i++) {
                const c = this.map.chambers[i];
                if (Math.abs(curPos.x - c.x) < c.size / 2 + 5 && Math.abs(curPos.z - c.z) < c.size / 2 + 5) {
                    detectedChamber = c;
                    break;
                }
            }
            
            const newChamberIndex = detectedChamber ? detectedChamber.index : null;
            if (newChamberIndex !== null && newChamberIndex !== this.currentChamberIndex) {
                this.currentChamberIndex = newChamberIndex;
                const chamber = this.map.chambers[this.currentChamberIndex];
                
                const roomEl = document.getElementById('room-indicator');
                if (roomEl) roomEl.innerText = `ROOM: ${this.currentChamberIndex + 1}`;
                
                if (chamber && !chamber.isCleared) {
                    this.chamberClearingStatus = 'ACTIVE';
                    this.enemiesPerChamber = this.currentFacility.enemies + (this.currentChamberIndex * 2);
                    if (chamber.isVault) this.enemiesPerChamber += 4;
                    
                    this.showProgressionMessage(chamber.isVault ? `WARNING: BREACHING HIGH-SECURITY VAULT` : `ENTERING CHAMBER ${this.currentChamberIndex + 1}`);
                    
                    if (this.currentChamberIndex === CONFIG.MAP.NUM_ROOMS - 1 && !this.finalBossSpawned) {
                        this.spawnFinalBoss();
                    }
                } else if (chamber && chamber.isCleared) {
                    this.chamberClearingStatus = chamber.firewallBypassed ? 'UNLOCKED' : 'CLEARED';
                }
            }
        }

        // Performance: cull off-screen chamber geometry periodically
        const chamberCullFrame = this.startupWarmupActive ? 1 : 10;
        if (this.frameCounter % chamberCullFrame === 0 && this.map && typeof this.map.setChamberVisibility === 'function') {
            this.map.setChamberVisibility(this.currentChamberIndex, this.cullingRadius);
        }

        // Player state for swaying/bobbing
        const isMoving = this.playerController.velocity.x !== 0 || this.playerController.velocity.z !== 0;
        this.player.update(deltaTime, isMoving, this.mouseDelta, this.raycastTargets);
        
        // Reset mouse delta after passing it to player update
        this.mouseDelta = { x: 0, y: 0 };

        // Spawn Enemies
        this.updateEnemyStatsCache();
        let activeEnemies = this.enemyStatsCache.aliveHostiles;
        const roomSpawnScalar = Math.max(0, this.currentChamberIndex - 10) * 50;
        const currentSpawnRate = Math.max(900, CONFIG.ENEMY.SPAWN_RATE - (this.heatLevel - 1) * CONFIG.HEAT.SPAWN_RATE_REDUCTION_PER_LEVEL - roomSpawnScalar);
        const maxActive = Math.min(this.perfLimits.maxEnemies, (CONFIG.ENEMY.MAX_ACTIVE || 12) + Math.floor(this.currentChamberIndex / 6));
        
        if (activeEnemies < maxActive && Date.now() - this.lastEnemySpawn > currentSpawnRate) {
            this.spawnEnemy();
            this.lastEnemySpawn = Date.now();
        }

        // Update Extraction Portal
        if (this.map.extractionPortal && this.map.extractionPortal.mesh.visible) {
            this.map.extractionPortal.update(deltaTime);
            const dist = this.player.mesh.position.distanceTo(this.map.extractionPortal.mesh.position);
            
            if (dist < 12 && this.gameState === 'PLAYING') {
                const collapseFactor = 1.0 - THREE.MathUtils.clamp((dist - 3) / 9, 0, 1);
                this.heatVisuals.glitchIntensity = Math.max(this.heatVisuals.glitchIntensity, collapseFactor * 0.8);
                this.shakeAmount = Math.max(this.shakeAmount, collapseFactor * 1.5);
                
                if (collapseFactor > 0.5 && Math.random() < 0.05) {
                    this.playArbiterSound('ui', { type: 'interaction', note: "C7", duration: "64n" });
                }

                if (collapseFactor > 0.8) {
                    const warning = document.getElementById('malfunction-warning');
                    if (warning) {
                        warning.innerText = "CRITICAL LINK COLLAPSE - EXTRACTION PORTAL REACHED";
                        warning.style.display = 'block';
                        warning.style.color = '#00ffff';
                    }
                }
            }

            if (dist < 3 && this.gameState === 'PLAYING') {
                const warning = document.getElementById('malfunction-warning');
                if (warning) warning.style.display = 'none';
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
                } else if (typeof pickup.collect === 'function') {
                    pickup.collect();
                }
                if (pickup.destroy) pickup.destroy();
                this.pickups.splice(i, 1);
            }
        }

        // --- Performance: Advanced Light Culling (use indexed loops) ---
        if (this.frameCounter % 45 === 0) {
            const current = this.currentChamberIndex;
            // Toggle chamber lights based on proximity
            for (let idx = 0; idx < this.missionLights.length; idx++) {
                const light = this.missionLights[idx];
                // Show lights for current chamber and neighbors
                light.visible = (current !== null && Math.abs(idx - current) <= 1);
            }
            // Toggle map lights (corridors, etc) - Optimized: using lights array instead of all walls
            for (let j = 0; j < this.map.lights.length; j++) {
                const light = this.map.lights[j];
                const lIdx = light.userData.chamberIndex;
                light.visible = (current === null || (lIdx !== undefined && Math.abs(lIdx - current) <= 1));
            }

            // Toggle server rack lights for performance
            for (let j = 0; j < this.map.destructibleProps.length; j++) {
                const p = this.map.destructibleProps[j];
                if (p.type === 'SERVER_RACK' && p.light) {
                    const pIdx = p.chamberIndex;
                    p.light.visible = !p.isDead && (current === null || (pIdx !== undefined && Math.abs(pIdx - current) <= 1));
                }
            }
        }

        // Update Turrets - Throttled (every 2 frames)
        for (let i = this.turrets.length - 1; i >= 0; i--) {
            const turret = this.turrets[i];
            if ((this.frameCounter + i) % 2 === 0) {
                turret.update(deltaTime * 2, this.enemies, this.spatialGrid);
            }
            if (turret.isDead) {
                this.turrets.splice(i, 1);
            }
        }

        // Reset enemy transient factors before update
        this.player.isPhased = false; // Reset player phase
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (!e.isAlly) {
                e.gravityWellFactor = 1.0;
                e.timeScale = 1.0;
                e.resonanceOwner = null;
            } else {
                e.isPhased = false; // Reset ally drone phase
            }
        }

        // Update Enemies
        const MAX_LOGIC_UPDATES_PER_FRAME = this.perfLimits.maxEnemyLogicUpdatesPerFrame;
        let logicUpdatesThisFrame = 0;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            if (!enemy.isDead) {
                // Register in spatial grid - spread out over 4 frames
                if ((this.frameCounter + i) % 4 === 0) {
                    this.spatialGrid.updateEntity(enemy);
                }
            } else {
                this.spatialGrid.removeEntity(enemy);
            }

            // Only perform heavy AI logic if within cap or if enemy is close to player
            const distSq = enemy.mesh.position.distanceToSquared(this.player.mesh.position);
            const isNear = distSq < 400; // 20m
            
            if (isNear || logicUpdatesThisFrame < MAX_LOGIC_UPDATES_PER_FRAME) {
                enemy.update(deltaTime, this.player.mesh.position, this.activeSmokeScreens, this.player.isThermalActive, this.enemies, this.turrets, this.map, this.spatialGrid, this.frameCounter);
                if (!isNear) logicUpdatesThisFrame++;
            }
            
            if (this.finalBossAlive && enemy.type === 'HEAVY_SEC_BOT' && this.currentChamberIndex === CONFIG.MAP.NUM_ROOMS - 1) {
                this.updateBossHealthUI(enemy);
            }

            if (enemy.isDead && (enemy.deathTimer === undefined || enemy.deathTimer <= 0)) {
                this.enemies.splice(i, 1);
                this.enemyPool.release(enemy); // Recycle to pool instead of discarding
            }
        }

        // Periodically refresh raycast targets to account for enemy movement and destruction
        if (this._raycastTargetsDirty || this.frameCounter % 60 === 0) {
            this.refreshRaycastTargets();
            this._raycastTargetsDirty = false;
        }

        // --- Audio Proximity Updates (Throttled) - Use indexed loops ---
        if (this.frameCounter % 5 === 0) {
            if (this.hazardHiss) {
                let maxHiss = -Infinity;
                // Check hazards from map in vicinity
                const currentHazards = (this.map.hazards || []).filter(h => {
                   const hPos = h.position || (h.group ? h.group.position : (h.mesh ? h.mesh.position : null));
                   return hPos && hPos.distanceToSquared(this.player.mesh.position) < 400; // 20m range
                });

                // PERFORMANCE FIX: Use indexed loop instead of forEach
                const allHazards = [...this.activeGasLeaks, ...currentHazards];
                for (let j = 0; j < allHazards.length; j++) {
                    const h = allHazards[j];
                    const hPos = h.position || (h.group ? h.group.position : (h.mesh ? h.mesh.position : null));
                    if (!hPos) continue;
                    const d = this.player.mesh.position.distanceTo(hPos);
                    if (d < 10) {
                        const vol = THREE.MathUtils.lerp(-100, -35, 1.0 - (d / 10)); // Keep -100 here for lerp base
                        maxHiss = Math.max(maxHiss, vol);
                    }
                }
                this.hazardHiss.volume.rampTo(maxHiss, 0.2);
            }

            if (this.shieldHum) {
                let maxHum = -Infinity;
                // Player shield
                if (this.player.hasProjectedShield) maxHum = -35;
                // Enemy shields in vicinity - reuse cache built for this frame
                this.updateEnemyStatsCache();
                const shielded = this.enemyStatsCache.nearbyShieldedEnemies;
                for (let j = 0; j < shielded.length; j++) {
                    const d = Math.sqrt(shielded[j].dSq);
                    const vol = THREE.MathUtils.lerp(-100, -40, 1.0 - (d / 8));
                    maxHum = Math.max(maxHum, vol);
                }
                this.shieldHum.volume.rampTo(maxHum, 0.2);
            }

            if (this.portalRumble) {
                let portalVol = -Infinity;
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

    updateProgressionAtmosphere(deltaTime) {
        if (this.gameState !== 'PLAYING') return;

        const progression = (this.currentChamberIndex + 1) / (CONFIG.MAP.NUM_ROOMS || 50);
        
        // Ramping toward facility accent color as we approach the Core
        if (this.ambientLight) {
            const baseAmbientColor = new THREE.Color(0xcccccc);
            const targetColor = baseAmbientColor.clone().lerp(this.facilityAccentColor, progression);
            this.ambientLight.color.lerp(targetColor, deltaTime * 0.1);
        }

        if (this.scene.fog) {
            const baseFogColor = new THREE.Color(0x0a0a0c);
            const targetFogColor = baseFogColor.clone().lerp(this.facilityAccentColor, progression);
            this.scene.fog.color.lerp(targetFogColor, deltaTime * 0.1);
            this.scene.background.lerp(targetFogColor, deltaTime * 0.1);
            
            const baseDensity = 0.02;
            const targetDensity = baseDensity + (progression * 0.04); // Slightly thicker
            this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, targetDensity, deltaTime * 0.1);
        }

        // --- Sensory Ramping ---
        // As we get closer to the core, the link becomes more unstable (chromatic aberration & glitch)
        const linkInstability = Math.max(0, (progression - 0.5) * 2.0); // Starts at 50% through the run
        if (linkInstability > 0) {
            const noise = (Math.random() - 0.5) * linkInstability * 0.05;
            this.chromaticAberration = Math.max(this.chromaticAberration, linkInstability * 0.15 + noise);
            
            // Random link "flicker" near the end
            if (progression > 0.9 && Math.random() < 0.01) {
                this.triggerNeuralLinkMalfunction(0.5);
            }
        }
    }

    syncCSSTeamColor() {
        const color = this.facilityAccentColor;
        const hex = `#${color.getHexString()}`;
        document.documentElement.style.setProperty('--meridian-blue', hex);
        document.documentElement.style.setProperty('--crosshair-color', `rgba(${color.r*255}, ${color.g*255}, ${color.b*255}, 1)`);
        
        // Update specific UI elements if needed
        const roomIndicator = document.getElementById('room-indicator');
        if (roomIndicator) roomIndicator.style.color = hex;
        
        const operatorHud = document.getElementById('operator-hud');
        if (operatorHud) operatorHud.style.color = hex;

        const bar = document.getElementById('chamber-progress-bar');
        if (bar) bar.style.backgroundColor = hex;

        const perkScreen = document.getElementById('perk-screen');
        if (perkScreen) {
            perkScreen.style.background = `radial-gradient(circle, rgba(${color.r*255}, ${color.g*255}, ${color.b*255}, 0.2) 0%, rgba(0, 0, 0, 0.95) 100%)`;
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
        
        if (this.ambientLight) {
            this.ambientLight.intensity = THREE.MathUtils.lerp(this.ambientLight.intensity, this.heatVisuals.targetAmbientIntensity, deltaTime * 0.5);
        }

        // 3. Screen-space Filters (CSS) - Integrated into main update loop for consistency

        // 4. Glitch and Vignette
        const vignette = document.getElementById('heat-vignette');
        if (vignette && this.frameCounter % 10 === 0) {
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
        
        // Google AdSense: Trigger an interstitial on successful extraction
        this.adService.showInterstitial({
            name: 'extraction_success',
            adBreakDone: () => {
                this.gameState = 'EXTRACTION';
                if (document.pointerLockElement) document.exitPointerLock();

                this.hideAllScreens();
                const screen = document.getElementById('extraction-screen');
                const chambersEl = document.getElementById('extract-chambers');
                const scoreEl = document.getElementById('extract-score');
                const metaEl = document.getElementById('extract-meta');
                const totalEl = document.getElementById('meta-total');

                const chambersBreached = this.currentChamberIndex + 1;
                const totalChambers = CONFIG.MAP.NUM_ROOMS;
                
                // Calculate meta-credits: 10% of score + bonus for full clear + lore bonus
                const loreBonusMultiplier = 1.0 + (this.loreRecoveredCount * 0.05); // 5% per lore recovered
                const baseMeta = Math.floor(this.player.score * 0.1);
                const fullClearBonus = (chambersBreached === totalChambers ? 500 : 0);
                const metaEarned = Math.floor((baseMeta + fullClearBonus) * loreBonusMultiplier);
                
                this.metaCredits += metaEarned;
                localStorage.setItem('chamber_breach_meta_credits', this.metaCredits.toString());

                if (chambersEl) chambersEl.innerText = `${chambersBreached} / ${totalChambers}`;
                if (scoreEl) {
                    scoreEl.innerHTML = `${this.player.score.toLocaleString()}<br><span style="font-size: 12px; color: #00ffff;">DATA RECOVERY BONUS: x${loreBonusMultiplier.toFixed(2)}</span>`;
                }
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
                
                this.saveToLeaderboard();

                const now = this.Tone ? this.Tone.now() : undefined;
                this.successSynth?.triggerAttackRelease("C5", "4n", now);
            }
        });
    }

    getUpgradeBonusText(id, level) {
        if (level === 0) return "";
        switch(id) {
            case 'health': return `+${level * 20} HP`;
            case 'ammo': return `+${level} MAGS`;
            case 'cores': return `+${level} CORES`;
            case 'scrap': return `+${level * 100} SCRAP`;
            case 'rifle_ricochet': return `RICOCHET ACTIVE`;
            case 'rifle_pierce': return `ARMOR PIERCE ACTIVE`;
            case 'sniper_pierce': return `PIERCE +${level}`;
            case 'sniper_recall': return `RECALL ACTIVE`;
            case 'synergy_duration': return `+${level * 2}s SHIELD`;
            case 'synergy_potency': return `+${level * 20}% SYNERGY`;
            case 'omega_turret_mastery': return `OMEGA UNLOCKED`;
            case 'flash_freeze_mastery': return `FREEZE UNLOCKED`;
            default: return "";
        }
    }

    showDeathScreen() {
        if (this.gameState === 'DEAD') return;

        // Google AdSense: Trigger an interstitial on game over
        this.adService.showInterstitial({
            name: 'game_over',
            adBreakDone: () => {
                this.gameState = 'DEAD';
                if (document.pointerLockElement) document.exitPointerLock();

                this.hideAllScreens();
                const screen = document.getElementById('death-screen');
                const chambersEl = document.getElementById('death-chambers');
                const scoreEl = document.getElementById('death-score');
                const scrapLostEl = document.getElementById('death-scrap-lost');

                const chambersBreached = this.currentChamberIndex + 1;
                const totalChambers = CONFIG.MAP.NUM_ROOMS;

                if (chambersEl) chambersEl.innerText = `${chambersBreached} / ${totalChambers}`;
                if (scoreEl) scoreEl.innerText = this.player.score.toLocaleString();
                if (scrapLostEl) scrapLostEl.innerText = this.scrap.toLocaleString();

                const reviveContainer = document.getElementById('revive-container');
                if (reviveContainer) {
                    reviveContainer.style.display = this.canRevive ? 'block' : 'none';
                }

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

                this.saveToLeaderboard();

                const now = this.Tone ? this.Tone.now() : undefined;
                this.impactSynth?.triggerAttackRelease("C2", "2n", now);
                if (this.shootSynth) {
                    this.shootSynth.triggerAttackRelease("1n", now);
                }

                const overlay = document.getElementById('death-glitch-overlay');
                if (overlay) {
                    let flickerCount = 0;
                    const flickerInterval = setInterval(() => {
                        overlay.style.opacity = Math.random() * 0.2;
                        if (++flickerCount > 20) clearInterval(flickerInterval);
                    }, 50);
                }
            }
        });
    }

    startGame() {
        if (!this.currentFacility) {
            console.warn('Cannot start game: No facility selected.');
            return;
        }
        
        console.log('Starting Breach Mission...');
        this.hideAllScreens();
        
        this.startupGraceFrames = 180;
        this.startupWarmupActive = true;
        this.cullingRadius = 1;
        this.consecutiveSpikes = 0;
        this.panicModeActive = false;
        
        // Ensure UI is visible
        const uiOverlay = document.getElementById('ui');
        if (uiOverlay) {
            uiOverlay.style.opacity = '1';
            uiOverlay.style.pointerEvents = 'none';
            uiOverlay.style.display = 'block'; // Ensure it's not display:none
        }
        
        // Set state
        this.gameState = 'PLAYING';
        this.missionStartTime = Date.now();
        this.deploymentTime = Date.now();
        
        // Reset player state for mission
        this.player.health = this.player.maxHealth;
        this.player.isDead = false;
        this.player.updateUI();
        
        // Unlock controls
        if (this.playerController) {
            this.playerController.isLocked = false;
            this.playerController.keys = {}; 
        }
        
        if (this.cameraController) {
            this.cameraController.enable();
        }

        // Lock pointer
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.requestPointerLock();
        }
        
        this.toggleMobileControls(true);
        
        // Start the first room spawning
        this.chamberClearingStatus = 'ACTIVE';
        this.lastEnemySpawn = Date.now();
        
        this.playArbiterSound('ui', { type: 'success', note: "C5", duration: "4n" });
        
        setTimeout(() => {
            this.startupWarmupActive = false;
            this.cullingRadius = 2;
        }, 3000);
        
        // Ensure ambient audio starts
        if (this.ambientHum) this.ambientHum.volume.rampTo(-45, 1);
        if (this.ambientAir) this.ambientAir.volume.rampTo(-65, 1);
        
        this.showProgressionMessage(`MISSION START: ${this.currentFacility.name.toUpperCase()}`);
    }

    revivePlayer() {
        this.gameState = 'PLAYING';
        this.canRevive = false; // Only once
        this.player.health = this.player.maxHealth;
        this.player.isDead = false;
        this.player.updateUI();
        
        document.getElementById('death-screen').style.display = 'none';
        document.getElementById('ui').style.opacity = '1';
        
        const rewardAd = document.getElementById('reward-ad-container');
        if (rewardAd) rewardAd.style.display = 'block';

        // Visual Thermal Pulse
        this.particleSystem.createThermalPulse(this.player.mesh.position, 12, 0xffaa00);
        
        // Screen Flash
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.background = '#ffaa00';
        flash.style.opacity = '0.5';
        flash.style.pointerEvents = 'none';
        flash.style.zIndex = '9999';
        document.body.appendChild(flash);
        setTimeout(() => {
            flash.style.transition = 'opacity 0.5s ease-out';
            flash.style.opacity = '0';
            setTimeout(() => flash.remove(), 500);
        }, 100);

        // Brief invulnerability or clear nearby enemies
        const enemies = this.spatialGrid.getNearby(this.player.mesh.position, 12);
        enemies.forEach(e => {
            if (!e.isAlly && !e.isDead) {
                e.takeDamage(250); // Massive damage pulse
            }
        });
        
        this.renderer.domElement.requestPointerLock();
        this.playArbiterSound('ui', { type: 'success', note: "G4", duration: "4n" });
        this.playArbiterSound('interaction', { type: 'impact', notes: ["C2", "G2"] }); // Deep rumble
        
        console.log('Operator Revived via Secondary Link Buffer.');
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
        this.cleanupAudio();
        // Re-initialize audio if Tone was already loaded
        if (this.Tone) {
            this.setupAudio(this.Tone);
        }
        
        if (this.playerController) this.playerController.isLocked = false;
        
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

        // Clear scene objects — recycle enemies to pool
        this.enemyPool.releaseAll(this.enemies);
        this.enemies = [];

        if (this.projectilePool) this.projectilePool.releaseAll();

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
        // Hard cap + tighter radius to prevent unbounded per-frame searching
        const MAX_CHECKS_PER_FRAME = 50;
        const DETECTION_RADIUS = 12;
        const DETECTION_RADIUS_SQ = DETECTION_RADIUS * DETECTION_RADIUS;
        let checksPerformed = 0;
        
        if (!this.player || !this.player.mesh || !this.map) return;
        const playerPos = this.player.mesh.position;
        const curIdx = this.currentChamberIndex;

        const withinLimit = () => checksPerformed < MAX_CHECKS_PER_FRAME;
        const recordCheck = () => { checksPerformed++; };

        let nearTerminal = false;
        for (const terminal of this.map.terminals) {
            if (!withinLimit()) break;
            if (!terminal || terminal.isUsed || Math.abs(terminal.chamberIndex - curIdx) > 1) continue;
            recordCheck();
            if (playerPos.distanceToSquared(terminal.mesh.position) < DETECTION_RADIUS_SQ) {
                nearTerminal = true;
                break;
            }
        }
        if (this.uiPrompts.terminal) this.uiPrompts.terminal.style.display = nearTerminal ? 'block' : 'none';

        let nearShop = false;
        for (const shopTerm of this.map.shopTerminals) {
            if (!withinLimit()) break;
            if (Math.abs(shopTerm.chamberIndex - curIdx) > 1) continue;
            recordCheck();
            if (playerPos.distanceToSquared(shopTerm.mesh.position) < DETECTION_RADIUS_SQ) {
                nearShop = true;
                break;
            }
        }
        if (this.uiPrompts.shop) this.uiPrompts.shop.style.display = nearShop ? 'block' : 'none';

        let nearTurret = false;
        for (const t of this.turrets) {
            if (!withinLimit()) break;
            recordCheck();
            if (playerPos.distanceToSquared(t.mesh.position) < DETECTION_RADIUS_SQ) {
                nearTurret = true;
                break;
            }
        }
        if (this.uiPrompts.turret) this.uiPrompts.turret.style.display = nearTurret ? 'block' : 'none';

        let canHack = false;
        const nearby = this.spatialGrid.getNearby(playerPos, DETECTION_RADIUS);
        for (let i = 0; i < nearby.length && withinLimit(); i++) {
            const e = nearby[i];
            if (!e.isDisabled || e.isAlly || e.isDead) continue;
            recordCheck();
            if (playerPos.distanceToSquared(e.mesh.position) < DETECTION_RADIUS_SQ) {
                canHack = true;
                break;
            }
        }
        if (this.uiPrompts.hack) this.uiPrompts.hack.style.display = (canHack && !this.isHacking) ? 'block' : 'none';

        let nearLore = false;
        if (this.map && this.map.dataTerminals) {
            for (const t of this.map.dataTerminals) {
                if (!withinLimit()) break;
                if (!t.isInteracted) {
                    recordCheck();
                    if (playerPos.distanceToSquared(t.group.position) < DETECTION_RADIUS_SQ) {
                        nearLore = true;
                        break;
                    }
                }
            }
        }
        if (this.uiPrompts.lore) this.uiPrompts.lore.style.display = nearLore ? 'block' : 'none';
    }

    updateLightCulling() {
        if (!this.player || !this.player.mesh || !this.map) return;
        
        const playerPos = this.player.mesh.position;
        const cullingDistanceSq = 2500; // 50 units radius squared
        const currentChamber = this.currentChamberIndex;

        // 1. Gather all potential point lights
        // We'll look into missionLights (map) AND scan for any other dynamic lights like enemy glows
        const candidateLights = [];
        
        // Mission lights from the map
        for (let i = 0; i < this.missionLights.length; i++) {
            const light = this.missionLights[i];
            if (!light) continue;
            
            const distSq = light.position.distanceToSquared(playerPos);
            const chamberIndex = light.userData.chamberIndex;
            const isNearbyChamber = (chamberIndex !== undefined) && Math.abs(chamberIndex - currentChamber) <= 1;
            
            if (distSq < cullingDistanceSq || isNearbyChamber) {
                candidateLights.push({ light, distSq: distSq * 0.5 }); // Prioritize map lights slightly
            } else {
                if (typeof light.intensity === 'number') light.intensity = 0;
                light.visible = true;
            }
        }

        // Enemy glows and prop lights - Use indexed loop for performance
        for (let j = 0; j < this.enemies.length; j++) {
            const e = this.enemies[j];
            if (!e.isDead) {
                if (e.glow) {
                    const distSq = e.mesh.position.distanceToSquared(playerPos);
                    if (distSq < 1600) { // 40m
                        candidateLights.push({ light: e.glow, distSq });
                    } else {
                        if (e.glow && typeof e.glow.intensity === 'number') e.glow.intensity = 0;
                        if (e.glow) e.glow.visible = true;
                    }
                }
                if (e.rageLight) {
                    const distSq = e.mesh.position.distanceToSquared(playerPos);
                    if (distSq < 2500) {
                        candidateLights.push({ light: e.rageLight, distSq: distSq * 0.8 }); // Rage lights are more important
                    } else {
                        if (typeof e.rageLight.intensity === 'number') e.rageLight.intensity = 0;
                        e.rageLight.visible = true;
                    }
                }
            }
        }

        // Collect other tagged lights (DestructibleProps etc.) - Use indexed loop
        for (let j = 0; j < this.map.destructibleProps.length; j++) {
            const p = this.map.destructibleProps[j];
            if (p.light && !p.isDead) {
                const distSq = p.mesh.position.distanceToSquared(playerPos);
                if (distSq < 900) { // 30m
                    candidateLights.push({ light: p.light, distSq });
                } else {
                    if (typeof p.light.intensity === 'number') p.light.intensity = 0;
                    p.light.visible = true;
                }
            }
        }

        // Collect flash lights from particle system - Use indexed loop
        if (this.particleSystem && this.particleSystem.allCreatedLights) {
            // These are already in the scene, we just need to check if they are currently active (intensity > 0)
            const allLights = this.particleSystem.allCreatedLights;
            for (let j = 0; j < allLights.length; j++) {
                const l = allLights[j];
                if (l.intensity > 0) {
                    const distSq = l.position.distanceToSquared(playerPos);
                    candidateLights.push({ light: l, distSq: distSq * 0.1 }); // High priority for flashes
                }
            }
        }


        // 2. Sort all candidates by distance
        candidateLights.sort((a, b) => a.distSq - b.distSq);
        
        // SIGNIFICANTLY REDUCED LIGHT CAP: Forward rendering is expensive.
        // Keep light objects in the scene to avoid shader recompile (light count fixed), but mute intensity.
        let MAX_TOTAL_VISIBLE_LIGHTS = 1;

        // Normalize all candidate lights to have a base intensity (first-frame capture)
        for (let i = 0; i < candidateLights.length; i++) {
            const light = candidateLights[i].light;
            if (light && !light.userData.baseIntensity) {
                light.userData.baseIntensity = (typeof light.intensity === 'number') ? light.intensity : 1;
            }
        }

        for (let i = 0; i < candidateLights.length; i++) {
            const light = candidateLights[i].light;
            if (!light) continue;
            const targetIntensity = (i < MAX_TOTAL_VISIBLE_LIGHTS) ? (light.userData.baseIntensity || 1) : 0;
            if (typeof light.intensity === 'number') {
                light.intensity = targetIntensity;
            }
            // Keep lights 'visible' to avoid changing the scene light list (prevents shader recompilation spikes)
            light.visible = true;
        }

        // Ensure non-candidate and fallback lights are also zeroed (just in case)
        const allLights = [...this.missionLights, ...this.map?.lights || []];
        for (let j = 0; j < allLights.length; j++) {
            const light = allLights[j];
            if (!light) continue;
            if (!candidateLights.some(cl => cl.light === light)) {
                if (typeof light.intensity === 'number') light.intensity = 0;
                light.visible = true;
            }
        }
    }

    animate() {
        if (this.isShuttingDown) return; 
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        // Skip all logic if an ad is in progress, but still consume clock delta
        // so we don't get a massive catch-up step when gameplay resumes.
        if (this.adService.adInProgress) {
            this._lastFrameTime = performance.now();
            return;
        }
        
        // FPS Cap: 60 FPS (16.67ms per frame) to prevent 100% GPU usage on high-refresh monitors
        this._lastFrameTime = this._lastFrameTime || 0;
        const now = performance.now();
        if (now - this._lastFrameTime < 16) return; 
        this._lastFrameTime = now;

        const clampedDelta = Math.min(deltaTime, 0.033); 
        const scaledDelta = clampedDelta * (this.timeScale || 1.0);

        const isMenuScreen = this.gameState !== 'PLAYING' && !this.isNeuralSyncing;
        if (isMenuScreen) {
            this.menuRenderAccumulator = (this.menuRenderAccumulator || 0) + clampedDelta;

            const shouldRenderMenuFrame =
                this.menuRenderAccumulator >= 0.2 ||
                this.gameState === 'INTRO' ||
                this.gameState === 'BREACH_LOADING';

            if (!shouldRenderMenuFrame) {
                return;
            }

            this.menuRenderAccumulator = 0;
        } else {
            this.menuRenderAccumulator = 0;
        }
        
        const frameStartTime = performance.now();
        this.update(scaledDelta);

        // Optimized: Throttle light culling. During startup and panic, update aggressively.
        const lightCullStart = performance.now();
        const lightCullThrottle = this.startupWarmupActive ? 1 : (this.panicModeActive ? 4 : 60);
        if (this.frameCounter % lightCullThrottle === 0) {
            this.updateLightCulling();
        }
        const lightCullTime = performance.now() - lightCullStart;
        
        // Keep render settings stable to avoid panic fallback behavior.
        const desiredPixelRatio = this.startupWarmupActive ? 0.5 : 0.75;
        if (Math.abs(this.renderer.getPixelRatio() - desiredPixelRatio) > 0.001) {
            this.renderer.setPixelRatio(desiredPixelRatio);
            this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        }
        if (this.scene.overrideMaterial) {
            this.scene.overrideMaterial = null;
        }

        // PERFORMANCE MONITORING: Measure render time specifically
        const renderStart = performance.now();
        const heavyFrame = this.lastRenderTime > this.lastSpikeMsThreshold || this.panicModeActive;
        if (isMenuScreen) {
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
        } else if (heavyFrame) {
            // Lightweight draw path for stability
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
        } else {
            this.renderer.render(this.scene, this.camera);
        }
        const renderTime = performance.now() - renderStart;
        this.lastRenderTime = renderTime;
        
        // Flush audio once at end of frame
        if (this.audioQueue) this.flushAudio();

        // Reduce audio pressure during bullet storm insanity moments
        if (this.insaneMomentActive && this.shootSynth) {
            this.shootSynth.maxPolyphony = 1;
            this.impactSynth.maxPolyphony = 1;
        } else if (this.shootSynth) {
            this.shootSynth.maxPolyphony = 2;
            this.impactSynth.maxPolyphony = 2;
        }
        
        // PERFORMANCE MONITORING: Log frame spikes with detailed breakdown
        const totalFrameTime = performance.now() - now;
        if (totalFrameTime > 33 && this.gameState === 'PLAYING') {
            if (this.debugPerformanceLogging) {
                let aliveEnemies = 0;
                for (let i = 0; i < this.enemies.length; i++) {
                    if (!this.enemies[i].isDead) aliveEnemies++;
                }

                const mapStats = {
                    walls: this.map?.walls?.length || 0,
                    floors: this.map?.floors?.length || 0,
                    corridorFloors: this.map?.corridorFloors?.length || 0,
                    ceilingGroups: this.map?.ceilingGroups?.length || 0,
                    destructibles: this.map?.destructibleProps?.length || 0,
                    mapLights: this.map?.lights?.length || 0
                };

                console.warn('FRAME SPIKE DETECTED', {
                    totalMs: totalFrameTime.toFixed(2),
                    updateMs: frameUpdateTime.toFixed(2),
                    renderMs: renderTime.toFixed(2),
                    lightCullMs: lightCullTime.toFixed(2),
                    enemies: aliveEnemies,
                    pickups: this.pickups.length,
                    grenades: this.activeGrenades.length,
                    fireFields: this.activeFireFields.length,
                    particles: this.particleSystem?.particles?.length || 0,
                    sceneChildren: this.scene.children.length,
                    raycastTargets: this.raycastTargets?.length || 0,
                    ...mapStats,
                    panicMode: this.panicModeActive,
                    cullingRadius: this.cullingRadius
                });
            }

            if (renderTime > this.lastSpikeMsThreshold) {
                this.consecutiveSpikes++;
            } else if (this.consecutiveSpikes > 0) {
                this.consecutiveSpikes--;
            }

            if (this.consecutiveSpikes > 0 && this.cullingRadius !== 2) {
                this.cullingRadius = 2;
            }
        } else {
            if (this.consecutiveSpikes > 0) this.consecutiveSpikes--;
        }
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
        this._storageDirty = true;
    }

    _saveMetaStateDeferred() {
        // This is called asynchronously to avoid blocking the game loop during update
        localStorage.setItem('chamber_breach_meta_credits', this.metaCredits.toString());
        localStorage.setItem('chamber_breach_meta_cores', this.techCores.toString());
        localStorage.setItem('chamber_breach_meta_upgrades', JSON.stringify(this.metaUpgrades));
    }

    initMetaStoreEvents() {
        const openBtn = document.getElementById('open-meta-store-btn');
        const closeBtn = document.getElementById('meta-store-close-btn');
        const xBtn = document.getElementById('meta-store-x-btn');
        const panel = document.getElementById('meta-store-panel');

        const closePanel = () => {
            panel.style.transform = 'translateX(-100%)';
        };

        if (openBtn) {
            this.bindMobileFriendlyClick(openBtn, () => {
                panel.style.transform = 'translateX(0)';
                this.renderMetaStore();
                this.successSynth?.triggerAttackRelease("G4", "16n");
            });
        }

        if (closeBtn) this.bindMobileFriendlyClick(closeBtn, closePanel);
        if (xBtn) this.bindMobileFriendlyClick(xBtn, closePanel);
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
                const buyAction = () => this.buyMetaUpgrade(upgrade, cost);
                this.bindMobileFriendlyClick(btn, buyAction);
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

        // Weapon Mastery Perks
        if (this.metaUpgrades.rifle_ricochet > 0) {
            this.player.weapons.RIFLE.perks.ricochet = true;
            this.player.perkManager.activePerks.add('rifle_ricochet');
        }

        if (this.metaUpgrades.rifle_pierce > 0) {
            this.player.weapons.RIFLE.perks.shieldBreaker = true;
            this.player.perkManager.activePerks.add('rifle_pierce');
        }

        if (this.metaUpgrades.sniper_pierce > 0) {
            this.player.weapons.SNIPER.perks.penetration = this.metaUpgrades.sniper_pierce;
            this.player.perkManager.activePerks.add('sniper_pierce');
        }

        if (this.metaUpgrades.sniper_recall > 0) {
            this.player.weapons.SNIPER.perks.ammoRecall = true;
            this.player.perkManager.activePerks.add('sniper_recall');
        }

        if (this.metaUpgrades.synergy_duration > 0) {
            this.player.synergyDurationBonus = this.metaUpgrades.synergy_duration * 2;
        }

        if (this.metaUpgrades.synergy_potency > 0) {
            this.player.synergyPotencyBonus = this.metaUpgrades.synergy_potency * 0.2;
        }

        if (this.metaUpgrades.omega_turret_mastery > 0) {
            this.player.omegaTurretUnlocked = true;
        }

        if (this.metaUpgrades.flash_freeze_mastery > 0) {
            this.player.flashFreezeUnlocked = true;
        }

        this.player.updateUI();
    }

    initAchievementGalleryEvents() {
        const openBtn = document.getElementById('open-achievement-gallery-btn');
        const closeBtn = document.getElementById('achievement-gallery-close-btn');
        const panel = document.getElementById('achievement-gallery-panel');

        if (openBtn) {
            this.bindMobileFriendlyClick(openBtn, () => {
                panel.style.display = 'flex';
                this.renderAchievementGallery();
                this.successSynth?.triggerAttackRelease("G4", "16n");
            });
        }

        if (closeBtn) {
            this.bindMobileFriendlyClick(closeBtn, () => {
                panel.style.display = 'none';
            });
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
    cleanupAudio() {
        if (!this.Tone) return;

        // Targeted cleanup of specific audio objects to prevent "already disposed" errors
        const audioObjects = [
            'hackSynth', 'successSynth', 'shootSynth', 'impactSynth', 
            'ambientHum', 'ambientAir', 'hazardHiss', 'shieldHum', 
            'eliteScreech', 'tacticalHandshake', 'portalRumble',
            'masterCompressor', 'masterLimiter'
        ];

        audioObjects.forEach(key => {
            if (this[key] && typeof this[key].dispose === 'function') {
                try {
                    this[key].dispose();
                } catch (e) {
                    console.warn(`Failed to dispose ${key}:`, e);
                }
                this[key] = null;
            }
        });
    }

    saveToLeaderboard() {
        const leaderboard = JSON.parse(localStorage.getItem('meridian_leaderboard') || '[]');
        const newEntry = {
            operator: this.operatorName || `OP_${Math.floor(Math.random() * 9000) + 1000}`,
            room: this.currentChamberIndex + 1,
            score: this.player.score,
            date: new Date().getTime()
        };
        leaderboard.push(newEntry);
        // Sort by score desc
        leaderboard.sort((a, b) => b.score - a.score);
        // Keep top 10
        const top10 = leaderboard.slice(0, 10);
        localStorage.setItem('meridian_leaderboard', JSON.stringify(top10));
    }

    showLeaderboard() {
        const modal = document.getElementById('leaderboard-modal');
        const entriesEl = document.getElementById('leaderboard-entries');
        if (!modal || !entriesEl) return;

        const leaderboard = JSON.parse(localStorage.getItem('meridian_leaderboard') || '[]');
        entriesEl.innerHTML = '';

        if (leaderboard.length === 0) {
            entriesEl.innerHTML = '<div style="text-align: center; opacity: 0.5; padding: 20px;">NO DATA RECOVERED</div>';
        } else {
            leaderboard.forEach(entry => {
                const row = document.createElement('div');
                row.style.display = 'grid';
                row.style.gridTemplateColumns = '1fr 1fr 1fr';
                row.style.padding = '8px 0';
                row.style.borderBottom = '1px solid rgba(0, 208, 255, 0.1)';
                row.innerHTML = `
                    <span>${entry.operator}</span>
                    <span>${entry.room}</span>
                    <span>${entry.score.toLocaleString()}</span>
                `;
                entriesEl.appendChild(row);
            });
        }

        modal.style.display = 'flex';
    }
}