export type Actions = {
  throttle: number;
  brake: number;
  steer: number;
  horn: boolean;
  pauseEdge: boolean;
  gearDriveEdge: boolean;
  gearReverseEdge: boolean;
  signalLeftEdge: boolean;
  signalRightEdge: boolean;
  signalOffEdge: boolean;
  headlightsEdge: boolean;
  highBeamEdge: boolean;
  wiperEdge: boolean;
  respawnEdge: boolean;
};

const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "Space",
  "KeyQ",
  "KeyE",
  "KeyZ",
  "KeyC",
  "KeyX",
  "KeyL",
  "KeyK",
  "KeyV",
  "KeyR",
  "KeyF",
  "KeyP",
  "Escape",
  "ShiftLeft",
]);

function deadzone(x: number, y: number, dz = 0.15) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

export class Input {
  keys = new Set<string>();
  injected: Set<string> | null = null;
  steerTouch = 0;
  throttleTouch = 0;
  brakeTouch = 0;
  steerOverride: number | null = null;
  private queuedGearDrive = false;
  private queuedGearReverse = false;
  private queuedSignalLeft = false;
  private queuedSignalRight = false;
  private queuedSignalOff = false;
  private queuedHeadlights = false;
  private queuedHighBeam = false;
  private queuedWiper = false;
  private queuedRespawn = false;
  private prevPause = false;
  private prevQ = false;
  private prevE = false;
  private prevZ = false;
  private prevC = false;
  private prevX = false;
  private prevL = false;
  private prevK = false;
  private prevV = false;
  private prevR = false;
  private unbind: Array<() => void> = [];

  attach() {
    const down = (e: KeyboardEvent) => {
      if (GAME_CODES.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    const clear = () => {
      this.keys.clear();
      this.resetTouch();
    };
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visibility);
    this.unbind.push(() => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
    });
  }

  dispose() {
    for (const fn of this.unbind) fn();
    this.unbind = [];
    this.keys.clear();
    this.resetTouch();
  }

  triggerGearDrive() {
    this.queuedGearDrive = true;
  }

  triggerGearReverse() {
    this.queuedGearReverse = true;
  }

  triggerSignalLeft() {
    this.queuedSignalLeft = true;
  }

  triggerSignalRight() {
    this.queuedSignalRight = true;
  }

  triggerSignalOff() {
    this.queuedSignalOff = true;
  }

  triggerHeadlights() {
    this.queuedHeadlights = true;
  }

  triggerHighBeam() {
    this.queuedHighBeam = true;
  }

  triggerWiper() {
    this.queuedWiper = true;
  }

  triggerRespawn() {
    this.queuedRespawn = true;
  }

  resetTouch() {
    this.steerTouch = 0;
    this.throttleTouch = 0;
    this.brakeTouch = 0;
    this.queuedGearDrive = false;
    this.queuedGearReverse = false;
    this.queuedSignalLeft = false;
    this.queuedSignalRight = false;
    this.queuedSignalOff = false;
    this.queuedHeadlights = false;
    this.queuedHighBeam = false;
    this.queuedWiper = false;
    this.queuedRespawn = false;
  }

  setKeys(codes: string[]) {
    this.injected = codes.length ? new Set(codes) : null;
  }

  codes() {
    return this.injected ?? this.keys;
  }

  snapshot(): Actions {
    const k = this.codes();
    let steer = 0;
    if (this.steerOverride != null) {
      steer = this.steerOverride;
    } else {
      if (k.has("KeyA") || k.has("ArrowLeft")) steer += 1;
      if (k.has("KeyD") || k.has("ArrowRight")) steer -= 1;
      steer += this.steerTouch;
    }

    let throttle = this.throttleTouch;
    let brake = this.brakeTouch;
    if (k.has("KeyW") || k.has("ArrowUp")) throttle = Math.max(throttle, 1);
    if (k.has("KeyS") || k.has("ArrowDown") || k.has("Space")) brake = Math.max(brake, 1);
    if (k.has("ShiftLeft")) brake = Math.max(brake, 1);

    const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() : [];
    if (pads) {
      for (const p of pads) {
        if (!p) continue;
        const st = deadzone(p.axes[0] ?? 0, p.axes[1] ?? 0);
        // stick left is negative X → +steer (player-visible left)
        steer += -st.x;
        throttle = Math.max(throttle, p.buttons[7]?.value ?? 0);
        brake = Math.max(brake, p.buttons[6]?.value ?? 0);
        if (p.buttons[14]?.pressed) steer += 1;
        if (p.buttons[15]?.pressed) steer -= 1;
      }
    }

    steer = Math.max(-1, Math.min(1, steer));
    throttle = Math.max(0, Math.min(1, throttle));
    brake = Math.max(0, Math.min(1, brake));

    const pauseHeld = k.has("Escape") || k.has("KeyP");
    const pauseEdge = pauseHeld && !this.prevPause;
    this.prevPause = pauseHeld;

    const q = k.has("KeyQ");
    const e = k.has("KeyE") || k.has("KeyF");
    const z = k.has("KeyZ");
    const c = k.has("KeyC");
    const x = k.has("KeyX");
    const l = k.has("KeyL");
    const keyK = k.has("KeyK");
    const v = k.has("KeyV");
    const r = k.has("KeyR");
    const gearReverseEdge = this.queuedGearReverse || (q && !this.prevQ);
    const gearDriveEdge = this.queuedGearDrive || (e && !this.prevE);
    const signalLeftEdge = this.queuedSignalLeft || (z && !this.prevZ);
    const signalRightEdge = this.queuedSignalRight || (c && !this.prevC);
    const signalOffEdge = this.queuedSignalOff || (x && !this.prevX);
    const headlightsEdge = this.queuedHeadlights || (l && !this.prevL);
    const highBeamEdge = this.queuedHighBeam || (keyK && !this.prevK);
    const wiperEdge = this.queuedWiper || (v && !this.prevV);
    const respawnEdge = this.queuedRespawn || (r && !this.prevR);
    this.queuedGearReverse = false;
    this.queuedGearDrive = false;
    this.queuedSignalLeft = false;
    this.queuedSignalRight = false;
    this.queuedSignalOff = false;
    this.queuedHeadlights = false;
    this.queuedHighBeam = false;
    this.queuedWiper = false;
    this.queuedRespawn = false;
    this.prevQ = q;
    this.prevE = e;
    this.prevZ = z;
    this.prevC = c;
    this.prevX = x;
    this.prevL = l;
    this.prevK = keyK;
    this.prevV = v;
    this.prevR = r;

    return {
      throttle,
      brake,
      steer,
      horn: k.has("KeyH"),
      pauseEdge,
      gearDriveEdge,
      gearReverseEdge,
      signalLeftEdge,
      signalRightEdge,
      signalOffEdge,
      headlightsEdge,
      highBeamEdge,
      wiperEdge,
      respawnEdge,
    };
  }
}
