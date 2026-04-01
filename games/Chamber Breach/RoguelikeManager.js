export class RoguelikeManager {
    constructor(game) {
        this.game = game;
        this.player = game.player;
        this.perkManager = game.player.perkManager;
        this.roomsSinceChoice = 0;
        this.choiceRoomInterval = 3; 
        this.isChoiceActive = false;
        
        this.perkScreen = document.getElementById('perk-screen');
        this.perkOptionsContainer = document.getElementById('perk-options');
    }

    update(deltaTime) {
        if (this.game.gameState !== 'PLAYING' || this.isChoiceActive) return;
    }

    showChoice() {
        if (this.isChoiceActive) return;
        this.isChoiceActive = true;
        
        const previousState = this.game.gameState;
        this.game.gameState = 'PERK_SELECTION';
        
        if (this.game.heatVisuals) {
            this.game.heatVisuals.glitchIntensity = 0.3;
        }

        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        const perks = this.perkManager.getRandomPerks(3);
        
        this.perkOptionsContainer.innerHTML = '';
        
        perks.forEach((perk, index) => {
            const card = document.createElement('div');
            const rarity = perk.rarity || 'ELITE';
            card.className = `perk-card rarity-${rarity.toLowerCase()} insane-glow`;
            card.style.animationDelay = `${index * 0.1}s`;
            
            const rarityColor = rarity === 'INSANE' ? '#ff00ff' : (rarity === 'LEGENDARY' ? '#ffaa00' : '#00d0ff');
            
            card.innerHTML = `
                <div class="glow-border" style="box-shadow: 0 0 15px ${rarityColor}"></div>
                <div class="icon">${perk.icon}</div>
                <div class="name" style="color: ${rarityColor}">${perk.name}</div>
                <div class="desc">${perk.description}</div>
                <div class="type">${perk.type}</div>
                <div class="perk-rarity" style="background: ${rarityColor}">${rarity}</div>
            `;
            
            card.addEventListener('click', () => {
                this.selectPerk(perk, previousState);
            });
            
            this.perkOptionsContainer.appendChild(card);
        });

        this.perkScreen.style.display = 'flex';
        this.perkScreen.style.background = 'radial-gradient(circle, rgba(0, 208, 255, 0.2) 0%, rgba(0, 0, 0, 0.95) 100%)';
        
        if (this.game.successSynth) {
            this.game.successSynth.triggerAttackRelease("C3", "2n");
            this.game.successSynth.triggerAttackRelease("G3", "2n", "+8n");
            this.game.successSynth.triggerAttackRelease("C4", "2n", "+4n");
        }
    }

    selectPerk(perk, previousState) {
        this.perkManager.applyPerk(perk.id);
        
        this.perkScreen.style.display = 'none';
        this.isChoiceActive = false;
        this.lastChoiceTime = Date.now();
        
        this.game.gameState = previousState;
        this.game.renderer.domElement.requestPointerLock();
        
        if (this.game.successSynth) {
            this.game.successSynth.triggerAttackRelease("C5", "8n");
        }
        
        this.game.showProgressionMessage(`NEURAL LINK STABILIZED: ${perk.name} INSTALLED`);
    }

    handleChamberClear() {
        this.roomsSinceChoice++;
        if (this.roomsSinceChoice >= this.choiceRoomInterval) {
            this.roomsSinceChoice = 0;
            setTimeout(() => {
                this.showChoice();
            }, 1500);
        }
    }
}