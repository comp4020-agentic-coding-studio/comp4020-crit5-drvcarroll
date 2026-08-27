import { FUEL_PER_THRUST_TICK, ROTATE_SPEED, THRUST_ACCEL } from "./constants.ts";
import type { Input, Ship } from "./types.ts";
import { add, fromAngle, scale } from "./vector.ts";

// Integrates one tick of true Newtonian motion: rotation from A/D, thrust
// from W along the current heading. No drag term anywhere --- slowing down
// means rotating ~180deg and thrusting the other way.
//
// toWorld() mirrors the Y axis for rendering, which flips the on-screen
// sense of rotation --- so rotateLeft increases heading here, even though
// that reads as ccw in plain game-space math.
export function applyInput(ship: Ship, input: Input, dt: number): Ship {
  const turn = (input.rotateLeft ? 1 : 0) - (input.rotateRight ? 1 : 0);
  const heading = ship.heading + turn * ROTATE_SPEED * dt;

  const canThrust = input.thrust && ship.fuel > 0;
  const velocity = canThrust
    ? add(ship.velocity, fromAngle(heading, THRUST_ACCEL * dt))
    : ship.velocity;
  const fuel = canThrust ? Math.max(0, ship.fuel - FUEL_PER_THRUST_TICK * dt) : ship.fuel;

  const position = add(ship.position, scale(velocity, dt));

  return { ...ship, heading, velocity, fuel, position };
}
