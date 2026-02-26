/**
 * DataLoader - Loads game data from consolidated manifest
 *
 * All game content is now stored in manifest.js for easy theming.
 * Swap manifest.js to reskin the entire game.
 */
import { manifest } from '../manifest.js';

export class DataLoader {
    constructor() {
        this.manifest = manifest;
        this.abilitiesData = manifest.abilities;
        this.enemiesData = manifest.enemies;
    }

    /**
     * Load the game manifest (synchronous - already imported)
     * @returns {Object} Manifest data
     */
    async loadManifest() {
        return this.manifest;
    }

    /**
     * Load party data
     * @returns {Array} Party member data
     */
    async loadParty() {
        return this.manifest.party;
    }

    /**
     * Load a scene by ID (from manifest, not separate file)
     * @param {string} sceneId - Scene identifier
     * @returns {Object|null} Scene data or null if not found
     */
    async loadScene(sceneId) {
        const scene = this.manifest.scenes?.[sceneId];
        if (!scene) {
            console.error(`Scene not found: ${sceneId}`);
            return null;
        }
        return scene;
    }

    /**
     * Load combat data (abilities and enemies)
     * @returns {Object} { abilities, enemies }
     */
    async loadCombatData() {
        return {
            abilities: this.abilitiesData,
            enemies: this.enemiesData,
        };
    }

    /**
     * Get the starting scene ID from manifest
     * @returns {string|null}
     */
    getStartingScene() {
        return this.manifest.startingScene || null;
    }

    /**
     * Get enemy data by ID
     * @param {string} enemyId
     * @returns {Object|null}
     */
    getEnemy(enemyId) {
        return this.enemiesData?.[enemyId] || null;
    }

    /**
     * Get abilities for a character
     * @param {string} characterId
     * @returns {Object|null}
     */
    getAbilities(characterId) {
        return this.abilitiesData?.[characterId] || null;
    }

    /**
     * Get UI colors from manifest
     * @returns {Object}
     */
    getUIColors() {
        return this.manifest.ui?.colors || {};
    }
}
