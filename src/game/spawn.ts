import {
  ASTEROID_MAX_RADIUS,
  ASTEROID_MIN_RADIUS,
  ASTEROID_SPEED_MAX,
  ASTEROID_SPEED_MIN,
  LANE_HALF_WIDTH,
} from "./constants.ts";
import { asteroidSpawnRatePerSecond } from "./level.ts";
import { nextFloat, nextRange, type RngState } from "./rng.ts";
import { fromAngle, scale } from "./vector.ts";
import type { Asteroid, LevelState, PlanetSpec } from "./types.ts";

// A pure lookup: the level's plan already fixed every planet's scrollY, so
// activation just checks whether scroll has reached the next planned one.
export function decidePlanetActivation(level: LevelState, scrollY: number): PlanetSpec | null {
  const next = level.plan.planets[level.spawnedCount];
  if (!next || scrollY < next.scrollY) return null;
  return next;
}

// Asteroids have no fixed total, unlike planets: each tick rolls a
// probability against the level's difficulty-scaled spawn rate.
export function decideAsteroidSpawn(
  rng: RngState,
  opts: { scrollY: number; levelIndex: number; dt: number },
): { asteroid: Omit<Asteroid, "id"> | null; rng: RngState } {
  const [roll, afterRoll] = nextFloat(rng);
  const chance = asteroidSpawnRatePerSecond(opts.levelIndex) * opts.dt;
  if (roll >= chance) return { asteroid: null, rng: afterRoll };

  const [lane, afterLane] = nextRange(afterRoll, -LANE_HALF_WIDTH, LANE_HALF_WIDTH);
  const [radius, afterRadius] = nextRange(afterLane, ASTEROID_MIN_RADIUS, ASTEROID_MAX_RADIUS);
  const [angle, afterAngle] = nextRange(afterRadius, 0, Math.PI * 2);
  const [speed, afterSpeed] = nextRange(afterAngle, ASTEROID_SPEED_MIN, ASTEROID_SPEED_MAX);

  return {
    asteroid: {
      position: { x: lane, y: opts.scrollY + ASTEROID_MAX_RADIUS * 4 },
      velocity: scale(fromAngle(angle), speed),
      radius,
    },
    rng: afterSpeed,
  };
}
