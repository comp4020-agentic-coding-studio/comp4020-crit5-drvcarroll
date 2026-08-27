import { LANDING_SPEED_THRESHOLD } from "./constants.ts";
import type { Planet, Ship } from "./types.ts";
import { distance, length } from "./vector.ts";

// The ship is treated as a point for landing/hit purposes: what matters is
// whether its position has reached inside the other body's radius.
export function circlesOverlap(aPos: { x: number; y: number }, aR: number, bPos: { x: number; y: number }, bR: number): boolean {
  return distance(aPos, bPos) <= aR + bR;
}

// "Gently" touching down: inside the planet's radius, below the speed a
// landing can survive.
export function isGentleLanding(ship: Ship, planet: Planet): boolean {
  return (
    circlesOverlap(ship.position, 0, planet.position, planet.radius) &&
    length(ship.velocity) <= LANDING_SPEED_THRESHOLD
  );
}
