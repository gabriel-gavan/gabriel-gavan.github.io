/**
 * LeaderboardManager handles score persistence and simulated global rankings.
 */
export class LeaderboardManager {
    constructor() {
        this.STORAGE_KEY = 'alien_exploration_highscores';
        this.GLOBAL_STORAGE_KEY = 'alien_exploration_simulated_global';
        this.NAME_KEY = 'alien_exploration_player_name';
        this.localScores = this.loadLocalScores();
        this.simulatedGlobalScores = this.initSimulatedGlobal();
    }

    getPlayerName() {
        return localStorage.getItem(this.NAME_KEY) || '';
    }

    setPlayerName(name) {
        localStorage.setItem(this.NAME_KEY, name);
    }

    loadLocalScores() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    saveLocalScores() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.localScores));
    }

    initSimulatedGlobal() {
        // Expanded list of AI players for a more "Global" feel
        const defaultGlobal = [
            { name: 'Xenon-7', score: 250000, level: 'Volcanic Core (25)' },
            { name: 'Star-Striker', score: 185000, level: 'Shadow Realm (18)' },
            { name: 'Void-Walker', score: 142000, level: 'Toxic Wasteland (14)' },
            { name: 'Nova-Prime', score: 98000, level: 'Frozen Tundra (10)' },
            { name: 'Echo-Lead', score: 75000, level: 'Nebula Outpost (8)' },
            { name: 'Ghost-99', score: 54000, level: 'Nebula Outpost (5)' },
            { name: 'Rogue-1', score: 32000, level: 'Nebula Outpost (3)' },
            { name: 'Cypher', score: 28000, level: 'Nebula Outpost (2)' },
            { name: 'Vector', score: 21000, level: 'Nebula Outpost (2)' },
            { name: 'Zephyr', score: 15000, level: 'Nebula Outpost (1)' }
        ];

        const storedGlobal = localStorage.getItem(this.GLOBAL_STORAGE_KEY);
        let global = storedGlobal ? JSON.parse(storedGlobal) : defaultGlobal;

        // Ensure player's best name is updated in the global list if they changed it
        const playerName = this.getPlayerName();
        const playerInGlobal = global.find(s => s.isPlayer);
        if (playerInGlobal && playerName) {
            playerInGlobal.name = playerName;
        }

        // Ensure player's best local score is also in the "Global" list for simulation
        if (this.localScores.length > 0) {
            const bestLocal = this.localScores[0];
            if (!playerInGlobal) {
                global.push({ ...bestLocal, isPlayer: true, name: playerName || 'Anonymous Pilot' });
            } else if (bestLocal.score > playerInGlobal.score) {
                playerInGlobal.score = bestLocal.score;
                playerInGlobal.level = bestLocal.level;
            }
        }

        return global.sort((a, b) => b.score - a.score);
    }

    submitScore(name, score, level) {
        const newEntry = { 
            name: name || 'Anonymous Pilot', 
            score, 
            level, 
            date: new Date().toISOString() 
        };

        // Add to local
        this.localScores.push(newEntry);
        this.localScores.sort((a, b) => b.score - a.score);
        this.localScores = this.localScores.slice(0, 10); // Keep top 10 local
        this.saveLocalScores();

        // Update Simulated Global
        const playerInGlobal = this.simulatedGlobalScores.find(s => s.isPlayer);
        if (!playerInGlobal) {
            this.simulatedGlobalScores.push({ ...newEntry, isPlayer: true });
        } else if (score > playerInGlobal.score) {
            playerInGlobal.score = score;
            playerInGlobal.level = level;
            playerInGlobal.name = name || 'Anonymous Pilot';
        }

        this.simulatedGlobalScores.sort((a, b) => b.score - a.score);
        localStorage.setItem(this.GLOBAL_STORAGE_KEY, JSON.stringify(this.simulatedGlobalScores));
        
        return newEntry;
    }

    getGlobalScores() {
        return this.simulatedGlobalScores;
    }

    getLocalBest() {
        return this.localScores.length > 0 ? this.localScores[0].score : 0;
    }

    getPlayerRank() {
        const rank = this.simulatedGlobalScores.findIndex(s => s.isPlayer);
        return rank !== -1 ? rank + 1 : 'N/A';
    }
}
