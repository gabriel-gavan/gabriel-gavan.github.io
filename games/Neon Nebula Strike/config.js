export const CONFIG = {
    ASSETS: {
        GUN: 'assets/realistic_tactical_rifle_v3.webp',
        MONSTERS: [
            'assets/alien_monster.webp',
            'assets/alien_wasp_monster.webp',
            'assets/alien_beast_monster.webp',
            'assets/alien_blob_monster.webp'
        ],
        GROUNDS: [
            'assets/alien_ground.webp',
            'assets/frozen_ground_texture.webp',
            'assets/toxic_ground_texture.webp',
            'assets/shadow_ground_texture.webp',
            'assets/volcanic_ground_texture.webp'
        ],
        WALLS: [
            'assets/alien_wall_texture.webp',
            'assets/frozen_wall_texture.webp',
            'assets/toxic_wall_texture.webp',
            'assets/shadow_wall_texture.webp',
            'assets/volcanic_wall_texture.webp'
        ],
        SKIES: [
            'assets/alien_skybox.webp',
            'assets/frozen_skybox.webp',
            'assets/toxic_skybox.webp',
            'assets/night_skybox.webp',
            'assets/volcanic_skybox.webp'
        ],
        RUIN_WALL: 'assets/ruined_wall_texture.webp',
        CRATE: 'assets/scifi_crate_obstacle.webp',
        PILLAR: 'assets/ruined_alien_pillar.webp',
        BOSS: 'assets/alien_boss_monster.webp',
        CRYSTAL: 'assets/alien_crystal_cluster.webp',
        BARRIER: 'assets/scifi_barrier_obstacle.webp',
        WRECKAGE: 'assets/alien_wreckage_obstacle.webp',
        BARREL: 'assets/scifi_fuel_barrel_v1.webp',
        EXPLOSION: 'assets/explosion_sprite_v1.webp',
        SHIP_STATIC: 'assets/alien_scout_ship_static.webp',
        SHIP_ENEMY: 'assets/alien_flying_drone_enemy.webp',
        ARMORED_SOLDIER: 'assets/armored_alien_soldier_v1.webp',
        HEAVY_JUGGERNAUT: 'assets/heavy_alien_juggernaut_v1.webp',
        ENERGY_CORE: 'assets/energy_core.webp',
        ALIEN_HIVE: 'assets/alien_hive.webp',
        GRENADE: 'assets/tactical_grenade.webp',
        FINAL_BOSS_OVERMIND: 'assets/alien_overmind_final_boss.webp',
        PICKUP_HEALTH: 'assets/health_pickup.webp',
        PICKUP_AMMO: 'assets/ammo_pickup.webp',
        PICKUP_SHIELD: 'assets/shield_pickup.webp',
        PICKUP_DAMAGE: 'assets/damage_pickup.webp',
        PICKUP_NUCLEAR: 'assets/nuclear_battery_pickup.webp'
    },
    PICKUPS: {
        DROP_CHANCE: 0.3,
        TYPES: {
            HEALTH: { id: 'health', icon: 'assets/health_pickup.webp', color: 0xff0000, weight: 10 },
            AMMO: { id: 'ammo', icon: 'assets/ammo_pickup.webp', color: 0x00ffff, weight: 10 },
            GRENADE: { id: 'grenade', icon: 'assets/tactical_grenade.webp', color: 0x00ff00, weight: 5 },
            SHIELD: { id: 'shield', icon: 'assets/shield_pickup.webp', color: 0xffff00, weight: 3 },
            DAMAGE: { id: 'damage', icon: 'assets/damage_pickup.webp', color: 0xffaa00, weight: 3 },
            NUCLEAR: { id: 'nuclear', icon: 'assets/nuclear_battery_pickup.webp', color: 0xccff00, weight: 1 }
        }
    },
    PLAYER: {
        MOVE_SPEED: 8,
        JUMP_FORCE: 12,
        EYE_HEIGHT: 1.6,
        GRENADE_COUNT: 3,
        GRENADE_COOLDOWN: 3000, // ms
    },
    ENEMY: {
        SPAWN_RATE: 2000,
        MOVE_SPEED: 4,
        DAMAGE: 10,
    },
    BOSS: {
        HEALTH: 5000,
        MOVE_SPEED: 3,
        DAMAGE: 20,
        SCALE: 10
    },
    FINAL_BOSS: {
        HEALTH: 50000,
        MOVE_SPEED: 5,
        DAMAGE: 50,
        SCALE: 18,
        PROJECTILE_DAMAGE: 20,
        SHOCKWAVE_RANGE: 30,
        SUMMON_INTERVAL: 6000
    },
    WEAPONS: {
        RIFLE: {
            name: "Tactical Rifle",
            id: "rifle",
            damage: 50,
            fireRate: 150, // ms
            recoil: 40,
            unlockXP: 0,
            icon: 'assets/realistic_tactical_rifle_v3.webp',
            sprite: 'assets/fps_rifle_v3_straight.webp',
            projectile: 'bullet'
        },
        SHOTGUN: {
            name: "Combat Shotgun",
            id: "shotgun",
            damage: 30, // Per pellet
            pellets: 8,
            spread: 0.15,
            fireRate: 800,
            recoil: 100,
            unlockXP: 1000,
            icon: 'assets/scifi_shotgun_icon.webp',
            sprite: 'assets/fps_shotgun_v3_straight.webp',
            projectile: 'buckshot'
        },
        PLASMA: {
            name: "Plasma Shotgun",
            id: "plasma",
            damage: 80,
            fireRate: 300,
            recoil: 20,
            unlockXP: 3000,
            icon: 'assets/plasma_rifle_icon.webp',
            sprite: 'assets/fps_plasma_shotgun_green_straight.webp',
            projectile: 'plasma',
            pierceCount: 2
        },
        RAILGUN: {
            name: "Railgun",
            id: "railgun",
            damage: 500,
            fireRate: 1500,
            recoil: 200,
            unlockXP: 7000,
            icon: 'assets/railgun_icon.webp',
            sprite: 'assets/fps_railgun_v3_straight.webp',
            projectile: 'rail',
            pierceAll: true
        }
    },
    UPGRADES: {
        // --- Combat & Damage ---
        DAMAGE_BOOST: { id: 'damage_boost', name: 'OVERPRESSURE', description: 'INCREASE DAMAGE BY 15%', icon: '🔥' },
        FIRE_RATE: { id: 'fire_rate', name: 'CHRONO TRIGGER', description: 'INCREASE FIRE RATE BY 15%', icon: '⚡' },
        RELOAD_SPEED: { id: 'reload_speed', name: 'MAG-WELL', description: 'DECREASE RECOIL RECOVERY TIME BY 20%', icon: '🔄' },
        CRIT_CHANCE: { id: 'crit_chance', name: 'VULNERABILITY SCAN', description: '+10% CHANCE TO DEAL 2X DAMAGE', icon: '🎯' },
        CRIT_DAMAGE: { id: 'crit_damage', name: 'HEAVY CALIBER', description: '+50% CRITICAL HIT DAMAGE', icon: '💥' },
        ARMOR_PIERCE: { id: 'armor_pierce', name: 'TUNGSTEN CORE', description: 'BULLETS PIERCE 1 EXTRA TARGET', icon: '📍' },
        HEADSHOT_BONUS: { id: 'headshot_bonus', name: 'NEURAL LINK', description: '+25% HEADSHOT DAMAGE', icon: '🧠' },
        
        // --- Health & Survival ---
        MAX_HEALTH: { id: 'max_health', name: 'NANO-PLATING', description: '+25 MAX HEALTH', icon: '🛡️' },
        HEALTH_REGEN: { id: 'health_regen', name: 'REGEN CELLS', description: 'REGENERATE 1 HP EVERY 5 SECONDS', icon: '🧪' },
        LIFE_STEAL: { id: 'life_steal', name: 'VAMPIRIC ROUNDS', description: 'HEAL 2 HP ON KILL', icon: '🧛' },
        DASH_COOLDOWN: { id: 'dash_cooldown', name: 'REFLEX BOOST', description: 'REDUCE DASH COOLDOWN BY 15%', icon: '🏃' },
        SHIELD_GEN: { id: 'shield_gen', name: 'KINETIC BARRIER', description: 'GAIN A 10HP SHIELD EVERY 30 SECONDS', icon: '💠' },
        DODGE_CHANCE: { id: 'dodge_chance', name: 'EVASION', description: '5% CHANCE TO DODGE INCOMING DAMAGE', icon: '👻' },
        LAST_STAND: { id: 'last_stand', name: 'ADRENALINE', description: 'DEAL 50% MORE DAMAGE WHEN BELOW 25% HP', icon: '🩸' },
        
        // --- Tactical & Explosives ---
        GRENADE_DAMAGE: { id: 'grenade_damage', name: 'HE PAYLOAD', description: '+25% GRENADE EXPLOSION RADIUS', icon: '🧨' },
        MAX_GRENADES: { id: 'max_grenades', name: 'BANDOLIER', description: '+2 MAX GRENADES', icon: '🎒' },
        GRENADE_CD: { id: 'grenade_cd', name: 'AUTO-LOADER', description: 'REPLENISH 1 GRENADE EVERY 45 SECONDS', icon: '⏲️' },
        EXPLOSION_BULLETS: { id: 'explosion_bullets', name: 'FRAGMENTATION', description: '5% CHANCE FOR BULLETS TO EXPLODE', icon: '✴️' },
        STUN_GRENADE: { id: 'stun_grenade', name: 'CONCUSSION', description: 'GRENADES STUN ENEMIES FOR 2 SECONDS', icon: '💫' },
        
        // --- Movement & Utility ---
        MOVE_SPEED: { id: 'move_speed', name: 'SERVO MOTORS', description: '+15% MOVEMENT SPEED', icon: '👟' },
        JUMP_BOOST: { id: 'jump_boost', name: 'THRUSTERS', description: '+20% JUMP HEIGHT', icon: '🚀' },
        PICKUP_RADIUS: { id: 'pickup_radius', name: 'MAGNETIC FIELD', description: '+50% LOOT ATTRACTION RANGE', icon: '🧲' },
        XP_BOOST: { id: 'xp_boost', name: 'DATA LINK', description: '+20% WEAPON XP GAIN', icon: '📊' },
        SCORE_MULTIPLIER: { id: 'score_multiplier', name: 'PRESTIGE', description: '+15% SCORE MULTIPLIER', icon: '🏆' },
        
        // --- Elemental & Status ---
        FREEZE: { id: 'freeze', name: 'CRYO ROUNDS', description: '5% CHANCE TO FREEZE ENEMIES', icon: '❄️' },
        BURN: { id: 'burn', name: 'INCENDIARY', description: 'DEAL BURN DAMAGE OVER 3 SECONDS', icon: '🔥' },
        ELECTRIC_CHAIN: { id: 'electric_chain', name: 'TESLA COIL', description: 'HITS HAVE 10% CHANCE TO CHAIN LIGHTNING', icon: '⚡' },
        TOXIC_CLOUD: { id: 'toxic_cloud', name: 'BIO-HAZARD', description: 'KILLS RELEASE A TOXIC CLOUD', icon: '☣️' },
        SHOCKWAVE: { id: 'shockwave', name: 'KINETIC PULSE', description: 'LANDING FROM JUMP RELEASES SHOCKWAVE', icon: '🌊' },

        // --- Rare & Build-Defining ---
        DOUBLE_BULLET: { id: 'double_bullet', name: 'TWIN-LINKED', description: 'CHANCE TO FIRE TWO BULLETS', icon: '🔫' },
        BOUNCING_BULLETS: { id: 'bouncing_bullets', name: 'RICOCHET', description: 'BULLETS BOUNCE OFF WALLS ONCE', icon: '🎾' },
        HOMING_ROUNDS: { id: 'homing_rounds', name: 'SMART BOLTS', description: 'BULLETS SLIGHTLY TRACK ENEMIES', icon: '🏠' },
        ORBITAL_STRIKE: { id: 'orbital_strike', name: 'ION CANNON', description: 'EVERY 20TH KILL TRIGGERS ORBITAL STRIKE', icon: '🛰️' },
        BERSERK: { id: 'berserk', name: 'RAMPAGE', description: '+2% FIRE RATE PER KILL (MAX 50%)', icon: '👹' },
        
        // --- Utility Expansion ---
        AMMO_FINDER: { id: 'ammo_finder', name: 'SCAVENGER', description: '+10% AMMO DROP CHANCE', icon: '📦' },
        HEALTH_FINDER: { id: 'health_finder', name: 'MEDIC SCAN', description: '+10% HEALTH DROP CHANCE', icon: '➕' },
        SHIELD_BREAK: { id: 'shield_break', name: 'EMP ROUNDS', description: 'DEAL 3X DAMAGE TO ENEMY SHIELDS', icon: '📡' },
        COMBO_EXTENDER: { id: 'combo_extender', name: 'MOMENTUM', description: '+2 SECONDS COMBO DURATION', icon: '⏱️' },
        
        // --- Defensive Expansion ---
        THORNS: { id: 'thorns', name: 'REACTIVE ARMOR', description: 'REFLECT 20% DAMAGE BACK TO ATTACKER', icon: '🌵' },
        SIZE_REDUCTION: { id: 'size_reduction', name: 'STEALTH FRAME', description: 'REDUCE PLAYER HITBOX SIZE BY 15%', icon: '📉' },
        RECOVERY_BOOST: { id: 'recovery_boost', name: 'STIMPACK', description: 'HEAL 50% FASTER FROM ALL SOURCES', icon: '💉' },
        
        // --- More Combat ---
        BURST_FIRE: { id: 'burst_fire', name: 'CYCLIC RATE', description: 'CHANCE TO FIRE A RAPID 3-ROUND BURST', icon: '💥' },
        STABILITY: { id: 'stability', name: 'GYRO-STABILIZER', description: 'REDUCE ALL WEAPON RECOIL BY 30%', icon: '⚖️' },
        SNIPER_PROWESS: { id: 'sniper_prowess', name: 'LONG RANGE', description: 'DEAL MORE DAMAGE THE FURTHER THE TARGET', icon: '🔭' },
        CLOSE_QUARTERS: { id: 'close_quarters', name: 'POINT BLANK', description: 'DEAL MORE DAMAGE AT CLOSE RANGE', icon: '🤜' },
        MARKSMAN: { id: 'marksman', name: 'EAGLE EYE', description: 'INCREASE WEAPON ZOOM', icon: '🦅' },
        GRAVITY_WELL: { id: 'gravity_well', name: 'SINGULARITY', description: 'CRITICAL HITS PULL ENEMIES IN', icon: '🕳️' },
        OVERHEAT: { id: 'overheat', name: 'THERMAL VENT', description: 'FIRE RATE INCREASES AS YOU FIRE', icon: '🌡️' },
        DEATH_MARK: { id: 'death_mark', name: 'REAPER', description: 'ENEMIES BELOW 10% HP ARE EXECUTED', icon: '💀' }
    },
    LEVELS: {
        COUNT: 125,
        PER_CAMPAIGN: 25,
        SCORE_PER_LEVEL: 1000
    },
    META_UPGRADES: {
        MAX_HEALTH: { id: 'meta_hp', name: 'TITANIUM PLATING', cost: 1000, bonus: 0.1, desc: '+10% MAX HEALTH', tier: 1 },
        DAMAGE: { id: 'meta_dmg', name: 'AMMO OVERCLOCK', cost: 1500, bonus: 0.1, desc: '+10% DAMAGE', tier: 1 },
        SPEED: { id: 'meta_speed', name: 'HYDRAULIC LEGS', cost: 1000, bonus: 0.05, desc: '+5% MOVE SPEED', tier: 1 },
        
        GRENADES: { id: 'meta_grenades', name: 'SATCHEL EXPANSION', cost: 2500, bonus: 1, desc: '+1 GRENADE CAP', tier: 2, requires: ['meta_hp'] },
        CRIT: { id: 'meta_crit', name: 'TARGETING CHIP', cost: 3000, bonus: 0.05, desc: '+5% CRIT CHANCE', tier: 2, requires: ['meta_dmg'] },
        REGEN: { id: 'meta_regen', name: 'NANO-REPAIR', cost: 4000, bonus: 1, desc: 'REGEN 1 HP / 5S', tier: 2, requires: ['meta_speed'] },

        LIFESTEAL: { id: 'meta_lifesteal', name: 'SANGUINE CORE', cost: 6000, bonus: 2, desc: 'HEAL 2 HP ON KILL', tier: 3, requires: ['meta_grenades', 'meta_crit'] },
        SHIELD: { id: 'meta_shield', name: 'VOID BARRIER', cost: 8000, bonus: 10, desc: 'START WITH 10HP SHIELD', tier: 3, requires: ['meta_crit', 'meta_regen'] },

        // --- Tier 4: Class-Specific Ability Upgrades ---
        STRIKER_CD: { id: 'meta_striker_cd', name: 'OVERCLOCKED PHASING', cost: 10000, bonus: 0.2, desc: '-20% PHASE DASH COOLDOWN', tier: 4, class: 'STRIKER', requires: ['meta_lifesteal'] },
        STRIKER_DUR: { id: 'meta_striker_dur', name: 'EXTENDED PHASING', cost: 10000, bonus: 0.3, desc: '+30% PHASE DASH DURATION', tier: 4, class: 'STRIKER', requires: ['meta_lifesteal'] },
        
        GUARDIAN_CD: { id: 'meta_guardian_cd', name: 'RAPID RECHARGE', cost: 10000, bonus: 0.2, desc: '-20% KINETIC DOME COOLDOWN', tier: 4, class: 'GUARDIAN', requires: ['meta_shield'] },
        GUARDIAN_DUR: { id: 'meta_guardian_dur', name: 'DOME REINFORCEMENT', cost: 10000, bonus: 0.3, desc: '+30% KINETIC DOME DURATION', tier: 4, class: 'GUARDIAN', requires: ['meta_shield'] },
        
        REAPER_CD: { id: 'meta_reaper_cd', name: 'ADRENALINE PUMP', cost: 10000, bonus: 0.2, desc: '-20% BLOODLUST COOLDOWN', tier: 4, class: 'REAPER', requires: ['meta_lifesteal'] },
        REAPER_DUR: { id: 'meta_reaper_dur', name: 'SUSTAINED FRENZY', cost: 10000, bonus: 0.3, desc: '+30% BLOODLUST DURATION', tier: 4, class: 'REAPER', requires: ['meta_lifesteal'] },
        
        ENGINEER_CD: { id: 'meta_engineer_cd', name: 'FAST DEPLOYMENT', cost: 10000, bonus: 0.2, desc: '-20% SENTRY DRONE COOLDOWN', tier: 4, class: 'ENGINEER', requires: ['meta_shield'] },
        ENGINEER_DUR: { id: 'meta_engineer_dur', name: 'ENERGY CELL UPGRADE', cost: 10000, bonus: 0.3, desc: '+30% SENTRY DRONE DURATION', tier: 4, class: 'ENGINEER', requires: ['meta_shield'] }
    },
    PRESTIGE: {
        REQ_TIER_3_COUNT: 2, // Must have both Tier 3 upgrades to prestige
        CLASSES: {
            STRIKER: { 
                id: 'striker', 
                name: 'STRIKER', 
                desc: 'Specializes in raw firepower and speed.', 
                bonus: { damage: 0.25, speed: 0.15 },
                ability: {
                    name: 'PHASE DASH',
                    desc: 'Quickly dash in your movement direction. Grants brief invulnerability.',
                    cooldown: 5000,
                    duration: 200
                },
                color: '#ff4d4d' 
            },
            GUARDIAN: { 
                id: 'guardian', 
                name: 'GUARDIAN', 
                desc: 'Focused on absolute survival and defense.', 
                bonus: { health: 0.5, shield: 25 },
                ability: {
                    name: 'KINETIC DOME',
                    desc: 'Deploy a massive energy shield that blocks all incoming damage.',
                    cooldown: 20000,
                    duration: 6000
                },
                color: '#00ffff' 
            },
            REAPER: { 
                id: 'reaper', 
                name: 'REAPER', 
                desc: 'Master of life-steal and critical hits.', 
                bonus: { crit: 0.15, lifesteal: 5 },
                ability: {
                    name: 'BLOODLUST',
                    desc: 'Double fire rate and guaranteed life-steal for a short duration.',
                    cooldown: 25000,
                    duration: 8000
                },
                color: '#ff00ff' 
            },
            ENGINEER: { 
                id: 'engineer', 
                name: 'ENGINEER', 
                desc: 'Specialist in explosives and tactical gear.', 
                bonus: { grenades: 3, explosionRadius: 0.3 },
                ability: {
                    name: 'SENTRY DRONE',
                    desc: 'Deploy an automated drone that fires at nearby enemies.',
                    cooldown: 15000,
                    duration: 10000
                },
                color: '#ffff00' 
            }
        }
    },
    EVOLUTIONS: [
        { 
            id: 'inferno_shotgun', 
            name: 'INFERNO SHOTGUN', 
            baseWeapon: 'shotgun', 
            requirement: 'burn', 
            desc: 'Pellets ignite enemies on impact.',
            color: 0xff4500
        },
        { 
            id: 'thunder_plasma', 
            name: 'THUNDER PLASMA', 
            baseWeapon: 'plasma', 
            requirement: 'electric_chain', 
            desc: 'Bolts always chain to nearby enemies.',
            color: 0x00ffff
        },
        { 
            id: 'quantum_railgun', 
            name: 'QUANTUM RAILGUN', 
            baseWeapon: 'railgun', 
            requirement: 'crit_chance', 
            desc: 'Every shot causes a kinetic shockwave.',
            color: 0xff00ff
        }
    ],
    WORLD_EVENTS: {
        METEOR_STORM: { id: 'meteor', name: 'METEOR STORM', msg: '⚠ METEOR STORM INCOMING', duration: 30 },
        ALIEN_SWARM: { id: 'swarm', name: 'ALIEN SWARM', msg: '⚠ ALIEN SWARM DETECTED', duration: 20 },
        LOW_GRAVITY: { id: 'gravity', name: 'LOW GRAVITY', msg: '⚠ GRAVITATIONAL ANOMALY', duration: 40 },
        ENERGY_SURGE: { id: 'surge', name: 'ENERGY SURGE', msg: '⚠ ENERGY SURGE: DAMAGE BOOST', duration: 25 },
        DARK_FOG: { id: 'fog', name: 'DARK FOG', msg: '⚠ ENHANCED FOG DETECTED', duration: 35 }
    },
    LEGENDARY_WEAPONS: {
        SUNFIRE_RAILGUN: { id: 'sunfire_railgun', name: 'SUNFIRE RAILGUN', base: 'railgun', color: 0xffaa00, desc: 'Massive damage + explosion on impact.' },
        PLASMA_STORM: { id: 'plasma_storm', name: 'PLASMA STORM CANNON', base: 'plasma', color: 0x00ffcc, desc: 'Extreme fire rate plasma bursts.' },
        NEUTRON_SHOTGUN: { id: 'neutron_shotgun', name: 'NEUTRON SHOTGUN', base: 'shotgun', color: 0xff00ff, desc: 'Pellets explode on contact.', sprite: 'assets/fps_neutron_shotgun_true_rear_view.webp' }
    },
    CAMPAIGNS: [
        { 
            name: "Nebula Outpost", 
            skyIndex: 0, 
            preview: 'assets/nebula_preview.webp',
            objective: "Extermination",
            objectiveDesc: "Reach the target score to clear the zone."
        },
        { 
            name: "Frozen Tundra", 
            skyIndex: 1, 
            preview: 'assets/frozen_preview.webp',
            objective: "Retrieval",
            objectiveDesc: "Collect 3 Energy Cores scattered in the tundra."
        },
        { 
            name: "Toxic Wasteland", 
            skyIndex: 2, 
            preview: 'assets/toxic_preview.webp',
            objective: "Sabotage",
            objectiveDesc: "Destroy 3 Alien Hives to neutralize the threat."
        },
        { 
            name: "Shadow Realm", 
            skyIndex: 3, 
            preview: 'assets/shadow_preview.webp',
            objective: "Retrieval",
            objectiveDesc: "Collect 3 Energy Cores to power the purification ritual."
        },
        { 
            name: "Volcanic Core", 
            skyIndex: 4, 
            preview: 'assets/volcanic_preview.webp',
            objective: "Sabotage",
            objectiveDesc: "Destroy 4 Alien Hives before they hatch."
        }
    ],
    WORKBENCH: {
        COLORS: [
            { id: 'cyan', name: 'NEON CYAN', color: 0x00ffff, cost: 0 },
            { id: 'red', name: 'BLOOD RED', color: 0xff0000, cost: 2000 },
            { id: 'green', name: 'TOXIC GREEN', color: 0x00ff7f, cost: 2000 },
            { id: 'purple', name: 'VOID PURPLE', color: 0xaa00ff, cost: 3000 },
            { id: 'gold', name: 'PRECISION GOLD', color: 0xffcc00, cost: 5000 }
        ],
        TRAILS: [
            { id: 'standard', name: 'STANDARD', decay: 0.1, cost: 0 },
            { id: 'long', name: 'LONG TRACER', decay: 0.04, cost: 3000 },
            { id: 'ghost', name: 'GHOST TRAIL', decay: 0.2, opacity: 0.3, cost: 2000 }
        ],
        STATUS_EFFECTS: [
            { id: 'none', name: 'NONE', desc: 'No additional status effect.', cost: 0 },
            { id: 'acid', name: 'ACID ROUNDS', desc: '10% chance to melt armor (2x damage for 2s).', cost: 10000 },
            { id: 'shock', name: 'SHOCK ROUNDS', desc: '10% chance to disrupt enemy logic (1s stun).', cost: 12000 },
            { id: 'slow', name: 'CRYO ROUNDS', desc: '15% chance to freeze enemy for 3s.', cost: 8000 }
        ]
    }
};
