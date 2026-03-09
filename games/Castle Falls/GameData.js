export const CAMPAIGNS = [
    { 
        name: "The Gloomy Entrance", 
        levels: Array.from({ length: 20 }, (_, i) => i + 1), 
        icon: "🏰",
        env: { wall: 0x888888, floor: 0x444444, fog: 0x1a1a24, ambient: 0xffffff }
    },
    { 
        name: "The Whispering Hallways", 
        levels: Array.from({ length: 20 }, (_, i) => i + 21), 
        icon: "👻",
        env: { wall: 0x668866, floor: 0x334433, fog: 0x1a241a, ambient: 0xccffcc }
    },
    { 
        name: "The Dungeon Depths", 
        levels: Array.from({ length: 20 }, (_, i) => i + 41), 
        icon: "⛓️",
        env: { wall: 0x886666, floor: 0x443333, fog: 0x241a1a, ambient: 0xffcccc }
    },
    { 
        name: "The Iron Corridors", 
        levels: Array.from({ length: 20 }, (_, i) => i + 61), 
        icon: "⚔️",
        env: { wall: 0x666688, floor: 0x333344, fog: 0x1a1a24, ambient: 0xccccff }
    },
    { 
        name: "The Ghostly Gallery", 
        levels: Array.from({ length: 20 }, (_, i) => i + 81), 
        icon: "🖼️",
        env: { wall: 0x888866, floor: 0x444433, fog: 0x24241a, ambient: 0xffffcc }
    },
    { 
        name: "The Forgotten Vaults", 
        levels: Array.from({ length: 20 }, (_, i) => i + 101), 
        icon: "💎",
        env: { wall: 0x668888, floor: 0x334444, fog: 0x1a2424, ambient: 0xccffff }
    },
    { 
        name: "The Knight's Vigil", 
        levels: Array.from({ length: 20 }, (_, i) => i + 121), 
        icon: "🛡️",
        env: { wall: 0x777777, floor: 0x333333, fog: 0x1a1a1a, ambient: 0xffffff }
    },
    { 
        name: "The Shadowed Balcony", 
        levels: Array.from({ length: 20 }, (_, i) => i + 141), 
        icon: "🌙",
        env: { wall: 0x776655, floor: 0x332211, fog: 0x1a140a, ambient: 0xffddcc }
    },
    { 
        name: "The Alchemist's Lab", 
        levels: Array.from({ length: 20 }, (_, i) => i + 161), 
        icon: "🧪",
        env: { wall: 0x667788, floor: 0x223344, fog: 0x0a141a, ambient: 0xcceeff }
    },
    { 
        name: "The High Throne Room", 
        levels: Array.from({ length: 20 }, (_, i) => i + 181), 
        icon: "👑",
        env: { wall: 0x998855, floor: 0x443311, fog: 0x241a0a, ambient: 0xffeebb }
    }
];

export class GameState {
    constructor() {
        this.loadProgress();
    }

    loadProgress() {
        const saved = localStorage.getItem('castle_obby_progress');
        if (saved) {
            this.progress = JSON.parse(saved);
            if (!this.progress.leaderboard) this.progress.leaderboard = [];
        } else {
            this.progress = {
                unlockedCampaigns: [0], // First campaign unlocked
                completedLevels: [],
                leaderboard: []
            };
        }
    }

    saveScore(level, distance) {
        const score = {
            level,
            distance: Math.floor(distance),
            date: new Date().toLocaleDateString()
        };
        this.progress.leaderboard.push(score);
        // Sort by level then distance
        this.progress.leaderboard.sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            return b.distance - a.distance;
        });
        // Keep top 5
        this.progress.leaderboard = this.progress.leaderboard.slice(0, 5);
        this.saveProgress();
    }

    saveProgress() {
        localStorage.setItem('castle_obby_progress', JSON.stringify(this.progress));
    }

    completeLevel(levelNum) {
        if (!this.progress.completedLevels.includes(levelNum)) {
            this.progress.completedLevels.push(levelNum);
            
            // Unlock next campaign if all levels in current campaign are cleared
            const campaignIndex = CAMPAIGNS.findIndex(c => c.levels.includes(levelNum));
            if (campaignIndex !== -1) {
                const campaign = CAMPAIGNS[campaignIndex];
                const allLevelsCleared = campaign.levels.every(lvl => this.progress.completedLevels.includes(lvl));
                
                if (allLevelsCleared && campaignIndex < CAMPAIGNS.length - 1) {
                    const nextCampaign = campaignIndex + 1;
                    if (!this.progress.unlockedCampaigns.includes(nextCampaign)) {
                        this.progress.unlockedCampaigns.push(nextCampaign);
                    }
                }
            }
            this.saveProgress();
        }
    }

    isLevelUnlocked(levelNum) {
        // A level is unlocked if its parent campaign is unlocked
        const campaignIndex = CAMPAIGNS.findIndex(c => c.levels.includes(levelNum));
        return this.progress.unlockedCampaigns.includes(campaignIndex);
    }

    getLevelDistance(levelNum) {
        return 100 + (levelNum - 1) * 30;
    }
}
