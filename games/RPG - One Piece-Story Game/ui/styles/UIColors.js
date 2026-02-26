/**
 * UI color palette - re-exports colors from manifest for theming
 *
 * Colors are defined in manifest.js for full theming support.
 * This module provides a simple re-export with type safety.
 */
import { manifest } from '../../manifest.js';

// Re-export manifest colors directly
export const UI_COLORS = manifest.ui?.colors || {};
