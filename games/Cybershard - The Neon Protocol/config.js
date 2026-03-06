export const PUZZLE_TYPES = [
    { id: 'swap', name: 'Tile Swap', description: 'Swap any two tiles to fix the image.' },
    { id: 'slide', name: 'Sliding Puzzle', description: 'Classic 15-puzzle. Slide tiles into the empty slot.' },
    { id: 'rotate', name: 'Rotate Tiles', description: 'Click to rotate tiles into the correct orientation.' },
    { id: 'blur', name: 'Blur Reveal', description: 'The image is blurred. Every correct move clears the vision.' },
    { id: 'memory', name: 'Neural Memory', description: 'Find matching pairs of cyberpunk icons.' },
    { id: 'scatter', name: 'Classic Jigsaw', description: 'Drag and drop pieces to reconstruct the data.' },
];

export const PUZZLES = [
    {
        name: "Netrunner",
        url: "assets/cyberpunk-netrunner.png.webp",
        size: 3,
        type: "scatter",
        time: 120
    },
    {
        name: "Neon Market",
        url: "assets/neon-street-market.png.webp",
        size: 4,
        type: "scatter",
        time: 180
    },
    {
        name: "Pulse Car",
        url: "assets/cyber-pulse-car.png.webp",
        size: 3,
        type: "rotate",
        time: 90
    },
    {
        name: "Neural Bridge",
        url: "assets/neural-bridge.png.webp",
        size: 4,
        type: "blur",
        time: 150
    },
    {
        name: "Cyber Tower",
        url: "assets/neon-cyber-tower.png.webp",
        size: 3,
        type: "swap",
        time: 100
    },
    {
        name: "Katana Shop",
        url: "assets/cyber-katana-shop.png.webp",
        size: 4,
        type: "scatter",
        time: 200
    },
    {
        name: "Glitch Port",
        url: "assets/neon-glitch-port.png.webp",
        size: 3,
        type: "memory",
        time: 120
    },
    {
        name: "Owl Droid",
        url: "assets/cyber-owl-droid.png.webp",
        size: 3,
        type: "rotate",
        time: 90
    },
    {
        name: "Data Shard",
        url: "assets/neon-data-shard.png.webp",
        size: 4,
        type: "blur",
        time: 180
    },
    {
        name: "City Rooftop",
        url: "assets/cyber-city-rooftop.png.webp",
        size: 4,
        type: "scatter",
        time: 220
    },
    {
        name: "Cyber City",
        url: "assets/cyber-city-1.webp",
        size: 3,
        type: "scatter",
        time: 120
    },
    {
        name: "Neon Dragon",
        url: "assets/neon-dragon-1.webp",
        size: 3,
        type: "rotate",
        time: 60
    },
    {
        name: "Neural Samurai",
        url: "assets/neon-samurai-1.webp",
        size: 4,
        type: "swap",
        time: 120
    },
    {
        name: "Orbital Station",
        url: "assets/space-station-1.webp",
        size: 4,
        type: "slide",
        time: 180
    },
    {
        name: "Neural Bot",
        url: "assets/cyber-robot-1.webp",
        size: 3,
        type: "blur",
        time: 120
    },
    {
        name: "Data Cache",
        url: "assets/cyberpunk-bg.png.webp",
        size: 4,
        type: "memory",
        time: 90
    }
];

export const SKYBOX_URL = "assets/neon-matrix-skybox.png.webp";
export const COLORS = {
    background: "#020617",
    tileBorder: "#38bdf8",
    glow: "rgba(56,189,248,0.5)",
    successGlow: "#22c55e",
    accent: "#f472b6"
};

export const TILE_SPACING = 0.02;
export const TILE_SIZE = 2.5;
export const ANIMATION_SPEED = 0.15;
