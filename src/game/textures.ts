import * as THREE from "three";

export function canvasTex(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d");
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export function asphaltTex() {
  const t = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#3b3d42";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const v = 48 + Math.random() * 44;
      ctx.fillStyle = `rgb(${v},${v},${v + 3})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function facadeTex(base: string, cap: string) {
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = cap;
    ctx.fillRect(0, 0, w, 22);
    ctx.fillRect(0, h - 20, w, 20);
    const floors = 11;
    const cols = 5;
    const fw = w / cols;
    const fh = (h - 42) / floors;
    for (let y = 0; y < floors; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = ((x * 13 + y * 7) % 10) > 6;
        ctx.fillStyle = lit ? "#e2c48a" : "#1a222c";
        ctx.fillRect(x * fw + 9, 26 + y * fh + 6, fw - 18, fh - 12);
      }
    }
  });
}

export function grassTex() {
  const t = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#3e4c3c";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 800; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "#4a5a44" : "#354434";
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(18, 18);
  return t;
}
