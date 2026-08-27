import { describe, expect, it } from "vitest";
import { decideAsteroidSpawn, decidePlanetActivation } from "./spawn.ts";
import { generateLevelPlan, planetsRequiredForLevel } from "./level.ts";
import type { LevelState } from "./types.ts";

function levelState(overrides: Partial<LevelState> = {}): LevelState {
  const { plan } = generateLevelPlan(0, { seed: 1 });
  return {
    index: 0,
    plan,
    spawnedCount: 0,
    colonizedCount: 0,
    planetsRequired: planetsRequiredForLevel(0),
    ...overrides,
  };
}

describe("decidePlanetActivation", () => {
  it("returns null before scroll reaches the next planned planet", () => {
    const level = levelState();
    expect(decidePlanetActivation(level, 0)).toBeNull();
  });

  it("returns the next planned planet once scroll reaches it", () => {
    const level = levelState();
    const next = level.plan.planets[0];
    expect(decidePlanetActivation(level, next.scrollY)).toBe(next);
  });

  it("returns null once every planned planet has been activated", () => {
    const level = levelState({ spawnedCount: levelState().plan.planets.length });
    expect(decidePlanetActivation(level, 1_000_000)).toBeNull();
  });
});

describe("decideAsteroidSpawn", () => {
  it("never mutates the rng state it was given", () => {
    const rng = { seed: 5 };
    decideAsteroidSpawn(rng, { scrollY: 0, levelIndex: 0, dt: 1 });
    expect(rng).toEqual({ seed: 5 });
  });

  it("spawns more often at dt=1 (near-certain) than dt=0", () => {
    let hits = 0;
    let rng = { seed: 1 };
    for (let i = 0; i < 50; i++) {
      const result = decideAsteroidSpawn(rng, { scrollY: 0, levelIndex: 10, dt: 1 });
      if (result.asteroid) hits++;
      rng = result.rng;
    }
    expect(hits).toBeGreaterThan(0);
  });

  it("a spawned asteroid has a positive radius and a nonzero velocity", () => {
    let rng = { seed: 1 };
    let asteroid = null;
    for (let i = 0; i < 20 && !asteroid; i++) {
      const result = decideAsteroidSpawn(rng, { scrollY: 0, levelIndex: 10, dt: 1 });
      asteroid = result.asteroid;
      rng = result.rng;
    }
    expect(asteroid).not.toBeNull();
    expect(asteroid!.radius).toBeGreaterThan(0);
    expect(asteroid!.velocity.x !== 0 || asteroid!.velocity.y !== 0).toBe(true);
  });
});
