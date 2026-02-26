import { EventBus } from '../../events/EventBus.js';
import { DIALOGUE_EVENTS, CHOICE_EVENTS } from '../../events/SceneEvents.js';

export class DialogueUIManager {
    constructor(scene) {
        this.scene = scene;
        this.setupListeners();
    }

    setupListeners() {
        EventBus.on(DIALOGUE_EVENTS.SHOW, this.handleShowDialogue, this);
        EventBus.on(CHOICE_EVENTS.SHOW_OPTIONS, this.handleShowChoices, this);
    }

    destroy() {
        EventBus.off(DIALOGUE_EVENTS.SHOW, this.handleShowDialogue, this);
        EventBus.off(CHOICE_EVENTS.SHOW_OPTIONS, this.handleShowChoices, this);
    }

    handleShowDialogue({ text, speaker, onContinue }) {
        this.scene.choicePanel.hide();
        this.scene.dialogueBox.setText(text, speaker);
        this.scene.dialogueBox.waitForContinue(onContinue);
    }

    handleShowChoices({ choices }) {
        this.scene.choicePanel.showChoices(choices, (choice) => {
            this.scene.choicePanel.hide();
            EventBus.emit(CHOICE_EVENTS.SELECTED, { choice });
        });
        this.scene.choicePanel.show();
    }
}
