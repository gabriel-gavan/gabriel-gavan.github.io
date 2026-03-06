export const CONFIG = {
    PLAYER: {
        MOVE_SPEED: 12,
        JUMP_FORCE: 16,
        GRAVITY: 35,
        HEIGHT: 1.8,
        WIDTH: 0.8,
        MAX_HEALTH: 100,
        INVINCIBILITY_DURATION: 5
    },
    LEVEL_TYPES: {
        NORMAL: 'normal',
        LAVA: 'lava',
        CHECKPOINT: 'checkpoint',
        SPEED_BOOST: 'speedBoost',
        INVINCIBILITY: 'invincibility',
        WIN: 'win',
        COIN: 'coin',
        SPINNER: 'spinner',
        LASER: 'laser',
        MOVING: 'moving',
        BLADE: 'blade',
        ROLLER: 'roller',
        HAMMER: 'hammer',
        LASER_EMITTER: 'laser_emitter'
    },
    COLORS: {
        SKY: 0x000000,
        PLATFORM: 0x222222,
        NEON_BLUE: 0x00ffff,
        NEON_PINK: 0xff00ff,
        NEON_GREEN: 0x39ff14,
        LAVA: 0xff0000,
        CHECKPOINT: 0x00ff00,
        SPEED_BOOST: 0xffff00,
        INVINCIBILITY: 0x00ffff,
        WIN: 0xffd700,
        PLAYER: 0xffffff,
        COIN: 0xffd700,
        LASER: 0xff0000
    },
    SKYBOX_URL: 'assets/synthwave-sunset-skybox.webp',
    MENU_BACKGROUND_URL: 'assets/main-menu-background.webp',
    HERO_BACKGROUND_URL: 'assets/game-hero-background.webp',
    CRYSTAL_URL: 'assets/floating-neon-crystal.webp',
    PLATFORM_TEXTURE: 'assets/scifi-platform-texture.webp',
    HAZARD_TEXTURE: 'assets/hazard-lava-texture.webp',
    SPEED_PAD_TEXTURE: 'assets/speed-boost-pad-texture.webp',
    INVINCIBILITY_TEXTURE: 'assets/shield-powerup-icon.webp',
    COIN_TEXTURE: 'assets/golden-coin-icon.webp',
    LASER_BASE_TEXTURE: 'assets/laser-emitter-texture.webp',
    STAIR_TEXTURE: 'assets/neon-stairs-texture.webp',
    HAZARD_STRIPES_TEXTURE: 'assets/hazard-warning-stripes.webp',
    CIRCUIT_BLUE_TEXTURE: 'assets/neon-circuit-blue-texture.webp',
    CAMPAIGNS: [
        { id: 0, name: 'Neon Genesis', color: 0x00ffff, difficulty: 0, description: 'Master the basics in the glowing void.' },
        { id: 1, name: 'Circuit Surge', color: 0x39ff14, difficulty: 5, description: 'Speed up through the mechanical heart.' },
        { id: 2, name: 'Lava Labyrinth', color: 0xff4d00, difficulty: 12, description: 'Heat rises as the floor disappears.' },
        { id: 3, name: 'Laser Lockdown', color: 0xff0000, difficulty: 20, description: 'Precision is your only survival tool.' },
        { id: 4, name: 'Gravity Glitch', color: 0xbf00ff, difficulty: 30, description: 'Verticality reaches new heights.' },
        { id: 5, name: 'Nebula Nightmare', color: 0xff00ff, difficulty: 45, description: 'The ultimate test of a Neon Legend.' }
    ],
    CAMPAIGN: {
        MILESTONES: [
            { level: 5, id: 'neon_glow', name: 'Neon Glow', reward: 'Cyan Emissive Effect' },
            { level: 15, id: 'trail', name: 'Speed Trail', reward: 'Neon Motion Trail' },
            { level: 30, id: 'crown', name: 'Gold Crown', reward: 'Royal Headgear' },
            { level: 50, id: 'legend_cape', name: 'Legend Cape', reward: 'Neon Flowing Cape' }
        ]
    }
};
