import { CONFIG } from './config.js';

export class TriviaEngine {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = -1;
        this.score = 0;
        this.streak = 0;
        this.isGameOver = false;
        this.timer = 0;
        this.timerInterval = null;
        this.lifelines = {
            '5050': true,
            'skip': true
        };
    }

    resetGame() {
        this.score = 0;
        this.streak = 0;
        this.currentQuestionIndex = -1;
        this.isGameOver = false;
        this.lifelines = {
            '5050': true,
            'skip': true
        };
    }

    useLifeline(type) {
        if (this.lifelines[type]) {
            this.lifelines[type] = false;
            return true;
        }
        return false;
    }

    async fetchQuestions(categoryId = null, amount = 10) {
        try {
            // amount can be passed as 1 for QOTD
            let url = `${CONFIG.TRIVIA_API}?amount=${amount}&type=multiple`;
            if (categoryId) {
                url += `&category=${categoryId}`;
            }
            
            const response = await fetch(url);
            
            if (response.status === 429) {
                console.warn('Rate limit hit (429), using fallback questions');
                this.questions = this.getFallbackQuestions();
                this.currentQuestionIndex = 0;
                return true;
            }

            const data = await response.json();

            if (data.response_code === 0) {
                const fetched = data.results.map(q => ({
                    question: this.decodeHtml(q.question),
                    correctAnswer: this.decodeHtml(q.correct_answer),
                    incorrectAnswers: q.incorrect_answers.map(a => this.decodeHtml(a)),
                    category: q.category,
                    difficulty: q.difficulty,
                    icon: this.getCategoryIcon(q.category),
                    allAnswers: this.shuffleArray([
                        this.decodeHtml(q.correct_answer),
                        ...q.incorrect_answers.map(a => this.decodeHtml(a))
                    ])
                }));

                // If fetching a batch, sort by difficulty
                if (amount > 1) {
                    const difficultyMap = { 'easy': 0, 'medium': 1, 'hard': 2 };
                    fetched.sort((a, b) => difficultyMap[a.difficulty] - difficultyMap[b.difficulty]);
                }

                this.questions = fetched.slice(0, amount);
                this.currentQuestionIndex = 0;
                return true;
            } else {
                this.questions = this.getFallbackQuestions();
                this.currentQuestionIndex = 0;
                return true;
            }
        } catch (error) {
            console.error('Error fetching questions:', error);
            this.questions = this.getFallbackQuestions();
            this.currentQuestionIndex = 0;
            return true;
        }
    }

    getCategoryIcon(categoryName) {
        const match = CONFIG.CATEGORIES.find(c => 
            categoryName.toLowerCase().includes(c.name.toLowerCase())
        );
        return match ? match.icon : '🧠';
    }

    getNextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.startTimer();
            return this.questions[this.currentQuestionIndex];
        }
        this.isGameOver = true;
        return null;
    }

    getCurrentQuestion() {
        return this.questions[this.currentQuestionIndex];
    }

    submitAnswer(answer) {
        const current = this.getCurrentQuestion();
        const isCorrect = answer === current.correctAnswer;
        
        let points = 0;
        if (isCorrect) {
            const diffMultiplier = current.difficulty === 'hard' ? 1.5 : (current.difficulty === 'medium' ? 1.2 : 1);
            const timeBonus = Math.floor((this.timer / CONFIG.TIMER_DURATION) * CONFIG.SPEED_BONUS_MAX);
            points = Math.floor((CONFIG.POINTS_PER_QUESTION + timeBonus) * diffMultiplier);
            this.score += points;
            this.streak++;
        } else {
            this.streak = 0;
        }

        this.stopTimer();
        return { isCorrect, points, correctAnswer: current.correctAnswer };
    }

    startTimer() {
        this.stopTimer();
        this.timer = CONFIG.TIMER_DURATION;
        this.timerInterval = setInterval(() => {
            this.timer -= 0.1;
            if (this.timer <= 0) {
                this.timer = 0;
                this.stopTimer();
            }
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    decodeHtml(html) {
        const txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    getFallbackQuestions() {
        return [
            {
                question: "Which planet is known as the Red Planet?",
                correctAnswer: "Mars",
                incorrectAnswers: ["Venus", "Jupiter", "Saturn"],
                allAnswers: ["Mars", "Venus", "Jupiter", "Saturn"].sort(() => Math.random() - 0.5),
                category: "Science & Nature",
                icon: "🧬",
                difficulty: "easy"
            },
            {
                question: "Who painted the Mona Lisa?",
                correctAnswer: "Leonardo da Vinci",
                incorrectAnswers: ["Vincent van Gogh", "Pablo Picasso", "Claude Monet"],
                allAnswers: ["Leonardo da Vinci", "Vincent van Gogh", "Pablo Picasso", "Claude Monet"].sort(() => Math.random() - 0.5),
                category: "Art",
                icon: "🎨",
                difficulty: "easy"
            }
        ];
    }
}
