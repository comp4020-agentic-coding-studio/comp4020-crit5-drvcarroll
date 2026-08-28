import { Mesh, MeshStandardMaterial, Scene, SphereGeometry } from "three";
import type { Bullet } from "../game/types.ts";
import { BULLET_COLOR } from "./render-constants.ts";
import { toWorld } from "./frame-to-world.ts";
import { MeshPool } from "./pool.ts";

const HOVER_HEIGHT = 6;

export function createBulletPool(scene: Scene): MeshPool<Mesh> {
  return new MeshPool(scene, () => new Mesh(new SphereGeometry(4, 8, 8), new MeshStandardMaterial({ color: BULLET_COLOR })));
}

export function syncBullets(pool: MeshPool<Mesh>, bullets: readonly Bullet[]): void {
  pool.sync(bullets, (mesh, bullet) => {
    const [worldX, worldZ] = toWorld(bullet.position.x, bullet.position.y);
    mesh.position.set(worldX, HOVER_HEIGHT, worldZ);
  });
}
