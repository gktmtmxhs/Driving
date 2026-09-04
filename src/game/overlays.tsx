import {
  ArrowLeft,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CourseId, HudState } from "./types";
import { useEffect, useRef, type CSSProperties } from "react";

type EngineHandle = {
  input: {
    steerTouch: number;
    brakeTouch: number;
    throttleTouch: number;
    signalLeftEdge: boolean;
    signalRightEdge: boolean;
    gearDriveEdge: boolean;
    gearReverseEdge: boolean;
  };
};

function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function Menu({
  onStart,
  muted,
  onMute,
}: {
  onStart: (c: CourseId) => void;
  muted: boolean;
  onMute: () => void;
}) {
  const courses: { id: CourseId; title: string; desc: string; cta: string }[] = [
    {
      id: "city",
      title: "도심 도로주행",
      desc: "신호등 · 횡단보도 · 제한속도가 있는 시내 코스. 연습 모드입니다.",
      cta: "주행 시작",
    },
    {
      id: "skill",
      title: "장내기능",
      desc: "경사로 3초 정지, S자 코스, 직각주차. 기능시험 감각을 익힙니다.",
      cta: "장내 시작",
    },
    {
      id: "exam",
      title: "도로주행 시험",
      desc: "같은 시내 코스를 채점합니다. 신호위반·충돌은 실격, 70점 합격.",
      cta: "시험 시작",
    },
  ];

  return (
    <div className="absolute inset-0 z-20 flex flex-col">
      <div className="road-vanish pointer-events-none" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/55 via-bg/75 to-bg" />
      <div className="relative flex min-h-0 flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted">
              2종 보통 · 1인칭 연습
            </p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight text-fg">
              로드뷰
            </h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={muted ? "소리 켜기" : "소리 끄기"}
            onClick={onMute}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
        </header>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
          운전석 시점으로 도로를 봅니다. 안드로이드에서는 홈 화면에 추가하면 앱처럼
          쓸 수 있습니다.
        </p>

        <div className="mt-6 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {courses.map((c) => (
            <button
              key={c.id}
              type="button"
              data-course={c.id}
              onClick={() => onStart(c.id)}
              className="relative z-10 rounded-xl border border-border bg-surface/90 p-4 text-left transition-colors duration-150 hover:bg-surface-2"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-fg">{c.title}</h2>
                <span className="text-sm text-accent">{c.cta}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted">{c.desc}</p>
            </button>
          ))}
        </div>

        <footer className="mt-4 rounded-lg border border-border bg-surface/80 px-4 py-3 text-xs leading-relaxed text-muted">
          <p className="font-medium text-fg">조작</p>
          <p className="mt-1">
            키보드 W/S 가속·제동, A/D 조향, Z/C 방향지시등, Q 후진, E 전진, Esc 일시정지.
            터치에서는 왼쪽 핸들과 오른쪽 페달을 사용하세요.
          </p>
        </footer>
      </div>
    </div>
  );
}

export function Hud({
  hud,
  onPause,
}: {
  hud: HudState;
  onPause: () => void;
}) {
  const limitOver = Math.round(hud.speedKmh) > hud.speedLimit + 5;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="rounded-md border border-border bg-cluster/80 px-3 py-2 backdrop-blur-sm">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
              점수
            </p>
            <p className="hud-num text-xl font-semibold text-fg">{hud.score}</p>
          </div>
          <div
            className="grid size-12 place-items-center rounded-full border-4 border-stop bg-sign text-lg font-semibold text-bg"
            aria-label={`제한속도 ${hud.speedLimit}`}
          >
            {hud.speedLimit}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-md border border-border bg-cluster/80 px-3 py-2 text-right backdrop-blur-sm">
            <p className="text-[10px] font-medium text-muted">{fmtTime(hud.timeSec)}</p>
            <p className="hud-num text-sm text-fg">
              {Math.round(hud.progress * 100)}%
            </p>
          </div>
          <Button
            variant="subtle"
            size="icon"
            className="pointer-events-auto"
            aria-label="일시정지"
            onClick={onPause}
          >
            <Pause />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-md text-center">
        <p className="rounded-md bg-cluster/70 px-3 py-2 text-sm font-medium text-fg backdrop-blur-sm">
          {hud.instructionDist > 4
            ? `${Math.round(hud.instructionDist)}m 앞 · ${hud.instruction}`
            : hud.instruction}
        </p>
        {hud.hint ? (
          <p className="mt-2 text-sm text-caution">{hud.hint}</p>
        ) : null}
      </div>

      <div className="mb-28 flex items-end justify-between gap-3 sm:mb-8">
        <div className="flex items-center gap-2">
          <SignalLamp side="L" on={hud.signal === "left" && hud.signalBlink} />
          <div className="rounded-lg border border-border bg-cluster/85 px-4 py-2 backdrop-blur-sm">
            <p className="hud-num text-4xl font-semibold leading-none text-fg">
              {Math.round(hud.speedKmh)}
            </p>
            <p className="mt-1 text-[10px] tracking-wide text-muted">km/h</p>
          </div>
          <SignalLamp side="R" on={hud.signal === "right" && hud.signalBlink} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded-md px-2 py-1 text-xs font-semibold ${
              hud.gear === "R" ? "bg-stop text-fg" : "bg-surface-2 text-fg"
            }`}
          >
            {hud.gear}
          </span>
          {hud.light !== "none" ? (
            <span
              className={`size-2.5 rounded-full ${
                hud.light === "green"
                  ? "bg-go"
                  : hud.light === "yellow"
                    ? "bg-caution"
                    : "bg-stop"
              }`}
            />
          ) : null}
          {limitOver ? (
            <span className="text-[10px] font-medium text-stop">과속</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SignalLamp({ side, on }: { side: "L" | "R"; on: boolean }) {
  return (
    <span
      className={`grid size-8 place-items-center rounded-md border text-xs font-semibold ${
        on
          ? "border-go bg-go text-bg"
          : "border-border bg-cluster text-muted"
      }`}
    >
      {side}
    </span>
  );
}

export function TouchControls({
  engine,
  hud,
}: {
  engine: EngineHandle | null;
  hud: HudState;
}) {
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wheelRef.current;
    if (!el || !engine) return;
    let pid: number | null = null;
    const setSteer = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      const x = clientX - (rect.left + rect.width / 2);
      // finger left (x < 0) → +steer (turn left)
      engine.input.steerTouch = Math.max(-1, Math.min(1, -x / (rect.width * 0.42)));
    };
    const down = (e: PointerEvent) => {
      pid = e.pointerId;
      el.setPointerCapture(e.pointerId);
      setSteer(e.clientX);
    };
    const move = (e: PointerEvent) => {
      if (pid !== e.pointerId) return;
      setSteer(e.clientX);
    };
    const up = (e: PointerEvent) => {
      if (pid !== e.pointerId) return;
      pid = null;
      engine.input.steerTouch = 0;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      engine.input.steerTouch = 0;
    };
  }, [engine]);

  if (!engine) return null;

  return (
    <div className="touch-only pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        ref={wheelRef}
        className="pointer-events-auto grid size-28 place-items-center rounded-full border border-border bg-cluster/80 backdrop-blur-sm"
        style={{ transform: `rotate(${-hud.steer * 70}deg)` }}
        aria-label="조향"
      >
        <div className="size-16 rounded-full border-2 border-muted/40" />
      </div>
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            className="h-11 min-w-11 rounded-md border border-border bg-surface px-3 text-sm"
            onPointerDown={() => {
              engine.input.signalLeftEdge = true;
              queueMicrotask(() => {
                engine.input.signalLeftEdge = false;
              });
            }}
          >
            좌
          </button>
          <button
            type="button"
            className="h-11 min-w-11 rounded-md border border-border bg-surface px-3 text-sm"
            onPointerDown={() => {
              engine.input.signalRightEdge = true;
              queueMicrotask(() => {
                engine.input.signalRightEdge = false;
              });
            }}
          >
            우
          </button>
          <button
            type="button"
            className={`h-11 min-w-11 rounded-md border border-border px-3 text-sm ${
              hud.gear === "R" ? "bg-stop text-fg" : "bg-surface"
            }`}
            onPointerDown={() => {
              if (hud.gear === "R") engine.input.gearDriveEdge = true;
              else engine.input.gearReverseEdge = true;
              queueMicrotask(() => {
                engine.input.gearDriveEdge = false;
                engine.input.gearReverseEdge = false;
              });
            }}
          >
            {hud.gear === "R" ? "D" : "R"}
          </button>
        </div>
        <div className="flex gap-2">
          <Pedal
            label="제동"
            onHold={(v) => {
              engine.input.brakeTouch = v;
            }}
            danger
          />
          <Pedal
            label="가속"
            onHold={(v) => {
              engine.input.throttleTouch = v;
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Pedal({
  label,
  onHold,
  danger,
}: {
  label: string;
  onHold: (v: number) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`h-24 w-16 rounded-lg border text-sm font-medium ${
        danger
          ? "border-stop/40 bg-stop/20 text-fg"
          : "border-go/40 bg-go/20 text-fg"
      }`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(1);
      }}
      onPointerUp={() => onHold(0)}
      onPointerCancel={() => onHold(0)}
    >
      {label}
    </button>
  );
}

export function PauseMenu({
  onResume,
  onQuit,
  onRetry,
}: {
  onResume: () => void;
  onQuit: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-bg/70 px-5 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <h2 className="text-xl font-semibold">일시정지</h2>
        <p className="mt-1 text-sm text-muted">코스를 이어서 연습할 수 있습니다.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button size="lg" onClick={onResume}>
            <Play /> 계속하기
          </Button>
          <Button variant="outline" size="lg" onClick={onRetry}>
            <RotateCcw /> 다시 시작
          </Button>
          <Button variant="ghost" size="lg" onClick={onQuit}>
            <ArrowLeft /> 메뉴
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Results({
  hud,
  onRetry,
  onQuit,
}: {
  hud: HudState;
  onRetry: () => void;
  onQuit: () => void;
}) {
  const pass = !hud.failed && hud.score >= 70;
  const pct = hud.score;
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-bg/75 px-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6">
        <p className="text-xs font-medium tracking-wide text-muted">
          {hud.course === "skill" ? "장내기능" : hud.course === "exam" ? "도로주행 시험" : "도심 연습"}
        </p>
        <h2 className="mt-1 text-2xl font-semibold">
          {hud.failed ? "실격" : pass ? "합격" : "불합격"}
        </h2>
        <div className="mt-5 flex items-center gap-5">
          <div
            className="score-ring grid size-24 place-items-center rounded-full p-1.5"
            style={
              {
                "--pct": pct,
                "--ring-color": pass ? "var(--color-go)" : "var(--color-stop)",
              } as CSSProperties
            }
          >
            <div className="grid size-full place-items-center rounded-full bg-surface">
              <span className="hud-num text-2xl font-semibold">{hud.score}</span>
            </div>
          </div>
          <div className="text-sm text-muted">
            <p>
              시간 <span className="text-fg">{fmtTime(hud.timeSec)}</span>
            </p>
            <p className="mt-1">
              감점 {hud.violations.length}건
            </p>
            <p className="mt-1">합격 기준 70점</p>
          </div>
        </div>
        {hud.violations.length ? (
          <ul className="mt-4 max-h-36 space-y-1 overflow-y-auto text-sm">
            {hud.violations.map((v, i) => (
              <li key={i} className="flex justify-between gap-3 text-muted">
                <span>{v.label}</span>
                <span className="text-stop">-{v.points}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-go">감점 없이 완주했습니다.</p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <Button size="lg" onClick={onRetry}>
            <RotateCcw /> 다시 주행
          </Button>
          <Button variant="outline" size="lg" onClick={onQuit}>
            메뉴로
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DesktopHint() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 rounded-md border border-border bg-cluster/80 px-3 py-1.5 text-[11px] text-muted backdrop-blur-sm sm:block">
      W 가속 · S 제동 · A/D 조향 · Z/C 방향등 · Q 후진
    </div>
  );
}
