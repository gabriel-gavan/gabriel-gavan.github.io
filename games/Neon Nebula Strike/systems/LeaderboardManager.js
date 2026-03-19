export class LeaderboardManager {
    constructor() {
        this.API_URL = "https://neonnebulastrikeleaderboard.gabi-gabz.workers.dev";
        this.NAME_KEY = 'alien_exploration_player_name';
    }

    getPlayerName() {
        return localStorage.getItem(this.NAME_KEY) || '';
    }

    setPlayerName(name) {
        localStorage.setItem(this.NAME_KEY, name);
    }

    async submitScore(name, score, level) {
        try {
            await fetch(`${this.API_URL}/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    score,
                    level
                })
            });
        } catch (e) {
            console.log("Submit error:", e);
        }
    }

    async getGlobalScores() {
		try {
			const res = await fetch(`${this.API_URL}/leaderboard`);
			const data = await res.json();

			return Array.isArray(data) ? data : [];
		} catch (e) {
			console.log("Fetch error:", e);
			return [];
		}
	}

		
	getPlayerRank(scores = []) {
		const playerName = this.getPlayerName();

    if (!scores || scores.length === 0) return 'N/A';

		const rank = scores.findIndex(s => s.name === playerName);
		return rank !== -1 ? rank + 1 : 'N/A';
    }
	async getLocalBest() {
		const scores = await this.getGlobalScores();
		return scores.length > 0 ? scores[0].score : 0;
	}
}