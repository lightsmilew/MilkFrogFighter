import {assetUrl} from './asset-urls.js';
// Synthesized combat audio; the classic laugh is fetched only after interaction.
export class ArcadeAudio {
  constructor() {
    this.context = null;
    this.volume = .42;
    this.muted = false;
    this.music = true;
    this.timer = null;
    this.nextBeat = 0;
    this.step = 0;
    this.active = false;
    this.laughReady = null;
    this.laughBuffer = null;
    this.laughSource = null;
    this.laughEpoch = 0;
  }

  get running() { return Boolean(this.context && this.context.state === 'running'); }

  /** Create/resume the AudioContext *inside* the user gesture.
   *
   * iPhone Safari only starts Web Audio for a context that was created or
   * resumed while a gesture was being handled. The previous version awaited
   * asset loading first, so the context was born outside the tap: it stayed
   * suspended and the whole cabinet was silent. Nothing here may await before
   * resume(); the decode work is deferred to the state-change handler. */
  unlock() {
    try {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return Promise.resolve(false);
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.musicGain = this.context.createGain();
        this.musicGain.gain.value = .7;
        this.musicGain.connect(this.master);
        this.applyVolume();
        this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * .3, this.context.sampleRate);
        const samples = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        this.context.onstatechange = () => this.syncState();
      }
      if (this.context.state !== 'running') {
        try { this.context.resume().catch(() => { /* Retried on the next gesture. */ }); } catch { /* Missing Web Audio. */ }
      }
      this.syncState();
    } catch { /* Gameplay remains available when a browser blocks audio. */ }
    return Promise.resolve(this.running);
  }

  /** Catch the first tap anywhere, so iOS sees a real gesture even when the
   *  player starts the match with the keyboard or a delayed handler. */
  armGestureUnlock() {
    if (this.gestureArmed) return;
    this.gestureArmed = true;
    const attempt = () => {
      this.unlock();
      if (this.running) this.disarmGestureUnlock();
    };
    this.gestureAttempt = attempt;
    this.gestureEvents = ['pointerdown', 'touchend', 'mousedown', 'keydown', 'click'];
    this.gestureEvents.forEach(name => window.addEventListener(name, attempt, { capture: true, passive: true }));
    // Returning from the background never creates a context, but it may resume
    // one that is still alive; if iOS refuses, the next tap re-arms the gesture.
    const resumed = () => {
      if (!this.context || document.visibilityState !== 'visible') return;
      try { if (this.context.state !== 'running') this.context.resume().catch(() => {}); } catch { /* No Web Audio. */ }
      this.syncState();
    };
    document.addEventListener('visibilitychange', resumed);
    window.addEventListener('pageshow', resumed);
    window.addEventListener('focus', resumed);
    this.gestureListeners = [['visibilitychange', resumed, document], ['pageshow', resumed, window], ['focus', resumed, window]];
  }

  disarmGestureUnlock() {
    if (!this.gestureArmed) return;
    this.gestureArmed = false;
    this.gestureEvents?.forEach(name => window.removeEventListener(name, this.gestureAttempt, { capture: true }));
    this.gestureListeners?.forEach(([name, handler, target]) => target.removeEventListener(name, handler));
    this.gestureEvents = null;
    this.gestureListeners = null;
  }

  /** Keep music/decode in step with the context lifecycle: iOS suspends the
   *  context when Safari goes to the background or the silent switch is toggled. */
  syncState() {
    if (!this.context) return;
    if (this.context.state === 'running') {
      if (!this.laughReady && !this.laughLoading) { this.laughLoading = true; this.laughReady = this.loadLaugh(); }
      if (this.readyCallbacks?.length) {
        const callbacks = this.readyCallbacks; this.readyCallbacks = [];
        callbacks.forEach(callback => { try { callback(); } catch { /* A missing sound must not break the match. */ } });
      }
      if (this.active && this.music && !this.timer) {
        this.nextBeat = this.context.currentTime + .1;
        this.timer = setInterval(() => this.scheduleMusic(), 80);
        this.scheduleMusic();
      }
    } else {
      if (this.timer) { clearInterval(this.timer); this.timer = null; this.nextBeat = 0; }
      // iOS interrupts the context when Safari is backgrounded or the silent
      // switch changes; try here (often inside a tap) and re-arm as a backstop.
      try { this.context.resume().catch(() => {}); } catch { /* No Web Audio. */ }
      this.armGestureUnlock();
    }
  }

  /** Run a sound the moment the mixer is audible, even if iOS is still
   *  releasing the AudioContext from the tap that started the match. */
  whenRunning(callback) {
    if (this.running) { callback(); return; }
    this.readyCallbacks = this.readyCallbacks || [];
    this.readyCallbacks.push(callback);
    clearTimeout(this.readyTimer);
    this.readyTimer = setTimeout(() => { this.readyCallbacks = []; }, 2000);
  }

  applyVolume() {
    if (this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, .025);
  }

  async loadLaugh() {
    try {
      const response = await fetch(assetUrl('audio/classic-laugh.mp3'));
      if (!response.ok) throw new Error(`Laugh audio: ${response.status}`);
      this.laughBuffer = await this.context.decodeAudioData(await response.arrayBuffer());
      return true;
    } catch (error) { this.laughLoading = false; console.warn('经典笑声加载失败', error); return false; }
  }

  async playLaugh(duration = 3) {
    this.stopLaugh();
    const epoch = this.laughEpoch;
    await this.unlock();
    if (!this.context || this.muted) return false;
    // resume() settles a tick later on iOS; give the context a moment to run.
    for (let i = 0; i < 20 && !this.running && !this.muted; i++) await new Promise(resolve => setTimeout(resolve, 25));
    if (!this.running) return false;
    if (!this.laughReady) this.laughReady = this.loadLaugh();
    await this.laughReady;
    if (!this.laughBuffer || this.muted || epoch !== this.laughEpoch) return false;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.laughBuffer;
    gain.gain.value = .75;
    source.connect(gain);gain.connect(this.master);
    const length = Math.min(duration, source.buffer.duration);
    this.musicGain.gain.cancelScheduledValues(this.context.currentTime);
    this.musicGain.gain.setTargetAtTime(.15, this.context.currentTime, .04);
    this.musicGain.gain.setTargetAtTime(.7, this.context.currentTime + length, .12);
    source.start(0, 0, length);
    this.laughSource = source;
    source.onended = () => { source.disconnect();gain.disconnect();if(this.laughSource === source)this.laughSource=null; };
    return true;
  }

  stopLaugh() {
    this.laughEpoch++;
    if(this.laughSource){try{this.laughSource.stop();}catch{}this.laughSource=null;}
    if(this.context&&this.musicGain){this.musicGain.gain.cancelScheduledValues(this.context.currentTime);this.musicGain.gain.setTargetAtTime(.7,this.context.currentTime,.05);}
  }

  tone(frequency, duration = .12, type = 'triangle', gain = .12, when = 0, endFrequency = null, music = false) {
    if (!this.running || this.muted) return;
    const time = when || this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), time + duration);
    envelope.gain.setValueAtTime(.0001, time);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), time + .008);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope); envelope.connect(music ? this.musicGain : this.master);
    oscillator.start(time); oscillator.stop(time + duration + .025);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }

  noise(duration = .07, gain = .18, frequency = 1500, when = 0, music = false) {
    if (!this.running || this.muted) return;
    const time = when || this.context.currentTime;
    const noise = this.context.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = frequency;
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(gain, time);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    noise.connect(filter); filter.connect(envelope); envelope.connect(music ? this.musicGain : this.master);
    noise.start(time); noise.stop(time + duration + .01);
    noise.onended = () => { noise.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }

  sfx(name, detail = {}) {
    if (!this.running || this.muted) return;
    const now = this.context.currentTime;
    switch (name) {
      case 'select': this.tone(660, .06, 'square', .06); this.tone(880, .09, 'square', .045, now + .055); break;
      case 'start': [330, 440, 660, 880].forEach((note, i) => this.tone(note, .13, 'square', .06, now + i * .075)); break;
      case 'attack': this.noise(detail.move==='spin'?.18:.05,.06,2400); if(detail.move==='uppercut')this.tone(140,.18,'triangle',.12,0,560); break;
      case 'dash': this.noise(.16,.12,1800); this.tone(100,.1,'triangle',.05,0,220); break;
      case 'blink': this.noise(.1,.16,4200);this.tone(760,.13,'sine',.12,0,180);break;
      case 'doubleJump': this.tone(340,.13,'sine',.1,0,740);break;
      case 'catch': this.noise(.08,.14,700);this.tone(125,.15,'triangle',.17,0,65);break;
      case 'slam': this.noise(.23,.33,350);this.tone(75,.28,'sine',.3,0,28);break;
      case 'skill': {
        const voices={spiral:[260,900,'sine',2000],wind:[720,1600,'triangle',4300],fire:[85,220,'sawtooth',600],void:[170,510,'sine',1700],ribbon:[660,1040,'sine',5000],ice:[1200,1800,'triangle',6200]};
        const [low,high,wave,noise]=voices[detail.theme]||voices.spiral;
        this.tone(low,.23,wave,.1,0,high);this.noise(detail.theme==='fire'?.25:.12,.075,noise);
        if(detail.theme==='ice'||detail.theme==='ribbon')this.tone(high*1.5,.16,'sine',.055,now+.07);break;
      }
      case 'counter':this.tone(1500,.14,'triangle',.13,0,330);this.noise(.08,.2,3000);break;
      case 'armor':this.tone(110,.2,'triangle',.17,0,70);this.noise(.1,.16,800);break;
      case 'bloom':this.tone(880,.2,'sine',.1,0,1400);this.tone(1320,.2,'sine',.07,now+.06);break;
      case 'hit': this.noise(.11, .36, 550); this.tone(['kick','sweep','grab','diveKick'].includes(detail.move) ? 85 : 145, .18, 'triangle', .36, 0, 35); this.tone(950,.035,'square',.055); break;
      case 'block': this.tone(480, .07, 'square', .09, 0, 170); this.noise(.035, .1, 4000); break;
      case 'jump': this.tone(175, .09, 'sine', .08, 0, 330); break;
      case 'land': this.noise(.04, .07, 500); break;
      case 'projectile': this.tone(320, .22, 'sawtooth', .065, 0, 110); this.noise(.14, .06, 2800); break;
      case 'clash': this.noise(.1, .14, 1700); break;
      case 'super': [220, 330, 440, 660].forEach((note, i) => this.tone(note, .3, 'sawtooth', .07, now + i * .05)); break;
      case 'fight': this.tone(440, .13, 'square', .1); this.tone(660, .22, 'square', .1, now + .13); break;
      case 'roundEnd': [440, 349, 294, 220].forEach((note, i) => this.tone(note, .2, 'triangle', .12, now + i * .12)); this.playLaugh(2.6); break;
      case 'laugh': this.playLaugh(1.8); break;
      case 'matchEnd': [262, 330, 392, 523, 659, 784].forEach((note, i) => this.tone(note, .22, 'square', .065, now + i * .11)); break;
      case 'noEnergy': this.tone(110, .1, 'square', .04); break;
    }
  }

  setActive(active) {
    this.active = active;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if(!active)this.stopLaugh();
    // Music only starts once the context is actually running; syncState() is
    // called again from onstatechange when iOS releases a suspended context.
    this.syncState();
  }

  scheduleMusic() {
    if (!this.running || !this.active || !this.music) return;
    // An original 116 BPM swingy pentatonic loop; a different 4-bar bass line
    // keeps the small oscillator band from sounding like a repeated alarm.
    const melody = [69, 0, 72, 74, 0, 72, 69, 67, 69, 0, 76, 74, 72, 0, 69, 0,
      67, 0, 69, 72, 74, 0, 72, 69, 67, 64, 67, 0, 69, 0, 0, 0];
    const bass = [45, 45, 48, 48, 41, 41, 43, 43];
    const frequency = note => 440 * 2 ** ((note - 69) / 12);
    while (this.nextBeat < this.context.currentTime + .2) {
      const step = this.step % 32;
      const at = this.nextBeat;
      if (melody[step]) this.tone(frequency(melody[step]), .11, 'square', .027, at, null, true);
      if (step % 2 === 0) this.tone(frequency(bass[Math.floor(step / 4)]), .2, 'triangle', .085, at, null, true);
      if (step % 8 === 0 || step % 8 === 3) this.tone(105, .12, 'sine', .18, at, 35, true);
      if (step % 8 === 4) this.noise(.065, .06, 1300, at, true);
      if (step % 2 === 1) this.noise(.025, .022, 6500, at, true);
      this.nextBeat += (60 / 116 / 4) * (step % 2 ? .93 : 1.07);
      this.step++;
    }
  }
}
