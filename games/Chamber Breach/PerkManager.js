export const PERKS = {
    RIFLE: [
        {
            id: 'rifle_ricochet',
            name: 'Vector Bounce',
            description: 'Rifle rounds ricochet off hard surfaces once.',
            icon: '🔄',
            type: 'BEHAVIOR',
            apply: (player) => { player.weapons.RIFLE.perks.ricochet = true; }
        },
        {
            id: 'rifle_overclock',
            name: 'Neural Overclock',
            description: 'Killing an enemy increases fire rate by 50% for 3 seconds.',
            icon: '⚡',
            type: 'TRIGGER',
            apply: (player) => { player.weapons.RIFLE.perks.overclock = true; }
        },
        {
            id: 'rifle_explosive',
            name: 'Chain Reaction',
            description: 'Enemies killed by the Rifle explode, damaging nearby foes.',
            icon: '💥',
            type: 'TRIGGER',
            apply: (player) => { player.weapons.RIFLE.perks.explosiveKills = true; }
        }
    ],
    SNIPER: [
        {
            id: 'sniper_pierce',
            name: 'Linear Accelerator',
            description: 'Standard Sniper rounds penetrate through one additional target.',
            icon: '➡️',
            type: 'BEHAVIOR',
            apply: (player) => { player.weapons.SNIPER.perks.penetration = 1; }
        },
        {
            id: 'sniper_recall',
            name: 'Data Salvage',
            description: 'Precision hits have a 50% chance to return ammo to the magazine.',
            icon: '♻️',
            type: 'TRIGGER',
            apply: (player) => { player.weapons.SNIPER.perks.ammoRecall = true; }
        },
        {
            id: 'sniper_shield_breaker',
            name: 'Disruption Spikes',
            description: 'Deals 3x damage to armored units and shields.',
            icon: '🛡️',
            type: 'STAT',
            apply: (player) => { player.weapons.SNIPER.perks.shieldBreaker = true; }
        }
    ],
    CORE: [
        {
            id: 'core_regen',
            name: 'Nano-Repair',
            description: 'Slowly regenerate health over time (2 HP/sec).',
            icon: '💉',
            type: 'BEHAVIOR',
            apply: (player) => { player.perks.regen = 2; }
        },
        {
            id: 'core_scavenger',
            name: 'Resource Siphon',
            description: 'Enemies drop 50% more ammo and credits.',
            icon: '💰',
            type: 'STAT',
            apply: (player) => { player.perks.scavenger = 1.5; }
        },
        {
            id: 'core_adrenaline',
            name: 'Stress Response',
            description: 'Movement speed increased by 30% for 2s after taking damage.',
            icon: '🏃',
            type: 'TRIGGER',
            apply: (player) => { player.perks.adrenaline = true; }
        }
    ]
};

export class PerkManager {
    constructor(player) {
        this.player = player;
        this.activePerks = new Set();
        
        // Initialize perk flags on player/weapons
        this.player.perks = {
            regen: 0,
            scavenger: 1.0,
            adrenaline: false,
            adrenalineTimer: 0
        };
        
        Object.values(this.player.weapons).forEach(w => {
            w.perks = {
                ricochet: false,
                overclock: false,
                overclockTimer: 0,
                explosiveKills: false,
                penetration: 0,
                ammoRecall: false,
                shieldBreaker: false
            };
        });
    }

    getRandomPerks(count = 3) {
        const allAvailable = [
            ...PERKS.RIFLE,
            ...PERKS.SNIPER,
            ...PERKS.CORE
        ].filter(p => !this.activePerks.has(p.id));

        const shuffled = allAvailable.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    applyPerk(perkId) {
        const perk = [
            ...PERKS.RIFLE,
            ...PERKS.SNIPER,
            ...PERKS.CORE
        ].find(p => p.id === perkId);

        if (perk && !this.activePerks.has(perkId)) {
            perk.apply(this.player);
            this.activePerks.add(perkId);
            return true;
        }
        return false;
    }

    update(deltaTime) {
        // Handle time-based perks
        if (this.player.perks.regen > 0 && !this.player.isDead) {
            this.player.health = Math.min(this.player.maxHealth, this.player.health + this.player.perks.regen * deltaTime);
        }

        if (this.player.perks.adrenalineTimer > 0) {
            this.player.perks.adrenalineTimer -= deltaTime;
        }

        // Weapon timers
        Object.values(this.player.weapons).forEach(w => {
            if (w.perks && w.perks.overclockTimer > 0) {
                w.perks.overclockTimer -= deltaTime;
            }
        });
    }

    handleKill(enemy) {
        const weapon = this.player.currentWeapon;
        if (!weapon || !weapon.perks) return;

        if (weapon.perks.overclock) {
            weapon.perks.overclockTimer = 3.0;
        }

        if (weapon.perks.explosiveKills) {
            // Trigger explosion at enemy position
            if (window.game && window.game.triggerExplosion) {
                window.game.triggerExplosion(enemy.mesh.position, 5, 100, 0xff5500);
            }
        }
    }

    handleDamageTaken() {
        if (this.player.perks.adrenaline) {
            this.player.perks.adrenalineTimer = 2.0;
        }
    }

    getModifiedFireRate(weapon) {
        let rate = weapon.COOLDOWN;
        if (weapon.perks && weapon.perks.overclockTimer > 0) {
            rate *= 0.5;
        }
        return rate;
    }

    getModifiedMoveSpeed(baseSpeed) {
        let speed = baseSpeed;
        if (this.player.perks.adrenalineTimer > 0) {
            speed *= 1.3;
        }
        return speed;
    }
}
