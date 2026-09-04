import { ArrowLeft, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CourseId, HudState } from "./types";
import { useEffect, useRef, type CSSProperties } from "react";

type EngineHandle = {
  input: {
    steerTouch: number;
    brakeTouch: number;
    throttleTouch: number;
    triggerSignalLeft: () => void;
    triggerSignalRight: () => void;
    triggerGearDrive: () => void;
    triggerGearReverse: () => void;
    resetTouch: () => void;
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
            <p className="text-xs font-medium tracking-wide text-muted">2종 보통 · 1인칭 연습</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight text-fg">로드뷰</h1>
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
          운전석 시점으로 도로를 봅니다. 안드로이드에서는 홈 화면에 추가하면 앱처럼 쓸 수 있습니다.
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

        <footer className="mt-4 rounded-lg border border-border bg-surface/80 px-4 py-3 text-sm leading-relaxed text-muted">
          <p className="font-medium text-fg">조작</p>
          <p className="desktop-only mt-1">
            키보드 W/S 가속·제동, A/D 조향, Z/C 방향지시등, Q 후진, E 전진, Esc 일시정지.
          </p>
          <p className="mobile-only mt-1">
            왼쪽 핸들을 밀고, 오른쪽 가속·제동 페달을 길게 누릅니다.
          </p>
        </footer>
      </div>
    </div>
  );
}

export function StartGuide({
  course,
  ready,
  onBack,
  onStart,
}: {
  course: CourseId;
  ready: boolean;
  onBack: () => void;
  onStart: () => void;
}) {
  const names: Record<CourseId, string> = {
    city: "도심 도로주행",
    skill: "장내기능",
    exam: "도로주행 시험",
  };
  return (
    <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-bg/80 px-5 py-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-md">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-guide-title"
        className="my-auto w-full max-w-sm rounded-xl border border-border bg-surface p-5"
      >
        <p className="text-sm font-medium text-muted">{names[course]}</p>
        <h2 id="start-guide-title" className="mt-1 text-2xl font-semibold">
          출발 전 조작 확인
        </h2>
        <div className="mt-5 space-y-3 text-sm">
          <GuideRow
            badge="핸들"
            title="왼손으로 좌우 드래그"
            desc="손을 떼면 핸들이 가운데로 돌아옵니다."
          />
          <GuideRow
            badge="페달"
            title="오른손으로 길게 누르기"
            desc="가속과 제동을 동시에 누르지 마세요."
          />
          <GuideRow
            badge="등·기어"
            title="방향등과 D·R을 따로 선택"
            desc="D는 전진, R은 후진입니다. 미러의 왼쪽 뒤·오른쪽 뒤 표기를 확인하세요."
          />
        </div>
        <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm leading-relaxed text-muted">
          휴대폰을 가로로 돌리면 좌우 시야와 사이드미러가 더 넓게 보입니다.
        </p>
        <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
          <Button variant="outline" size="lg" onClick={onBack}>
            <ArrowLeft /> 뒤로
          </Button>
          <Button size="lg" onClick={onStart} disabled={!ready} autoFocus>
            {ready ? "준비됐어요" : "차량 준비 중"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function GuideRow({ badge, title, desc }: { badge: string; title: string; desc: string }) {
  return (
    <div className="grid grid-cols-[4.25rem_1fr] gap-3 rounded-lg border border-border px-3 py-3">
      <span className="grid h-8 place-items-center rounded-md bg-cluster text-xs font-semibold text-accent">
        {badge}
      </span>
      <div>
        <p className="font-medium text-fg">{title}</p>
        <p className="mt-0.5 leading-relaxed text-muted">{desc}</p>
      </div>
    </div>
  );
}

export function StartCountdown({ count }: { count: number }) {
  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center bg-bg/65 backdrop-blur-sm"
      aria-live="assertive"
      aria-label={`${count}초 후 출발`}
    >
      <div className="text-center">
        <p className="hud-num text-8xl font-semibold text-fg">{count}</p>
        <p className="mt-3 text-base font-medium text-muted">양손을 조작 위치에 올리세요</p>
      </div>
    </div>
  );
}

export function Hud({ hud, onPause }: { hud: HudState; onPause: () => void }) {
  const limitOver = Math.round(hud.speedKmh) > hud.speedLimit + 5;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="rounded-md border border-border bg-cluster/80 px-3 py-2 backdrop-blur-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {hud.course === "exam" ? "모드" : "점수"}
            </p>
            <p className="hud-num text-xl font-semibold text-fg">
              {hud.course === "exam" ? "시험" : hud.score}
            </p>
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
            <p className="text-xs font-medium text-muted">{fmtTime(hud.timeSec)}</p>
            <p className="hud-num text-sm text-fg">{Math.round(hud.progress * 100)}%</p>
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

      <div className="hud-instruction mx-auto max-w-md text-center">
        <div
          className="route-cue inline-flex max-w-full items-center gap-3 rounded-lg border border-border bg-cluster/80 px-3 py-2 text-left shadow-lg backdrop-blur-sm"
          aria-label={`${Math.max(0, Math.round(hud.instructionDist))}미터 앞 ${hud.instruction || "경로 확인 중"}`}
        >
          <span
            className="route-cue-symbol grid size-11 shrink-0 place-items-center rounded-md bg-accent text-xl font-semibold text-bg"
            aria-hidden="true"
          >
            {routeSymbol(hud.instructionAction)}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium text-muted">
              {hud.instructionDist > 4 ? `${Math.round(hud.instructionDist)}m 앞` : "바로 앞"}
            </span>
            <span className="block truncate text-sm font-semibold text-fg">
              {hud.instruction || "경로 확인 중"}
            </span>
          </span>
        </div>
        {hud.hint ? (
          <p className="mt-2 text-sm font-medium text-caution" role="status">
            {hud.hint}
          </p>
        ) : null}
      </div>

      <CameraFrames reverse={hud.reverseCam} />

      <div className="hud-bottom mb-28 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <SignalLamp side="L" on={hud.signal === "left" && hud.signalBlink} />
          <div className="rounded-lg border border-border bg-cluster/85 px-4 py-2 backdrop-blur-sm">
            <p className="hud-num text-4xl font-semibold leading-none text-fg">
              {Math.round(hud.speedKmh)}
            </p>
            <p className="mt-1 text-xs tracking-wide text-muted">km/h</p>
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
              className="flex items-center gap-1.5 text-xs text-fg"
              aria-label={`신호 ${lightLabel(hud.light)}`}
            >
              <span
                className={`size-2.5 rounded-full ${
                  hud.light === "green"
                    ? "bg-go"
                    : hud.light === "yellow"
                      ? "bg-caution"
                      : "bg-stop"
                }`}
              />
              {lightLabel(hud.light)}
            </span>
          ) : null}
          {limitOver ? <span className="text-xs font-semibold text-stop">과속</span> : null}
        </div>
      </div>
    </div>
  );
}

function lightLabel(light: "green" | "yellow" | "red") {
  return light === "green" ? "녹색" : light === "yellow" ? "황색" : "적색";
}

function routeSymbol(action: HudState["instructionAction"]) {
  if (action === "left") return "←";
  if (action === "right") return "→";
  if (action === "hold") return "정지";
  if (action === "park") return "P";
  if (action === "finish") return "도착";
  return "↑";
}

function CameraFrames({ reverse }: { reverse: boolean }) {
  if (reverse) {
    return (
      <div className="camera-frame camera-frame--reverse" aria-hidden="true">
        <span>차량 뒤</span>
      </div>
    );
  }
  return (
    <>
      <div className="camera-frame camera-frame--left" aria-hidden="true">
        <span>왼쪽 뒤</span>
      </div>
      <div className="camera-frame camera-frame--right" aria-hidden="true">
        <span>오른쪽 뒤</span>
      </div>
    </>
  );
}

function SignalLamp({ side, on }: { side: "L" | "R"; on: boolean }) {
  return (
    <span
      aria-label={`${side === "L" ? "왼쪽" : "오른쪽"} 방향지시등 ${on ? "켜짐" : "꺼짐"}`}
      className={`grid size-8 place-items-center rounded-md border text-xs font-semibold ${
        on ? "border-go bg-go text-bg" : "border-border bg-cluster text-muted"
      }`}
    >
      {side === "L" ? "←" : "→"}
    </span>
  );
}

export function TouchControls({ engine, hud }: { engine: EngineHandle | null; hud: HudState }) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const steerRef = useRef(hud.steer);
  steerRef.current = hud.steer;

  useEffect(() => {
    const el = wheelRef.current;
    if (!el || !engine) return;
    let pid: number | null = null;
    let startX = 0;
    let startSteer = 0;
    const setSteer = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      const dx = clientX - startX;
      const deadzone = 6;
      const distance = Math.max(0, Math.abs(dx) - deadzone);
      const normalized = Math.min(1, distance / (rect.width * 0.65));
      const curved = Math.pow(normalized, 1.15) * -Math.sign(dx);
      engine.input.steerTouch = Math.max(-1, Math.min(1, startSteer + curved));
    };
    const down = (e: PointerEvent) => {
      pid = e.pointerId;
      startX = e.clientX;
      startSteer = steerRef.current;
      el.setPointerCapture(e.pointerId);
      engine.input.steerTouch = startSteer;
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
    el.addEventListener("lostpointercapture", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("lostpointercapture", up);
      engine.input.resetTouch();
    };
  }, [engine]);

  if (!engine) return null;

  return (
    <div className="touch-controls touch-only pointer-events-none absolute inset-x-0 bottom-0 z-20 items-end justify-between gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        ref={wheelRef}
        className="steer-wheel pointer-events-auto grid size-28 touch-none place-items-center rounded-full border border-border bg-cluster/85 backdrop-blur-sm"
        style={{ transform: `rotate(${-hud.steer * 70}deg)` }}
        role="slider"
        tabIndex={0}
        aria-label="조향"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(hud.steer * 100)}
        aria-valuetext={
          Math.abs(hud.steer) < 0.05
            ? "중앙"
            : hud.steer > 0
              ? `왼쪽 ${Math.round(hud.steer * 100)}`
              : `오른쪽 ${Math.round(-hud.steer * 100)}`
        }
      >
        <div className="relative size-16 rounded-full border-2 border-muted/50">
          <span className="absolute left-1/2 top-1/2 h-0.5 w-14 -translate-x-1/2 -translate-y-1/2 bg-muted/45" />
          <span className="absolute left-1/2 top-1/2 h-14 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-muted/45" />
          <span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted/70" />
        </div>
      </div>
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            className={`signal-control h-11 min-w-11 rounded-md border px-3 text-sm font-semibold transition-colors ${
              hud.signal === "left" ? "border-go bg-go text-bg" : "border-border bg-surface text-fg"
            }`}
            aria-label="왼쪽 방향지시등"
            aria-pressed={hud.signal === "left"}
            onClick={() => {
              engine.input.triggerSignalLeft();
              vibrate();
            }}
          >
            ←
          </button>
          <button
            type="button"
            className={`signal-control h-11 min-w-11 rounded-md border px-3 text-sm font-semibold transition-colors ${
              hud.signal === "right"
                ? "border-go bg-go text-bg"
                : "border-border bg-surface text-fg"
            }`}
            aria-label="오른쪽 방향지시등"
            aria-pressed={hud.signal === "right"}
            onClick={() => {
              engine.input.triggerSignalRight();
              vibrate();
            }}
          >
            →
          </button>
          <GearSelector engine={engine} hud={hud} />
        </div>
        <div className="flex gap-2">
          <Pedal
            label="제동"
            active={hud.brake > 0.05}
            onHold={(v) => {
              engine.input.brakeTouch = v;
            }}
            danger
          />
          <Pedal
            label="가속"
            active={hud.throttle > 0.05}
            onHold={(v) => {
              engine.input.throttleTouch = v;
            }}
          />
        </div>
      </div>
    </div>
  );
}

function GearSelector({ engine, hud }: { engine: EngineHandle; hud: HudState }) {
  const moving = hud.speedKmh >= 1;
  return (
    <div
      className="gear-selector flex h-11 overflow-hidden rounded-md border border-border bg-surface p-0.5"
      role="group"
      aria-label="주행 기어"
    >
      {(["D", "R"] as const).map((gear) => {
        const selected = hud.gear === gear;
        return (
          <button
            key={gear}
            type="button"
            className={`grid w-11 place-items-center rounded text-sm font-semibold transition-colors disabled:opacity-40 ${
              selected ? (gear === "R" ? "bg-stop text-fg" : "bg-accent text-bg") : "text-muted"
            }`}
            disabled={moving && !selected}
            aria-label={`${gear === "D" ? "전진" : "후진"} 기어${selected ? ", 현재 선택됨" : ""}`}
            aria-pressed={selected}
            onClick={() => {
              if (selected) return;
              if (gear === "D") engine.input.triggerGearDrive();
              else engine.input.triggerGearReverse();
              vibrate();
            }}
          >
            {gear}
          </button>
        );
      })}
    </div>
  );
}

function Pedal({
  label,
  onHold,
  danger,
  active,
}: {
  label: string;
  onHold: (v: number) => void;
  danger?: boolean;
  active: boolean;
}) {
  return (
    <button
      type="button"
      className={`pedal-control h-24 w-16 touch-none rounded-lg border text-sm font-semibold transition-[background-color,transform,box-shadow] ${
        danger
          ? active
            ? "scale-[0.97] border-stop bg-stop/55 text-fg shadow-[0_0_0_3px_rgb(196_84_74_/_0.18)]"
            : "border-stop/40 bg-stop/20 text-fg"
          : active
            ? "scale-[0.97] border-go bg-go/55 text-fg shadow-[0_0_0_3px_rgb(61_154_106_/_0.18)]"
            : "border-go/40 bg-go/20 text-fg"
      }`}
      aria-label={`${label} 페달`}
      aria-pressed={active}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(1);
        vibrate();
      }}
      onPointerUp={() => onHold(0)}
      onPointerCancel={() => onHold(0)}
      onLostPointerCapture={() => onHold(0)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

function vibrate() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
}

export function RotatePrompt() {
  return (
    <div className="rotate-prompt pointer-events-none absolute inset-x-0 z-20 mx-auto w-max items-center gap-2 rounded-full border border-border bg-cluster/90 px-3 py-2 text-sm text-fg shadow-lg backdrop-blur-sm">
      <RotateCw className="size-4 text-accent" aria-hidden="true" />
      가로로 돌리면 시야와 미러가 넓어집니다
    </div>
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
    <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-bg/70 px-5 py-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        className="my-auto w-full max-w-sm rounded-xl border border-border bg-surface p-6"
      >
        <h2 id="pause-title" className="text-xl font-semibold">
          일시정지
        </h2>
        <p className="mt-1 text-sm text-muted">코스를 이어서 연습할 수 있습니다.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button size="lg" onClick={onResume} autoFocus>
            <Play /> 계속하기
          </Button>
          <Button variant="outline" size="lg" onClick={onRetry}>
            <RotateCcw /> 다시 시작
          </Button>
          <Button variant="ghost" size="lg" onClick={onQuit}>
            <ArrowLeft /> 메뉴
          </Button>
        </div>
      </section>
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
    <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-bg/75 px-5 py-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="results-title"
        className="my-auto max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-border bg-surface p-6"
      >
        <p className="text-xs font-medium tracking-wide text-muted">
          {hud.course === "skill"
            ? "장내기능"
            : hud.course === "exam"
              ? "도로주행 시험"
              : "도심 연습"}
        </p>
        <h2 id="results-title" className="mt-1 text-2xl font-semibold">
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
            <p className="mt-1">감점 {hud.violations.length}건</p>
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
          <Button size="lg" onClick={onRetry} autoFocus>
            <RotateCcw /> 다시 주행
          </Button>
          <Button variant="outline" size="lg" onClick={onQuit}>
            메뉴로
          </Button>
        </div>
      </section>
    </div>
  );
}

export function DesktopHint() {
  return (
    <div className="desktop-only pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-md border border-border bg-cluster/80 px-3 py-1.5 text-xs text-muted backdrop-blur-sm">
      W 가속 · S 제동 · A/D 조향 · Z/C 방향등 · Q 후진
    </div>
  );
}
