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
        this._challengeTextTemplate = '';
        
        this.hud = document.getElementById('daily-challenge-hud');
        this.textEl = document.getElementById('daily-challenge-text');
        this.progressEl = document.getElementById('daily-challenge-progress');
        
        this.init();
    }

    init() {
        let savedDate = null;
        let savedChallenge = null;
        let savedProgress = null;
        let savedCompleted = null;

        try {
            savedDate = localStorage.getItem('meridian_daily_date');
            savedChallenge = localStorage.getItem('meridian_daily_challenge');
            savedProgress = localStorage.getItem('meridian_daily_progress');
            savedCompleted = localStorage.getItem('meridian_daily_completed');
        } catch (error) {
            savedDate = null;
            savedChallenge = null;
            savedProgress = null;
            savedCompleted = null;
        }
        
        const today = new Date().toDateString();
        if (savedDate !== today || !savedChallenge) {
            const index = Math.floor(Math.random() * this.challenges.length);
            this.currentChallenge = { ...this.challenges[index] };
            this._challengeTextTemplate = this.currentChallenge.text;
            this.progress = 0;
            this.isCompleted = false;
            
            this.save(true);
        } else {
            this.currentChallenge = JSON.parse(savedChallenge);
            this._challengeTextTemplate = this.currentChallenge.text;
            this.progress = parseInt(savedProgress || '0', 10);
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

    save(force = false) {
        if (this._saveScheduled && !force) return;
        if (!force) this._saveScheduled = true;

        const writeState = () => {
            try {
                localStorage.setItem('meridian_daily_date', new Date().toDateString());
                localStorage.setItem('meridian_daily_challenge', JSON.stringify(this.currentChallenge));
                localStorage.setItem('meridian_daily_progress', this.progress.toString());
                localStorage.setItem('meridian_daily_completed', this.isCompleted.toString());
            } catch (error) {
                // Ignore storage failures
            }
            this._saveScheduled = false;
        };

        if (force) {
            writeState();
            return;
        }

        setTimeout(writeState, 50);
    }

    update(deltaTime) {
        if (this._hudDirty) {
            this.updateHUD();
            this._hudDirty = false;
        }
    }

    updateHUD() {
        if (!this.hud || !this.currentChallenge || !this.textEl || !this.progressEl) return;
        
        this.hud.style.display = this.game.gameState === 'PLAYING' ? 'block' : 'none';

        const goalText = this._challengeTextTemplate.replace('{goal}', this.currentChallenge.goal);
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
