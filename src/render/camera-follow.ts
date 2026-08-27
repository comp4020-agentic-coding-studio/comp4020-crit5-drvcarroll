import type { OrthographicCamera } from "three";
import type { Ship } from "../game/types.ts";
import { CAMERA_BACK_OFFSET, CAMERA_HEIGHT } from "./render-constants.ts";

// Game (x, y) maps to world (x, 0, -y): increasing game.y is the scroll
// direction, and it moves the world toward -Z.
export function toWorld(gameX: number, gameY: number): [number, number] {
  return [gameX, -gameY];
}

// The world holds still; the camera trails behind and above the ship along
// Z/Y and always looks at ship level --- this is the whole "scroll" effect.
export function followShip(camera: OrthographicCamera, ship: Ship): void {
  const [worldX, worldZ] = toWorld(ship.position.x, ship.position.y);
  camera.position.set(worldX, CAMERA_HEIGHT, worldZ + CAMERA_BACK_OFFSET);
  camera.lookAt(worldX, 0, worldZ);
}
