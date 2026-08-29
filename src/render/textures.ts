import { CanvasTexture } from "three";

// Procedural, zero-asset textures (§5.3 rule 3, Decision R8): each is drawn
// to an offscreen canvas once and cached, never per frame or per instance.
// Only called from browser-run render code, never at module load, so a
// document-less test run never touches `document`.

function drawToCanvas(size: number, draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");
  draw(ctx);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

let glow: CanvasTexture | null = null;
let starDot: CanvasTexture | null = null;
let shadow: CanvasTexture | null = null;

// Soft radial glow: the additive halo behind everything the player owns
// (§5.3 rule 1). Three gradient stops give it a falloff, not a hard disc.
export function createGlowTexture(): CanvasTexture {
  if (!glow) {
    glow = drawToCanvas(128, (ctx) => {
      const r = 64;
      const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.4, "rgba(255,255,255,0.5)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    });
  }
  return glow;
}

// Small, tight falloff so it reads as a point at starfield distance rather
// than a visible soft square (§5.4).
export function createStarDotTexture(): CanvasTexture {
  if (!starDot) {
    starDot = drawToCanvas(32, (ctx) => {
      const r = 16;
      const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.25, "rgba(255,255,255,0.9)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    });
  }
  return starDot;
}

// A soft dark blob, circular here --- the ellipse every solid object casts
// (§5.3 rule 3) comes from a non-uniform scale on the shadow-plane mesh
// that consumes this texture, not from the texture itself.
export function createShadowTexture(): CanvasTexture {
  if (!shadow) {
    shadow = drawToCanvas(128, (ctx) => {
      const r = 64;
      const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
      gradient.addColorStop(0, "rgba(0,0,0,0.55)");
      gradient.addColorStop(0.7, "rgba(0,0,0,0.25)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    });
  }
  return shadow;
}
