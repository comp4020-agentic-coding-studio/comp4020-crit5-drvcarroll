import {
  GRAVITY_MAX_ACCEL,
  GRAVITY_RADIUS_MULT,
  GRAVITY_SOFTENING,
  GRAVITY_STRENGTH,
} from "./constants.ts";
import type { Planet, Ship } from "./types.ts";
import { add, distance, scale, subtract } from "./vector.ts";

// Pure per-tick gravity: pulls the ship's velocity toward every planet
// whose well it is inside, summed vectorially. Never touches position
// directly --- applyInput integrates position from the velocity this
// returns, so there is only ever one place position advances (Decision 11).
export function applyGravity(ship: Ship, planets: Planet[], dt: number): Ship {
  let velocity = ship.velocity;

  for (const planet of planets) {
    const toPlanet = subtract(planet.position, ship.position);
    const dist = distance(ship.position, planet.position);
    const wellRadius = planet.radius * GRAVITY_RADIUS_MULT;
    if (dist > wellRadius) continue;

    const distSq = dist * dist;
    const accelMag = Math.min(
      (GRAVITY_STRENGTH * planet.radius) / (distSq + GRAVITY_SOFTENING),
      GRAVITY_MAX_ACCEL,
    );
    const direction = dist > 0 ? scale(toPlanet, 1 / dist) : { x: 0, y: 0 };
    velocity = add(velocity, scale(direction, accelMag * dt));
  }

  return { ...ship, velocity };
}
