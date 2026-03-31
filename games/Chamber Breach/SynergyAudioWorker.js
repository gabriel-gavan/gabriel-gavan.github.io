/**
 * NeuralSynergyAudioWorker.js
 * High-priority AudioWorklet for procedural synthesis of the Neural Sync minigame.
 * This runs on a separate real-time thread to ensure glitch-free audio even under heavy CPU load.
 */

class SynergyProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.ringPhases = [0, 0, 0];
    this.syncFrequencies = [220, 330, 440]; // Carrier frequencies for each ring
    this.playerFrequency = 220;
    this.isSyncing = false;
    this.glitchIntensity = 0;
    this.noisePhase = 0;
    this.ambientIntensity = 0.05;
    
    // Combat sounds: arrays of active sound instances
    this.activeSounds = [];
    
    this.port.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'SET_SYNCING') {
        this.isSyncing = payload;
      } else if (type === 'UPDATE_PLAYER_FREQ') {
        this.playerFrequency = payload;
      } else if (type === 'SET_GLITCH') {
        this.glitchIntensity = payload;
      } else if (type === 'SET_AMBIENT') {
        this.ambientIntensity = payload;
      } else if (type === 'TRIGGER_SOUND') {
        this.triggerSound(payload);
      }
    };
  }

  triggerSound(payload) {
    const { soundType, freq = 220, decay = 0.1, gain = 0.2 } = payload;
    
    // Complex sounds can be composed of multiple components
    if (soundType === 'shot_rifle') {
        this.activeSounds.push({ type: 'noise', phase: 0, freq: 440, currentGain: 0.3, decay: 0.05, life: 1.0 });
        this.activeSounds.push({ type: 'pulse', phase: 0, freq: 110, currentGain: 0.2, decay: 0.15, life: 1.0 });
    } else if (soundType === 'shot_sniper') {
        this.activeSounds.push({ type: 'noise', phase: 0, freq: 220, currentGain: 0.5, decay: 0.1, life: 1.0 });
        this.activeSounds.push({ type: 'pulse', phase: 0, freq: 55, currentGain: 0.4, decay: 0.4, life: 1.0 });
    } else {
        this.activeSounds.push({
          type: soundType,
          phase: 0,
          freq: freq,
          currentGain: gain,
          decay: decay,
          life: 1.0 // 1.0 to 0.0
        });
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channel = output[0];
    const sampleRate = globalThis.sampleRate;

    for (let i = 0; i < channel.length; i++) {
      let sample = 0;

      // 1. Ambient Hum
      this.noisePhase += (2 * Math.PI * 50) / sampleRate; // 50Hz hum
      sample += Math.sin(this.noisePhase) * this.ambientIntensity * 0.5;
      sample += (Math.random() * 2 - 1) * this.ambientIntensity * 0.1;

      // 2. Generate the base carrier frequencies for active rings
      if (this.isSyncing) {
        for (let j = 0; j < 3; j++) {
          const freq = this.syncFrequencies[j];
          this.ringPhases[j] += (2 * Math.PI * freq) / sampleRate;
          sample += Math.sin(this.ringPhases[j]) * 0.1;
        }

        // 3. Player sync tone
        this.phase += (2 * Math.PI * this.playerFrequency) / sampleRate;
        sample += Math.sin(this.phase) * 0.15;
        sample += Math.sin(this.phase * 0.5) * 0.05;
      }

      // 4. Glitch/Noise layer
      if (this.glitchIntensity > 0) {
        const noise = (Math.random() * 2 - 1) * this.glitchIntensity * 0.3;
        if (Math.sin(this.noisePhase * 10) > 0.8) {
            sample += noise * 2.0;
        } else {
            sample += noise * 0.5;
        }
      }

      // 5. Active Combat Sounds
      for (let j = this.activeSounds.length - 1; j >= 0; j--) {
        const s = this.activeSounds[j];
        s.phase += (2 * Math.PI * s.freq) / sampleRate;
        
        let sSample = 0;
        if (s.type === 'pulse') {
            sSample = Math.sin(s.phase) * s.currentGain * s.life;
        } else if (s.type === 'noise') {
            sSample = (Math.random() * 2 - 1) * s.currentGain * s.life;
        }
        
        sample += sSample;
        s.life -= (1.0 / (s.decay * sampleRate));
        
        if (s.life <= 0) {
            this.activeSounds.splice(j, 1);
        }
      }

      // Master gain & soft limiting
      sample = Math.tanh(sample * 0.8);
      channel[i] = sample;
    }

    return true;
  }
}

registerProcessor('synergy-processor', SynergyProcessor);
