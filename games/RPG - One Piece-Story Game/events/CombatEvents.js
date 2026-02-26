export const COMBAT_EVENTS = {
    INITIATIVE: {
        ROLLED: 'combat.initiative.rolled',
        TURN_CHANGED: 'combat.initiative.turn_changed'
    },
    ABILITY: {
        SELECT_REQUESTED: 'combat.ability.select_requested'
    },
    HEALTH: {
        PARTY_UPDATED: 'combat.health.party_updated',
        DAMAGE_TAKEN: 'combat.health.damage_taken',
        HEAL_RECEIVED: 'combat.health.heal_received'
    },
    TARGET: {
        ENEMY_TARGETING: 'combat.target.enemy_targeting',
        TARGET_CLEARED: 'combat.target.target_cleared'
    },
    ENEMY: {
        SPAWNED: 'combat.enemy.spawned',
        STATUS_UPDATED: 'combat.enemy.status_updated',
        DAMAGE_FLASH: 'combat.enemy.damage_flash'
    },
    ACTION: {
        EXECUTED: 'combat.action.executed',
        ANIMATION_COMPLETE: 'combat.action.animation_complete'
    },
    DICE: {
        ROLL_REQUESTED: 'combat.dice.roll_requested'
    },
    SCENE: {
        VICTORY: 'combat.scene.victory',
        LOAD_REQUESTED: 'combat.scene.load_requested'
    },
    NARRATION: {
        SHOW: 'combat.narration.show'
    },
    ERROR: {
        SHOW: 'combat.error.show'
    }
};
