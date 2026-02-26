/**
 * SoundEffects - Combat audio using Tone.js
 * 
 * Provides procedural sound effects for various combat events
 */

import * as Tone from 'tone';

export class SoundEffects {
    constructor() {
        this.initialized = false;
        this.enabled = true;
        this.volume = 0.6; // Default volume (0.0 to 1.0)
    }

    /**
     * Initialize Tone.js context (must be called after user interaction)
     */
    async init() {
        if (this.initialized) return;
        
        try {
            await Tone.start();
            this.initialized = true;
        } catch (error) {
            console.warn('[Audio] Failed to initialize audio:', error);
            this.enabled = false;
        }
    }

    /**
     * Helper to get volume in decibels for Tone.js
     */
    getVolumeDb() {
        return Tone.gainToDb(this.volume);
    }

    /**
     * Play a melee attack sound - weapon swing with "thwack"
     */
    playMeleeAttack() {
        if (!this.enabled || !this.initialized) return;

        // Whooshing swing sound
        const whoosh = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: {
                attack: 0.005,
                decay: 0.1,
                sustain: 0,
                release: 0.08
            },
            volume: this.getVolumeDb() + 2
        }).toDestination();

        // Impact "thwack"
        const thwack = new Tone.NoiseSynth({
            noise: { type: 'brown' },
            envelope: {
                attack: 0.001,
                decay: 0.08,
                sustain: 0
            },
            volume: this.getVolumeDb()
        }).toDestination();

        const now = Tone.now();
        
        // Swing down pitch for whoosh
        whoosh.frequency.setValueAtTime(700, now);
        whoosh.frequency.exponentialRampToValueAtTime(180, now + 0.12);
        whoosh.triggerAttackRelease('0.12', now);
        
        // Impact slightly after
        thwack.triggerAttackRelease('0.08', now + 0.08);
        
        setTimeout(() => {
            whoosh.dispose();
            thwack.dispose();
        }, 400);
    }

    /**
     * Play a ranged attack sound - arrow/bolt with "zip" and wobble
     */
    playRangedAttack() {
        if (!this.enabled || !this.initialized) return;

        // Bowstring "twang"
        const twang = new Tone.PluckSynth({
            attackNoise: 2,
            dampening: 2000,
            resonance: 0.95,
            volume: this.getVolumeDb() - 2
        }).toDestination();

        // Arrow flight "zip"
        const zip = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.001,
                decay: 0.2,
                sustain: 0.1,
                release: 0.2
            },
            volume: this.getVolumeDb() + 2
        }).toDestination();

        const now = Tone.now();
        
        // Bowstring release
        twang.triggerAttackRelease('A4', '0.15', now);
        
        // Arrow flight (doppler effect)
        zip.frequency.setValueAtTime(1400, now + 0.02);
        zip.frequency.exponentialRampToValueAtTime(350, now + 0.45);
        zip.triggerAttackRelease('0.45', now + 0.02);
        
        setTimeout(() => {
            twang.dispose();
            zip.dispose();
        }, 700);
    }

    /**
     * Play a magic/special ability sound - divine/chaotic magic
     */
    playSpecialAbility() {
        if (!this.enabled || !this.initialized) return;

        // Magical buildup/charge
        const charge = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.08,
                decay: 0.18,
                sustain: 0,
                release: 0.12
            },
            volume: this.getVolumeDb()
        }).toDestination();

        // Magical shimmer (bells/chimes)
        const shimmer = new Tone.MetalSynth({
            frequency: 450,
            envelope: {
                attack: 0.001,
                decay: 0.5,
                release: 0.6
            },
            harmonicity: 8,
            modulationIndex: 20,
            resonance: 3000,
            octaves: 1.5,
            volume: this.getVolumeDb() + 4
        });

        // Divine "whoosh"
        const release = new Tone.NoiseSynth({
            noise: { type: 'pink' },
            envelope: {
                attack: 0.01,
                decay: 0.3,
                sustain: 0
            },
            volume: this.getVolumeDb() - 6
        }).toDestination();

        const reverb = new Tone.Reverb({
            decay: 2.5,
            wet: 0.5
        }).toDestination();

        // Connect shimmer through reverb to destination
        shimmer.connect(reverb);

        const now = Tone.now();
        
        // Charge up
        charge.frequency.setValueAtTime(220, now);
        charge.frequency.exponentialRampToValueAtTime(660, now + 0.18);
        charge.triggerAttackRelease('0.18', now);
        
        // Magic release
        shimmer.triggerAttackRelease('0.7', now + 0.14);
        release.triggerAttackRelease('0.3', now + 0.14);
        
        setTimeout(() => {
            charge.dispose();
            shimmer.dispose();
            release.dispose();
            reverb.dispose();
        }, 2200);
    }

    /**
     * Play damage sound - impact hit
     */
    playDamage(amount = 1) {
        if (!this.enabled || !this.initialized) return;

        const intensity = Math.min(amount / 5, 1); // Scale with damage amount
        
        // Impact thud
        const thud = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 4,
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.001,
                decay: 0.1,
                sustain: 0,
                release: 0.1
            },
            volume: this.getVolumeDb() + (intensity * 4)
        }).toDestination();

        // Impact burst (controlled noise)
        const burst = new Tone.NoiseSynth({
            noise: { type: 'brown' },
            envelope: {
                attack: 0.002,
                decay: 0.06,
                sustain: 0
            },
            volume: this.getVolumeDb() - 2
        });
        
        const filter = new Tone.Filter({
            frequency: 400 + (intensity * 600),
            type: 'lowpass',
            rolloff: -24
        }).toDestination();

        burst.connect(filter);
        
        const now = Tone.now();
        
        // Lower pitch for bigger hits
        const pitch = 'C2';
        thud.triggerAttackRelease(pitch, '0.1', now);
        burst.triggerAttackRelease('0.06', now);
        
        setTimeout(() => {
            thud.dispose();
            burst.dispose();
            filter.dispose();
        }, 300);
    }

    /**
     * Play heal sound - gentle sparkle
     */
    playHeal() {
        if (!this.enabled || !this.initialized) return;

        const synth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.05,
                decay: 0.2,
                sustain: 0.1,
                release: 0.3
            },
            volume: this.getVolumeDb()
        }).toDestination();

        const now = Tone.now();
        synth.triggerAttackRelease('G5', '0.2', now);
        synth.triggerAttackRelease('B5', '0.2', now + 0.1);
        synth.triggerAttackRelease('D6', '0.3', now + 0.2);
        
        setTimeout(() => synth.dispose(), 800);
    }

    /**
     * Play enemy spawn sound - dramatic entrance rumble
     */
    playEnemySpawn() {
        if (!this.enabled || !this.initialized) return;

        // Deep rumble bass
        const rumble = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: {
                attack: 0.3,
                decay: 0.4,
                sustain: 0.2,
                release: 0.6
            },
            volume: this.getVolumeDb() - 4
        }).toDestination();

        // Dramatic accent chord
        const chord = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sawtooth' },
            envelope: {
                attack: 0.05,
                decay: 0.3,
                sustain: 0.1,
                release: 0.4
            },
            volume: this.getVolumeDb() - 8
        }).toDestination();

        // Atmospheric whoosh
        const whoosh = new Tone.NoiseSynth({
            noise: { type: 'pink' },
            envelope: {
                attack: 0.2,
                decay: 0.5,
                sustain: 0
            },
            volume: this.getVolumeDb() - 12
        }).toDestination();

        const filter = new Tone.Filter({
            frequency: 800,
            type: 'lowpass',
            rolloff: -24
        }).toDestination();

        whoosh.connect(filter);

        const now = Tone.now();
        
        // Deep rumble foundation
        rumble.triggerAttackRelease('C2', '1.2', now);
        rumble.triggerAttackRelease('E2', '1.0', now + 0.35);
        
        // Dramatic chord stab
        chord.triggerAttackRelease(['D3', 'F3', 'Ab3'], '0.6', now + 0.15);
        
        // Atmospheric entrance
        whoosh.triggerAttackRelease('0.6', now + 0.1);
        
        setTimeout(() => {
            rumble.dispose();
            chord.dispose();
            whoosh.dispose();
            filter.dispose();
        }, 2000);
    }

    /**
     * Play victory sound - triumphant fanfare
     */
    playVictory() {
        if (!this.enabled || !this.initialized) return;

        const synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'square' },
            envelope: {
                attack: 0.05,
                decay: 0.1,
                sustain: 0.3,
                release: 0.5
            },
            volume: this.getVolumeDb()
        }).toDestination();

        const now = Tone.now();
        synth.triggerAttackRelease(['C4', 'E4', 'G4'], '0.3', now);
        synth.triggerAttackRelease(['E4', 'G4', 'C5'], '0.3', now + 0.3);
        synth.triggerAttackRelease(['G4', 'C5', 'E5'], '0.5', now + 0.6);
        
        setTimeout(() => synth.dispose(), 1500);
    }

    /**
     * Play defeat sound - descending failure
     */
    playDefeat() {
        if (!this.enabled || !this.initialized) return;

        const synth = new Tone.Synth({
            oscillator: { type: 'sawtooth' },
            envelope: {
                attack: 0.1,
                decay: 0.2,
                sustain: 0.2,
                release: 0.8
            },
            volume: this.getVolumeDb()
        }).toDestination();

        const now = Tone.now();
        synth.triggerAttackRelease('A3', '1.0', now);
        synth.triggerAttackRelease('F3', '1.0', now + 0.4);
        synth.triggerAttackRelease('C3', '1.5', now + 0.8);
        
        setTimeout(() => synth.dispose(), 2500);
    }

    /**
     * Play buff/positive effect sound - ascending chime
     */
    playBuff() {
        if (!this.enabled || !this.initialized) return;

        const synth = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: {
                attack: 0.01,
                decay: 0.2,
                sustain: 0.1,
                release: 0.3
            },
            volume: this.getVolumeDb()
        }).toDestination();

        const now = Tone.now();
        synth.triggerAttackRelease('C5', '0.15', now);
        synth.triggerAttackRelease('E5', '0.15', now + 0.08);
        synth.triggerAttackRelease('G5', '0.2', now + 0.16);
        
        setTimeout(() => synth.dispose(), 600);
    }

    /**
     * Play debuff/negative effect sound - descending drone
     */
    playDebuff() {
        if (!this.enabled || !this.initialized) return;

        const synth = new Tone.Synth({
            oscillator: { type: 'sawtooth' },
            envelope: {
                attack: 0.02,
                decay: 0.2,
                sustain: 0.1,
                release: 0.3
            },
            volume: this.getVolumeDb()
        }).toDestination();

        const now = Tone.now();
        synth.triggerAttackRelease('E4', '0.15', now);
        synth.triggerAttackRelease('C4', '0.15', now + 0.08);
        synth.triggerAttackRelease('A3', '0.2', now + 0.16);
        
        setTimeout(() => synth.dispose(), 600);
    }

    /**
     * Play critical fail sound - sad descending notes
     */
    playCriticalFail() {
        if (!this.enabled || !this.initialized) return;

        // Descending "failure" notes
        const synth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.02,
                decay: 0.2,
                sustain: 0.1,
                release: 0.3
            },
            volume: this.getVolumeDb()
        }).toDestination();

        // Sad trombone-style effect
        const wobble = new Tone.Synth({
            oscillator: { type: 'sawtooth' },
            envelope: {
                attack: 0.01,
                decay: 0.3,
                sustain: 0,
                release: 0.2
            },
            volume: this.getVolumeDb() - 6
        }).toDestination();

        const now = Tone.now();
        
        // Descending disappointed notes
        synth.triggerAttackRelease('E4', '0.15', now);
        synth.triggerAttackRelease('D4', '0.15', now + 0.12);
        synth.triggerAttackRelease('C4', '0.15', now + 0.24);
        synth.triggerAttackRelease('A3', '0.25', now + 0.36);
        
        // Sad wobble down
        wobble.frequency.setValueAtTime(220, now + 0.3);
        wobble.frequency.exponentialRampToValueAtTime(110, now + 0.65);
        wobble.triggerAttackRelease('0.35', now + 0.3);
        
        setTimeout(() => {
            synth.dispose();
            wobble.dispose();
        }, 900);
    }

    /**
     * Play critical hit sound - explosive impact with sparkle
     */
    playCritical() {
        if (!this.enabled || !this.initialized) return;

        // Deep explosive impact
        const impact = new Tone.MembraneSynth({
            pitchDecay: 0.08,
            octaves: 8,
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.001,
                decay: 0.5,
                sustain: 0.01,
                release: 0.5
            },
            volume: this.getVolumeDb() + 2
        }).toDestination();

        // Explosive burst (controlled noise)
        const burst = new Tone.NoiseSynth({
            noise: { type: 'brown' },
            envelope: {
                attack: 0.005,
                decay: 0.08,
                sustain: 0
            },
            volume: this.getVolumeDb() - 4
        }).toDestination();

        // Critical sparkle/shimmer
        const sparkle = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.005,
                decay: 0.3,
                sustain: 0,
                release: 0.3
            },
            volume: this.getVolumeDb() - 2
        }).toDestination();

        // Reverb for epic feel
        const reverb = new Tone.Reverb({
            decay: 1.5,
            wet: 0.3
        }).toDestination();

        sparkle.connect(reverb);

        const now = Tone.now();
        
        // Deep impact
        impact.triggerAttackRelease('C1', '0.4', now);
        
        // Explosive burst
        burst.triggerAttackRelease('0.08', now);
        
        // Rising sparkle notes for "critical" feel
        sparkle.triggerAttackRelease('C5', '0.25', now + 0.02);
        sparkle.triggerAttackRelease('E5', '0.25', now + 0.05);
        sparkle.triggerAttackRelease('G5', '0.3', now + 0.08);
        sparkle.triggerAttackRelease('C6', '0.35', now + 0.12);
        
        setTimeout(() => {
            impact.dispose();
            burst.dispose();
            sparkle.dispose();
            reverb.dispose();
        }, 1200);
    }

    /**
     * Play initiative roll sound - dice rolling
     */
    playInitiative() {
        if (!this.enabled || !this.initialized) return;

        // Dice rattle - use NoiseSynth for proper envelope
        const rattle = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: {
                attack: 0.02,  // Smooth attack to avoid static
                decay: 0.15,
                sustain: 0
            },
            volume: this.getVolumeDb() - 8
        });
        
        const filter = new Tone.Filter({
            frequency: 3000,
            type: 'lowpass',
            rolloff: -12
        }).toDestination();

        rattle.connect(filter);

        const now = Tone.now();
        
        // Multiple short rattles to simulate dice rolling
        rattle.triggerAttackRelease('0.08', now);
        rattle.triggerAttackRelease('0.06', now + 0.09);
        rattle.triggerAttackRelease('0.05', now + 0.16);
        
        // Final "clack" when dice settle
        const clack = new Tone.MembraneSynth({
            pitchDecay: 0.01,
            octaves: 2,
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.001,
                decay: 0.08,
                sustain: 0,
                release: 0.05
            },
            volume: this.getVolumeDb() - 4
        }).toDestination();

        clack.triggerAttackRelease('C5', '0.08', now + 0.22);
        
        setTimeout(() => {
            rattle.dispose();
            filter.dispose();
            clack.dispose();
        }, 600);
    }

    /**
     * Toggle sound effects on/off
     */
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    /**
     * Set volume (0.0 to 1.0)
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Cleanup all resources
     */
    dispose() {
        // Individual synths are disposed after use, nothing to cleanup here
    }
}

// Singleton instance
let soundEffectsInstance = null;

export function getSoundEffects() {
    if (!soundEffectsInstance) {
        soundEffectsInstance = new SoundEffects();
    }
    return soundEffectsInstance;
}
