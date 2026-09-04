export type CourseId = "city" | "skill" | "exam";

export type Gear = "P" | "R" | "N" | "D";

export type Signal = "off" | "left" | "right";

export type WiperMode = "off" | "int" | "low" | "high";

export type LightColor = "green" | "yellow" | "red";

export type Phase = "menu" | "playing" | "paused" | "results";

export type WaypointAction = "straight" | "left" | "right" | "hold" | "park" | "finish";

export type Waypoint = {
  x: number;
  z: number;
  action: WaypointAction;
  limit?: number;
  hint?: string;
};

export type Aabb = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type Violation = {
  label: string;
  points: number;
};

export type HudState = {
  phase: Phase;
  course: CourseId;
  speedKmh: number;
  speedLimit: number;
  gear: Gear;
  steer: number;
  throttle: number;
  brake: number;
  signal: Signal;
  signalBlink: boolean;
  headlights: boolean;
  highBeam: boolean;
  wiper: WiperMode;
  score: number;
  instruction: string;
  instructionAction: WaypointAction;
  instructionDist: number;
  hint: string;
  violations: Violation[];
  failed: boolean;
  timeSec: number;
  holdSec: number;
  holdNeed: number;
  onRoad: boolean;
  light: LightColor | "none";
  parked: boolean;
  reverseCam: boolean;
  progress: number;
};

export const INITIAL_HUD: HudState = {
  phase: "menu",
  course: "city",
  speedKmh: 0,
  speedLimit: 50,
  gear: "D",
  steer: 0,
  throttle: 0,
  brake: 0,
  signal: "off",
  signalBlink: false,
  headlights: false,
  highBeam: false,
  wiper: "off",
  score: 100,
  instruction: "",
  instructionAction: "straight",
  instructionDist: 0,
  hint: "",
  violations: [],
  failed: false,
  timeSec: 0,
  holdSec: 0,
  holdNeed: 3,
  onRoad: true,
  light: "none",
  parked: false,
  reverseCam: false,
  progress: 0,
};
