export class AbilityManager {
    constructor(game) {
        this.game = game;
        this.player = game.player;
        this.abilities = []; // Max 3
        this.activeIndex = 0;
        this.cooldowns = [0, 0, 0];
        this.isActive = false;
        this.duration = 0;
        
        this.hud = document.getElementById('ability-hud');
        this.nameVal = document.getElementById('ability-name-val');
        this.bar = document.getElementById('ability-cooldown-bar');
    }

    acquire(enemyType) {
        const abilityData = {
            'STALKER': { name: 'PHASE DASH', duration: 0.5, cooldown: 5000, color: 0xff00ff, icon: '⚡' },
            'TITAN': { name: 'SHOCKWAVE', duration: 0.1, cooldown: 15000, color: 0xff3300, icon: '💥' },
            'SHIELD_PROJECTOR': { name: 'FORCE SHIELD', duration: 5.0, cooldown: 20000, color: 0x00ffff, icon: '🛡️' },
            'TANK': { name: 'IRON FORTRESS', duration: 4.0, cooldown: 12000, color: 0xffaa00, icon: '🏰' },
            'SENTRY': { name: 'OVERCLOCK', duration: 3.0, cooldown: 8000, color: 0x00ffaa, icon: '🔥' },
            'TELEPORTER': { name: 'BLINK', duration: 0.1, cooldown: 4000, color: 0x00ffff, icon: '✨' },
            'EXPLODER': { name: 'VOLATILE STRIKE', duration: 0.1, cooldown: 10000, color: 0xffaa00, icon: '💣' },
            'SUPPRESSOR': { name: 'SYSTEM JAM', duration: 5.0, cooldown: 15000, color: 0xff0000, icon: '🔇' }
        };

        const data = abilityData[enemyType];
        if (data) {
            // Check if already have it
            if (this.abilities.find(a => a.type === enemyType)) return;

            // Add to list, limit to 3
            if (this.abilities.length >= 3) {
                this.abilities.shift(); // Remove oldest
                this.cooldowns.shift();
            }
            
            this.abilities.push({ ...data, type: enemyType });
            this.cooldowns[this.abilities.length - 1] = 0;
            
            this.hud.style.display = 'block';
            this.updateHUD();
            
            this.game.showProgressionMessage(`NEURAL LINK UPLOADED: ${data.name}`, 3000);
            
            if (this.game.successSynth) {
                this.game.successSynth.triggerAttackRelease("C5", "8n");
            }
        }
    }

    updateHUD() {
        if (this.abilities.length === 0) return;
        const current = this.abilities[this.activeIndex];
        if (current) {
            this.nameVal.innerText = `${current.icon} ${current.name} [${this.activeIndex + 1}/3]`;
            this.bar.style.backgroundColor = `#${current.color.toString(16).padStart(6, '0')}`;
        }
    }

    cycle() {
        if (this.abilities.length <= 1) return;
        this.activeIndex = (this.activeIndex + 1) % this.abilities.length;
        this.updateHUD();
        if (this.game.successSynth) this.game.successSynth.triggerAttackRelease("G4", "16n");
    }

    update(deltaTime) {
        if (this.abilities.length === 0) return;

        // Update all cooldowns
        for (let i = 0; i < this.abilities.length; i++) {
            if (this.cooldowns[i] > 0) {
                this.cooldowns[i] -= deltaTime * 1000;
            }
        }

        // Update bar for active ability
        const current = this.abilities[this.activeIndex];
        if (current) {
            const cd = this.cooldowns[this.activeIndex];
            if (cd > 0) {
                const progress = (cd / current.cooldown) * 100;
                this.bar.style.width = `${progress}%`;
            } else {
                this.bar.style.width = '0%';
            }
        }

        if (this.isActive) {
            this.duration -= deltaTime;
            if (this.duration <= 0) {
                this.deactivate();
            }
        }
    }

    activate() {
        if (this.abilities.length === 0 || this.isActive) return;
        
        const current = this.abilities[this.activeIndex];
        if (this.cooldowns[this.activeIndex] > 0) return;

        this.isActive = true;
        this.duration = current.duration;
        this.cooldowns[this.activeIndex] = current.cooldown;

        switch(current.type) {
            case 'STALKER': this.executePhaseDash(); break;
            case 'TITAN': this.executeShockwave(); break;
            case 'SHIELD_PROJECTOR': this.executeForceShield(); break;
            case 'TANK': this.executeIronFortress(); break;
            case 'SENTRY': this.executeOverclock(); break;
            case 'TELEPORTER': this.executeBlink(); break;
            case 'EXPLODER': this.executeVolatileStrike(); break;
            case 'SUPPRESSOR': this.executeSystemJam(); break;
        }

        if (this.game.successSynth) {
            this.game.successSynth.triggerAttackRelease("E5", "4n");
        }
    }

    deactivate() {
        this.isActive = false;
        this.player.damageMultiplier = 1.0;
        this.player.isPhased = false;
    }

    executePhaseDash() {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.game.camera.quaternion);
        this.player.mesh.position.add(dir.multiplyScalar(10));
        this.player.isPhased = true;
        if (this.game.particleSystem) {
            this.game.particleSystem.createExplosion(this.player.mesh.position, 0xff00ff, 20, 2);
        }
    }

    executeShockwave() {
        this.game.handleAreaDamage(this.player.mesh.position, 15, 200);
        if (this.game.particleSystem) {
            this.game.particleSystem.createExplosion(this.player.mesh.position, 0xff3300, 50, 5);
        }
    }

    executeForceShield() {
        this.player.hasProjectedShield = true;
        this.player.projectedShieldTimer = this.duration * 1000;
    }

    executeIronFortress() {
        this.player.hasProjectedShield = true;
        this.player.projectedShieldTimer = this.duration * 1000;
        this.player.damageMultiplier = 2.0;
    }

    executeOverclock() {
        this.player.buffs.push({ multiplier: 1.0, duration: this.duration });
    }

    executeBlink() {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.game.camera.quaternion);
        this.player.mesh.position.add(dir.multiplyScalar(8));
        if (this.game.particleSystem) {
            this.game.particleSystem.createExplosion(this.player.mesh.position, 0x00ffff, 10, 1);
        }
    }

    executeVolatileStrike() {
        this.game.handleAreaDamage(this.player.mesh.position, 6, 150);
        if (this.game.particleSystem) {
            this.game.particleSystem.createExplosion(this.player.mesh.position, 0xffaa00, 30, 4);
        }
    }

    executeSystemJam() {
        this.game.enemies.forEach(e => {
            if (!e.isDead && e.mesh.position.distanceTo(this.player.mesh.position) < 15) {
                e.applyEMP(5000);
            }
        });
        if (this.game.particleSystem) {
            this.game.particleSystem.createExplosion(this.player.mesh.position, 0xff0000, 20, 10);
        }
    }
}
