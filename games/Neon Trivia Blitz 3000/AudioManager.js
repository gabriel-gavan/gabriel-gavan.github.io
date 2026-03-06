import * as Tone from 'tone';

export class AudioManager {
    constructor() {
        this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
        this.isStarted = false;
        
        // Effects
        this.correctSynth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1 }
        }).toDestination();
        
        this.wrongSynth = new Tone.Synth({
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.2, release: 0.5 }
        }).toDestination();

        this.clickSynth = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 10,
            oscillator: { type: 'sine' }
        }).toDestination();

        this.tickSynth = new Tone.PluckSynth().toDestination();
    }

    async start() {
        if (this.isStarted) return;
        await Tone.start();
        this.isStarted = true;
        console.log("Audio Engine Started");
    }

    playCorrect() {
        if (!this.isStarted) return;
        this.correctSynth.triggerAttackRelease("C4", "8n", "+0");
        this.correctSynth.triggerAttackRelease("E4", "8n", "+0.1");
        this.correctSynth.triggerAttackRelease("G4", "4n", "+0.2");
    }

    playWrong() {
        if (!this.isStarted) return;
        this.wrongSynth.triggerAttackRelease("G2", "4n", "+0");
        this.wrongSynth.triggerAttackRelease("F2", "4n", "+0.2");
    }

    playClick() {
        if (!this.isStarted) return;
        this.clickSynth.triggerAttackRelease("C2", "16n");
    }

    playTick() {
        if (!this.isStarted) return;
        this.tickSynth.triggerAttackRelease("C6", "32n");
    }

    playStart() {
        if (!this.isStarted) return;
        const now = Tone.now();
        this.synth.triggerAttackRelease("C4", "8n", now);
        this.synth.triggerAttackRelease("E4", "8n", now + 0.1);
        this.synth.triggerAttackRelease("G4", "8n", now + 0.2);
        this.synth.triggerAttackRelease("C5", "4n", now + 0.3);
    }
}
