import {
  BASE_PLANETS_PER_LEVEL,
  BASE_ASTEROID_RATE,
  DIFFICULTY_STEP,
  FRAME_HALF_WIDTH,
  MAX_PLANETS_PER_LEVEL,
  PLANET_DRIFT_MAX,
  PLANET_GAP_SCROLL,
  PLANET_MAX_RADIUS,
  PLANET_MIN_RADIUS,
  PLANET_SPIN_MAX,
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
    // Radius first, so the lane range can be narrowed to keep the whole
    // planet inside the frame horizontally once it activates (R5).
    const [radius, afterRadius] = nextRange(state, PLANET_MIN_RADIUS, PLANET_MAX_RADIUS);
    const laneHalfWidth = FRAME_HALF_WIDTH - radius;
    const [lane, afterLane] = nextRange(afterRadius, -laneHalfWidth, laneHalfWidth);
    const [driftX, afterDrift] = nextRange(afterLane, -PLANET_DRIFT_MAX, PLANET_DRIFT_MAX);
    // Spin is decorative only (render tumble); small so it reads as gentle.
    const [spin, afterSpin] = nextRange(afterDrift, -PLANET_SPIN_MAX, PLANET_SPIN_MAX);
    state = afterSpin;
    planets.push({
      atScroll: (i + 1) * PLANET_GAP_SCROLL,
      lane,
      radius,
      colonistsRequired: Math.round(radius * REQ_PER_RADIUS),
      driftX,
      spin,
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
