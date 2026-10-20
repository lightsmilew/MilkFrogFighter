// Self-contained synthesis: no audio downloads, codec dependencies or network calls.
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

  async unlock() {
    try {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
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
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (!this.laughReady) this.laughReady = this.loadLaugh();
    } catch { /* Gameplay remains available when a browser blocks audio. */ }
  }

  applyVolume() {
    if (this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, .025);
  }

  async loadLaugh() {
    try {
      const response = await fetch(new URL('../assets/audio/classic-laugh.mp3', import.meta.url));
      if (!response.ok) throw new Error(`Laugh audio: ${response.status}`);
      this.laughBuffer = await this.context.decodeAudioData(await response.arrayBuffer());
      return true;
    } catch (error) { console.warn('经典笑声加载失败', error); return false; }
  }

  async playLaugh(duration = 3) {
    this.stopLaugh();
    const epoch = this.laughEpoch;
    await this.unlock();
    if (!this.context || this.muted) return false;
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
    if (!this.context || this.muted) return;
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
    if (!this.context || this.muted) return;
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
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    switch (name) {
      case 'select': this.tone(660, .06, 'square', .06); this.tone(880, .09, 'square', .045, now + .055); break;
      case 'start': [330, 440, 660, 880].forEach((note, i) => this.tone(note, .13, 'square', .06, now + i * .075)); break;
      case 'attack': this.noise(.05, .06, 2400); break;
      case 'hit': this.noise(.11, .36, 550); this.tone(detail.move === 'kick' ? 95 : 145, .18, 'triangle', .36, 0, 35); this.tone(950,.035,'square',.055); break;
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
    if (!active || !this.music || !this.context) return;
    this.nextBeat = this.context.currentTime + .1;
    this.timer = setInterval(() => this.scheduleMusic(), 80);
    this.scheduleMusic();
  }

  scheduleMusic() {
    if (!this.context || !this.active || !this.music) return;
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
