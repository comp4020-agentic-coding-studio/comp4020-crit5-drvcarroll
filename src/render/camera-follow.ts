import type { OrthographicCamera } from "three";
import type { Ship } from "../game/types.ts";
import { CAMERA_BACK_OFFSET, CAMERA_HEIGHT, CAMERA_LOOK_AHEAD } from "./render-constants.ts";

// Game (x, y) maps to world (x, 0, -y): increasing game.y is the scroll
// direction, and it moves the world toward -Z.
export function toWorld(gameX: number, gameY: number): [number, number] {
  return [gameX, -gameY];
}

// The world holds still; the camera trails behind and above the ship along
// Z/Y --- this is the whole "scroll" effect. It looks CAMERA_LOOK_AHEAD past
// the ship, not straight at it, so more of what's coming stays framed than
// what's already passed (the opening-frame affordance this serves).
export function followShip(camera: OrthographicCamera, ship: Ship): void {
  const [worldX, worldZ] = toWorld(ship.position.x, ship.position.y);
  const lookZ = worldZ - CAMERA_LOOK_AHEAD;
  camera.position.set(worldX, CAMERA_HEIGHT, lookZ + CAMERA_BACK_OFFSET);
  camera.lookAt(worldX, 0, lookZ);
}
