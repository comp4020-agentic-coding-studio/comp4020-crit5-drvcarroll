import { describe, expect, it } from "vitest";
import {
  ASTEROID_ANGLE_SPREAD,
  ASTEROID_RATE_MAX,
  FRAME_HALF_HEIGHT,
  FRAME_HALF_WIDTH,
  PLANET_MAX_RADIUS,
  PLANET_MIN_RADIUS,
} from "./constants.ts";
import { asteroidSpawnRatePerSecond, decideAsteroidSpawn, rollPlanetSpec } from "./spawn.ts";

// Far enough along that the rate curve has saturated: makes a dt=1 roll
// near-certain, so these draws don't need hundreds of attempts.
const DEEP = 1_000_000;

describe("asteroidSpawnRatePerSecond", () => {
  it("rises with distance travelled --- the run gets busier", () => {
    let prev = asteroidSpawnRatePerSecond(0);
    for (let i = 1; i <= 40; i++) {
      const rate = asteroidSpawnRatePerSecond(i * 1000);
      expect(rate).toBeGreaterThanOrEqual(prev);
      prev = rate;
    }
    expect(asteroidSpawnRatePerSecond(20_000)).toBeGreaterThan(asteroidSpawnRatePerSecond(0));
  });

  it("caps, so a long run stays flyable rather than becoming a wall of rock", () => {
    expect(asteroidSpawnRatePerSecond(DEEP)).toBe(ASTEROID_RATE_MAX);
  });
});

describe("rollPlanetSpec", () => {
  it("never mutates the rng state it was given, and advances it", () => {
    const rng = { seed: 5 };
    const { rng: after } = rollPlanetSpec(rng);
    expect(rng).toEqual({ seed: 5 });
    expect(after).not.toEqual(rng);
  });

  it("keeps the whole planet inside the frame horizontally", () => {
    let rng = { seed: 3 };
    for (let i = 0; i < 500; i++) {
      const rolled = rollPlanetSpec(rng);
      rng = rolled.rng;
      const { lane, radius } = rolled.spec;
      expect(radius).toBeGreaterThanOrEqual(PLANET_MIN_RADIUS);
      expect(radius).toBeLessThanOrEqual(PLANET_MAX_RADIUS);
      expect(Math.abs(lane) + radius).toBeLessThanOrEqual(FRAME_HALF_WIDTH + 1e-9);
    }
  });
});

describe("decideAsteroidSpawn", () => {
  it("never mutates the rng state it was given", () => {
    const rng = { seed: 5 };
    decideAsteroidSpawn(rng, { scrollDistance: 0, dt: 1 });
    expect(rng).toEqual({ seed: 5 });
  });

  it("never spawns at dt = 0, however deep the run", () => {
    let rng = { seed: 1 };
    for (let i = 0; i < 200; i++) {
      const result = decideAsteroidSpawn(rng, { scrollDistance: DEEP, dt: 0 });
      expect(result.asteroid).toBeNull();
      rng = result.rng;
    }
  });

  it("spawns at least sometimes at dt = 1", () => {
    let hits = 0;
    let rng = { seed: 1 };
    for (let i = 0; i < 50; i++) {
      const result = decideAsteroidSpawn(rng, { scrollDistance: DEEP, dt: 1 });
      if (result.asteroid) hits++;
      rng = result.rng;
    }
    expect(hits).toBeGreaterThan(0);
  });

  it("a spawned asteroid has a positive radius, nonzero velocity, and enters at the top edge", () => {
    let rng = { seed: 1 };
    let asteroid = null;
    for (let i = 0; i < 20 && !asteroid; i++) {
      const result = decideAsteroidSpawn(rng, { scrollDistance: DEEP, dt: 1 });
      asteroid = result.asteroid;
      rng = result.rng;
    }
    expect(asteroid).not.toBeNull();
    expect(asteroid!.radius).toBeGreaterThan(0);
    expect(asteroid!.velocity.x !== 0 || asteroid!.velocity.y !== 0).toBe(true);
    expect(asteroid!.position.y).toBeCloseTo(FRAME_HALF_HEIGHT + asteroid!.radius);
  });

  it("stays within ASTEROID_ANGLE_SPREAD of horizontal over 5000 draws", () => {
    let rng = { seed: 7 };
    let checked = 0;
    for (let i = 0; i < 5000; i++) {
      const result = decideAsteroidSpawn(rng, { scrollDistance: DEEP, dt: 1 });
      rng = result.rng;
      const a = result.asteroid;
      if (!a) continue;
      checked++;
      const angle = Math.atan2(a.velocity.y, a.velocity.x);
      // Distance from the nearest horizontal direction (0 or PI).
      const distFromHorizontal = Math.min(Math.abs(angle), Math.abs(Math.PI - Math.abs(angle)));
      expect(distFromHorizontal).toBeLessThanOrEqual(ASTEROID_ANGLE_SPREAD + 1e-9);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
