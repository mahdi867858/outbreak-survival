// Web Audio API Synthesizer and Audio Manager
class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.rainNode = null;
    this.windNode = null;
    this.musicActive = false;
    this.ambientActive = false;
    this.musicOscs = [];
    this.musicTimeout = null;
    this.sirenInterval = null;
    this.sirenActive = false;
    this.sirenNodes = [];
  }

  init() {
    if (this.ctx) return;
    
    // Create Audio Context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Master volume gain node
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime); // Standard comfortable volume
    this.masterGain.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Helper: Create a noise buffer
  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Play continuous rain sound
  startRain() {
    if (!this.ctx || this.rainNode) return;
    this.resume();

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.5;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.08; // quiet background rain

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
    this.rainNode = { source: noise, gain: gain };
  }

  // Adjust rain intensity (heavy during night)
  setRainIntensity(heavy) {
    if (!this.rainNode) return;
    const targetGain = heavy ? 0.25 : 0.08;
    this.rainNode.gain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 2.0);
  }

  // Play continuous wind sound
  startWind() {
    if (!this.ctx || this.windNode) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.04;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();

    // Modulate wind filter frequency slowly to create gusts
    const modulateWind = () => {
      if (!this.windNode) return;
      const t = this.ctx.currentTime;
      filter.frequency.exponentialRampToValueAtTime(150 + Math.random() * 400, t + 4 + Math.random() * 4);
      gain.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.06, t + 4 + Math.random() * 4);
      setTimeout(modulateWind, 6000);
    };
    modulateWind();

    this.windNode = { source: noise, gain: gain };
  }

  // Thunder Strike sound effect
  playThunder() {
    if (!this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;

    // Direct loud boom
    const boomSrc = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boomSrc.type = 'triangle';
    boomSrc.frequency.setValueAtTime(80, now);
    boomSrc.frequency.exponentialRampToValueAtTime(10, now + 1.5);
    
    boomGain.gain.setValueAtTime(0.5, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    boomSrc.connect(boomGain);
    boomGain.connect(this.masterGain);
    boomSrc.start(now);
    boomSrc.stop(now + 1.5);

    // Rumble rumble (filtered noise)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(30, now + 4.0);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 4.0);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 4.0);
  }

  // Start dark synthesized ambient background music
  startAmbientMusic() {
    if (!this.ctx || this.musicActive) return;
    this.musicActive = true;
    
    const playChord = () => {
      if (!this.musicActive) return;
      
      const chords = [
        [55.00, 110.00, 130.81, 164.81], // Am (A1, A2, C3, E3)
        [43.65, 87.31, 130.81, 174.61],  // F (F1, F2, C3, F3)
        [55.00, 110.00, 146.83, 174.61], // Dm/A
        [41.20, 82.41, 123.47, 164.81]   // Em (E1, E2, B2, E3)
      ];
      
      const chord = chords[Math.floor(Math.random() * chords.length)];
      const now = this.ctx.currentTime;
      const duration = 8.0; // Long slow pads
      
      chord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = (idx === 0) ? 'sawtooth' : 'triangle'; // Heavy bass, soft mids
        osc.frequency.setValueAtTime(freq, now);
        
        // Lowpass filter on pads
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150 + Math.random() * 100, now);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 2.0); // Slow fade-in
        gain.gain.setValueAtTime(0.08, now + duration - 2.0);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration); // Slow fade-out
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + duration);
        this.musicOscs.push({ osc, gain });
      });
      
      this.musicTimeout = setTimeout(playChord, (duration - 1.5) * 1000);
    };

    playChord();
  }

  stopAmbientMusic() {
    this.musicActive = false;
    clearTimeout(this.musicTimeout);
    this.musicOscs.forEach(o => {
      try { o.gain.gain.cancelScheduledValues(this.ctx.currentTime); o.osc.stop(); } catch (e) {}
    });
    this.musicOscs = [];
  }

  // Play Emergency Alarm Siren (flashing night starts)
  playSiren() {
    if (!this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    
    // Create oscillator and feedback delay for echo
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.1);

    // Feedback Delay effect
    const delay = this.ctx.createDelay();
    delay.delayTime.value = 0.4;
    const delayGain = this.ctx.createGain();
    delayGain.gain.value = 0.5; // echo volume feedback

    // Hook up delay
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    gain.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(delay); // feedback loop
    delayGain.connect(this.masterGain);

    // Modulate pitch up and down (wailing siren)
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.5; // oscillation rate (1 wave per 2s)
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 150; // pitch sweep range (500Hz +- 150Hz)

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    lfo.start(now);
    osc.start(now);

    this.sirenNodes = [osc, lfo, gain, delay, delayGain];
    this.sirenActive = true;
  }

  stopSiren() {
    if (!this.sirenActive) return;
    const now = this.ctx.currentTime;
    this.sirenNodes.forEach(node => {
      try {
        if (node.stop) node.stop(now + 1.0);
        if (node.gain) node.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
      } catch(e) {}
    });
    this.sirenActive = false;
  }

  // --- Sound Effects ---

  // Gunshot
  playGunshot() {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Bullet bang (noise)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1200;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.3);

    // Deep low sub punch
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(150, now);
    subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.15);
  }

  // Gun Reload
  playReload() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const click = (delay) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1000, now + delay);
      osc.frequency.linearRampToValueAtTime(200, now + delay + 0.08);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + delay);
      osc.stop(now + delay + 0.08);
    };

    click(0);      // Slide back
    click(0.3);    // Magazine click
    click(0.5);    // Slide release
  }

  // Bow drawing sound
  playBowDraw(duration = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(300, now + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    // Keep reference so we can stop it early if released
    this.bowDrawNode = { osc, gain };
  }

  stopBowDraw() {
    if (this.bowDrawNode) {
      const now = this.ctx.currentTime;
      try {
        this.bowDrawNode.gain.gain.setValueAtTime(this.bowDrawNode.gain.gain.value, now);
        this.bowDrawNode.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        this.bowDrawNode.osc.stop(now + 0.1);
      } catch(e) {}
      this.bowDrawNode = null;
    }
  }

  // Bow arrow shot
  playBowRelease() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Twang string sound
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);

    // Swoosh sound (high-passed noise)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1500;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.25);
  }

  // Monster growl
  playMonsterGrowl() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80 + Math.random() * 30, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    // Fast modulation oscillator to make it sound raspier (tremolo/distortion)
    const modulation = this.ctx.createOscillator();
    modulation.frequency.value = 30; // 30Hz flutter
    const modGain = this.ctx.createGain();
    modGain.gain.value = 30; // frequency delta

    modulation.connect(modGain);
    modGain.connect(osc.frequency);

    osc.connect(gain);
    gain.connect(this.masterGain);

    modulation.start(now);
    osc.start(now);

    modulation.stop(now + 0.8);
    osc.stop(now + 0.8);
  }

  // Monster damage taken (squish / yell)
  playMonsterHit() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.15); // pitching up squeal

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Player Damage taken
  playPlayerHit() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.linearRampToValueAtTime(30, now + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Player Jump
  playPlayerJump() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Item pickup sound
  playPickup() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const melody = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 arpeggio
    const noteDuration = 0.08;

    melody.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = this.ctx.createGain();
      const noteTime = now + (idx * noteDuration);
      
      gain.gain.setValueAtTime(0.12, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.15);
    });
  }

  // Safe House Door / Lock Interact
  playDoorInteract() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(180, now);
    
    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second creaking sound delayed
    setTimeout(() => {
      if (!this.ctx) return;
      const tNow = this.ctx.currentTime;
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(120, tNow);
      osc2.frequency.linearRampToValueAtTime(100, tNow + 0.2);

      const gain2 = this.ctx.createGain();
      gain2.gain.setValueAtTime(0.15, tNow);
      gain2.gain.exponentialRampToValueAtTime(0.001, tNow + 0.2);

      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(tNow);
      osc2.stop(tNow + 0.2);
    }, 150);
  }
}

// Single audio manager instance
export const audioManager = new AudioManager();
export default audioManager;
