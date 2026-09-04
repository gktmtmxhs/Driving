import type { Input } from "./input";
import {
  GRID,
  LANE,
  ROAD_HALF,
  cycleLights,
  type Cone,
  type WorldRuntime,
} from "./world";
import type {
  CourseId,
  Gear,
  HudState,
  LightColor,
  Phase,
  Signal,
  Violation,
} from "./types";

const WHEELBASE = 2.65;
const ACCEL = 7.4;
const BRAKE_DECEL = 13.5;
const MAX_SPEED = 22.2; // ~80 km/h
const MAX_REV = 5.5;
const IDLE = 2.4;

export type AiCar = {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  pathI: number;
};

export type Ped = {
  x: number;
  z: number;
  waiting: number;
  dir: 1 | -1;
  axis: "x" | "z";
  originX: number;
  originZ: number;
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function angDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function onRoad(x: number, z: number) {
  const half = ROAD_HALF + 0.6;
  for (const g of GRID) {
    if (Math.abs(x - g) < half) return true;
    if (Math.abs(z - g) < half) return true;
  }
  return false;
}

function nearestIsect(x: number, z: number, list: { x: number; z: number }[]) {
  let best = list[0];
  let bd = Infinity;
  for (const p of list) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return { p: best, d: Math.sqrt(bd) };
}

export class Sim {
  course: CourseId = "city";
  exam = false;
  phase: Phase = "playing";
  x = 0;
  z = 0;
  yaw = 0;
  speed = 0;
  steer = 0;
  throttle = 0;
  brake = 0;
  gear: Gear = "D";
  signal: Signal = "off";
  signalBlink = false;
  score = 100;
  time = 0;
  holdSec = 0;
  parked = false;
  failed = false;
  onRoad = true;
  light: LightColor | "none" = "none";
  instruction = "";
  instructionDist = 0;
  hint = "";
  violations: Violation[] = [];
  wpIndex = 0;
  lastCp = { x: 0, z: 0, yaw: 0 };
  pitch = 0;
  y = 0;
  ai: AiCar[] = [];
  peds: Ped[] = [];
  private world!: WorldRuntime;
  private cooldowns = new Map<string, number>();
  private blinkT = 0;
  private lastHintT = 0;
  private stoppedHere = new Set<string>();
  private signaledForWp = new Set<number>();
  private holdDone = false;
  private finishArmed = false;

  boot(course: CourseId, world: WorldRuntime) {
    this.world = world;
    this.course = course;
    this.exam = course === "exam";
    this.phase = "playing";
    this.x = world.spawn.x;
    this.z = world.spawn.z;
    this.yaw = world.spawn.yaw;
    this.speed = 0;
    this.steer = 0;
    this.gear = "D";
    this.signal = "off";
    this.score = 100;
    this.time = 0;
    this.holdSec = 0;
    this.parked = false;
    this.failed = false;
    this.violations = [];
    this.wpIndex = 0;
    this.lastCp = { x: this.x, z: this.z, yaw: this.yaw };
    this.cooldowns.clear();
    this.stoppedHere.clear();
    this.signaledForWp.clear();
    this.holdDone = false;
    this.finishArmed = false;
    this.hint = course === "skill" ? "경사로에서 3초 정지 후 S자 코스" : "안내에 따라 주행하세요";
    this.ai = [];
    this.peds = [];
    if (course !== "skill") {
      const path = world.aiPath;
      const colorsN = 8;
      for (let i = 0; i < colorsN && path.length; i++) {
        const idx = Math.floor((i / colorsN) * path.length);
        const p = path[idx];
        const n = path[(idx + 1) % path.length];
        const yaw = Math.atan2(-(n.x - p.x), -(n.z - p.z));
        this.ai.push({ x: p.x, z: p.z, yaw, speed: 8, pathI: idx });
      }
      this.peds = [
        { x: -6, z: -ROAD_HALF - 1.6, waiting: 0, dir: 1, axis: "x", originX: 0, originZ: 0 },
        { x: 6, z: ROAD_HALF + 1.6, waiting: 0, dir: -1, axis: "x", originX: 0, originZ: 0 },
        {
          x: 128 - ROAD_HALF - 1.6,
          z: -64,
          waiting: 0,
          dir: 1,
          axis: "z",
          originX: 128,
          originZ: -64,
        },
      ];
    }
  }

  respawn() {
    this.x = this.lastCp.x;
    this.z = this.lastCp.z;
    this.yaw = this.lastCp.yaw;
    this.speed = 0;
    this.steer = 0;
  }

  step(dt: number, input: Input) {
    if (this.phase !== "playing") return;
    const a = input.snapshot();
    this.time += dt;

    for (const [k, v] of this.cooldowns) {
      const n = v - dt;
      if (n <= 0) this.cooldowns.delete(k);
      else this.cooldowns.set(k, n);
    }

    if (input.gearReverseEdge) this.gear = "R";
    if (input.gearDriveEdge) this.gear = "D";
    if (input.signalLeftEdge)
      this.signal = this.signal === "left" ? "off" : "left";
    if (input.signalRightEdge)
      this.signal = this.signal === "right" ? "off" : "right";
    if (input.signalOffEdge) this.signal = "off";
    if (input.respawnEdge) this.respawn();

    this.throttle = a.throttle;
    this.brake = a.brake;
    this.steer += (a.steer - this.steer) * Math.min(1, 10 * dt);

    if (this.gear === "P" || this.gear === "N") {
      this.throttle = 0;
    }

    // bicycle model — A/+steer yields +yaw while moving forward
    const absV = Math.abs(this.speed);
    const maxSteer = absV < 4 ? 0.7 : 0.48;
    const angle = this.steer * maxSteer;
    if (absV > 0.12) {
      this.yaw += (this.speed / WHEELBASE) * Math.tan(angle) * dt;
    }

    if (this.gear === "D") {
      this.speed += this.throttle * ACCEL * dt;
      this.speed -= this.brake * BRAKE_DECEL * dt;
      if (this.speed < 0) this.speed = 0;
    } else if (this.gear === "R") {
      this.speed -= this.throttle * (ACCEL * 0.55) * dt;
      this.speed += this.brake * BRAKE_DECEL * dt;
      if (this.speed > 0) this.speed = 0;
    }

    if (this.throttle < 0.04 && this.brake < 0.04) {
      this.speed -= Math.sign(this.speed) * IDLE * dt;
      if (Math.abs(this.speed) < 0.12) this.speed = 0;
    }

    this.speed = clamp(this.speed, -MAX_REV, MAX_SPEED);

    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;

    this.y = this.world.heightAt(this.x, this.z);
    const y1 = this.world.heightAt(this.x + fx * 1.4, this.z + fz * 1.4);
    this.pitch = Math.atan2(y1 - this.y, 1.4);

    this.resolveCollisions();
    this.updateRoute(dt);
    this.updateLightsAndScore(dt);
    this.updateAi(dt);
    this.updatePeds(dt);

    this.blinkT += dt;
    this.signalBlink = this.signal !== "off" && Math.sin(this.blinkT * 10) > 0;

    if (this.lastHintT > 0) this.lastHintT -= dt;

    if (this.failed && this.exam) {
      this.phase = "results";
    }
  }

  private resolveCollisions() {
    const r = 1.05;
    for (const b of this.world.colliders) {
      const cx = clamp(this.x, b.minX, b.maxX);
      const cz = clamp(this.z, b.minZ, b.maxZ);
      const dx = this.x - cx;
      const dz = this.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        this.x += dx * push;
        this.z += dz * push;
        this.speed *= 0.35;
        this.deduct("wall", "연석·시설물 접촉", 10);
      }
    }
    for (const c of this.world.cones) {
      const dx = this.x - c.x;
      const dz = this.z - c.z;
      if (dx * dx + dz * dz < (r + c.r) * (r + c.r)) {
        this.speed *= 0.5;
        this.deduct("cone", "봉 접촉", 10);
      }
    }
    if (this.course === "skill") {
      this.onRoad = Math.abs(this.x) < 22 && this.z < 48 && this.z > -62;
      if (!this.onRoad) {
        this.speed *= 0.92;
      }
    } else {
      this.onRoad = onRoad(this.x, this.z);
      if (!this.onRoad) {
        this.speed *= Math.max(0, 1 - 1.8 * 0.016);
        this.deduct("off", "도로 이탈", 5);
      }
    }
  }

  private updateRoute(dt: number) {
    const wps = this.world.waypoints;
    if (!wps.length) return;
    const wp = wps[Math.min(this.wpIndex, wps.length - 1)];
    const dx = wp.x - this.x;
    const dz = wp.z - this.z;
    const dist = Math.hypot(dx, dz);
    this.instructionDist = dist;
    const labels: Record<string, string> = {
      straight: "직진",
      left: "좌회전 하세요",
      right: "우회전 하세요",
      hold: "경사로 3초 정지",
      park: "직각주차 하세요",
      finish: "목적지 · 정차",
    };
    this.instruction = wp.hint ?? labels[wp.action] ?? "";

    if (wp.action === "left" && this.signal === "left") this.signaledForWp.add(this.wpIndex);
    if (wp.action === "right" && this.signal === "right") this.signaledForWp.add(this.wpIndex);

    if (wp.action === "hold" && this.world.holdZone) {
      const h = this.world.holdZone;
      const inside =
        this.x > h.minX && this.x < h.maxX && this.z > h.minZ && this.z < h.maxZ;
      if (inside && Math.abs(this.speed) < 0.35) {
        this.holdSec += dt;
        if (this.holdSec >= 3 && !this.holdDone) {
          this.holdDone = true;
          this.hint = "정지 완료. 출발하세요";
        }
      } else if (inside && this.speed < -0.6) {
        this.deduct("roll", "경사로 밀림", 10);
      } else if (!inside) {
        if (this.holdSec > 0 && this.holdSec < 3 && this.z < h.minZ) {
          this.deduct("hold", "경사로 정지 미이행", 10);
        }
      }
    }

    if (wp.action === "park" || wp.action === "finish") {
      const bay = this.world.parkBay;
      if (bay) {
        const inside =
          this.x > bay.minX + 0.15 &&
          this.x < bay.maxX - 0.15 &&
          this.z > bay.minZ + 0.2 &&
          this.z < bay.maxZ - 0.2;
        if (inside && Math.abs(this.speed) < 0.25) {
          this.parked = true;
          this.holdSec += dt;
          if (this.holdSec > 1.2) {
            this.finishArmed = true;
          }
        }
      }
    }

    const arrive = wp.action === "finish" ? 8 : wp.action === "park" ? 10 : 14;
    if (dist < arrive) {
      if (wp.action === "left" || wp.action === "right") {
        if (!this.signaledForWp.has(this.wpIndex)) {
          this.deduct("sig" + this.wpIndex, "방향지시등 미점등", 5);
        }
        this.signal = "off";
      }
      this.lastCp = { x: wp.x, z: wp.z, yaw: this.yaw };
      if (wp.action === "finish") {
        if (Math.abs(this.speed) < 0.4) {
          this.phase = "results";
        }
      } else if (wp.action === "hold") {
        if (this.holdDone || this.z < wp.z - 2) {
          this.wpIndex = Math.min(this.wpIndex + 1, wps.length - 1);
          this.holdSec = 0;
        }
      } else {
        this.wpIndex = Math.min(this.wpIndex + 1, wps.length - 1);
      }
    }

    if (this.finishArmed && this.course === "skill" && this.parked) {
      this.phase = "results";
    }
  }

  private updateLightsAndScore(dt: number) {
    void dt;
    const kmh = Math.abs(this.speed) * 3.6;
    let limit = 50;
    if (this.world.inSchool(this.x, this.z)) limit = 30;
    const wp = this.world.waypoints[this.wpIndex];
    if (wp?.limit) limit = wp.limit;
    if (this.course === "skill") limit = 20;

    if (kmh > limit + 10) {
      this.deduct("spd", `속도위반 (${limit}km/h)`, 10);
    }

    if (this.course === "skill") {
      this.light = "none";
      return;
    }

    const { p, d } = nearestIsect(this.x, this.z, this.world.intersections);
    const { ns, ew } = cycleLights(this.time);
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const nsTravel = Math.abs(fz) >= Math.abs(fx);
    const my: LightColor = nsTravel ? ns : ew;
    this.light = d < 28 ? my : "none";

    const inBox =
      Math.abs(this.x - p.x) < ROAD_HALF + 1.2 &&
      Math.abs(this.z - p.z) < ROAD_HALF + 1.2;
    const key = `${p.x},${p.z}`;
    if (d < 18 && d > 8 && kmh < 2) this.stoppedHere.add(key);
    if (inBox && my === "red" && kmh > 8) {
      this.deduct("red" + key, "신호위반", this.exam ? 100 : 15, this.exam);
    }
    if (inBox && my === "red" && !this.stoppedHere.has(key) && kmh > 4) {
      this.deduct("line" + key, "정지선 미준수", 10);
    }

    // center line
    if (nsTravel) {
      const g = GRID.reduce((best, v) =>
        Math.abs(this.x - v) < Math.abs(this.x - best) ? v : best,
      );
      const expected = g + (fz < 0 ? LANE : -LANE);
      if (Math.abs(this.x - g) < ROAD_HALF && Math.abs(this.x - expected) > LANE + 0.85) {
        this.deduct("center", "중앙선 침범", 10);
      }
    }
  }

  private updateAi(dt: number) {
    const path = this.world.aiPath;
    if (!path.length) return;
    const { ns, ew } = cycleLights(this.time);
    for (const car of this.ai) {
      const tgt = path[car.pathI % path.length];
      const dx = tgt.x - car.x;
      const dz = tgt.z - car.z;
      if (dx * dx + dz * dz < 36) car.pathI = (car.pathI + 1) % path.length;
      const want = Math.atan2(-dx, -dz);
      const err = angDiff(want, car.yaw);
      car.yaw += clamp(err, -1.8 * dt, 1.8 * dt);
      let target = 9.5;
      const { d } = nearestIsect(car.x, car.z, this.world.intersections);
      const fx = -Math.sin(car.yaw);
      const fz = -Math.cos(car.yaw);
      const nsTravel = Math.abs(fz) >= Math.abs(fx);
      const light = nsTravel ? ns : ew;
      if (d < 16 && light !== "green") target = 0;
      // player ahead
      const pdx = this.x - car.x;
      const pdz = this.z - car.z;
      if (pdx * fx + pdz * fz > 0 && pdx * pdx + pdz * pdz < 80) target = Math.min(target, 3);
      car.speed += (target - car.speed) * Math.min(1, 2 * dt);
      car.x += -Math.sin(car.yaw) * car.speed * dt;
      car.z += -Math.cos(car.yaw) * car.speed * dt;

      const ddx = car.x - this.x;
      const ddz = car.z - this.z;
      if (ddx * ddx + ddz * ddz < 6.5) {
        this.speed *= 0.4;
        this.deduct("ai", "차량 충돌", this.exam ? 100 : 15, this.exam);
        // push player
        const len = Math.hypot(ddx, ddz) || 1;
        this.x -= (ddx / len) * 0.4;
        this.z -= (ddz / len) * 0.4;
      }
    }
  }

  private updatePeds(dt: number) {
    const { ns, ew } = cycleLights(this.time);
    for (const ped of this.peds) {
      const walk = ped.axis === "x" ? ns === "red" : ew === "red";
      const speed = walk ? 1.35 : 0;
      if (ped.axis === "x") {
        ped.x += ped.dir * speed * dt;
        if (ped.x > 8) ped.dir = -1;
        if (ped.x < -8) ped.dir = 1;
        ped.z = ped.originZ + (ped.originZ === 0 ? (ped.dir > 0 ? -ROAD_HALF - 1.5 : ROAD_HALF + 1.5) : 0);
        if (ped.originZ === 0) ped.z = ped.dir > 0 ? -ROAD_HALF - 1.6 : ROAD_HALF + 1.6;
      } else {
        ped.z += ped.dir * speed * dt;
        if (ped.z > ped.originZ + 8) ped.dir = -1;
        if (ped.z < ped.originZ - 8) ped.dir = 1;
        ped.x = ped.originX - ROAD_HALF - 1.6;
      }
      const dx = ped.x - this.x;
      const dz = ped.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.4) {
        this.deduct("ped", "보행자 충돌", 100, true);
      } else if (dist < 6 && Math.abs(this.speed) * 3.6 > 20 && walk) {
        this.deduct("yield", "보행자 미양보", 10);
      }
    }
  }

  private deduct(code: string, label: string, points: number, fail = false) {
    if (this.cooldowns.has(code)) return;
    this.cooldowns.set(code, fail ? 8 : 3.5);
    this.violations.push({ label, points: Math.min(points, this.score) });
    this.score = Math.max(0, this.score - points);
    this.hint = label;
    this.lastHintT = 2.4;
    if (fail || this.score <= 0) {
      this.failed = true;
      if (this.exam || fail) this.phase = "results";
    }
  }

  hud(): HudState {
    const wps = this.world.waypoints;
    const limit = this.world.inSchool(this.x, this.z)
      ? 30
      : this.course === "skill"
        ? 20
        : (wps[this.wpIndex]?.limit ?? 50);
    return {
      phase: this.phase,
      course: this.course,
      speedKmh: Math.abs(this.speed) * 3.6,
      speedLimit: limit,
      gear: this.gear,
      steer: this.steer,
      throttle: this.throttle,
      brake: this.brake,
      signal: this.signal,
      signalBlink: this.signalBlink,
      score: this.score,
      instruction: this.instruction,
      instructionDist: this.instructionDist,
      hint: this.lastHintT > 0 ? this.hint : "",
      violations: this.violations,
      failed: this.failed,
      timeSec: this.time,
      holdSec: this.holdSec,
      holdNeed: 3,
      onRoad: this.onRoad,
      light: this.light,
      parked: this.parked,
      reverseCam: this.gear === "R",
      progress: wps.length ? this.wpIndex / Math.max(1, wps.length - 1) : 0,
    };
  }
}
