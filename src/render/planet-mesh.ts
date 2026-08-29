import {
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  Scene,
} from "three";
import type { Planet } from "../game/types.ts";
import {
  LANDING_RING_COLOR,
  PLANET_COLONIZED_LIGHTNESS,
  PLANET_HUE_STEP,
  PLANET_LIGHTNESS,
  PLANET_SATURATION,
} from "./render-constants.ts";
import { toWorld } from "./frame-to-world.ts";
import { MeshPool } from "./pool.ts";

// Ring radii are multiples of the planet radius (the group is scaled by
// it), so the halo clears the silhouette at every planet size.
const RING_INNER = 1.3;
const RING_OUTER = 1.44;
const RING_PULSE_HZ = 0.75;
const RING_PULSE_SCALE = 0.07; // +/- fraction of ring radius
const RING_OPACITY_MIN = 0.3;
const RING_OPACITY_MAX = 0.75;

// The body plus its landing halo, kept as named fields rather than
// children[0]/[1] so the sync below reads as what it colours.
interface PlanetView extends Group {
  body: Mesh<IcosahedronGeometry, MeshStandardMaterial>;
  ring: Mesh<RingGeometry, MeshBasicMaterial>;
}

// Unit-radius low-poly sphere, uniformly scaled per planet --- reads as
// round from any camera angle, unlike a flat-topped cylinder (Decision 8).
// The ring lies in the ground plane facing the top-down camera: a pulsing
// "land here" halo, the one affordance that says a planet is still unspent.
export function createPlanetPool(scene: Scene): MeshPool<PlanetView> {
  return new MeshPool(scene, () => {
    const group = new Group() as PlanetView;

    group.body = new Mesh(new IcosahedronGeometry(1, 1), new MeshStandardMaterial());
    group.ring = new Mesh(
      new RingGeometry(RING_INNER, RING_OUTER, 64),
      new MeshBasicMaterial({
        color: LANDING_RING_COLOR,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    group.ring.rotation.x = -Math.PI / 2;

    group.add(group.body, group.ring);
    return group;
  });
}

// Deterministic per-id hue via a fixed golden-angle step (Decision 9):
// colour carries identity, not decoration, once several planets are visible
// at once under the wider responsive frustum.
function planetHue(id: number): number {
  return (id * PLANET_HUE_STEP) % 1;
}

export function syncPlanets(pool: MeshPool<PlanetView>, planets: readonly Planet[], elapsed: number): void {
  // One phase for every ring on screen: they breathe together, which reads
  // as a signal rather than as several objects idly animating.
  const pulse = Math.sin(elapsed * RING_PULSE_HZ * Math.PI * 2);

  pool.sync(planets, (view, planet) => {
    const [worldX, worldZ] = toWorld(planet.position.x, planet.position.y);
    view.position.set(worldX, 0, worldZ);
    view.scale.setScalar(planet.radius);
    view.body.rotation.y = planet.spin * elapsed;
    view.body.material.color.setHSL(
      planetHue(planet.id),
      PLANET_SATURATION,
      planet.colonized ? PLANET_COLONIZED_LIGHTNESS : PLANET_LIGHTNESS,
    );

    view.ring.visible = !planet.colonized;
    view.ring.scale.setScalar(1 + pulse * RING_PULSE_SCALE);
    view.ring.material.opacity =
      RING_OPACITY_MIN + ((pulse + 1) / 2) * (RING_OPACITY_MAX - RING_OPACITY_MIN);
  });
}
