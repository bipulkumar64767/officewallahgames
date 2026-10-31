/**
 * Web Audio API Sound Synthesizer for Ludo Royale
 * 100% self-contained synthesized sounds - no external MP3/audio files needed.
 */

class LudoAudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.muted = false;

    try {
      const saved = localStorage.getItem('owg_ludo_sound_enabled');
      if (saved !== null) {
        this.muted = saved === 'false';
      }
    } catch {
      this.muted = false;
    }
  }

  getContext() {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.ctx) {
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  isMuted() {
    return this.muted;
  }

  setMuted(muted) {
    this.muted = !!muted;
    try {
      localStorage.setItem('owg_ludo_sound_enabled', this.muted ? 'false' : 'true');
    } catch {
      // Ignore storage errors
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * 1. Dice roll rattle sound:
   * Generates multiple crisp wooden rattling clicks over 500ms
   */
  playDiceRoll() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const rattleCount = 7;

      for (let i = 0; i < rattleCount; i++) {
        const time = now + i * 0.065 + Math.random() * 0.02;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        // Wooden hollow percussion rattle
        osc.type = i % 2 === 0 ? 'triangle' : 'sine';
        const startFreq = 220 + Math.random() * 320;
        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.exponentialRampToValueAtTime(80, time + 0.05);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800 + Math.random() * 400, time);
        filter.Q.setValueAtTime(3, time);

        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.06);
      }
    } catch (e) {
      console.warn('[LudoAudio] Dice roll sound error:', e);
    }
  }

  /**
   * 2. Token step hop sound:
   * Cheerful high-pitch tick/pop triggered every 110ms during box-by-box goti movement
   */
  playHop(stepPitchOffset = 0) {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Subtle pitch variation as it advances
      const baseFreq = 540 + Math.min(stepPitchOffset * 8, 200);
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.045);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      console.warn('[LudoAudio] Hop sound error:', e);
    }
  }

  /**
   * 3. Token capture explosion sound:
   * Heavy bass impact combined with noise blast
   */
  playCapture() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Sub-bass thud
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(160, now);
      bassOsc.frequency.exponentialRampToValueAtTime(30, now + 0.28);

      bassGain.gain.setValueAtTime(0.35, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      bassOsc.connect(bassGain);
      bassGain.connect(ctx.destination);

      bassOsc.start(now);
      bassOsc.stop(now + 0.32);

      // Noise explosion burst
      const bufferSize = Math.floor(ctx.sampleRate * 0.25);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.25);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.28, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.27);
    } catch (e) {
      console.warn('[LudoAudio] Capture sound error:', e);
    }
  }

  /**
   * 4. Victory fanfare sound:
   * Ascending celebratory harmonic arpeggio (C5 -> E5 -> G5 -> C6)
   */
  playVictory() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const time = now + idx * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        const duration = idx === notes.length - 1 ? 0.6 : 0.2;
        gain.gain.setValueAtTime(0.22, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + duration + 0.05);
      });
    } catch (e) {
      console.warn('[LudoAudio] Victory fanfare sound error:', e);
    }
  }
}

export const ludoAudio = new LudoAudioSynthesizer();
export default ludoAudio;
