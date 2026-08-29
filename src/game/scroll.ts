import {
  SCROLL_SPEED_BASE,
  SCROLL_SPEED_GROWTH,
  SCROLL_SPEED_MAX,
} from "./constants.ts";
import type { Scroll, Vec2 } from "./types.ts";

// The world's drift speed at a given odometer distance: the run is endless,
// so speed ramps with distance travelled and caps so a long run stays
// flyable (BUILD_PLAN.md 5.5).
export function scrollSpeedForDistance(distance: number): number {
  return Math.min(
    SCROLL_SPEED_BASE + distance * SCROLL_SPEED_GROWTH,
    SCROLL_SPEED_MAX,
  );
}

// Accumulates odometer distance at the current speed, then re-derives the
// speed the *next* tick will drift at. speed is a cache of the curve above,
// never an independent value.
export function advanceScroll(scroll: Scroll, dt: number): Scroll {
  const distance = scroll.distance + scroll.speed * dt;
  return { distance, speed: scrollSpeedForDistance(distance) };
}

// Drifts every entity's position down by speed*dt --- the world moving
// past a fixed frame. Touches only position; nothing else is read or set.
export function driftEntities<T extends { position: Vec2 }>(
  list: T[],
  dt: number,
  speed: number,
): T[] {
  const dy = speed * dt;
  return list.map((entity) => ({
    ...entity,
    position: { x: entity.position.x, y: entity.position.y - dy },
  }));
}
