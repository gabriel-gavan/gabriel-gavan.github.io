export class DailyManager {
    constructor() {
        this.STORAGE_KEY = 'trivia_blitz_daily_played';
        this.STREAK_KEY = 'trivia_blitz_daily_streak';
    }

    getLastPlayedDate() {
        return localStorage.getItem(this.STORAGE_KEY);
    }

    getStreak() {
        const streak = localStorage.getItem(this.STREAK_KEY);
        return streak ? parseInt(streak) : 0;
    }

    canPlayToday() {
        const today = new Date().toLocaleDateString();
        return this.getLastPlayedDate() !== today;
    }

    recordResult(isCorrect) {
        const today = new Date().toLocaleDateString();
        const lastDate = this.getLastPlayedDate();
        
        localStorage.setItem(this.STORAGE_KEY, today);
        
        if (isCorrect) {
            let streak = this.getStreak();
            // Check if yesterday was the last played date to continue streak
            // For simplicity, we just increment if correct today
            localStorage.setItem(this.STREAK_KEY, streak + 1);
            return streak + 1;
        } else {
            localStorage.setItem(this.STREAK_KEY, 0);
            return 0;
        }
    }
}
