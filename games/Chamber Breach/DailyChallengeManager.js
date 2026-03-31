export class DailyChallengeManager {
    constructor(game) {
        this.game = game;
        this.challenges = [
            { id: 'kills', text: 'NEUTRALIZE {goal} HOSTILE UNITS.', goal: 30, type: 'count' },
            { id: 'cores', text: 'RECOVER {goal} TECH CORES FROM CHAMBERS.', goal: 5, type: 'count' },
            { id: 'scrap', text: 'COLLECT {goal} SCRAP FROM SCRAPPED UNITS.', goal: 500, type: 'count' },
            { id: 'headshots', text: 'PERFORM {goal} PRECISION CRITICAL HITS.', goal: 15, type: 'count' },
            { id: 'room', text: 'REACH CHAMBER {goal} IN A SINGLE RUN.', goal: 20, type: 'max' },
            { id: 'streak', text: 'ACHIEVE A NEURAL CHAIN OF {goal}x.', goal: 10, type: 'max' }
        ];
        
        this.currentChallenge = null;
        this.progress = 0;
        this.isCompleted = false;
        this._saveScheduled = false;
        this._hudDirty = true;
        
        this.hud = document.getElementById('daily-challenge-hud');
        this.textEl = document.getElementById('daily-challenge-text');
        this.progressEl = document.getElementById('daily-challenge-progress');
        
        this.init();
    }

    init() {
        const today = new Date().toDateString();
        const savedDate = localStorage.getItem('meridian_daily_date');
        const savedChallenge = localStorage.getItem('meridian_daily_challenge');
        const savedProgress = localStorage.getItem('meridian_daily_progress');
        const savedCompleted = localStorage.getItem('meridian_daily_completed');
        
        if (savedDate !== today || !savedChallenge) {
            // New day, new challenge
            const index = Math.floor(Math.random() * this.challenges.length);
            this.currentChallenge = { ...this.challenges[index] };
            this.progress = 0;
            this.isCompleted = false;
            
            localStorage.setItem('meridian_daily_date', today);
            localStorage.setItem('meridian_daily_challenge', JSON.stringify(this.currentChallenge));
            localStorage.setItem('meridian_daily_progress', '0');
            localStorage.setItem('meridian_daily_completed', 'false');
        } else {
            // Resume today's challenge
            this.currentChallenge = JSON.parse(savedChallenge);
            this.progress = parseInt(savedProgress || '0');
            this.isCompleted = savedCompleted === 'true';
        }
        
        this.updateHUD();
    }

    track(type, amount = 1) {
        if (!this.currentChallenge || this.isCompleted) return;
        
        if (this.currentChallenge.id === type) {
            if (this.currentChallenge.type === 'count') {
                this.progress += amount;
            } else if (this.currentChallenge.type === 'max') {
                this.progress = Math.max(this.progress, amount);
            }
            
            if (this.progress >= this.currentChallenge.goal) {
                this.complete();
            } else {
                this.save();
                this._hudDirty = true;
            }
        }
    }

    complete() {
        this.isCompleted = true;
        this.progress = this.currentChallenge.goal;
        this.save();
        this._hudDirty = true;
        
        // Reward: 500 Meta Credits
        if (this.game.metaCredits !== undefined) {
            this.game.metaCredits += 500;
            this.game.saveMetaState();
            this.game.showProgressionMessage("DAILY CHALLENGE COMPLETED: +500 META-CREDITS");
            
            if (this.game.successSynth) {
                this.game.successSynth.triggerAttackRelease("C5", "8n");
                this.game.successSynth.triggerAttackRelease("E5", "8n", "+8n");
                this.game.successSynth.triggerAttackRelease("G5", "4n", "+4n");
            }
        }
    }

    save() {
        if (this._saveScheduled) return;
        this._saveScheduled = true;

        setTimeout(() => {
            localStorage.setItem('meridian_daily_progress', this.progress.toString());
            localStorage.setItem('meridian_daily_completed', this.isCompleted.toString());
            this._saveScheduled = false;
        }, 50);
    }

    update(deltaTime) {
        if (this._hudDirty) {
            this.updateHUD();
            this._hudDirty = false;
        }
    }

    updateHUD() {
        if (!this.hud || !this.currentChallenge) return;
        
        if (this.game.gameState === 'PLAYING') {
            this.hud.style.display = 'block';
        } else {
            this.hud.style.display = 'none';
        }

        const goalText = this.currentChallenge.text.replace('{goal}', this.currentChallenge.goal);
        this.textEl.innerText = goalText;
        
        if (this.isCompleted) {
            this.progressEl.innerText = 'STATUS: COMPLETED [LINK SECURED]';
            this.progressEl.style.color = '#ffff00';
            this.hud.style.borderColor = '#ffff00';
        } else {
            this.progressEl.innerText = `PROGRESS: ${this.progress} / ${this.currentChallenge.goal}`;
            this.progressEl.style.color = '#00ffaa';
            this.hud.style.borderColor = 'rgba(0, 208, 255, 0.2)';
        }
    }
}
