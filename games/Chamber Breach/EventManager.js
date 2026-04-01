export class EventManager {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.lastEventTime = Date.now();
        this.eventInterval = 60000 + Math.random() * 60000; // Every 1-2 minutes
        this.activeEvent = null;
        this.eventTimer = 0;
        this.heartbeatInterval = null;
        this.jammerInterval = null;
        this._uiElement = null;
    }

    update(deltaTime) {
        if (this.game.gameState !== 'PLAYING') return;

        const now = Date.now();
        if (!this.activeEvent && now - this.lastEventTime >= this.eventInterval) {
            this.triggerRandomEvent();
        }

        if (this.activeEvent) {
            this.eventTimer -= deltaTime;
            if (this.eventTimer <= 0) {
                this.endEvent();
            }
        }
    }

    _clearEventTimers() {
        if (this.heartbeatInterval !== null) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.jammerInterval !== null) {
            clearInterval(this.jammerInterval);
            this.jammerInterval = null;
        }
    }

    _getUiElement() {
        if (!this._uiElement) {
            this._uiElement = document.getElementById('ui');
        }
        return this._uiElement;
    }

    triggerRandomEvent() {
        this._clearEventTimers();

        const events = ['BLACKOUT', 'JAMMER', 'SWARM', 'GRAVITY_SURGE', 'BERSERK', 'AMBUSH'];
        const type = events[Math.floor(Math.random() * events.length)];
        
        this.activeEvent = type;
        this.eventTimer = 25 + Math.random() * 20; 
        this.lastEventTime = Date.now();
        this.eventInterval = 60000 + Math.random() * 60000;

        this.game.showProgressionMessage(`CRITICAL SYSTEM EVENT: ${type}`, 6000);
        
        if (this.game.eliteScreech) {
            this.game.eliteScreech.triggerAttackRelease("C3", "1n");
        }
        
        // Initial impact shake
        this.game.shakeAmount += 1.0;

        switch(type) {
            case 'BLACKOUT':
                this.scene.fog.density = 0.25;
                if (this.game.ambientLight) this.game.ambientLight.intensity = 0.05;
                // Cinematic heartbeat
                this.heartbeatInterval = setInterval(() => {
                    if (this.game.successSynth) {
                        this.game.successSynth.triggerAttackRelease("C2", "8n");
                        setTimeout(() => this.game.successSynth.triggerAttackRelease("C2", "8n"), 200);
                    }
                }, 1200);
                break;
            case 'JAMMER': {
                const ui = this._getUiElement();
                if (ui) ui.classList.add('malfunction');
                this.game.heatVisuals.glitchIntensity = 0.8;
                // Periodic glitch sound
                this.jammerInterval = setInterval(() => {
                    if (this.game.hazardHiss) this.game.hazardHiss.triggerAttackRelease("G2", "16n");
                }, 1000);
                break;
            }
            case 'SWARM':
                this.spawnCluster('SENTRY', 12);
                this.game.shakeAmount += 0.5;
                break;
            case 'AMBUSH':
                this.spawnCluster('STALKER', 6);
                if (this.game.eliteScreech) this.game.eliteScreech.triggerAttackRelease("G4", "2n");
                this.game.shakeAmount += 1.5;
                break;
            case 'BERSERK':
                for (let i = 0; i < this.game.enemies.length; i++) {
                    const e = this.game.enemies[i];
                    if (!e.isDead) {
                        e.moveSpeed *= 2.5;
                        e.damage *= 2.0;
                        if (e.mesh && e.mesh.children[0]) {
                           e.mesh.children[0].material.color.set(0xff0000);
                           e.mesh.children[0].material.emissive.set(0xff0000);
                           e.mesh.children[0].material.emissiveIntensity = 5;
                        }
                    }
                }
                break;
            case 'GRAVITY_SURGE':
                if (this.game.playerController) {
                    this.game.playerController.gravity *= 0.3;
                    this.game.playerController.jumpForce *= 1.8;
                }
                break;
        }
    }

    endEvent() {
        if (!this.activeEvent) return;

        this._clearEventTimers();

        switch(this.activeEvent) {
            case 'BLACKOUT':
                this.scene.fog.density = 0.02;
                if (this.game.ambientLight) this.game.ambientLight.intensity = 0.6;
                break;
            case 'JAMMER': {
                const ui = this._getUiElement();
                if (ui) ui.classList.remove('malfunction');
                this.game.heatVisuals.glitchIntensity = 0;
                break;
            }
            case 'GRAVITY_SURGE':
                if (this.game.playerController) {
                    this.game.playerController.gravity = 30.0; // Reset to standard
                    this.game.playerController.jumpForce = 12.0;
                }
                break;
        }

        this.game.showProgressionMessage(`SYSTEM STABILIZED: ${this.activeEvent} RESOLVED`, 3000);
        this.activeEvent = null;
    }
}