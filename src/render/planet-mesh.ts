import { CylinderGeometry, Mesh, MeshStandardMaterial, Scene } from "three";
import type { Planet } from "../game/types.ts";
import { PLANET_COLONIZED_COLOR, PLANET_COLOR } from "./render-constants.ts";
import { toWorld } from "./camera-follow.ts";
import { MeshPool } from "./pool.ts";

// Unit-radius cylinder, scaled per planet on X/Z only --- the visual
// footprint then matches the collision radius exactly.
export function createPlanetPool(scene: Scene): MeshPool<Mesh> {
  return new MeshPool(scene, () =>
    new Mesh(new CylinderGeometry(1, 1, 12, 24), new MeshStandardMaterial({ color: PLANET_COLOR })),
  );
}

export function syncPlanets(pool: MeshPool<Mesh>, planets: readonly Planet[]): void {
  pool.sync(planets, (mesh, planet) => {
    const [worldX, worldZ] = toWorld(planet.position.x, planet.position.y);
    mesh.position.set(worldX, 0, worldZ);
    mesh.scale.set(planet.radius, 1, planet.radius);
    (mesh.material as MeshStandardMaterial).color.set(
      planet.colonized ? PLANET_COLONIZED_COLOR : PLANET_COLOR,
    );
  });
}
