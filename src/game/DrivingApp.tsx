import { useEffect, useRef, useState } from "react";
import { DesktopHint, Hud, Menu, PauseMenu, Results, TouchControls } from "./overlays";
import { useDrive } from "./store";
import type { CourseId } from "./types";
import type { DriveEngine } from "./engine";

export function DrivingApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DriveEngine | null>(null);
  const pendingRef = useRef<CourseId | null>(null);
  const [ready, setReady] = useState(false);
  const phase = useDrive((s) => s.phase);
  const hud = useDrive((s) => s.hud);
  const muted = useDrive((s) => s.muted);
  const setMuted = useDrive((s) => s.setMuted);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let engine: DriveEngine | null = null;
    import("./engine").then(({ DriveEngine }) => {
      if (cancelled || !canvasRef.current) return;
      engine = new DriveEngine(canvasRef.current);
      engineRef.current = engine;
      setReady(true);
      const queued = pendingRef.current;
      const qa = new URLSearchParams(window.location.search).get("qa");
      if (queued) {
        pendingRef.current = null;
        engine.start(queued);
      } else if (qa === "1") {
        engine.start("city");
      }
    });
    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  const start = (course: CourseId) => {
    const eng =
      engineRef.current ??
      (typeof window !== "undefined" ? window.__driveEngine : null) ??
      null;
    if (!eng) {
      pendingRef.current = course;
      return;
    }
    eng.audio.unlock();
    eng.audio.setMuted(useDrive.getState().muted);
    eng.start(course);
  };

  const retry = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.start(hud.course);
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas ref={canvasRef} className="drive-canvas absolute inset-0 h-full w-full" />
      {phase === "menu" ? (
        <Menu
          onStart={start}
          muted={muted}
          onMute={() => {
            const next = !muted;
            setMuted(next);
            engineRef.current?.audio.setMuted(next);
          }}
        />
      ) : null}
      {phase === "playing" ? (
        <>
          <Hud hud={hud} onPause={() => engineRef.current?.pause()} />
          <TouchControls engine={ready ? engineRef.current : null} hud={hud} />
          <DesktopHint />
        </>
      ) : null}
      {phase === "paused" ? (
        <PauseMenu
          onResume={() => engineRef.current?.resume()}
          onQuit={() => engineRef.current?.quitToMenu()}
          onRetry={retry}
        />
      ) : null}
      {phase === "results" ? (
        <Results hud={hud} onRetry={retry} onQuit={() => engineRef.current?.quitToMenu()} />
      ) : null}
    </main>
  );
}
