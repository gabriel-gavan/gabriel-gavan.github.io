import * as Tone from 'tone';

class AudioManager {
    constructor() {
        this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
        this.hitNoise = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: {
                attack: 0.005, decay: 0.1, sustain: 0
            }
        }).toDestination();
        
        this.magicSynth = new Tone.MonoSynth({
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.01, decay: 0.3, sustain: 0
            }
        }).toDestination();

        // Background music synth
        this.bgmSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.8 }
        }).toDestination();
        this.bgmSynth.volume.value = -15;

        this.bgmPlaying = false;
        this.currentBgmPart = null;
    }

    startBgm() {
        if (this.bgmPlaying) return;
        this.bgmPlaying = true;
        if (Tone.context.state !== 'running') Tone.start();

        const notes = ["C3", "G3", "C4", "Eb4", "G4", "C3", "F3", "Ab3", "C4", "F4"];
        this.currentBgmPart = new Tone.Sequence((time, note) => {
            this.bgmSynth.triggerAttackRelease(note, "4n", time);
        }, notes, "4n").start(0);
        
        Tone.Transport.bpm.value = 110;
        Tone.Transport.start();
    }

    playJump() {
        if (Tone.context.state !== 'running') Tone.start();
        this.synth.triggerAttackRelease("C4", "8n", undefined, 0.4);
    }

    playShoot() {
        if (Tone.context.state !== 'running') Tone.start();
        this.magicSynth.triggerAttackRelease("G5", "16n", undefined, 0.3);
    }

    playImpact() {
        if (Tone.context.state !== 'running') Tone.start();
        this.magicSynth.triggerAttackRelease("C3", "8n", undefined, 0.5);
    }

    playHit() {
        if (Tone.context.state !== 'running') Tone.start();
        this.synth.triggerAttackRelease("C2", "16n", undefined, 1);
        this.hitNoise.triggerAttackRelease("16n");
    }

    playGameOver() {
        if (Tone.context.state !== 'running') Tone.start();
        const now = Tone.now();
        this.synth.triggerAttackRelease("G2", "8n", now);
        this.synth.triggerAttackRelease("E2", "8n", now + 0.2);
        this.synth.triggerAttackRelease("C2", "4n", now + 0.4);
    }
}

export const audioManager = new AudioManager();
