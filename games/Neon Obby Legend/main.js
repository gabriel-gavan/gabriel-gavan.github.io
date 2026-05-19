import * as THREE from 'three';
import { ThirdPersonCameraController } from './rosie/controls/rosieControls.js';
import { Player } from './Player.js';
import { World } from './World.js';
import { UI } from './UI.js';
import { CONFIG } from './config.js';

class Game {
    constructor() {
        this.unlockedCampaigns = JSON.parse(localStorage.getItem('unlockedCampaigns') || '[0]');
        this.starsData = JSON.parse(localStorage.getItem('starsData') || '{}');
        this.currentCampaignId = 0;
        this.lastInterstitialTime = 0;
        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        document.body.appendChild(this.renderer.domElement);

        this.world = new World(this.scene);
        
        const playAnotherGame = async () => {
            const CURRENT_GAME_ID = 'neon-obby-legend';

            const safeParseJSON = (raw, fallback) => {
                try {
                    return JSON.parse(raw) || fallback;
                } catch {
                    return fallback;
                }
            };

            const normalizeUrl = (url) => {
                if (!url) return null;
                if (url.startsWith('http://') || url.startsWith('https://')) return url;
                if (url.startsWith('/')) return url;
                return '/' + url;
            };

            const STATIC_FALLBACK_URLS = [
                '/games/Soldier Runner/index.html',
                '/games/Castle Falls/index.html',
                '/games/Neon Nebula Strike/index.html',
                '/games/Saloon Showdown/index.html',
                '/index.html'
            ];

            try {
                const res = await fetch('/games/games.json');
                const gamesCatalog = await res.json();

                const allGames = [];
                if (Array.isArray(gamesCatalog.topPicks)) allGames.push(...gamesCatalog.topPicks);
                if (Array.isArray(gamesCatalog.classic)) allGames.push(...gamesCatalog.classic);
                if (Array.isArray(gamesCatalog.skill)) allGames.push(...gamesCatalog.skill);
                if (Array.isArray(gamesCatalog.strategy)) allGames.push(...gamesCatalog.strategy);

                const playCounts = safeParseJSON(localStorage.getItem('gamePlayCounts'), {});
                const getPlays = (id) => {
                    const n = Number(playCounts?.[id] || 0);
                    return Number.isFinite(n) && n > 0 ? n : 0;
                };

                const candidates = allGames.filter(g => g?.id && g.id !== CURRENT_GAME_ID && g?.url);

                if (candidates.length === 0) {
                    const topFallback = Array.isArray(gamesCatalog.topPicks)
                        ? gamesCatalog.topPicks.find(g => g?.id && g.id !== CURRENT_GAME_ID && g?.url)
                        : null;
                    const href = normalizeUrl(topFallback?.url);
                    window.location.href = href || STATIC_FALLBACK_URLS[0];
                    return;
                }

                candidates.sort((a, b) => {
                    const byPlays = getPlays(b.id) - getPlays(a.id);
                    if (byPlays !== 0) return byPlays;
                    return String(a.id).localeCompare(String(b.id));
                });

                const href = normalizeUrl(candidates[0]?.url);
                window.location.href = href || STATIC_FALLBACK_URLS[0];
            } catch (e) {
                console.warn('[NeonObbyLegend] playAnotherGame error:', e);
                const fallbackHref = STATIC_FALLBACK_URLS.find(u => !u.includes('Neon Obby Legend')) || STATIC_FALLBACK_URLS[0];
                window.location.href = fallbackHref;
            }
        };

        this.ui = new UI(
            () => this.restart(),
            (id) => this.selectCampaign(id),
            () => this.goHome(),
            playAnotherGame
        );

        this.player = new Player(this.scene, () => {
            this.levelDeaths++; // Track deaths per level

            // Show an interstitial only after repeated deaths, with cooldown.
            if (this.levelDeaths >= 5) {
                this.showInterstitialAd();
                this.levelDeaths = 0;
            }

            this.ui.showDeath();
        }, {
            onCheckpoint: () => this.ui.showCheckpoint()
        });
        
        this.cameraController = new ThirdPersonCameraController(
            this.camera, 
            this.player.mesh, 
            this.renderer.domElement,
            { distance: 8, height: 4 }
        );
        
        this.ui.updateCampaign(this.player.unlockedPrizes);
        
        // Populate the campaign menu data first, then show the title screen
        this.ui.showCampaignMenu(CONFIG.CAMPAIGNS, this.unlockedCampaigns);
        this.ui.showTitleScreen();
        
        this.clock = new THREE.Clock();
        this.isGameOver = true; // Start in menu

        window.addEventListener('resize', () => this.onResize());
        
        this.animate();
    }

    showInterstitialAd(force = false) {
        const now = Date.now();

        // Keep ads from showing too often unless this is a major campaign-complete break.
        if (!force && now - this.lastInterstitialTime < 60000) {
            return;
        }

        this.lastInterstitialTime = now;

        try {
            if (
                window.NeonAds &&
                typeof window.NeonAds.showGameBreakAd === 'function'
            ) {
                window.NeonAds.showGameBreakAd();
            }
        } catch (e) {
            console.log('Interstitial ad failed', e);
        }
    }

    goHome() {
        this.isGameOver = true;
        this.player.controller.mobileControls.setVisibility(false);

        // Safe break: player returns to campaign/menu.
        this.showInterstitialAd();

        this.ui.showCampaignMenu(CONFIG.CAMPAIGNS, this.unlockedCampaigns);
    }

    selectCampaign(id) {
        this.currentCampaignId = id;
        this.player.controller.mobileControls.setVisibility(false);
        const campaign = CONFIG.CAMPAIGNS.find(c => c.id === id);
        const campaignStars = this.starsData[id] || {};
        this.ui.showLevelMenu(id, campaign.name, campaignStars, (levelIdx) => this.startLevel(levelIdx));
    }

    startLevel(levelIdx) {
        const campaign = CONFIG.CAMPAIGNS.find(c => c.id === this.currentCampaignId);
        this.world.loadLevel(levelIdx, campaign.difficulty);
        this.player.respawn();
        this.player.checkpoint.set(0, 2, 0); 
        this.levelDeaths = 0; // Track deaths for the level summary
        this.isGameOver = false;
        this.player.controller.mobileControls.setVisibility(true);
        this.clock.start();
    }

    onResize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    restart() {
        const nextLevel = this.world.currentLevel + 1;
        
        if (nextLevel >= 50) {
            // Unlock next campaign if available
            const nextCampaignId = this.currentCampaignId + 1;
            if (nextCampaignId < CONFIG.CAMPAIGNS.length) {
                if (!this.unlockedCampaigns.includes(nextCampaignId)) {
                    this.unlockedCampaigns.push(nextCampaignId);
                    localStorage.setItem('unlockedCampaigns', JSON.stringify(this.unlockedCampaigns));
                }
            }
            // Major safe break: campaign finished / next campaign unlocked.
            this.showInterstitialAd(true);

            this.ui.showCampaignMenu(CONFIG.CAMPAIGNS, this.unlockedCampaigns);
            this.isGameOver = true;
            return;
        }

        this.startLevel(nextLevel);
    }

    checkPrizes(level) {
        CONFIG.CAMPAIGN.MILESTONES.forEach(milestone => {
            if (level >= milestone.level) {
                const unlocked = this.player.unlockPrize(milestone.id);
                if (unlocked) {
                    this.ui.showPrizeUnlock(milestone);
                    this.ui.updateCampaign(this.player.unlockedPrizes);
                }
            }
        });
    }

    calculateStars(time, coins) {
        // Simple star calculation:
        // 1 star: Just finishing
        // 2 stars: Finishing under 45s
        // 3 stars: Finishing under 30s + more than 2 coins
        let stars = 1;
        if (time < 45) stars = 2;
        if (time < 30 && coins >= 2) stars = 3;
        return stars;
    }

    saveStars(levelIdx, stars) {
        if (!this.starsData[this.currentCampaignId]) {
            this.starsData[this.currentCampaignId] = {};
        }
        const currentBest = this.starsData[this.currentCampaignId][levelIdx] || 0;
        if (stars > currentBest) {
            this.starsData[this.currentCampaignId][levelIdx] = stars;
            localStorage.setItem('starsData', JSON.stringify(this.starsData));
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = Math.min(this.clock.getDelta(), 0.1);
        const elapsedTime = this.clock.getElapsedTime();
        
        if (!this.isGameOver && this.ui.titleScreen.style.display === 'none' && this.ui.campaignMenu.style.display === 'none' && this.ui.levelMenu.style.display === 'none') {
            const rotation = this.cameraController.update();
            this.player.update(deltaTime, rotation);
            
            this.world.update(elapsedTime);
            const status = this.world.checkCollisions(this.player, deltaTime);
            
            if (status.onWin) {
                this.isGameOver = true;
                this.player.controller.mobileControls.setVisibility(false);
                const completedLevelIdx = this.world.currentLevel;
                const stars = this.calculateStars(elapsedTime, this.player.coins);
                this.saveStars(completedLevelIdx, stars);
                
                this.checkPrizes(completedLevelIdx + 1);

                // Safe break: every 3 completed levels.
                if ((completedLevelIdx + 1) % 3 === 0) {
                    this.showInterstitialAd();
                }

                this.ui.showWin(
                    completedLevelIdx + 1, 
                    elapsedTime, 
                    this.player.coins, 
                    stars, 
                    this.levelDeaths,
                    (restartLevelIdx) => {
                        if (restartLevelIdx !== undefined) {
                            this.startLevel(restartLevelIdx);
                        } else {
                            this.selectCampaign(this.currentCampaignId);
                        }
                    }
                );
            }
            
            const currentSegment = this.world.getSegmentProgress(this.player.mesh.position.z);
            const progressPct = Math.max(0, Math.min(100, (this.player.mesh.position.z / this.world.winZ) * 100));
            
            this.ui.update(
                this.world.currentLevel, 
                elapsedTime, 
                this.player.coins, 
                this.player.speedBoostTimer,
                this.player.health,
                this.player.invincibilityTimer,
                currentSegment,
                this.world.totalSegments,
                progressPct
            );
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new Game();
