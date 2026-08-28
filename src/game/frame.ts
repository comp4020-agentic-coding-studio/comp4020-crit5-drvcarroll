import { FRAME_HALF_HEIGHT, FRAME_HALF_WIDTH, SHIP_EDGE_MARGIN } from "./constants.ts";
import type { Ship, Vec2 } from "./types.ts";

export { FRAME_HALF_HEIGHT, FRAME_HALF_WIDTH, SHIP_EDGE_MARGIN };

const CLAMP_X = FRAME_HALF_WIDTH - SHIP_EDGE_MARGIN;
const CLAMP_Y = FRAME_HALF_HEIGHT - SHIP_EDGE_MARGIN;

// Bounds the ship inside the frame; zeroes velocity only on a wall touched,
// never on the axis that wasn't (a soft stop, not a bounce --- Decision R3).
export function clampToFrame(ship: Ship): Ship {
  let { x, y } = ship.position;
  let { x: vx, y: vy } = ship.velocity;

  if (x > CLAMP_X) {
    x = CLAMP_X;
    vx = 0;
  } else if (x < -CLAMP_X) {
    x = -CLAMP_X;
    vx = 0;
  }

  if (y > CLAMP_Y) {
    y = CLAMP_Y;
    vy = 0;
  } else if (y < -CLAMP_Y) {
    y = -CLAMP_Y;
    vy = 0;
  }

  return { ...ship, position: { x, y }, velocity: { x: vx, y: vy } };
}

// True when an entity's whole bounding circle has left the frame --- used by
// despawn logic once an entity has fully fallen through.
export function isOutsideFrame(position: Vec2, radius: number): boolean {
  return (
    position.x + radius < -FRAME_HALF_WIDTH ||
    position.x - radius > FRAME_HALF_WIDTH ||
    position.y + radius < -FRAME_HALF_HEIGHT ||
    position.y - radius > FRAME_HALF_HEIGHT
  );
}
