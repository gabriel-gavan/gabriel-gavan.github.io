export class LeaderboardManager {
    constructor() {
        this.API_URL = "https://neonnebulastrikeleaderboard.gabi-gabz.workers.dev";
        this.NAME_KEY = 'alien_exploration_player_name';
		this.ID_KEY = 'alien_exploration_player_id';
	
    }
	getPlayerId() {
		return localStorage.getItem(this.ID_KEY);
	}
    getPlayerName() {
        return localStorage.getItem(this.NAME_KEY) || '';
    }

    setPlayerName(name) {
        localStorage.setItem(this.NAME_KEY, name);
    }
	registerPlayer(name) {
		const existingId = localStorage.getItem(this.ID_KEY);

		// If already registered → only update name
		if (existingId) {
			localStorage.setItem(this.NAME_KEY, name);
			return existingId;
		}

		// Create NEW player
		const id = "P-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);

		localStorage.setItem(this.ID_KEY, id);
		localStorage.setItem(this.NAME_KEY, name);

		return id;
	}
    async submitScore(name, score, level) {
		try {
			const playerId = this.getPlayerId();

			await fetch(`${this.API_URL}/submit`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					id: playerId,   // 👈 NEW
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

	async isNameTaken(name) {
		const scores = await this.getGlobalScores();

		return scores.some(s => 
			s.name.toLowerCase() === name.toLowerCase()
		);
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