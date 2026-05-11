import Phaser from 'phaser';
import { AdventureScene } from './scenes/AdventureScene.js';
import { DiceScene } from './scenes/DiceScene.js';

// Base dimensions for desktop
const BASE_WIDTH = 800;
const BASE_HEIGHT = 600;
const MOBILE_BREAKPOINT = 600;

// ================================
// 🎮 NEON ADS INTERSTITIAL SUPPORT
// ================================
const NeonGameAds = (() => {
    let lastAdBreakTime = 0;
    let isAdInProgress = false;
    const COOLDOWN_MS = 60000;

    function canShowAd(force = false) {
        if (isAdInProgress) return false;
        if (force) return true;
        return Date.now() - lastAdBreakTime >= COOLDOWN_MS;
    }

    function show(reason = 'game_break', force = false) {
        if (!canShowAd(force)) return false;
        if (!window.NeonAds || typeof window.NeonAds.showGameBreakAd !== 'function') return false;

        lastAdBreakTime = Date.now();
        isAdInProgress = true;

        try {
            window.NeonAds.showGameBreakAd();
        } catch (e) {
            console.warn('NeonAds showGameBreakAd failed:', e);
            isAdInProgress = false;
            return false;
        }

        const finish = () => {
            isAdInProgress = false;
            try { observer.disconnect(); } catch (e) {}
            clearTimeout(safetyTimeout);
        };

        const safetyTimeout = setTimeout(finish, 8000);

        const observer = new MutationObserver(() => {
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

    return { show };
})();

window.NeonGameAds = NeonGameAds;

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

// Safe generic Phaser hooks for natural breaks.
// These do not edit your scene files, so they will not break AdventureScene/DiceScene logic.
game.events.once(Phaser.Core.Events.READY, () => {
    game.scene.scenes.forEach((scene) => {
        scene.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            NeonGameAds.show('scene_shutdown');
        });
    });
});

// Long-session break: safe for Phaser because it does not pause or mutate scenes.
setInterval(() => {
    if (document.hidden) return;
    NeonGameAds.show('long_session');
}, 180000);

// Optional return-from-background break, protected by cooldown.
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        setTimeout(() => NeonGameAds.show('visibility_return'), 800);
    }
});

// Expose for debugging in Rosebud
window.phaserGame = game;
