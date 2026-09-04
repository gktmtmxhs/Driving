import * as THREE from "three";
import { GameAudio } from "./audio";
import { Input } from "./input";
import { Sim } from "./sim";
import { useDrive } from "./store";
import type { CourseId } from "./types";
import {
  applyLightColor,
  buildWorld,
  createPedestrian,
  createSedan,
  cycleLights,
  type WorldRuntime,
} from "./world";

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  setSteer?: (v: number) => void;
  setKeys?: (codes: string[]) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
    __driveEngine?: DriveEngine;
  }
}

const AI_COLORS = [0xcfd4da, 0x5b6b7a, 0xd8cfc4, 0x3d4a42, 0xb9a99a, 0x6a737c, 0xe8e4dc, 0x4a5560];

export class DriveEngine {
  readonly input = new Input();
  readonly sim = new Sim();
  readonly audio = new GameAudio();
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private rearCam: THREE.PerspectiveCamera;
  private leftMirrorCam: THREE.PerspectiveCamera;
  private rightMirrorCam: THREE.PerspectiveCamera;
  private rig = new THREE.Group();
  private wheel!: THREE.Object3D;
  private world: WorldRuntime | null = null;
  private aiMeshes: THREE.Group[] = [];
  private pedMeshes: THREE.Group[] = [];
  private chevrons: THREE.Mesh[] = [];
  private lightOn: Record<"red" | "yellow" | "green", THREE.MeshStandardMaterial>;
  private lightOff: Record<"red" | "yellow" | "green", THREE.MeshStandardMaterial>;
  private raf = 0;
  private last = performance.now();
  private acc = 0;
  private lastHud = 0;
  private lastLightKey = "";
  private running = false;
  private disposed = false;
  private needsRender = true;
  private resizeObs: ResizeObserver;
  private sun!: THREE.DirectionalLight;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const mobile = window.innerWidth < 700 || matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !mobile,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.75));
    this.renderer.setClearColor(0x7e93a8);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !mobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = true;

    this.scene.fog = new THREE.Fog(0x7e93a8, 70, 260);
    this.scene.background = new THREE.Color(0x7e93a8);

    const hemi = new THREE.HemisphereLight(0xc5d4e4, 0x4a5044, 0.85);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.35);
    this.sun.position.set(40, 70, 18);
    this.sun.castShadow = !mobile;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 180;
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.scene.add(this.sun);

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 420);
    this.camera.layers.enable(0);
    this.camera.layers.enable(1);
    this.camera.rotation.order = "YXZ";
    this.camera.position.set(-0.4, 1.2, 0.3);
    this.camera.rotation.x = -0.08;

    this.rearCam = new THREE.PerspectiveCamera(70, 16 / 9, 0.15, 180);
    this.rearCam.layers.set(0);
    this.rearCam.position.set(0, 1.15, 2.15);
    this.rearCam.rotation.y = Math.PI;

    this.leftMirrorCam = new THREE.PerspectiveCamera(58, 2.05, 0.15, 180);
    this.leftMirrorCam.layers.set(0);
    this.leftMirrorCam.position.set(-0.82, 1.12, -0.05);
    this.leftMirrorCam.rotation.y = Math.PI - 0.16;

    this.rightMirrorCam = new THREE.PerspectiveCamera(58, 2.05, 0.15, 180);
    this.rightMirrorCam.layers.set(0);
    this.rightMirrorCam.position.set(0.82, 1.12, -0.05);
    this.rightMirrorCam.rotation.y = Math.PI + 0.16;

    this.scene.add(this.rig);
    this.rig.add(this.camera);
    this.rig.add(this.rearCam);
    this.rig.add(this.leftMirrorCam);
    this.rig.add(this.rightMirrorCam);
    this.buildInterior();

    this.lightOn = {
      red: new THREE.MeshStandardMaterial({
        color: 0xff3a30,
        emissive: 0xff2a22,
        emissiveIntensity: 2.4,
      }),
      yellow: new THREE.MeshStandardMaterial({
        color: 0xffc043,
        emissive: 0xffb020,
        emissiveIntensity: 2.1,
      }),
      green: new THREE.MeshStandardMaterial({
        color: 0x34d070,
        emissive: 0x1ec45a,
        emissiveIntensity: 2.2,
      }),
    };
    this.lightOff = {
      red: new THREE.MeshStandardMaterial({ color: 0x3a1412 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0x3a3010 }),
      green: new THREE.MeshStandardMaterial({ color: 0x0e2a18 }),
    };

    this.input.attach();
    this.resize();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas.parentElement ?? canvas);
    document.addEventListener("visibilitychange", this.onVisibilityChange);

    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);

    window.__driveEngine = this;
    window.__controlsTest = {
      getYaw: () => this.sim.yaw,
      getSpeed: () => this.sim.speed,
      setSteer: (v) => {
        this.input.steerOverride = v;
      },
      setKeys: (codes) => this.input.setKeys(codes),
    };
  }

  private buildInterior() {
    const interior = new THREE.Group();
    interior.traverse(() => {});
    const vinyl = new THREE.MeshStandardMaterial({
      color: 0x2a2622,
      roughness: 0.85,
    });
    const paint = new THREE.MeshStandardMaterial({
      color: 0xd8dce0,
      roughness: 0.38,
      metalness: 0.18,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.5 });
    const chrome = new THREE.MeshStandardMaterial({
      color: 0xc5c8cc,
      metalness: 0.6,
      roughness: 0.3,
    });

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 1.85), paint);
    hood.position.set(0.38, 0.72, -1.55);
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.35), paint);
    cowl.position.set(0.38, 0.78, -0.62);

    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.28, 0.42), vinyl);
    dash.position.set(0.28, 0.72, -0.28);

    const cluster = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.18), dark);
    cluster.position.set(-0.18, 0.86, -0.22);

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.12), vinyl);
    pillarL.position.set(-0.82, 1.2, -0.55);
    pillarL.rotation.z = 0.18;
    pillarL.rotation.x = -0.35;
    const pillarR = pillarL.clone();
    pillarR.position.set(1.12, 1.2, -0.55);
    pillarR.rotation.z = -0.18;

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.5), vinyl);
    roof.position.set(0.2, 1.52, -0.15);

    const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.08), dark);
    mirrorL.position.set(-0.98, 1.05, -0.48);
    const mirrorR = mirrorL.clone();
    mirrorR.position.set(1.28, 1.05, -0.48);

    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 24), dark);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.018, 0.018), chrome);
    const spoke2 = spoke.clone();
    spoke2.rotation.z = Math.PI / 3;
    const spoke3 = spoke.clone();
    spoke3.rotation.z = -Math.PI / 3;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), chrome);
    hub.rotation.x = Math.PI / 2;
    wheel.add(rim, spoke, spoke2, spoke3, hub);
    wheel.position.set(-0.4, 0.78, -0.34);
    wheel.rotation.x = -1.15;
    this.wheel = wheel;

    interior.add(hood, cowl, dash, cluster, pillarL, pillarR, roof, mirrorL, mirrorR, wheel);
    interior.traverse((o) => {
      o.layers.set(1);
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = false;
    });
    this.rig.add(interior);

    const chevronGeo = new THREE.ConeGeometry(0.35, 0.9, 3);
    chevronGeo.rotateX(Math.PI / 2);
    const chevronMat = new THREE.MeshStandardMaterial({
      color: 0xd8dce0,
      emissive: 0xb8c0c8,
      emissiveIntensity: 0.4,
      roughness: 0.5,
    });
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(chevronGeo, chevronMat);
      c.position.y = 0.08;
      this.scene.add(c);
      this.chevrons.push(c);
    }
  }

  start(course: CourseId) {
    this.clearWorld();
    this.world = buildWorld(this.scene, course);
    this.sim.boot(course, this.world);
    this.spawnActors();
    this.running = true;
    this.needsRender = true;
    this.last = performance.now();
    this.acc = 0;
    this.audio.unlock();
    this.audio.setMuted(useDrive.getState().muted);
    useDrive.getState().setHud(this.sim.hud());
    this.syncVisuals(0.016);
  }

  pause() {
    if (this.sim.phase === "playing") {
      this.sim.phase = "paused";
      this.input.resetTouch();
      this.needsRender = true;
      useDrive.getState().setHud(this.sim.hud());
    }
  }

  resume() {
    if (this.sim.phase === "paused") {
      this.sim.phase = "playing";
      this.last = performance.now();
      this.needsRender = true;
      useDrive.getState().setHud(this.sim.hud());
    }
  }

  quitToMenu() {
    this.running = false;
    this.sim.phase = "menu";
    this.clearWorld();
    useDrive.getState().resetHud();
    this.input.setKeys([]);
    this.input.resetTouch();
    this.input.steerOverride = null;
    this.needsRender = true;
  }

  private spawnActors() {
    for (const m of this.aiMeshes) this.scene.remove(m);
    for (const m of this.pedMeshes) this.scene.remove(m);
    this.aiMeshes = [];
    this.pedMeshes = [];
    this.sim.ai.forEach((c, i) => {
      const mesh = createSedan(AI_COLORS[i % AI_COLORS.length]);
      this.scene.add(mesh);
      this.aiMeshes.push(mesh);
      mesh.position.set(c.x, 0, c.z);
      mesh.rotation.y = c.yaw;
    });
    this.sim.peds.forEach((p) => {
      const mesh = createPedestrian();
      this.scene.add(mesh);
      this.pedMeshes.push(mesh);
      mesh.position.set(p.x, 0, p.z);
    });
  }

  private clearWorld() {
    this.world?.dispose();
    this.world = null;
    for (const m of this.aiMeshes) {
      this.scene.remove(m);
      m.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    }
    for (const m of this.pedMeshes) this.scene.remove(m);
    this.aiMeshes = [];
    this.pedMeshes = [];
  }

  private resize() {
    const parent = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.rearCam.aspect = 16 / 9;
    this.rearCam.updateProjectionMatrix();
    this.needsRender = true;
  }

  private tick(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;

    let shouldRender = this.needsRender;
    if (this.running && this.sim.phase === "playing") {
      const actions = this.input.snapshot();
      if (actions.pauseEdge) {
        this.pause();
      } else {
        this.sim.applyControlEdges(actions);
      }
      if (actions.horn) this.audio.horn();
      this.acc += dt;
      const FIXED = 1 / 60;
      let steps = 0;
      while (this.sim.phase === "playing" && this.acc >= FIXED && steps < 5) {
        this.sim.step(FIXED, actions);
        this.acc -= FIXED;
        steps++;
      }
      shouldRender = true;
    } else if (this.sim.phase === "paused") {
      const actions = this.input.snapshot();
      if (actions.pauseEdge) this.resume();
    }

    if (shouldRender) {
      this.syncVisuals(dt);
      this.render();
      this.needsRender = false;
    }

    if (now - this.lastHud > 50) {
      this.lastHud = now;
      if (this.running) useDrive.getState().setHud(this.sim.hud());
      this.audio.setEngine(this.sim.speed, this.sim.throttle, this.sim.gear === "R");
      this.audio.setBlinker(this.sim.signalBlink);
    }
  }

  private syncVisuals(dt: number) {
    void dt;
    if (!this.running) return;
    this.rig.position.set(this.sim.x, this.sim.y, this.sim.z);
    this.rig.rotation.order = "YXZ";
    this.rig.rotation.y = this.sim.yaw;
    this.rig.rotation.x = this.sim.pitch;
    this.wheel.rotation.z = -this.sim.steer * 3.1;
    const kmh = Math.abs(this.sim.speed) * 3.6;
    this.camera.fov = 70 + Math.min(12, kmh * 0.12);
    this.camera.rotation.z = -this.sim.steer * 0.035 * Math.min(1, kmh / 40);
    this.camera.updateProjectionMatrix();

    this.sun.position.set(this.sim.x + 40, 70, this.sim.z + 18);
    this.sun.target.position.set(this.sim.x, 0, this.sim.z);
    this.sun.target.updateMatrixWorld();

    this.sim.ai.forEach((c, i) => {
      const m = this.aiMeshes[i];
      if (!m) return;
      m.position.set(c.x, 0, c.z);
      m.rotation.y = c.yaw;
    });
    this.sim.peds.forEach((p, i) => {
      const m = this.pedMeshes[i];
      if (!m) return;
      m.position.set(p.x, 0, p.z);
    });

    const wps = this.world?.waypoints ?? [];
    const wp = wps[this.sim.wpIndex];
    if (wp) {
      const dx = wp.x - this.sim.x;
      const dz = wp.z - this.sim.z;
      const len = Math.hypot(dx, dz) || 1;
      const ux = dx / len;
      const uz = dz / len;
      const yaw = Math.atan2(-ux, -uz);
      for (let i = 0; i < this.chevrons.length; i++) {
        const d = 6 + i * 3.2;
        this.chevrons[i].position.set(this.sim.x + ux * d, 0.1 + this.sim.y, this.sim.z + uz * d);
        this.chevrons[i].rotation.y = yaw;
        this.chevrons[i].visible = this.sim.course !== "skill" || i === 0;
      }
    }

    if (this.world) {
      const { ns, ew } = cycleLights(this.sim.time);
      const key = `${ns}|${ew}`;
      if (key !== this.lastLightKey) {
        this.lastLightKey = key;
        for (const pole of this.world.lights) {
          applyLightColor(pole, pole.axis === "ns" ? ns : ew, this.lightOn, this.lightOff);
        }
      }
    }
  }

  private render() {
    const r = this.renderer;
    r.setScissorTest(false);
    r.setViewport(0, 0, this.canvas.width, this.canvas.height);
    r.render(this.scene, this.camera);
    if (!this.running) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = r.getPixelRatio();
    const shortLandscape = w / h > 1.45 && h / dpr <= 500;
    const topGap = Math.floor(shortLandscape ? 58 * dpr : Math.max(68 * dpr, h * 0.08));
    r.autoClear = false;
    r.setScissorTest(true);

    if (this.sim.gear === "R") {
      const rw = Math.floor(
        Math.min(w * (shortLandscape ? 0.42 : 0.58), (shortLandscape ? 360 : 420) * dpr),
      );
      const rh = Math.floor(rw / (16 / 9));
      this.renderInset(this.rearCam, Math.floor((w - rw) / 2), h - topGap - rh, rw, rh);
    } else {
      const mw = Math.floor(
        Math.min(w * (shortLandscape ? 0.22 : 0.29), (shortLandscape ? 160 : 180) * dpr),
      );
      const mh = Math.floor(mw / 2.05);
      const sideGap = Math.floor(Math.max(12 * dpr, w * 0.03));
      const y = h - topGap - mh;
      this.renderInset(this.leftMirrorCam, sideGap, y, mw, mh);
      this.renderInset(this.rightMirrorCam, w - mw - sideGap, y, mw, mh);
    }

    r.setScissorTest(false);
    r.autoClear = true;
    r.setViewport(0, 0, w, h);
  }

  private renderInset(
    camera: THREE.PerspectiveCamera,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const r = this.renderer;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    r.setViewport(x, Math.max(0, y), width, height);
    r.setScissor(x, Math.max(0, y), width, height);
    r.clear(true, true, true);
    r.render(this.scene, camera);
  }

  private onVisibilityChange = () => {
    if (!document.hidden) return;
    this.input.resetTouch();
    this.pause();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.input.dispose();
    this.audio.dispose();
    this.clearWorld();
    this.renderer.dispose();
    if (window.__driveEngine === this) delete window.__driveEngine;
    if (window.__controlsTest) delete window.__controlsTest;
  }
}
