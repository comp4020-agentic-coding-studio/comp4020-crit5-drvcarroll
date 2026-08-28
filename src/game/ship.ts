import {
  FUEL_DRAIN_PASSIVE,
  FUEL_PER_THRUST_TICK,
  RETRO_ACCEL,
  ROTATE_SPEED,
  SHIP_DAMPING,
  THRUST_ACCEL,
} from "./constants.ts";
import { clampToFrame } from "./frame.ts";
import type { Input, Ship } from "./types.ts";
import { add, fromAngle, scale } from "./vector.ts";

// Integrates one tick: rotation from A/D, forward thrust from W along the
// current heading, retro-thrust from S along heading + PI (a weaker thrust
// applied backward, not an instant reverse), exponential velocity damping so
// the ship is controllable in a bounded frame (Decision R4), then clamps the
// result to the frame (Decision R3).
//
// toWorld() mirrors the Y axis for rendering, which flips the on-screen
// sense of rotation --- so rotateLeft increases heading here, even though
// that reads as ccw in plain game-space math.
export function applyInput(ship: Ship, input: Input, dt: number): Ship {
  const turn = (input.rotateLeft ? 1 : 0) - (input.rotateRight ? 1 : 0);
  const heading = ship.heading + turn * ROTATE_SPEED * dt;

  const thrusting = input.thrust && ship.fuel > 0;
  const retroing = input.retro && ship.fuel > 0;

  let velocity = ship.velocity;
  // Ambient drain runs whatever the input --- the clock a do-nothing
  // pilot can't stop (C2).
  let fuel = Math.max(0, ship.fuel - FUEL_DRAIN_PASSIVE * dt);

  if (thrusting) {
    velocity = add(velocity, fromAngle(heading, THRUST_ACCEL * dt));
    fuel = Math.max(0, fuel - FUEL_PER_THRUST_TICK * dt);
  }
  if (retroing) {
    velocity = add(velocity, fromAngle(heading + Math.PI, RETRO_ACCEL * dt));
    fuel = Math.max(0, fuel - FUEL_PER_THRUST_TICK * dt);
  }

  // Continuous-time decay: exp(-k*dt) so repeated small steps compose
  // exactly like one larger step of the same total dt.
  velocity = scale(velocity, Math.exp(-SHIP_DAMPING * dt));

  const position = add(ship.position, scale(velocity, dt));

  return clampToFrame({ ...ship, heading, velocity, fuel, position, thrusting });
}
