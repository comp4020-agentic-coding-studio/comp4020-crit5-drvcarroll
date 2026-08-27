import {
  BASE_PLANETS_PER_LEVEL,
  BASE_ASTEROID_RATE,
  DIFFICULTY_STEP,
  LANE_HALF_WIDTH,
  MAX_PLANETS_PER_LEVEL,
  PLANET_GAP_SCROLL,
  PLANET_MAX_RADIUS,
  PLANET_MIN_RADIUS,
  REQ_PER_RADIUS,
} from "./constants.ts";
import { nextRange, type RngState } from "./rng.ts";
import type { LevelPlan, PlanetSpec } from "./types.ts";

export function planetsRequiredForLevel(levelIndex: number): number {
  return Math.min(MAX_PLANETS_PER_LEVEL, BASE_PLANETS_PER_LEVEL + levelIndex);
}

export function asteroidSpawnRatePerSecond(levelIndex: number): number {
  return BASE_ASTEROID_RATE * (1 + levelIndex * DIFFICULTY_STEP);
}

// The whole level is decided up front, in one pure call, so the colonist
// batch below can be sized to exactly cover it (BUILD_PLAN.md, Decision 1).
export function generateLevelPlan(levelIndex: number, rng: RngState): { plan: LevelPlan; rng: RngState } {
  const count = planetsRequiredForLevel(levelIndex);
  const planets: PlanetSpec[] = [];
  let state = rng;

  for (let i = 0; i < count; i++) {
    const [lane, afterLane] = nextRange(state, -LANE_HALF_WIDTH, LANE_HALF_WIDTH);
    const [radius, afterRadius] = nextRange(afterLane, PLANET_MIN_RADIUS, PLANET_MAX_RADIUS);
    state = afterRadius;
    planets.push({
      scrollY: (i + 1) * PLANET_GAP_SCROLL,
      lane,
      radius,
      colonistsRequired: Math.round(radius * REQ_PER_RADIUS),
    });
  }

  return { plan: { index: levelIndex, planets }, rng: state };
}

export function colonistBatchForLevel(plan: LevelPlan): number {
  return plan.planets.reduce((sum, p) => sum + p.colonistsRequired, 0);
}

export function fuelAmmoTopUpFraction(planetsRequiredThisLevel: number): number {
  return 1 / planetsRequiredThisLevel;
}
