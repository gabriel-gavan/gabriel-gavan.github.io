import Phaser from 'phaser';
import { AdventureScene } from './scenes/AdventureScene.js';
import { DiceScene } from './scenes/DiceScene.js';

// Base dimensions for desktop
const BASE_WIDTH = 800;
const BASE_HEIGHT = 600;
const MOBILE_BREAKPOINT = 600;

/**
 * Determine scale mode based on initial viewport size:
 * - Desktop (width >= MOBILE_BREAKPOINT): Fixed 800x600 with FIT scaling (letterbox)
 * - Mobile (width < MOBILE_BREAKPOINT): RESIZE mode - canvas matches viewport exactly
 *
 * Note: Orientation changes require page refresh. This simplifies the codebase
 * by avoiding complex resize handling.
 */
function getScaleConfig() {
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;

    return {
        mode: isMobile ? Phaser.Scale.RESIZE : Phaser.Scale.FIT,
        width: isMobile ? window.innerWidth : BASE_WIDTH,
        height: isMobile ? window.innerHeight : BASE_HEIGHT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    };
}

// Game configuration
const config = {
    type: Phaser.AUTO,
    parent: 'renderDiv',
    backgroundColor: '#16213e',
    scene: [AdventureScene, DiceScene],
    scale: getScaleConfig()
};

// Create game instance
const game = new Phaser.Game(config);

// Expose for debugging in Rosebud
window.phaserGame = game;

// ============================================================
// 🎮 NEONADS INTERSTITIAL SUPPORT
// Safe for Phaser: pauses active scenes while the ad overlay is visible.
// Requires /js/ads.js in index.html.
// ============================================================
(function initNeonAdBreaks(phaserGame) {
    const COOLDOWN_MS = 60000;
    const SESSION_BREAK_MS = 120000;
    let lastAdBreakTime = 0;
    let lastFocusAwayTime = 0;
    let adInProgress = false;
    let sessionTimer = null;

    function getActiveScenes() {
        try {
            return phaserGame.scene.getScenes(true) || [];
        } catch (e) {
            return [];
        }
    }

    function pauseScenes() {
        getActiveScenes().forEach(scene => {
            try {
                if (scene.scene && !scene.scene.isPaused()) {
                    scene.__neonWasRunning = true;
                    scene.scene.pause();
                }
            } catch (e) {}
        });
    }

    function resumeScenes() {
        try {
            phaserGame.scene.getScenes(false).forEach(scene => {
                try {
                    if (scene.__neonWasRunning && scene.scene) {
                        scene.__neonWasRunning = false;
                        scene.scene.resume();
                    }
                } catch (e) {}
            });
        } catch (e) {}
    }

    function canShow(force = false) {
        if (adInProgress) return false;
        if (force) return true;
        return Date.now() - lastAdBreakTime >= COOLDOWN_MS;
    }

    function showGameBreakAd(reason = 'game_break', options = {}) {
        const force = !!options.force;
        if (!canShow(force)) return false;

        if (!window.NeonAds || typeof window.NeonAds.showGameBreakAd !== 'function') {
            return false;
        }

        adInProgress = true;
        lastAdBreakTime = Date.now();
        pauseScenes();

        try {
            window.NeonAds.showGameBreakAd();
        } catch (e) {
            console.warn('NeonAds showGameBreakAd failed:', e);
            adInProgress = false;
            resumeScenes();
            return false;
        }

        let finished = false;
        let observer = null;

        const finish = () => {
            if (finished) return;
            finished = true;
            clearTimeout(safetyTimeout);
            try { observer && observer.disconnect(); } catch (e) {}
            try { window.NeonAds?.hideGameBreakAd?.(); } catch (e) {}
            adInProgress = false;
            resumeScenes();
        };

        const safetyTimeout = setTimeout(finish, 8000);

        observer = new MutationObserver(() => {
            const wrap = document.getElementById('neon-game-break-ad');
            if (!wrap) return;
            const hidden = wrap.style.display === 'none' || getComputedStyle(wrap).display === 'none';
            if (hidden) finish();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });

        return true;
    }

    // Public hook you can call from AdventureScene / DiceScene on win, lose, dice result, etc.
    window.NeonGameAds = {
        showGameBreakAd,
        showGameOverAd: () => showGameBreakAd('game_over', { force: true }),
        showLevelCompleteAd: () => showGameBreakAd('level_complete')
    };

    // Long-session natural break.
    sessionTimer = setInterval(() => {
        const activeScenes = getActiveScenes();
        if (activeScenes.length > 0) showGameBreakAd('session_break');
    }, SESSION_BREAK_MS);

    // Return-from-background break, useful for mobile and tab switching.
    window.addEventListener('blur', () => {
        lastFocusAwayTime = Date.now();
    });

    window.addEventListener('focus', () => {
        if (Date.now() - lastFocusAwayTime > 45000) {
            setTimeout(() => showGameBreakAd('focus_return'), 600);
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            lastFocusAwayTime = Date.now();
        } else if (Date.now() - lastFocusAwayTime > 45000) {
            setTimeout(() => showGameBreakAd('visibility_return'), 600);
        }
    });

    window.addEventListener('beforeunload', () => {
        if (sessionTimer) clearInterval(sessionTimer);
    });
})(game);

