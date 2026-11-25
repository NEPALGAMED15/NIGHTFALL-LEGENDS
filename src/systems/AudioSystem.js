class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.volume = 0.65;
    this.ambientTimer = null;
    this.ambientMood = 'forest';
    this.isNight = true;
    this.ambientStep = 0;
  }

  ensureContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  playTone({ freq = 440, endFreq = null, type = 'triangle', duration = 0.14, gain = 0.2, jitter = 0.08 }) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const variance = 1 + (Math.random() * 2 - 1) * jitter;

    osc.type = type;
    osc.frequency.setValueAtTime(freq * variance, now);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq * variance), now + duration);
    }

    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playNoise({ duration = 0.12, filterFreq = 900, gain = 0.18 }) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;

    const env = ctx.createGain();
    const now = ctx.currentTime;
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);
    src.start(now);
  }

  playJump(isDouble = false) {
    this.playTone({
      freq: isDouble ? 340 : 220,
      endFreq: isDouble ? 620 : 410,
      type: 'sine',
      duration: 0.13,
      gain: 0.14,
    });
  }

  playSlash(comboStep = 0) {
    const base = [480, 560, 700][comboStep % 3] || 480;
    this.playNoise({ duration: 0.11, filterFreq: base * 2.2, gain: 0.18 });
    this.playTone({
      freq: base,
      endFreq: base * 0.38,
      type: comboStep === 2 ? 'sawtooth' : 'triangle',
      duration: comboStep === 2 ? 0.18 : 0.12,
      gain: comboStep === 2 ? 0.2 : 0.14,
    });
  }

  playHit(heavy = false) {
    this.playNoise({ duration: heavy ? 0.16 : 0.09, filterFreq: heavy ? 420 : 720, gain: heavy ? 0.28 : 0.18 });
    this.playTone({
      freq: heavy ? 130 : 190,
      endFreq: 48,
      type: 'square',
      duration: heavy ? 0.16 : 0.09,
      gain: heavy ? 0.22 : 0.14,
    });
  }

  playDash() {
    this.playNoise({ duration: 0.16, filterFreq: 1300, gain: 0.17 });
    this.playTone({ freq: 520, endFreq: 180, type: 'sine', duration: 0.15, gain: 0.12 });
  }

  playAbility(abilityId) {
    if (abilityId === 'night_vision') {
      this.playTone({ freq: 523, endFreq: 784, type: 'sine', duration: 0.24, gain: 0.16 });
    } else if (abilityId === 'soul_strike') {
      this.playSlash(2);
      this.playTone({ freq: 640, endFreq: 260, type: 'triangle', duration: 0.28, gain: 0.2 });
    } else if (abilityId === 'eclipse_mode') {
      this.playTone({ freq: 146, endFreq: 293, type: 'sawtooth', duration: 0.36, gain: 0.22 });
      setTimeout(() => this.playTone({ freq: 440, endFreq: 660, type: 'triangle', duration: 0.3, gain: 0.18 }), 80);
    } else if (abilityId === 'echo_clone') {
      this.playTone({ freq: 392, endFreq: 587, type: 'triangle', duration: 0.22, gain: 0.16 });
    } else {
      this.playDash();
    }
  }

  playPickup(type = 'shard') {
    if (type === 'heal') {
      this.playTone({ freq: 440, endFreq: 660, type: 'sine', duration: 0.2, gain: 0.16 });
    } else if (type === 'gem') {
      this.playTone({ freq: 587, endFreq: 880, type: 'triangle', duration: 0.22, gain: 0.18 });
      setTimeout(() => this.playTone({ freq: 880, endFreq: 1175, type: 'sine', duration: 0.22, gain: 0.16 }), 70);
    } else {
      this.playTone({ freq: 660, endFreq: 880, type: 'sine', duration: 0.14, gain: 0.13 });
    }
  }

  playCheckpoint() {
    [330, 440, 554, 659].forEach((freq, idx) => {
      setTimeout(() => this.playTone({ freq, type: 'triangle', duration: 0.24, gain: 0.14, jitter: 0.01 }), idx * 75);
    });
  }

  playSwitch() {
    this.playTone({ freq: 220, endFreq: 330, type: 'sawtooth', duration: 0.25, gain: 0.18 });
    setTimeout(() => this.playNoise({ duration: 0.28, filterFreq: 260, gain: 0.2 }), 90);
  }

  playBossTelegraph() {
    this.playTone({ freq: 165, endFreq: 245, type: 'sawtooth', duration: 0.32, gain: 0.22, jitter: 0.02 });
  }

  playPlayerHurt() {
    this.playTone({ freq: 185, endFreq: 75, type: 'sawtooth', duration: 0.24, gain: 0.26 });
    this.playNoise({ duration: 0.14, filterFreq: 500, gain: 0.2 });
  }

  playVictory() {
    [392, 494, 587, 784].forEach((freq, idx) => {
      setTimeout(() => this.playTone({ freq, type: 'triangle', duration: 0.34, gain: 0.18, jitter: 0 }), idx * 110);
    });
  }

  playDefeat() {
    [294, 262, 220, 165].forEach((freq, idx) => {
      setTimeout(() => this.playTone({ freq, type: 'sawtooth', duration: 0.32, gain: 0.16, jitter: 0 }), idx * 140);
    });
  }

  startAmbient(mood = 'forest') {
    this.ambientMood = mood;
    this.stopAmbient();
    const scales = {
      forest: [146.83, 174.61, 196.0, 220.0, 261.63],
      frost: [196.0, 233.08, 261.63, 293.66, 349.23],
      ashen: [110.0, 130.81, 146.83, 164.81, 196.0],
      drowned: [130.81, 155.56, 174.61, 196.0, 233.08],
      skyfall: [220.0, 261.63, 293.66, 329.63, 392.0],
      shadow: [123.47, 146.83, 164.81, 185.0, 220.0],
      citadel: [110.0, 116.54, 146.83, 164.81, 220.0],
    };
    this.ambientTimer = setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
      const notes = scales[this.ambientMood] || scales.forest;
      const baseNote = notes[this.ambientStep % notes.length];
      this.ambientStep += 1;
      const freq = this.isNight ? baseNote * 0.75 : baseNote;
      this.playTone({
        freq,
        type: this.isNight ? 'sine' : 'triangle',
        duration: 0.9,
        gain: 0.032,
        jitter: 0.015,
      });
    }, 1500);
  }

  setTimeMood(isNight) {
    this.isNight = Boolean(isNight);
  }

  stopAmbient() {
    if (this.ambientTimer) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }
}

export const audioSystem = new AudioSystem();
