import * as THREE from 'three';
import * as Tone from 'tone';
import { CONFIG } from './config.js';
import { Player } from './Player.js';
import { TrackManager } from './TrackManager.js';
import { InputHandler } from './InputHandler.js';

export class GameScene {
    constructor() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        // Clearer view: Pushed fog start and end even further back to see the city background
        this.scene.fog = new THREE.Fog(0x220022, 100, 400);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.input = new InputHandler();
        this.player = new Player(this.scene);
        this.trackManager = new TrackManager(this.scene);

        this.score = 0;
        this.coins = 0;
        this.keys = 0;
        this.jumps = 0;
        this.slides = 0;
        
        // Persistence
        this.totalCoins = parseInt(localStorage.getItem('totalCoins') || '0');
        this.highScores = JSON.parse(localStorage.getItem('highScores') || '[]');
        this.unlockedSkins = JSON.parse(localStorage.getItem('unlockedSkins') || '["default"]');
        this.unlockedBoards = JSON.parse(localStorage.getItem('unlockedBoards') || '["default"]');
        this.selectedSkin = localStorage.getItem('selectedSkin') || 'default';
        this.selectedBoard = localStorage.getItem('selectedBoard') || 'default';
        this.upgrades = JSON.parse(localStorage.getItem('upgrades') || '{}');
        this.missionData = JSON.parse(localStorage.getItem('missionData') || '{}');

        // Combo & Scoring
        this.comboCount = 0;
        this.comboTimer = 0;
        this.floatingTexts = [];

        this.moveSpeed = CONFIG.INITIAL_MOVE_SPEED;
        this.isGameOver = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.shakeTimer = 0;

        // Collision Optimization: Pre-allocate Box3 objects
        this._playerBox = new THREE.Box3();
        this._obsBox = new THREE.Box3();
        this._itemBox = new THREE.Box3();

        this.currentWorldKey = 'NEON';
        this.currentShopTab = 'characters';

        this._applySkin();
        this._applyBoardSkin();
        this._setupLights();
        this._setupSkybox();
        this._setupUI();
        this._setupAudio();
        this._checkDailyBonus();
        this._initMissions();

        window.addEventListener('resize', () => this.onResize());
        
        this.lastTime = 0;
        requestAnimationFrame((t) => this.loop(t));
    }

    _applySkin() {
        const skin = Object.values(CONFIG.SKINS).find(s => s.id === this.selectedSkin) || CONFIG.SKINS.DEFAULT;
        this.player.setSkin(skin);
    }

    _applyBoardSkin() {
        const board = Object.values(CONFIG.BOARDS).find(b => b.id === this.selectedBoard) || CONFIG.BOARDS.DEFAULT;
        this.player.setBoardSkin(board);
    }

    _initMissions() {
        const today = new Date().toDateString();
        if (this.missionData.date !== today) {
            this.missionData = {
                date: today,
                progress: CONFIG.MISSIONS.reduce((acc, m) => {
                    acc[m.id] = { current: 0, completed: false };
                    return acc;
                }, {})
            };
            this._saveMissions();
        }
        this._updateMissionsUI();
    }

    _saveMissions() {
        localStorage.setItem('missionData', JSON.stringify(this.missionData));
    }

    _updateMissionsUI() {
        const renderMissions = (containerId) => {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            // For the end-of-run summary, keep the simple list
            if (containerId === 'end-missions') {
                container.innerHTML = '<h3 style="margin-top:0">MISSION PROGRESS</h3>';
                CONFIG.MISSIONS.forEach(m => {
                    const prog = this.missionData.progress[m.id];
                    const item = document.createElement('div');
                    item.className = 'mission-item';
                    const percent = Math.min(100, (prog.current / m.target) * 100);
                    item.innerHTML = `
                        <div style="display:flex; justify-content:space-between">
                            <span>${m.text}</span>
                            <span style="color:${prog.completed ? '#00ff00' : '#fff'}">${prog.completed ? 'DONE' : `${Math.floor(prog.current)}/${m.target}`}</span>
                        </div>
                        <div class="mission-progress">
                            <div class="mission-fill" style="width: ${percent}%"></div>
                        </div>
                    `;
                    container.appendChild(item);
                });
                return;
            }

            // For the main menu, use the sci-fi cards
            container.innerHTML = '';
            const missionIcons = { 
                coins: CONFIG.ASSETS.ICONS.COIN, 
                jumps: CONFIG.ASSETS.ICONS.SNEAKERS, 
                distance: CONFIG.ASSETS.PLAYER_FRONT_TEXTURE, 
                slides: CONFIG.ASSETS.ICONS.HOVERBOARD 
            };
            
            CONFIG.MISSIONS.forEach(m => {
                const prog = this.missionData.progress[m.id];
                const card = document.createElement('div');
                card.className = `mission-card ${prog.completed ? 'completed' : ''}`;
                const percent = Math.min(100, (prog.current / m.target) * 100);
                
                card.innerHTML = `
                    <div class="mission-icon-box"><img src="${missionIcons[m.type] || ''}" style="width:100%; height:100%; object-fit:contain;"></div>
                    <div class="mission-desc">${m.text}</div>
                    <div class="mission-reward-tag">REWARD: <img src="${CONFIG.ASSETS.ICONS.COIN}" style="width:14px; vertical-align:middle;"> ${m.reward}</div>
                    <div class="mission-card-progress">
                        <div class="mission-card-fill" style="width: ${percent}%"></div>
                    </div>
                    <div class="mission-status-text">${prog.completed ? 'COMPLETED' : `${Math.floor(prog.current)} / ${m.target}`}</div>
                    <div class="mission-check">✔</div>
                `;
                container.appendChild(card);
            });
        };

        renderMissions('main-missions');
        renderMissions('end-missions');
    }

    _trackMission(type, amount = 1) {
        let changed = false;
        CONFIG.MISSIONS.forEach(m => {
            if (m.type === type) {
                const prog = this.missionData.progress[m.id];
                if (!prog.completed) {
                    prog.current += amount;
                    if (prog.current >= m.target) {
                        prog.completed = true;
                        prog.current = m.target;
                        this.totalCoins += m.reward;
                        localStorage.setItem('totalCoins', this.totalCoins.toString());
                        this.missionSfx.triggerAttackRelease(['C5', 'E5', 'G5'], '4n');
                        this._showNotification(`MISSION COMPLETE: +${m.reward} COINS!`);
                    }
                    changed = true;
                }
            }
        });
        if (changed) {
            this._saveMissions();
            this._updateMissionsUI();
            this._updateHUD();
        }
    }

    _setupUI() {
        this.ui = {
            introScreen: document.getElementById('intro-screen'),
            tapToEnter: document.getElementById('tap-to-enter'),
            mainMenu: document.getElementById('main-menu'),
            shopMenu: document.getElementById('shop-menu'),
            missionsMenu: document.getElementById('missions-menu'),
            settingsMenu: document.getElementById('settings-menu'),
            hud: document.getElementById('hud-ui'),
            gameOver: document.getElementById('game-over'),
            scoreVal: document.getElementById('score-val'),
            coinsVal: document.getElementById('coins-val'),
            multiplierVal: document.querySelector('.hud-multiplier'),
            hudMissionDesc: document.getElementById('hud-mission-desc'),
            hudMissionReward: document.getElementById('hud-mission-reward'),
            hudMissionFill: document.getElementById('hud-mission-fill'),
            zoneName: document.getElementById('zone-name'),
            zoneFill: document.getElementById('zone-bar-fill'),
            pauseBtn: document.getElementById('pause-btn'),
            finalScore: document.getElementById('final-score'),
            finalCoins: document.getElementById('final-coins'),
            finalDistance: document.getElementById('final-distance'),
            openUpgradesBtn: document.getElementById('open-upgrades-btn'),
            bestScore: document.getElementById('best-score'),
            topScore: document.getElementById('top-score'),
            timersContainer: document.getElementById('timers-container'),
            startBtn: document.getElementById('start-btn'),
            restartBtn: document.getElementById('restart-btn'),
            openShopBtn: document.getElementById('open-shop-btn'),
            closeShopBtn: document.getElementById('shop-back-btn'), // Changed
            openMissionsBtn: document.getElementById('open-missions-btn'),
            closeMissionsBtn: document.getElementById('close-missions-btn'),
            openSettingsBtn: document.getElementById('open-settings-btn'),
            closeSettingsBtn: document.getElementById('close-settings-btn'),
            prevSkin: document.getElementById('prev-skin'),
            nextSkin: document.getElementById('next-skin'),
            bankVal: document.getElementById('bank-val'),
            shopBankVal: document.getElementById('shop-bank-val'),
            upgradesGrid: document.getElementById('shop-upgrades-grid'), // Changed
            carouselContainer: document.getElementById('shop-carousel'), // New
            shopItemName: document.getElementById('shop-item-name'), // New
            shopItemPrice: document.getElementById('shop-item-price'), // New
            shopActionBtn: document.getElementById('shop-action-btn'), // New
            shopPrev: document.getElementById('shop-prev'), // New
            shopNext: document.getElementById('shop-next'), 
            skinNameLabel: document.getElementById('skin-name-label'), // New
            navUpgradesBtn: document.getElementById('nav-upgrades-btn'), 
            navBoardsBtn: document.getElementById('nav-boards-btn'), 
            goHomeBtn: document.getElementById('go-home-btn'),
            audioSlider: document.getElementById('audio-slider'),
            vibrateToggle: document.getElementById('vibrate-toggle'),
            backToHubBtn: document.getElementById('back-to-hub-btn'),
            backToHubOverBtn: document.getElementById('back-to-hub-over-btn')
        };

        this.ui.startBtn.onclick = async () => {
            await Tone.start();
            this.startGame();
        };

        this.ui.restartBtn.onclick = () => this.startGame();
        this.ui.openShopBtn.onclick = () => this._showMenu('shopMenu');
        this.ui.closeShopBtn.onclick = () => this._showMenu('mainMenu');
        this.ui.openMissionsBtn.onclick = () => this._showMenu('missionsMenu');
        this.ui.closeMissionsBtn.onclick = () => this._showMenu('mainMenu');
        this.ui.openSettingsBtn.onclick = () => this._showMenu('settingsMenu');
        this.ui.closeSettingsBtn.onclick = () => this._showMenu('mainMenu');
        
        this.ui.tapToEnter.onclick = async () => {
            await Tone.start();
            this._showMenu('mainMenu');
            // Play a start sound
            this.powerUpSfx.triggerAttackRelease('C4', '4n');
        };
        
        this.ui.pauseBtn.onclick = () => this.togglePause();

        // Arrow logic temporarily disabled to revert to previous stable state
        this.ui.prevSkin.onclick = () => {};
        this.ui.nextSkin.onclick = () => {};
        
        // Shop Carousel Listeners
        this.ui.shopPrev.onclick = () => this._cycleShopItem(-1);
        this.ui.shopNext.onclick = () => this._cycleShopItem(1);

        this.ui.openUpgradesBtn.onclick = () => {
            this.currentShopTab = 'upgrades';
            this._showMenu('shopMenu');
        };

        this.ui.navUpgradesBtn.onclick = () => {
            this.currentShopTab = 'upgrades';
            this._showMenu('shopMenu');
        };

        this.ui.navBoardsBtn.onclick = () => {
            this.currentShopTab = 'boards';
            this._showMenu('shopMenu');
        };

        this.ui.goHomeBtn.onclick = () => {
            this.ui.gameOver.style.display = 'none';
            this._showMenu('mainMenu');
        };
		if (this.ui.backToHubBtn) {
            this.ui.backToHubBtn.onclick = () => {
                window.location.href = '/index.html';
            };
        }
		
        if (this.ui.backToHubOverBtn) {
            this.ui.backToHubOverBtn.onclick = () => {
                window.location.href = '/index.html';
            };
        }
        if (this.ui.audioSlider) {
            this.ui.audioSlider.oninput = (e) => {
                Tone.Destination.volume.value = Tone.gainToDb(parseFloat(e.target.value));
            };
        }

        if (this.ui.vibrateToggle) {
            this.ui.vibrateToggle.onchange = (e) => {
                this.vibrationEnabled = e.target.checked;
            };
        }
        this.vibrationEnabled = true;

        this.shopCarouselIndex = 0; // New

        // Tab switching
        document.querySelectorAll('.footer-tab-btn').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.footer-tab-btn').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentShopTab = tab.dataset.tab;
                this.shopCarouselIndex = 0;
                this._renderShopItems();
            };
        });

        this._updateMenuCamera();
    }

    togglePause() {
        if (!this.isPlaying) return;
        this.isPaused = !this.isPaused;
        this.ui.pauseBtn.innerText = this.isPaused ? '▶' : '⏸';
        if (this.isPaused) {
            Tone.Transport.pause();
        } else {
            Tone.Transport.start();
        }
    }

    _cycleSkin(dir) {
        const skins = Object.keys(CONFIG.SKINS);
        let idx = skins.indexOf(this.selectedSkin.toUpperCase());
        if (idx === -1) idx = 0;
        
        idx = (idx + dir + skins.length) % skins.length;
        const nextSkinId = skins[idx].toLowerCase();
        const skinData = CONFIG.SKINS[skins[idx]];
        
        this.selectedSkin = nextSkinId;
        localStorage.setItem('selectedSkin', this.selectedSkin);
        this._applySkin();
        
        if (this.ui.skinNameLabel) {
            this.ui.skinNameLabel.innerText = skinData.name;
        }
        
        this.purchaseSfx.triggerAttackRelease('E4', '16n');
    }

    _showMenu(menuKey) {
        // Scene Visibility: Pure "Static Image" Mode for Main Menu and Game Over
        const isStaticImageMode = menuKey === 'mainMenu' || menuKey === 'gameOver';
        const isHUD = menuKey === 'hud';

        // Set player visibility
        if (this.player && this.player.mesh) {
            this.player.mesh.visible = !isStaticImageMode;
        }

        if (isStaticImageMode) {
            // HIDE EVERYTHING 3D: Only the HTML Image will show
            this.scene.background = new THREE.Color(0x000000);
            if (this.skyboxMesh) this.skyboxMesh.visible = false;
            if (this.cityFloor) this.cityFloor.visible = false;
            if (this.stars) this.stars.visible = false;
            this.trackManager.segments.forEach(s => s.visible = false);
            this.trackManager.obstacles.forEach(o => o.mesh.visible = false);
            this.trackManager.items.forEach(i => i.mesh.visible = false);
        } else if (isHUD) {
            // GAMEPLAY MODE: Show everything
            const worldData = CONFIG.WORLDS[this.currentWorldKey];
            this.scene.background = new THREE.Color(worldData.fogColor);
            if (this.skyboxMesh) this.skyboxMesh.visible = true;
            if (this.cityFloor) this.cityFloor.visible = true;
            if (this.stars) this.stars.visible = true;
            this.trackManager.segments.forEach(s => s.visible = true);
            this.trackManager.obstacles.forEach(o => o.mesh.visible = true);
            this.trackManager.items.forEach(i => i.mesh.visible = true);
        } else {
            // Other Menus (Shop, Settings, Missions): Standard Studio Mode
            this.scene.background = new THREE.Color(0x000000);
            if (this.skyboxMesh) this.skyboxMesh.visible = false;
            if (this.cityFloor) this.cityFloor.visible = false;
            this.trackManager.segments.forEach(s => s.visible = false);
            // Player stays visible for Shop/Skins
            if (this.player && this.player.mesh) {
                this.player.mesh.visible = true;
            }
        }

        // Hide all menu elements
        const menus = ['introScreen', 'mainMenu', 'shopMenu', 'missionsMenu', 'settingsMenu', 'gameOver', 'hud'];
        menus.forEach(key => {
            if (this.ui[key]) {
                if (key === 'introScreen') {
                    this.ui[key].classList.add('hidden');
                } else {
                    this.ui[key].style.display = 'none';
                }
            }
        });

        if (this.ui[menuKey]) {
            if (menuKey === 'introScreen') {
                this.ui[menuKey].classList.remove('hidden');
            } else if (menuKey === 'hud') {
                this.ui[menuKey].style.display = 'block';
            } else {
                this.ui[menuKey].style.display = 'flex';
            }
        }
        
        if (menuKey === 'mainMenu' || menuKey === 'shopMenu' || menuKey === 'gameOver') {
            this._updateHUD();
            this._updateMenuCamera();
        }
        
        if (menuKey === 'shopMenu') {
            this._renderShopItems();
        }
    }

    _updateMenuCamera() {
        if (!this.isPlaying) {
            // Position camera relative to player's current Z so we can see them in menus or Game Over
            const playerZ = this.player.mesh.position.z;
            this.camera.position.set(2.5, 3, playerZ + 6); // Slightly higher and further for menu
            this.camera.lookAt(0, 1.2, playerZ);
            this.player.mesh.rotation.y = Math.PI; // Face camera
        }
    }

    _cycleShopItem(dir) {
        const items = this.currentShopTab === 'characters' ? Object.values(CONFIG.SKINS) : Object.values(CONFIG.BOARDS);
        this.shopCarouselIndex = (this.shopCarouselIndex + dir + items.length) % items.length;
        
        const currentItem = items[this.shopCarouselIndex];
        if (this.currentShopTab === 'characters') {
            this.selectedSkin = currentItem.id;
            this._applySkin();
        } else {
            this.selectedBoard = currentItem.id;
            this._applyBoardSkin();
        }
        
        this._renderShopItems();
        this.purchaseSfx.triggerAttackRelease('E4', '16n');
    }

    _renderShopItems() {
        this.ui.shopBankVal.innerText = this.totalCoins;
        
        if (this.currentShopTab === 'upgrades') {
            this.ui.carouselContainer.style.display = 'none';
            this.ui.upgradesGrid.style.display = 'flex';
            this._renderUpgrades();
            return;
        }

        this.ui.carouselContainer.style.display = 'flex';
        this.ui.upgradesGrid.style.display = 'none';

        const items = this.currentShopTab === 'characters' ? Object.values(CONFIG.SKINS) : Object.values(CONFIG.BOARDS);
        const unlocked = this.currentShopTab === 'characters' ? this.unlockedSkins : this.unlockedBoards;
        const equippedId = this.currentShopTab === 'characters' ? 
            (localStorage.getItem('selectedSkin') || 'default') : 
            (localStorage.getItem('selectedBoard') || 'default');

        const item = items[this.shopCarouselIndex];
        const isUnlocked = unlocked.includes(item.id);
        const isEquipped = equippedId === item.id;

        this.ui.shopItemName.innerText = item.name;
        this.ui.shopItemPrice.innerText = isUnlocked ? '' : `🪙 ${item.cost}`;
        
        this.ui.shopActionBtn.className = 'shop-action-btn';
        if (!isUnlocked) {
            this.ui.shopActionBtn.innerText = 'Unlock';
            this.ui.shopActionBtn.classList.add('unlock');
        } else if (isEquipped) {
            this.ui.shopActionBtn.innerText = 'Equipped';
            this.ui.shopActionBtn.classList.add('equipped');
        } else {
            this.ui.shopActionBtn.innerText = 'Equip';
            this.ui.shopActionBtn.classList.add('equip');
        }

        this.ui.shopActionBtn.onclick = () => {
            if (!isUnlocked) {
                if (this.totalCoins >= item.cost) {
                    this.totalCoins -= item.cost;
                    localStorage.setItem('totalCoins', this.totalCoins.toString());
                    unlocked.push(item.id);
                    const key = this.currentShopTab === 'characters' ? 'unlockedSkins' : 'unlockedBoards';
                    localStorage.setItem(key, JSON.stringify(unlocked));
                    
                    this.purchaseSfx.triggerAttackRelease('G4', '8n');
                    this._renderShopItems();
                    this._showNotification(`UNLOCKED: ${item.name}!`);
                } else {
                    this._showNotification('NOT ENOUGH COINS!');
                }
            } else if (!isEquipped) {
                const key = this.currentShopTab === 'characters' ? 'selectedSkin' : 'selectedBoard';
                localStorage.setItem(key, item.id);
                this.purchaseSfx.triggerAttackRelease('C4', '8n');
                this._renderShopItems();
            }
        };
    }

    _renderUpgrades() {
        this.ui.upgradesGrid.innerHTML = '';
        Object.values(CONFIG.UPGRADES).forEach(upgrade => {
            const level = this.upgrades[upgrade.id] || 0;
            const isMax = level >= upgrade.maxLevel;
            const cost = upgrade.baseCost + (level * upgrade.increment);
            
            const div = document.createElement('div');
            div.className = 'upgrade-row';
            div.innerHTML = `
                <div class="upgrade-info">
                    <div style="font-weight: bold; color: #ff00ff;">${upgrade.name}</div>
                    <div class="upgrade-lvl">Level ${level}/${upgrade.maxLevel}</div>
                </div>
                <button class="upgrade-buy-btn ${isMax ? 'maxed' : ''}">
                    ${isMax ? 'MAX' : `🪙 ${cost}`}
                </button>
            `;

            const btn = div.querySelector('button');
            btn.onclick = () => {
                if (isMax) return;
                if (this.totalCoins >= cost) {
                    this.totalCoins -= cost;
                    this.upgrades[upgrade.id] = level + 1;
                    localStorage.setItem('totalCoins', this.totalCoins.toString());
                    localStorage.setItem('upgrades', JSON.stringify(this.upgrades));
                    this.purchaseSfx.triggerAttackRelease('G4', '8n');
                    this._renderShopItems();
                    this._showNotification(`${upgrade.name} UPGRADED!`);
                } else {
                    this._showNotification('NOT ENOUGH COINS!');
                }
            };
            this.ui.upgradesGrid.appendChild(div);
        });
    }

    startGame() {
        this.isGameOver = false;
        this.isPlaying = true;
        this.isPaused = false;
        this.ui.pauseBtn.innerText = '⏸';
        this.score = 0;
        this.coins = 0;
        this.keys = 0;
        this.jumps = 0;
        this.slides = 0;
        this.comboCount = 0;
        this.comboTimer = 0;
        this.moveSpeed = CONFIG.INITIAL_MOVE_SPEED;
        this.player.reset();
        this.trackManager.reset();
        
        this._showMenu('hud');
        this.ui.hud.style.display = 'block'; // Ensure block for HUD
        
        this.input.reset();

        Tone.Transport.start();
        this.loopSeq.start(0);
    }

    gameOver() {
        if (this.isGameOver) return;
        
        if (this.player.activePowerUps.shield > 0 || this.player.activePowerUps.hoverboard > 0) {
            this.player.activePowerUps.shield = 0;
            this.player.activePowerUps.hoverboard = 0;
            this.hitSfx.triggerAttackRelease('G2', '8n');
            this.shakeTimer = 0.3; // Trigger shake
            return;
        }

        this.isGameOver = true;
        this.isPlaying = false;
        this.player.isDead = true;
        this.comboCount = 0;
        this.comboTimer = 0;
        
        const finalScoreVal = Math.floor(this.score + (this.coins * 10));
        this.totalCoins += this.coins;
        localStorage.setItem('totalCoins', this.totalCoins.toString());

        this.highScores.push(finalScoreVal);
        this.highScores.sort((a, b) => b - a);
        this.highScores = this.highScores.slice(0, 5);
        localStorage.setItem('highScores', JSON.stringify(this.highScores));

        this.ui.finalScore.innerText = finalScoreVal;
        this.ui.finalCoins.innerText = this.coins;
        this.ui.finalDistance.innerText = Math.floor(this.score);
        
        if (this.ui.bestScore) this.ui.bestScore.innerText = Math.floor(this.highScores[0] || 0);
        
        this._showMenu('gameOver');
        
        this.hitSfx.triggerAttackRelease('C1', '4n');
        
        if (this.vibrationEnabled && window.navigator.vibrate) {
            window.navigator.vibrate([100, 50, 200]);
        }

        this.loopSeq.stop();
        Tone.Transport.stop();
        this._updateMissionsUI();
        this._updateMenuCamera();
    }

    _updateHUD() {
        this.ui.bankVal.innerText = this.totalCoins;
        if (this.ui.topScore) this.ui.topScore.innerText = Math.floor(this.highScores[0] || 0);
        
        if (!this.ui.hud) return;
        
        const totalCurrentScore = Math.floor(this.score);
        this.ui.scoreVal.innerText = totalCurrentScore;
        this.ui.coinsVal.innerText = this.coins;
        
        const comboMult = this._getComboMultiplier();
        const basePowerUpMult = this.player.activePowerUps.multiplier > 0 ? 2 : 1;
        const finalMult = comboMult * basePowerUpMult;
        
        const comboDisplay = document.getElementById('hud-combo');
        if (comboDisplay) {
            comboDisplay.innerText = `x${finalMult}`;
            comboDisplay.style.background = finalMult > 1 ? '#ff00ff' : 'rgba(0,0,0,0.5)';
            comboDisplay.style.boxShadow = finalMult > 1 ? '0 0 10px #ff00ff' : 'none';
        }

        // Update Side Timers
        this.ui.timersContainer.innerHTML = '';
        const powerupIcons = { 
            magnet: CONFIG.ASSETS.ICONS.MAGNET, 
            shield: CONFIG.ASSETS.ICONS.SHIELD, 
            multiplier: CONFIG.ASSETS.ICONS.COIN, 
            hoverboard: CONFIG.ASSETS.ICONS.HOVERBOARD, 
            boost: CONFIG.ASSETS.ICONS.JETPACK, 
            jetpack: CONFIG.ASSETS.ICONS.JETPACK, 
            super_jump: CONFIG.ASSETS.ICONS.SNEAKERS 
        };
        
        for (let type in this.player.activePowerUps) {
            const time = this.player.activePowerUps[type];
            if (time > 0) {
                const upgradeLevel = this.upgrades[type] || 0;
                const bonusMult = 1 + (upgradeLevel * 0.2);
                const maxTime = (CONFIG.DURATIONS[type.toUpperCase()] || 10) * bonusMult;
                
                const timerWrap = document.createElement('div');
                timerWrap.className = 'powerup-mini-timer';
                timerWrap.innerHTML = `
                    <div class="powerup-icon-circle" style="background: #${CONFIG.COLORS[type.toUpperCase()].toString(16).padStart(6, '0')}">
                        <img src="${powerupIcons[type] || ''}" style="width:70%; height:70%; object-fit:contain;">
                    </div>
                    <div class="timer-bar-mini">
                        <div class="timer-fill-mini" style="width: ${(time/maxTime)*100}%; background: #${CONFIG.COLORS[type.toUpperCase()].toString(16).padStart(6, '0')}"></div>
                    </div>
                `;
                this.ui.timersContainer.appendChild(timerWrap);
            }
        }

        // Update Bottom Mission
        const nextMission = CONFIG.MISSIONS.find(m => !this.missionData.progress[m.id].completed);
        if (nextMission) {
            const prog = this.missionData.progress[nextMission.id];
            this.ui.hudMissionDesc.innerText = nextMission.text;
            this.ui.hudMissionReward.innerText = `🎁 ${nextMission.reward}`;
            const percent = Math.min(100, (prog.current / nextMission.target) * 100);
            this.ui.hudMissionFill.style.width = `${percent}%`;
        } else {
            this.ui.hudMissionDesc.innerText = 'ALL MISSIONS DONE!';
            this.ui.hudMissionReward.innerText = '🎉';
            this.ui.hudMissionFill.style.width = '100%';
        }
    }

    _spawnCollectionParticles(pos, color) {
        // Reuse the pre-loaded texture from TrackManager
        const pTex = this.trackManager.particleTexture;
        const count = 15; // Increased count for "juiciness"
        for (let i = 0; i < count; i++) {
            const size = 0.3 + Math.random() * 0.4;
            const pGeom = new THREE.PlaneGeometry(size, size);
            const pMat = new THREE.MeshBasicMaterial({ 
                map: pTex,
                color: color, 
                transparent: true, 
                opacity: 1,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending // Glow effect
            });
            const p = new THREE.Mesh(pGeom, pMat);
            p.position.copy(pos);
            
            // Explosive velocity
            const angle = Math.random() * Math.PI * 2;
            const strength = 5 + Math.random() * 8;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * strength * 0.5,
                strength,
                (Math.random() - 0.5) * 5
            );
            
            this.scene.add(p);
            this.player.particles.push({ mesh: p, life: 1.0, velocity });
        }
    }

    checkCollisions() {
        this._playerBox.copy(this.player.getBounds());
        
        for (let obs of this.trackManager.obstacles) {
            // Optimization: Account for long trains (up to 45m for 3 cars)
            const dist = Math.abs(obs.mesh.position.z - this.player.mesh.position.z);
            if (dist > 50) continue; 

            this._obsBox.setFromObject(obs.mesh);
            if (this._playerBox.intersectsBox(this._obsBox)) {
                // Special case for side-collisions with trains or large blocks
                if (obs.type === 'train' || obs.type === 'cube') {
                    const obsBounds = this._obsBox;
                    const playerZ = this.player.mesh.position.z;
                    const playerX = this.player.mesh.position.x;
                    const obsX = obs.mesh.position.x;
                    
                    // Determine which lane the obstacle is in
                    const obsLane = CONFIG.LANES.findIndex(lx => Math.abs(lx - obsX) < 0.5);
                    const isInSameLane = this.player.currentLane === obsLane;
                    
                    // A collision is ONLY a side-swipe if the player is NOT in the same lane as the obstacle.
                    // If they are in the same lane, any frontal intersection is fatal.
                    if (!isInSameLane) {
                        // Non-fatal Side Bump: Safe lane correction
                        this.player.currentLane = this.player.previousLane; 
                        this.player.targetX = CONFIG.LANES[this.player.currentLane];
                        
                        // Audio/Visual feedback
                        this.hitSfx.triggerAttackRelease('C2', '16n'); 
                        this.shakeTimer = 0.2;
                        
                        // Decisively push the player's X mesh out of the collision to prevent "sticking"
                        const pushDir = playerX > obsX ? 1.5 : -1.5;
                        this.player.mesh.position.x += pushDir;
                        
                        continue; // handled as side-swipe, bypass gameOver()
                    }
                }

                if (obs.type === 'low_bar' && this.player.isSliding) continue;
                this.gameOver();
                return;
            }
        }

        for (let i = this.trackManager.items.length - 1; i >= 0; i--) {
            const item = this.trackManager.items[i];
            
            // Skip far items UNLESS they are being pulled by the magnet
            const dz = Math.abs(item.mesh.position.z - this.player.mesh.position.z);
            if (!item.isBeingPulled && dz > 10) continue;

            // Immediate collection if extremely close (prevents chasing)
            const dist = item.mesh.position.distanceTo(this.player.mesh.position);
            if (dist < 1.5) {
                this._collectItem(item, i);
                continue;
            }

            this._itemBox.setFromObject(item.mesh);
            if (this._playerBox.intersectsBox(this._itemBox)) {
                this._collectItem(item, i);
            }
        }
    }

    _getComboMultiplier() {
        let mult = 1;
        CONFIG.COMBO_THRESHOLDS.forEach((t, i) => {
            if (this.comboCount >= t) mult = i + 2;
        });
        return mult;
    }

    _showFloatingText(pos, text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 80px Orbitron';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(text, 128, 80);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.copy(pos);
        sprite.position.y += 2;
        sprite.scale.set(3, 1.5, 1);
        
        this.scene.add(sprite);
        this.floatingTexts.push({ sprite, life: 1.0, velocity: new THREE.Vector3(0, 2, 0) });
    }

    _collectItem(item, index) {
        const comboMult = this._getComboMultiplier();
        const basePowerUpMult = this.player.activePowerUps.multiplier > 0 ? 2 : 1;
        const finalMult = comboMult * basePowerUpMult;

        if (item.type === 'coin') {
            const amount = 1;
            this.coins += amount;
            this.score += 50 * finalMult; // Direct score bonus from coins
            this.comboCount++;
            this.comboTimer = CONFIG.COMBO_DURATION;
            
            this._trackMission('coins', amount);
            this.coinSfx.triggerAttackRelease('C5', '16n');
            this._spawnCollectionParticles(item.mesh.position, CONFIG.COLORS.COIN);
            
            this._showFloatingText(item.mesh.position, `+${finalMult}x`, '#ffff00');
        } else if (item.type === 'key') {
            this.keys++;
            this.coinSfx.triggerAttackRelease('E5', '16n');
            this._spawnCollectionParticles(item.mesh.position, CONFIG.COLORS.KEY);
            this._showFloatingText(item.mesh.position, 'KEY!', '#ff00ff');
        } else {
            const upgradeLevel = this.upgrades[item.type] || 0;
            const bonusMult = 1 + (upgradeLevel * 0.2); 
            const baseDuration = CONFIG.DURATIONS[item.type.toUpperCase()] || 10;
            this.player.activatePowerUp(item.type, baseDuration * bonusMult);
            
            this.powerUpSfx.triggerAttackRelease('G4', '8n');
            this._spawnCollectionParticles(item.mesh.position, CONFIG.COLORS[item.type.toUpperCase()]);
            this._showFloatingText(item.mesh.position, item.type.toUpperCase(), '#00ffff');
        }
        this.scene.remove(item.mesh);
        this.trackManager.items.splice(index, 1);
    }

    loop(time) {
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        if (this.isPlaying && !this.isGameOver && !this.isPaused) {
            const currentMoveSpeed = this.player.activePowerUps.boost > 0 ? this.moveSpeed * 2 : this.moveSpeed;
            // Move along the +Z axis (Forward)
            this.player.mesh.position.z += currentMoveSpeed * dt;
            
            // Camera follows from behind with a slightly elevated "bird's eye" perspective
            this.camera.position.set(
                this.player.mesh.position.x * 0.5, 
                this.player.mesh.position.y + 5, // Increased height for better view
                this.player.mesh.position.z - 11 // Pulled back slightly to maintain framing
            );
            this.camera.lookAt(
                this.player.mesh.position.x, 
                this.player.mesh.position.y + 1, 
                this.player.mesh.position.z + 8
            );

            const prevIsGrounded = this.player.isGrounded;
            const prevIsSliding = this.player.isSliding;
            
            this.player.update(dt, this.input, this.camera, this.isPlaying);
            
            if (prevIsGrounded && !this.player.isGrounded) {
                this.jumpSfx.triggerAttackRelease('C2', '8n');
                this._trackMission('jumps', 1);
            }
            if (!prevIsSliding && this.player.isSliding) {
                this.slideSfx.triggerAttackRelease('8n');
                this._trackMission('slides', 1);
            }

            this.trackManager.update(this.player.mesh.position, this.moveSpeed, dt, this.player.activePowerUps.magnet > 0, this.camera);
            this._updateSpeedLines(dt);

            this.moveSpeed = Math.min(this.moveSpeed + CONFIG.SPEED_INCREMENT * dt, CONFIG.MAX_SPEED);
            this.score += currentMoveSpeed * dt;
            
            // Update Combo
            if (this.comboTimer > 0) {
                this.comboTimer -= dt;
                if (this.comboTimer <= 0) {
                    this.comboCount = 0;
                }
            }

            // Update Floating Texts
            for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
                const ft = this.floatingTexts[i];
                ft.life -= dt;
                ft.sprite.position.addScaledVector(ft.velocity, dt);
                ft.sprite.material.opacity = ft.life;
                if (ft.life <= 0) {
                    this.scene.remove(ft.sprite);
                    ft.sprite.material.map.dispose();
                    ft.sprite.material.dispose();
                    this.floatingTexts.splice(i, 1);
                }
            }

            // World Transition Logic
            const zoneDistance = 1000;
            const currentZoneIdx = Math.floor(this.score / zoneDistance);
            const worlds = Object.keys(CONFIG.WORLDS);
            const nextWorldKey = worlds[currentZoneIdx % worlds.length];
            
            if (this.currentWorldKey !== nextWorldKey) {
                this.currentWorldKey = nextWorldKey;
                const worldData = CONFIG.WORLDS[this.currentWorldKey];
                this.trackManager.setWorld(this.currentWorldKey);
                this.scene.fog.color.setHex(worldData.fogColor);
                // Removed background override to keep the city skyline
                this.ui.zoneName.innerText = worldData.name;
                this.ui.zoneName.style.color = `#${worldData.pillarColor.toString(16).padStart(6, '0')}`;
                this.ui.zoneFill.style.background = `#${worldData.pillarColor.toString(16).padStart(6, '0')}`;
                this._showNotification(`ENTERING ${worldData.name}`);
            }

            const zoneProgress = (this.score % zoneDistance) / zoneDistance;
            this.ui.zoneFill.style.width = `${zoneProgress * 100}%`;

            this._trackMission('distance', currentMoveSpeed * dt);

            this._updateHUD();
            if (this.stars) this.stars.position.copy(this.player.mesh.position);
            if (this.skyboxMesh) {
                this.skyboxMesh.position.x = this.player.mesh.position.x;
                this.skyboxMesh.position.z = this.player.mesh.position.z;
                // Keep Y fixed at 450
            }
            if (this.cityFloor) {
                this.cityFloor.position.x = this.player.mesh.position.x;
                this.cityFloor.position.z = this.player.mesh.position.z;
            }
            this.checkCollisions();
        } else if (!this.isPlaying && !this.isPaused) {
            // Update player idle/animations in menus
            this.player.update(dt, this.input, this.camera, this.isPlaying);
            this._updateMenuCamera(); // Keep hero view active while in menus
        }

        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame((t) => this.loop(t));
    }

    _setupLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xff00ff, 1);
        sun.position.set(5, 10, 5);
        this.scene.add(sun);

        this.speedLines = new THREE.Group();
        this.scene.add(this.speedLines);
        this._createSpeedLines();
    }

    _createSpeedLines() {
        const lineGeom = new THREE.BoxGeometry(0.02, 0.02, 4);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
        for (let i = 0; i < 40; i++) {
            const line = new THREE.Mesh(lineGeom, lineMat);
            line.position.set((Math.random() - 0.5) * 20, Math.random() * 10, -Math.random() * 50);
            this.speedLines.add(line);
        }
    }

    _updateSpeedLines(dt) {
        if (!this.speedLines) return;
        const speedFactor = (this.moveSpeed - CONFIG.INITIAL_MOVE_SPEED) / (CONFIG.MAX_SPEED - CONFIG.INITIAL_MOVE_SPEED);
        const boostFactor = this.player.activePowerUps.boost > 0 ? 1.5 : 1.0;
        
        this.speedLines.visible = speedFactor > 0.2 || boostFactor > 1.0;
        this.speedLines.position.z = this.player.mesh.position.z - 20;

        this.speedLines.children.forEach(line => {
            line.position.z += this.moveSpeed * 2 * boostFactor * dt;
            if (line.position.z > 20) {
                line.position.z = -30;
                line.position.x = (Math.random() - 0.5) * 25;
                line.position.y = Math.random() * 15;
            }
        });

        const targetFov = 75 + (speedFactor * 20) + (this.player.activePowerUps.boost > 0 ? 15 : 0);
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 5 * dt);
        this.camera.updateProjectionMatrix();

        // Screen Shake on impact (if recently hit)
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            this.camera.position.x += (Math.random() - 0.5) * 0.5;
            this.camera.position.y += (Math.random() - 0.5) * 0.5;
        }
    }

    _setupSkybox() {
        this.scene.background = new THREE.Color(0x020205);
        
        const loader = new THREE.TextureLoader();
        
        // 1. Towering Skyline (Vertical Backdrop)
        loader.load(CONFIG.ASSETS.SKYBOX, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.wrapS = THREE.RepeatWrapping;
            texture.repeat.set(4, 1); 

            // Create a massive cylinder for the city skyline
            const skyGeom = new THREE.CylinderGeometry(800, 800, 1000, 32, 1, true);
            skyGeom.scale(-1, 1, 1); 
            const skyMat = new THREE.MeshBasicMaterial({ 
                map: texture, 
                fog: false, 
                transparent: true, 
                opacity: 1.0 
            });
            this.skyboxMesh = new THREE.Mesh(skyGeom, skyMat);
            
            // CRITICAL: Position Y so the buildings meet the ground level
            this.skyboxMesh.position.y = 450; 
            this.scene.add(this.skyboxMesh);
        });

        // 2. NEW: Massive City Floor
        loader.load(CONFIG.ASSETS.CITY_FLOOR_TEXTURE, (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(100, 100);
            texture.colorSpace = THREE.SRGBColorSpace;

            const floorGeom = new THREE.PlaneGeometry(2000, 2000);
            floorGeom.rotateX(-Math.PI / 2);
            const floorMat = new THREE.MeshStandardMaterial({ 
                map: texture,
                metalness: 0.8,
                roughness: 0.2,
                emissive: 0x111122,
                emissiveIntensity: 0.5
            });
            this.cityFloor = new THREE.Mesh(floorGeom, floorMat);
            this.cityFloor.position.y = -0.1; // Just below the tracks
            this.scene.add(this.cityFloor);
        });

        // Keep the procedural starfield for extra depth and twinkle
        const starCount = 2000;
        const starGeom = new THREE.BufferGeometry();
        const starPositions = new Float32Array(starCount * 3);
        
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            // Spread stars in a large sphere around the origin
            const r = 400 + Math.random() * 200;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            
            starPositions[i3] = r * Math.sin(phi) * Math.cos(theta);
            starPositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            starPositions[i3 + 2] = r * Math.cos(phi);
        }
        
        starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const starMat = new THREE.PointsMaterial({ 
            color: 0xffffff, 
            size: 0.7, 
            transparent: true, 
            opacity: 0.8,
            sizeAttenuation: true 
        });
        
        this.stars = new THREE.Points(starGeom, starMat);
        this.scene.add(this.stars);
    }

    onResize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    _checkDailyBonus() {
        const lastLogin = localStorage.getItem('lastLogin');
        const now = new Date().toDateString();
        if (lastLogin !== now) {
            const bonus = 100;
            this.totalCoins += bonus;
            localStorage.setItem('totalCoins', this.totalCoins.toString());
            localStorage.setItem('lastLogin', now);
            this._showNotification(`DAILY BONUS: +${bonus} COINS!`);
        }
    }

    _showNotification(text) {
        const notif = document.createElement('div');
        notif.style.position = 'absolute';
        notif.style.top = '50%';
        notif.style.left = '50%';
        notif.style.transform = 'translate(-50%, -50%)';
        notif.style.color = '#ffff00';
        notif.style.fontSize = '24px';
        notif.style.fontFamily = "'Orbitron', sans-serif";
        notif.style.textShadow = '0 0 10px #ffff00';
        notif.style.zIndex = '100';
        notif.innerText = text;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }

    _setupAudio() {
        this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
        this.bass = new Tone.MonoSynth({
            oscillator: { type: 'fmsquare' },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 1 }
        }).toDestination();

        this.jumpSfx = new Tone.MembraneSynth().toDestination();
        this.slideSfx = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0 } }).toDestination();
        this.hitSfx = new Tone.MetalSynth().toDestination();
        this.coinSfx = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' } }).toDestination();
        this.powerUpSfx = new Tone.MonoSynth({ oscillator: { type: 'sine' } }).toDestination();
        this.purchaseSfx = new Tone.PolySynth(Tone.Synth, { volume: -10 }).toDestination();
        this.missionSfx = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, volume: -5 }).toDestination();

        this.loopSeq = new Tone.Sequence((time, note) => {
            this.bass.triggerAttackRelease(note, '8n', time);
        }, ['C2', 'C2', 'Eb2', 'F2', 'C2', 'C2', 'Bb1', 'G1'], '8n');

        Tone.Transport.bpm.value = 140;
    }
}
