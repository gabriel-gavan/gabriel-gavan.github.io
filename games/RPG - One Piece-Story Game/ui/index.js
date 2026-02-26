/**
 * UI Components - Barrel export for backward compatibility
 *
 * Allows importing all components from a single location:
 *   import { DialogueBox, ChoicePanel, ... } from './ui/index.js';
 *
 * Or import individually for smaller bundles:
 *   import { DialogueBox } from './ui/components/DialogueBox.js';
 */

// Styles
export { UI_COLORS } from './styles/UIColors.js';

// Components
export { DialogueBox } from './components/DialogueBox.js';
export { ChoiceButton } from './components/ChoiceButton.js';
export { ChoicePanel } from './components/ChoicePanel.js';
export { HealthDisplay } from './components/HealthDisplay.js';
export { EnemyDisplay } from './components/EnemyDisplay.js';
export { CharacterSelectPanel } from './components/CharacterSelectPanel.js';
export { AbilityPanel } from './components/AbilityPanel.js';
export { InitiativeTracker } from './components/InitiativeTracker.js';
export { CombatErrorDialog } from './components/CombatErrorDialog.js';
