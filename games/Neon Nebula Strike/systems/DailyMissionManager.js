/**
 * DailyMissionManager handles generating and tracking daily challenges.
 */
export class DailyMissionManager {
    constructor() {
        this.STORAGE_KEY = 'alien_exploration_daily_mission';
        this.state = this.loadState();
        this.checkNewDay();
    }

    loadState() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        return this.generateNewMission();
    }

    saveState() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    }

    checkNewDay() {
        const today = new Date().toDateString();
        if (this.state.date !== today) {
            this.state = this.generateNewMission();
            this.saveState();
        }
    }

    generateNewMission() {
        const missions = [
            {
                id: 'kill_count',
                description: 'NEUTRALIZE 200 ENEMIES',
                target: 200,
                type: 'cumulative'
            },
            {
                id: 'no_grenades',
                description: 'COMPLETE A LEVEL WITHOUT GRENADES',
                target: 1,
                type: 'level_specific'
            },
            {
                id: 'speedrun',
                description: 'COMPLETE A LEVEL IN UNDER 3 MINUTES',
                target: 180, // seconds
                type: 'level_specific'
            },
            {
                id: 'high_accuracy',
                description: 'FINISH A LEVEL WITH >70% ACCURACY',
                target: 70,
                type: 'level_specific'
            }
        ];

        const mission = missions[Math.floor(Math.random() * missions.length)];
        return {
            date: new Date().toDateString(),
            missionId: mission.id,
            description: mission.description,
            target: mission.target,
            type: mission.type,
            progress: 0,
            completed: false,
            rewardClaimed: false
        };
    }

    updateProgress(id, value, isLevelSuccess = false) {
        if (this.state.completed || this.state.missionId !== id) return;

        if (this.state.type === 'cumulative') {
            this.state.progress += value;
            if (this.state.progress >= this.state.target) {
                this.completeMission();
            }
        } else if (this.state.type === 'level_specific' && isLevelSuccess) {
            // value is the achieved metric (e.g., time, accuracy, or boolean-like 1)
            let success = false;
            if (id === 'no_grenades' && value === 0) success = true; // value is grenades used
            if (id === 'speedrun' && value <= this.state.target) success = true; // value is seconds
            if (id === 'high_accuracy' && value >= this.state.target) success = true; // value is %

            if (success) {
                this.state.progress = 1;
                this.completeMission();
            }
        }
        this.saveState();
    }

    completeMission() {
        this.state.completed = true;
        this.state.progress = this.state.target;
        // Broadcast completion for UI
        window.dispatchEvent(new CustomEvent('dailyMissionCompleted', { detail: this.state }));
    }

    getReward() {
        if (this.state.completed && !this.state.rewardClaimed) {
            this.state.rewardClaimed = true;
            this.saveState();
            return { xp: 5000, score: 10000 };
        }
        return null;
    }
}
