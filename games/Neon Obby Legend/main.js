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
        
        this.ui = new UI(
            () => this.restart(), 
            (id) => this.selectCampaign(id),
            () => this.goHome()
        );

        this.player = new Player(this.scene, () => {
            this.levelDeaths++; // Track deaths per level
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

    goHome() {
        this.isGameOver = true;
        this.player.controller.mobileControls.setVisibility(false);
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
