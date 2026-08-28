import {
  ASTEROID_ANGLE_SPREAD,
  ASTEROID_MAX_RADIUS,
  ASTEROID_MIN_RADIUS,
  ASTEROID_SPEED_MAX,
  ASTEROID_SPEED_MIN,
  ASTEROID_SPIN_MAX,
  FRAME_HALF_HEIGHT,
  FRAME_HALF_WIDTH,
} from "./constants.ts";
import { asteroidSpawnRatePerSecond } from "./level.ts";
import { nextFloat, nextRange, type RngState } from "./rng.ts";
import { fromAngle, scale } from "./vector.ts";
import type { Asteroid, LevelState, PlanetSpec } from "./types.ts";

// A pure lookup: the level's plan already fixed every planet's atScroll, so
// activation just checks whether scroll has reached the next planned one.
export function decidePlanetActivation(level: LevelState, scrollDistance: number): PlanetSpec | null {
  const next = level.plan.planets[level.spawnedCount];
  if (!next || scrollDistance < next.atScroll) return null;
  return next;
}

// Asteroids have no fixed total, unlike planets: each tick rolls a
// probability against the level's difficulty-scaled spawn rate.
export function decideAsteroidSpawn(
  rng: RngState,
  opts: { levelIndex: number; dt: number },
): { asteroid: Omit<Asteroid, "id"> | null; rng: RngState } {
  const [roll, afterRoll] = nextFloat(rng);
  const chance = asteroidSpawnRatePerSecond(opts.levelIndex) * opts.dt;
  if (roll >= chance) return { asteroid: null, rng: afterRoll };

  // Radius first, so x can be narrowed to keep the whole asteroid inside
  // the frame horizontally at the moment it enters (R5).
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
