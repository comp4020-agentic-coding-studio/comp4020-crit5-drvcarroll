import { DodecahedronGeometry, Mesh, MeshStandardMaterial, Scene } from "three";
import type { Asteroid } from "../game/types.ts";
import { ASTEROID_COLOR } from "./render-constants.ts";
import { toWorld } from "./camera-follow.ts";
import { MeshPool } from "./pool.ts";

const HOVER_HEIGHT = 6; // lifted slightly above the ground plane

export function createAsteroidPool(scene: Scene): MeshPool<Mesh> {
  return new MeshPool(scene, () =>
    new Mesh(new DodecahedronGeometry(1, 0), new MeshStandardMaterial({ color: ASTEROID_COLOR })),
  );
}

export function syncAsteroids(pool: MeshPool<Mesh>, asteroids: readonly Asteroid[]): void {
  pool.sync(asteroids, (mesh, asteroid) => {
    const [worldX, worldZ] = toWorld(asteroid.position.x, asteroid.position.y);
    mesh.position.set(worldX, HOVER_HEIGHT, worldZ);
    mesh.scale.setScalar(asteroid.radius);
  });
}
