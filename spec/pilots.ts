// The five scripted pilots (§7.2). Each is a plain Pilot function.
import { length, subtract } from "../src/game/vector.ts";
import { nextFloat, type RngState } from "../src/game/rng.ts";
import type { GameState, Input, Planet } from "../src/game/types.ts";
import type { Pilot } from "./harness.ts";

export const NO_INPUT: Input = {
  rotateLeft: false,
  rotateRight: false,
  thrust: false,
  retro: false,
  fire: false,
};

export const idlePilot: Pilot = () => NO_INPUT;

export const thrustPilot: Pilot = () => ({ ...NO_INPUT, thrust: true });

// WASD convention: W thrust, A rotateLeft, D rotateRight, S retro.
export const wallPilot: Pilot = () => ({ ...NO_INPUT, thrust: true, rotateRight: true });

// Every planet drifts down at the same rate, so the one with the lowest
// y is always the one closest to falling out the bottom --- picking by
// urgency, not raw distance, is what lets the pilot juggle more than one
// planet in flight at once without letting an older one expire (R8
// finding: nearest-by-distance let a second planet arrive, get chased
// first for being closer, and the first one fell out of frame unlanded).
function mostUrgentUncolonizedPlanet(state: GameState): Planet | null {
  let best: Planet | null = null;
  for (const planet of state.planets) {
    if (planet.colonized) continue;
    if (!best || planet.position.y < best.position.y) best = planet;
  }
  return best;
}

// Smallest angle from `from` to `to`, in (-PI, PI].
function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// "Facing" tolerance for the P-controller's rotate/thrust decision.
const HEADING_TOLERANCE = 0.15;
// Per-axis proportional gain converting a position gap into a closing
// velocity request --- a steering tunable, not a game one.
const CLOSING_GAIN = 1.2; // s^-1
// Per-axis cap on that closing-velocity request, on top of the planet's
// own drift. Capped independently per axis (not as one shared direction
// budget) so a large vertical gap can never starve lateral correction ---
// the failure mode that let a planet exit the frame while the ship was
// still closing sideways (R8 finding).
const MAX_CLOSING_SPEED = 260;
// Once the ship is within this of matching the planet's velocity, coast:
// isGentleLanding only needs LANDING_SPEED_THRESHOLD, this is well under it.
const VELOCITY_MATCH_TOLERANCE = 6;

// Proportional controller: aims not at the planet's *position* but at a
// closing velocity on top of the planet's own drift (R5/R8 finding ---
// SCROLL_SPEED_BASE already exceeds LANDING_SPEED_THRESHOLD, so a ship
// that only points at the planet and thrusts arrives too fast to land).
// x and y closing speed are computed and capped independently, so by the
// time the ship reaches the surface it is already moving with the
// planet, not just toward it --- and cut thrust as soon as it is.
export const seekPilot: Pilot = (state) => {
  const target = mostUrgentUncolonizedPlanet(state);
  if (!target) return NO_INPUT;

  const clamp = (v: number) => Math.max(-MAX_CLOSING_SPEED, Math.min(MAX_CLOSING_SPEED, v));
  const planetVelocity = { x: target.driftX, y: -state.scroll.speed };
  const desiredVelocity = {
    x: planetVelocity.x + clamp((target.position.x - state.ship.position.x) * CLOSING_GAIN),
    y: planetVelocity.y + clamp((target.position.y - state.ship.position.y) * CLOSING_GAIN),
  };

  const velocityError = subtract(desiredVelocity, state.ship.velocity);
  const errorMag = length(velocityError);
  if (errorMag <= VELOCITY_MATCH_TOLERANCE) return NO_INPUT; // already matched --- coast.

  const desiredHeading = Math.atan2(velocityError.y, velocityError.x);
  const delta = angleDelta(state.ship.heading, desiredHeading);
  const facing = Math.abs(delta) <= HEADING_TOLERANCE;

  return {
    ...NO_INPUT,
    rotateLeft: delta > HEADING_TOLERANCE,
    rotateRight: delta < -HEADING_TOLERANCE,
    thrust: facing,
  };
};

// Uniformly random input, driven by its own RNG (never state.rng, which
// is the game's spawn RNG --- mixing the two would make spawns pilot-
// dependent). The pilot closes over its own thread of RngState.
export function createPanicPilot(seed: number): Pilot {
  let rng: RngState = { seed };
  const roll = (): boolean => {
    const [value, next] = nextFloat(rng);
    rng = next;
    return value < 0.5;
  };
  return () => ({
    rotateLeft: roll(),
    rotateRight: roll(),
    thrust: roll(),
    retro: roll(),
    fire: roll(),
  });
}
