import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { asphaltTex, facadeTex, grassTex } from "./textures";
import type { Aabb, CourseId, LightColor, Waypoint } from "./types";

export const GRID = [-128, -64, 0, 64, 128];
export const ROAD_HALF = 4.5;
export const SIDEWALK = 2.4;
export const LANE = 2.15;

export type Cone = { x: number; z: number; r: number };
export type LightPole = {
  axis: "ns" | "ew";
  lenses: { r: THREE.Mesh; y: THREE.Mesh; g: THREE.Mesh };
};

export type WorldRuntime = {
  group: THREE.Group;
  colliders: Aabb[];
  cones: Cone[];
  intersections: { x: number; z: number }[];
  waypoints: Waypoint[];
  parkBay: Aabb | null;
  holdZone: Aabb | null;
  spawn: { x: number; z: number; yaw: number };
  heightAt: (x: number, z: number) => number;
  inSchool: (x: number, z: number) => boolean;
  lights: LightPole[];
  aiPath: { x: number; z: number }[];
  dispose: () => void;
};

function mergeBoxes(
  items: { w: number; h: number; d: number; x: number; y: number; z: number; ry?: number }[],
  mat: THREE.Material,
) {
  const geos = items.map((it) => {
    const g = new THREE.BoxGeometry(it.w, it.h, it.d);
    if (it.ry) g.rotateY(it.ry);
    g.translate(it.x, it.y, it.z);
    return g;
  });
  const merged = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  if (!merged) throw new Error("merge failed");
  const mesh = new THREE.Mesh(merged, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

export function cycleLights(t: number): { ns: LightColor; ew: LightColor } {
  const p = t % 46;
  if (p < 17) return { ns: "green", ew: "red" };
  if (p < 20) return { ns: "yellow", ew: "red" };
  if (p < 23) return { ns: "red", ew: "red" };
  if (p < 40) return { ns: "red", ew: "green" };
  if (p < 43) return { ns: "red", ew: "yellow" };
  return { ns: "red", ew: "red" };
}

export function applyLightColor(
  pole: LightPole,
  color: LightColor,
  onMat: Record<LightColor, THREE.MeshStandardMaterial>,
  offMat: Record<LightColor, THREE.MeshStandardMaterial>,
) {
  pole.lenses.r.material = color === "red" ? onMat.red : offMat.red;
  pole.lenses.y.material = color === "yellow" ? onMat.yellow : offMat.yellow;
  pole.lenses.g.material = color === "green" ? onMat.green : offMat.green;
}

export function buildWorld(scene: THREE.Scene, course: CourseId): WorldRuntime {
  const group = new THREE.Group();
  scene.add(group);
  const textures: THREE.Texture[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const asphaltMap = asphaltTex();
  textures.push(asphaltMap);
  const grassMap = grassTex();
  textures.push(grassMap);

  const asphalt = new THREE.MeshStandardMaterial({
    map: asphaltMap,
    roughness: 0.95,
    color: 0x9a9ca0,
  });
  const sidewalk = new THREE.MeshStandardMaterial({
    color: 0x8a8780,
    roughness: 0.92,
  });
  const grass = new THREE.MeshStandardMaterial({
    map: grassMap,
    roughness: 1,
    color: 0xc8d0c0,
  });
  const curb = new THREE.MeshStandardMaterial({ color: 0xb8b4ae, roughness: 0.7 });
  const lineW = new THREE.MeshStandardMaterial({
    color: 0xeceadf,
    roughness: 0.55,
  });
  const lineY = new THREE.MeshStandardMaterial({
    color: 0xd4b84a,
    roughness: 0.55,
  });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3d6a46, roughness: 0.85 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.6 });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.4 });
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xc4544a, roughness: 0.5 });
  const coneStripe = new THREE.MeshStandardMaterial({ color: 0xeceadf, roughness: 0.5 });
  const onMat = {
    red: new THREE.MeshStandardMaterial({
      color: 0xff3a30,
      emissive: 0xff2a22,
      emissiveIntensity: 2.4,
      roughness: 0.3,
    }),
    yellow: new THREE.MeshStandardMaterial({
      color: 0xffc043,
      emissive: 0xffb020,
      emissiveIntensity: 2.1,
      roughness: 0.3,
    }),
    green: new THREE.MeshStandardMaterial({
      color: 0x34d070,
      emissive: 0x1ec45a,
      emissiveIntensity: 2.2,
      roughness: 0.3,
    }),
  };
  const offMat = {
    red: new THREE.MeshStandardMaterial({ color: 0x3a1412, roughness: 0.5 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0x3a3010, roughness: 0.5 }),
    green: new THREE.MeshStandardMaterial({ color: 0x0e2a18, roughness: 0.5 }),
  };
  mats.push(
    asphalt, sidewalk, grass, curb, lineW, lineY, trunkMat, leafMat, poleMat,
    housingMat, coneMat, coneStripe, onMat.red, onMat.yellow, onMat.green,
    offMat.red, offMat.yellow, offMat.green,
  );

  const palettes = [
    { base: "#d5cec2", cap: "#8a857c" },
    { base: "#c8d0cc", cap: "#6e7874" },
    { base: "#e6e1d6", cap: "#9a9286" },
    { base: "#b7c0c6", cap: "#5c656c" },
    { base: "#d8cfc4", cap: "#7a6e62" },
  ];
  const buildingMats = palettes.map((p) => {
    const map = facadeTex(p.base, p.cap);
    textures.push(map);
    const m = new THREE.MeshStandardMaterial({ map, roughness: 0.82, metalness: 0.04 });
    mats.push(m);
    return m;
  });

  const colliders: Aabb[] = [];
  const cones: Cone[] = [];
  const intersections: { x: number; z: number }[] = [];
  const lights: LightPole[] = [];
  let waypoints: Waypoint[] = [];
  let parkBay: Aabb | null = null;
  let holdZone: Aabb | null = null;
  let spawn = { x: LANE, z: 140, yaw: 0 };
  let heightAt = (_x: number, _z: number) => 0;
  let inSchool = (_x: number, _z: number) => false;
  let aiPath: { x: number; z: number }[] = [];

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), grass);
  geos.push(ground.geometry);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);

  if (course === "skill") {
    spawn = { x: 0, z: 38, yaw: 0 };
    buildSkill();
  } else {
    spawn = { x: LANE, z: 142, yaw: 0 };
    buildCity();
  }

  function buildCity() {
    const roadItems: Parameters<typeof mergeBoxes>[0] = [];
    const walkItems: Parameters<typeof mergeBoxes>[0] = [];
    const whiteItems: Parameters<typeof mergeBoxes>[0] = [];
    const yellowItems: Parameters<typeof mergeBoxes>[0] = [];
    const extent = 148;
    const rw = ROAD_HALF * 2;

    for (const g of GRID) {
      roadItems.push({ w: rw, h: 0.04, d: extent * 2, x: g, y: 0.01, z: 0 });
      roadItems.push({ w: extent * 2, h: 0.04, d: rw, x: 0, y: 0.012, z: g });
      walkItems.push({
        w: SIDEWALK,
        h: 0.08,
        d: extent * 2,
        x: g - ROAD_HALF - SIDEWALK / 2,
        y: 0.04,
        z: 0,
      });
      walkItems.push({
        w: SIDEWALK,
        h: 0.08,
        d: extent * 2,
        x: g + ROAD_HALF + SIDEWALK / 2,
        y: 0.04,
        z: 0,
      });
      walkItems.push({
        w: extent * 2,
        h: 0.08,
        d: SIDEWALK,
        x: 0,
        y: 0.041,
        z: g - ROAD_HALF - SIDEWALK / 2,
      });
      walkItems.push({
        w: extent * 2,
        h: 0.08,
        d: SIDEWALK,
        x: 0,
        y: 0.041,
        z: g + ROAD_HALF + SIDEWALK / 2,
      });
      whiteItems.push({ w: 0.12, h: 0.03, d: extent * 2, x: g - ROAD_HALF + 0.18, y: 0.04, z: 0 });
      whiteItems.push({ w: 0.12, h: 0.03, d: extent * 2, x: g + ROAD_HALF - 0.18, y: 0.04, z: 0 });
      whiteItems.push({ w: extent * 2, h: 0.03, d: 0.12, x: 0, y: 0.041, z: g - ROAD_HALF + 0.18 });
      whiteItems.push({ w: extent * 2, h: 0.03, d: 0.12, x: 0, y: 0.041, z: g + ROAD_HALF - 0.18 });
    }

    for (const ix of GRID) {
      for (const iz of GRID) {
        intersections.push({ x: ix, z: iz });
        // stop lines
        whiteItems.push({ w: rw - 0.4, h: 0.04, d: 0.42, x: ix, y: 0.045, z: iz - ROAD_HALF - 0.6 });
        whiteItems.push({ w: rw - 0.4, h: 0.04, d: 0.42, x: ix, y: 0.045, z: iz + ROAD_HALF + 0.6 });
        whiteItems.push({ w: 0.42, h: 0.04, d: rw - 0.4, x: ix - ROAD_HALF - 0.6, y: 0.045, z: iz });
        whiteItems.push({ w: 0.42, h: 0.04, d: rw - 0.4, x: ix + ROAD_HALF + 0.6, y: 0.045, z: iz });
        // zebra
        for (let k = -3; k <= 3; k++) {
          whiteItems.push({ w: 0.45, h: 0.035, d: 2.2, x: ix + k * 0.9, y: 0.046, z: iz - ROAD_HALF - 1.7 });
          whiteItems.push({ w: 0.45, h: 0.035, d: 2.2, x: ix + k * 0.9, y: 0.046, z: iz + ROAD_HALF + 1.7 });
          whiteItems.push({ w: 2.2, h: 0.035, d: 0.45, x: ix - ROAD_HALF - 1.7, y: 0.046, z: iz + k * 0.9 });
          whiteItems.push({ w: 2.2, h: 0.035, d: 0.45, x: ix + ROAD_HALF + 1.7, y: 0.046, z: iz + k * 0.9 });
        }
      }
    }

    // dashed yellow center
    for (const g of GRID) {
      for (let s = -extent; s < extent; s += 8) {
        const onIsect = GRID.some((iz) => Math.abs(s - iz) < ROAD_HALF + 2);
        if (onIsect) continue;
        yellowItems.push({ w: 0.14, h: 0.03, d: 3.2, x: g, y: 0.05, z: s });
        yellowItems.push({ w: 3.2, h: 0.03, d: 0.14, x: s, y: 0.051, z: g });
      }
    }

    group.add(mergeBoxes(roadItems, asphalt));
    group.add(mergeBoxes(walkItems, sidewalk));
    group.add(mergeBoxes(whiteItems, lineW));
    group.add(mergeBoxes(yellowItems, lineY));

    asphaltMap.repeat.set(2, 24);
    asphaltMap.wrapS = asphaltMap.wrapT = THREE.RepeatWrapping;

    // buildings in blocks
    const buildingGeos: THREE.BoxGeometry[][] = buildingMats.map(() => []);
    for (let i = 0; i < GRID.length - 1; i++) {
      for (let j = 0; j < GRID.length - 1; j++) {
        const x0 = GRID[i] + ROAD_HALF + SIDEWALK + 2.2;
        const x1 = GRID[i + 1] - ROAD_HALF - SIDEWALK - 2.2;
        const z0 = GRID[j] + ROAD_HALF + SIDEWALK + 2.2;
        const z1 = GRID[j + 1] - ROAD_HALF - SIDEWALK - 2.2;
        const gap = 3.2;
        const cols = 2;
        const rows = 2;
        const bw = (x1 - x0 - gap) / cols;
        const bd = (z1 - z0 - gap) / rows;
        for (let cx = 0; cx < cols; cx++) {
          for (let cz = 0; cz < rows; cz++) {
            const seed = (i * 17 + j * 9 + cx * 3 + cz) % 5;
            const h = 10 + ((i * 5 + j * 7 + cx + cz * 3) % 14);
            const x = x0 + cx * (bw + gap) + bw / 2;
            const z = z0 + cz * (bd + gap) + bd / 2;
            const w = bw * (0.82 + (seed % 3) * 0.06);
            const d = bd * (0.8 + (seed % 2) * 0.08);
            const g = new THREE.BoxGeometry(w, h, d);
            g.translate(x, h / 2, z);
            buildingGeos[seed].push(g);
            colliders.push({
              minX: x - w / 2,
              maxX: x + w / 2,
              minZ: z - d / 2,
              maxZ: z + d / 2,
            });
          }
        }
      }
    }
    buildingGeos.forEach((list, idx) => {
      if (!list.length) return;
      const merged = mergeGeometries(list);
      list.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, buildingMats[idx]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
    });

    // trees along sidewalks
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.22, 1.6, 6);
    const leafGeo = new THREE.SphereGeometry(1.15, 8, 6);
    geos.push(trunkGeo, leafGeo);
    const trunkI = new THREE.InstancedMesh(trunkGeo, trunkMat, 160);
    const leafI = new THREE.InstancedMesh(leafGeo, leafMat, 160);
    trunkI.castShadow = true;
    leafI.castShadow = true;
    const dummy = new THREE.Object3D();
    let ti = 0;
    for (const g of GRID) {
      for (let s = -140; s <= 140; s += 18) {
        if (GRID.some((o) => Math.abs(s - o) < 12)) continue;
        const spots = [
          [g - ROAD_HALF - SIDEWALK / 2, s],
          [g + ROAD_HALF + SIDEWALK / 2, s],
          [s, g - ROAD_HALF - SIDEWALK / 2],
          [s, g + ROAD_HALF + SIDEWALK / 2],
        ];
        for (const [tx, tz] of spots) {
          if (ti >= 160) break;
          dummy.position.set(tx, 0.8, tz);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          trunkI.setMatrixAt(ti, dummy.matrix);
          dummy.position.set(tx, 2.2, tz);
          dummy.scale.setScalar(0.85 + (ti % 5) * 0.05);
          dummy.updateMatrix();
          leafI.setMatrixAt(ti, dummy.matrix);
          ti++;
        }
      }
    }
    trunkI.count = ti;
    leafI.count = ti;
    trunkI.instanceMatrix.needsUpdate = true;
    leafI.instanceMatrix.needsUpdate = true;
    group.add(trunkI, leafI);

    // traffic lights
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.6, 8);
    const headGeo = new THREE.BoxGeometry(0.36, 1.05, 0.28);
    const lensGeo = new THREE.SphereGeometry(0.11, 10, 8);
    geos.push(poleGeo, headGeo, lensGeo);
    for (const ix of GRID) {
      for (const iz of GRID) {
        addPole(ix + ROAD_HALF + 1.1, iz + ROAD_HALF + 1.1, Math.PI, "ns");
        addPole(ix - ROAD_HALF - 1.1, iz - ROAD_HALF - 1.1, 0, "ns");
        addPole(ix - ROAD_HALF - 1.1, iz + ROAD_HALF + 1.1, Math.PI / 2, "ew");
        addPole(ix + ROAD_HALF + 1.1, iz - ROAD_HALF - 1.1, -Math.PI / 2, "ew");
      }
    }
    function addPole(x: number, z: number, yaw: number, axis: "ns" | "ew") {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 2.3, z);
      pole.castShadow = true;
      const head = new THREE.Mesh(headGeo, housingMat);
      head.position.set(x, 4.35, z);
      head.rotation.y = yaw;
      const mk = (yOff: number) => {
        const s = new THREE.Mesh(lensGeo, offMat.red);
        const fx = Math.sin(yaw) * 0.16;
        const fz = Math.cos(yaw) * 0.16;
        s.position.set(x + fx, 4.35 + yOff, z + fz);
        group.add(s);
        return s;
      };
      const r = mk(0.32);
      const y = mk(0);
      const g = mk(-0.32);
      r.material = offMat.red;
      y.material = offMat.yellow;
      g.material = offMat.green;
      group.add(pole, head);
      lights.push({ axis, lenses: { r, y, g } });
    }

    // school zone signs as posts near (128, -96)
    inSchool = (x, z) => Math.abs(x - 128) < 10 && z < -48 && z > -140;

    waypoints = [
      { x: 0, z: 128, action: "straight", hint: "직진하세요" },
      { x: 0, z: 64, action: "straight", hint: "교차로 직진" },
      { x: 0, z: 0, action: "left", hint: "좌회전 하세요" },
      { x: 64, z: 0, action: "straight", hint: "직진" },
      { x: 128, z: 0, action: "right", hint: "우회전 하세요" },
      { x: 128, z: -64, action: "straight", limit: 30, hint: "어린이보호구역 · 서행" },
      { x: 128, z: -128, action: "right", hint: "우회전 하세요" },
      { x: 64, z: -128, action: "straight", hint: "직진" },
      { x: 0, z: -128, action: "right", hint: "우회전 하세요" },
      { x: 0, z: -64, action: "straight", hint: "직진" },
      { x: 0, z: 0, action: "left", hint: "좌회전 하세요" },
      { x: -64, z: 0, action: "straight", hint: "직진" },
      { x: -128, z: 0, action: "right", hint: "우회전 하세요" },
      { x: -128, z: 64, action: "straight", hint: "직진" },
      { x: -128, z: 128, action: "right", hint: "우회전 하세요" },
      { x: -64, z: 128, action: "straight", hint: "직진" },
      { x: 0, z: 128, action: "finish", hint: "목적지입니다. 정차하세요" },
    ];

    aiPath = [];
    const ring = 128;
    for (let x = -ring; x <= ring; x += 10) aiPath.push({ x, z: -ring + LANE });
    for (let z = -ring; z <= ring; z += 10) aiPath.push({ x: ring - LANE, z });
    for (let x = ring; x >= -ring; x -= 10) aiPath.push({ x, z: ring - LANE });
    for (let z = ring; z >= -ring; z -= 10) aiPath.push({ x: -ring + LANE, z });
  }

  function buildSkill() {
    const lot = mergeBoxes(
      [{ w: 46, h: 0.05, d: 96, x: 0, y: 0.01, z: -8 }],
      asphalt,
    );
    group.add(lot);
    asphaltMap.repeat.set(8, 16);

    // ramp as three slabs
    const rampMat = asphalt;
    const slabs = [
      { w: 7.2, h: 0.35, d: 8, x: 0, y: 0.35, z: 16, rx: -0.12 },
      { w: 7.2, h: 0.55, d: 6, x: 0, y: 0.85, z: 9, rx: 0 },
      { w: 7.2, h: 0.35, d: 8, x: 0, y: 0.35, z: 2, rx: 0.12 },
    ];
    for (const s of slabs) {
      const g = new THREE.BoxGeometry(s.w, s.h, s.d);
      g.rotateX(s.rx);
      const m = new THREE.Mesh(g, rampMat);
      m.position.set(s.x, s.y, s.z);
      m.receiveShadow = true;
      group.add(m);
      geos.push(g);
    }
    holdZone = { minX: -3.2, maxX: 3.2, minZ: 6.2, maxZ: 11.5 };

    heightAt = (x, z) => {
      if (Math.abs(x) > 3.6) return 0;
      if (z > 20 || z < -2) return 0;
      if (z >= 12 && z <= 20) return ((20 - z) / 8) * 1.05;
      if (z >= 6.5 && z < 12) return 1.05;
      if (z >= -2 && z < 6.5) return ((z + 2) / 8.5) * 1.05;
      return 0;
    };

    // S-curve poles
    const poleG = new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8);
    geos.push(poleG);
    for (let i = 0; i <= 22; i++) {
      const t = i / 22;
      const z = -6 - t * 36;
      const x = Math.sin(t * Math.PI * 2) * 6.5;
      const half = 1.85;
      for (const side of [-1, 1]) {
        const px = x + side * half;
        const body = new THREE.Mesh(poleG, coneMat);
        body.position.set(px, 0.75, z);
        body.castShadow = true;
        group.add(body);
        const ring = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 0.18, 8),
          coneStripe,
        );
        ring.position.set(px, 0.9, z);
        group.add(ring);
        cones.push({ x: px, z, r: 0.22 });
      }
    }

    // parking bay to the right after S
    parkBay = { minX: 6.2, maxX: 8.8, minZ: -52, maxZ: -46.2 };
    const bayItems = [
      { w: 0.12, h: 0.05, d: 5.8, x: 6.2, y: 0.05, z: -49.1 },
      { w: 0.12, h: 0.05, d: 5.8, x: 8.8, y: 0.05, z: -49.1 },
      { w: 2.7, h: 0.05, d: 0.12, x: 7.5, y: 0.05, z: -52 },
      { w: 2.7, h: 0.05, d: 0.12, x: 7.5, y: 0.05, z: -46.2 },
    ];
    group.add(mergeBoxes(bayItems, lineW));

    // school building / office
    const hall = new THREE.Mesh(
      new THREE.BoxGeometry(16, 6, 10),
      buildingMats[0],
    );
    hall.position.set(-16, 3, 28);
    hall.castShadow = true;
    group.add(hall);
    colliders.push({ minX: -24, maxX: -8, minZ: 23, maxZ: 33 });

    waypoints = [
      { x: 0, z: 22, action: "straight", hint: "경사로로 진입하세요" },
      { x: 0, z: 9, action: "hold", hint: "경사로에서 3초 정지" },
      { x: 0, z: -6, action: "straight", hint: "S자 코스로 진입" },
      { x: 0, z: -24, action: "straight", hint: "봉을 건드리지 마세요" },
      { x: 0, z: -44, action: "park", hint: "우측 직각주차" },
      { x: 7.5, z: -49, action: "finish", hint: "주차 후 정차하세요" },
    ];
  }

  function dispose() {
    scene.remove(group);
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && !geos.includes(mesh.geometry)) {
        mesh.geometry.dispose();
      }
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  }

  return {
    group,
    colliders,
    cones,
    intersections,
    waypoints,
    parkBay,
    holdZone,
    spawn,
    heightAt,
    inSchool,
    lights,
    aiPath,
    dispose,
  };
}

export function createSedan(color: number) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.15,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x8aa0b4,
    roughness: 0.2,
    metalness: 0.3,
    transparent: true,
    opacity: 0.55,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.62, 4.15), bodyMat);
  body.position.y = 0.52;
  body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.5, 2.05), bodyMat);
  cabin.position.set(0, 0.95, -0.15);
  cabin.castShadow = true;
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 1.85), glass);
  win.position.set(0, 1.0, -0.15);
  const wheelG = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10);
  wheelG.rotateZ(Math.PI / 2);
  const wheels = [
    [-0.78, 0.32, 1.25],
    [0.78, 0.32, 1.25],
    [-0.78, 0.32, -1.3],
    [0.78, 0.32, -1.3],
  ];
  for (const [x, y, z] of wheels) {
    const w = new THREE.Mesh(wheelG, dark);
    w.position.set(x, y, z);
    g.add(w);
  }
  const lightG = new THREE.MeshStandardMaterial({
    color: 0xffe9b0,
    emissive: 0xffd27a,
    emissiveIntensity: 0.8,
  });
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), lightG);
  const hr = hl.clone();
  hl.position.set(-0.55, 0.52, -2.1);
  hr.position.set(0.55, 0.52, -2.1);
  g.add(body, cabin, win, hl, hr);
  g.userData.mats = [bodyMat, dark, glass, lightG];
  return g;
}

export function createPedestrian() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xd4b8a0, roughness: 0.7 });
  const cloth = new THREE.MeshStandardMaterial({
    color: [0x3a5a7a, 0x5a3a3a, 0x3a5a42, 0x4a4a58][(Math.random() * 4) | 0],
    roughness: 0.8,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.7, 4, 8), cloth);
  body.position.y = 0.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), skin);
  head.position.y = 1.42;
  g.add(body, head);
  g.userData.mats = [skin, cloth];
  return g;
}
