export const CONFIG = {
    FACILITIES: [
        { id: 'meridian', name: 'THE MERIDIAN SERVERPLEX', desc: 'Central corporate data spine. Moderate security.', rooms: 20, enemies: 10, bossInterval: 5, accent: 0x00ffaa, image: 'assets/facility_core_lab.webp' },
        { id: 'aetheris', name: 'AETHERIS CLOUD SPIRE', desc: 'High-altitude processing hub. Specialized aerial units.', rooms: 20, enemies: 10, bossInterval: 5, accent: 0x00aaff, image: 'assets/facility_security_hub.webp' },
        { id: 'obsidian', name: 'OBSIDIAN DATA VAULT', desc: 'Deep-underground encrypted archive. Extreme armor.', rooms: 20, enemies: 10, bossInterval: 5, accent: 0xff3300, image: 'assets/facility_data_vault.webp' },
        { id: 'cryo', name: 'CRYO-LINK COLD STORAGE', desc: 'Sub-zero server farm. Environmental hazards.', rooms: 20, enemies: 10, bossInterval: 5, accent: 0x00ffff, image: 'assets/facility_power_grid.webp' },
        { id: 'neon', name: 'NEON-SHIFT R&D WING', desc: 'Experimental weapons lab. Cloaked enemies.', rooms: 20, enemies: 10, bossInterval: 5, accent: 0xff00ff, image: 'assets/facility_core_lab.webp' }
    ],
    PLAYER: {
        MOVE_SPEED: 14,
        JUMP_FORCE: 16,
        GRAVITY: 35,
        EYE_HEIGHT: 1.6,
        MAX_HEALTH: 500, // Massive health boost for survivability
        INVULNERABILITY_DURATION: 1000, // Full second of safety after a hit
        MELEE: {
            DAMAGE: 80,
            RANGE: 3.0,
            COOLDOWN: 400, // ms
        },
        GRENADE: {
            COUNT_START: 3,
            MAX_COUNT: 5,
            DAMAGE: 200,
            RADIUS: 10,
            COOLDOWN: 1500,
            THROW_FORCE: 18,
            GRAVITY: 20,
        },
        EMP: {
            RADIUS: 12,
            DURATION: 5000, // 5 seconds disable
            COOLDOWN: 5000,
            COUNT_START: 2,
        },
        EXTINGUISHER: {
            RANGE: 8,
            CONE: 0.5, // dot product threshold
            CAPACITY: 100,
            REGEN_RATE: 20, // per second
            EXTINGUISH_RATE: 60, // per second
        },
        BARREL: {
            DAMAGE: 250,
            RADIUS: 12,
            HEALTH: 10,
            FIRE_DURATION: 5000, // ms
            FIRE_DAMAGE: 20, // per second
        },
        WEAPONS: {
            RIFLE: {
                NAME: 'RIFLE',
                MAGAZINE_SIZE: 30,
                RESERVE_AMMO_START: 90,
                MAX_RESERVE_AMMO: 150,
                RELOAD_TIME: 1200,
                COOLDOWN: 120,
                DAMAGE: 30,
                ADS_FOV: 50,
                ADS_POS: [0, -0.28, -0.6],
                SHAKE: 0.04
            },
            SNIPER: {
                NAME: 'SNIPER',
                MAGAZINE_SIZE: 5,
                RESERVE_AMMO_START: 15,
                MAX_RESERVE_AMMO: 25,
                RELOAD_TIME: 2000,
                COOLDOWN: 800,
                DAMAGE: 120,
                ADS_FOV: [20, 10], // Variable zoom levels
                ADS_POS: [0, -0.35, -0.5],
                SHAKE: 0.15,
                RAIL_SHOT: {
                    COOLDOWN: 5000,
                    DAMAGE: 300,
                    PENETRATION: 5,
                    ENERGY_COST: 50, // Uses Thermal Energy
                    SHAKE: 0.4
                }
            }
        },
        DEFAULT_FOV: 85,
        DAMAGE_SHAKE: 0.4,
        SWAY: {
            INTENSITY: 0.025,
            MAX_AMOUNT: 0.06,
            SMOOTHNESS: 6,
        },
        BOB: {
            SPEED: 12,
            AMOUNT: 0.025,
        }
    },
    HEAT: {
        MAX_LEVEL: 10,
        LEVEL_UP_INTERVAL: 60000, // Every 60 seconds heat increases
        STAT_BUFF_PER_LEVEL: 0.15, // 15% increase in speed/damage/health per level
        SPAWN_RATE_REDUCTION_PER_LEVEL: 500, // Spawn rate decreases by 500ms per level (faster spawns)
        VISUALS: {
            FOG_DENSITY_MAX: 0.08,
            FOG_COLOR_START: 0x0a0a0c,
            FOG_COLOR_END: 0x330011, // Reddish tint as things heat up
            AMBIENT_INTENSITY_START: 0.6,
            AMBIENT_INTENSITY_END: 0.2, // Darker atmosphere
            GLITCH_INTENSITY_MAX: 0.4,
            BLOOM_STRENGTH_MAX: 2.0,
            COLOR_FILTERS: {
                CONTRAST_START: 100,
                CONTRAST_END: 140,
                HUE_ROTATE_START: 0,
                HUE_ROTATE_END: -20, // Shift towards red
                SATURATE_START: 100,
                SATURATE_END: 180,
            }
        }
    },
    ENEMY: {
        SPAWN_RATE: 7500, // Reduced from 6000
        MAX_ACTIVE: 12,   // Reduced from 15
        MOVE_SPEED: 4,
        HEALTH: 50,
        DAMAGE: 5, // Halved damage (was 10)
        ATTACK_RANGE: 15,
        DETECTION_RANGE: 40,
        TYPES: {
            SENTRY: { HEALTH: 50, DAMAGE: 5, SPEED: 3.5, RANGE: 15, SCORE: 100, SCALE: 1.0 }, 
            STALKER: { HEALTH: 30, DAMAGE: 6, SPEED: 6, RANGE: 3, SCORE: 150, SCALE: 0.8 },  
            TANK: { HEALTH: 150, DAMAGE: 15, SPEED: 1.5, RANGE: 20, SCORE: 500, SCALE: 1.5 }, 
            SHIELD_PROJECTOR: { HEALTH: 100, DAMAGE: 3, SPEED: 2.5, RANGE: 10, SCORE: 300, SCALE: 1.2 },
            HEAVY_SEC_BOT: { HEALTH: 800, DAMAGE: 20, SPEED: 2.5, RANGE: 12, SCORE: 2000, SCALE: 2.5 },
            TITAN: { HEALTH: 10000, DAMAGE: 50, SPEED: 3.5, RANGE: 30, SCORE: 50000, SCALE: 10.0 }
        }
    },
    MAP: {
        ROOM_SIZE: 20,
        NUM_ROOMS: 50, // Final challenge at Room 50
        WALL_HEIGHT: 5,
        BOSS_INTERVAL: 5,
        HAZARD_CHANCE: 0.4,
        VAULT_CHANCE: 0.2, // 20% chance for a room to be a vault
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
        },
        LASER_GRID: {
            DAMAGE: 15,
            SPEED: 4,
            WIDTH: 8,
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
