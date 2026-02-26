export const Config = {
    // Game Physics
    CAR_ACCELERATION: 0.15,
    CAR_DECELERATION: 0.98, // Friction
    CAR_MAX_SPEED: 1.2,
    CAR_REVERSE_SPEED: 0.5,
    CAR_STEER_SPEED: 0.045,
    CAR_DRIFT_FACTOR: 0.95,

    // AI Settings
    AI_ACCELERATION: 0.1,
    AI_STEER_SPEED: 0.05,
    AI_WAYPOINT_THRESHOLD: 10,
    AI_NAMES: ['Xenon', 'Cypher', 'Nova', 'Vektor', 'Razor', 'Astra', 'Echo', 'DriftKing', 'Z-100', 'Void'],

    // Environment
    TRACK_WIDTH: 12,
    LAPS_TO_WIN: 3,
    DEFAULT_PLAYER_NAME: 'Pilot',

    // Visuals
    COLORS: {
        PLAYER: 0x00ffff, // Cyan
        AI1: 0xff00ff,   // Magenta
        AI2: 0xffff00,   // Yellow
        TRACK: 0x111111,
        BOOST: 0x00ff00,
        OIL: 0x333333
    },

    ASSETS: {
        SKYBOX: 'assets/cyberpunk_city_skybox.webp',
        ROAD: 'assets/road_texture.webp',
        PLAYER_CAR: 'assets/player_car_rear.webp',
        AI_CAR_1: 'assets/ai_car_1_rear.webp',
        AI_CAR_2: 'assets/ai_car_2_rear.webp',
        BOOST: 'assets/boost_pad_sprite.webp',
        OIL: 'assets/oil_slick_sprite.webp'
    }
};
