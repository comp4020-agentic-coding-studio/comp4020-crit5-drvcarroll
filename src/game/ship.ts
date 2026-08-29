import {
  AIR_DRAIN_RATE,
  FUEL_PER_ENGINE_SECOND,
  ROTATE_SPEED,
  THRUST_ACCEL,
} from "./constants.ts";
import { clampToFrame } from "./frame.ts";
import type { Input, Ship } from "./types.ts";
import { add, fromAngle, scale } from "./vector.ts";

// Integrates one tick: rotation from A/D, and thrust from W along the
// current heading --- the only force the pilot has. Velocity is never
// damped, because space has no friction (Decision R4): shedding speed
// means rotating to face back along the velocity and burning. Result is
// clamped to the frame (Decision R3).
//
// toWorld() mirrors the Y axis for rendering, which flips the on-screen
// sense of rotation --- so rotateLeft increases heading here, even though
// that reads as ccw in plain game-space math.
export function applyInput(ship: Ship, input: Input, dt: number): Ship {
  const turn = (input.rotateLeft ? 1 : 0) - (input.rotateRight ? 1 : 0);
  const heading = ship.heading + turn * ROTATE_SPEED * dt;

  const thrusting = input.thrust && ship.fuel > 0;

  let velocity = ship.velocity;
  // The clock a do-nothing pilot can't stop (C2). Unlike fuel, no input
  // slows it and no input speeds it up.
  const air = Math.max(0, ship.air - AIR_DRAIN_RATE * dt);
  // Fuel is spent only by the engine --- holding still costs nothing.
  const fuel = thrusting ? Math.max(0, ship.fuel - FUEL_PER_ENGINE_SECOND * dt) : ship.fuel;

  if (thrusting) velocity = add(velocity, fromAngle(heading, THRUST_ACCEL * dt));

  const position = add(ship.position, scale(velocity, dt));
  const fireCooldown = Math.max(0, ship.fireCooldown - dt);

  return clampToFrame({ ...ship, heading, velocity, air, fuel, position, thrusting, fireCooldown });
}
