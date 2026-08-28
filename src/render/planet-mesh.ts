import { IcosahedronGeometry, Mesh, MeshStandardMaterial, Scene } from "three";
import type { Planet } from "../game/types.ts";
import {
  PLANET_COLONIZED_LIGHTNESS,
  PLANET_HUE_STEP,
  PLANET_LIGHTNESS,
  PLANET_SATURATION,
} from "./render-constants.ts";
import { toWorld } from "./frame-to-world.ts";
import { MeshPool } from "./pool.ts";

// Unit-radius low-poly sphere, uniformly scaled per planet --- reads as
// round from any camera angle, unlike a flat-topped cylinder (Decision 8).
export function createPlanetPool(scene: Scene): MeshPool<Mesh> {
  return new MeshPool(scene, () =>
    new Mesh(new IcosahedronGeometry(1, 1), new MeshStandardMaterial()),
  );
}

// Deterministic per-id hue via a fixed golden-angle step (Decision 9):
// colour carries identity, not decoration, once several planets are visible
// at once under the wider responsive frustum.
function planetHue(id: number): number {
  return (id * PLANET_HUE_STEP) % 1;
}

export function syncPlanets(pool: MeshPool<Mesh>, planets: readonly Planet[]): void {
  pool.sync(planets, (mesh, planet) => {
    const [worldX, worldZ] = toWorld(planet.position.x, planet.position.y);
    mesh.position.set(worldX, 0, worldZ);
    mesh.scale.setScalar(planet.radius);
    (mesh.material as MeshStandardMaterial).color.setHSL(
      planetHue(planet.id),
      PLANET_SATURATION,
      planet.colonized ? PLANET_COLONIZED_LIGHTNESS : PLANET_LIGHTNESS,
    );
  });
}
