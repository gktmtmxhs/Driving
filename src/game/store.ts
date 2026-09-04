import { create } from "zustand";
import { INITIAL_HUD, type CourseId, type HudState, type Phase } from "./types";

type DriveStore = {
  phase: Phase;
  course: CourseId;
  hud: HudState;
  muted: boolean;
  setPhase: (phase: Phase) => void;
  setCourse: (course: CourseId) => void;
  setHud: (hud: HudState) => void;
  setMuted: (muted: boolean) => void;
  resetHud: () => void;
};

export const useDrive = create<DriveStore>((set) => ({
  phase: "menu",
  course: "city",
  hud: INITIAL_HUD,
  muted: false,
  setPhase: (phase) => set({ phase }),
  setCourse: (course) => set({ course }),
  setHud: (hud) => set({ hud, phase: hud.phase }),
  setMuted: (muted) => set({ muted }),
  resetHud: () => set({ hud: INITIAL_HUD, phase: "menu" }),
}));
