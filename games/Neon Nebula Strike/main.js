import * as THREE from 'three';
import * as TONE from 'tone';
import { CONFIG } from './config.js';
import { PlayerController, FirstPersonCameraController } from './rosie/controls/rosieControls.js';
import { World } from './systems/World.js';
import { Enemy } from './entities/Enemy.js';
import { LeaderboardManager } from './systems/LeaderboardManager.js';
import { DailyMissionManager } from './systems/DailyMissionManager.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

class Game {
    constructor() {
		this.levelsSinceAd = 0;
        this.leaderboard = new LeaderboardManager();
        this.dailyMission = new DailyMissionManager();
        
        // --- Permanent Meta Progression ---
        this.techPoints = parseInt(localStorage.getItem('alien_exploration_tech_points')) || 0;
        this.metaUpgrades = JSON.parse(localStorage.getItem('alien_exploration_meta_upgrades')) || {};
        this.prestigeLevel = parseInt(localStorage.getItem('alien_exploration_prestige_level')) || 0;
        this.pilotClass = localStorage.getItem('alien_exploration_pilot_class') || null;
		this.maxUnlockedLevel = parseInt(localStorage.getItem('alien_exploration_max_level')) || 1;
        
        // --- Workbench Customizations ---
        this.workbenchCustoms = JSON.parse(localStorage.getItem('alien_exploration_workbench')) || {
            color: 'cyan',
            trail: 'standard',
            effect: 'none',
            unlocked: ['cyan', 'standard', 'none']
        };
        
        // --- Class Ability State ---
        this.abilityCooldown = 0;
        this.abilityActive = false;
        this.abilityDurationTimer = 0;
        this.abilityLastUsed = 0;
        this.abilityReadyNotified = true;
        
        // Endless Mode State
        this.gameMode = 'campaign'; // 'campaign' or 'endless'
        this.wave = 1;
        this.waveEnemiesRemaining = 0;
        this.isBossWave = false;

        // World Events State
        this.eventTimer = 0;
        this.nextEventIn = 60 + Math.random() * 60;
        this.currentEvent = null;
        this.eventDurationTimer = 0;

        // Evolved Weapons
        this.evolvedWeapons = new Set();
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = 0.6;
        document.body.appendChild(this.renderer.domElement);

        this.setupPostProcessing();

        this.clock = new THREE.Clock();
        this.score = 0;
        this.level = 1;
        this.campaignIndex = 0;
        this.health = 100;
        this.gameActive = false;
        this.enemies = [];
        this.grenades = [];
        this.lastSpawnTime = 0;
        this.lastGrenadeTime = 0;
        this.grenadeCount = CONFIG.PLAYER.GRENADE_COUNT;

        this.pickups = [];
        this.buffs = {
            shield: 0,
            damage: 0,
            nuclear: false
        };

        // Combo system
        this.comboCount = 0;
        this.comboTimer = 0;
        this.comboDuration = 3.0; // 3 seconds to keep combo alive
        this.maxComboTimer = 3.0;

        // UI elements
        this.comboMeterEl = document.getElementById('combo-meter');
        this.comboTextEl = document.getElementById('combo-text');
        this.comboMultiplierEl = document.getElementById('combo-multiplier');
        this.comboTimerFillEl = document.getElementById('combo-timer-fill');

        // Weapon System
        this.weaponXP = 0;
        this.currentWeapon = CONFIG.WEAPONS.RIFLE;
        this.unlockedWeapons = [CONFIG.WEAPONS.RIFLE.id];
        this.lastFireTime = 0;

        // Upgrades
        this.upgrades = {};
        Object.keys(CONFIG.UPGRADES).forEach(key => {
            this.upgrades[CONFIG.UPGRADES[key].id] = 0;
        });

        // Audio
        this.setupAudio();

        // Stat tracking
        this.levelStats = {
            enemiesKilled: 0,
            shotsFired: 0,
            shotsHit: 0,
            damageTaken: 0,
            grenadesThrown: 0
        };

        // Player setup
        this.player = new THREE.Object3D();
        this.player.position.set(0, 1, 0);
        this.scene.add(this.player);

        this.controller = new PlayerController(this.player, {
            moveSpeed: CONFIG.PLAYER.MOVE_SPEED,
            jumpForce: CONFIG.PLAYER.JUMP_FORCE,
            groundLevel: 0
        });

        this.cameraController = new FirstPersonCameraController(
            this.camera, 
            this.player, 
            this.renderer.domElement, 
            { eyeHeight: CONFIG.PLAYER.EYE_HEIGHT }
        );

        this.controller.setCameraMode('first-person');

        // Raycaster for shooting
        this.raycaster = new THREE.Raycaster();
        
        // World setup
        this.world = new World(this.scene);

        // UI elements
        this.healthEl = document.getElementById('health');
        this.scoreEl = document.getElementById('score');
        this.levelEl = document.getElementById('level');
        this.grenadeCountEl = document.getElementById('grenade-count');
        this.campaignNameEl = document.getElementById('campaign-name');
        this.objectiveProgressEl = document.getElementById('objective-progress');
        this.objectiveContainerEl = document.getElementById('objective-container');
        this.enemiesCountEl = document.getElementById('enemies-count');
        this.hazardWarningEl = document.getElementById('hazard-warning');
        this.finalScoreEl = document.getElementById('final-score');
        
        // VFX Systems
        this.vfxParticles = [];
        this.tracers = [];
        this.muzzleFlash3D = null;
        this.setupVFX();

        this.gameOverEl = document.getElementById('game-over');
        this.mainMenuEl = document.getElementById('main-menu');
        this.startScreenEl = document.getElementById('start-screen');
        this.campaignSelectionEl = document.getElementById('campaign-selection');
        this.campaignListEl = document.getElementById('campaign-list');
        this.levelSelectionEl = document.getElementById('level-selection');
        this.levelGridEl = document.getElementById('level-grid');
        this.levelSelectionTitleEl = document.getElementById('level-selection-title');
        this.missionSummaryEl = document.getElementById('mission-summary');
        this.upgradeScreenEl = document.getElementById('upgrade-screen');
        this.upgradeOptionsEl = document.getElementById('upgrade-options');
        this.damageFlashEl = document.getElementById('damage-flash');
        this.weaponContainer = document.getElementById('weapon-container');
        this.muzzleFlash = document.getElementById('muzzle-flash');
        this.crosshair = document.getElementById('crosshair');
        this.levelUpNotification = document.getElementById('level-up-notification');
        this.bossHud = document.getElementById('boss-hud');
        this.bossNameEl = document.getElementById('boss-name');
        this.bossHealthBar = document.getElementById('boss-health-bar');
        this.bossPhaseMarkers = document.getElementById('boss-phase-markers');
        
        // Ad Interstitial
        this.adInterstitialEl = document.getElementById('ad-interstitial');
		this.adSkipBtn = document.getElementById('adSkipBtn');
		this.adTimerEl = document.getElementById('adTimer');
		this.adLoadingBar = null;
        
        // Endless & World Event HUD
        this.endlessHud = document.getElementById('endless-hud');
        this.waveNumEl = document.getElementById('wave-num');
        this.waveEnemiesEl = document.getElementById('wave-enemies');
        this.eventNotifEl = document.getElementById('world-event-notif');
        this.eventMsgEl = document.getElementById('event-msg');
        this.eventTimerEl = document.getElementById('event-timer');
        
        // Armory HUD
        this.armoryScreen = document.getElementById('armory-screen');
        this.techPointsVal = document.getElementById('tech-points-val');
        this.metaUpgradesList = document.getElementById('meta-upgrades-list');

        // Ability HUD
        this.abilityHud = document.getElementById('ability-hud');
        this.abilityNameEl = document.getElementById('ability-name');
        this.abilityCooldownFillEl = document.getElementById('ability-cooldown-fill');

        // Nickname System Elements
        this.nicknameOverlay = document.getElementById('nickname-overlay');
        this.nicknameInput = document.getElementById('nickname-input');
        this.nicknameSubmitBtn = document.getElementById('nickname-submit-btn');
        this.nicknameError = document.getElementById('nickname-error');

        this.xpBarFill = document.getElementById('xp-bar-fill');
        this.xpText = document.getElementById('xp-text');
        this.weaponSprite = document.getElementById('weapon-sprite');
        
        if (this.weaponSprite) this.weaponSprite.src = this.currentWeapon.sprite;

        // Minimap setup
        this.minimapCanvas = document.getElementById('minimap');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        // Bobbing effect
        this.bobbingTime = 0;

        // Level system
        this.scoreForNextLevel = CONFIG.LEVELS.SCORE_PER_LEVEL;

        // Event listeners
        window.addEventListener('resize', () => this.onResize());
        
		const handleBtn = (id, callback) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.addEventListener('click', (e) => {
                TONE.start();
                callback(e);
            });
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                TONE.start();
                callback(e);
            }, { passive: false });
        };

        handleBtn('main-start-btn', () => {
            this.gameMode = 'campaign';
            this.showCampaignSelection();
        });
        handleBtn('endless-start-btn', () => {
				
            this.gameMode = 'endless';
            this.startEndless();
        });
        handleBtn('armory-btn', () => {
            this.showArmory();
        });
        handleBtn('armory-back-btn', () => {
            this.armoryScreen.style.display = 'none';
        });
        
        // Tab switching
        handleBtn('tab-meta', () => {
            document.getElementById('meta-upgrades-container').style.display = 'block';
            document.getElementById('workbench-container').style.display = 'none';
            document.getElementById('tab-meta').style.background = 'rgba(0, 255, 127, 0.2)';
            document.getElementById('tab-workbench').style.background = 'rgba(0, 255, 127, 0.05)';
        });
        handleBtn('tab-workbench', () => {
            document.getElementById('meta-upgrades-container').style.display = 'none';
            document.getElementById('workbench-container').style.display = 'block';
            document.getElementById('tab-meta').style.background = 'rgba(0, 255, 127, 0.05)';
            document.getElementById('tab-workbench').style.background = 'rgba(0, 255, 127, 0.2)';
            this.renderWorkbench();
        });

       handleBtn('hub-btn', () => {
            window.location.href = './index.html';
        });

        handleBtn('leaderboard-btn', () => {
            this.openLeaderboard();
			setTimeout(() => this.showRankChange(), 300);
        });

        handleBtn('leaderboard-btn-fail', () => {
            this.openLeaderboard();
			setTimeout(() => this.showRankChange(), 300);
        });

        handleBtn('leaderboard-back-btn', () => {
            this.closeLeaderboard();
        });

        handleBtn('start-btn', () => this.showCampaignSelection());
        handleBtn('back-to-start', () => this.showMainMenu());
        handleBtn('back-to-campaigns', () => this.showCampaignSelection());
        handleBtn('back-to-campaigns-fail', () => {
            this.enemies.forEach(e => e.die());
            this.enemies = [];
            this.showCampaignSelection();
        });
        handleBtn('restart-btn', () => this.restartGame());
        handleBtn('summary-continue-btn', () => this.showUpgradeScreen());
     
        window.addEventListener('mousedown', (e) => {
            if (this.gameActive) {
                if (e.button === 0) {
                    this.isFiring = true;
                } else if (e.button === 2) {
                    this.throwGrenade();
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.isFiring = false;
            }
        });

        window.addEventListener('keydown', (e) => {
            if (!this.gameActive) return;
            if (e.key === '1') this.switchWeapon('rifle');
            if (e.key === '2') this.switchWeapon('shotgun');
            if (e.key === '3') this.switchWeapon('plasma');
            if (e.key === '4') this.switchWeapon('railgun');
            if (e.key.toLowerCase() === 'f') this.useAbility();
        });

        window.addEventListener('contextmenu', (e) => e.preventDefault());

        window.gameManager = this; // Global access for Enemy.js

        window.addEventListener('dailyMissionCompleted', (e) => {
            this.updateDailyMissionUI();
        });

        window.addEventListener('mobileFire', (e) => {
            if (!this.gameActive) return;
            this.isFiring = e.detail.firing;
        });

        // Enable touch on weapon slots
        ['slot-1', 'slot-2', 'slot-3', 'slot-4'].forEach((id, index) => {
            const slot = document.getElementById(id);
            if (slot) {
                const weapons = ['rifle', 'shotgun', 'plasma', 'railgun'];
                slot.addEventListener('click', () => {
                    if (this.gameActive) this.switchWeapon(weapons[index]);
                });
                slot.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (this.gameActive) this.switchWeapon(weapons[index]);
                });
            }
        });

        this.nicknameSubmitBtn.addEventListener('click', () => {
            TONE.start();
            this.handleNicknameSubmit();
        });
        this.nicknameSubmitBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            TONE.start();
            this.handleNicknameSubmit();
        });
        this.nicknameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                TONE.start();
                this.handleNicknameSubmit();
            }
        });
        this.nicknameInput.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            this.nicknameInput.focus();
        }, { passive: true });

        // Ensure mobile controls are hidden initially
        if (this.controller.mobileControls) {
            this.controller.mobileControls.hide();
        }

        // --- Mobile Settings Logic ---
        this.setupMobileSettings();

        // Link camera controller to mobile controls for steering
        if (this.controller.mobileControls) {
            this.controller.mobileControls.cameraController = this.cameraController;
        } 

        this.updateDailyMissionUI();
        this.checkNickname();

        // Detect mobile for minor optimizations
        this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (this.isMobile) {
            this.renderer.setPixelRatio(1); // Force 1x pixel ratio for mobile performance
            if (this.bloomPass) this.bloomPass.strength = 0.5; // Reduce bloom intensity
        }

        this.adSkipBtn.onclick = () => {
            this.closeAdInterstitial();
        };

        this.animate();
		document.querySelectorAll('.tab').forEach(btn => {
			btn.onclick = () => {
				document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
				btn.classList.add('active');

				this.currentLeaderboardType = btn.dataset.type;

				this.openLeaderboard();
			};
		});
    }

    setupMobileSettings() {
        const overlay = document.getElementById('mobile-settings-overlay');
        const lookSensInput = document.getElementById('input-look-sens');
        const joySensInput = document.getElementById('input-joy-sens');
        const joySteerInput = document.getElementById('input-joy-steer');
        const lookSensVal = document.getElementById('val-look-sens');
        const joySensVal = document.getElementById('val-joy-sens');
        const closeBtn = document.getElementById('close-mobile-settings');

        if (!overlay || !lookSensInput || !joySensInput || !joySteerInput) return;
											   
									 

        // Load current values
        const currentLookSens = localStorage.getItem('alien_exploration_look_sensitivity') || 1.0;
        const currentJoySens = localStorage.getItem('alien_exploration_joystick_sensitivity') || 1.0;
        const currentJoySteer = localStorage.getItem('alien_exploration_joystick_steering') !== 'false';

        lookSensInput.value = currentLookSens;
        joySensInput.value = currentJoySens;
        joySteerInput.checked = currentJoySteer;
        lookSensVal.innerText = parseFloat(currentLookSens).toFixed(1);
        joySensVal.innerText = parseFloat(currentJoySens).toFixed(1);

        lookSensInput.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            lookSensVal.innerText = val.toFixed(1);
            if (this.cameraController) {
                this.cameraController.lookSensitivity = val;
            }
            localStorage.setItem('alien_exploration_look_sensitivity', val);
        });

        joySensInput.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            joySensVal.innerText = val.toFixed(1);
            if (this.controller && this.controller.mobileControls) {
                this.controller.mobileControls.updateJoystickSensitivity(val);
            }
        });

        joySteerInput.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            if (this.controller && this.controller.mobileControls) {
                this.controller.mobileControls.updateJoystickSteering(enabled);
            }
        });

        const toggleSettings = () => {
            const isVisible = overlay.style.display === 'flex';
            overlay.style.display = isVisible ? 'none' : 'flex';
            
            // Pause/Unpause game logic if needed
            if (!isVisible) {
                // Pause if possible
            }
        };

        window.addEventListener('toggleMobileSettings', toggleSettings);
        
        closeBtn.onclick = () => {
            overlay.style.display = 'none';
        };
        closeBtn.ontouchstart = (e) => {
            e.preventDefault();
            overlay.style.display = 'none';
        };
    }
	
	showAdInterstitial(callback) {

    // --- Official Google H5 Games SDK ---
    if (typeof window.adBreak === 'function') {
        this.onAdComplete = callback;

        window.adBreak({
            type: 'next',
            name: 'level-complete',

            beforeAd: () => {
                console.log('Ad starting...');
                this.gameActive = false;
            },

            afterAd: () => {
                console.log('Ad finished.');
                this.closeAdInterstitial();
            },

            adDismissed: () => { this.closeAdInterstitial(); },
            adViewed: () => { this.closeAdInterstitial(); },

            adBreakDone: (info) => {
                console.log('Ad break done', info);
                this.closeAdInterstitial();
            }
        });

        return;
    }

    // --- AdSense fallback ---
    if (!this.adInterstitialEl) {
        if (callback) callback();
        return;
    }

    this.onAdComplete = callback;

    this.adInterstitialEl.style.display = 'flex';
    this.adSkipBtn.style.display = 'none';

    // Inject real AdSense ad
    const adContainer = document.getElementById("gameInterstitialAd");

    if (adContainer && !adContainer.hasChildNodes()) {

        adContainer.innerHTML = `
            <ins class="adsbygoogle"
                style="display:block"
                data-ad-client="ca-pub-5482914432517813"
                data-ad-slot="8527470351"
                data-ad-format="auto"
                data-full-width-responsive="true">
            </ins>
        `;

        try {
            (adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.log("AdSense push error", e);
        }
    }

    // Countdown timer
    let timeLeft = 5;

    this.adTimerEl.innerText = `AD ENDS IN ${timeLeft}s`;
    

    const timerInterval = setInterval(() => {

        timeLeft--;

        if (timeLeft <= 0) {

            clearInterval(timerInterval);

            this.adSkipBtn.style.display = 'block';
            this.adTimerEl.innerText = 'AD READY TO SKIP';
          

        } else {

            this.adTimerEl.innerText = `AD ENDS IN ${timeLeft}s`;


        }

    }, 1000);
}

    closeAdInterstitial() {
        this.adInterstitialEl.style.display = 'none';
        if (this.onAdComplete) {
            this.onAdComplete();
            this.onAdComplete = null;
        }
    }

    checkNickname() {
		const name = this.leaderboard.getPlayerName();
		const id = this.leaderboard.getPlayerId();

		if (name && id) {
			this.nicknameOverlay.style.display = 'none';
		} else {
			this.nicknameOverlay.style.display = 'flex';
		}
	}
	
    async handleNicknameSubmit() {
        const name = this.nicknameInput.value.trim();
        const validPattern = /^[a-zA-Z0-9 _]+$/;

        if (name.length < 3) {
            this.showNicknameError("MINIMUM 3 CHARACTERS REQUIRED");
            return;
        }

        if (name.length > 16) {
            this.showNicknameError("MAXIMUM 16 CHARACTERS ALLOWED");
            return;
        }

        if (!validPattern.test(name)) {
            this.showNicknameError("USE LETTERS, NUMBERS, SPACES, OR _");
            return;
        }

        // Success
        const isTaken = await this.leaderboard.isNameTaken(name);

		if (isTaken) {
			this.showNicknameError("NAME ALREADY TAKEN");
			return;
		}

		// OK → register
		this.leaderboard.registerPlayer(name);
		this.nicknameOverlay.style.display = 'none';
		this.synth.triggerAttackRelease('C4', '8n');
    }

    showNicknameError(msg) {
        this.nicknameError.innerText = msg;
        this.nicknameError.style.opacity = '1';
        this.nicknameInput.style.borderColor = '#ff4d4d';
        this.nicknameInput.style.boxShadow = '0 0 10px rgba(255, 77, 77, 0.5)';
        
		        // Add shake animation
        this.nicknameError.classList.remove('error-shake');
        void this.nicknameError.offsetWidth; // Force reflow
        this.nicknameError.classList.add('error-shake');		
		
        setTimeout(() => {
            this.nicknameError.style.opacity = '0';
            this.nicknameInput.style.borderColor = 'rgba(0, 255, 127, 0.5)';
            this.nicknameInput.style.boxShadow = 'none';
        }, 2000);
    }

    setupAudio() {
        // Simple procedural weapon sounds
        this.synth = new TONE.PolySynth(TONE.Synth).toDestination();
        this.noiseSynth = new TONE.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
        }).toDestination();
        
        this.explosionSynth = new TONE.MembraneSynth().toDestination();
        
        // World Event Synth
        this.eventSynth = new TONE.FMSynth({
            harmonicity: 3,
            modulationIndex: 10,
            detune: 0,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.1, decay: 0.2, sustain: 1, release: 0.5 },
            modulation: { type: 'square' },
            modulationEnvelope: { attack: 0.5, decay: 0, sustain: 1, release: 0.5 }
        }).toDestination();
    }

    playEventSound(eventId) {
        if (eventId === 'meteor') {
            this.eventSynth.triggerAttackRelease('C1', '2n');
            this.noiseSynth.triggerAttackRelease('2n');
        } else if (eventId === 'swarm') {
            this.eventSynth.triggerAttackRelease('G4', '8n');
            setTimeout(() => this.eventSynth.triggerAttackRelease('G4', '8n'), 200);
        } else if (eventId === 'gravity') {
            this.eventSynth.triggerAttackRelease('C5', '1s');
        } else if (eventId === 'surge') {
            this.eventSynth.triggerAttackRelease('E3', '4n');
        }
    }

    shakeScreen(intensity = 5) {
        this.cameraShake = intensity;
    }

    playWeaponSound() {
        if (this.currentWeapon.id === 'rifle') {
            this.noiseSynth.triggerAttackRelease('8n');
            this.synth.triggerAttackRelease('C2', '16n');
        } else if (this.currentWeapon.id === 'shotgun') {
            this.noiseSynth.triggerAttackRelease('4n');
            this.synth.triggerAttackRelease(['C1', 'E1'], '8n');
        } else if (this.currentWeapon.id === 'plasma') {
            this.synth.triggerAttackRelease('G4', '16n');
        } else if (this.currentWeapon.id === 'railgun') {
            this.synth.triggerAttackRelease('C6', '8n');
            this.noiseSynth.triggerAttackRelease('2n');
        }
    }

    switchWeapon(id) {
        const weaponKey = Object.keys(CONFIG.WEAPONS).find(k => CONFIG.WEAPONS[k].id === id);
        const weapon = CONFIG.WEAPONS[weaponKey];
        
        if (!this.unlockedWeapons.includes(id)) return;
        
        this.currentWeapon = weapon;
        this.weaponSprite.src = weapon.sprite;
        
        // Update UI
        document.querySelectorAll('.weapon-slot').forEach(slot => slot.classList.remove('active'));
        const index = ['rifle', 'shotgun', 'plasma', 'railgun'].indexOf(id) + 1;
        document.getElementById(`slot-${index}`).classList.add('active');
        
        // Sound
        this.synth.triggerAttackRelease('G2', '16n');
    }

    addWeaponXP(amount) {
        this.weaponXP += amount;
        
        // Check for unlocks
        Object.keys(CONFIG.WEAPONS).forEach(key => {
            const weapon = CONFIG.WEAPONS[key];
            if (!this.unlockedWeapons.includes(weapon.id) && this.weaponXP >= weapon.unlockXP) {
                this.unlockedWeapons.push(weapon.id);
                const index = ['rifle', 'shotgun', 'plasma', 'railgun'].indexOf(weapon.id) + 1;
                const slot = document.getElementById(`slot-${index}`);
                slot.classList.remove('locked');
                
                // Notification
                this.levelUpNotification.innerText = `UNLOCKED: ${weapon.name.toUpperCase()}`;
                this.levelUpNotification.style.color = "#00ffff";
                this.levelUpNotification.classList.add('visible');
                setTimeout(() => this.levelUpNotification.classList.remove('visible'), 2000);
            }
        });
        
        this.updateXPUI();
    }

    updateXPUI() {
        // Find next unlock
        const nextWeapon = Object.values(CONFIG.WEAPONS)
            .filter(w => !this.unlockedWeapons.includes(w.id))
            .sort((a, b) => a.unlockXP - b.unlockXP)[0];
            
        if (nextWeapon) {
            const prevXP = Object.values(CONFIG.WEAPONS)
                .filter(w => this.unlockedWeapons.includes(w.id))
                .sort((a, b) => b.unlockXP - a.unlockXP)[0]?.unlockXP || 0;
                
            const progress = ((this.weaponXP - prevXP) / (nextWeapon.unlockXP - prevXP)) * 100;
            this.xpBarFill.style.width = `${Math.min(100, progress)}%`;
            this.xpText.innerText = `NEXT UNLOCK: ${nextWeapon.name.toUpperCase()} (${this.weaponXP} / ${nextWeapon.unlockXP})`;
        } else {
            this.xpBarFill.style.width = '100%';
            this.xpText.innerText = "MAX WEAPON LEVEL REACHED";
        }
    }

    showUpgradeScreen() {
        this.missionSummaryEl.style.display = 'none';
        this.upgradeScreenEl.style.display = 'flex';
        this.upgradeOptionsEl.innerHTML = '';
        
        const allUpgrades = Object.values(CONFIG.UPGRADES);
        const selected = [];
        const pool = [...allUpgrades];
        
        // Pick 3 unique random upgrades
        for (let i = 0; i < 3; i++) {
            if (pool.length === 0) break;
            const idx = Math.floor(Math.random() * pool.length);
            selected.push(pool.splice(idx, 1)[0]);
        }
        
        selected.forEach(upgrade => {
            const card = document.createElement('div');
            const stackCount = this.upgrades[upgrade.id] || 0;
            
            card.style.cssText = `
                background: linear-gradient(135deg, rgba(0, 255, 127, 0.1), rgba(0, 255, 127, 0.05));
                border: 2px solid rgba(0, 255, 127, 0.3);
                padding: 30px;
                width: 250px;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                border-radius: 15px;
                position: relative;
                box-shadow: 0 10px 20px rgba(0,0,0,0.3);
            `;
            
            card.innerHTML = `
                ${stackCount > 0 ? `<div style="position: absolute; top: 10px; right: 10px; background: #00ff7f; color: #000; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: bold;">LVL ${stackCount}</div>` : ''}
                <div style="font-size: 60px; margin-bottom: 20px; filter: drop-shadow(0 0 10px rgba(0, 255, 127, 0.5));">${upgrade.icon}</div>
                <h3 style="color: #00ff7f; margin: 0 0 10px 0; font-size: 20px; letter-spacing: 1px;">${upgrade.name}</h3>
                <p style="font-size: 14px; margin: 0; color: #ccc; line-height: 1.4;">${upgrade.description}</p>
                <div style="margin-top: 20px; font-size: 10px; color: rgba(0, 255, 127, 0.5); font-weight: bold;">UPGRADE PERMANENT</div>
            `;
            
            card.onmouseenter = () => {
                card.style.background = 'linear-gradient(135deg, rgba(0, 255, 127, 0.2), rgba(0, 255, 127, 0.1))';
                card.style.borderColor = '#00ff7f';
                card.style.transform = 'translateY(-15px) scale(1.05)';
                card.style.boxShadow = '0 20px 40px rgba(0, 255, 127, 0.2)';
            };
            card.onmouseleave = () => {
                card.style.background = 'linear-gradient(135deg, rgba(0, 255, 127, 0.1), rgba(0, 255, 127, 0.05))';
                card.style.borderColor = 'rgba(0, 255, 127, 0.3)';
                card.style.transform = 'translateY(0) scale(1)';
                card.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)';
            };
            
            card.onclick = () => {
                this.synth.triggerAttackRelease('C4', '8n');
                this.applyUpgrade(upgrade);
            };
            this.upgradeOptionsEl.appendChild(card);
        });
    }

    renderWorkbench() {
        const list = document.getElementById('workbench-list');
        list.innerHTML = '';
        this.techPointsVal.innerText = this.techPoints.toLocaleString();

        const renderSection = (title, items, type) => {
            const header = document.createElement('div');
            header.style.cssText = 'color: #00ff7f; font-size: 14px; font-weight: bold; margin-top: 15px; border-bottom: 1px solid rgba(0, 255, 127, 0.2); padding-bottom: 5px;';
            header.innerText = title;
            list.appendChild(header);

            items.forEach(item => {
                const isUnlocked = this.workbenchCustoms.unlocked.includes(item.id);
                const isActive = this.workbenchCustoms[type] === item.id;
                
                const card = document.createElement('div');
                card.style.cssText = `
                    background: ${isActive ? 'rgba(0, 255, 127, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
                    border: 1px solid ${isActive ? '#00ff7f' : 'rgba(255, 255, 255, 0.1)'};
                    padding: 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-radius: 5px;
                    transition: all 0.2s;
                    cursor: pointer;
                `;
                
                card.innerHTML = `
                    <div>
                        <div style="font-weight: bold; color: ${item.color ? '#' + item.color.toString(16).padStart(6, '0') : '#fff'};">${item.name}</div>
                        ${item.desc ? `<div style="font-size: 10px; opacity: 0.7;">${item.desc}</div>` : ''}
                    </div>
                    <div>
                        ${isActive ? '<span style="color: #00ff7f; font-size: 10px;">ACTIVE</span>' : 
                          isUnlocked ? '<button class="btn" style="padding: 5px 15px; font-size: 11px;">EQUIP</button>' : 
                          `<button class="btn" style="padding: 5px 15px; font-size: 11px; background: #ffcc00; color: #000;">${item.cost} TP</button>`}
                    </div>
                `;

                card.onclick = () => {
                    if (isActive) return;
                    if (isUnlocked) {
                        this.workbenchCustoms[type] = item.id;
                    } else if (this.techPoints >= item.cost) {
                        this.techPoints -= item.cost;
                        this.workbenchCustoms.unlocked.push(item.id);
                        this.workbenchCustoms[type] = item.id;
                        localStorage.setItem('alien_exploration_tech_points', this.techPoints);
                    } else {
                        return;
                    }
                    localStorage.setItem('alien_exploration_workbench', JSON.stringify(this.workbenchCustoms));
                    this.renderWorkbench();
                    this.synth.triggerAttackRelease('C4', '8n');
                };

                list.appendChild(card);
            });
        };

        renderSection('PROJECTILE COLOR', CONFIG.WORKBENCH.COLORS, 'color');
        renderSection('TRAIL INTENSITY', CONFIG.WORKBENCH.TRAILS, 'trail');
        renderSection('STATUS MODULES', CONFIG.WORKBENCH.STATUS_EFFECTS, 'effect');
    }

    showArmory() {
        this.armoryScreen.style.display = 'flex';
        this.techPointsVal.innerText = this.techPoints.toLocaleString();
        this.metaUpgradesList.innerHTML = '';
        
        // --- Prestige Status Header ---
        const prestigeHeader = document.createElement('div');
        prestigeHeader.style.cssText = `
            width: 100%;
            padding: 15px;
            background: rgba(0,0,0,0.4);
            border-bottom: 2px solid #ffcc00;
            margin-bottom: 20px;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        const currentClassInfo = this.pilotClass ? CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()] : null;
        
        prestigeHeader.innerHTML = `
            <div>
                <div style="font-size: 10px; color: #ffcc00; letter-spacing: 2px;">PILOT RANK: PRESTIGE ${this.prestigeLevel}</div>
                <div style="font-size: 18px; font-weight: bold; color: ${currentClassInfo ? currentClassInfo.color : '#fff'};">
                    ${this.pilotClass ? currentClassInfo.name : 'RECRUIT'}
                </div>
            </div>
            ${this.checkPrestigeReady() ? `
                <button id="prestige-btn" class="btn" style="background: #ffcc00; color: #000; padding: 8px 20px;">
                    PRESTIGE AVAILABLE
                </button>
            ` : `
                <div style="font-size: 10px; opacity: 0.5; text-align: right;">
                    COMPLETE TIER 3 TO UNLOCK PRESTIGE
                </div>
            `}
        `;
        this.metaUpgradesList.appendChild(prestigeHeader);

        if (this.checkPrestigeReady()) {
            const btn = prestigeHeader.querySelector('#prestige-btn');
            if (btn) btn.onclick = () => this.showPrestigeSelection();
        }

        // Group upgrades by tier
        const tiers = {};
        Object.values(CONFIG.META_UPGRADES).forEach(upgrade => {
            if (!tiers[upgrade.tier]) tiers[upgrade.tier] = [];
            tiers[upgrade.tier].push(upgrade);
        });

        Object.keys(tiers).sort().forEach(tier => {
            const tierTitle = document.createElement('div');
            tierTitle.style.cssText = `
                width: 100%;
                color: #ffcc00;
                font-size: 14px;
                font-weight: bold;
                margin: 20px 0 10px 0;
                border-bottom: 1px solid rgba(255, 204, 0, 0.3);
                padding-bottom: 5px;
                text-transform: uppercase;
                letter-spacing: 2px;
            `;
            tierTitle.innerText = `TIER ${tier}`;
            this.metaUpgradesList.appendChild(tierTitle);

            const tierGrid = document.createElement('div');
            tierGrid.style.cssText = `
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                width: 100%;
            `;
            this.metaUpgradesList.appendChild(tierGrid);

            tiers[tier].forEach(upgrade => {
                const level = this.metaUpgrades[upgrade.id] || 0;
                const cost = upgrade.cost * (level + 1);
                
                // Check requirements
                let reqsMet = true;
                if (upgrade.requires) {
                    upgrade.requires.forEach(reqId => {
                        if (!this.metaUpgrades[reqId]) reqsMet = false;
                    });
                }
                
                // Class check for Tier 4
                let classMismatch = false;
                if (upgrade.class && (!this.pilotClass || this.pilotClass.toUpperCase() !== upgrade.class)) {
                    classMismatch = true;
                }

                const card = document.createElement('div');
                card.style.cssText = `
                    background: ${reqsMet && !classMismatch ? 'rgba(0, 255, 127, 0.05)' : 'rgba(255, 255, 255, 0.02)'};
                    border: 1px solid ${reqsMet && !classMismatch ? 'rgba(0, 255, 127, 0.2)' : 'rgba(255, 255, 255, 0.1)'};
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    border-radius: 5px;
                    opacity: ${reqsMet && !classMismatch ? 1 : 0.5};
                    position: relative;
                `;
                
                card.innerHTML = `
                    <div>
                        <div style="font-weight: bold; color: ${reqsMet && !classMismatch ? '#00ff7f' : '#888'};">
                            ${upgrade.name} (LVL ${level})
                        </div>
                        <div style="font-size: 11px; opacity: 0.7;">${upgrade.desc}</div>
                        ${!reqsMet ? `<div style="font-size: 9px; color: #ff4d4d; margin-top: 5px;">REQUIRES: ${upgrade.requires.join(', ').toUpperCase()}</div>` : ''}
                        ${classMismatch ? `<div style="font-size: 9px; color: #ffcc00; margin-top: 5px;">REQUIRES: ${upgrade.class} CLASS</div>` : ''}
                    </div>
                    <button class="btn" style="padding: 5px; font-size: 12px; width: 100%; ${(!reqsMet || classMismatch || this.techPoints < cost) ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;' : ''}">
                        UPGRADE (${cost} TP)
                    </button>
                `;
                
                const btn = card.querySelector('button');
                btn.onclick = () => {
                    if (reqsMet && !classMismatch && this.techPoints >= cost) {
                        this.techPoints -= cost;
                        this.metaUpgrades[upgrade.id] = level + 1;
                        localStorage.setItem('alien_exploration_tech_points', this.techPoints);
                        localStorage.setItem('alien_exploration_meta_upgrades', JSON.stringify(this.metaUpgrades));
                        this.showArmory();
                        this.synth.triggerAttackRelease('C4', '8n');
                    }
                };
                
                tierGrid.appendChild(card);
            });
        });
    }

    checkPrestigeReady() {
        const tier3Upgrades = Object.values(CONFIG.META_UPGRADES).filter(u => u.tier === 3);
        const unlockedCount = tier3Upgrades.filter(u => (this.metaUpgrades[u.id] || 0) > 0).length;
        return unlockedCount >= CONFIG.PRESTIGE.REQ_TIER_3_COUNT;
    }

    showPrestigeSelection() {
        this.metaUpgradesList.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #ffcc00; margin-bottom: 10px;">PRESTIGE ASCENSION</h2>
                <p style="font-size: 12px; color: #ccc;">RESETS ALL META-UPGRADES IN EXCHANGE FOR A PERMANENT PILOT CLASS.</p>
                <p style="font-size: 14px; color: #00ff7f; margin-top: 10px;">SELECT YOUR SPECIALIZATION:</p>
            </div>
            <div id="class-selection-grid" style="display: grid; grid-template-columns: 1fr; gap: 15px; width: 100%;"></div>
            <button id="cancel-prestige" class="btn" style="margin-top: 30px; width: 100%; background: rgba(255,255,255,0.1);">CANCEL</button>
        `;

        const grid = document.getElementById('class-selection-grid');
        Object.values(CONFIG.PRESTIGE.CLASSES).forEach(pClass => {
            const card = document.createElement('div');
            card.style.cssText = `
                background: rgba(0,0,0,0.5);
                border: 2px solid ${pClass.color};
                padding: 20px;
                border-radius: 10px;
                cursor: pointer;
                transition: transform 0.2s, background 0.2s;
                position: relative;
                overflow: hidden;
            `;
            
            card.innerHTML = `
                <h3 style="color: ${pClass.color}; margin: 0 0 5px 0;">${pClass.name}</h3>
                <p style="font-size: 11px; color: #ccc; margin-bottom: 10px;">${pClass.desc}</p>
                <div style="font-size: 10px; color: #00ff7f;">BONUSES: ${Object.entries(pClass.bonus).map(([k,v]) => `${k.toUpperCase()} +${v * (v < 1 ? 100 : 1)}${v < 1 ? '%' : ''}`).join(', ')}</div>
            `;
            
            card.onclick = () => this.confirmPrestige(pClass.id);
            grid.appendChild(card);
        });

        document.getElementById('cancel-prestige').onclick = () => this.showArmory();
    }

    confirmPrestige(classId) {
        if (!confirm(`ASCEND AS ${classId.toUpperCase()}? ALL META-UPGRADES WILL BE RESET.`)) return;
        
        this.prestigeLevel++;
        this.pilotClass = classId;
        this.metaUpgrades = {};
        
        localStorage.setItem('alien_exploration_prestige_level', this.prestigeLevel);
        localStorage.setItem('alien_exploration_pilot_class', this.pilotClass);
        localStorage.setItem('alien_exploration_meta_upgrades', JSON.stringify(this.metaUpgrades));
        
        this.synth.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '2n');
        this.levelUpNotification.innerText = `ASCENDED: ${classId.toUpperCase()}`;
        this.levelUpNotification.style.color = CONFIG.PRESTIGE.CLASSES[classId.toUpperCase()].color;
        this.levelUpNotification.classList.add('visible');
        setTimeout(() => this.levelUpNotification.classList.remove('visible'), 3000);
        
        this.showArmory();
    }

    startEndless() {
        this.gameMode = 'endless';
        this.wave = 1;
        this.startGame(0, 1);
        this.endlessHud.style.display = 'flex';
        this.updateEndlessUI();
    }

    updateEndlessUI() {
        if (this.gameMode !== 'endless') return;
        this.waveNumEl.innerText = this.wave;
        this.waveEnemiesEl.innerText = this.enemies.filter(e => e.alive).length;
    }

    checkEvolutions() {
        CONFIG.EVOLUTIONS.forEach(evo => {
            if (this.evolvedWeapons.has(evo.id)) return;
            
            const hasBase = this.currentWeapon.id === evo.baseWeapon;
            const hasRequirement = this.upgrades[evo.requirement] > 0;
            
            if (hasBase && hasRequirement) {
                this.evolveWeapon(evo);
            }
        });
    }

    evolveWeapon(evo) {
        this.evolvedWeapons.add(evo.id);
        this.levelUpNotification.innerText = `WEAPON EVOLVED: ${evo.name}`;
        this.levelUpNotification.style.color = "#ffcc00";
        this.levelUpNotification.classList.add('visible');
        setTimeout(() => this.levelUpNotification.classList.remove('visible'), 3000);
        
        // Visual effect
        this.damageFlashEl.style.backgroundColor = 'rgba(255, 204, 0, 0.2)';
        this.damageFlashEl.style.opacity = '1';
        setTimeout(() => this.damageFlashEl.style.opacity = '0', 500);
        this.synth.triggerAttackRelease(['C4', 'E4', 'G4'], '2n');
    }

    triggerWorldEvent() {
        const events = Object.values(CONFIG.WORLD_EVENTS);
        const event = events[Math.floor(Math.random() * events.length)];
        this.currentEvent = event;
        this.eventDurationTimer = event.duration;
        
        this.eventMsgEl.innerText = event.msg;
        this.eventNotifEl.style.display = 'block';
        this.playEventSound(event.id);
        
        // Special logic for Alien Swarm
        if (event.id === 'swarm') {
            for (let i = 0; i < 10; i++) this.spawnEnemy();
        }
        
        // Special logic for Low Gravity
        if (event.id === 'gravity') {
            this.controller.jumpForce = CONFIG.PLAYER.JUMP_FORCE * 1.5;
        }
    }

    endWorldEvent() {
        if (!this.currentEvent) return;
        
        if (this.currentEvent.id === 'gravity') {
            this.controller.jumpForce = CONFIG.PLAYER.JUMP_FORCE;
        }
        
        this.currentEvent = null;
        this.eventNotifEl.style.display = 'none';
    }

    applyUpgrade(upgrade) {
        this.upgrades[upgrade.id]++;
        this.upgradeScreenEl.style.display = 'none';
        
        this.checkEvolutions();

        // Handle immediate effects that need system-level recalculation
        if (upgrade.id === 'move_speed') {
            const metaBonus = 1 + (this.metaUpgrades.meta_speed || 0) * 0.05;
            this.controller.moveSpeed = CONFIG.PLAYER.MOVE_SPEED * metaBonus * (1 + (this.upgrades.move_speed * 0.15));
        }
        if (upgrade.id === 'max_health') {
            const oldMax = 100 + (this.upgrades.max_health - 1) * 25;
            const newMax = 100 + this.upgrades.max_health * 25;
            // Scale current health percentage to new max
            this.health = (this.health / oldMax) * newMax;
        }

        this.levelsSinceAd++;

		if (this.levelsSinceAd >= 3) {

			this.levelsSinceAd = 0;

			this.showAdInterstitial(() => {
				this.proceedToNextLevel();
			});

		} else {

			this.proceedToNextLevel();

		}
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }
	startLeaderboardLiveUpdate() {
		if (this.lbInterval) clearInterval(this.lbInterval);

		this.lbInterval = setInterval(() => {
			if (document.getElementById('leaderboard-screen').style.display === 'flex') {
				this.openLeaderboard();
				setTimeout(() => this.showRankChange(), 300);
			}
		}, 5000); // every 5 sec
	}
	async showRankChange() {
		const scores = await this.leaderboard.getGlobalScores();
		const playerName = this.leaderboard.getPlayerName();

		const index = scores.findIndex(s => s.name === playerName);

		if (index === -1) return;

		const row = document.querySelectorAll('.leaderboard-row')[index];
		if (!row) return;

		row.style.transform = "scale(1.2)";
		row.style.boxShadow = "0 0 25px #00ff7f";

		setTimeout(() => {
			row.style.transform = "";
			row.style.boxShadow = "";
		}, 800);
	}						
    async openLeaderboard() {
		const leaderboardScreen = document.getElementById('leaderboard-screen');
		const listEl = document.getElementById('leaderboard-list');

		leaderboardScreen.style.display = 'flex';

		// --- INIT TAB STATE ---
		if (!this.currentLeaderboardType) {
			this.currentLeaderboardType = "all";
		}

		// --- GET SCORES ---
		let scores = await this.leaderboard.getGlobalScores();

		if (!Array.isArray(scores)) {
			console.log("Invalid leaderboard data:", scores);
			scores = [];
		}

		// --- FILTER LOGIC ---
		const now = Date.now();

		scores = scores.filter(entry => {
			const time = new Date(entry.date).getTime();

			if (this.currentLeaderboardType === "today") {
				return now - time < 86400000;
			}

			if (this.currentLeaderboardType === "weekly") {
				return now - time < 7 * 86400000;
			}

			return true;
		});
		const bestScores = {};

			scores.forEach(s => {
				if (!bestScores[s.id] || s.score > bestScores[s.id].score) {
					bestScores[s.id] = s;
				}
			});


			scores = Object.values(bestScores);
		// --- SORT DESC ---
		scores.sort((a, b) => b.score - a.score);

		// --- PLAYER ---
		const playerId = this.leaderboard.getPlayerId();
		const newRank = scores.findIndex(s => s.id === playerId);

		// --- BUILD HTML ---
		let html = "";

		if (scores.length === 0) {
			listEl.innerHTML = `
				<div style="text-align:center; padding:40px; color:#00ff7f;">
					NO PILOTS YET 🚀<br>
					BE THE FIRST
				</div>
			`;
			return;
		}

		scores.forEach((entry, i) => {
			const score = Number(entry.score) || 0;

			let medal = "";
			if (i === 0) medal = "🥇";
			else if (i === 1) medal = "🥈";
			else if (i === 2) medal = "🥉";

			const isPlayer = entry.id === playerId;

			html += `
				<div class="leaderboard-row ${isPlayer ? "player-row" : ""} ${i < 3 ? "top-rank" : ""}">
					<span class="rank">${medal || "#" + (i + 1)}</span>
					<span class="name">${entry.name} ${isPlayer ? "🟢 YOU" : ""}</span>
					<span class="mission">${entry.level}</span>
					<span class="score">${score.toLocaleString()}</span>
				</div>
			`;
		});

		listEl.innerHTML = html;

		// =========================
		// 💎 RANK CHANGE EFFECT
		// =========================
		const lastRank = localStorage.getItem("lastRank");

		if (lastRank !== null && newRank !== -1 && newRank < lastRank) {
			const diff = lastRank - newRank;

			const notif = document.createElement("div");
			notif.innerText = `+${diff} RANKS ↑`;

			notif.style.cssText = `
				position: fixed;
				top: 20%;
				left: 50%;
				transform: translateX(-50%);
				color: #00ff7f;
				font-size: 32px;
				font-weight: bold;
				text-shadow: 0 0 20px #00ff7f;
				z-index: 999;
				animation: popUp 1s ease forwards;
			`;

			document.body.appendChild(notif);

			setTimeout(() => notif.remove(), 1000);
		}

		if (newRank !== -1) {
			localStorage.setItem("lastRank", newRank);
		}

		// =========================
		// 🔥 PLAYER ROW ANIMATION
		// =========================
		setTimeout(() => {
			const rows = document.querySelectorAll('.leaderboard-row');
			if (rows[newRank]) {
				rows[newRank].style.transform = "scale(1.1)";
				rows[newRank].style.boxShadow = "0 0 20px #00ff7f";

				setTimeout(() => {
					rows[newRank].style.transform = "";
					rows[newRank].style.boxShadow = "";
				}, 800);
			}
		}, 200);

		// =========================
		// ⚡ LIVE UPDATE LOOP
		// =========================
		if (this.lbInterval) clearInterval(this.lbInterval);

		this.lbInterval = setInterval(() => {
			if (leaderboardScreen.style.display === 'flex') {
				this.openLeaderboard();
			}
		}, 5000);
	}

    closeLeaderboard() {
        document.getElementById('leaderboard-screen').style.display = 'none';
    }

    submitScoreToGlobal() {
        const nameInputFail = document.getElementById('player-name-input-fail');
        const nameInputSuccess = document.getElementById('player-name-input');
        
        const nameInput = this.gameOverEl.style.display === 'flex' ? nameInputFail : nameInputSuccess;
        const container = this.gameOverEl.style.display === 'flex' ? document.getElementById('game-over-name-input') : document.getElementById('name-input-container');

        const name = nameInput.value.trim() || 'Anonymous Pilot';
        const currentCampaign = CONFIG.CAMPAIGNS[this.campaignIndex]?.name || 'Unknown';
        
        this.leaderboard.registerPlayer(name);
        this.leaderboard.submitScore(name, this.score, currentCampaign);
        
        // Visual feedback instead of opening whole leaderboard
        if (container) {
            container.innerHTML = `<div style="color: #00ff7f; font-size: 20px; font-weight: bold; margin: 10px 0;">SCORE SUBMITTED TO GLOBAL RANKINGS</div>`;
        }
    }

    showMainMenu() {
		if (this.controller.mobileControls) {
            this.controller.mobileControls.hide();
        }									 
		this.mainMenuEl.style.display = 'flex';
        this.startScreenEl.style.display = 'none';
        this.campaignSelectionEl.style.display = 'none';
        this.levelSelectionEl.style.display = 'none';
        this.gameOverEl.style.display = 'none';
        this.updateDailyMissionUI();
    }

    async updateDailyMissionUI() {
        const state = this.dailyMission.state;
        const descEl = document.getElementById('daily-mission-desc');
        const barEl = document.getElementById('daily-mission-bar');
        const statusEl = document.getElementById('daily-mission-status');
        
        if (!descEl || !barEl || !statusEl) return;

        // --- Update Global Info in Main Menu ---
        const rank = this.leaderboard.getPlayerRank();
        const best = await this.leaderboard.getLocalBest();
        const pilotName = this.leaderboard.getPlayerName();
        
        const infoDivId = 'pilot-global-info';
        let infoDiv = document.getElementById(infoDivId);
        if (!infoDiv) {
            infoDiv = document.createElement('div');
            infoDiv.id = infoDivId;
            infoDiv.style.cssText = `
                margin-top: 15px;
                padding: 10px;
                background: rgba(0,0,0,0.4);
                border-radius: 5px;
                border-left: 3px solid #00ff7f;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
            `;
            const menu = document.getElementById('daily-mission-menu');
            if (menu) menu.appendChild(infoDiv);
        }

        infoDiv.innerHTML = `
            <div style="font-size: 14px; color: #fff; font-weight: bold; letter-spacing: 1px;">PILOT: <span style="color: #00ff7f;">${pilotName.toUpperCase()}</span></div>
            <div style="display: flex; gap: 20px; font-size: 11px; opacity: 0.8;">
                <span>GLOBAL RANK: <span style="color: #ffcc00;">#${rank}</span></span>
                <span>PERSONAL BEST: <span style="color: #00ffff;">${best.toLocaleString()}</span></span>
            </div>
        `;

        descEl.innerText = state.description;
        
        let progressPercent = 0;
        if (state.completed) {
            progressPercent = 100;
            statusEl.innerText = "COMPLETED!";
            statusEl.style.color = "#00ff7f";
        } else {
            if (state.type === 'cumulative') {
                progressPercent = (state.progress / state.target) * 100;
                statusEl.innerText = `PROGRESS: ${state.progress} / ${state.target}`;
            } else {
                statusEl.innerText = "PENDING...";
            }
            statusEl.style.color = "#aaa";
        }
        
        barEl.style.width = `${progressPercent}%`;

        // Check for reward
        if (state.completed && !state.rewardClaimed) {
            const reward = this.dailyMission.getReward();
            if (reward) {
                this.score += reward.score;
                this.addWeaponXP(reward.xp);
                this.levelUpNotification.innerText = "DAILY CHALLENGE COMPLETED: +5,000 XP / +10,000 SCORE";
                this.levelUpNotification.style.color = "#ffff00";
                this.levelUpNotification.classList.add('visible');
                setTimeout(() => this.levelUpNotification.classList.remove('visible'), 3000);
                this.updateUI();
            }
        }
    }

    showStartScreen() {
        this.mainMenuEl.style.display = 'none';
        this.startScreenEl.style.display = 'flex';
        this.campaignSelectionEl.style.display = 'none';
        this.gameOverEl.style.display = 'none';
    }

    showCampaignSelection() {
        this.mainMenuEl.style.display = 'none';
        this.startScreenEl.style.display = 'none';
        this.campaignSelectionEl.style.display = 'flex';
        this.levelSelectionEl.style.display = 'none';
        this.gameOverEl.style.display = 'none';
        
        // Clear and populate campaign list
        this.campaignListEl.innerHTML = '';
        CONFIG.CAMPAIGNS.forEach((campaign, index) => {
			const firstLevelOfCampaign = (index * CONFIG.LEVELS.PER_CAMPAIGN) + 1;
            const isLocked = firstLevelOfCampaign > this.maxUnlockedLevel;
            const card = document.createElement('div');
            card.className = `campaign-card ${isLocked ? 'locked' : ''}`;
            const difficulty = index === 0 ? 'Normal' : index < 3 ? 'Hard' : 'Expert';
            card.innerHTML = `
                <div class="campaign-preview" style="background-image: url('${campaign.preview}')"></div>
                <div class="campaign-overlay">
                    <h3>${campaign.name}</h3>
                    <p>Mission ${index + 1}</p>
                    <div class="difficulty">Difficulty: ${difficulty}</div>
                </div>
            `;
			if (!isLocked) {
                const select = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    TONE.start();
                    this.showLevelSelection(index);
                };
                card.addEventListener('click', select);
                card.addEventListener('touchstart', select, { passive: false });
            }
            this.campaignListEl.appendChild(card);
        });
    }

    showLevelSelection(campaignIndex) {
        this.campaignSelectionEl.style.display = 'none';
        this.levelSelectionEl.style.display = 'flex';
        
        const campaign = CONFIG.CAMPAIGNS[campaignIndex];
        this.levelSelectionTitleEl.innerText = `${campaign.name.toUpperCase()}: MISSIONS`;
        
        // Clear and populate level grid
        this.levelGridEl.innerHTML = '';
        for (let i = 1; i <= CONFIG.LEVELS.PER_CAMPAIGN; i++) {
            const globalLevel = (campaignIndex * CONFIG.LEVELS.PER_CAMPAIGN) + i;
			const isLocked = globalLevel > this.maxUnlockedLevel;
            const card = document.createElement('div');
            card.className = `level-card ${isLocked ? 'locked' : ''}`;
            
            if (globalLevel === CONFIG.LEVELS.COUNT) {
                card.classList.add('final-boss');
            } else if (i % 5 === 0) {
                card.classList.add('boss');
            }
            
            card.innerText = i;
            if (!isLocked) {
				const select = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    TONE.start();
                    this.startGame(campaignIndex, i);
                };
                card.addEventListener('click', select);
                card.addEventListener('touchstart', select, { passive: false });
            }
            this.levelGridEl.appendChild(card);
        }
    }

    startGame(campaignIndex = 0, levelInCampaign = 1) {
        this.startScreenEl.style.display = 'none';
        this.campaignSelectionEl.style.display = 'none';
        this.levelSelectionEl.style.display = 'none';
        this.bossHud.style.display = 'none';
        this.missionSummaryEl.style.display = 'none';
        this.upgradeScreenEl.style.display = 'none';
        this.mainMenuEl.style.display = 'none';
	    // Show mobile controls if on mobile
        if (this.controller.mobileControls) {
            this.controller.mobileControls.show();
        }
		
		this.cameraController.enable();
        this.gameActive = true;

        // Reset Ability State
        this.abilityCooldown = 0;
        this.abilityActive = false;
        this.abilityDurationTimer = 0;
        this.abilityLastUsed = 0;
        
        if (this.pilotClass) {
            const classInfo = CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()];
            this.abilityHud.style.display = 'flex';
            this.abilityNameEl.innerText = classInfo.ability.name;
            this.abilityCooldownFillEl.style.width = '100%';
            this.abilityCooldownFillEl.style.background = '#00ff7f';
        } else {
            this.abilityHud.style.display = 'none';
        }

        if (this.gameMode === 'endless') {
            this.endlessHud.style.display = 'flex';
            this.world.generateProceduralArena('random', campaignIndex);
        } else {
            this.endlessHud.style.display = 'none';
            this.world.updateEnvironment(campaignIndex);
            // Non-endless starts with default ruins or specific campaign layouts
            if (levelInCampaign % 5 === 0) {
                 this.world.generateProceduralArena('Arena', campaignIndex);
            } else {
                 this.world.generateProceduralArena('Scatter', campaignIndex);
            }
        }
        
        // Reset level stats
        this.levelStats = {
            enemiesKilled: 0,
            shotsFired: 0,
            shotsHit: 0,
            damageTaken: 0,
            grenadesThrown: 0
        };
        
        this.campaignIndex = campaignIndex;
        this.level = (campaignIndex * CONFIG.LEVELS.PER_CAMPAIGN) + levelInCampaign;
        this.levelStartTime = Date.now();
        
         // Calculate dynamic score threshold for this level
        const baseThreshold = CONFIG.LEVELS.SCORE_PER_LEVEL;
        const levelMult = 1 + (this.level * CONFIG.LEVELS.SCALING_FACTOR);
        this.scoreForNextLevel = Math.round(baseThreshold * levelMult);
        
        // Always start level from 0 relative score (it resets per level now)
        this.score = 0;
        
        // --- Apply Meta Stats ---
        const metaHpBonus = 1 + (this.metaUpgrades.meta_hp || 0) * 0.1;
        const classHpBonus = this.pilotClass ? (CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()].bonus.health || 0) : 0;
        this.health = 100 * (metaHpBonus + classHpBonus);
        
        const metaGrenadeBonus = (this.metaUpgrades.meta_grenades || 0);
        const classGrenadeBonus = this.pilotClass ? (CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()].bonus.grenades || 0) : 0;
        this.grenadeCount = CONFIG.PLAYER.GRENADE_COUNT + (this.upgrades.max_grenades * 2) + metaGrenadeBonus + classGrenadeBonus;
        
        const metaSpeedBonus = 1 + (this.metaUpgrades.meta_speed || 0) * 0.05;
        const classSpeedBonus = this.pilotClass ? (CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()].bonus.speed || 0) : 0;
        this.controller.moveSpeed = CONFIG.PLAYER.MOVE_SPEED * (metaSpeedBonus + classSpeedBonus);

        // Apply Meta Shield
        let shieldAmount = (this.metaUpgrades.meta_shield || 0) * 10;
        if (this.pilotClass && CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()].bonus.shield) {
            shieldAmount += CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()].bonus.shield;
        }
        
        if (shieldAmount > 0) {
            this.buffs.shield = shieldAmount;
            this.updateBuffHUD();
        }

        // Setup objectives
        if (this.gameMode === 'endless') {
            this.world.clearObjectives();
            this.spawnEndlessWave();
        } else {
            const currentCampaign = CONFIG.CAMPAIGNS[this.campaignIndex];
            if (currentCampaign.objective !== "Extermination") {
                const count = currentCampaign.objective === "Sabotage" 
                    ? 4 + Math.floor(this.level/10) 
                    : 4 + Math.floor(this.level/12);
                this.world.spawnObjectives(currentCampaign.objective, count);
            } else {
                this.world.clearObjectives();
            }
        }

        this.updateUI();
    }

    spawnEndlessWave() {
        this.waveEnemiesRemaining = 10 + (this.wave * 2);
        this.isBossWave = this.wave % 5 === 0;
        this.isMajorBossWave = this.wave % 10 === 0;
        
        this.levelUpNotification.innerText = `WAVE ${this.wave}`;
        this.levelUpNotification.style.color = "#ffcc00";
        this.levelUpNotification.classList.add('visible');
        setTimeout(() => this.levelUpNotification.classList.remove('visible'), 2000);
        
        // Spawn immediate portion
        for (let i = 0; i < Math.min(10, this.waveEnemiesRemaining); i++) {
            this.spawnEnemy();
        }
        
        if (this.isBossWave) {
            this.spawnBoss();
        }
        
        this.updateEndlessUI();
    }

    restartGame() {
        this.gameOverEl.style.display = 'none';
        this.enemies.forEach(e => e.die());
        this.enemies = [];
        this.player.position.set(0, 1, 0);
        
        // Restart the specific level within the specific campaign
        const levelInCampaign = ((this.level - 1) % CONFIG.LEVELS.PER_CAMPAIGN) + 1;
        this.startGame(this.campaignIndex, levelInCampaign);
    }

    damagePlayer(amount) {
        if (!this.gameActive) return;
        
        // Ability: Kinetic Dome (Guardian) or Phase Dash (Striker) Invincibility
        if (this.abilityActive && (this.pilotClass === 'guardian' || this.pilotClass === 'striker')) return;

        // Shield check
        if (this.buffs.shield > 0) return;

        // Dodge Chance Upgrade
        const dodgeChance = (this.upgrades.dodge_chance || 0) * 0.05;
        if (Math.random() < dodgeChance) {
            this.levelUpNotification.innerText = "DODGED!";
            this.levelUpNotification.style.color = "#ffffff";
            this.levelUpNotification.classList.add('visible');
            setTimeout(() => this.levelUpNotification.classList.remove('visible'), 500);
            return;
        }

        // Reactive Armor (Thorns)
        if (this.upgrades.thorns > 0) {
            this.enemies.forEach(enemy => {
                if (enemy.alive && enemy.sprite.position.distanceTo(this.player.position) < 5) {
                    enemy.takeDamage(amount * 0.2 * this.upgrades.thorns);
                }
            });
        }

        this.health -= amount;
        this.levelStats.damageTaken += amount;
        this.updateUI();
        
        // Flash red
        this.damageFlashEl.style.opacity = '1';
        setTimeout(() => this.damageFlashEl.style.opacity = '0', 50);

        if (this.health <= 0) {
            this.gameOver();
        }
    }

    // Alias for damagePlayer to ensure compatibility with hazard logic
    takeDamage(amount) {
        this.damagePlayer(amount);
    }

    updateUI() {
        const metaHpBonus = 1 + (this.metaUpgrades.meta_hp || 0) * 0.1;
        const maxHealth = 100 * metaHpBonus + (this.upgrades.max_health || 0) * 25;
        this.healthEl.innerText = `${Math.max(0, Math.floor(this.health))} / ${Math.floor(maxHealth)}`;
        this.scoreEl.innerText = this.score;
        this.grenadeCountEl.innerText = this.grenadeCount;
        const levelInCampaign = ((this.level - 1) % CONFIG.LEVELS.PER_CAMPAIGN) + 1;
        this.levelEl.innerText = levelInCampaign;
        
        this.campaignIndex = Math.floor((this.level - 1) / CONFIG.LEVELS.PER_CAMPAIGN);
        const currentCampaign = CONFIG.CAMPAIGNS[this.campaignIndex];
        if (currentCampaign) {
            this.campaignNameEl.innerText = currentCampaign.name.toUpperCase();
            
            // Update Objective UI
			this.objectiveContainerEl.style.display = 'block';
            if (this.gameMode === 'endless') {
                this.objectiveProgressEl.innerText = `${Math.floor(this.score)} / ${this.scoreForNextLevel}`;
                const label = this.objectiveContainerEl.firstChild;
                if (label && label.nodeType === 3) label.textContent = 'SCORE TARGET: ';
            } else if (currentCampaign.objective === "Extermination") {
                this.objectiveContainerEl.style.display = 'none';
            } else {
                
                const total = this.world.objectives.length;
                const completed = this.world.objectives.filter(o => !o.alive).length;
                this.objectiveProgressEl.innerText = `${completed}/${total}`;
				const label = this.objectiveContainerEl.firstChild;
                if (label && label.nodeType === 3) label.textContent = 'OBJECTIVE: ';
            }
            
        }

        this.enemiesCountEl.innerText = this.levelStats.enemiesKilled;
    }

    gameOver() {
        this.gameActive = false;
		if (this.controller.mobileControls) {
            this.controller.mobileControls.hide();
        }
        this.cameraController.disable();
        this.gameOverEl.style.display = 'flex';
        this.finalScoreEl.innerText = this.score;
        document.exitPointerLock();

        // --- Save Tech Points ---
        const earnedTP = Math.floor(this.score / 10) + this.levelStats.enemiesKilled * 5;
        this.techPoints += earnedTP;
        localStorage.setItem('alien_exploration_tech_points', this.techPoints);

        // Restore name input container
        const container = document.getElementById('game-over-name-input');
        const savedName = this.leaderboard.getPlayerName();
        container.innerHTML = `
            <div style="color: #ffcc00; margin-bottom: 10px; font-size: 14px;">MISSION ENDED. EARNED ${earnedTP} TECH POINTS.</div>
            <label style="color: #ff4d4d; margin-bottom: 10px;">SUBMIT SCORE TO GLOBAL RANKINGS</label>
            <div style="display: flex; gap: 10px;">
                <input type="text" id="player-name-input-fail" value="${savedName}" placeholder="ENTER CALLSIGN" style="background: rgba(0,0,0,0.5); border: 2px solid #ff4d4d; color: #fff; padding: 10px; font-family: inherit; font-size: 18px; text-align: center; outline: none; width: 250px;">
                <button id="submit-score-btn-fail" class="btn" style="background: #ff4d4d; padding: 10px 20px; font-size: 16px;">SUBMIT</button>
            </div>
        `;
		if (savedName) {
			document.getElementById('player-name-input-fail').disabled = true;
		}
        
        // Re-attach event listener
		const nameInputFail = document.getElementById('player-name-input-fail');
        if (nameInputFail) {
            nameInputFail.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                nameInputFail.focus();
            }, { passive: true });
        }
        document.getElementById('submit-score-btn-fail').addEventListener('click', () => {
            
			if (nameInputFail.value.trim()) this.submitScoreToGlobal();
        });
    }

    updateComboUI(multiplier) {
        if (!this.comboMeterEl) return;
        
        this.comboMeterEl.style.display = 'flex';
        this.comboTextEl.innerText = `COMBO x${multiplier}`;
        this.comboMultiplierEl.innerText = `${this.comboCount} KILL STREAK`;
        
        // Add a small pop animation
        this.comboMeterEl.classList.remove('combo-pop');
        void this.comboMeterEl.offsetWidth; // Force reflow
        this.comboMeterEl.classList.add('combo-pop');
    }

    useAbility() {
        if (!this.pilotClass || this.abilityCooldown > 0 || this.abilityActive) return;

        const classInfo = CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()];
        const ability = classInfo.ability;
        
        // --- Apply Meta Upgrade Bonuses ---
        let cooldownMultiplier = 1;
        let durationMultiplier = 1;
        
        const classKey = this.pilotClass.toUpperCase();
        const cdUpgradeId = `meta_${this.pilotClass.toLowerCase()}_cd`;
        const durUpgradeId = `meta_${this.pilotClass.toLowerCase()}_dur`;
        
        if (this.metaUpgrades[cdUpgradeId]) {
            const upgradeConfig = CONFIG.META_UPGRADES[cdUpgradeId.toUpperCase()];
            cooldownMultiplier -= (this.metaUpgrades[cdUpgradeId] * upgradeConfig.bonus);
        }
        if (this.metaUpgrades[durUpgradeId]) {
            const upgradeConfig = CONFIG.META_UPGRADES[durUpgradeId.toUpperCase()];
            durationMultiplier += (this.metaUpgrades[durUpgradeId] * upgradeConfig.bonus);
        }

        this.abilityActive = true;
        this.maxAbilityDuration = ability.duration * durationMultiplier;
        this.maxAbilityCooldown = ability.cooldown * cooldownMultiplier;
        this.abilityDurationTimer = this.maxAbilityDuration;
        this.abilityCooldown = this.maxAbilityCooldown;
        this.abilityReadyNotified = false;
        
        // Sound & Feedback
        this.synth.triggerAttackRelease(['C5', 'G5'], '4n');
        this.levelUpNotification.innerText = ability.name;
        this.levelUpNotification.style.color = classInfo.color;
        this.levelUpNotification.classList.add('visible');
        setTimeout(() => this.levelUpNotification.classList.remove('visible'), 1000);

        // Class Specific Ability Activation
        if (this.pilotClass === 'striker') {
            this.activateStrikerAbility();
        } else if (this.pilotClass === 'guardian') {
            this.activateGuardianAbility();
        } else if (this.pilotClass === 'reaper') {
            this.activateReaperAbility();
        } else if (this.pilotClass === 'engineer') {
            this.activateEngineerAbility();
        }
    }

    notifyAbilityReady() {
        if (!this.pilotClass) return;
        
        const classInfo = CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()];
        const ability = classInfo.ability;
        
        // --- Visual Notification ---
        // 1. HUD Pulse
        this.abilityHud.classList.remove('ability-ready-notif');
        void this.abilityHud.offsetWidth; // Trigger reflow
        this.abilityHud.classList.add('ability-ready-notif');
        
        // 2. Small Popup Text near the bar
        const popup = document.createElement('div');
        popup.innerText = 'READY';
        popup.style.cssText = `
            position: absolute;
            bottom: 30px;
            right: 0;
            color: #00ff7f;
            font-size: 14px;
            font-weight: bold;
            text-shadow: 0 0 10px rgba(0, 255, 127, 0.8);
            pointer-events: none;
            animation: ready-float 1s ease-out forwards;
        `;
        
        // Add animation for popup
        if (!document.getElementById('ready-float-style')) {
            const style = document.createElement('style');
            style.id = 'ready-float-style';
            style.innerHTML = `
                @keyframes ready-float {
                    0% { transform: translateY(0); opacity: 0; }
                    20% { opacity: 1; }
                    100% { transform: translateY(-40px); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        this.abilityHud.appendChild(popup);
        setTimeout(() => popup.remove(), 1000);
        
        // --- Audio Notification ---
        this.synth.triggerAttackRelease('C6', '16n');
        setTimeout(() => this.synth.triggerAttackRelease('E6', '16n'), 50);
    }

    activateStrikerAbility() {
        const dashForce = 60;
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        direction.y = 0;
        direction.normalize();
        this.controller.velocity.add(direction.multiplyScalar(dashForce));
        
        // --- Class Synergy: Striker Dash + Explosive Barrels ---
        // Dash through a barrel to ignite it instantly with double power
        this.world.barrels.forEach(barrel => {
            if (barrel.alive) {
                const dist = this.player.position.distanceTo(barrel.sprite.position);
                if (dist < 5) {
                    this.explodeBarrel(barrel, true); // True for synergy bonus
                }
            }
        });

        // Visual dash effect
        this.damageFlashEl.style.backgroundColor = 'rgba(255, 77, 77, 0.2)';
        this.damageFlashEl.style.opacity = '1';
        setTimeout(() => this.damageFlashEl.style.opacity = '0', 200);
    }

    activateGuardianAbility() {
        // Create Dome Visual
        const geometry = new THREE.SphereGeometry(6, 32, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        const dome = new THREE.Mesh(geometry, material);
        dome.position.copy(this.player.position);
        this.scene.add(dome);
        
        const wireGeo = new THREE.SphereGeometry(6.1, 16, 16);
        const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.3 });
        const wireDome = new THREE.Mesh(wireGeo, wireMat);
        dome.add(wireDome);
        
        this.activeDome = dome;
    }

    activateReaperAbility() {
        // Visual feedback for Bloodlust
        this.damageFlashEl.style.backgroundColor = 'rgba(255, 0, 255, 0.1)';
        this.damageFlashEl.style.opacity = '1';
    }

    activateEngineerAbility() {
        // Spawn Sentry Drone
        const geometry = new THREE.BoxGeometry(0.5, 0.2, 0.5);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const drone = new THREE.Mesh(geometry, material);
        drone.position.copy(this.player.position);
        drone.position.y += 3;
        this.scene.add(drone);
        
        const droneObj = {
            mesh: drone,
            timer: 0,
            lastShot: 0,
            duration: 10000
        };
        
        this.activeDrone = droneObj;
    }

    onEnemyKilled(enemyPosition) {
        // --- Rare Loot System ---
        if (Math.random() < 0.02) {
            this.spawnLegendaryWeapon(enemyPosition);
        }

        // Handle combo
        this.comboCount++;
        const comboDurBonus = (this.upgrades.combo_extender || 0) * 2.0;
        this.comboTimer = this.maxComboTimer + comboDurBonus;
        
        let multiplier = 1;
        if (this.comboCount >= 10) multiplier = 10;
        else if (this.comboCount >= 5) multiplier = 5;
        else if (this.comboCount >= 3) multiplier = 3;
        else if (this.comboCount >= 2) multiplier = 2;

        const baseScore = 100;
        const baseXP = 100;
        
        const scoreMult = 1 + (this.upgrades.score_multiplier || 0) * 0.15;
        const xpMult = 1 + (this.upgrades.xp_boost || 0) * 0.20;

        const scoreGain = Math.round(baseScore * multiplier * scoreMult);
        const xpGain = Math.round(baseXP * multiplier * xpMult);

        this.score += scoreGain;
        this.addWeaponXP(xpGain);
        this.levelStats.enemiesKilled++;
        
        // --- Endless Mode Progression ---
        if (this.gameMode === 'endless') {
            this.updateEndlessUI();
            const aliveEnemies = this.enemies.filter(e => e.alive).length;
            if (aliveEnemies === 0) {
                this.wave++;
                // Every 3 waves in endless, re-generate the arena for variety
                if (this.wave % 3 === 0) {
                    this.world.generateProceduralArena('random', this.campaignIndex);
                    this.levelUpNotification.innerText = "ARENA SHIFTING...";
                    this.levelUpNotification.style.color = "#00ffff";
                    this.levelUpNotification.classList.add('visible');
                    setTimeout(() => this.levelUpNotification.classList.remove('visible'), 2000);
                }
                this.spawnEndlessWave();
            }
            return;
        }

        // Update daily mission (cumulative kills)
        this.dailyMission.updateProgress('kill_count', 1);
        if (this.levelStats.enemiesKilled % 10 === 0) this.updateDailyMissionUI();

        this.updateComboUI(multiplier);

        // Spawn Loot
        const extraDrop = ((this.upgrades.ammo_finder || 0) + (this.upgrades.health_finder || 0)) * 0.1;
        if (enemyPosition && Math.random() < (CONFIG.PICKUPS.DROP_CHANCE + extraDrop)) {
            this.spawnPickup(enemyPosition);
        }

        // Life Steal
        let lifeStealAmt = ((this.upgrades.life_steal || 0) * 2) + ((this.metaUpgrades.meta_lifesteal || 0) * 2);
        
        // Pilot Class Lifesteal Bonus (Reaper)
        if (this.pilotClass && CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()].bonus.lifesteal) {
            lifeStealAmt += CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()].bonus.lifesteal;
        }
        
        // Ability: Bloodlust (Reaper) - Guaranteed 20HP Lifesteal
        if (this.abilityActive && this.pilotClass === 'reaper') {
            lifeStealAmt += 20;
        }

        if (lifeStealAmt > 0) {
            const metaHpBonus = 1 + (this.metaUpgrades.meta_hp || 0) * 0.1;
            const maxHealth = 100 * metaHpBonus + (this.upgrades.max_health || 0) * 25;
            this.health = Math.min(maxHealth, this.health + lifeStealAmt);
            this.updateUI();
        }
        
        // Orbital Strike
        if (this.upgrades.orbital_strike > 0 && this.levelStats.enemiesKilled % 20 === 0) {
            this.triggerOrbitalStrike(enemyPosition);
        }

        // Bio-Hazard (Toxic Cloud)
        if (this.upgrades.toxic_cloud > 0) {
            this.triggerToxicCloud(enemyPosition);
        }

        // If the killed enemy was a boss, handle level transition immediately
        const killedBoss = this.enemies.some(e => e.isBoss && !e.alive);
        
        const levelInCampaign = ((this.level - 1) % CONFIG.LEVELS.PER_CAMPAIGN) + 1;
        
        if (killedBoss) {
            this.levelUp();
            return;
        }

        const currentCampaign = CONFIG.CAMPAIGNS[this.campaignIndex];
        let objectiveMet = false;

        if (currentCampaign.objective === "Extermination") {
            objectiveMet = this.score >= this.scoreForNextLevel;
        } else {
            // Objective met if all targets are dealt with
            objectiveMet = this.world.objectives.every(o => !o.alive);
        }

        if (objectiveMet) {
            if (levelInCampaign % 5 === 0) {
                if (!this.bossSpawned) {
                    this.spawnBoss();
                }
            } else {
                this.levelUp();
            }
        }
        this.updateUI();
    }

    spawnLegendaryWeapon(position) {
        const legends = Object.values(CONFIG.LEGENDARY_WEAPONS);
        const weapon = legends[Math.floor(Math.random() * legends.length)];
        
        const loader = new THREE.TextureLoader();
        const texture = loader.load(CONFIG.ASSETS.EXPLOSION); 
        const mat = new THREE.SpriteMaterial({ map: texture, color: weapon.color });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(1.5, 1.5, 1);
        sprite.position.copy(position);
        sprite.position.y = 1.0;
        this.scene.add(sprite);
        
        // Glow
        const glowGeo = new THREE.SphereGeometry(1, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({ color: weapon.color, transparent: true, opacity: 0.3 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        sprite.add(glow);
        
        this.pickups.push({
            sprite,
            type: 'legendary',
            legendData: weapon,
            alive: true,
            bobTime: Math.random() * Math.PI * 2
        });
    }

    triggerOrbitalStrike(position) {
        this.levelUpNotification.innerText = "ORBITAL STRIKE INBOUND";
        this.levelUpNotification.style.color = "#00ffff";
        this.levelUpNotification.classList.add('visible');
        setTimeout(() => this.levelUpNotification.classList.remove('visible'), 1000);

        // Visual effect for strike
        const beamGeo = new THREE.CylinderGeometry(2, 2, 200, 32);
        const beamMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.copy(position);
        beam.position.y = 100;
        this.scene.add(beam);

        // Sound
        this.explosionSynth.triggerAttackRelease('C1', '1s');

        // Damage enemies in radius
        setTimeout(() => {
            this.enemies.forEach(enemy => {
                if (enemy.alive && enemy.sprite.position.distanceTo(position) < 15) {
                    enemy.takeDamage(1000 * this.upgrades.orbital_strike);
                }
            });
            this.scene.remove(beam);
        }, 500);
    }

    triggerToxicCloud(position) {
        let radius = 8;
        const duration = 5000;
        let damage = 10 * this.upgrades.toxic_cloud;
        let color = 0x00ff00;

        // --- Class Synergy: Reaper Bloodlust + Toxic Cloud ---
        if (this.pilotClass === 'reaper' && this.abilityActive) {
            radius *= 2;
            damage *= 2;
            color = 0xff00ff;
        }

        // Visual
        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.2 });
        const cloud = new THREE.Mesh(geometry, material);
        cloud.position.copy(position);
        this.scene.add(cloud);

        const interval = setInterval(() => {
            this.enemies.forEach(enemy => {
                if (enemy.alive && enemy.sprite.position.distanceTo(position) < radius) {
                    enemy.takeDamage(damage);
                }
            });
        }, 500);

        setTimeout(() => {
            clearInterval(interval);
            this.scene.remove(cloud);
        }, duration);
    }

    triggerPlayerShockwave() {
        if (!this.upgrades.shockwave) return;
        const range = 10 * this.upgrades.shockwave;
        const damage = 50 * this.upgrades.shockwave;

        // Visual
        const geometry = new THREE.RingGeometry(1, 1.2, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff7f, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(this.player.position);
        ring.position.y = 0.1;
        this.scene.add(ring);

        let scale = 1;
        const interval = setInterval(() => {
            scale += 2.0;
            ring.scale.set(scale, scale, 1);
            if (scale > range) {
                this.scene.remove(ring);
                clearInterval(interval);
            }
        }, 20);

        this.enemies.forEach(enemy => {
            if (enemy.alive && enemy.sprite.position.distanceTo(this.player.position) < range) {
                enemy.takeDamage(damage);
                // Simple knockback
                const dir = enemy.sprite.position.clone().sub(this.player.position).normalize();
                enemy.sprite.position.addScaledVector(dir, 5);
            }
        });
    }

    spawnPickup(position) {
        const types = Object.values(CONFIG.PICKUPS.TYPES);
        
        // Weighted random selection
        const totalWeight = types.reduce((sum, t) => sum + (t.weight || 1), 0);
        let random = Math.random() * totalWeight;
        let type = types[0];
        
        for (const t of types) {
            random -= (t.weight || 1);
            if (random <= 0) {
                type = t;
                break;
            }
        }
        
        const loader = new THREE.TextureLoader();
        const texture = loader.load(type.icon);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 0.9
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(1.2, 1.2, 1);
        sprite.position.copy(position);
        sprite.position.y = 1.0; // Float slightly above ground
        
        // Add glow effect
        const glowGeo = new THREE.SphereGeometry(0.8, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({ 
            color: type.color, 
            transparent: true, 
            opacity: 0.2 
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        sprite.add(glow);
        
        this.scene.add(sprite);
        
        this.pickups.push({
            sprite,
            type: type.id,
            alive: true,
            bobTime: Math.random() * Math.PI * 2
        });
    }

    collectPickup(pickup) {
        if (!pickup.alive) return;
        pickup.alive = false;
        this.scene.remove(pickup.sprite);
        
        // --- Rare Loot System ---
        if (pickup.type === 'legendary') {
            const weapon = pickup.legendData;
            this.levelUpNotification.innerText = `LEGENDARY ACQUIRED: ${weapon.name}`;
            this.levelUpNotification.style.color = "#ffcc00";
            this.levelUpNotification.classList.add('visible');
            setTimeout(() => this.levelUpNotification.classList.remove('visible'), 3000);
            
            this.currentWeapon = { ...CONFIG.WEAPONS[weapon.base.toUpperCase()], ...weapon, isLegendary: true };
            this.weaponSprite.src = this.currentWeapon.sprite || CONFIG.WEAPONS[weapon.base.toUpperCase()].sprite;
            this.synth.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '2n');
            return;
        }

        const healMult = 1 + (this.upgrades.recovery_boost || 0) * 0.5;
        const metaHpBonus = 1 + (this.metaUpgrades.meta_hp || 0) * 0.1;
        const maxHealth = 100 * metaHpBonus + (this.upgrades.max_health || 0) * 25;

        // Effects
        if (pickup.type === 'health') {
            this.health = Math.min(maxHealth, this.health + (25 * healMult));
            this.synth.triggerAttackRelease('C4', '16n');
        } else if (pickup.type === 'ammo') {
            this.addWeaponXP(500);
            this.synth.triggerAttackRelease('G4', '16n');
        } else if (pickup.type === 'grenade') {
            this.grenadeCount++;
            this.synth.triggerAttackRelease('E4', '16n');
        } else if (pickup.type === 'shield') {
            this.buffs.shield = 10; // 10 seconds
            this.synth.triggerAttackRelease('F4', '8n');
        } else if (pickup.type === 'damage') {
            this.buffs.damage = 10; // 10 seconds
            this.synth.triggerAttackRelease('A4', '8n');
        } else if (pickup.type === 'nuclear') {
            this.buffs.nuclear = true;
            this.synth.triggerAttackRelease(['C2', 'G2', 'C3'], '4n');
            this.levelUpNotification.innerText = "NUCLEAR BATTERY ACQUIRED: OVERCHARGING NEXT SHOT";
            this.levelUpNotification.style.color = "#ccff00";
            this.levelUpNotification.classList.add('visible');
            setTimeout(() => this.levelUpNotification.classList.remove('visible'), 2000);
        }
        
        this.updateUI();
        this.updateBuffHUD();
    }

    updateBuffHUD() {
        const container = document.getElementById('buff-container');
        container.innerHTML = '';
        
        if (this.buffs.shield > 0) {
            this.addBuffIcon(container, 'shield', CONFIG.PICKUPS.TYPES.SHIELD.icon, this.buffs.shield / 10);
        }
        if (this.buffs.damage > 0) {
            this.addBuffIcon(container, 'damage', CONFIG.PICKUPS.TYPES.DAMAGE.icon, this.buffs.damage / 10);
        }
        if (this.buffs.nuclear) {
            this.addBuffIcon(container, 'nuclear', CONFIG.PICKUPS.TYPES.NUCLEAR.icon, 1);
        }
    }

    addBuffIcon(container, id, iconUrl, ratio) {
        const div = document.createElement('div');
        div.className = 'buff-icon';
        div.innerHTML = `
            <img src="${iconUrl}">
            <div class="buff-timer" style="transform: scaleY(${ratio})"></div>
        `;
        container.appendChild(div);
    }

    spawnBoss() {
        this.bossSpawned = true;
        this.bossHud.style.display = 'flex';
        this.bossHealthBar.style.width = '100%';
        this.bossPhaseMarkers.innerHTML = '';
        
        const isFinalLevel = this.level === CONFIG.LEVELS.COUNT;
        
        // Setup markers based on boss type
        const markerCount = isFinalLevel ? 2 : 1; // 3 phases for final, 2 for regular
        for (let i = 0; i < markerCount; i++) {
            const marker = document.createElement('div');
            marker.className = 'phase-marker';
            this.bossPhaseMarkers.appendChild(marker);
        }

        this.bossNameEl.innerText = isFinalLevel ? "THE OVERMIND" : "ANCIENT OVERLORD";
        
        // Notify player
        this.levelUpNotification.innerText = isFinalLevel ? "FINAL OBJECTIVE: DESTROY THE OVERMIND" : "WARNING: BOSS INBOUND";
        this.levelUpNotification.style.color = "#ff4d4d";
        this.levelUpNotification.classList.add('visible');
        
        setTimeout(() => {
            this.levelUpNotification.classList.remove('visible');
            // Spawn boss
            const distance = 50;
            const angle = Math.random() * Math.PI * 2;
            const x = this.player.position.x + Math.cos(angle) * distance;
            const z = this.player.position.z + Math.sin(angle) * distance;
            
            const type = isFinalLevel ? 'final_boss' : 'boss';
            const boss = new Enemy(this.scene, this.player, new THREE.Vector3(x, 0, z), type);
            this.enemies.push(boss);
        }, 2000);
    }

    levelUp() {
        this.gameActive = false;
		if (this.controller.mobileControls) {
            this.controller.mobileControls.hide();
        }									 
		this.cameraController.disable();
        document.exitPointerLock();

        // --- Save Tech Points ---
        const earnedTP = Math.floor(this.score / 10) + this.levelStats.enemiesKilled * 5;
        this.techPoints += earnedTP;
        localStorage.setItem('alien_exploration_tech_points', this.techPoints);

        // Update Summary Stats
        document.getElementById('stat-enemies').innerText = this.levelStats.enemiesKilled;
        
        const currentCampaign = CONFIG.CAMPAIGNS[this.campaignIndex];
        const totalObj = this.world.objectives.length;
        const completedObj = this.world.objectives.filter(o => !o.alive).length;
        
        if (currentCampaign.objective === "Extermination") {
            document.getElementById('stat-objectives').innerText = "N/A (Extermination)";
        } else {
            document.getElementById('stat-objectives').innerText = `${completedObj}/${totalObj}`;
        }

        document.getElementById('stat-grenades').innerText = this.levelStats.grenadesThrown;

        const accuracy = this.levelStats.shotsFired > 0 
            ? Math.round((this.levelStats.shotsHit / this.levelStats.shotsFired) * 100) 
            : 0;
        document.getElementById('stat-accuracy').innerText = `${accuracy}%`;
        document.getElementById('stat-damage').innerText = Math.round(this.levelStats.damageTaken);

        // Update Daily Missions (Level specific)
        const levelDuration = (Date.now() - this.levelStartTime) / 1000;
        this.dailyMission.updateProgress('no_grenades', this.levelStats.grenadesThrown, true);
        this.dailyMission.updateProgress('speedrun', levelDuration, true);
        this.dailyMission.updateProgress('high_accuracy', accuracy, true);

        this.updateDailyMissionUI();
        this.missionSummaryEl.style.display = 'flex';
        
        // Restore name input container
        const container = document.getElementById('name-input-container');
        const savedName = this.leaderboard.getPlayerName();
        container.innerHTML = `
            <label style="color: #00ff7f; margin-bottom: 10px;">SUBMIT SCORE TO GLOBAL RANKINGS</label>
            <div style="display: flex; gap: 10px;">
                <input type="text" id="player-name-input" value="${savedName}" placeholder="ENTER CALLSIGN" style="background: rgba(0,0,0,0.5); border: 2px solid #00ff7f; color: #fff; padding: 10px; font-family: inherit; font-size: 18px; text-align: center; outline: none; width: 250px;">
                <button id="submit-score-btn" class="btn" style="padding: 10px 20px; font-size: 16px;">SUBMIT</button>
            </div>
        `;
        if (savedName) {
			document.getElementById('player-name-input').disabled = true;
		}
        // Re-attach event listener
		const nameInputSuccess = document.getElementById('player-name-input');
        if (nameInputSuccess) {
            nameInputSuccess.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                nameInputSuccess.focus();
            }, { passive: true });
        }
        document.getElementById('submit-score-btn').addEventListener('click', () => {
            
			if (nameInputSuccess.value.trim()) this.submitScoreToGlobal();
        });
    }

    proceedToNextLevel() {
        if (this.level < CONFIG.LEVELS.COUNT) {
            this.level++;
			 
            // --- Update Persistent Progression ---
            if (this.level > this.maxUnlockedLevel) {
                this.maxUnlockedLevel = this.level;
                localStorage.setItem('alien_exploration_max_level', this.maxUnlockedLevel);
            }

            this.bossSpawned = false;
            this.bossHud.style.display = 'none';
            //this.scoreForNextLevel += CONFIG.LEVELS.SCORE_PER_LEVEL;
            
            const newCampaignIndex = Math.floor((this.level - 1) / CONFIG.LEVELS.PER_CAMPAIGN);
            const levelInCampaign = ((this.level - 1) % CONFIG.LEVELS.PER_CAMPAIGN) + 1;
            
            // Re-use startGame to reset level state
            this.startGame(newCampaignIndex, levelInCampaign);
        } else {
            this.gameActive = false;
            this.levelUpNotification.innerText = "MISSION ACCOMPLISHED: UNIVERSE SAVED";
            this.levelUpNotification.style.color = "#00ff7f";
            this.levelUpNotification.classList.add('visible');
            setTimeout(() => {
                this.gameOver();
            }, 5000);
        }
    }

    shoot() {
        const now = Date.now();
        const baseFireRate = this.currentWeapon.fireRate;
        const upgradeFireRateMult = 1 / (1 + (this.upgrades.fire_rate || 0) * 0.15);
        const berserkMult = 1 / (1 + Math.min(0.5, (this.levelStats.enemiesKilled || 0) * 0.02));
        
        // Ability: Bloodlust (Reaper) - Double fire rate
        const abilityFireRateMult = (this.abilityActive && this.pilotClass === 'reaper') ? 0.5 : 1;
        
        const finalFireRate = baseFireRate * upgradeFireRateMult * (this.upgrades.berserk ? berserkMult : 1) * abilityFireRateMult;
        
        if (now - this.lastFireTime < finalFireRate) return;
        this.lastFireTime = now;

        this.levelStats.shotsFired++;
        this.playWeaponSound();

        // Stability Upgrade
        const stabilityMult = 1 - (this.upgrades.stability || 0) * 0.3;
        const recoil = this.currentWeapon.recoil * stabilityMult;
        this.weaponContainer.style.transform = `translateX(-50%) translateY(${recoil}px) rotate(${Math.random() * 2 - 1}deg)`;
        this.muzzleFlash.style.display = 'block';
        this.crosshair.style.transform = `translate(-50%, -50%) scale(${1.5 + (this.upgrades.marksman ? 0.5 : 0)})`;
        
        setTimeout(() => {
            this.muzzleFlash.style.display = 'none';
            this.crosshair.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 50);

        setTimeout(() => {
            this.weaponContainer.style.transform = 'translateX(-50%) translateY(0) rotate(0)';
        }, 100);

        const shotsCount = this.currentWeapon.id === 'shotgun' ? this.currentWeapon.pellets : 1;
        const doubleBulletChance = (this.upgrades.double_bullet || 0) * 0.2;
        const totalShots = Math.random() < doubleBulletChance ? shotsCount * 2 : shotsCount;

        for (let i = 0; i < totalShots; i++) {
            const spread = this.currentWeapon.id === 'shotgun' ? this.currentWeapon.spread : (doubleBulletChance > 0 ? 0.02 : 0);
            this.performRaycast(spread);
        }
    }

    performRaycast(spread) {
        // Raycasting for hits
        const center = new THREE.Vector2(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread
        ); 
        this.raycaster.setFromCamera(center, this.camera);

        const weapon = this.currentWeapon;
        let baseDamage = this.buffs.damage > 0 ? weapon.damage * 2 : weapon.damage;
        
        // --- Apply Upgrades to Damage ---
        let damage = baseDamage * (1 + (this.upgrades.damage_boost || 0) * 0.15);
        
        // World Event: Energy Surge
        if (this.currentEvent?.id === 'surge') {
            damage *= 1.5;
        }

        // Meta Perk: Damage
        damage *= (1 + (this.metaUpgrades.meta_dmg || 0) * 0.1);

        // Pilot Class Damage Bonus (Striker)
        if (this.pilotClass && CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()].bonus.damage) {
            damage *= (1 + CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()].bonus.damage);
        }

        // Critical Hit Check
        let critChance = (this.upgrades.crit_chance || 0) * 0.1 + (this.metaUpgrades.meta_crit || 0) * 0.05;
        
        // Pilot Class Crit Bonus (Reaper)
        if (this.pilotClass && CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()].bonus.crit) {
            critChance += CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()].bonus.crit;
        }
        let isCrit = false;
        if (Math.random() < critChance) {
            const critMult = 2 + (this.upgrades.crit_damage || 0) * 0.5;
            damage *= critMult;
            isCrit = true;
        }

        // Adrenaline (Last Stand)
        if (this.upgrades.last_stand > 0 && this.health < 25) {
            damage *= 1.5;
        }

        // Nuclear Battery overcharge (10x damage for one shot)
        if (this.buffs.nuclear) {
            damage *= 10;
            this.buffs.nuclear = false;
            this.updateBuffHUD();
            // Visual feedback for nuclear shot
            this.damageFlashEl.style.backgroundColor = 'rgba(204, 255, 0, 0.4)';
            this.damageFlashEl.style.opacity = '1';
            setTimeout(() => {
                this.damageFlashEl.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
                this.damageFlashEl.style.opacity = '0';
            }, 100);
        }
        
        // Show muzzle flash
        if (this.muzzleFlash3D) {
            this.muzzleFlash3D.visible = true;
            this.muzzleFlash3D.scale.setScalar(1.0 + Math.random() * 0.5);
            setTimeout(() => { if (this.muzzleFlash3D) this.muzzleFlash3D.visible = false; }, 30);
        }
        
        // Get all potential targets
        const enemies = this.enemies.filter(e => e.alive);
        const targetSprites = enemies.map(e => e.sprite);
        const hives = this.world.objectives.filter(o => o.type === 'hive' && o.alive);
        const targetHives = hives.map(h => h.mesh);
        const barrels = this.world.barrels.filter(b => b.alive);
        const targetBarrels = barrels.map(b => b.mesh);

        const allTargets = [...targetSprites, ...targetHives, ...targetBarrels, ...this.world.obstacles];
        const intersects = this.raycaster.intersectObjects(allTargets);

        // --- Visual Tracer (Trail) ---
        const wbColorData = CONFIG.WORKBENCH.COLORS.find(c => c.id === this.workbenchCustoms.color);
        const weaponColor = wbColorData ? wbColorData.color : (weapon.color || 0x00ffff);
        const startPos = this.camera.position.clone();
        // Adjust startPos slightly down and right to look like it comes from the gun
        const right = new THREE.Vector3(0.3, -0.3, -1.2).applyQuaternion(this.camera.quaternion);
        startPos.add(right);

        let endPos;
        if (intersects.length > 0) {
            endPos = intersects[0].point;
            this.createImpactEffect(endPos, weaponColor, 5);
        } else {
            // If no hit, project tracer far into distance
            const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            endPos = startPos.clone().add(direction.multiplyScalar(100));
        }
        
        this.createTracer(startPos, endPos, weaponColor);

        if (intersects.length > 0) {
            this.levelStats.shotsHit++;
            
            // Handle piercing
            let hitsToProcess = 1;
            const extraPierce = this.upgrades.armor_pierce || 0;
            
            if (weapon.id === 'railgun' || weapon.pierceAll) {
                hitsToProcess = intersects.length;
            } else if (weapon.pierceCount) {
                hitsToProcess = Math.min(intersects.length, weapon.pierceCount + 1 + extraPierce);
            } else if (extraPierce > 0) {
                hitsToProcess = Math.min(intersects.length, 1 + extraPierce);
            }

            for (let i = 0; i < hitsToProcess; i++) {
                const hit = intersects[i];
                const object = hit.object;

                // Impact particles
                this.createImpactEffect(hit.point, isCrit ? 0xff0000 : weaponColor, 5);

                // Explosion Bullets Upgrade
                const explosionChance = (this.upgrades.explosion_bullets || 0) * 0.05;
                if (Math.random() < explosionChance) {
                    this.bulletExplosion(hit.point);
                }

                // Process Enemy Hit
                const enemy = enemies.find(e => e.sprite === object);
                if (enemy) {
                    // Check for headshot (top 20% of sprite)
                    let finalDamage = damage;
                    const hitY = hit.point.y;
                    const enemyY = enemy.sprite.position.y;
                    if (hitY > enemyY + 0.5) { // Simple headshot logic
                        finalDamage *= (1.25 + (this.upgrades.headshot_bonus || 0) * 0.25);
                        this.createImpactEffect(hit.point, 0xffcc00, 10); // Golden spark for headshot
                    }

                    enemy.takeDamage(finalDamage);
                    
                    // --- Workbench Status Effects ---
                    const statusType = this.workbenchCustoms.effect;
                    if (statusType === 'acid' && Math.random() < 0.1) {
                        enemy.acidTimer = 2.0; // Handled in Enemy.js
                        this.createImpactEffect(hit.point, 0x00ff00, 15);
                        this.levelUpNotification.innerText = "ARMOR MELTED";
                        this.levelUpNotification.style.color = "#00ff00";
                        this.levelUpNotification.classList.add('visible');
                        setTimeout(() => this.levelUpNotification.classList.remove('visible'), 800);
                    } else if (statusType === 'shock' && Math.random() < 0.1) {
                        enemy.stun(1.0);
                        this.createImpactEffect(hit.point, 0x00ffff, 15);
                        this.levelUpNotification.innerText = "SYSTEM DISRUPTED";
                        this.levelUpNotification.style.color = "#00ffff";
                        this.levelUpNotification.classList.add('visible');
                        setTimeout(() => this.levelUpNotification.classList.remove('visible'), 800);
                    } else if (statusType === 'slow' && Math.random() < 0.15) {
                        enemy.freeze(3.0);
                        this.createImpactEffect(hit.point, 0x00aaff, 15);
                    }

                    // Freeze Upgrade (Legacy)
                    const freezeChance = (this.upgrades.freeze || 0) * 0.05;
                    if (Math.random() < freezeChance) {
                        enemy.freeze(2.0);
                    }

                    // Electric Chain Upgrade
                    const chainChance = (this.upgrades.electric_chain || 0) * 0.1;
                    if (Math.random() < chainChance) {
                        this.triggerElectricChain(enemy, damage * 0.5);
                    }

                    if (hitsToProcess === 1) break;
                    continue;
                }

                // Process Hive Hit
                const hive = hives.find(h => h.mesh === object);
                if (hive) {
                    hive.health -= damage;
                    this.createImpactEffect(hit.point, 0xaa00ff, 10);
                    if (hive.health <= 0) {
                        hive.alive = false;
                        this.scene.remove(hive.sprite);
                        this.scene.remove(hive.mesh);
                        const obsIdx = this.world.obstacles.indexOf(hive.mesh);
                        if (obsIdx > -1) this.world.obstacles.splice(obsIdx, 1);
                        this.onEnemyKilled(hive.sprite.position.clone());
                    }
                    if (hitsToProcess === 1) break;
                    continue;
                }

                // Process Barrel Hit
                const barrel = barrels.find(b => b.mesh === object);
                if (barrel) {
                    this.explodeBarrel(barrel);
                    if (hitsToProcess === 1) break;
                    continue;
                }
            }
        }
    }

    bulletExplosion(position) {
        const explosionRadius = 5;
        const damage = 25 * this.upgrades.explosion_bullets;
        
        // Visual
        const explosionTexture = new THREE.TextureLoader().load(CONFIG.ASSETS.EXPLOSION);
        const mat = new THREE.SpriteMaterial({ 
            map: explosionTexture,
            blending: THREE.AdditiveBlending,
            color: 0xffaa00
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(4, 4, 1);
        sprite.position.copy(position);
        this.scene.add(sprite);

        this.enemies.forEach(enemy => {
            if (!enemy.alive) return;
            const dist = enemy.sprite.position.distanceTo(position);
            if (dist < explosionRadius) {
                enemy.takeDamage(damage);
            }
        });

        setTimeout(() => this.scene.remove(sprite), 200);
    }

    triggerElectricChain(startEnemy, damage) {
        const range = 10;
        let targets = this.enemies.filter(e => e.alive && e !== startEnemy && e.sprite.position.distanceTo(startEnemy.sprite.position) < range);
        
        targets.slice(0, 3).forEach(enemy => {
            enemy.takeDamage(damage);
            // Visual line
            this.createTracer(startEnemy.sprite.position.clone(), enemy.sprite.position.clone(), 0x00ffff);
        });
    }

    throwGrenade() {
        const now = Date.now();
        if (this.grenadeCount <= 0 || now - this.lastGrenadeTime < CONFIG.PLAYER.GRENADE_COOLDOWN) return;

        this.grenadeCount--;
        this.lastGrenadeTime = now;
        this.levelStats.grenadesThrown++;
        this.updateUI();

        // Create grenade visual
        const texture = new THREE.TextureLoader().load(CONFIG.ASSETS.GRENADE);
        const mat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(1, 1, 1);
        
        // Spawn at player position
        sprite.position.copy(this.player.position);
        sprite.position.y += CONFIG.PLAYER.EYE_HEIGHT - 0.2;
        this.scene.add(sprite);

        // Velocity based on camera direction
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.quaternion);
        
        const force = 20;
        const velocity = direction.clone().multiplyScalar(force);
        velocity.y += 5; // Toss it up slightly

        const grenade = {
            sprite,
            velocity,
            timer: 2.0, // 2 seconds to explode
            alive: true
        };

        this.grenades.push(grenade);
    }

    explodeGrenade(grenade) {
        if (!grenade.alive) return;
        grenade.alive = false;

        // Visual Explosion
        const explosionTexture = new THREE.TextureLoader().load(CONFIG.ASSETS.EXPLOSION);
        const mat = new THREE.SpriteMaterial({ map: explosionTexture });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(12, 12, 1);
        sprite.position.copy(grenade.sprite.position);
        this.scene.add(sprite);

        // Remove grenade visual
        this.scene.remove(grenade.sprite);

        // Damage nearby enemies
        let explosionRadius = 15;
        
        // Pilot Class Explosion Radius Bonus (Engineer)
        if (this.pilotClass && CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()].bonus.explosionRadius) {
            explosionRadius *= (1 + CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()].bonus.explosionRadius);
        }

        const damageMultiplier = 1 + (this.upgrades.grenade_damage * 0.5);
        this.enemies.forEach(enemy => {
            if (!enemy.alive) return;
            const dist = enemy.sprite.position.distanceTo(grenade.sprite.position);
            if (dist < explosionRadius) {
                enemy.takeDamage(300 * damageMultiplier);
            }
        });

        // Damage nearby hives
        this.world.objectives.forEach(obj => {
            if (obj.type === 'hive' && obj.alive) {
                const dist = obj.sprite.position.distanceTo(grenade.sprite.position);
                if (dist < explosionRadius) {
                    obj.health -= 200;
                    if (obj.health <= 0) {
                        obj.alive = false;
                        this.scene.remove(obj.sprite);
                        this.scene.remove(obj.mesh);
                        const obsIdx = this.world.obstacles.indexOf(obj.mesh);
                        if (obsIdx > -1) this.world.obstacles.splice(obsIdx, 1);
                        this.onEnemyKilled(obj.sprite.position.clone());
                    }
                }
            }
        });

        // Explode barrels
        this.world.barrels.forEach(barrel => {
            if (barrel.alive) {
                const dist = barrel.sprite.position.distanceTo(grenade.sprite.position);
                if (dist < explosionRadius) {
                    this.explodeBarrel(barrel);
                }
            }
        });

        // Fade out explosion
        setTimeout(() => {
            let opacity = 1.0;
            const fadeInt = setInterval(() => {
                opacity -= 0.1;
                sprite.material.opacity = opacity;
                if (opacity <= 0) {
                    clearInterval(fadeInt);
                    this.scene.remove(sprite);
                }
            }, 50);
        }, 500);
    }

    explodeBarrel(barrel, isSynergy = false) {
        if (!barrel.alive) return;
        barrel.alive = false;

        // Visual Explosion
        const explosionTexture = new THREE.TextureLoader().load(CONFIG.ASSETS.EXPLOSION);
        const mat = new THREE.SpriteMaterial({ map: explosionTexture });
        const sprite = new THREE.Sprite(mat);
        
        let explosionScale = 10;
        if (isSynergy) {
            explosionScale = 20;
            this.levelUpNotification.innerText = "CLASS SYNERGY: VOLATILE DASH";
            this.levelUpNotification.style.color = "#ff4d4d";
            this.levelUpNotification.classList.add('visible');
            setTimeout(() => this.levelUpNotification.classList.remove('visible'), 1000);
        }

        sprite.scale.set(explosionScale, explosionScale, 1);
        sprite.position.copy(barrel.sprite.position);
        this.scene.add(sprite);

        // --- Synergy Check: Toxic Ignition ---
        // Check if explosion happened inside a toxic cloud (visual only for now as cloud doesn't store state easy, but we can check if any toxic cloud upgrade is active)
        const synergyBonus = (this.upgrades.toxic_cloud ? 2.0 : 1.0) * (isSynergy ? 2.0 : 1.0);
        if (this.upgrades.toxic_cloud) {
            sprite.material.color.set(0x00ff00); // Green fire!
            this.levelUpNotification.innerText = "HAZARD SYNERGY: TOXIC IGNITION";
            this.levelUpNotification.style.color = "#00ff00";
            this.levelUpNotification.classList.add('visible');
            setTimeout(() => this.levelUpNotification.classList.remove('visible'), 1000);
        }

        // Remove barrel visuals
        this.scene.remove(barrel.sprite);
        const obsIdx = this.world.obstacles.indexOf(barrel.mesh);
        if (obsIdx > -1) this.world.obstacles.splice(obsIdx, 1);

        // Damage nearby enemies
        const explosionRadius = isSynergy ? 24 : 12;
        this.enemies.forEach(enemy => {
            if (!enemy.alive) return;
            const dist = enemy.sprite.position.distanceTo(barrel.sprite.position);
            if (dist < explosionRadius) {
                let damage = 250 * synergyBonus;
                
                // --- Synergy Check: Frozen Shatter ---
                if (enemy.frozenTimer > 0) {
                    damage *= 3.0;
                    this.levelUpNotification.innerText = "HAZARD SYNERGY: FROZEN SHATTER";
                    this.levelUpNotification.style.color = "#00ffff";
                    this.levelUpNotification.classList.add('visible');
                    setTimeout(() => this.levelUpNotification.classList.remove('visible'), 1000);
                    this.createImpactParticles(enemy.sprite.position, 0x00ffff);
                }

                enemy.takeDamage(damage); 
            }
        });

        // Fade out explosion
        setTimeout(() => {
            let opacity = 1.0;
            const fadeInt = setInterval(() => {
                opacity -= 0.1;
                sprite.material.opacity = opacity;
                if (opacity <= 0) {
                    clearInterval(fadeInt);
                    this.scene.remove(sprite);
                }
            }, 50);
        }, 500);
    }

    spawnEnemy() {
        // Spawn distance
        const distance = 40 + Math.random() * 20;
        const angle = Math.random() * Math.PI * 2;
        const x = this.player.position.x + Math.cos(angle) * distance;
        const z = this.player.position.z + Math.sin(angle) * distance;

        // Difficulty scaling based on global level (1-125)
        let type = 'normal';
        const rand = Math.random();
        
        // Increase spawn chance of tougher enemies as level increases
        const heavyChance = Math.min(0.5, (this.level / 125) * 0.8);
        const armoredChance = Math.min(0.7, (this.level / 60) * 0.8);

        if (this.level >= 15 && rand < heavyChance) {
            type = 'heavy';
        } else if (this.level >= 5 && rand < armoredChance) {
            type = 'armored';
        }

        const enemy = new Enemy(this.scene, this.player, new THREE.Vector3(x, 0, z), type);
        
        // Scale enemy stats slightly based on campaign
        const campaignBonus = 1 + (this.campaignIndex * 0.2);
        enemy.health *= campaignBonus;
        enemy.moveSpeed *= (1 + (this.campaignIndex * 0.05));
        
        this.enemies.push(enemy);
        this.updateUI();
    }

    updateMinimap() {
        const ctx = this.minimapCtx;
        const canvas = this.minimapCanvas;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const range = 100; // World units shown in minimap
        const scale = canvas.width / range;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Rotating Minimap: Always keep player looking UP
        const playerAngle = this.player.rotation.y;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(playerAngle); // Rotate map inverse of player rotation

        // Draw enemies relative to player
        this.enemies.forEach(enemy => {
            if (!enemy.alive) return;
            const relX = (enemy.sprite.position.x - this.player.position.x) * scale;
            const relZ = (enemy.sprite.position.z - this.player.position.z) * scale;
            
            // Check if within minimap radius
            const distSq = relX * relX + relZ * relZ;
            if (distSq < (canvas.width / 2) ** 2) {
                if (enemy.isBoss) {
                    const isFinal = enemy.type === 'final_boss';
                    ctx.fillStyle = isFinal ? 'rgba(255, 204, 0, 0.9)' : 'rgba(255, 165, 0, 0.9)';
                    const size = isFinal ? 7 + Math.sin(Date.now() / 150) * 1.5 : 5;
                    ctx.beginPath();
                    ctx.arc(relX, relZ, size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                    ctx.fillRect(relX - 1, relZ - 1, 2, 2);
                } else {
                    ctx.fillStyle = 'rgba(255, 77, 77, 0.7)';
                    ctx.beginPath();
                    ctx.arc(relX, relZ, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });

        // Draw objectives
        this.world.objectives.forEach(obj => {
            if (!obj.alive) return;
            const relX = (obj.sprite.position.x - this.player.position.x) * scale;
            const relZ = (obj.sprite.position.z - this.player.position.z) * scale;
            const distSq = relX * relX + relZ * relZ;
            if (distSq < (canvas.width / 2) ** 2) {
                ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
                ctx.beginPath();
                ctx.arc(relX, relZ, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.restore();

        // Draw player (always in center and pointing UP)
        ctx.fillStyle = 'rgba(0, 255, 127, 0.8)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Direction pointer (always UP)
        ctx.strokeStyle = 'rgba(0, 255, 127, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 2);
        ctx.lineTo(centerX, centerY - 12);
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.moveTo(centerX - 3, centerY - 8);
        ctx.lineTo(centerX, centerY - 13);
        ctx.lineTo(centerX + 3, centerY - 8);
        ctx.stroke();
    }

    shakeScreen(intensity = 10) {
        const originalBottom = -80;
        let shakeCount = 0;
        const maxShakes = 10;
        
        const shakeInterval = setInterval(() => {
            const offsetX = (Math.random() - 0.5) * intensity;
            const offsetY = (Math.random() - 0.5) * intensity;
            
            this.weaponContainer.style.transform = `translateX(calc(-50% + ${offsetX}px)) translateY(${offsetY}px)`;
            
            shakeCount++;
            if (shakeCount >= maxShakes) {
                clearInterval(shakeInterval);
                this.weaponContainer.style.transform = 'translateX(-50%) translateY(0)';
            }
        }, 30);
    }

    setupPostProcessing() {
        const renderScene = new RenderPass(this.scene, this.camera);
        
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, // strength
            0.4, // radius
            0.85 // threshold
        );
        bloomPass.threshold = 0.95;
        bloomPass.strength = 0.15;
        bloomPass.radius = 0.3;

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(bloomPass);
    }

    setupVFX() {
        // Muzzle flash 3D
        const flashGeo = new THREE.CylinderGeometry(0.1, 0.5, 0.8, 8);
        const flashMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffaa, 
            transparent: true, 
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        this.muzzleFlash3D = new THREE.Mesh(flashGeo, flashMat);
        this.muzzleFlash3D.rotation.x = Math.PI / 2;
        this.muzzleFlash3D.visible = false;
        this.camera.add(this.muzzleFlash3D);
        this.muzzleFlash3D.position.set(0.3, -0.3, -1.2);
    }

    createImpactEffect(position, color = 0x00ffff, count = 10) {
        const geometry = new THREE.SphereGeometry(0.05, 4, 4);
        for (let i = 0; i < count; i++) {
            const material = new THREE.MeshBasicMaterial({ 
                color: color,
                transparent: true,
                opacity: 1
            });
            const p = new THREE.Mesh(geometry, material);
            p.position.copy(position);
            
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3
            );
            
            this.vfxParticles.push({
                mesh: p,
                velocity: velocity,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.05
            });
            this.scene.add(p);
        }
    }

    createTracer(start, end, color = 0x00ffff) {
        const points = [start, end];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        const wbTrailData = CONFIG.WORKBENCH.TRAILS.find(t => t.id === this.workbenchCustoms.trail);
        const trailDecay = wbTrailData ? wbTrailData.decay : 0.1;
        const trailOpacity = wbTrailData ? (wbTrailData.opacity || 0.8) : 0.8;

        const material = new THREE.LineBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: trailOpacity,
            blending: THREE.AdditiveBlending 
        });
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        this.tracers.push({ mesh: line, life: 1.0, decay: trailDecay });
    }

    updateVFX(delta) {
        // Update particles
        for (let i = this.vfxParticles.length - 1; i >= 0; i--) {
            const p = this.vfxParticles[i];
            p.mesh.position.add(p.velocity);
            p.life -= p.decay;
            p.mesh.material.opacity = p.life;
            p.mesh.scale.setScalar(p.life);
            
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.vfxParticles.splice(i, 1);
            }
        }

        // Update tracers
        for (let i = this.tracers.length - 1; i >= 0; i--) {
            const t = this.tracers[i];
            t.life -= t.decay;
            t.mesh.material.opacity = t.life;
            if (t.life <= 0) {
                this.scene.remove(t.mesh);
                t.mesh.geometry.dispose();
                t.mesh.material.dispose();
                this.tracers.splice(i, 1);
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const deltaTime = this.clock.getDelta();

        if (this.gameActive) {
			// Update mobile controls (especially for continuous joystick aiming)
            if (this.controller.mobileControls) {
                this.controller.mobileControls.update(deltaTime);
            }
            // --- World Event Management ---
            this.eventTimer += deltaTime;
            if (!this.currentEvent && this.eventTimer >= this.nextEventIn) {
                this.triggerWorldEvent();
                this.eventTimer = 0;
                this.nextEventIn = 60 + Math.random() * 60;
            }
            if (this.currentEvent) {
                this.eventDurationTimer -= deltaTime;
                this.eventTimerEl.innerText = `${Math.ceil(this.eventDurationTimer)}s`;
                if (this.eventDurationTimer <= 0) {
                    this.endWorldEvent();
                }
            }

            const cameraRotation = this.cameraController.update();
            
            // Basic collision with world obstacles
            const prevPos = this.player.position.clone();
            // Handle Regeneration
            const regenAmount = (this.upgrades.health_regen || 0) + (this.metaUpgrades.meta_regen || 0);
            if (regenAmount > 0) {
                this.regenTimer = (this.regenTimer || 0) + deltaTime;
                if (this.regenTimer >= 5) {
                    const metaHpBonus = 1 + (this.metaUpgrades.meta_hp || 0) * 0.1;
                    const maxH = 100 * metaHpBonus + (this.upgrades.max_health || 0) * 25;
                    this.health = Math.min(maxH, this.health + regenAmount);
                    this.updateUI();
                    this.regenTimer = 0;
                }
            }

            // Handle Shield Generation
            if (this.upgrades.shield_gen > 0) {
                this.shieldGenTimer = (this.shieldGenTimer || 0) + deltaTime;
                if (this.shieldGenTimer >= 30) {
                    this.buffs.shield = Math.min(30, (this.buffs.shield || 0) + 10);
                    this.updateBuffHUD();
                    this.shieldGenTimer = 0;
                }
            }

            // Handle Grenade CD Upgrade
            if (this.upgrades.grenade_cd > 0) {
                this.grenadeRefillTimer = (this.grenadeRefillTimer || 0) + deltaTime;
                if (this.grenadeRefillTimer >= 45) {
                    const maxG = CONFIG.PLAYER.GRENADE_COUNT + (this.upgrades.max_grenades || 0) * 2;
                    if (this.grenadeCount < maxG) {
                        this.grenadeCount++;
                        this.updateUI();
                    }
                    this.grenadeRefillTimer = 0;
                }
            }

            const wasOnGround = this.controller.isOnGround;
            this.controller.update(deltaTime, cameraRotation);
            if (!wasOnGround && this.controller.isOnGround) {
                this.triggerPlayerShockwave();
            }

            // Simple Box Collision with World Obstacles
            const playerBox = new THREE.Box3().setFromCenterAndSize(
                this.player.position, 
                new THREE.Vector3(1, 2, 1)
            );

            for (const obstacle of this.world.obstacles) {
                const obstacleBox = new THREE.Box3().setFromObject(obstacle);
                if (playerBox.intersectsBox(obstacleBox)) {
                    // Check if we can step up or if we should stop
                    const overlapY = obstacleBox.max.y - playerBox.min.y;
                    if (overlapY < 0.6 && this.controller.velocity.y <= 0) {
                        // Step up
                        this.player.position.y = obstacleBox.max.y + 1;
                        this.controller.isOnGround = true;
                        this.controller.velocity.y = 0;
                    } else {
                        // Stop horizontal movement
                        this.player.position.x = prevPos.x;
                        this.player.position.z = prevPos.z;
                    }
                }
            }

            // --- Update Environmental Hazards & Class Synergies ---
            const hazardStatus = this.world.updateHazards(deltaTime, this.player.position, this.activeDome);
            const { playerDamage, hazardImminent } = hazardStatus;
            
            if (this.hazardWarningEl) {
                this.hazardWarningEl.style.display = hazardImminent ? 'block' : 'none';
                if (hazardImminent && Math.random() < 0.05) {
                    this.synth.triggerAttackRelease('C1', '32n'); // Low alert thrum
                }
            }

            if (playerDamage > 0) {
                let bypassed = false;
                
                // 1. Striker Dash Bypass (Invulnerable while dashing)
                if (this.pilotClass === 'striker' && this.abilityActive) {
                    bypassed = true;
                    
                    // --- Synergy: Striker Dash Disables Lasers ---
                    this.world.hazards.forEach(h => {
                        if (h.type === 'laser') {
                            const distToLaser = this.player.position.distanceTo(h.group.position);
                            if (distToLaser < 20) {
                                h.disabledTimer = 3.0; // Disable for 3 seconds
                                this.levelUpNotification.innerText = "HAZARD DISRUPTED";
                                this.levelUpNotification.style.color = "#ff4d4d";
                                this.levelUpNotification.classList.add('visible');
                                setTimeout(() => this.levelUpNotification.classList.remove('visible'), 1000);
                            }
                        }
                    });
                }
                
                // 2. Guardian Dome Bypass (Protected inside dome)
                if (this.activeDome) {
                    const distToDome = this.player.position.distanceTo(this.activeDome.position);
                    if (distToDome < 6) bypassed = true;
                }
                
                if (!bypassed) {
                    this.damagePlayer(playerDamage);
                }
            }

            this.updateVFX(deltaTime);
            this.updateMinimap();

            // Handle continuous firing
            if (this.isFiring) {
                this.shoot();
            }

            // Update grenades
            for (let i = this.grenades.length - 1; i >= 0; i--) {
                const grenade = this.grenades[i];
                if (grenade.alive) {
                    grenade.timer -= deltaTime;
                    
                    // Simple physics
                    grenade.velocity.y -= 25 * deltaTime; // Gravity
                    grenade.sprite.position.add(grenade.velocity.clone().multiplyScalar(deltaTime));
                    
                    // Ground collision
                    if (grenade.sprite.position.y < 0.5) {
                        grenade.sprite.position.y = 0.5;
                        grenade.velocity.y *= -0.3; // Bounce
                        grenade.velocity.x *= 0.8; // Friction
                        grenade.velocity.z *= 0.8;
                    }

                    if (grenade.timer <= 0) {
                        this.explodeGrenade(grenade);
                    }
                } else {
                    this.grenades.splice(i, 1);
                }
            }

            // Safety net: Reset if fallen out of bounds
            if (this.player.position.y < -20) {
                this.player.position.set(0, 5, 0);
                this.controller.velocity.set(0, 0, 0);
            }

            // Bobbing weapon
            const isMoving = this.controller.velocity.x !== 0 || this.controller.velocity.z !== 0;
            if (isMoving) {
                this.bobbingTime += deltaTime * 10;
                const bobX = Math.sin(this.bobbingTime * 0.5) * 4; // Reduced from 8
                const bobY = Math.abs(Math.cos(this.bobbingTime)) * 6; // Reduced from 12
                this.weaponContainer.style.bottom = `${-80 + bobY}px`;
                this.weaponContainer.style.transform = `translateX(calc(-50% + ${bobX}px))`;
            } else {
                this.bobbingTime = 0;
                this.weaponContainer.style.bottom = '-80px';
                this.weaponContainer.style.transform = 'translateX(-50%)';
            }

            // Update buffs
            let buffChanged = false;
            if (this.buffs.shield > 0) {
                this.buffs.shield -= deltaTime;
                if (this.buffs.shield <= 0) {
                    this.buffs.shield = 0;
                    this.synth.triggerAttackRelease('C3', '8n');
                }
                buffChanged = true;
            }
            if (this.buffs.damage > 0) {
                this.buffs.damage -= deltaTime;
                if (this.buffs.damage <= 0) {
                    this.buffs.damage = 0;
                    this.synth.triggerAttackRelease('C3', '8n');
                }
                buffChanged = true;
            }
            if (buffChanged) this.updateBuffHUD();

            // Update combo
            if (this.comboCount > 0) {
                this.comboTimer -= deltaTime;
                if (this.comboTimer <= 0) {
                    this.comboCount = 0;
                    this.comboTimer = 0;
                    this.comboMeterEl.style.display = 'none';
                } else {
                    const ratio = this.comboTimer / this.maxComboTimer;
                    this.comboTimerFillEl.style.width = `${ratio * 100}%`;
                }
            }

            // --- Update Ability ---
            if (this.pilotClass) {
                const classInfo = CONFIG.PRESTIGE.CLASSES[this.pilotClass.toUpperCase()];
                const ability = classInfo.ability;

                if (this.abilityActive) {
                    this.abilityDurationTimer -= deltaTime * 1000;
                    if (this.abilityDurationTimer <= 0) {
                        this.abilityActive = false;
                        this.abilityDurationTimer = 0;
                        if (this.pilotClass === 'reaper') this.damageFlashEl.style.opacity = '0';
                        if (this.pilotClass === 'guardian' && this.activeDome) {
                            this.scene.remove(this.activeDome);
                            this.activeDome = null;
                        }
                    }
                }

                if (this.abilityCooldown > 0) {
                    this.abilityCooldown -= deltaTime * 1000;
                    if (this.abilityCooldown <= 0) {
                        this.abilityCooldown = 0;
                        if (!this.abilityReadyNotified) {
                            this.notifyAbilityReady();
                            this.abilityReadyNotified = true;
                        }
                    }
                    
                    const ratio = 1 - (this.abilityCooldown / (this.maxAbilityCooldown || ability.cooldown));
                    this.abilityCooldownFillEl.style.width = `${ratio * 100}%`;
                    this.abilityCooldownFillEl.style.background = '#888';
                } else {
                    this.abilityCooldownFillEl.style.width = '100%';
                    this.abilityCooldownFillEl.style.background = '#00ff7f';
                }
            }

            // --- Update Drone (Engineer) ---
            if (this.activeDrone) {
                const drone = this.activeDrone;
                drone.timer += deltaTime * 1000;
                
                // Orbit player
                const orbitRadius = 4;
                const orbitSpeed = 2;
                const angle = (Date.now() / 1000) * orbitSpeed;
                drone.mesh.position.x = this.player.position.x + Math.cos(angle) * orbitRadius;
                drone.mesh.position.z = this.player.position.z + Math.sin(angle) * orbitRadius;
                drone.mesh.position.y = this.player.position.y + 2.5 + Math.sin(angle * 2) * 0.5;
                
                // Shooting
                if (drone.timer - drone.lastShot > 500) {
                    const nearest = this.enemies.filter(e => e.alive && e.sprite.position.distanceTo(drone.mesh.position) < 20)[0];
                    if (nearest) {
                        drone.lastShot = drone.timer;
                        
                        // --- Class Synergy: Engineer Drone + Guardian Dome ---
                        let damage = 100;
                        let tracerColor = 0xffff00;
                        if (this.activeDome) {
                            const distDroneToDome = drone.mesh.position.distanceTo(this.activeDome.position);
                            if (distDroneToDome < 8) {
                                damage *= 2; // Double damage when near/inside dome
                                tracerColor = 0x00ffff; // Blue-ish tracer to show synergy
                            }
                        }

                        this.createTracer(drone.mesh.position, nearest.sprite.position, true, tracerColor);
                        nearest.takeDamage(damage);
                        this.synth.triggerAttackRelease('G5', '32n');
                    }
                }
                
                if (drone.timer >= drone.duration) {
                    this.scene.remove(drone.mesh);
                    this.activeDrone = null;
                }
            }

            // Update pickups
            const pickupRadiusBonus = (this.upgrades.pickup_radius || 0) * 0.5;
            for (let i = this.pickups.length - 1; i >= 0; i--) {
                const pickup = this.pickups[i];
                if (pickup.alive) {
                    pickup.bobTime += deltaTime * 3;
                    pickup.sprite.position.y = 1.0 + Math.sin(pickup.bobTime) * 0.2;
                    pickup.sprite.rotation.y += deltaTime * 2;
                    
                    const dist = this.player.position.distanceTo(pickup.sprite.position);
                    
                    // Magnetic Field Upgrade
                    if (dist < (3.0 + pickupRadiusBonus * 10)) {
                        const pullDir = this.player.position.clone().sub(pickup.sprite.position).normalize();
                        pickup.sprite.position.add(pullDir.multiplyScalar(deltaTime * 10));
                    }

                    // Check collection
                    if (dist < 2.5) {
                        this.collectPickup(pickup);
                        this.pickups.splice(i, 1);
                    }
                } else {
                    this.pickups.splice(i, 1);
                }
            }

            // Check core collections
            this.world.objectives.forEach(obj => {
                if (obj.type === 'core' && obj.alive) {
                    const dist = this.player.position.distanceTo(obj.sprite.position);
                    if (dist < 3) {
                        obj.alive = false;
                        this.scene.remove(obj.sprite);
                        this.onEnemyKilled(obj.sprite.position.clone()); // Trigger level check with position
                    }
                }
            });

            // Update enemies
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const enemy = this.enemies[i];
                if (enemy.alive) {
                    enemy.update(deltaTime);
                    // Update boss health bar if this is a boss
                    if (enemy.isBoss) {
                        const maxHealth = enemy.isFinalBoss ? CONFIG.FINAL_BOSS.HEALTH : CONFIG.BOSS.HEALTH;
                        const healthPercent = (enemy.health / maxHealth) * 100;
                        this.bossHealthBar.style.width = `${Math.max(0, healthPercent)}%`;
                    }
                } else {
                    this.enemies.splice(i, 1);
                }
            }

            // Spawn management
            this.lastSpawnTime += deltaTime * 1000;
            if (this.lastSpawnTime > CONFIG.ENEMY.SPAWN_RATE && this.enemies.length < 20) {
                this.spawnEnemy();
                this.lastSpawnTime = 0;
            }
        }

        this.composer.render();
    }
}

new Game();
