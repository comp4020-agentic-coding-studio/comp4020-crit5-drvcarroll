import { describe, expect, it } from "vitest";
import {
  asteroidSpawnRatePerSecond,
  colonistBatchForLevel,
  fuelAmmoTopUpFraction,
  generateLevelPlan,
  planetsRequiredForLevel,
} from "./level.ts";

describe("planetsRequiredForLevel", () => {
  it("grows with level index", () => {
    expect(planetsRequiredForLevel(3)).toBeGreaterThan(planetsRequiredForLevel(1));
  });

  it("caps at the max", () => {
    expect(planetsRequiredForLevel(1000)).toBeLessThanOrEqual(10);
  });
});

describe("asteroidSpawnRatePerSecond", () => {
  it("scales up with level index", () => {
    expect(asteroidSpawnRatePerSecond(5)).toBeGreaterThan(asteroidSpawnRatePerSecond(0));
  });
});

describe("generateLevelPlan", () => {
  it("produces exactly planetsRequiredForLevel planets", () => {
    const { plan } = generateLevelPlan(2, { seed: 1 });
    expect(plan.planets).toHaveLength(planetsRequiredForLevel(2));
  });

  it("is deterministic for the same seed", () => {
    const a = generateLevelPlan(1, { seed: 9 });
    const b = generateLevelPlan(1, { seed: 9 });
    expect(a.plan).toEqual(b.plan);
  });

  it("colonistBatchForLevel sums exactly the level's total requirement", () => {
    const { plan } = generateLevelPlan(2, { seed: 1 });
    const total = plan.planets.reduce((sum, p) => sum + p.colonistsRequired, 0);
    expect(colonistBatchForLevel(plan)).toBe(total);
  });
});

describe("fuelAmmoTopUpFraction", () => {
  it("is 25% for a 4-planet level", () => {
    expect(fuelAmmoTopUpFraction(4)).toBeCloseTo(0.25);
  });

  it("is 10% for a 10-planet level", () => {
    expect(fuelAmmoTopUpFraction(10)).toBeCloseTo(0.1);
  });
});
