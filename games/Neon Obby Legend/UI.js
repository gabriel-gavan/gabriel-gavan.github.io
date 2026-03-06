import { CONFIG } from './config.js';

export class UI {
    constructor(onRestart, onSelectCampaign, onGoHome) {
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none';
        this.container.style.fontFamily = "'Orbitron', sans-serif";
        this.container.style.color = 'white';
        this.container.style.zIndex = '2000';
        document.body.appendChild(this.container);

        // --- NEW TITLE SCREEN ---
        this.titleScreen = document.createElement('div');
        this.titleScreen.style.position = 'absolute';
        this.titleScreen.style.top = '0';
        this.titleScreen.style.left = '0';
        this.titleScreen.style.width = '100%';
        this.titleScreen.style.height = '100%';
        this.titleScreen.style.backgroundImage = `url(${CONFIG.HERO_BACKGROUND_URL})`;
        this.titleScreen.style.backgroundSize = 'cover';
        this.titleScreen.style.backgroundPosition = 'center';
        this.titleScreen.style.display = 'flex';
        this.titleScreen.style.flexDirection = 'column';
        this.titleScreen.style.alignItems = 'center';
        this.titleScreen.style.justifyContent = 'center';
        this.titleScreen.style.pointerEvents = 'auto';
        this.titleScreen.style.zIndex = '150';
        this.container.appendChild(this.titleScreen);

        const mainTitle = document.createElement('h1');
        mainTitle.style.fontSize = 'min(12vw, 72px)';
        mainTitle.style.color = '#00ffff';
        mainTitle.style.textShadow = '0 0 30px #00ffff';
        mainTitle.style.marginBottom = '60px';
        mainTitle.style.textAlign = 'center';
        mainTitle.style.padding = '0 20px';
        mainTitle.innerText = 'NEON OBBY LEGEND';
        this.titleScreen.appendChild(mainTitle);

        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.flexDirection = 'column';
        btnContainer.style.gap = '20px';
        this.titleScreen.appendChild(btnContainer);

        const startBtn = document.createElement('button');
        startBtn.innerText = 'START ADVENTURE';
        this.setupMenuButton(startBtn, '#00ff00');
        startBtn.style.width = '300px';
        startBtn.onclick = () => {
            this.titleScreen.style.display = 'none';
            this.campaignMenu.style.display = 'flex';
        };
        btnContainer.appendChild(startBtn);

        const hubBtn = document.createElement('button');
        hubBtn.innerText = 'BACK TO HUB';
        this.setupMenuButton(hubBtn, '#ff00ff');
        hubBtn.style.width = '300px';
        hubBtn.onclick = () => {
            window.location.href = '/index.html';
        };
        btnContainer.appendChild(hubBtn);

        // --- CAMPAIGN MENU ---
        this.campaignMenu = document.createElement('div');
        this.campaignMenu.style.position = 'absolute';
        this.campaignMenu.style.top = '0';
        this.campaignMenu.style.left = '0';
        this.campaignMenu.style.width = '100%';
        this.campaignMenu.style.height = '100%';
        this.campaignMenu.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${CONFIG.MENU_BACKGROUND_URL})`;
        this.campaignMenu.style.backgroundSize = 'cover';
        this.campaignMenu.style.backgroundPosition = 'center';
        this.campaignMenu.style.display = 'none';
        this.campaignMenu.style.flexDirection = 'column';
        this.campaignMenu.style.alignItems = 'center';
        this.campaignMenu.style.padding = '60px 20px';
        this.campaignMenu.style.overflowY = 'auto';
        this.campaignMenu.style.pointerEvents = 'auto';
        this.campaignMenu.style.zIndex = '100';
        this.container.appendChild(this.campaignMenu);

        this.title = document.createElement('h1');
        this.title.style.fontSize = 'min(10vw, 48px)';
        this.title.style.color = '#00ffff';
        this.title.style.textShadow = '0 0 20px #00ffff';
        this.title.style.textAlign = 'center';
        this.title.style.marginBottom = '20px';
        this.title.innerText = 'SELECT CAMPAIGN';
        this.campaignMenu.appendChild(this.title);

        this.campaignGrid = document.createElement('div');
        this.campaignGrid.style.display = 'flex';
        this.campaignGrid.style.flexWrap = 'wrap';
        this.campaignGrid.style.gap = '20px';
        this.campaignGrid.style.marginTop = '20px';
        this.campaignGrid.style.width = '100%';
        this.campaignGrid.style.maxWidth = '1000px';
        this.campaignGrid.style.justifyContent = 'center';
        this.campaignGrid.style.padding = '10px';
        this.campaignGrid.style.boxSizing = 'border-box';
        this.campaignMenu.appendChild(this.campaignGrid);

        const campaignBackBtn = document.createElement('button');
        campaignBackBtn.innerText = 'BACK';
        this.setupMenuButton(campaignBackBtn, '#888');
        campaignBackBtn.style.marginTop = '40px';
        campaignBackBtn.onclick = () => {
            this.campaignMenu.style.display = 'none';
            this.titleScreen.style.display = 'flex';
        };
        this.campaignMenu.appendChild(campaignBackBtn);

        // Level Menu Overlay
        this.levelMenu = document.createElement('div');
        this.levelMenu.style.position = 'absolute';
        this.levelMenu.style.top = '0';
        this.levelMenu.style.left = '0';
        this.levelMenu.style.width = '100%';
        this.levelMenu.style.height = '100%';
        this.levelMenu.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)), url(${CONFIG.MENU_BACKGROUND_URL})`;
        this.levelMenu.style.backgroundSize = 'cover';
        this.levelMenu.style.backgroundPosition = 'center';
        this.levelMenu.style.display = 'none';
        this.levelMenu.style.flexDirection = 'column';
        this.levelMenu.style.alignItems = 'center';
        this.levelMenu.style.padding = '40px';
        this.levelMenu.style.overflowY = 'auto';
        this.levelMenu.style.pointerEvents = 'auto';
        this.levelMenu.style.zIndex = '110';
        this.container.appendChild(this.levelMenu);

        this.levelMenuTitle = document.createElement('h2');
        this.levelMenuTitle.style.fontSize = '32px';
        this.levelMenuTitle.style.color = '#00ffff';
        this.levelMenuTitle.style.marginBottom = '20px';
        this.levelMenu.appendChild(this.levelMenuTitle);

        this.levelGrid = document.createElement('div');
        this.levelGrid.style.display = 'grid';
        this.levelGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(70px, 1fr))';
        this.levelGrid.style.gap = '15px';
        this.levelGrid.style.width = '100%';
        this.levelGrid.style.maxWidth = '900px';
        this.levelGrid.style.marginBottom = '30px';
        this.levelGrid.style.justifyItems = 'center';
        this.levelMenu.appendChild(this.levelGrid);

        this.backBtn = document.createElement('button');
        this.backBtn.innerText = 'BACK TO CAMPAIGNS';
        this.backBtn.style.padding = '10px 20px';
        this.backBtn.style.backgroundColor = '#444';
        this.backBtn.style.color = 'white';
        this.backBtn.style.border = 'none';
        this.backBtn.style.borderRadius = '5px';
        this.backBtn.style.cursor = 'pointer';
        this.backBtn.style.fontFamily = 'inherit';
        this.levelMenu.appendChild(this.backBtn);

        this.hud = document.createElement('div');
        this.hud.style.position = 'absolute';
        this.hud.style.top = '20px';
        this.hud.style.left = '20px';
        this.hud.style.fontSize = '24px';
        this.hud.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        this.container.appendChild(this.hud);

        // Home Button in HUD
        this.homeBtn = document.createElement('button');
        this.homeBtn.innerText = '🏠 HOME';
        this.homeBtn.style.position = 'absolute';
        this.homeBtn.style.top = '20px';
        this.homeBtn.style.right = '240px'; // To avoid overlap with campaign panel
        this.homeBtn.style.padding = '10px 15px';
        this.homeBtn.style.backgroundColor = 'rgba(0, 255, 255, 0.2)';
        this.homeBtn.style.color = '#00ffff';
        this.homeBtn.style.border = '1px solid #00ffff';
        this.homeBtn.style.borderRadius = '8px';
        this.homeBtn.style.cursor = 'pointer';
        this.homeBtn.style.fontFamily = 'inherit';
        this.homeBtn.style.fontSize = '14px';
        this.homeBtn.style.pointerEvents = 'auto';
        this.homeBtn.style.transition = 'all 0.2s';
        this.homeBtn.onmouseover = () => this.homeBtn.style.backgroundColor = 'rgba(0, 255, 255, 0.4)';
        this.homeBtn.onmouseout = () => this.homeBtn.style.backgroundColor = 'rgba(0, 255, 255, 0.2)';
        this.container.appendChild(this.homeBtn);

        this.stats = document.createElement('div');
        this.stats.style.position = 'absolute';
        this.stats.style.top = '60px';
        this.stats.style.left = '20px';
        this.stats.style.fontSize = '18px';
        this.stats.style.color = '#ffff00';
        this.container.appendChild(this.stats);

        // Health Bar
        this.healthContainer = document.createElement('div');
        this.healthContainer.style.position = 'absolute';
        this.healthContainer.style.bottom = '40px';
        this.healthContainer.style.left = '50%';
        this.healthContainer.style.transform = 'translateX(-50%)';
        this.healthContainer.style.width = '300px';
        this.healthContainer.style.height = '20px';
        this.healthContainer.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
        this.healthContainer.style.borderRadius = '10px';
        this.healthContainer.style.border = '2px solid rgba(255, 255, 255, 0.5)';
        this.healthContainer.style.overflow = 'hidden';
        this.container.appendChild(this.healthContainer);

        this.healthBar = document.createElement('div');
        this.healthBar.style.width = '100%';
        this.healthBar.style.height = '100%';
        this.healthBar.style.backgroundColor = '#ff0000';
        this.healthBar.style.transition = 'width 0.2s ease-out';
        this.healthContainer.appendChild(this.healthBar);

        // Level Progress Bar (Top of screen)
        this.levelProgressContainer = document.createElement('div');
        this.levelProgressContainer.style.position = 'absolute';
        this.levelProgressContainer.style.top = '0';
        this.levelProgressContainer.style.left = '0';
        this.levelProgressContainer.style.width = '100%';
        this.levelProgressContainer.style.height = '6px';
        this.levelProgressContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        this.container.appendChild(this.levelProgressContainer);

        this.levelProgressBar = document.createElement('div');
        this.levelProgressBar.style.width = '0%';
        this.levelProgressBar.style.height = '100%';
        this.levelProgressBar.style.backgroundColor = '#00ffff';
        this.levelProgressBar.style.boxShadow = '0 0 10px #00ffff';
        this.levelProgressBar.style.transition = 'width 0.3s ease-out';
        this.levelProgressContainer.appendChild(this.levelProgressBar);

        this.controlsInfo = document.createElement('div');
        this.controlsInfo.style.position = 'absolute';
        this.controlsInfo.style.bottom = '120px';
        this.controlsInfo.style.left = '50%';
        this.controlsInfo.style.transform = 'translateX(-50%)';
        this.controlsInfo.style.fontSize = '14px';
        this.controlsInfo.style.textAlign = 'center';
        this.controlsInfo.style.opacity = '0.7';
        this.controlsInfo.innerHTML = 'WASD/Joystick: Move • SPACE/Button: Jump • Drag: Rotate Camera';
        this.container.appendChild(this.controlsInfo);

        this.msg = document.createElement('div');
        this.msg.style.position = 'absolute';
        this.msg.style.top = '50%';
        this.msg.style.left = '50%';
        this.msg.style.transform = 'translate(-50%, -50%)';
        this.msg.style.fontSize = '48px';
        this.msg.style.textAlign = 'center';
        this.msg.style.display = 'none';
        this.msg.style.pointerEvents = 'auto';
        this.msg.style.backgroundColor = 'rgba(0,0,0,0.85)';
        this.msg.style.padding = '40px';
        this.msg.style.borderRadius = '20px';
        this.msg.style.border = '2px solid #00ffff';
        this.container.appendChild(this.msg);

        // Death Popup
        this.deathPopup = document.createElement('div');
        this.deathPopup.style.position = 'absolute';
        this.deathPopup.style.top = '50%';
        this.deathPopup.style.left = '50%';
        this.deathPopup.style.transform = 'translate(-50%, -50%) scale(0)';
        this.deathPopup.style.fontSize = '64px';
        this.deathPopup.style.fontWeight = 'bold';
        this.deathPopup.style.color = '#ff0000';
        this.deathPopup.style.textShadow = '0 0 20px #ff0000, 0 0 40px #000';
        this.deathPopup.style.zIndex = '200';
        this.deathPopup.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s';
        this.deathPopup.style.pointerEvents = 'none';
        this.deathPopup.style.opacity = '0';
        this.deathPopup.innerText = 'YOU DIED';
        this.container.appendChild(this.deathPopup);

        // Campaign Progress Overlay
        this.campaignPanel = document.createElement('div');
        this.campaignPanel.style.position = 'absolute';
        this.campaignPanel.style.top = '20px';
        this.campaignPanel.style.right = '20px';
        this.campaignPanel.style.width = '200px';
        this.campaignPanel.style.padding = '15px';
        this.campaignPanel.style.background = 'rgba(0,0,0,0.6)';
        this.campaignPanel.style.borderRadius = '10px';
        this.campaignPanel.style.border = '1px solid rgba(0,255,255,0.3)';
        this.campaignPanel.style.fontSize = '12px';
        this.container.appendChild(this.campaignPanel);
        
        this.onRestart = onRestart;
        this.onSelectCampaign = onSelectCampaign;
        this.onGoHome = onGoHome;

        this.backBtn.onclick = () => {
            this.levelMenu.style.display = 'none';
            this.campaignMenu.style.display = 'flex';
        };

        this.homeBtn.onclick = () => {
            this.onGoHome();
        };

        this.updateCampaign([]);
    }

    setupMenuButton(btn, color) {
        btn.style.padding = '15px 40px';
        btn.style.fontSize = '24px';
        btn.style.cursor = 'pointer';
        btn.style.pointerEvents = 'auto'; // Ensure interactive
        btn.style.backgroundColor = 'rgba(0,0,0,0.6)';
        btn.style.color = color;
        btn.style.border = `2px solid ${color}`;
        btn.style.borderRadius = '15px';
        btn.style.fontFamily = 'inherit';
        btn.style.fontWeight = 'bold';
        btn.style.transition = 'all 0.3s ease';
        btn.style.textShadow = `0 0 10px ${color}`;
        btn.style.boxShadow = `0 0 15px ${color}44`;

        btn.onmouseover = () => {
            btn.style.backgroundColor = color;
            btn.style.color = '#000';
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = `0 0 30px ${color}88`;
        };
        btn.onmouseout = () => {
            btn.style.backgroundColor = 'rgba(0,0,0,0.6)';
            btn.style.color = color;
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = `0 0 15px ${color}44`;
        };
    }

    showCampaignMenu(campaigns, unlockedCampaignIds) {
        this.titleScreen.style.display = 'none';
        this.campaignMenu.style.display = 'flex';
        this.campaignMenu.scrollTop = 0;
        this.levelMenu.style.display = 'none';
        this.hud.style.display = 'none';
        this.homeBtn.style.display = 'none';
        this.stats.style.display = 'none';
        this.levelProgressContainer.style.display = 'none';
        this.campaignPanel.style.display = 'none';
        this.healthContainer.style.display = 'none';
        this.controlsInfo.style.display = 'none';
        this.campaignGrid.innerHTML = '';

        campaigns.forEach(c => {
            const isUnlocked = unlockedCampaignIds.includes(c.id);
            const card = document.createElement('div');
            card.style.flex = '0 1 220px'; // Don't grow, can shrink, basis 220px
            card.style.padding = '20px';
            card.style.borderRadius = '15px';
            card.style.border = `2px solid ${isUnlocked ? '#' + c.color.toString(16).padStart(6, '0') : '#333'}`;
            card.style.backgroundColor = isUnlocked ? 'rgba(0,0,0,0.8)' : 'rgba(30,30,30,0.9)';
            card.style.cursor = isUnlocked ? 'pointer' : 'default';
            card.style.opacity = isUnlocked ? '1' : '0.6';
            card.style.transition = 'all 0.3s ease';
            card.style.textAlign = 'center';
            card.style.boxShadow = isUnlocked ? `0 0 15px #${c.color.toString(16).padStart(6, '0')}44` : 'none';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.justifyContent = 'space-between';
            card.style.minHeight = '150px';
            card.style.margin = '0'; // Let flex gap handle spacing
            card.style.boxSizing = 'border-box';

            card.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px; color: ${isUnlocked ? '#' + c.color.toString(16).padStart(6, '0') : '#666'}">${c.name}</div>
                <div style="font-size: 10px; color: #aaa; line-height: 1.3; height: 3.5em; overflow: hidden;">${c.description}</div>
                <div style="margin-top: 15px; font-size: 12px; font-weight: bold; letter-spacing: 1.5px; color: ${isUnlocked ? '#0f0' : '#f44'}">
                    ${isUnlocked ? 'SELECT' : 'LOCKED'}
                </div>
            `;

            if (isUnlocked) {
                card.onmouseover = () => { 
                    card.style.transform = 'translateY(-10px)'; 
                    card.style.backgroundColor = 'rgba(20,20,20,0.95)';
                    card.style.boxShadow = `0 10px 25px #${c.color.toString(16).padStart(6, '0')}88`;
                };
                card.onmouseout = () => { 
                    card.style.transform = 'translateY(0)'; 
                    card.style.backgroundColor = 'rgba(0,0,0,0.8)';
                    card.style.boxShadow = `0 0 15px #${c.color.toString(16).padStart(6, '0')}44`;
                };
                card.onclick = () => {
                    this.onSelectCampaign(c.id);
                };
            }

            this.campaignGrid.appendChild(card);
        });
    }

    showLevelMenu(campaignId, campaignName, starsData, onSelectLevel) {
        this.campaignMenu.style.display = 'none';
        this.levelMenu.style.display = 'flex';
        this.homeBtn.style.display = 'none';
        this.levelMenuTitle.innerText = campaignName.toUpperCase();
        this.levelGrid.innerHTML = '';

        // Calculate progress
        const totalStars = Object.values(starsData).reduce((a, b) => a + b, 0);
        const completedLevels = Object.keys(starsData).length;
        const progressPct = (completedLevels / 50) * 100;

        // Progress Header
        const progressHeader = document.createElement('div');
        progressHeader.style.marginBottom = '30px';
        progressHeader.style.textAlign = 'center';
        progressHeader.innerHTML = `
            <div style="font-size: 14px; color: #aaa; margin-bottom: 8px;">CAMPAIGN PROGRESS: ${progressPct.toFixed(0)}%</div>
            <div style="font-size: 24px; color: #ffd700;">${totalStars} / 150 TOTAL STARS</div>
        `;
        this.levelGrid.parentNode.insertBefore(progressHeader, this.levelGrid);

        for (let i = 0; i < 50; i++) {
            const stars = starsData[i] || 0;
            const isUnlocked = true; // All levels in an unlocked campaign are accessible
            
            const btn = document.createElement('div');
            btn.style.width = '65px';
            btn.style.height = '65px';
            btn.style.display = 'flex';
            btn.style.flexDirection = 'column';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.background = isUnlocked ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.4)';
            btn.style.borderRadius = '12px';
            btn.style.cursor = isUnlocked ? 'pointer' : 'not-allowed';
            btn.style.transition = 'all 0.2s';
            btn.style.border = isUnlocked ? '1px solid rgba(0,255,255,0.2)' : '1px solid rgba(255,255,255,0.05)';
            btn.style.opacity = isUnlocked ? '1' : '0.3';

            btn.innerHTML = `
                <div style="font-size: 16px; font-weight: bold; color: ${isUnlocked ? '#fff' : '#666'}">${i + 1}</div>
                <div style="font-size: 11px; color: #ffd700; margin-top: 4px;">
                    ${isUnlocked ? ('★'.repeat(stars) + '☆'.repeat(3 - stars)) : '🔒'}
                </div>
            `;

            if (isUnlocked) {
                btn.onmouseover = () => {
                    btn.style.background = 'rgba(0,255,255,0.15)';
                    btn.style.border = '1px solid #00ffff';
                    btn.style.transform = 'scale(1.05)';
                    btn.style.boxShadow = '0 0 15px rgba(0,255,255,0.3)';
                };
                btn.onmouseout = () => {
                    btn.style.background = 'rgba(255,255,255,0.08)';
                    btn.style.border = '1px solid rgba(0,255,255,0.2)';
                    btn.style.transform = 'scale(1)';
                    btn.style.boxShadow = 'none';
                };
                btn.onclick = () => {
                    // Clean up progress header before starting
                    progressHeader.remove();
                    this.levelMenu.style.display = 'none';
                    this.hud.style.display = 'block';
                    this.homeBtn.style.display = 'block';
                    this.stats.style.display = 'block';
                    this.levelProgressContainer.style.display = 'block';
                    this.campaignPanel.style.display = 'block';
                    this.healthContainer.style.display = 'block';
                    this.controlsInfo.style.display = 'block';
                    onSelectLevel(i);
                };
            }

            this.levelGrid.appendChild(btn);
        }

        this.backBtn.onclick = () => {
            progressHeader.remove();
            this.levelMenu.style.display = 'none';
            this.mainMenu.style.display = 'flex';
        };
    }

    updateCampaign(unlockedPrizes) {
        let html = '<div style="color: #00ffff; font-weight: bold; margin-bottom: 8px; text-align: center;">CAMPAIGN PRIZES</div>';
        const milestones = [
            { level: 5, name: 'Neon Glow', id: 'neon_glow' },
            { level: 15, name: 'Speed Trail', id: 'trail' },
            { level: 30, name: 'Gold Crown', id: 'crown' },
            { level: 50, name: 'Legend Cape', id: 'legend_cape' }
        ];

        milestones.forEach(m => {
            const isUnlocked = unlockedPrizes.includes(m.id);
            const color = isUnlocked ? '#00ff00' : '#888';
            const icon = isUnlocked ? '✓' : '○';
            html += `<div style="display: flex; justify-content: space-between; color: ${color}; margin-bottom: 4px;">
                <span>${icon} LVL ${m.level}</span>
                <span>${m.name}</span>
            </div>`;
        });
        this.campaignPanel.innerHTML = html;
    }

    showTitleScreen() {
        this.titleScreen.style.display = 'flex';
        this.titleScreen.style.pointerEvents = 'auto'; // Explicitly set for interaction
        this.campaignMenu.style.display = 'none';
        this.levelMenu.style.display = 'none';
        this.hud.style.display = 'none';
        this.homeBtn.style.display = 'none';
        this.stats.style.display = 'none';
        this.levelProgressContainer.style.display = 'none';
        this.campaignPanel.style.display = 'none';
        this.healthContainer.style.display = 'none';
        this.controlsInfo.style.display = 'none';
    }

    showPrizeUnlock(prize) {
        const unlockMsg = document.createElement('div');
        unlockMsg.style.position = 'absolute';
        unlockMsg.style.bottom = '200px';
        unlockMsg.style.left = '50%';
        unlockMsg.style.transform = 'translateX(-50%) scale(0)';
        unlockMsg.style.padding = '20px 40px';
        unlockMsg.style.background = 'rgba(255, 215, 0, 0.9)';
        unlockMsg.style.color = 'black';
        unlockMsg.style.borderRadius = '50px';
        unlockMsg.style.fontSize = '24px';
        unlockMsg.style.fontWeight = 'bold';
        unlockMsg.style.boxShadow = '0 0 20px #ffd700';
        unlockMsg.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        unlockMsg.innerHTML = `🏆 UNLOCKED: ${prize.name}! <div style="font-size: 14px; margin-top: 5px;">${prize.reward}</div>`;
        this.container.appendChild(unlockMsg);

        requestAnimationFrame(() => {
            unlockMsg.style.transform = 'translateX(-50%) scale(1)';
        });

        setTimeout(() => {
            unlockMsg.style.transform = 'translateX(-50%) scale(0)';
            setTimeout(() => unlockMsg.remove(), 500);
        }, 4000);
    }

    showDeath() {
        this.deathPopup.style.opacity = '1';
        this.deathPopup.style.transform = 'translate(-50%, -50%) scale(1)';
        
        setTimeout(() => {
            this.deathPopup.style.opacity = '0';
            this.deathPopup.style.transform = 'translate(-50%, -50%) scale(2)';
            setTimeout(() => {
                this.deathPopup.style.transform = 'translate(-50%, -50%) scale(0)';
            }, 300);
        }, 1200);
    }

    showCheckpoint() {
        const cpMsg = document.createElement('div');
        cpMsg.style.position = 'absolute';
        cpMsg.style.bottom = '150px';
        cpMsg.style.left = '50%';
        cpMsg.style.transform = 'translateX(-50%) translateY(20px)';
        cpMsg.style.padding = '10px 30px';
        cpMsg.style.background = 'rgba(0, 255, 0, 0.8)';
        cpMsg.style.color = 'black';
        cpMsg.style.borderRadius = '30px';
        cpMsg.style.fontSize = '18px';
        cpMsg.style.fontWeight = 'bold';
        cpMsg.style.boxShadow = '0 0 15px #00ff00';
        cpMsg.style.transition = 'all 0.4s ease';
        cpMsg.style.opacity = '0';
        cpMsg.innerText = 'CHECKPOINT REACHED';
        this.container.appendChild(cpMsg);

        requestAnimationFrame(() => {
            cpMsg.style.opacity = '1';
            cpMsg.style.transform = 'translateX(-50%) translateY(0)';
        });

        setTimeout(() => {
            cpMsg.style.opacity = '0';
            cpMsg.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => cpMsg.remove(), 400);
        }, 2000);
    }

    showWin(level, time, totalCoins, stars, deaths, onLevelSelect) {
        this.msg.innerHTML = `
            <div style="font-size: 32px; color: #ffd700; margin-bottom: 20px; text-shadow: 0 0 10px #ffd700;">LEVEL ${level} COMPLETE</div>
            
            <div id="stars-container" style="font-size: 64px; height: 80px; display: flex; justify-content: center; gap: 15px; margin-bottom: 25px;">
                <span class="win-star" style="opacity: 0; transform: scale(3); display: inline-block; transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); color: #444;">★</span>
                <span class="win-star" style="opacity: 0; transform: scale(3); display: inline-block; transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); color: #444;">★</span>
                <span class="win-star" style="opacity: 0; transform: scale(3); display: inline-block; transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); color: #444;">★</span>
            </div>

            <div id="win-stats" style="opacity: 0; transform: translateY(20px); transition: all 0.5s ease; display: flex; flex-direction: column; gap: 15px; margin-bottom: 40px; width: 100%; max-width: 300px; margin-left: auto; margin-right: auto; text-align: left;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">
                    <span style="color: #aaa;">TIME</span>
                    <span style="color: #00ffff; font-weight: bold;">${time.toFixed(2)}s</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">
                    <span style="color: #aaa;">COINS</span>
                    <span style="color: #ffd700; font-weight: bold;">${totalCoins}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">
                    <span style="color: #aaa;">DEATHS</span>
                    <span style="color: #ff0000; font-weight: bold;">${deaths}</span>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 15px; width: 100%; align-items: center; opacity: 0; transform: translateY(20px); transition: all 0.5s ease 0.4s;" id="win-actions">
                <button id="next-btn" style="
                    width: 280px;
                    padding: 15px;
                    font-size: 20px;
                    cursor: pointer;
                    background: #00ff00;
                    color: black;
                    border: none;
                    border-radius: 12px;
                    font-family: inherit;
                    font-weight: bold;
                    transition: all 0.2s;
                    box-shadow: 0 0 15px rgba(0,255,0,0.4);
                ">NEXT LEVEL</button>

                <div style="display: flex; gap: 15px; width: 280px;">
                    <button id="restart-btn" style="
                        flex: 1;
                        padding: 12px;
                        font-size: 14px;
                        cursor: pointer;
                        background: rgba(255,255,255,0.1);
                        color: white;
                        border: 1px solid rgba(255,255,255,0.3);
                        border-radius: 8px;
                        font-family: inherit;
                        transition: all 0.2s;
                    ">RETRY</button>

                    <button id="select-btn" style="
                        flex: 1;
                        padding: 12px;
                        font-size: 14px;
                        cursor: pointer;
                        background: rgba(255,255,255,0.1);
                        color: white;
                        border: 1px solid rgba(255,255,255,0.3);
                        border-radius: 8px;
                        font-family: inherit;
                        transition: all 0.2s;
                    ">MENU</button>
                </div>
            </div>
        `;
        
        this.msg.style.display = 'block';
        this.msg.style.width = '400px';
        this.msg.style.padding = '50px';
        this.msg.style.textAlign = 'center';
        
        const nextBtn = document.getElementById('next-btn');
        const restartBtn = document.getElementById('restart-btn');
        const selectBtn = document.getElementById('select-btn');

        nextBtn.onclick = () => {
            this.msg.style.display = 'none';
            this.onRestart();
        };

        restartBtn.onclick = () => {
            this.msg.style.display = 'none';
            // Simple logic: re-select the current level
            onLevelSelect(level - 1);
        };

        selectBtn.onclick = () => {
            this.msg.style.display = 'none';
            onLevelSelect();
        };

        // Trigger animations
        setTimeout(() => {
            const winStars = document.querySelectorAll('.win-star');
            const winStats = document.getElementById('win-stats');
            const winActions = document.getElementById('win-actions');

            winStats.style.opacity = '1';
            winStats.style.transform = 'translateY(0)';
            winActions.style.opacity = '1';
            winActions.style.transform = 'translateY(0)';

            winStars.forEach((star, i) => {
                setTimeout(() => {
                    star.style.opacity = '1';
                    star.style.transform = 'scale(1)';
                    if (i < stars) {
                        star.style.color = '#ffd700';
                        star.style.textShadow = '0 0 20px #ffd700';
                    }
                }, i * 300);
            });
        }, 100);
    }

    update(level, time, coins, speedTimer, health, invincibilityTimer, currentSegment, totalSegments, progressPct) {
        const speedText = speedTimer > 0 ? ` <span style="color: #ff4dff;">[SPEED BOOST ${speedTimer.toFixed(1)}s]</span>` : '';
        const invincibilityText = invincibilityTimer > 0 ? ` <span style="color: #00ffff;">[INVINCIBLE ${invincibilityTimer.toFixed(1)}s]</span>` : '';
        this.hud.innerHTML = `LEVEL ${level + 1} / 50 ${speedText}${invincibilityText}`;
        this.stats.innerHTML = `PROGRESS: ${progressPct.toFixed(0)}% (${currentSegment} / ${totalSegments}) • TIME: ${time.toFixed(2)}s • COINS: ${coins}`;
        this.healthBar.style.width = `${health}%`;
        this.healthBar.style.backgroundColor = invincibilityTimer > 0 ? '#00ffff' : '#ff0000';
        this.levelProgressBar.style.width = `${progressPct}%`;
    }
}
