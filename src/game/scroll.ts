import {
  SCROLL_SPEED_BASE,
  SCROLL_SPEED_MAX,
  SCROLL_SPEED_PER_LEVEL,
} from "./constants.ts";
import type { Scroll, Vec2 } from "./types.ts";

// The world's drift speed for a given level index: increases per level,
// capped so late levels stay flyable (BUILD_PLAN.md 5.5).
export function scrollSpeedForLevel(index: number): number {
  return Math.min(
    SCROLL_SPEED_BASE + index * SCROLL_SPEED_PER_LEVEL,
    SCROLL_SPEED_MAX,
  );
}

// Accumulates odometer distance at the scroll's current speed. Speed is
// recomputed by the caller on level advance, not every tick.
export function advanceScroll(scroll: Scroll, dt: number): Scroll {
  return { ...scroll, distance: scroll.distance + scroll.speed * dt };
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
