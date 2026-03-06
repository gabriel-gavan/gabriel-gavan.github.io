export class LeaderboardManager {
    constructor() {
        this.STORAGE_KEY = 'trivia_blitz_leaderboard';
        this.MAX_ENTRIES = 5;
    }

    getScores() {
        const scores = localStorage.getItem(this.STORAGE_KEY);
        return scores ? JSON.parse(scores) : [];
    }

    saveScore(name, score) {
        const scores = this.getScores();
        scores.push({
            name: name || 'Anonymous Player',
            score: score,
            date: new Date().toLocaleDateString()
        });

        // Sort descending and keep top N
        scores.sort((a, b) => b.score - a.score);
        const topScores = scores.slice(0, this.MAX_ENTRIES);
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(topScores));
        return topScores;
    }

    isHighScore(score) {
        const scores = this.getScores();
        if (scores.length < this.MAX_ENTRIES) return true;
        return score > scores[scores.length - 1].score;
    }
}
