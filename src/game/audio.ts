export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private blinker: OscillatorNode | null = null;
  private blinkerGain: GainNode | null = null;
  muted = false;

  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: "interactive" });
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(ctx.destination);

      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = "lowpass";
      this.engineFilter.frequency.value = 280;
      this.engineFilter.connect(this.master);

      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineGain.connect(this.engineFilter);

      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 48;
      this.engineOsc.connect(this.engineGain);
      this.engineOsc.start();

      this.blinkerGain = ctx.createGain();
      this.blinkerGain.gain.value = 0;
      this.blinkerGain.connect(this.master);
      this.blinker = ctx.createOscillator();
      this.blinker.type = "square";
      this.blinker.frequency.value = 720;
      this.blinker.connect(this.blinkerGain);
      this.blinker.start();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(
        muted ? 0 : 0.22,
        this.ctx!.currentTime,
        0.04,
      );
    }
  }

  setEngine(speed: number, throttle: number, gearReverse: boolean) {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.engineFilter)
      return;
    const t = this.ctx.currentTime;
    const kmh = Math.abs(speed) * 3.6;
    const freq = (gearReverse ? 42 : 48) + kmh * 1.35 + throttle * 18;
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.05);
    const vol = 0.04 + Math.min(0.18, kmh / 400) + throttle * 0.08;
    this.engineGain.gain.setTargetAtTime(vol, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(240 + kmh * 4 + throttle * 80, t, 0.08);
  }

  setBlinker(on: boolean) {
    if (!this.ctx || !this.blinkerGain) return;
    this.blinkerGain.gain.setTargetAtTime(on ? 0.03 : 0, this.ctx.currentTime, 0.01);
  }

  beep(freq = 880, dur = 0.08, vol = 0.08) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(this.master);
    o.start();
    g.gain.setTargetAtTime(0, this.ctx.currentTime + dur, 0.02);
    o.stop(this.ctx.currentTime + dur + 0.12);
  }

  thud() {
    this.beep(90, 0.12, 0.16);
  }

  horn() {
    this.beep(420, 0.18, 0.12);
    this.beep(520, 0.18, 0.08);
  }

  chime() {
    this.beep(660, 0.1, 0.07);
    this.beep(880, 0.14, 0.06);
  }

  dispose() {
    try {
      this.engineOsc?.stop();
      this.blinker?.stop();
      void this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.ctx = null;
  }
}
