export const CONFIG = {
    FACILITIES: [
        { 
            id: 'meridian', 
            name: 'THE MERIDIAN SERVERPLEX', 
            desc: 'Central corporate data spine. Moderate security.', 
            rooms: 20, 
            enemies: 10, 
            bossInterval: 5, 
            accent: 0x00d0ff, 
            image: 'https://rosebud.ai/assets/facility_core_lab.webp.webp?CtAf', 
            wallTexture: 'https://rosebud.ai/assets/wall_meridian_serverplex.webp?2je5',
            mutator: 'NONE' 
        },
        { 
            id: 'aetheris', 
            name: 'AETHERIS CLOUD SPIRE', 
            desc: 'High-altitude processing hub. Low gravity environment.', 
            rooms: 20, 
            enemies: 10, 
            bossInterval: 5, 
            accent: 0x00aaff, 
            image: 'https://rosebud.ai/assets/facility_security_hub.webp.webp?kHy9', 
            wallTexture: 'https://rosebud.ai/assets/wall_aetheris_spire.webp?2Nj2',
            mutator: 'LOW_GRAVITY',
            bossType: 'AETHERIS_OVERSEER'
        },
        { 
            id: 'obsidian', 
            name: 'OBSIDIAN DATA VAULT', 
            desc: 'Deep-underground encrypted archive. Extreme armor.', 
            rooms: 20, 
            enemies: 10, 
            bossInterval: 5, 
            accent: 0xff3300, 
            image: 'https://rosebud.ai/assets/facility_data_vault.webp.webp?N8Mr', 
            wallTexture: 'https://rosebud.ai/assets/scifi_wall_paneled_metal.webp.webp?bMd0',
            mutator: 'HEAT_DAMAGE',
            bossType: 'OBSIDIAN_JUGGERNAUT'
        },
        { 
            id: 'cryo', 
            name: 'CRYO-LINK COLD STORAGE', 
            desc: 'Sub-zero server farm. Atmospheric instability.', 
            rooms: 20, 
            enemies: 10, 
            bossInterval: 5, 
            accent: 0x00ffff, 
            image: 'https://rosebud.ai/assets/facility_power_grid.webp.webp?wIee', 
            wallTexture: 'https://rosebud.ai/assets/wall_cryo_link.webp?wvBK',
            mutator: 'ATMOSPHERIC_INSTABILITY',
            bossType: 'CRYO_COMMANDER'
        },
        { 
            id: 'neon', 
            name: 'NEON-SHIFT R&D WING', 
            desc: 'Experimental weapons lab. Data storm interference.', 
            rooms: 20, 
            enemies: 10, 
            bossInterval: 5, 
            accent: 0xff00ff, 
            image: 'https://rosebud.ai/assets/facility_core_lab.webp.webp?CtAf', 
            wallTexture: 'https://rosebud.ai/assets/wall_neon_shift.webp?etL9',
            mutator: 'DATA_STORM',
            bossType: 'CLOAK_MASTER'
        }
    ],
    PLAYER: {
        MOVE_SPEED: 14,
        LOW_SPEC_MOVE_SPEED: 12,
        JUMP_FORCE: 16,
        LOW_SPEC_JUMP_FORCE: 14,
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
            FOG_COLOR_END: 0x0a1a2c, // Dark blue instead of reddish
            AMBIENT_INTENSITY_START: 0.6,
            AMBIENT_INTENSITY_END: 0.2, // Darker atmosphere
            GLITCH_INTENSITY_MAX: 0.4,
            BLOOM_STRENGTH_MAX: 2.0,
            COLOR_FILTERS: {
                CONTRAST_START: 100,
                CONTRAST_END: 140,
                HUE_ROTATE_START: 0,
                HUE_ROTATE_END: 0, // No hue rotation to red
                SATURATE_START: 100,
                SATURATE_END: 180,
            }
        }
    },
    ENEMY: {
        SPAWN_RATE: 7500, // Reduced from 6000
        MAX_ACTIVE: 12,   // Reduced from 15
        LOW_SPEC_MAX_ACTIVE: 6,
        LOW_SPEC_SPAWN_RATE: 11000,
        MOVE_SPEED: 4,
        HEALTH: 50,
        DAMAGE: 5, // Halved damage (was 10)
        ATTACK_RANGE: 15,
        DETECTION_RANGE: 40,
        LOD: {
            MEDIUM_DIST: 25,
            LOW_DIST: 60,
            CULL_DIST: 120
        },
        TYPES: {
            SENTRY: { HEALTH: 50, DAMAGE: 5, SPEED: 3.5, RANGE: 15, SCORE: 100, SCALE: 1.3 }, 
            STALKER: { HEALTH: 30, DAMAGE: 6, SPEED: 6, RANGE: 3, SCORE: 150, SCALE: 1.1 },  
            TANK: { HEALTH: 150, DAMAGE: 15, SPEED: 1.5, RANGE: 20, SCORE: 500, SCALE: 1.9 }, 
            SHIELD_PROJECTOR: { HEALTH: 100, DAMAGE: 3, SPEED: 2.5, RANGE: 10, SCORE: 300, SCALE: 1.5 },
            HEAVY_SEC_BOT: { HEALTH: 800, DAMAGE: 20, SPEED: 2.5, RANGE: 12, SCORE: 2000, SCALE: 3.2, SINGULARITY_RESIST: 0.7, PHASE_RESIST: 0.5 },
            TITAN: { HEALTH: 10000, DAMAGE: 50, SPEED: 3.5, RANGE: 30, SCORE: 50000, SCALE: 12.0, SINGULARITY_RESIST: 1.0, PHASE_RESIST: 0.8 },
            CLOAK_MASTER: { HEALTH: 6000, DAMAGE: 40, SPEED: 6.0, RANGE: 25, SCORE: 40000, SCALE: 8.0, SINGULARITY_RESIST: 0.9, PHASE_RESIST: 1.0 },
            OBSIDIAN_JUGGERNAUT: { HEALTH: 15000, DAMAGE: 60, SPEED: 2.5, RANGE: 35, SCORE: 60000, SCALE: 13.0, SINGULARITY_RESIST: 1.0, PHASE_RESIST: 0.7 },
            CRYO_COMMANDER: { HEALTH: 8000, DAMAGE: 45, SPEED: 4.5, RANGE: 28, SCORE: 45000, SCALE: 9.0, SINGULARITY_RESIST: 0.8, PHASE_RESIST: 0.9 },
            AETHERIS_OVERSEER: { HEALTH: 7000, DAMAGE: 35, SPEED: 7.0, RANGE: 40, SCORE: 50000, SCALE: 10.0, SINGULARITY_RESIST: 0.5, PHASE_RESIST: 1.0 },
            TELEPORTER: { HEALTH: 40, DAMAGE: 8, SPEED: 4.5, RANGE: 10, SCORE: 200, SCALE: 1.2 },
            SPLITTER: { HEALTH: 120, DAMAGE: 10, SPEED: 3.0, RANGE: 12, SCORE: 250, SCALE: 1.6 },
            SUPPRESSOR: { HEALTH: 80, DAMAGE: 12, SPEED: 3.5, RANGE: 15, SCORE: 300, SCALE: 1.4 },
            EXPLODER: { HEALTH: 40, DAMAGE: 30, SPEED: 7.0, RANGE: 2, SCORE: 150, SCALE: 1.3 },
            PARASITE: { HEALTH: 20, DAMAGE: 5, SPEED: 8.0, RANGE: 1.5, SCORE: 100, SCALE: 0.8 }
        }
    },
    MAP: {
        ROOM_SIZE: 20,
        NUM_ROOMS: 50, // Final challenge at Room 50
        WALL_HEIGHT: 5,
        BOSS_INTERVAL: 5,
        HAZARD_CHANCE: 0.4,
        VAULT_CHANCE: 0.2, // 20% chance for a room to be a vault
        FAST_MODE: true, // Faster map generation with fewer heavy props and hazards
        LOW_SPEC_MODE: true, // Aggressive fallback for integrated graphics / weak CPUs
        MAX_COMPLEX_PROPS: 1, // reduce detail during fast loading
        LIGHTS_PER_ROOM: 1,
        LOW_SPEC_NUM_ROOMS: 20,
        LOW_SPEC_HAZARD_CHANCE: 0.14,
        LOW_SPEC_VAULT_CHANCE: 0.08,
        LOW_SPEC_MAX_COMPLEX_PROPS: 0,
        LOW_SPEC_LIGHTS_PER_ROOM: 0
    },
    PICKUPS: {
        HEALTH_AMOUNT: 30,
        AMMO_RIFLE: 30,
        AMMO_SNIPER: 5,
        SPAWN_CHANCE: 0.5,
        ROTATION_SPEED: 2,
    },
    // --- Environment & Hazards ---
    ENVIRONMENT: {
        DESTRUCTIBLE: {
            SERVER_RACK: {
                HEALTH: 50,
                SCORE: 25,
                PARTICLE_TYPE: 'ELECTRONIC_SPARKS'
            },
            DATA_TERMINAL: {
                HEALTH: 30,
                SCORE: 15,
                PARTICLE_TYPE: 'DATA_SHARDS'
            }
        }
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
        LASER: { DAMAGE: 15, FIRE_RATE: 450, RANGE: 30, HEALTH: 150 },
        EMP: { DAMAGE: 25, FIRE_RATE: 3000, RANGE: 12, HEALTH: 200 },
        SLOW: { DAMAGE: 2, FIRE_RATE: 1000, RANGE: 15, SLOW_FACTOR: 0.4, HEALTH: 200 },
        OMEGA_SENTRY: { DAMAGE: 65, FIRE_RATE: 120, RANGE: 45, HEALTH: 1500 },
        OMEGA_EMP: { DAMAGE: 80, FIRE_RATE: 2000, RANGE: 25, HEALTH: 1800 },
        OMEGA_SLOW: { DAMAGE: 15, FIRE_RATE: 800, RANGE: 25, SLOW_FACTOR: 0.1, HEALTH: 1800 }
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
