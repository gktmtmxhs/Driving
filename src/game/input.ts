export type Actions = {
  throttle: number;
  brake: number;
  steer: number;
  horn: boolean;
  pauseEdge: boolean;
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
  gearDriveEdge = false;
  gearReverseEdge = false;
  signalLeftEdge = false;
  signalRightEdge = false;
  signalOffEdge = false;
  respawnEdge = false;
  private prevPause = false;
  private prevQ = false;
  private prevE = false;
  private prevZ = false;
  private prevC = false;
  private prevX = false;
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
    const clear = () => this.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clear();
    });
    this.unbind.push(() => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    });
  }

  dispose() {
    for (const fn of this.unbind) fn();
    this.unbind = [];
    this.keys.clear();
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
    if (k.has("KeyS") || k.has("ArrowDown") || k.has("Space"))
      brake = Math.max(brake, 1);
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
    const r = k.has("KeyR");
    this.gearReverseEdge = q && !this.prevQ;
    this.gearDriveEdge = e && !this.prevE;
    this.signalLeftEdge = z && !this.prevZ;
    this.signalRightEdge = c && !this.prevC;
    this.signalOffEdge = x && !this.prevX;
    this.respawnEdge = r && !this.prevR;
    this.prevQ = q;
    this.prevE = e;
    this.prevZ = z;
    this.prevC = c;
    this.prevX = x;
    this.prevR = r;

    return {
      throttle,
      brake,
      steer,
      horn: k.has("KeyH"),
      pauseEdge,
    };
  }
}
