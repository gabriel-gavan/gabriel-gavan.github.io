/**
 * AIService - Wrapper around the platform's ChatManager with standalone fallback
 *
 * This service uses the platform's ChatManager if available (window.ChatManager),
 * otherwise falls back to a standalone implementation for local development.
 *
 * Platform mode: Uses injected ChatManager.js which communicates via postMessage
 * Standalone mode: Makes direct API calls with persisted token from localStorage
 *
 * Interface matches: /workspace/PlaygroundGatewayV2/playground_gateway/project_canvas_scripts/static/ChatManager.js
 *
 * Usage (same as ChatManager):
 *   const chat = new ChatManager("You are the narrator...");
 *   chat.addMessage("user", "Describe the scene");
 *   const response = await chat.getCharacterResponse("chat", 256);
 */

import { manifest } from '../manifest.js';

const TOKEN_STORAGE_KEY = 'dnd_debug_api_token';

// Detect if we're running inside the platform's iframe
// Being in an iframe (window.parent !== window) means we're hosted in the platform
// and can use postMessage to communicate with the parent for API calls
const isInPlatformIframe = typeof window !== 'undefined' && window.parent !== window;

// Only use platform ChatManager if:
// 1. We're inside an iframe (actually in the platform)
// 2. AND window.ChatManager exists (platform injected it)
const PlatformChatManager = isInPlatformIframe && window.ChatManager ? window.ChatManager : null;

if (PlatformChatManager) {
    console.log('[AIService] Running in platform iframe, using platform ChatManager');
} else if (typeof window !== 'undefined' && window.ChatManager) {
    console.log('[AIService] Platform ChatManager script loaded but not in iframe - using standalone fallback with token auth');
} else {
    console.log('[AIService] Using standalone ChatManager');
}

/**
 * StandaloneChatManager - Fallback implementation for development/testing
 *
 * Used when not running inside the rosebud.ai platform.
 * Makes direct API calls to the backend with persisted token authentication.
 */
class StandaloneChatManager {
    TIMEOUT_DURATION = 60000;

    /**
     * @param {string} characterDescription - System prompt / character description
     */
    constructor(characterDescription) {
        this.chatHistory = [];
        this.characterDescription = characterDescription;

        // Standalone-specific config (not in platform version)
        // Project ID comes from manifest for content-agnostic theming
        this._config = {
            baseUrl: 'http://localhost:8000',
            authToken: null,
            projectId: manifest.ai?.projectId || manifest.id || 'unknown-project',
            enabled: true
        };

        // Auto-load token from localStorage for dev convenience
        this._loadPersistedToken();
    }

    /**
     * Load auth token from localStorage if available
     * @private
     */
    _loadPersistedToken() {
        try {
            const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
            if (savedToken) {
                this._config.authToken = savedToken;
            }
        } catch (e) {
            // localStorage may be unavailable (incognito, etc.)
        }
    }

    /**
     * Add a message to the chat history
     * @param {string} role - "user" | "assistant" | "system"
     * @param {string} content - Message content
     */
    addMessage(role, content) {
        this.chatHistory.push({ role, content });
    }

    /**
     * Get the current chat history
     * @returns {Array<{role: string, content: string}>}
     */
    getChatHistory() {
        return this.chatHistory;
    }

    /**
     * Clear the chat history
     */
    cleanChatHistory() {
        this.chatHistory = [];
    }

    /**
     * Get a response from the AI
     *
     * Platform version: Posts to parent window via postMessage
     * Standalone version: Makes direct API call to backend
     *
     * @param {string} operation - "chat" | "classify" (default: "chat")
     * @param {number} maxTokens - Maximum response tokens (default: 384)
     * @returns {Promise<string>} - AI-generated response text
     */
    async getCharacterResponse(operation = 'chat', maxTokens = 384) {
        // Check if we're in the platform (parent window will handle the call)
        if (this._isInPlatform()) {
            return this._platformRequest(operation, maxTokens);
        }

        // Standalone mode: direct API call
        return this._standaloneRequest(operation, maxTokens);
    }

    // ========================================
    // Standalone-specific methods (not in platform ChatManager)
    // ========================================

    /**
     * Configure the standalone service
     * @param {Object} config
     * @param {string} config.baseUrl - API base URL
     * @param {string} config.authToken - JWT Bearer token
     * @param {string} config.projectId - Project ID for tracking
     * @param {boolean} config.enabled - Enable/disable AI calls
     */
    configure(config) {
        Object.assign(this._config, config);
    }

    /**
     * Set the auth token (also persists to localStorage)
     * @param {string} token - JWT Bearer token
     */
    setAuthToken(token) {
        this._config.authToken = token;
        if (token) {
            try {
                localStorage.setItem(TOKEN_STORAGE_KEY, token);
            } catch (e) { /* localStorage unavailable */ }
        }
    }

    /**
     * Clear the auth token (also removes from localStorage)
     */
    clearAuthToken() {
        this._config.authToken = null;
        try {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
        } catch (e) { /* localStorage unavailable */ }
    }

    /**
     * Check if auth token is set
     * @returns {boolean}
     */
    hasAuthToken() {
        return !!this._config.authToken;
    }

    /**
     * Check if AI is enabled
     * @returns {boolean}
     */
    isEnabled() {
        return this._config.enabled;
    }

    /**
     * Enable or disable AI
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this._config.enabled = enabled;
    }

    // ========================================
    // Private methods
    // ========================================

    /**
     * Check if we're running inside the rosebud.ai platform
     */
    _isInPlatform() {
        // If there's a parent window that's different from self, we might be in an iframe
        // The platform ChatManager.js will be injected and replace this class entirely,
        // so this check is mostly for edge cases
        return false; // Standalone always uses direct API
    }

    /**
     * Platform request via postMessage (mirrors original ChatManager)
     */
    _platformRequest(operation, maxTokens) {
        const payload = {
            character: this.characterDescription,
            messages: this.chatHistory,
            maxTokens: maxTokens,
            operation: operation,
        };

        return new Promise((resolve, reject) => {
            const requestId = self.crypto.randomUUID();

            const handleMessage = (event) => {
                const { data } = event;
                if (data.requestId === requestId) {
                    window.removeEventListener('message', handleMessage);
                    if (data.error) {
                        reject(new Error(data.error));
                    } else {
                        resolve(data.content.message);
                    }
                }
            };

            window.addEventListener('message', handleMessage);

            window.parent.postMessage(
                {
                    action: 'requestLLM',
                    payload: payload,
                    requestId: requestId,
                },
                '*',
            );

            setTimeout(() => {
                window.removeEventListener('message', handleMessage);
                reject(new Error('Request timed out'));
            }, this.TIMEOUT_DURATION);
        });
    }

    /**
     * Standalone request via direct API call
     */
    async _standaloneRequest(operation, maxTokens) {
        if (!this._config.enabled) {
            throw new Error('AI service is disabled');
        }

        const url = `${this._config.baseUrl}/api/in-game/call-llm`;

        const payload = {
            character: this.characterDescription,
            project_id: this._config.projectId,
            messages: this.chatHistory,
            maxTokens: maxTokens,
            operation: operation,
        };

        const headers = {
            'Content-Type': 'application/json'
        };

        if (this._config.authToken) {
            headers['Authorization'] = `Bearer ${this._config.authToken}`;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            return data.message;
        } catch (error) {
            console.error('[StandaloneChatManager] Request failed:', error.message);
            throw error;
        }
    }
}

// ========================================
// Resolve which ChatManager to use
// ========================================

/**
 * The ChatManager to use - either platform (window.ChatManager) or standalone fallback.
 * Platform version takes priority when available.
 */
const ChatManager = PlatformChatManager || StandaloneChatManager;

// ========================================
// Character prompts loaded from manifest
// ========================================

/**
 * Character prompts object with dynamic narrator lookup from manifest.
 * NPC prompts are accessed via createNPC() which reads from manifest.ai.npcPrompts.
 */
export const CHARACTER_PROMPTS = {
    get narrator() {
        return manifest.ai?.narratorPrompt || `You are the narrator for "${manifest.title}". Keep responses under 3 sentences.`;
    }
};

// ========================================
// Helper functions for common use cases
// ========================================

/**
 * Create a narrator ChatManager instance
 * @param {Object} config - Optional standalone config
 * @returns {ChatManager|null}
 */
export function createNarrator(config = {}) {
    if (!ChatManager) return null;

    const narrator = new ChatManager(CHARACTER_PROMPTS.narrator);
    // configure() may not exist on platform ChatManager
    if (typeof narrator.configure === 'function' && Object.keys(config).length > 0) {
        narrator.configure(config);
    }
    return narrator;
}

/**
 * Create an NPC ChatManager instance
 * @param {string} npcId - NPC identifier (e.g., 'chiefGutwad', 'vorka')
 * @param {Object} config - Optional standalone config
 * @returns {ChatManager|null}
 */
export function createNPC(npcId, config = {}) {
    if (!ChatManager) return null;

    // Look up NPC prompt from manifest
    const prompt = manifest.ai?.npcPrompts?.[npcId];
    if (!prompt) {
        console.warn(`[AIService] Unknown NPC "${npcId}" - not found in manifest.ai.npcPrompts`);
        return null;
    }

    const npc = new ChatManager(prompt);
    // configure() may not exist on platform ChatManager
    if (typeof npc.configure === 'function' && Object.keys(config).length > 0) {
        npc.configure(config);
    }
    return npc;
}

/**
 * Quick one-shot AI call (creates temporary ChatManager)
 *
 * @param {string} characterPrompt - System prompt
 * @param {string} userMessage - User message to send
 * @param {Object} options
 * @param {number} options.maxTokens - Max response tokens
 * @param {Object} options.config - Standalone config
 * @returns {Promise<string>}
 */
export async function quickChat(characterPrompt, userMessage, options = {}) {
    if (!ChatManager) {
        return Promise.reject(new Error('ChatManager not available'));
    }

    const { maxTokens = 256, config = {} } = options;

    const chat = new ChatManager(characterPrompt);
    // configure() may not exist on platform ChatManager
    if (typeof chat.configure === 'function' && Object.keys(config).length > 0) {
        chat.configure(config);
    }

    chat.addMessage('user', userMessage);
    return chat.getCharacterResponse('chat', maxTokens);
}

// Export ChatManager as default and named export
// This will be the platform version if available, otherwise standalone
export { ChatManager, StandaloneChatManager };
export default ChatManager;

// Only attach to window if not already present (don't overwrite platform version)
if (typeof window !== 'undefined' && !window.ChatManager) {
    window.ChatManager = ChatManager;
}
