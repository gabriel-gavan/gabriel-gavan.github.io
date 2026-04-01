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
            id: 'core_fire_build',
            name: 'Inferno Core',
            description: 'All bullets burn enemies. EVERY enemy neutralized triggers a massive fire explosion.',
            icon: '🔥',
            type: 'BUILD',
            rarity: 'INSANE',
            apply: (player) => { 
                player.perks.fireBuild = true;
                player.perks.explosiveBullets = true;
                player.perks.burnChance = 1.0;
            }
        },
        {
            id: 'core_shock_build',
            name: 'Tesla Architecture',
            description: 'Every shot chains lightning to 10 targets with 100% stun chance.',
            icon: '🌩️',
            type: 'BUILD',
            rarity: 'INSANE',
            apply: (player) => { 
                player.perks.shockBuild = true;
                player.perks.chainBullets = true; 
                player.perks.chainChance = 1.0;
                player.perks.chainTargets = 10;
            }
        },
        {
            id: 'core_gravity_build',
            name: 'Singularity Engine',
            description: 'Every shot pulls enemies together. Kills create persistent mini-black holes.',
            icon: '🌌',
            type: 'BUILD',
            rarity: 'INSANE',
            apply: (player) => { 
                player.perks.gravityBuild = true;
                player.perks.pullOnHit = true;
                player.perks.critChance = (player.perks.critChance || 0) + 0.5;
            }
        },
        {
            id: 'core_drone_god',
            name: 'Swarm Intelligence',
            description: 'Deploy 8 elite combat drones. Drones inherit all your build perks.',
            icon: '🐝',
            type: 'BUILD',
            rarity: 'INSANE',
            apply: (player) => { 
                player.perks.droneBuild = true;
                if (window.game) {
                    for (let i = 0; i < 8; i++) window.game.spawnAllyDrone();
                }
            }
        },
        {
            id: 'core_vampiric',
            name: 'Vampiric Link',
            description: 'Recover 10% of damage dealt as health.',
            icon: '🧛',
            type: 'BEHAVIOR',
            apply: (player) => { player.perks.vampiric = 0.1; }
        },
        {
            id: 'core_trap_sniff',
            name: 'Neural Sniffer',
            description: 'Trapped terminals emit a distinct red pulse. Gain 50% chance to auto-disarm traps.',
            icon: '👃',
            type: 'BEHAVIOR',
            apply: (player) => { player.perks.trapSniffer = true; }
        },
        {
            id: 'core_glass_cannon',
            name: 'Glass Cannon',
            description: '+200% damage output, but lose 5 HP/sec.',
            icon: '💎',
            type: 'STAT',
            apply: (player) => { 
                player.perks.damageMult = (player.perks.damageMult || 1) * 3;
                player.perks.drainHP = (player.perks.drainHP || 0) + 5;
            }
        }
    ]
};

const ALL_PERKS = [
    ...PERKS.RIFLE,
    ...PERKS.SNIPER,
    ...PERKS.CORE
];

export class PerkManager {
    constructor(player) {
        this.player = player;
        this.activePerks = new Set();
        
        if (!this.player.perks) {
            this.player.perks = {
                regen: 0,
                scavenger: 1.0,
                adrenaline: false,
                adrenalineTimer: 0,
                vampiric: 0,
                damageMult: 1.0,
                drainHP: 0,
                chainBullets: false,
                critChance: 0
            };
        }
        
        Object.values(this.player.weapons).forEach(w => {
            if (!w.perks) {
                w.perks = {
                    ricochet: false,
                    overclock: false,
                    overclockTimer: 0,
                    explosiveKills: false,
                    penetration: 0,
                    ammoRecall: false,
                    shieldBreaker: false
                };
            }
        });
    }

    getRandomPerks(count = 3) {
        const allAvailable = ALL_PERKS.filter(p => !this.activePerks.has(p.id));
        const shuffled = allAvailable.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    applyPerk(perkId) {
        const perk = ALL_PERKS.find(p => p.id === perkId);

        if (perk && !this.activePerks.has(perkId)) {
            perk.apply(this.player);
            this.activePerks.add(perkId);
            return true;
        }
        return false;
    }

    update(deltaTime) {
        if (!this.player.isDead) {
            if (this.player.perks.regen > 0) {
                this.player.health = Math.min(this.player.maxHealth, this.player.health + this.player.perks.regen * deltaTime);
            }
            if (this.player.perks.drainHP > 0) {
                this.player.takeDamage(this.player.perks.drainHP * deltaTime);
            }
        }

        if (this.player.perks.adrenalineTimer > 0) {
            this.player.perks.adrenalineTimer -= deltaTime;
        }

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

        if (weapon.perks.explosiveKills || this.player.perks.explosiveBullets) {
            if (window.game && window.game.triggerExplosion) {
                const radius = this.player.perks.fireBuild ? 12 : 6;
                const damage = this.player.perks.fireBuild ? 250 : 100;
                window.game.triggerExplosion(enemy.mesh.position, radius, damage, 0xff5500);
            }
        }

        if (this.player.perks.gravityBuild) {
            if (window.game && window.game.lootManager) {
                window.game.lootManager.applyLootEffect('BLACK_HOLE_CORE', 'LEGENDARY', enemy.mesh.position.clone());
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