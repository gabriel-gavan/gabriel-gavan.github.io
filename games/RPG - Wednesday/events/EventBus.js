import Phaser from 'phaser';

class GameEventBus extends Phaser.Events.EventEmitter {
    constructor() {
        super();
        this.debugMode = false;
    }
    emit(event, ...args) {
        if (this.debugMode) console.log(`[EventBus] ${event}`, ...args);
        return super.emit(event, ...args);
    }
}
export const EventBus = new GameEventBus();
