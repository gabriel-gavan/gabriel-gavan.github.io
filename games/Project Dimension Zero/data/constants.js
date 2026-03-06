export const AVATARS = [
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Felix",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Jack",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Luna",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Milo",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Nova"
];

export const BADGES = [
  {
    id: "GRID_INITIATE",
    name: "GRID INITIATE",
    description: "Solve your first neon mystery.",
    icon: "🔌",
    color: "#00ffff"
  },
  {
    id: "CODE_BREAKER",
    name: "CODE BREAKER",
    description: "Solve 5 different puzzles.",
    icon: "🔓",
    color: "#ff00ff"
  },
  {
    id: "CYBER_MASTER",
    name: "CYBER MASTER",
    description: "Solve 10 different puzzles.",
    icon: "assets/neon-chip-icon.png.webp",
    isImage: true,
    color: "#39ff14"
  },
  {
    id: "SPEED_DEMON",
    name: "SPEED DEMON",
    description: "Solve a puzzle in under 15 seconds.",
    icon: "⚡",
    color: "#fefe33"
  },
  {
    id: "PURIST",
    name: "THE PURIST",
    description: "Solve 3 puzzles without using any hints.",
    icon: "🚫",
    color: "#ff4d4d"
  },
  {
    id: "HACK_STREAK",
    name: "GHOST IN THE SHELL",
    description: "Complete 3 successful hacks in a row without a single failure.",
    icon: "👻",
    color: "#a020f0"
  },
  {
    id: "SHARD_HOARDER",
    name: "SHARD HOARDER",
    description: "Accumulate a total of 500 Neon Shards.",
    icon: "💎",
    color: "#00ffcc"
  },
  {
    id: "EARLY_BIRD",
    name: "EARLY ADOPTER",
    description: "Complete 5 different daily contracts.",
    icon: "🌅",
    color: "#ffa500"
  },
  {
    id: "CENTURY_AGENT",
    name: "CENTURY AGENT",
    description: "Reach week 100 in the Neon Grid.",
    icon: "💯",
    color: "#ffffff"
  },
  {
    id: "PERFECT_BYPASS",
    name: "PERFECT BYPASS",
    description: "Complete a hacking minigame with more than 5 seconds remaining.",
    icon: "🎯",
    color: "#39ff14"
  }
];

export const SKILLS = [
  {
    id: "TIME_DILATION",
    name: "TIME DILATION",
    description: "Slows down the hacking timer by 20% per level.",
    maxLevel: 3,
    costPerLevel: 50,
    icon: "⏳"
  },
  {
    id: "SIGNAL_BOOSTER",
    name: "SIGNAL BOOSTER",
    description: "Increases starting hacking time by 2s per level.",
    maxLevel: 3,
    costPerLevel: 40,
    icon: "📡"
  },
  {
    id: "DATA_MINER",
    name: "DATA MINER",
    description: "Earn 25% more Neon Shards per puzzle level.",
    maxLevel: 2,
    costPerLevel: 60,
    icon: "💎"
  }
];

export const SHOP_ITEMS = [
  {
    id: "THEME_EMERALD",
    name: "EMERALD MATRIX",
    type: "THEME",
    description: "Transforms the grid into a deep emerald green matrix.",
    cost: 150,
    colors: { cyan: "#00ff66", magenta: "#00cc44" }
  },
  {
    id: "THEME_BLOOD",
    name: "BLOOD DIAMOND",
    type: "THEME",
    description: "A high-alert crimson theme for elite enforcers.",
    cost: 200,
    colors: { cyan: "#ff0000", magenta: "#990000" }
  },
  {
    id: "THEME_GOLD",
    name: "GOLDEN AGE",
    type: "THEME",
    description: "The ultimate prestige theme for legendary agents.",
    cost: 500,
    colors: { cyan: "#fefe33", magenta: "#cc9900" }
  },
  {
    id: "FRAME_NEON",
    name: "NEON PULSE",
    type: "FRAME",
    description: "An animated neon border for your agent avatar.",
    cost: 100,
    style: { border: "2px solid #ff00ff", boxShadow: "0 0 10px #ff00ff" }
  },
  {
    id: "FRAME_GOLD",
    name: "ELITE SHIELD",
    type: "FRAME",
    description: "A thick golden frame reserved for top-tier agents.",
    cost: 250,
    style: { border: "4px double #fefe33", boxShadow: "0 0 15px #fefe33" }
  }
];