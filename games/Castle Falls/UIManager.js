import { CAMPAIGNS } from './GameData.js';
import { CONFIG } from './config.js';

export class UIManager {
    constructor(onRestart, onStartLevel) {
        this.onRestart = onRestart;
        this.onStartLevel = onStartLevel;
        this.setupUI();
    }

    setupUI() {
        const isSmallScreen = window.innerWidth < 768;

        // Landing Page
        this.landingPage = document.createElement('div');
        this.landingPage.style.position = 'fixed';
        this.landingPage.style.top = '0';
        this.landingPage.style.left = '0';
        this.landingPage.style.width = '100%';
        this.landingPage.style.height = '100%';
        this.landingPage.style.backgroundColor = 'rgba(0,0,0,0.95)';
        this.landingPage.style.display = 'flex';
        this.landingPage.style.flexDirection = 'column';
        this.landingPage.style.justifyContent = 'center';
        this.landingPage.style.alignItems = 'center';
        this.landingPage.style.zIndex = '250';
        this.landingPage.style.fontFamily = "'MedievalSharp', cursive";
        this.landingPage.style.backgroundImage = `url(${CONFIG.ASSETS.CASTLE_BG})`;
        this.landingPage.style.backgroundSize = 'cover';
        this.landingPage.style.backgroundPosition = 'center';
        document.body.appendChild(this.landingPage);

        const landingTitle = document.createElement('h1');
        landingTitle.innerHTML = 'CASTLE FALLS';
        landingTitle.style.color = '#ffcc00';
        landingTitle.style.fontSize = isSmallScreen ? '48px' : '84px';
        landingTitle.style.marginBottom = isSmallScreen ? '20px' : '40px';
        landingTitle.style.textShadow = '0 0 20px rgba(255, 204, 0, 0.4)';
        landingTitle.style.textAlign = 'center';
        this.landingPage.appendChild(landingTitle);

        const startButton = document.createElement('button');
        startButton.innerHTML = 'START ADVENTURE';
        startButton.style.padding = isSmallScreen ? '15px 40px' : '20px 60px';
        startButton.style.fontSize = isSmallScreen ? '24px' : '32px';
        startButton.style.cursor = 'pointer';
        startButton.style.backgroundColor = '#600';
        startButton.style.color = 'white';
        startButton.style.border = '3px solid #ffcc00';
        startButton.style.borderRadius = '12px';
        startButton.style.fontFamily = "'MedievalSharp', cursive";
        startButton.style.transition = 'all 0.2s';
        startButton.style.marginBottom = '20px';
        startButton.style.touchAction = 'manipulation';
        startButton.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.showMainMenu();
        });
        this.landingPage.appendChild(startButton);

        const hubButton = document.createElement('button');
        hubButton.innerHTML = 'BACK TO HUB';
        hubButton.style.padding = '12px 30px';
        hubButton.style.fontSize = '20px';
        hubButton.style.cursor = 'pointer';
        hubButton.style.backgroundColor = '#222';
        hubButton.style.color = '#aaa';
        hubButton.style.border = '1px solid #444';
        hubButton.style.borderRadius = '8px';
        hubButton.style.fontFamily = "'MedievalSharp', cursive";
        hubButton.style.touchAction = 'manipulation';
        hubButton.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            window.location.href = '/index.html';
        });
        this.landingPage.appendChild(hubButton);

        // Level Complete Screen
        this.levelCompleteScreen = document.createElement('div');
        this.levelCompleteScreen.style.position = 'fixed';
        this.levelCompleteScreen.style.top = '0';
        this.levelCompleteScreen.style.left = '0';
        this.levelCompleteScreen.style.width = '100%';
        this.levelCompleteScreen.style.height = '100%';
        this.levelCompleteScreen.style.backgroundColor = 'rgba(0,0,0,0.85)';
        this.levelCompleteScreen.style.display = 'none';
        this.levelCompleteScreen.style.flexDirection = 'column';
        this.levelCompleteScreen.style.justifyContent = 'center';
        this.levelCompleteScreen.style.alignItems = 'center';
        this.levelCompleteScreen.style.zIndex = '150';
        this.levelCompleteScreen.style.fontFamily = "'MedievalSharp', cursive";
        document.body.appendChild(this.levelCompleteScreen);

        this.completeTitle = document.createElement('h1');
        this.completeTitle.style.color = '#ffcc00';
        this.completeTitle.style.fontSize = isSmallScreen ? '42px' : '64px';
        this.completeTitle.innerHTML = 'LEVEL COMPLETE!';
        this.levelCompleteScreen.appendChild(this.completeTitle);

        this.completeStats = document.createElement('div');
        this.completeStats.style.color = 'white';
        this.completeStats.style.fontSize = '24px';
        this.completeStats.style.margin = '20px 0';
        this.completeStats.style.textAlign = 'center';
        this.levelCompleteScreen.appendChild(this.completeStats);

        this.nextLevelBtn = document.createElement('button');
        this.nextLevelBtn.innerHTML = 'NEXT LEVEL';
        this.nextLevelBtn.style.padding = '15px 40px';
        this.nextLevelBtn.style.fontSize = '24px';
        this.nextLevelBtn.style.cursor = 'pointer';
        this.nextLevelBtn.style.backgroundColor = '#006600';
        this.nextLevelBtn.style.color = 'white';
        this.nextLevelBtn.style.border = '2px solid white';
        this.nextLevelBtn.style.fontFamily = "'MedievalSharp', cursive";
        this.nextLevelBtn.style.touchAction = 'manipulation';
        this.nextLevelBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.hideLevelComplete();
            // Find campaign name for the next level
            const nextLevelVal = this.nextLevelBtn.dataset.nextLevel;
            if (nextLevelVal) {
                const num = parseInt(nextLevelVal);
                const campaign = CAMPAIGNS.find(c => c.levels.includes(num));
                const sectorName = campaign ? campaign.name : this.currentCampaignName;
                this.onStartLevel(num, sectorName);
            }
        });
        this.levelCompleteScreen.appendChild(this.nextLevelBtn);

        const completeMenuBtn = document.createElement('button');
        completeMenuBtn.innerHTML = 'MAIN MENU';
        completeMenuBtn.style.padding = '10px 20px';
        completeMenuBtn.style.fontSize = '18px';
        completeMenuBtn.style.cursor = 'pointer';
        completeMenuBtn.style.backgroundColor = '#222';
        completeMenuBtn.style.color = 'white';
        completeMenuBtn.style.border = '1px solid white';
        completeMenuBtn.style.marginTop = '10px';
        completeMenuBtn.style.fontFamily = "'MedievalSharp', cursive";
        completeMenuBtn.style.touchAction = 'manipulation';
        completeMenuBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.hideLevelComplete();
            this.showMainMenu();
        });
        this.levelCompleteScreen.appendChild(completeMenuBtn);

        // Main menu
        this.mainMenu = document.createElement('div');
        this.mainMenu.style.position = 'fixed';
        this.mainMenu.style.top = '0';
        this.mainMenu.style.left = '0';
        this.mainMenu.style.width = '100%';
        this.mainMenu.style.height = '100%';
        this.mainMenu.style.backgroundColor = 'rgba(0,0,0,0.95)';
        this.mainMenu.style.backgroundImage = `url(${CONFIG.ASSETS.CAMPAIGN_BG})`;
        this.mainMenu.style.backgroundSize = 'cover';
        this.mainMenu.style.backgroundPosition = 'center';
        this.mainMenu.style.display = 'none'; // Initially hidden by Landing Page
        this.mainMenu.style.flexDirection = 'column';
        this.mainMenu.style.justifyContent = 'center';
        this.mainMenu.style.alignItems = 'center';
        this.mainMenu.style.zIndex = '200';
        this.mainMenu.style.fontFamily = "'MedievalSharp', cursive";
        document.body.appendChild(this.mainMenu);

        this.menuTitle = document.createElement('h1');
        this.menuTitle.innerHTML = 'CASTLE CAMPAIGNS';
        this.menuTitle.style.color = '#ffcc00';
        this.menuTitle.style.fontSize = isSmallScreen ? '32px' : '48px';
        this.menuTitle.style.marginBottom = '20px';
        this.mainMenu.appendChild(this.menuTitle);

        this.campaignGrid = document.createElement('div');
        this.campaignGrid.style.display = 'grid';
        this.campaignGrid.style.gridTemplateColumns = isSmallScreen ? '1fr' : 'repeat(2, 1fr)';
        this.campaignGrid.style.gap = '20px';
        this.campaignGrid.style.width = '90%';
        this.campaignGrid.style.maxWidth = '800px';
        this.campaignGrid.style.maxHeight = '70vh';
        this.campaignGrid.style.overflowY = 'auto';
        this.campaignGrid.style.padding = '20px';
        this.mainMenu.appendChild(this.campaignGrid);

        // Add "Back to Title" button at the bottom of Campaign Selection
        const backToTitleBtn = document.createElement('button');
        backToTitleBtn.innerHTML = 'BACK TO TITLE';
        backToTitleBtn.style.padding = '10px 30px';
        backToTitleBtn.style.marginTop = '20px';
        backToTitleBtn.style.cursor = 'pointer';
        backToTitleBtn.style.backgroundColor = 'rgba(0,0,0,0.5)';
        backToTitleBtn.style.color = '#aaa';
        backToTitleBtn.style.border = '1px solid #444';
        backToTitleBtn.style.borderRadius = '8px';
        backToTitleBtn.style.fontFamily = "'MedievalSharp', cursive";
        backToTitleBtn.style.touchAction = 'manipulation';
        backToTitleBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.showLandingPage();
        });
        this.mainMenu.appendChild(backToTitleBtn);

        // Level Select Board (Initially hidden)
        this.levelBoard = document.createElement('div');
        this.levelBoard.style.display = 'none';
        this.levelBoard.style.flexDirection = 'column';
        this.levelBoard.style.alignItems = 'center';
        this.levelBoard.style.width = '100%';
        this.mainMenu.appendChild(this.levelBoard);

        const levelSelectTitle = document.createElement('h2');
        levelSelectTitle.innerHTML = 'SELECT LEVEL';
        levelSelectTitle.style.color = 'white';
        levelSelectTitle.style.fontSize = '24px';
        levelSelectTitle.style.marginBottom = '20px';
        levelSelectTitle.style.letterSpacing = '2px';
        this.levelBoard.appendChild(levelSelectTitle);

        this.levelGrid = document.createElement('div');
        this.levelGrid.style.display = 'grid';
        this.levelGrid.style.gridTemplateColumns = isSmallScreen ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)';
        this.levelGrid.style.gap = '15px';
        this.levelGrid.style.marginBottom = '30px';
        this.levelBoard.appendChild(this.levelGrid);

        this.backButton = document.createElement('button');
        this.backButton.innerHTML = 'BACK TO CAMPAIGNS';
        this.backButton.style.padding = '10px 20px';
        this.backButton.style.cursor = 'pointer';
        this.backButton.style.backgroundColor = '#444';
        this.backButton.style.color = 'white';
        this.backButton.style.border = '1px solid white';
        this.backButton.style.fontFamily = "'MedievalSharp', cursive";
        this.backButton.style.touchAction = 'manipulation';
        this.backButton.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.showCampaigns();
        });
        this.levelBoard.appendChild(this.backButton);

        // Stats container (Top Left)
        this.statsContainer = document.createElement('div');
        this.statsContainer.style.position = 'fixed';
        this.statsContainer.style.top = '20px';
        this.statsContainer.style.left = '20px';
        this.statsContainer.style.color = 'white';
        this.statsContainer.style.fontFamily = "'MedievalSharp', cursive";
        this.statsContainer.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
        this.statsContainer.style.zIndex = '50';
        this.statsContainer.style.display = 'none'; // Hidden in menu
        document.body.appendChild(this.statsContainer);

        // Distance counter
        this.distanceElement = document.createElement('div');
        this.distanceElement.style.fontSize = '24px';
        this.distanceElement.innerHTML = 'Distance: 0m';
        this.statsContainer.appendChild(this.distanceElement);

        // Difficulty counter
        this.difficultyElement = document.createElement('div');
        this.difficultyElement.style.fontSize = '18px';
        this.difficultyElement.style.color = '#ffcc00';
        this.difficultyElement.style.marginTop = '5px';
        this.difficultyElement.innerHTML = 'Castle Fury: x1.0';
        this.statsContainer.appendChild(this.difficultyElement);

        // Player Health Bar (Top Left)
        this.healthContainer = document.createElement('div');
        this.healthContainer.style.width = '150px';
        this.healthContainer.style.height = '15px';
        this.healthContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
        this.healthContainer.style.border = '2px solid white';
        this.healthContainer.style.borderRadius = '5px';
        this.healthContainer.style.marginTop = '10px';
        this.healthContainer.style.overflow = 'hidden';
        this.statsContainer.appendChild(this.healthContainer);

        this.healthFill = document.createElement('div');
        this.healthFill.style.width = '100%';
        this.healthFill.style.height = '100%';
        this.healthFill.style.backgroundColor = '#00ff00';
        this.healthFill.style.transition = 'width 0.3s, background-color 0.3s';
        this.healthContainer.appendChild(this.healthFill);

        // Lives Indicator (Hearts)
        this.livesContainer = document.createElement('div');
        this.livesContainer.style.marginTop = '10px';
        this.livesContainer.style.display = 'flex';
        this.livesContainer.style.gap = '8px';
        this.statsContainer.appendChild(this.livesContainer);

        // Level Display (Top Center)
        this.levelContainer = document.createElement('div');
        this.levelContainer.style.position = 'fixed';
        this.levelContainer.style.top = '20px';
        this.levelContainer.style.left = '50%';
        this.levelContainer.style.transform = 'translateX(-50%)';
        this.levelContainer.style.textAlign = 'center';
        this.levelContainer.style.zIndex = '50';
        this.levelContainer.style.fontFamily = "'MedievalSharp', cursive";
        this.levelContainer.style.display = 'none'; // Hidden in menu
        document.body.appendChild(this.levelContainer);

        this.levelIndicator = document.createElement('div');
        this.levelIndicator.style.color = '#ffcc00';
        this.levelIndicator.style.fontSize = '32px';
        this.levelIndicator.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
        this.levelIndicator.innerHTML = 'LEVEL 1';
        this.levelContainer.appendChild(this.levelIndicator);

        this.levelName = document.createElement('div');
        this.levelName.style.color = '#fff';
        this.levelName.style.fontSize = '14px';
        this.levelName.innerHTML = 'SECTOR NAME';
        this.levelContainer.appendChild(this.levelName);

        // Progress Bar
        this.progressBg = document.createElement('div');
        this.progressBg.style.width = '200px';
        this.progressBg.style.height = '10px';
        this.progressBg.style.backgroundColor = 'rgba(255,255,255,0.2)';
        this.progressBg.style.borderRadius = '5px';
        this.progressBg.style.marginTop = '5px';
        this.progressBg.style.border = '1px solid rgba(255,255,255,0.3)';
        this.progressBg.style.overflow = 'hidden';
        this.levelContainer.appendChild(this.progressBg);

        this.progressBar = document.createElement('div');
        this.progressBar.style.width = '0%';
        this.progressBar.style.height = '100%';
        this.progressBar.style.backgroundColor = '#ffcc00';
        this.progressBar.style.transition = 'width 0.3s';
        this.progressBg.appendChild(this.progressBar);
        
        // HUD Exit Button (Top Right)
        this.hudExitBtn = document.createElement('button');
        this.hudExitBtn.innerHTML = 'EXIT';
        this.hudExitBtn.style.position = 'fixed';
        this.hudExitBtn.style.top = '20px';
        this.hudExitBtn.style.right = '20px';
        this.hudExitBtn.style.padding = '8px 20px';
        this.hudExitBtn.style.backgroundColor = 'rgba(0,0,0,0.5)';
        this.hudExitBtn.style.color = 'white';
        this.hudExitBtn.style.border = '1px solid #444';
        this.hudExitBtn.style.borderRadius = '5px';
        this.hudExitBtn.style.fontFamily = "'MedievalSharp', cursive";
        this.hudExitBtn.style.zIndex = '50';
        this.hudExitBtn.style.cursor = 'pointer';
        this.hudExitBtn.style.display = 'none'; // Hidden in menu
        this.hudExitBtn.style.touchAction = 'manipulation';
        this.hudExitBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.showMainMenu();
        });
        document.body.appendChild(this.hudExitBtn);

        // Boss Health Bar
        this.bossHealthContainer = document.createElement('div');
        this.bossHealthContainer.style.position = 'fixed';
        this.bossHealthContainer.style.bottom = '40px';
        this.bossHealthContainer.style.left = '50%';
        this.bossHealthContainer.style.transform = 'translateX(-50%)';
        this.bossHealthContainer.style.width = '60%';
        this.bossHealthContainer.style.maxWidth = '800px';
        this.bossHealthContainer.style.display = 'none';
        this.bossHealthContainer.style.flexDirection = 'column';
        this.bossHealthContainer.style.alignItems = 'center';
        this.bossHealthContainer.style.zIndex = '50';
        document.body.appendChild(this.bossHealthContainer);

        this.bossName = document.createElement('div');
        this.bossName.innerHTML = 'THE ANCIENT DRAGON';
        this.bossName.style.color = '#ff4444';
        this.bossName.style.fontFamily = "'MedievalSharp', cursive";
        this.bossName.style.fontSize = '24px';
        this.bossName.style.marginBottom = '5px';
        this.bossName.style.textShadow = '2px 2px 4px black';
        this.bossHealthContainer.appendChild(this.bossName);

        this.bossHealthBg = document.createElement('div');
        this.bossHealthBg.style.width = '100%';
        this.bossHealthBg.style.height = '20px';
        this.bossHealthBg.style.backgroundColor = 'rgba(0,0,0,0.5)';
        this.bossHealthBg.style.border = '2px solid #555';
        this.bossHealthBg.style.borderRadius = '10px';
        this.bossHealthBg.style.overflow = 'hidden';
        this.bossHealthContainer.appendChild(this.bossHealthBg);

        this.bossHealthFill = document.createElement('div');
        this.bossHealthFill.style.width = '100%';
        this.bossHealthFill.style.height = '100%';
        this.bossHealthFill.style.backgroundColor = '#ff0000';
        this.bossHealthFill.style.transition = 'width 0.2s ease-out';
        this.bossHealthBg.appendChild(this.bossHealthFill);

        // Stage Complete Splash
        this.splash = document.createElement('div');
        this.splash.style.position = 'fixed';
        this.splash.style.top = '40%';
        this.splash.style.left = '50%';
        this.splash.style.transform = 'translate(-50%, -50%)';
        this.splash.style.color = '#ffaa00';
        this.splash.style.fontSize = '64px';
        this.splash.style.fontFamily = "'MedievalSharp', cursive";
        this.splash.style.textShadow = '4px 4px 8px rgba(0,0,0,0.9)';
        this.splash.style.opacity = '0';
        this.splash.style.transition = 'opacity 0.5s, transform 0.5s';
        this.splash.style.pointerEvents = 'none';
        this.splash.innerHTML = 'LEVEL COMPLETE';
        document.body.appendChild(this.splash);

        // Life Lost Splash
        this.lifeLostSplash = document.createElement('div');
        this.lifeLostSplash.style.position = 'fixed';
        this.lifeLostSplash.style.top = '50%';
        this.lifeLostSplash.style.left = '50%';
        this.lifeLostSplash.style.transform = 'translate(-50%, -50%)';
        this.lifeLostSplash.style.color = '#ff4444';
        this.lifeLostSplash.style.fontSize = '48px';
        this.lifeLostSplash.style.fontFamily = "'MedievalSharp', cursive";
        this.lifeLostSplash.style.textShadow = '2px 2px 4px black';
        this.lifeLostSplash.style.opacity = '0';
        this.lifeLostSplash.style.transition = 'opacity 0.3s, transform 0.3s';
        this.lifeLostSplash.style.pointerEvents = 'none';
        this.lifeLostSplash.style.zIndex = '120';
        this.lifeLostSplash.innerHTML = 'LIFE LOST';
        document.body.appendChild(this.lifeLostSplash);

        // Status Message (Lower Center)
        this.statusMessage = document.createElement('div');
        this.statusMessage.style.position = 'fixed';
        this.statusMessage.style.bottom = '100px';
        this.statusMessage.style.left = '50%';
        this.statusMessage.style.transform = 'translateX(-50%)';
        this.statusMessage.style.color = '#00ff00';
        this.statusMessage.style.fontSize = '24px';
        this.statusMessage.style.fontFamily = "'MedievalSharp', cursive";
        this.statusMessage.style.textShadow = '2px 2px 4px black';
        this.statusMessage.style.opacity = '0';
        this.statusMessage.style.transition = 'opacity 0.3s, transform 0.3s';
        this.statusMessage.style.pointerEvents = 'none';
        this.statusMessage.style.zIndex = '60';
        document.body.appendChild(this.statusMessage);

        // Mobile Fire Button
        this.fireButton = document.createElement('button');
        this.fireButton.innerHTML = '🔥';
        this.fireButton.style.position = 'fixed';
        this.fireButton.style.bottom = '40px';
        this.fireButton.style.right = '40px';
        this.fireButton.style.width = '80px';
        this.fireButton.style.height = '80px';
        this.fireButton.style.borderRadius = '50%';
        this.fireButton.style.backgroundColor = 'rgba(255, 68, 0, 0.6)';
        this.fireButton.style.border = '3px solid white';
        this.fireButton.style.color = 'white';
        this.fireButton.style.fontSize = '40px';
        this.fireButton.style.display = 'none'; // Hidden until magic unlocked
        this.fireButton.style.zIndex = '100';
        this.fireButton.style.touchAction = 'none';
        document.body.appendChild(this.fireButton);

        // Magic Unlocked Splash
        this.magicUnlockedSplash = document.createElement('div');
        this.magicUnlockedSplash.style.position = 'fixed';
        this.magicUnlockedSplash.style.top = '40%';
        this.magicUnlockedSplash.style.left = '50%';
        this.magicUnlockedSplash.style.transform = 'translate(-50%, -50%)';
        this.magicUnlockedSplash.style.color = '#00ffff';
        this.magicUnlockedSplash.style.fontSize = '64px';
        this.magicUnlockedSplash.style.fontFamily = "'MedievalSharp', cursive";
        this.magicUnlockedSplash.style.textShadow = '0 0 20px rgba(0,255,255,0.8)';
        this.magicUnlockedSplash.style.opacity = '0';
        this.magicUnlockedSplash.style.transition = 'opacity 0.5s, transform 0.5s';
        this.magicUnlockedSplash.style.pointerEvents = 'none';
        this.magicUnlockedSplash.style.zIndex = '120';
        this.magicUnlockedSplash.innerHTML = 'MAGIC UNLOCKED!<br><span style="font-size: 24px;">CLICK TO CAST</span>';
        this.magicUnlockedSplash.style.textAlign = 'center';
        document.body.appendChild(this.magicUnlockedSplash);

        // Game Over screen
        this.gameOverScreen = document.createElement('div');
        this.gameOverScreen.style.position = 'fixed';
        this.gameOverScreen.style.top = '0';
        this.gameOverScreen.style.left = '0';
        this.gameOverScreen.style.width = '100%';
        this.gameOverScreen.style.height = '100%';
        this.gameOverScreen.style.backgroundColor = 'rgba(20, 0, 0, 0.9)';
        this.gameOverScreen.style.display = 'none';
        this.gameOverScreen.style.flexDirection = 'column';
        this.gameOverScreen.style.justifyContent = 'center';
        this.gameOverScreen.style.alignItems = 'center';
        this.gameOverScreen.style.zIndex = '300';
        this.gameOverScreen.style.fontFamily = "'MedievalSharp', cursive";
        
        const skullIcon = document.createElement('div');
        skullIcon.innerHTML = '💀';
        skullIcon.style.fontSize = '80px';
        skullIcon.style.marginBottom = '10px';
        skullIcon.style.filter = 'drop-shadow(0 0 15px red)';
        this.gameOverScreen.appendChild(skullIcon);

        const titleDeath = document.createElement('h1');
        titleDeath.style.color = '#ff0000';
        titleDeath.style.fontSize = '84px';
        titleDeath.style.margin = '0';
        titleDeath.style.textShadow = '0 0 20px rgba(255,0,0,0.5)';
        titleDeath.innerHTML = 'GAME OVER';
        this.gameOverScreen.appendChild(titleDeath);

        this.finalScore = document.createElement('div');
        this.finalScore.style.color = 'white';
        this.finalScore.style.fontSize = '24px';
        this.finalScore.style.marginTop = '20px';
        this.finalScore.style.textAlign = 'center';
        this.gameOverScreen.appendChild(this.finalScore);

        // Leaderboard
        this.leaderboardContainer = document.createElement('div');
        this.leaderboardContainer.style.marginTop = '20px';
        this.leaderboardContainer.style.padding = '15px';
        this.leaderboardContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
        this.leaderboardContainer.style.border = '1px solid #444';
        this.leaderboardContainer.style.borderRadius = '8px';
        this.leaderboardContainer.style.width = '300px';
        this.gameOverScreen.appendChild(this.leaderboardContainer);

        const restartButton = document.createElement('button');
        restartButton.innerHTML = 'TRY AGAIN';
        restartButton.style.padding = '15px 50px';
        restartButton.style.fontSize = '28px';
        restartButton.style.cursor = 'pointer';
        restartButton.style.backgroundColor = '#600';
        restartButton.style.color = 'white';
        restartButton.style.border = '3px solid white';
        restartButton.style.marginTop = '30px';
        restartButton.style.borderRadius = '10px';
        restartButton.style.fontFamily = "'MedievalSharp', cursive";
        restartButton.style.transition = 'all 0.2s';
        restartButton.style.touchAction = 'manipulation';
        
        restartButton.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.hideGameOver();
            this.onRestart();
        });
        this.gameOverScreen.appendChild(restartButton);

        const menuButton = document.createElement('button');
        menuButton.innerHTML = 'QUIT TO MENU';
        menuButton.style.padding = '10px 20px';
        menuButton.style.fontSize = '18px';
        menuButton.style.cursor = 'pointer';
        menuButton.style.backgroundColor = '#222';
        menuButton.style.color = '#aaa';
        menuButton.style.border = '1px solid #444';
        menuButton.style.marginTop = '20px';
        menuButton.style.fontFamily = "'MedievalSharp', cursive";
        menuButton.style.touchAction = 'manipulation';
        menuButton.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.hideGameOver();
            this.showMainMenu();
        });
        this.gameOverScreen.appendChild(menuButton);

        document.body.appendChild(this.gameOverScreen);
    }

    renderCampaigns(gameState) {
        this.campaignGrid.innerHTML = '';
        CAMPAIGNS.forEach((campaign, index) => {
            const isUnlocked = gameState.progress.unlockedCampaigns.includes(index);
            const card = document.createElement('div');
            card.style.padding = '15px';
            card.style.border = isUnlocked ? '2px solid #ffcc00' : '2px solid #333';
            card.style.backgroundColor = isUnlocked ? '#222' : '#111';
            card.style.borderRadius = '12px';
            card.style.textAlign = 'center';
            card.style.cursor = isUnlocked ? 'pointer' : 'default';
            card.style.opacity = isUnlocked ? '1' : '0.5';
            card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.position = 'relative';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'center';
            card.style.minHeight = '145px';
            card.style.gap = '8px';
            card.style.boxSizing = 'border-box';
            card.style.margin = '0 auto';
            card.style.width = '100%';
            card.style.overflow = 'visible';
            card.style.padding = '15px 10px';
            
            if (isUnlocked) {
                card.onmouseenter = () => {
                    card.style.transform = 'translateY(-5px)';
                    card.style.boxShadow = '0 10px 20px rgba(255, 204, 0, 0.2)';
                    card.style.borderColor = '#fff';
                };
                card.onmouseleave = () => {
                    card.style.transform = 'translateY(0)';
                    card.style.boxShadow = 'none';
                    card.style.borderColor = '#ffcc00';
                };
                card.style.touchAction = 'manipulation';
                card.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    this.showLevelBoard(campaign, gameState);
                });
            }

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.justifyContent = 'center';
            header.style.gap = '15px';
            header.style.marginBottom = '10px';
            card.appendChild(header);

            const icon = document.createElement('div');
            icon.innerHTML = campaign.icon;
            icon.style.fontSize = '32px';
            header.appendChild(icon);

            const name = document.createElement('h3');
            name.innerHTML = campaign.name;
            name.style.color = isUnlocked ? '#ffcc00' : '#666';
            name.style.margin = '0';
            name.style.fontSize = '20px';
            header.appendChild(name);

            const levelInfo = document.createElement('div');
            levelInfo.innerHTML = `${campaign.levels.length} LEVELS`;
            levelInfo.style.fontSize = '14px';
            levelInfo.style.fontWeight = 'bold';
            levelInfo.style.color = isUnlocked ? '#fff' : '#444';
            levelInfo.style.letterSpacing = '1px';
            card.appendChild(levelInfo);

            if (!isUnlocked) {
                const locked = document.createElement('div');
                locked.innerHTML = '🔒 LOCKED';
                locked.style.color = '#ff4444';
                locked.style.fontWeight = 'bold';
                card.appendChild(locked);
            } else {
                const prompt = document.createElement('div');
                prompt.innerHTML = 'SELECT LEVEL';
                prompt.style.color = '#00ff00';
                prompt.style.fontSize = '14px';
                prompt.style.fontWeight = 'bold';
                card.appendChild(prompt);
            }

            this.campaignGrid.appendChild(card);
        });
    }

    showLevelBoard(campaign, gameState) {
        this.menuTitle.innerHTML = `<span style="font-size: 0.6em; color: #aaa;">${campaign.icon}</span> ${campaign.name.toUpperCase()}`;
        this.campaignGrid.style.display = 'none';
        this.levelBoard.style.display = 'flex';
        this.levelGrid.innerHTML = '';

        campaign.levels.forEach(lvl => {
            const isCompleted = gameState.progress.completedLevels.includes(lvl);
            const isUnlocked = gameState.isLevelUnlocked(lvl);
            const btn = document.createElement('button');
            
            // Level Number
            const num = document.createElement('div');
            num.innerHTML = lvl;
            num.style.fontSize = '24px';
            num.style.fontWeight = 'bold';
            btn.appendChild(num);

            // Completion Icon
            if (isCompleted) {
                const check = document.createElement('div');
                check.innerHTML = '✓';
                check.style.color = '#00ff00';
                check.style.fontSize = '16px';
                btn.appendChild(check);
            }

            btn.style.width = '80px';
            btn.style.height = '80px';
            btn.style.display = 'flex';
            btn.style.flexDirection = 'column';
            btn.style.justifyContent = 'center';
            btn.style.alignItems = 'center';
            btn.style.cursor = isUnlocked ? 'pointer' : 'default';
            btn.style.backgroundColor = isUnlocked ? (isCompleted ? '#1a4a1a' : '#333') : '#111';
            btn.style.color = isUnlocked ? 'white' : '#444';
            btn.style.border = isUnlocked ? '2px solid #555' : '2px solid #222';
            btn.style.borderRadius = '10px';
            btn.style.boxShadow = isUnlocked ? '0 4px 0 #111' : 'none';
            btn.style.fontFamily = "'MedievalSharp', cursive";
            btn.style.transition = 'all 0.1s ease';
            
            if (isUnlocked) {
                btn.onmouseenter = () => {
                    btn.style.borderColor = '#ffcc00';
                    btn.style.transform = 'translateY(-2px)';
                };
                btn.onmouseleave = () => {
                    btn.style.borderColor = isCompleted ? '#2a6a2a' : '#555';
                    btn.style.transform = 'translateY(0)';
                };
                btn.onmousedown = () => {
                    btn.style.transform = 'translateY(4px)';
                    btn.style.boxShadow = 'none';
                };
                btn.onmouseup = () => {
                    btn.style.transform = 'translateY(-2px)';
                    btn.style.boxShadow = '0 4px 0 #111';
                };
                
                btn.style.touchAction = 'manipulation';
                btn.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    this.hideMainMenu();
                    this.onStartLevel(lvl, campaign.name);
                });
            } else {
                btn.innerHTML = '🔒';
                btn.style.fontSize = '24px';
            }
            this.levelGrid.appendChild(btn);
        });
    }

    showCampaigns() {
        this.menuTitle.innerHTML = 'CASTLE CAMPAIGNS';
        this.campaignGrid.style.display = 'grid';
        this.levelBoard.style.display = 'none';
    }

    showMainMenu() {
        this.landingPage.style.display = 'none';
        this.showCampaigns();
        this.mainMenu.style.display = 'flex';
        this.statsContainer.style.display = 'none';
        this.levelContainer.style.display = 'none';
        this.hudExitBtn.style.display = 'none';
        document.exitPointerLock?.();
    }

    showLandingPage() {
        this.landingPage.style.display = 'flex';
        this.mainMenu.style.display = 'none';
        this.statsContainer.style.display = 'none';
        this.levelContainer.style.display = 'none';
        this.gameOverScreen.style.display = 'none';
        this.levelCompleteScreen.style.display = 'none';
        this.hudExitBtn.style.display = 'none';
    }

    hideMainMenu() {
        this.mainMenu.style.display = 'none';
        this.statsContainer.style.display = 'block';
        this.levelContainer.style.display = 'block';
        this.hudExitBtn.style.display = 'block';
    }

    updateDistance(dist, level, progress, diffFactor = 1.0) {
        // Toggle mobile fire button based on magic unlock status
        if (level >= 100) {
            this.fireButton.style.display = 'block';
        } else {
            this.fireButton.style.display = 'none';
        }

        this.distanceElement.innerHTML = `Distance: ${Math.floor(dist)}m`;
        this.levelIndicator.innerHTML = `LEVEL ${level}`;
        this.progressBar.style.width = `${Math.min(progress * 100, 100)}%`;
        
        const fury = diffFactor.toFixed(1);
        this.difficultyElement.innerHTML = `Castle Fury: x${fury}`;
        
        // Color shifts as difficulty increases
        if (diffFactor >= 2.0) this.difficultyElement.style.color = '#ff0000';
        else if (diffFactor >= 1.5) this.difficultyElement.style.color = '#ff8800';
        else this.difficultyElement.style.color = '#ffcc00';
    }

    updatePlayerHealth(current, max) {
        const pct = (current / max) * 100;
        this.healthFill.style.width = `${Math.max(0, pct)}%`;
        
        // Change color based on health
        if (pct > 60) {
            this.healthFill.style.backgroundColor = '#00ff00';
        } else if (pct > 30) {
            this.healthFill.style.backgroundColor = '#ffff00';
        } else {
            this.healthFill.style.backgroundColor = '#ff0000';
        }
    }

    updateLives(lives) {
        this.livesContainer.innerHTML = '';
        for (let i = 0; i < lives; i++) {
            const heart = document.createElement('div');
            heart.innerHTML = '❤️';
            heart.style.fontSize = '24px';
            heart.style.filter = 'drop-shadow(0 0 5px rgba(255,0,0,0.5))';
            heart.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            heart.style.transform = 'scale(0)';
            this.livesContainer.appendChild(heart);
            
            // Pop-in animation
            setTimeout(() => {
                heart.style.transform = 'scale(1)';
            }, i * 100);

            // Subtle heartbeat animation
            heart.animate([
                { transform: 'scale(1)' },
                { transform: 'scale(1.15)', offset: 0.1 },
                { transform: 'scale(1)' }
            ], {
                duration: 1000,
                iterations: Infinity,
                delay: 200 + (i * 200)
            });
        }
    }

    showBossHealth(name) {
        if (name) this.bossName.innerHTML = name.toUpperCase();
        this.bossHealthContainer.style.display = 'flex';
        this.bossHealthFill.style.width = '100%';
    }

    updateBossHealth(current, max) {
        const pct = (current / max) * 100;
        this.bossHealthFill.style.width = `${Math.max(0, pct)}%`;
    }

    hideBossHealth() {
        this.bossHealthContainer.style.display = 'none';
    }

    setLevelName(name) {
        this.levelName.innerHTML = name.toUpperCase();
        this.currentCampaignName = name; // Store for next level transitions
    }

    showLevelComplete(level, dist, nextLevelNum) {
        this.completeTitle.innerHTML = `LEVEL ${level} CLEARED!`;
        this.completeStats.innerHTML = `Distance Covered: ${Math.floor(dist)}m<br>Progress: 100%`;
        
        if (nextLevelNum && nextLevelNum <= 200) {
            this.nextLevelBtn.style.display = 'block';
            this.nextLevelBtn.dataset.nextLevel = nextLevelNum;
        } else {
            this.nextLevelBtn.style.display = 'none';
        }

        this.levelCompleteScreen.style.display = 'flex';
        document.exitPointerLock?.();
    }

    hideLevelComplete() {
        this.levelCompleteScreen.style.display = 'none';
    }

    showGameOver(dist, level, leaderboard = []) {
        this.finalScore.innerHTML = `LEVEL ${level}<br>Distance: ${Math.floor(dist)}m`;
        
        // Render Leaderboard
        this.leaderboardContainer.innerHTML = '<h3 style="color: #ffcc00; margin: 0 0 10px 0; text-align: center; font-size: 18px;">LOCAL TOP 5</h3>';
        if (leaderboard.length === 0) {
            this.leaderboardContainer.innerHTML += '<div style="color: #888; text-align: center; font-size: 14px;">No scores yet!</div>';
        } else {
            leaderboard.forEach((score, i) => {
                const entry = document.createElement('div');
                entry.style.display = 'flex';
                entry.style.justifyContent = 'space-between';
                entry.style.fontSize = '14px';
                entry.style.color = i === 0 ? '#00ff00' : 'white';
                entry.style.marginBottom = '5px';
                entry.innerHTML = `
                    <span>#${i+1} LVL ${score.level}</span>
                    <span>${score.distance}m</span>
                    <span style="color: #666; font-size: 10px;">${score.date}</span>
                `;
                this.leaderboardContainer.appendChild(entry);
            });
        }

        this.gameOverScreen.style.display = 'flex';
        document.exitPointerLock?.();
    }

    hideGameOver() {
        this.gameOverScreen.style.display = 'none';
    }

    showLifeLost() {
        this.lifeLostSplash.style.opacity = '1';
        this.lifeLostSplash.style.transform = 'translate(-50%, -50%) scale(1.2)';
        setTimeout(() => {
            this.lifeLostSplash.style.opacity = '0';
            this.lifeLostSplash.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 1500);
    }

    showMagicUnlocked() {
        this.magicUnlockedSplash.style.opacity = '1';
        this.magicUnlockedSplash.style.transform = 'translate(-50%, -50%) scale(1.1)';
        this.fireButton.style.display = 'block'; 
        setTimeout(() => {
            this.magicUnlockedSplash.style.opacity = '0';
            this.magicUnlockedSplash.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 3000);
    }

    showStatus(msg) {
        this.statusMessage.innerHTML = msg;
        this.statusMessage.style.opacity = '1';
        this.statusMessage.style.transform = 'translate(-50%, -20px)';
        setTimeout(() => {
            this.statusMessage.style.opacity = '0';
            this.statusMessage.style.transform = 'translate(-50%, 0)';
        }, 2000);
    }
}
