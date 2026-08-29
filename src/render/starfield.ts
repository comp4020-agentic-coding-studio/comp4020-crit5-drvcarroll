import { BufferAttribute, BufferGeometry, Points, PointsMaterial, Scene } from "three";
import { nextRange, type RngState } from "../game/rng.ts";
import { PALETTE } from "./materials.ts";

// Big enough to cover the widest responsive frustum orthoBounds can ask
// for, so a wide viewport never shows the field's edge.
const HALF_W = 1800;
const HALF_H = 1400;
const SPAN_Z = HALF_H * 2;
const DEPTH_Y = -260; // below the ground plane: farther from the top-down camera

// Three depth layers. Parallax is a fraction of the world's scroll speed,
// so the field reads as distant sky rather than as more falling debris.
const LAYERS = [
  { count: 320, size: 1.6, color: PALETTE.starFar, parallax: 0.1, opacity: 0.55 },
  { count: 170, size: 2.4, color: PALETTE.starMid, parallax: 0.22, opacity: 0.75 },
  { count: 70, size: 3.4, color: PALETTE.starNear, parallax: 0.4, opacity: 1 },
];

// Seeded so a reload draws the same sky --- render-only, so it keeps its
// own RNG thread and never touches state.rng (which drives spawns).
const STAR_SEED: RngState = { seed: 20260829 };

interface Layer {
  points: Points<BufferGeometry, PointsMaterial>;
  baseZ: Float32Array;
  parallax: number;
}

// Wraps a z back into [-HALF_H, HALF_H) --- per star rather than per layer,
// which is what lets one finite field scroll forever without a seam.
function wrapZ(z: number): number {
  return ((((z + HALF_H) % SPAN_Z) + SPAN_Z) % SPAN_Z) - HALF_H;
}

export function createStarField(scene: Scene): (scrollDistance: number) => void {
  let rng = STAR_SEED;
  const roll = (min: number, max: number): number => {
    const [value, next] = nextRange(rng, min, max);
    rng = next;
    return value;
  };

  const layers: Layer[] = LAYERS.map(({ count, size, color, parallax, opacity }) => {
    const positions = new Float32Array(count * 3);
    const baseZ = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = roll(-HALF_W, HALF_W);
      positions[i * 3 + 1] = DEPTH_Y;
      baseZ[i] = roll(-HALF_H, HALF_H);
      positions[i * 3 + 2] = baseZ[i];
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));

    const points = new Points(
      geometry,
      // sizeAttenuation off: under an orthographic camera distance-scaled
      // point sizes have no meaning, and pixel-sized stars stay crisp.
      new PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity }),
    );
    points.frustumCulled = false;
    scene.add(points);

    return { points, baseZ, parallax };
  });

  // The world drifts toward -y in game space, which toWorld maps to +z ---
  // so the sky advances the same way, just slower.
  return (scrollDistance) => {
    for (const { points, baseZ, parallax } of layers) {
      const attribute = points.geometry.getAttribute("position") as BufferAttribute;
      const array = attribute.array as Float32Array;
      const offset = scrollDistance * parallax;
      for (let i = 0; i < baseZ.length; i++) array[i * 3 + 2] = wrapZ(baseZ[i] + offset);
      attribute.needsUpdate = true;
    }
  };
}
