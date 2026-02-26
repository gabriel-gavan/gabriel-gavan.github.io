/**
 * FlagState - Manages story flags and choice history
 *
 * Tracks boolean flags for story branching and records player choices
 * for potential future reference or achievements.
 */
export class FlagState {
    constructor() {
        this.flags = {};
        this.choiceHistory = [];
        this.turnCount = 0;
    }

    /**
     * Set a story flag
     * @param {string} name - Flag name
     * @param {boolean} value - Flag value (default: true)
     */
    setFlag(name, value = true) {
        this.flags[name] = value;
    }

    /**
     * Check if a flag is set
     * @param {string} name - Flag name
     * @returns {boolean}
     */
    hasFlag(name) {
        return !!this.flags[name];
    }

    /**
     * Get a flag's value
     * @param {string} name - Flag name
     * @returns {*} Flag value or undefined
     */
    getFlag(name) {
        return this.flags[name];
    }

    /**
     * Record a choice and its outcome
     * @param {string} choiceId - Choice identifier
     * @param {string} outcome - Outcome tier (success, failure, etc.)
     * @param {Object} context - Additional context (scene, beat, roll)
     */
    recordChoice(choiceId, outcome, context = {}) {
        this.choiceHistory.push({
            turn: this.turnCount,
            choiceId,
            outcome,
            ...context,
            timestamp: Date.now()
        });
        this.turnCount++;
    }

    /**
     * Get choice history
     * @returns {Array}
     */
    getHistory() {
        return [...this.choiceHistory];
    }

    /**
     * Reset all flags and history
     */
    reset() {
        this.flags = {};
        this.choiceHistory = [];
        this.turnCount = 0;
    }
}
