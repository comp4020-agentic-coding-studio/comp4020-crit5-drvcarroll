import {
  ASTEROID_ANGLE_SPREAD,
  ASTEROID_MAX_RADIUS,
  ASTEROID_MIN_RADIUS,
  ASTEROID_RATE_GROWTH,
  ASTEROID_RATE_MAX,
  ASTEROID_SPEED_MAX,
  ASTEROID_SPEED_MIN,
  ASTEROID_SPIN_MAX,
  BASE_ASTEROID_RATE,
  FRAME_HALF_HEIGHT,
  FRAME_HALF_WIDTH,
  PLANET_DRIFT_MAX,
  PLANET_MAX_RADIUS,
  PLANET_MIN_RADIUS,
  PLANET_SPIN_MAX,
} from "./constants.ts";
import { nextFloat, nextRange, type RngState } from "./rng.ts";
import { fromAngle, scale } from "./vector.ts";
import type { Asteroid, PlanetSpec } from "./types.ts";

// Intensity is a function of how far the run has come, not of a level
// index --- there are no levels to count (Decision 1, amended).
export function asteroidSpawnRatePerSecond(scrollDistance: number): number {
  return Math.min(
    BASE_ASTEROID_RATE * (1 + scrollDistance * ASTEROID_RATE_GROWTH),
    ASTEROID_RATE_MAX,
  );
}

// One planet, rolled fresh. Radius first, so the lane range can be narrowed
// to keep the whole planet inside the frame horizontally once it enters (R5).
export function rollPlanetSpec(rng: RngState): { spec: PlanetSpec; rng: RngState } {
  const [radius, afterRadius] = nextRange(rng, PLANET_MIN_RADIUS, PLANET_MAX_RADIUS);
  const laneHalfWidth = FRAME_HALF_WIDTH - radius;
  const [lane, afterLane] = nextRange(afterRadius, -laneHalfWidth, laneHalfWidth);
  const [driftX, afterDrift] = nextRange(afterLane, -PLANET_DRIFT_MAX, PLANET_DRIFT_MAX);
  // Spin is decorative only (render tumble); small so it reads as gentle.
  const [spin, afterSpin] = nextRange(afterDrift, -PLANET_SPIN_MAX, PLANET_SPIN_MAX);
  return { spec: { lane, radius, driftX, spin }, rng: afterSpin };
}

// Asteroids have no schedule, unlike planets: each tick rolls a probability
// against the distance-scaled spawn rate.
export function decideAsteroidSpawn(
  rng: RngState,
  opts: { scrollDistance: number; dt: number },
): { asteroid: Omit<Asteroid, "id"> | null; rng: RngState } {
  const [roll, afterRoll] = nextFloat(rng);
  const chance = asteroidSpawnRatePerSecond(opts.scrollDistance) * opts.dt;
  if (roll >= chance) return { asteroid: null, rng: afterRoll };

  const [radius, afterRadius] = nextRange(afterRoll, ASTEROID_MIN_RADIUS, ASTEROID_MAX_RADIUS);
  const laneHalfWidth = FRAME_HALF_WIDTH - radius;
  const [x, afterX] = nextRange(afterRadius, -laneHalfWidth, laneHalfWidth);

  // Angle convention (vector.ts's fromAngle): 0 = +x, increasing ccw, so
  // horizontal travel is near 0 or PI. Pick a side, then spread around it,
  // so the asteroid crosses the frame rather than racing down/up through it.
  const [side, afterSide] = nextFloat(afterX);
  const baseAngle = side < 0.5 ? 0 : Math.PI;
  const [offset, afterOffset] = nextRange(afterSide, -ASTEROID_ANGLE_SPREAD, ASTEROID_ANGLE_SPREAD);
  const angle = baseAngle + offset;

  const [speed, afterSpeed] = nextRange(afterOffset, ASTEROID_SPEED_MIN, ASTEROID_SPEED_MAX);
  const [spin, afterSpin] = nextRange(afterSpeed, -ASTEROID_SPIN_MAX, ASTEROID_SPIN_MAX);

  return {
    asteroid: {
      position: { x, y: FRAME_HALF_HEIGHT + radius },
      velocity: scale(fromAngle(angle), speed),
      radius,
      spin,
    },
    rng: afterSpin,
  };
}
