export const CONFIG = {
    LANES: [4, 0, -4], // X positions for the 3 lanes (re-aligned for +Z flow)
    LANE_SWITCH_SPEED: 15,
    INITIAL_MOVE_SPEED: 25,
    SPEED_INCREMENT: 0.1,
    MAX_SPEED: 60,
    JUMP_FORCE: 14, // Increased from 12 for better clearance
    GRAVITY: 35,
    PLAYER_HEIGHT: 1.5,
    TRACK_SEGMENT_LENGTH: 50,
    TRACK_SEGMENTS_COUNT: 5,
    COMBO_DURATION: 2.0, // Seconds until combo resets
    COMBO_THRESHOLDS: [10, 25, 50, 100], // Hits to reach x2, x3, x4, x5
    OBSTACLE_SPAWN_INTERVAL: 1.5, // seconds
    OBSTACLE_TYPES: {
        CUBE: 'cube',
        BARRIER: 'barrier', // Needs jump
        LOW_BAR: 'low_bar', // Needs slide
        TRAIN: 'train' // Big moving obstacle
    },
    ITEMS: {
        COIN: 'coin',
        KEY: 'key',
        MAGNET: 'magnet',
        JETPACK: 'jetpack',
        SHIELD: 'shield',
        BOOST: 'boost',
        SUPER_JUMP: 'super_jump',
        MULTIPLIER: 'multiplier',
        HOVERBOARD: 'hoverboard'
    },
    DURATIONS: {
        MAGNET: 10,
        JETPACK: 8,
        SHIELD: 15,
        BOOST: 5,
        SUPER_JUMP: 10,
        MULTIPLIER: 15,
        HOVERBOARD: 20
    },
    COLORS: {
        PLAYER: 0x00ffff,
        TRACK: 0x050510,
        LANE_GLOW: 0x00ffff,
        OBSTACLE: 0xff00ff,
        BARRIER: 0xffaa00,
        LOW_BAR: 0x00ff00,
        TRAIN: 0x0088ff,
        COIN: 0xffff00,
        KEY: 0xff00ff,
        MAGNET: 0xff0000,
        JETPACK: 0x00ff00,
        SHIELD: 0x0000ff,
        BOOST: 0xffffff,
        SUPER_JUMP: 0xff00aa,
        MULTIPLIER: 0x00aaff,
        HOVERBOARD: 0xffffff
    },
    WORLDS: {
        NEON: {
            name: 'Neon City',
            trackColor: 0x111122,
            wallColor: 0xff00ff,
            pillarColor: 0x00ffff,
            fogColor: 0x220022
        },
        CYBER: {
            name: 'Cyber Void',
            trackColor: 0x001100,
            wallColor: 0x00ff00,
            pillarColor: 0xff0000,
            fogColor: 0x002200
        },
        RETRO: {
            name: 'Retro Wave',
            trackColor: 0x221100,
            wallColor: 0xffff00,
            pillarColor: 0xff00ff,
            fogColor: 0x221100
        }
    },
    SKINS: {
        NONE: { id: 'none', name: 'Original', cost: 0, color: 0xffffff, noEquipment: true },
        DEFAULT: { id: 'default', name: 'Cyan', cost: 0, color: 0x00ffff },
        GOLD: { id: 'gold', name: 'Gold', cost: 1000, color: 0xffd700 },
        NEON: { id: 'neon', name: 'Neon', cost: 2500, color: 0xff00ff },
        STEALTH: { id: 'stealth', name: 'Stealth', cost: 5000, color: 0x333333 },
        LEGEND: { id: 'legend', name: 'Legend', cost: 10000, color: 0xffffff }
    },
    BOARDS: {
        NONE: { id: 'none', name: 'No Board', cost: 0, color: 0x000000, invisible: true },
        DEFAULT: { id: 'default', name: 'Basic', cost: 0, color: 0xffffff },
        FLAME: { id: 'flame', name: 'Flame', cost: 1500, color: 0xff4500 },
        WAVE: { id: 'wave', name: 'Wave', cost: 3000, color: 0x00ffcc },
        ROYAL: { id: 'royal', name: 'Royal', cost: 6000, color: 0x8a2be2 }
    },
    UPGRADES: {
        MAGNET: { id: 'magnet', name: 'Magnet Duration', baseCost: 500, increment: 500, maxLevel: 5 },
        SHIELD: { id: 'shield', name: 'Shield Duration', baseCost: 800, increment: 800, maxLevel: 5 },
        MULTIPLIER: { id: 'multiplier', name: '2x Multiplier', baseCost: 1000, increment: 1000, maxLevel: 5 },
        HOVERBOARD: { id: 'hoverboard', name: 'Hoverboard Time', baseCost: 1200, increment: 1200, maxLevel: 5 }
    },
    MISSIONS: [
        { id: 'coins_daily', text: 'Collect 200 Coins', target: 200, reward: 100, type: 'coins' },
        { id: 'jumps_daily', text: 'Jump 50 Times', target: 50, reward: 150, type: 'jumps' },
        { id: 'distance_daily', text: 'Run 2000m', target: 2000, reward: 200, type: 'distance' },
        { id: 'slides_daily', text: 'Slide 30 Times', target: 30, reward: 120, type: 'slides' }
    ],
    LEVELS: [
        { minCoins: 0, title: 'Novice' },
        { minCoins: 500, title: 'Runner' },
        { minCoins: 2000, title: 'Pro' },
        { minCoins: 5000, title: 'Elite' },
        { minCoins: 10000, title: 'Legend' }
    ],
    ASSETS: {
        SKYBOX: 'assets/cyberpunk-towering-skyline.webp',
        CITY_FLOOR_TEXTURE: 'assets/cyberpunk-city-floor-texture.webp',
        TRACK_TEXTURE: 'assets/track-grid-texture.webp',
        BARRIER_TEXTURE: 'assets/energy-barrier-obstacle.webp',
        PLAYER_FRONT_TEXTURE: 'assets/player-forward-idle.webp',
        PLAYER_BACK_TEXTURE: 'assets/player-back-idle-v2.webp',
        PLAYER_FRONT_RUN_TEXTURES: [
            'assets/player-run-f1.webp',
            'assets/player-run-f2.webp',
            'assets/player-run-f3.webp',
            'assets/player-run-f4.webp',
            'assets/player-run-f5.webp',
            'assets/player-run-f6.webp',
            'assets/player-run-f7.webp',
            'assets/player-run-f8.webp'
        ],
        PLAYER_JUMP_TEXTURE: 'assets/player-forward-jump-dynamic.webp',
        PLAYER_SLIDE_TEXTURE: 'assets/high-fidelity-player-slide-back.webp',
        PLAYER_FRONT_SLIDE_TEXTURE: 'assets/high-fidelity-player-slide-back.webp',
        PLAYER_CRASH_TEXTURE: 'assets/player-forward-crash.webp',
        COIN_TEXTURE: 'assets/aaa-gold-coin.webp',
        TRAIN_TEXTURE: 'assets/aaa-train-obstacle.webp',
        TRAIN_FRONT_TEXTURE: 'assets/cyberpunk-train-front-v3.webp',
        TRAIN_SIDE_TEXTURE: 'assets/cyberpunk-train-side-v2.webp',
        BUILDING_TEXTURE: 'assets/neon-building-texture.webp',
        ICONS: {
            MAGNET: 'assets/aaa-magnet-powerup.webp',
            JETPACK: 'assets/aaa-jetpack-powerup.webp',
            SNEAKERS: 'assets/powerup-sneakers-icon.webp',
            HOVERBOARD: 'assets/aaa-hoverboard-powerup.webp',
            SHIELD: 'assets/powerup-shield-icon.webp',
            COIN: 'assets/neon-coin-gold.webp'
        },
        CONE_TEXTURE: 'assets/hazard-red-cone.webp',
        CRATE_TEXTURE: 'assets/cyberpunk-obstacle-crate.webp',
        ARROW_TEXTURE: 'assets/neon-arrow-decal.webp',
        PARTICLE_TEXTURE: 'assets/neon-particle-star.webp'
    }
};