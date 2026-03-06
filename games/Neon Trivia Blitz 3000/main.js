import { GameScene } from './GameScene.js';
import { TriviaEngine } from './TriviaEngine.js';
import { UIController } from './UIController.js';
import { AudioManager } from './AudioManager.js';
import { LeaderboardManager } from './LeaderboardManager.js';
import { DailyManager } from './DailyManager.js';
import { CONFIG } from './config.js';

class TriviaGame {
    constructor() {
        this.gameScene = new GameScene(document.body);
        this.triviaEngine = new TriviaEngine();
        this.audioManager = new AudioManager();
        this.leaderboard = new LeaderboardManager();
        this.dailyManager = new DailyManager();
        
        this.uiController = new UIController(
            (answer) => this.handleAnswerSubmit(answer),
            (categoryId) => this.startGame(categoryId),
            () => this.startGame(),
            (name) => this.handleSaveScore(name),
            () => this.playDailyChallenge(),
            (type) => this.handleUseLifeline(type),
            () => this.showWelcome()
        );

        this.isPaused = false;
        this.isDailyMode = false;
        this.lastTime = 0;
        this.animate = this.animate.bind(this);
        
        window.addEventListener('keydown', (e) => {
            if (['1', '2', '3', '4'].includes(e.key)) {
                const index = parseInt(e.key) - 1;
                const buttons = document.querySelectorAll('.answer-btn');
                if (buttons[index] && !buttons[index].disabled) {
                    buttons[index].click();
                }
            }
        });

        this.showWelcome();
        requestAnimationFrame(this.animate);
    }

    showWelcome() {
        this.triviaEngine.stopTimer(); // Ensure any running timer is stopped
        this.gameScene.resetCamera();
        this.gameScene.setStageColor(CONFIG.COLORS.PRIMARY);
        this.uiController.initWelcomeScreen(
            this.leaderboard.getScores(),
            this.dailyManager.canPlayToday(),
            this.dailyManager.getStreak()
        );
    }

    async playDailyChallenge() {
        this.isDailyMode = true;
        // Seeded category based on day of week
        const dayIdx = new Date().getDay();
        const categoryId = CONFIG.CATEGORIES[dayIdx % CONFIG.CATEGORIES.length].id;
        
        await this.startGame(categoryId, 1);
    }

    handleSaveScore(name) {
        this.leaderboard.saveScore(name, this.triviaEngine.score);
    }

    handleUseLifeline(type) {
        if (this.triviaEngine.useLifeline(type)) {
            this.audioManager.playClick();
            if (type === '5050') {
                this.uiController.apply5050(this.triviaEngine.getCurrentQuestion().correctAnswer);
            } else if (type === 'skip') {
                this.nextQuestion();
            }
        }
    }

    async startGame(categoryId = null, amount = 10) {
        // Unlock audio on first interaction
        await this.audioManager.start();
        this.audioManager.playStart();
        
        this.triviaEngine.resetGame(); // Ensure lifelines are reset
        this.gameScene.resetCamera();
        this.gameScene.setStageColor(CONFIG.COLORS.PRIMARY);
        
        const loadingDiv = document.createElement('div');
        loadingDiv.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            font-size: 2rem; color: #00ffcc; font-family: 'Orbitron', sans-serif;
            background: rgba(0,0,0,0.8); padding: 30px; border-radius: 15px; border: 2px solid #00ffcc;
            text-align: center; pointer-events: none; z-index: 1000;
        `;
        loadingDiv.innerHTML = "PREPARING STAGE...<br><span style='font-size: 1rem; opacity: 0.7;'>LOADING 1000+ QUESTIONS</span>";
        document.body.appendChild(loadingDiv);

        await this.triviaEngine.fetchQuestions(categoryId, amount);
        if (loadingDiv.parentNode) document.body.removeChild(loadingDiv);
        
        this.triviaEngine.score = 0;
        this.triviaEngine.streak = 0;
        this.triviaEngine.currentQuestionIndex = -1;
        this.nextQuestion();
    }

    nextQuestion() {
        const question = this.triviaEngine.getNextQuestion();
        if (question) {
            this.gameScene.zoomToScreen();
            this.uiController.showQuestion(
                question, 
                this.triviaEngine.score, 
                this.triviaEngine.streak,
                this.triviaEngine.currentQuestionIndex,
                this.triviaEngine.questions.length,
                this.triviaEngine.lifelines
            );
        } else {
            this.endGame();
        }
    }

    handleAnswerSubmit(answer) {
        if (answer) this.audioManager.playClick();
        
        const result = this.triviaEngine.submitAnswer(answer);
        
        if (this.isDailyMode) {
            this.dailyManager.recordResult(result.isCorrect);
            // Special QOTD reward: 5000 points added directly to their persistent high score check if correct
            if (result.isCorrect) {
                result.points = 5000;
                this.triviaEngine.score = 5000;
            }
        }

        if (result.isCorrect) {
            this.audioManager.playCorrect();
            this.gameScene.flashScreen(CONFIG.COLORS.SUCCESS);
            this.gameScene.setStageColor(CONFIG.COLORS.SUCCESS);
        } else {
            this.audioManager.playWrong();
            this.gameScene.flashScreen(CONFIG.COLORS.ERROR);
            this.gameScene.setStageColor(CONFIG.COLORS.ERROR);
        }

        this.uiController.showResult(
            result.isCorrect, 
            result.points, 
            result.correctAnswer, 
            () => {
                this.gameScene.setStageColor(CONFIG.COLORS.PRIMARY);
                this.nextQuestion();
            }
        );
    }

    endGame() {
        this.gameScene.resetCamera();
        this.gameScene.setStageColor(CONFIG.COLORS.SECONDARY);
        
        const isHighScore = this.leaderboard.isHighScore(this.triviaEngine.score);
        this.uiController.showGameOver(this.triviaEngine.score, isHighScore);
        this.isDailyMode = false;
    }

    animate(time) {
        requestAnimationFrame(this.animate);
        
        if (this.triviaEngine.timerInterval) {
            const oldTimer = Math.ceil(this.triviaEngine.timer);
            this.uiController.updateTimer(this.triviaEngine.timer);
            
            // Play tick sound every second
            if (Math.ceil(this.triviaEngine.timer) < oldTimer) {
                this.audioManager.playTick();
            }

            if (this.triviaEngine.timer <= 0) {
                this.handleAnswerSubmit(null);
            }
        }

        this.gameScene.update(time);
    }
}

new TriviaGame();
