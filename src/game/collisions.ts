import { LANDING_SPEED_THRESHOLD } from "./constants.ts";
import type { Planet, Ship } from "./types.ts";
import { add, distance, length, scale, subtract, type Vec2 } from "./vector.ts";

// Tolerance for a surface contact resolvePlanetContact just placed exactly
// at aR+bR --- normalizing then rescaling can round a hair past the radius.
const OVERLAP_EPSILON = 1e-6;

// The ship is treated as a point for landing/hit purposes: what matters is
// whether its position has reached inside the other body's radius.
export function circlesOverlap(aPos: { x: number; y: number }, aR: number, bPos: { x: number; y: number }, bR: number): boolean {
  return distance(aPos, bPos) <= aR + bR + OVERLAP_EPSILON;
}

// "Gently" touching down: inside the planet's radius, below the speed a
// landing can survive --- measured against the planet's own drift (R5), so
// a ship holding still isn't punished for the world scrolling under it.
export function isGentleLanding(ship: Ship, planet: Planet, planetVelocity: Vec2): boolean {
  return (
    circlesOverlap(ship.position, 0, planet.position, planet.radius) &&
    length(subtract(ship.velocity, planetVelocity)) <= LANDING_SPEED_THRESHOLD
  );
}

// Outward direction for contact, for the degenerate case where the ship's
// position exactly coincides with the planet's centre (undefined direction).
function contactDirection(ship: Ship, planet: Planet): Vec2 {
  const toShip = subtract(ship.position, planet.position);
  const dist = length(toShip);
  if (dist > 0) return scale(toShip, 1 / dist);

  const speed = length(ship.velocity);
  if (speed > 0) return scale(ship.velocity, 1 / speed);

  return { x: 0, y: 1 }; // stable fallback: straight "up" in frame space
}

// Solid contact, same shape as clampToFrame (frame.ts): pushes the ship to
// the surface and zeroes only the radial velocity component, unconditionally
// (Decision R14). What happens on top of the stop is R7's job, not this one.
export function resolvePlanetContact(ship: Ship, planet: Planet, planetVelocity: Vec2): Ship {
  if (!circlesOverlap(ship.position, 0, planet.position, planet.radius)) return ship;

  const direction = contactDirection(ship, planet);
  const position = add(planet.position, scale(direction, planet.radius));

  const relativeVelocity = subtract(ship.velocity, planetVelocity);
  const radialSpeed = relativeVelocity.x * direction.x + relativeVelocity.y * direction.y;
  const tangentialVelocity = subtract(relativeVelocity, scale(direction, radialSpeed));
  const velocity = add(tangentialVelocity, planetVelocity);

  return { ...ship, position, velocity };
}
