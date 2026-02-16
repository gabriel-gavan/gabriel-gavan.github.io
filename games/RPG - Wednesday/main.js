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
