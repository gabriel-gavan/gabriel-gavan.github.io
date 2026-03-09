export const CONFIG = {
    PLAYER: {
        MOVE_SPEED: 14, 
        JUMP_FORCE: 16, 
        GRAVITY: 35,
        START_POS: { x: 0, y: 2.5, z: -10 },
        MAX_HEALTH: 100,
        INITIAL_LIVES: 3,
        IFRAME_DURATION: 1.5, // Seconds of invulnerability after hit
        MAGIC_UNLOCK_LEVEL: 100, // Shooting is locked until this level
        WALL_RUN: {
            GRAVITY_MULTIPLIER: 0.15, // How much gravity is reduced
            MAX_DURATION: 1.5,        // Max time player can stay on wall
            MIN_SPEED: 5,             // Minimum forward speed to wall run
            JUMP_BOOST_Y: 14,         // Vertical jump force off wall
            JUMP_BOOST_X: 10          // Horizontal push-away force
        }
    },
    LEVEL: {
        SEGMENT_LENGTH: 15, // Shorter segments for more precise generation
        WALL_HEIGHT: 15,
        HALLWAY_WIDTH: 10,
        MAX_SEGMENTS: 10, 
        DESPAWN_DISTANCE: 40,
        STAGE_DISTANCE: 100, // Distance for each stage completion
        DIFFICULTY_STEP_DISTANCE: 250 // Every 250m, difficulty increases
    },
    ASSETS: {
        STONE_WALL: 'assets/stone-wall-texture.webp',
        STONE_FLOOR: 'assets/stone-floor-texture.webp',
        TORCH_FIRE: 'assets/torch-fire.webp',
        CASTLE_BG: 'assets/castle-falls-thumbnail.webp',
        CAMPAIGN_BG: 'assets/campaign-selection-bg.webp',
        THUMBNAIL: 'assets/castle-falls-thumbnail.webp'
    },
    COLORS: {
        VOID: 0x1a1a24, // Slightly lighter dark background
        FOG: 0x1a1a24,
        ACCENT: 0xff4400
    }
};
