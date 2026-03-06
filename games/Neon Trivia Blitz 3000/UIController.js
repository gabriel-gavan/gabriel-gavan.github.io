import { CONFIG } from './config.js';

export class UIController {
    constructor(onAnswerSubmit, onStartGame, onRestart, onSaveScore, onPlayDaily, onUseLifeline, onGoHome) {
        this.onAnswerSubmit = onAnswerSubmit;
        this.onStartGame = onStartGame;
        this.onRestart = onRestart;
        this.onSaveScore = onSaveScore;
        this.onPlayDaily = onPlayDaily;
        this.onUseLifeline = onUseLifeline;
        this.onGoHome = onGoHome;
        this.container = this.createMainContainer();
        this.selectedCategoryId = null;
    }

    createMainContainer() {
        const div = document.createElement('div');
        div.id = 'trivia-ui';
        div.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-family: 'Orbitron', sans-serif; color: white; pointer-events: none;
            text-shadow: 0 0 10px rgba(0, 0, 0, 0.8); overflow: hidden;
        `;
        document.body.appendChild(div);
        return div;
    }

    initWelcomeScreen(topScores = [], canPlayDaily = false, dailyStreak = 0) {
        const leaderboardHtml = topScores.length > 0 ? `
            <div style="margin-top: 20px; text-align: left; background: rgba(0,0,0,0.6); padding: 15px; border-radius: 10px; border: 1px solid rgba(0,255,204,0.3); backdrop-filter: blur(5px);">
                <h3 style="margin: 0 0 10px 0; font-size: 0.8rem; color: #ff00ff; text-transform: uppercase;">Hall of Fame</h3>
                ${topScores.map((s, i) => `
                    <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 0.75rem; margin-bottom: 3px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px;">
                        <span>${i + 1}. ${s.name}</span>
                        <span style="color: #00ffcc; font-weight: bold;">${s.score}</span>
                    </div>
                `).join('')}
            </div>
        ` : '';

        const dailyBtnHtml = canPlayDaily ? `
            <button id="daily-btn" style="
                padding: 10px 30px; font-size: 0.9rem; background: #ff00ff; border: none; color: white;
                cursor: pointer; font-family: 'Orbitron', sans-serif; font-weight: bold;
                transition: all 0.3s ease; text-transform: uppercase; box-shadow: 0 0 15px rgba(255,0,255,0.4);
                width: 100%; margin-top: 15px;
            ">Question of the Day 🌟</button>
        ` : `
            <div style="margin-top: 15px; font-size: 0.8rem; color: #ff00ff; opacity: 0.8;">
                Daily Challenge Complete! <br>Current Streak: ${dailyStreak} 🔥
            </div>
        `;

        this.container.innerHTML = `
            <div style="
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
                background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.8)), url('assets/trivia-background.png.webp');
                background-size: cover; background-position: center; z-index: -1;
            "></div>
            <div style="text-align: center; pointer-events: auto; padding: 40px; background: rgba(0,0,0,0.7); border: 4px solid #00ffcc; border-radius: 20px; box-shadow: 0 0 50px rgba(0,255,204,0.4); max-width: 90%; width: 500px; backdrop-filter: blur(10px);">
                <h1 style="font-size: clamp(2rem, 8vw, 3rem); margin-bottom: 10px; color: #00ffcc; text-transform: uppercase; letter-spacing: 5px;">Trivia Blitz</h1>
                <p style="font-size: 0.9rem; margin-bottom: 30px; opacity: 0.8;">1000+ Questions • Real-Time Difficulty • Neon Stakes</p>
                
                <button id="show-categories-btn" style="
                    padding: 15px 50px; font-size: 1.5rem; background: #00ffcc; border: none; color: black;
                    cursor: pointer; font-family: 'Orbitron', sans-serif; font-weight: bold;
                    transition: all 0.3s ease; text-transform: uppercase; box-shadow: 0 0 20px rgba(0,255,204,0.5);
                    width: 100%;
                ">Start Game</button>

                ${dailyBtnHtml}
                ${leaderboardHtml}
            </div>
        `;
        document.getElementById('show-categories-btn').onclick = () => this.showCategorySelect();
        if (canPlayDaily) {
            document.getElementById('daily-btn').onclick = () => this.onPlayDaily();
        }
    }

    showCategorySelect() {
        this.container.innerHTML = `
            <div style="
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
                background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.9)), url('assets/trivia-background.png.webp');
                background-size: cover; background-position: center; z-index: -1;
            "></div>
            <div style="text-align: center; pointer-events: auto; padding: 30px; background: rgba(0,0,0,0.85); border: 4px solid #00ffcc; border-radius: 20px; box-shadow: 0 0 50px rgba(0,255,204,0.4); max-width: 95%; width: 800px; backdrop-filter: blur(15px); max-height: 90vh; overflow-y: auto;">
                <h2 style="font-size: 2rem; margin-bottom: 20px; color: #00ffcc; text-transform: uppercase;">Select Category</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; margin-bottom: 30px;">
                    <button class="cat-btn" data-id="" style="
                        padding: 15px; background: rgba(0,255,204,0.1); border: 2px solid #00ffcc;
                        color: white; font-family: 'Orbitron', sans-serif; cursor: pointer; transition: all 0.2s;
                        border-radius: 10px; display: flex; flex-direction: column; align-items: center; gap: 5px;
                    ">
                        <span style="font-size: 2rem;">🎲</span>
                        <span>ALL RANDOM</span>
                    </button>
                    ${CONFIG.CATEGORIES.map(cat => `
                        <button class="cat-btn" data-id="${cat.id}" style="
                            padding: 15px; background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.2);
                            color: white; font-family: 'Orbitron', sans-serif; cursor: pointer; transition: all 0.2s;
                            border-radius: 10px; display: flex; flex-direction: column; align-items: center; gap: 5px;
                        ">
                            <span style="font-size: 2rem;">${cat.icon}</span>
                            <span>${cat.name.toUpperCase()}</span>
                        </button>
                    `).join('')}
                </div>
                <button id="back-to-home" style="
                    padding: 10px 30px; background: transparent; border: 2px solid #ff00ff; color: #ff00ff;
                    cursor: pointer; font-family: 'Orbitron', sans-serif; font-weight: bold;
                    transition: all 0.3s ease; text-transform: uppercase; border-radius: 5px;
                ">Back to Main Menu</button>
            </div>
        `;

        document.getElementById('back-to-home').onclick = () => this.onGoHome();

        document.querySelectorAll('.cat-btn').forEach(btn => {
            btn.onclick = () => {
                this.selectedCategoryId = btn.dataset.id ? parseInt(btn.dataset.id) : null;
                this.onStartGame(this.selectedCategoryId);
            };
            btn.onmouseover = () => {
                btn.style.borderColor = '#ff00ff';
                btn.style.background = 'rgba(255,0,255,0.1)';
                btn.style.boxShadow = '0 0 15px rgba(255,0,255,0.4)';
            };
            btn.onmouseout = () => {
                const isAll = btn.dataset.id === "";
                btn.style.borderColor = isAll ? '#00ffcc' : 'rgba(255,255,255,0.2)';
                btn.style.background = isAll ? 'rgba(0,255,204,0.1)' : 'rgba(255,255,255,0.05)';
                btn.style.boxShadow = 'none';
            };
        });
    }

    showQuestion(questionData, score, streak, currentIdx, totalCount, lifelines = { '5050': true, 'skip': true }) {
        const progress = ((currentIdx + 1) / totalCount) * 100;
        
        this.container.innerHTML = `
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 6px; background: rgba(255,255,255,0.1);">
                <div style="width: ${progress}%; height: 100%; background: #00ffcc; box-shadow: 0 0 10px #00ffcc; transition: width 0.5s ease;"></div>
            </div>

            <div style="position: absolute; top: 20px; left: 20px; font-size: 1.2rem; text-align: left; pointer-events: auto;">
                <div style="color: #00ffcc; margin-bottom: 5px;">SCORE: <span id="ui-score">${score}</span></div>
                <div style="color: #ff00ff; margin-bottom: 15px;">STREAK: <span id="ui-streak">${streak}</span> 🔥</div>
                <button id="quit-btn" style="
                    padding: 5px 15px; background: rgba(255,0,0,0.2); border: 1px solid #ff0000;
                    color: #ff0000; font-family: 'Orbitron', sans-serif; font-size: 0.7rem;
                    cursor: pointer; transition: all 0.2s; border-radius: 3px; text-transform: uppercase;
                ">Quit Game</button>
            </div>
            
            <div style="position: absolute; top: 20px; right: 20px; width: 80px; height: 80px;">
                <svg viewBox="0 0 36 36" style="width: 100%; height: 100%;">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#333" stroke-width="3" />
                    <path id="timer-progress" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#00ffcc" stroke-width="3" stroke-dasharray="100, 100" />
                </svg>
                <div id="ui-timer" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.2rem; font-weight: bold;">15</div>
            </div>

            <div style="max-width: 800px; width: 90%; text-align: center; pointer-events: none; margin-top: 40px;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 10px; opacity: 0.8;">
                    <span style="font-size: 1.5rem;">${questionData.icon}</span>
                    <span style="text-transform: uppercase; letter-spacing: 2px; font-size: 0.9rem;">${questionData.category}</span>
                </div>
                
                <div style="background: rgba(0,0,0,0.7); padding: 25px; border-radius: 15px; border-left: 5px solid #00ffcc; margin-bottom: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <h2 id="ui-question" style="font-size: clamp(1.2rem, 4vw, 1.8rem); margin: 0; line-height: 1.4;">${questionData.question}</h2>
                </div>
                
                <div id="answers-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; pointer-events: auto;">
                    ${questionData.allAnswers.map((ans, idx) => `
                        <button class="answer-btn" data-ans="${ans}" style="
                            padding: 20px; font-size: 1.1rem; background: rgba(0,0,0,0.8); border: 2px solid rgba(255,255,255,0.2);
                            color: white; cursor: pointer; font-family: 'Orbitron', sans-serif; transition: all 0.2s ease;
                            text-align: left; border-radius: 10px;
                        ">
                            <span style="color: #00ffcc; margin-right: 15px; font-weight: bold;">${idx + 1}.</span> ${ans}
                        </button>
                    `).join('')}
                </div>

                <div style="display: flex; justify-content: center; gap: 20px; margin-top: 30px; pointer-events: auto;">
                    <button id="lifeline-5050" class="lifeline-btn" style="
                        padding: 10px 20px; background: ${lifelines['5050'] ? '#ffff00' : '#333'};
                        color: black; font-weight: bold; border: none; border-radius: 5px; cursor: pointer;
                        opacity: ${lifelines['5050'] ? '1' : '0.5'}; font-family: 'Orbitron', sans-serif;
                    " ${lifelines['5050'] ? '' : 'disabled'}>50:50</button>
                    
                    <button id="lifeline-skip" class="lifeline-btn" style="
                        padding: 10px 20px; background: ${lifelines['skip'] ? '#00ffff' : '#333'};
                        color: black; font-weight: bold; border: none; border-radius: 5px; cursor: pointer;
                        opacity: ${lifelines['skip'] ? '1' : '0.5'}; font-family: 'Orbitron', sans-serif;
                    " ${lifelines['skip'] ? '' : 'disabled'}>SKIP</button>
                </div>
            </div>

            <div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); font-size: 0.8rem; opacity: 0.5; text-transform: uppercase; letter-spacing: 1px;">
                Difficulty: <span style="color: #ffff00;">${questionData.difficulty}</span>
            </div>
        `;

        document.querySelectorAll('.answer-btn').forEach(btn => {
            btn.onclick = () => this.onAnswerSubmit(btn.dataset.ans);
        });

        const btn5050 = document.getElementById('lifeline-5050');
        const btnSkip = document.getElementById('lifeline-skip');
        
        if (btn5050) btn5050.onclick = () => this.onUseLifeline('5050');
        if (btnSkip) btnSkip.onclick = () => this.onUseLifeline('skip');

        const btnQuit = document.getElementById('quit-btn');
        if (btnQuit) btnQuit.onclick = () => this.onGoHome();
    }

    apply5050(correctAnswer) {
        const buttons = Array.from(document.querySelectorAll('.answer-btn'));
        const wrongButtons = buttons.filter(btn => btn.dataset.ans !== correctAnswer);
        
        // Shuffle and pick 2 to hide
        const toHide = this.shuffleArray(wrongButtons).slice(0, 2);
        toHide.forEach(btn => {
            btn.style.visibility = 'hidden';
            btn.disabled = true;
        });
        
        const btn5050 = document.getElementById('lifeline-5050');
        if (btn5050) {
            btn5050.disabled = true;
            btn5050.style.opacity = '0.5';
            btn5050.style.background = '#333';
        }
    }

    shuffleArray(array) {
        const newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    }

    updateTimer(timeLeft) {
        const timerEl = document.getElementById('ui-timer');
        const progressEl = document.getElementById('timer-progress');
        if (timerEl && progressEl) {
            timerEl.textContent = Math.ceil(timeLeft);
            const percentage = (timeLeft / CONFIG.TIMER_DURATION) * 100;
            progressEl.setAttribute('stroke-dasharray', `${percentage}, 100`);
            
            if (timeLeft < 5) {
                progressEl.setAttribute('stroke', '#ff0000');
                timerEl.style.color = '#ff0000';
            } else {
                progressEl.setAttribute('stroke', '#00ffcc');
                timerEl.style.color = 'white';
            }
        }
    }

    showResult(isCorrect, points, correctAnswer, nextCallback) {
        const container = document.getElementById('answers-container');
        if (!container) return;
        
        container.style.pointerEvents = 'none';
        
        document.querySelectorAll('.answer-btn').forEach(btn => {
            btn.disabled = true;
            if (btn.dataset.ans === correctAnswer) {
                btn.style.background = '#00ff00';
                btn.style.color = 'black';
                btn.style.borderColor = '#00ff00';
                btn.style.boxShadow = '0 0 20px #00ff00';
            } else if (!isCorrect && btn.dataset.ans !== correctAnswer) {
                btn.style.opacity = '0.3';
            }
        });

        const feedback = document.createElement('div');
        feedback.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0);
            font-size: clamp(3rem, 10vw, 6rem); font-weight: bold; color: ${isCorrect ? '#00ff00' : '#ff0000'};
            text-shadow: 0 0 30px ${isCorrect ? 'rgba(0,255,0,0.5)' : 'rgba(255,0,0,0.5)'};
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 100;
        `;
        feedback.textContent = isCorrect ? `+${points}` : 'WRONG';
        this.container.appendChild(feedback);
        
        requestAnimationFrame(() => {
            feedback.style.transform = 'translate(-50%, -50%) scale(1)';
        });

        setTimeout(() => {
            feedback.style.transform = 'translate(-50%, -50%) scale(0)';
            setTimeout(() => {
                if (feedback.parentNode) this.container.removeChild(feedback);
                nextCallback();
            }, 300);
        }, 1500);
    }

    showGameOver(score, isHighScore = false) {
        const highScoreContent = isHighScore ? `
            <div id="save-score-container" style="margin-bottom: 30px;">
                <p style="color: #00ffcc; font-size: 0.9rem; margin-bottom: 10px; text-transform: uppercase;">New High Score!</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <input type="text" id="player-name" placeholder="YOUR NAME" maxlength="15" style="
                        padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid #00ffcc;
                        color: white; font-family: 'Orbitron', sans-serif; outline: none; width: 150px;
                    " />
                    <button id="save-btn" style="
                        padding: 10px 20px; background: #00ffcc; border: none; color: black;
                        font-family: 'Orbitron', sans-serif; font-weight: bold; cursor: pointer;
                    ">SAVE</button>
                </div>
            </div>
        ` : '';

        this.container.innerHTML = `
            <div style="
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
                background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.9)), url('assets/trivia-background.png.webp');
                background-size: cover; background-position: center; z-index: -1;
            "></div>
            <div style="text-align: center; pointer-events: auto; padding: 50px; background: rgba(0,0,0,0.8); border: 4px solid #ff00ff; border-radius: 20px; box-shadow: 0 0 50px rgba(255,0,255,0.4); max-width: 90%; width: 500px; backdrop-filter: blur(10px);">
                <h1 style="font-size: clamp(2.5rem, 8vw, 4rem); margin-bottom: 10px; color: #ff00ff; text-transform: uppercase;">Final Score</h1>
                <div style="font-size: clamp(4rem, 15vw, 6rem); font-weight: bold; margin-bottom: 30px; color: white; text-shadow: 0 0 20px #ff00ff;">${score}</div>
                
                ${highScoreContent}

                <button id="restart-btn" style="
                    padding: 15px 60px; font-size: 1.5rem; background: #ff00ff; border: none; color: white;
                    cursor: pointer; font-family: 'Orbitron', sans-serif; font-weight: bold;
                    transition: all 0.3s ease; text-transform: uppercase; box-shadow: 0 0 20px rgba(255,0,255,0.5);
                    width: 100%; margin-bottom: 10px;
                ">Play Again</button>
                <button id="home-btn" style="
                    padding: 10px 40px; font-size: 1rem; background: transparent; border: 2px solid #00ffcc; color: #00ffcc;
                    cursor: pointer; font-family: 'Orbitron', sans-serif; font-weight: bold;
                    transition: all 0.3s ease; text-transform: uppercase;
                    width: 100%;
                ">Main Menu</button>
            </div>
        `;

        if (isHighScore) {
            const saveBtn = document.getElementById('save-btn');
            const nameInput = document.getElementById('player-name');
            saveBtn.onclick = () => {
                this.onSaveScore(nameInput.value || 'Anonymous');
                document.getElementById('save-score-container').innerHTML = '<p style="color: #00ffcc;">SCORE SAVED!</p>';
            };
        }

        document.getElementById('restart-btn').onclick = () => this.onRestart();
        document.getElementById('home-btn').onclick = () => this.onGoHome();
    }
}
