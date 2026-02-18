export const CONFIG = {
    FACILITIES: [
        { id: 'meridian', name: 'THE MERIDIAN SERVERPLEX', desc: 'Central corporate data spine. Moderate security.', rooms: 50, enemies: 10, bossInterval: 5, accent: 0x00ffaa },
        { id: 'aetheris', name: 'AETHERIS CLOUD SPIRE', desc: 'High-altitude processing hub. Specialized aerial units.', rooms: 50, enemies: 10, bossInterval: 5, accent: 0x00aaff },
        { id: 'obsidian', name: 'OBSIDIAN DATA VAULT', desc: 'Deep-underground encrypted archive. Extreme armor.', rooms: 50, enemies: 10, bossInterval: 5, accent: 0xff3300 },
        { id: 'cryo', name: 'CRYO-LINK COLD STORAGE', desc: 'Sub-zero server farm. Environmental hazards.', rooms: 50, enemies: 10, bossInterval: 5, accent: 0x00ffff },
        { id: 'neon', name: 'NEON-SHIFT R&D WING', desc: 'Experimental weapons lab. Cloaked enemies.', rooms: 50, enemies: 10, bossInterval: 5, accent: 0xff00ff }
    ],
    PLAYER: {
        MOVE_SPEED: 10,
        JUMP_FORCE: 12,
        GRAVITY: 30,
        EYE_HEIGHT: 1.6,
        MAX_HEALTH: 100,
        MELEE: {
            DAMAGE: 60,
            RANGE: 2.5,
            COOLDOWN: 600, // ms
        },
        GRENADE: {
            COUNT_START: 3,
            MAX_COUNT: 5,
            DAMAGE: 150,
            RADIUS: 8,
            COOLDOWN: 2000,
            THROW_FORCE: 15,
            GRAVITY: 20,
        },
        EMP: {
            RADIUS: 12,
            DURATION: 5000, // 5 seconds disable
            COOLDOWN: 5000,
            COUNT_START: 2,
        },
        EXTINGUISHER: {
            RANGE: 6,
            CONE: 0.6, // dot product threshold
            CAPACITY: 100,
            REGEN_RATE: 10, // per second
            EXTINGUISH_RATE: 50, // per second
        },
        BARREL: {
            DAMAGE: 200,
            RADIUS: 10,
            HEALTH: 10,
            FIRE_DURATION: 5000, // ms
            FIRE_DAMAGE: 15, // per second
        },
        WEAPONS: {
            RIFLE: {
                NAME: 'RIFLE',
                MAGAZINE_SIZE: 30,
                RESERVE_AMMO_START: 60,
                MAX_RESERVE_AMMO: 120,
                RELOAD_TIME: 1500,
                COOLDOWN: 150,
                DAMAGE: 25,
                ADS_FOV: 45,
                ADS_POS: [0, -0.28, -0.6],
                SHAKE: 0.05
            },
            SNIPER: {
                NAME: 'SNIPER',
                MAGAZINE_SIZE: 5,
                RESERVE_AMMO_START: 10,
                MAX_RESERVE_AMMO: 20,
                RELOAD_TIME: 2500,
                COOLDOWN: 1000,
                DAMAGE: 100,
                ADS_FOV: [15, 5], // Variable zoom levels
                ADS_POS: [0, -0.35, -0.5],
                SHAKE: 0.2
            }
        },
        DEFAULT_FOV: 75,
        DAMAGE_SHAKE: 0.3,
        SWAY: {
            INTENSITY: 0.02,
            MAX_AMOUNT: 0.05,
            SMOOTHNESS: 5,
        },
        BOB: {
            SPEED: 10,
            AMOUNT: 0.02,
        }
    },
    ENEMY: {
        SPAWN_RATE: 4000,
        MOVE_SPEED: 4,
        HEALTH: 50,
        DAMAGE: 10,
        ATTACK_RANGE: 15,
        DETECTION_RANGE: 40,
        TYPES: {
            SENTRY: { HEALTH: 50, DAMAGE: 10, SPEED: 4, RANGE: 15, SCORE: 100, SCALE: 1.0 },
            STALKER: { HEALTH: 30, DAMAGE: 15, SPEED: 7, RANGE: 3, SCORE: 150, SCALE: 0.8 },
            TANK: { HEALTH: 150, DAMAGE: 25, SPEED: 2, RANGE: 20, SCORE: 500, SCALE: 1.5 },
            HEAVY_SEC_BOT: { HEALTH: 800, DAMAGE: 35, SPEED: 3, RANGE: 12, SCORE: 2000, SCALE: 2.5 }
        }
    },
    MAP: {
        ROOM_SIZE: 20,
        NUM_ROOMS: 50,
        WALL_HEIGHT: 5,
        BOSS_INTERVAL: 5,
    },
    PICKUPS: {
        HEALTH_AMOUNT: 30,
        AMMO_RIFLE: 30,
        AMMO_SNIPER: 5,
        SPAWN_CHANCE: 0.5,
        ROTATION_SPEED: 2,
    },
    HAZARDS: {
        GAS: {
            LEAK_DURATION: 15000, // ms
            EXPLOSION_RADIUS: 12,
            EXPLOSION_DAMAGE: 120,
            FIRE_DURATION: 8000,
        },
        EXTINGUISHER: {
            SMOKE_DURATION: 10000, // ms
            RADIUS: 8,
            HEALTH: 10,
        }
    },
    TURRETS: {
        LASER: { DAMAGE: 10, FIRE_RATE: 500, RANGE: 25 },
        EMP: { DAMAGE: 20, FIRE_RATE: 3000, RANGE: 10 },
        SLOW: { DAMAGE: 0, FIRE_RATE: 1000, RANGE: 12, SLOW_FACTOR: 0.4 }
    },
    THERMAL: {
        MAX_ENERGY: 100,
        REGEN_RATE: 15,
        CONSUMPTION_RATE: 25,
    },
    FLASHLIGHT: {
        MAX_BATTERY: 100,
        CONSUMPTION_RATE: 5, // Slower than thermal
        REGEN_RATE: 10, // Recharges when off
    }
};
