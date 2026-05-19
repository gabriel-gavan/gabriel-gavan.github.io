import * as THREE from 'three';
import { GameScene } from './GameScene.js';
import * as Tone from 'tone';

let scene, camera, renderer, game;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2c1e11);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Position camera slightly higher and further back for a clearer view
    camera.position.set(0, 0.5, 15);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    game = new GameScene(scene, camera, renderer);

    // ================================
    // 🎮 AD MONETIZATION START
    // (Neon Nebula Strike-style breaks)
    // ================================
    let levelsSinceAd = 0;
    let lastAdBreakTime = 0;
    let isAdInProgress = false;

    const COOLDOWN_MS = 60000; // max 1 game-break ad per 60s
    const AD_EVERY_N_LEVELS = 2;

    const maybeShowAdBreak = () => {
        const now = Date.now();
        if (now - lastAdBreakTime < COOLDOWN_MS) return false;

        lastAdBreakTime = now;

        if (window.NeonAds && typeof window.NeonAds.showGameBreakAd === 'function') {
            try {
                window.NeonAds.showGameBreakAd();
                return true;
            } catch (e) {
                console.warn('NeonAds showGameBreakAd error', e);
            }
        }

        return false;
    };

    const showAdInterstitial = (onAdComplete) => {
        if (isAdInProgress) {
            onAdComplete();
            return;
        }

        const shouldPause = game.isGameStarted && !game.isGameOver;
        if (!shouldPause) {
            onAdComplete();
            return;
        }

        isAdInProgress = true;
        const pausedBeforeAd = true;

        // Pause the game while the overlay is visible
        game.isGameStarted = false;
        game.isPaused = true;

        const didShow = maybeShowAdBreak();
        if (!didShow) {
            isAdInProgress = false;
            game.isPaused = false;
            game.isGameStarted = pausedBeforeAd && !game.isGameOver;
            onAdComplete();
            return;
        }

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;

            try {
                window.NeonAds?.hideGameBreakAd?.();
            } catch (e) {
                // ignore
            }

            // Stop observing + safety timeout
            try {
                observer?.disconnect();
            } catch (e) {}

            clearTimeout(safetyTimeout);

            isAdInProgress = false;

            // Restore gameplay
            game.isPaused = false;
            if (pausedBeforeAd && !game.isGameOver) {
                game.isGameStarted = true;
            }

            onAdComplete();
        };

        const safetyTimeout = setTimeout(() => finish(), 8000);

        const observer = new MutationObserver(() => {
            const wrap = document.getElementById('neon-game-break-ad');
            if (!wrap) return;

            const isHidden =
                wrap.style.display === 'none' ||
                getComputedStyle(wrap).display === 'none';

            if (isHidden) finish();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });

        // In case it already closed very quickly:
        const wrapNow = document.getElementById('neon-game-break-ad');
        if (wrapNow) {
            const isHiddenNow =
                wrapNow.style.display === 'none' ||
                getComputedStyle(wrapNow).display === 'none';
            if (isHiddenNow) finish();
        }
    };
    // ================================
    // 🎮 AD MONETIZATION END
    // ================================

    // Setup UI
    const scoreBoard = document.getElementById('score-board');
    const levelBoard = document.getElementById('level-board');
    const startBtn = document.getElementById('start-btn');
    const startScreen = document.getElementById('start-screen');
    const autoReloadToggle = document.getElementById('auto-reload-toggle');
    const messageOverlay = document.getElementById('message-overlay');
    const messageTitle = document.getElementById('message-title');
    const messageSubtitle = document.getElementById('message-subtitle');
    const reloadBtn = document.getElementById('reload-btn');
    const ammoIcons = document.querySelectorAll('.bullet-icon');
    const comboBoard = document.getElementById('combo-board');
    const livesBoard = document.getElementById('lives-board');
    const nameModal = document.getElementById('name-modal');
    const nameInput = document.getElementById('player-name-input');
    const submitBtn = document.getElementById('submit-score-btn');
    const innocentsBoard = document.getElementById('innocents-board');
    const progressBoard = document.getElementById('progress-board');
    const gunContainer = document.getElementById('gun-container');
    const gunSprite = document.getElementById('gun-sprite');
    const muzzleFlash = document.getElementById('muzzle-flash');
    const crosshair = document.getElementById('crosshair');
    const damageFlash = document.getElementById('damage-flash');
    const playNextBtn = document.getElementById('play-next-btn');

    const updateAmmoUI = (ammo) => {
        ammoIcons.forEach((icon, i) => {
            if (i < ammo) icon.classList.remove('bullet-empty');
            else icon.classList.add('bullet-empty');
        });
        reloadBtn.style.display = ammo <= 0 ? 'block' : 'none';
    };

    const updateLivesUI = (lives) => {
        let hearts = "";
        for (let i = 0; i < 3; i++) hearts += i < lives ? "❤️" : "🖤";
        livesBoard.innerText = `Lives: ${hearts}`;
    };

    const updateLevelUI = (level) => {
        levelBoard.innerText = `Level: ${level}`;
    };

    const updateInnocentsUI = (count) => {
        innocentsBoard.innerText = `Innocents: ${count}/5`;
        innocentsBoard.style.color = count >= 4 ? '#e74c3c' : '#f39c12';
    };

    game.onScoreUpdate = (score) => {
        scoreBoard.innerText = `Score: ${score}`;
    };

    game.onLevelUpdate = (level) => {
        updateLevelUI(level);
    };

    game.onLevelUp = (level) => {
        playLevelUpSound();

        const levelMsg = document.createElement('div');
        levelMsg.innerText = `LEVEL ${level}`;
        levelMsg.style.position = 'fixed';
        levelMsg.style.top = '50%';
        levelMsg.style.left = '50%';
        levelMsg.style.transform = 'translate(-50%, -50%)';
        levelMsg.style.fontSize = 'clamp(40px, 15vw, 120px)';
        levelMsg.style.color = '#3498db';
        levelMsg.style.textShadow = '4px 4px #000';
        levelMsg.style.zIndex = '50';
        levelMsg.style.pointerEvents = 'none';
        levelMsg.style.fontFamily = "'Rye', cursive";
        document.body.appendChild(levelMsg);

        levelsSinceAd++;
        if (levelsSinceAd >= AD_EVERY_N_LEVELS) {
            levelsSinceAd = 0;
            showAdInterstitial(() => {});
        }

        setTimeout(() => {
            levelMsg.style.opacity = '0';
            levelMsg.style.transition = 'opacity 1s';
            setTimeout(() => levelMsg.remove(), 1000);
        }, 1000);
    };

    game.onShoot = () => {
        playShootSound();

        gunSprite.classList.remove('recoil');
        void gunSprite.offsetWidth; // trigger reflow
        gunSprite.classList.add('recoil');

        muzzleFlash.style.animation = 'none';
        void muzzleFlash.offsetWidth; // trigger reflow
        muzzleFlash.style.animation = 'flash-anim 0.1s forwards';
    };

    game.onPlayerHit = () => {
        damageFlash.classList.remove('active');
        void damageFlash.offsetWidth; // trigger reflow
        damageFlash.classList.add('active');
        playPlayerHitSound();
    };

    game.onAmmoUpdate = (ammo) => updateAmmoUI(ammo);
    game.onLivesUpdate = (lives) => updateLivesUI(lives);
    game.onInnocentsUpdate = (count) => updateInnocentsUI(count);
    game.onProgressUpdate = (killed, total) => {
        progressBoard.innerText = `Progress: ${killed}/${total}`;
    };

    game.onComboUpdate = (combo) => {
        if (combo > 1) {
            comboBoard.style.display = 'block';
            comboBoard.innerText = `COMBO X${combo}`;
        } else {
            comboBoard.style.display = 'none';
        }
    };

    game.onDryFire = () => playDryFireSound();
    game.onAutoReload = () => playReloadSound();

    const updateLeaderboardUI = () => {
        const leaderboardList = document.getElementById('leaderboard-list');
        const scores = JSON.parse(localStorage.getItem('wwbb_leaderboard') || '[]');

        if (scores.length === 0) {
            leaderboardList.innerHTML = "No legends yet...";
            return;
        }

        leaderboardList.innerHTML = scores
            .map((entry, index) => `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px opacity 0.2 solid #fff; padding: 2px 0;">
                    <span>${index + 1}. ${entry.name}</span>
                    <span style="color: #f1c40f;">${entry.score} pts (Lvl ${entry.level})</span>
                </div>
            `).join('');
    };

    const saveToLeaderboard = (score, level) => {
        const scores = JSON.parse(localStorage.getItem('wwbb_leaderboard') || '[]');

        const isTopScore = scores.length < 5 || score > scores[scores.length - 1].score;
        if (!isTopScore) return;

        nameModal.style.display = 'flex';
        nameInput.focus();

        const handleSubmit = () => {
            const playerName = nameInput.value.trim() || "Anonymous Outlaw";
            scores.push({ name: playerName, score, level, date: new Date().toISOString() });
            scores.sort((a, b) => b.score - a.score || b.level - a.level);
            const topScores = scores.slice(0, 5);
            localStorage.setItem('wwbb_leaderboard', JSON.stringify(topScores));

            nameModal.style.display = 'none';
            updateLeaderboardUI();
            submitBtn.removeEventListener('click', handleSubmit);
        };

        submitBtn.addEventListener('click', handleSubmit);
    };

    game.onGameOver = (type, score) => {
        // Neon-style: show a death interstitial (no need to pause/resume since gameplay is already stopped)
        maybeShowAdBreak();

        messageOverlay.style.display = 'block';
        gunContainer.style.display = 'none';
        crosshair.style.display = 'none';

        const currentHighscore = parseInt(localStorage.getItem('wwbb_highscore') || '0');
        if (score > currentHighscore) {
            localStorage.setItem('wwbb_highscore', score);
            messageSubtitle.innerHTML = `NEW RECORD! Score: ${score}<br>The law's comin' for ya!`;
        } else {
            messageSubtitle.innerHTML = `Score: ${score} (Best: ${currentHighscore})<br>Don't be a yellow-belly!`;
        }

        saveToLeaderboard(score, game.level);
        updateLeaderboardUI();

        if (type === 'bandit_shot_you') messageTitle.innerText = "BANDIT GOT YOU!";
        else if (type === 'boss') {
            messageTitle.innerText = "THE BOSS GOT YOU!";
            messageSubtitle.innerHTML = `NEW RECORD! Score: ${score}<br>The Big Bad Boss was too fast!`;
        } else if (type === 'victory') {
            messageTitle.innerText = "LEGENDARY SHERIFF!";
            messageTitle.style.textShadow = '4px 4px #2ecc71';
            messageSubtitle.innerHTML = `YOU CLEANED UP THE TOWN!<br>Final Score: ${score}<br>A true hero of the West!`;
        } else if (type === 'bandit') messageTitle.innerText = "BANDIT GOT AWAY!";
        else messageTitle.innerText = "OUTLAW!";

        stopAmbience();
        playGameOverSound();
    };

    game.onPropBreak = () => playPropShatterSound();
    game.onWallHit = () => playWallHitSound();

    reloadBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        game.reload();
        playReloadSound();
    });

    reloadBtn.addEventListener('click', (e) => e.stopPropagation());

    const highscore = localStorage.getItem('wwbb_highscore') || 0;
    if (highscore > 0) {
        const hsDisplay = document.createElement('p');
        hsDisplay.innerText = `BEST SCORE: ${highscore}`;
        hsDisplay.style.color = '#f1c40f';
        hsDisplay.style.fontSize = '24px';
        startScreen.insertBefore(hsDisplay, startBtn.parentElement);
    }

    startBtn.addEventListener('click', async () => {
        await Tone.start();
        game.autoReload = autoReloadToggle.checked;
        startScreen.style.display = 'none';
        gunContainer.style.display = 'block';
        crosshair.style.display = 'block';
        startAmbience();
        game.start();
    });

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    window.addEventListener('pointermove', (e) => {
        if (!game.isGameStarted || game.isGameOver) return;

        if (!isTouchDevice) {
            crosshair.style.display = 'block';
            crosshair.style.left = `${e.clientX}px`;
            crosshair.style.top = `${e.clientY}px`;
        } else {
            crosshair.style.display = 'none';
        }

        const swayAmount = isTouchDevice ? 40 : 100;
        const xPercent = (e.clientX / window.innerWidth - 0.5) * swayAmount;
        const yPercent = (e.clientY / window.innerHeight - 0.5) * (swayAmount / 2);
        gunContainer.style.transform = `translate(calc(-50% + ${xPercent}px), ${yPercent}px)`;
    });

    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();

    const CURRENT_GAME_ID = 'bangbang';

    const safeParseJSON = (raw, fallback) => {
        try {
            return JSON.parse(raw) || fallback;
        } catch {
            return fallback;
        }
    };

    const normalizeUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (url.startsWith('/')) return url;
        return '/' + url;
    };

    const getSuggestedNextGame = async () => {
        try {
            const res = await fetch('/games/games.json');
            const gamesCatalog = await res.json();

            const allGames = [];
            if (Array.isArray(gamesCatalog.topPicks)) allGames.push(...gamesCatalog.topPicks);
            if (Array.isArray(gamesCatalog.classic)) allGames.push(...gamesCatalog.classic);
            if (Array.isArray(gamesCatalog.skill)) allGames.push(...gamesCatalog.skill);
            if (Array.isArray(gamesCatalog.strategy)) allGames.push(...gamesCatalog.strategy);

            const playCounts = safeParseJSON(localStorage.getItem('gamePlayCounts'), {});
            const getPlays = (id) => {
                const n = Number(playCounts?.[id] || 0);
                return Number.isFinite(n) && n > 0 ? n : 0;
            };

            const candidates = allGames.filter(g => g?.id && g.id !== CURRENT_GAME_ID && g?.url);
            console.log('[Saloon] getSuggestedNextGame candidates:', candidates.map(c => c.id).slice(0, 10), 'count=', candidates.length);

            if (candidates.length === 0) {
                const topFallback = Array.isArray(gamesCatalog.topPicks)
                    ? gamesCatalog.topPicks.find(g => g?.id && g.id !== CURRENT_GAME_ID && g?.url)
                    : null;

                console.log('[Saloon] getSuggestedNextGame fallback topPicks:', topFallback?.id ?? null);

                return topFallback || null;
            }

            candidates.sort((a, b) => {
                const byPlays = getPlays(b.id) - getPlays(a.id);
                if (byPlays !== 0) return byPlays;
                return String(a.id).localeCompare(String(b.id));
            });

            console.log('[Saloon] getSuggestedNextGame picked:', candidates[0]?.id);
            return candidates[0];
        } catch (e) {
            console.warn('[Saloon] getSuggestedNextGame error:', e);
            return null;
        }
    };

    if (playNextBtn) {
        playNextBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            try {
                playNextBtn.disabled = true;
                playNextBtn.style.opacity = '0.75';

                const nextGame = await getSuggestedNextGame();
                const href = normalizeUrl(nextGame?.url);

                if (href) {
                    window.location.href = href;
                    return;
                }

                // Hard fallback (never bounce to hub)
                const STATIC_FALLBACK_URLS = [
                    '/games/Soldier Runner/index.html',
                    '/games/Neon Nebula Strike/index.html',
                    '/games/Neon Obby Legend/index.html',
                    '/games/Saloon Showdown/index.html'
                ];

                const fallbackHref = STATIC_FALLBACK_URLS.find(u => u !== '/games/Saloon Showdown/index.html') || STATIC_FALLBACK_URLS[0];
                console.warn('[Saloon] Play Next fallback ->', fallbackHref, 'nextGame=', nextGame);

                window.location.href = fallbackHref;
            } finally {
                playNextBtn.disabled = false;
                playNextBtn.style.opacity = '';
            }
        });
    }

    animate();
}

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    camera.aspect = aspect;

    if (aspect < 1.7) camera.position.z = 50 * (1.7 / aspect);
    else camera.position.z = 50;

    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function animate() {
    requestAnimationFrame(animate);
    game.update();
    renderer.render(scene, camera);
}

// Simple Procedural Sounds with Tone.js
const gunshot = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0
    }
}).toDestination();

const reloadSynth = new Tone.MembraneSynth().toDestination();
const clickSynth = new Tone.MetalSynth({
    envelope: {
        attack: 0.001,
        decay: 0.05,
        release: 0.05
    }
}).toDestination();

const gameOverSynth = new Tone.MonoSynth().toDestination();
const glassShatterSynth = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.001, decay: 0.3, sustain: 0 }
}).toDestination();

const wallHitSynth = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    oscillator: { type: 'sine' }
}).toDestination();

// Background Ambience: a haunting, lonely spaghetti western whistle/flute
const whistleSynth = new Tone.DuoSynth({
    vibratoAmount: 0.5,
    vibratoRate: 5,
    harmonicity: 1.5,
    voice0: {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.5, decay: 0.2, sustain: 0.8, release: 1.5 }
    },
    voice1: {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.5, decay: 0.2, sustain: 0.8, release: 1.5 }
    }
}).toDestination();
whistleSynth.volume.value = -15;

const ambientWind = new Tone.Noise({ type: 'pink' }).toDestination();
ambientWind.volume.value = -25;
const windAutoFilter = new Tone.AutoFilter("4n").toDestination().start();
ambientWind.connect(windAutoFilter);

let ambienceLoopId = null;

function startAmbience() {
    ambientWind.start();

    const notes = ["E4", "G4", "A4", "B4", "D5", "E5"];
    let step = 0;

    ambienceLoopId = Tone.Transport.scheduleRepeat((time) => {
        if (step % 16 === 0 || Math.random() < 0.3) {
            const note = notes[Math.floor(Math.random() * notes.length)];
            whistleSynth.triggerAttackRelease(note, "2n", time);
        }
        step++;
    }, "2n");

    Tone.Transport.start();
}

function stopAmbience() {
    ambientWind.stop();
    if (ambienceLoopId !== null) {
        Tone.Transport.clear(ambienceLoopId);
        ambienceLoopId = null;
    }
    Tone.Transport.stop();
}

function playShootSound() {
    try {
        const now = Tone.now();
        gunshot.triggerAttackRelease("16n", now + 0.01);
    } catch (e) {
        console.warn("Audio scheduling conflict:", e);
    }
}

function playDryFireSound() {
    try {
        clickSynth.triggerAttackRelease("C6", "32n", Tone.now() + 0.01);
    } catch (e) {
        console.warn("Audio scheduling conflict:", e);
    }
}

function playReloadSound() {
    try {
        const now = Tone.now() + 0.01;
        reloadSynth.triggerAttackRelease("C2", "8n", now);
        reloadSynth.triggerAttackRelease("E2", "8n", now + 0.1);
    } catch (e) {
        console.warn("Audio scheduling conflict:", e);
    }
}

function playGameOverSound() {
    try {
        gameOverSynth.triggerAttackRelease("C2", "4n", Tone.now() + 0.01);
    } catch (e) {
        console.warn("Audio scheduling conflict:", e);
    }
}

function playPropShatterSound() {
    try {
        glassShatterSynth.triggerAttackRelease("16n", Tone.now() + 0.01);
    } catch (e) {
        console.warn("Audio scheduling conflict:", e);
    }
}

function playWallHitSound() {
    try {
        wallHitSynth.triggerAttackRelease("G2", "32n", Tone.now() + 0.01);
    } catch (e) {
        console.warn("Audio scheduling conflict:", e);
    }
}

function playPlayerHitSound() {
    try {
        const now = Tone.now() + 0.01;
        const impact = new Tone.MembraneSynth().toDestination();
        impact.triggerAttackRelease("C1", "8n", now);
        setTimeout(() => impact.dispose(), 500);
    } catch (e) {
        console.warn("Audio scheduling conflict:", e);
    }
}

function playLevelUpSound() {
    try {
        const now = Tone.now() + 0.01;
        const synth = new Tone.PolySynth().toDestination();
        synth.triggerAttackRelease(["C4", "E4", "G4", "C5"], "4n", now);
        setTimeout(() => synth.dispose(), 1000);
    } catch (e) {
        console.warn("Audio scheduling conflict:", e);
    }
}

init();
