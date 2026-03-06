import * as Tone from 'tone';

class AudioService {
  constructor() {
    this.initialized = false;
    this.synth = null;
    this.polySynth = null;
    this.noiseSynth = null;
  }

  async init() {
    if (this.initialized) return;
    
    await Tone.start();
    
    // Create synths
    this.synth = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.3,
        release: 1
      }
    }).toDestination();

    this.polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.2,
        release: 0.5
      }
    }).toDestination();

    this.noiseSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0
      }
    }).toDestination();

    this.initialized = true;
    console.log("Audio Service Initialized");
  }

  playHackSuccess() {
    if (!this.initialized) return;
    const now = Tone.now();
    // Arpeggio up
    this.synth.triggerAttackRelease("C4", "16n", now);
    this.synth.triggerAttackRelease("E4", "16n", now + 0.1);
    this.synth.triggerAttackRelease("G4", "16n", now + 0.2);
    this.synth.triggerAttackRelease("C5", "8n", now + 0.3);
  }

  playContractClaim() {
    if (!this.initialized) return;
    const now = Tone.now();
    // Digital chime
    this.polySynth.triggerAttackRelease(["G4", "B4", "D5"], "4n", now);
    this.polySynth.triggerAttackRelease(["C5", "E5", "G5"], "2n", now + 0.3);
  }

  playPuzzleComplete() {
    if (!this.initialized) return;
    const now = Tone.now();
    this.polySynth.triggerAttackRelease(["C4", "G4", "C5"], "2n", now);
  }

  playClick() {
    if (!this.initialized) return;
    this.noiseSynth.triggerAttackRelease("16n");
  }

  playError() {
    if (!this.initialized) return;
    this.synth.triggerAttackRelease("G2", "8n");
  }
}

const audioService = new AudioService();
export default audioService;
