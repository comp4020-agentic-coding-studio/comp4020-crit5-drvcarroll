import { describe, expect, it } from "vitest";
import { SHIP_DAMPING } from "./constants.ts";
import { createInitialState } from "./state.ts";
import {
  advanceLevel,
  applyAsteroidHit,
  attemptLanding,
  checkEndCondition,
  fireBullet,
  tick,
} from "./reducer.ts";
import { colonistBatchForLevel } from "./level.ts";

const SEED = { seed: 1 };
const NO_INPUT = {
  rotateLeft: false,
  rotateRight: false,
  thrust: false,
  retro: false,
  fire: false,
};

describe("tick", () => {
  it("moves the ship by its (damped) velocity over dt", () => {
    const base = createInitialState(SEED);
    // No planets in range: isolates movement from gravity (see gravity.test.ts).
    const state = { ...base, ship: { ...base.ship, velocity: { x: 10, y: 0 } }, planets: [] };
    const next = tick(state, NO_INPUT, 1);
    const dampedVx = 10 * Math.exp(-SHIP_DAMPING * 1);
    expect(next.ship.position.x).toBeCloseTo(dampedVx, 5);
  });

  it("running out of fuel away from any planet is a loss", () => {
    const base = createInitialState(SEED);
    const state = { ...base, ship: { ...base.ship, fuel: 0 } };
    const next = tick(state, NO_INPUT, 1 / 60);
    expect(next.end).toEqual({ status: "lost", cause: "fuel" });
  });

  it("resolves a gentle ship~planet overlap into a landing", () => {
    const base = createInitialState(SEED);
    const planet = base.planets[0];
    const state = {
      ...base,
      ship: { ...base.ship, position: planet.position, velocity: { x: 0, y: 0 } },
    };
    const next = tick(state, NO_INPUT, 1 / 60);
    expect(next.planets.find((p) => p.id === planet.id)?.colonized).toBe(true);
  });

  it("resolves a ship~asteroid overlap into a colonist loss", () => {
    const base = createInitialState(SEED);
    const asteroid = { id: 99, position: base.ship.position, velocity: { x: 0, y: 0 }, radius: 20 };
    const state = { ...base, asteroids: [asteroid] };
    const next = tick(state, NO_INPUT, 1 / 60);
    expect(next.ship.colonists).toBeLessThan(base.ship.colonists);
    expect(next.asteroids).toHaveLength(0);
  });

  it("gravity pulls a coasting ship closer, with nonzero inward velocity", () => {
    const base = createInitialState(SEED);
    const planet = { ...base.planets[0], position: { x: 0, y: 300 }, radius: 40 };
    const ship = { ...base.ship, position: { x: 0, y: 150 }, velocity: { x: 0, y: 0 } };
    const state = { ...base, ship, planets: [planet] };
    const next = tick(state, NO_INPUT, 1 / 60);
    expect(next.ship.position.y).toBeGreaterThan(ship.position.y);
    expect(next.ship.velocity.y).toBeGreaterThan(0);
  });

  it("gravity can turn a borderline-gentle approach into a crash", () => {
    const base = createInitialState(SEED);
    const planet = { ...base.planets[0], position: { x: 0, y: 0 }, radius: 200 };
    // Just under the landing threshold on its own; already inside the
    // planet's radius, so this tick's landing check fires immediately.
    const ship = { ...base.ship, position: { x: 0, y: 150 }, velocity: { x: 0, y: -39 } };
    const state = { ...base, ship, planets: [planet] };
    const next = tick(state, NO_INPUT, 1);
    expect(next.planets[0].colonized).toBe(false);
    expect(next.ship.colonists).toBe(ship.colonists);
  });
});

describe("attemptLanding", () => {
  it("is a no-op on a fast pass --- no deposit, no penalty", () => {
    const base = createInitialState(SEED);
    const planet = base.planets[0];
    const fast = {
      ...base,
      ship: { ...base.ship, position: planet.position, velocity: { x: 1000, y: 0 } },
    };
    expect(attemptLanding(fast, planet.id)).toBe(fast);
  });

  it("is a no-op on an already-colonized planet", () => {
    const base = createInitialState(SEED);
    const planet = base.planets[0];
    const colonized = {
      ...base,
      ship: { ...base.ship, position: planet.position, velocity: { x: 0, y: 0 } },
      planets: [{ ...planet, colonized: true }],
    };
    expect(attemptLanding(colonized, planet.id)).toBe(colonized);
  });

  it("tops up fuel and ammo by 1 / planetsRequired", () => {
    const base = createInitialState(SEED);
    const planet = base.planets[0];
    const depleted = {
      ...base,
      ship: { ...base.ship, position: planet.position, velocity: { x: 0, y: 0 }, fuel: 0.1, ammo: 0.1 },
    };
    const landed = attemptLanding(depleted, planet.id);
    const topUp = 1 / base.level.planetsRequired;
    expect(landed.ship.fuel).toBeCloseTo(0.1 + topUp);
    expect(landed.ship.ammo).toBeCloseTo(0.1 + topUp);
  });
});

describe("applyAsteroidHit", () => {
  it("scales colonist loss to the asteroid's radius", () => {
    const base = createInitialState(SEED);
    const asteroid = { id: 5, position: base.ship.position, velocity: { x: 0, y: 0 }, radius: 10 };
    const hit = applyAsteroidHit({ ...base, asteroids: [asteroid] }, 5);
    expect(hit.ship.colonists).toBe(base.ship.colonists - Math.ceil(10 * 0.6));
    expect(hit.asteroids).toHaveLength(0);
  });

  it("never drops colonists below zero", () => {
    const base = createInitialState(SEED);
    const asteroid = { id: 5, position: base.ship.position, velocity: { x: 0, y: 0 }, radius: 1000 };
    const hit = applyAsteroidHit({ ...base, ship: { ...base.ship, colonists: 1 }, asteroids: [asteroid] }, 5);
    expect(hit.ship.colonists).toBe(0);
  });
});

describe("fireBullet", () => {
  it("spends ammo and appends a bullet heading along the ship's heading", () => {
    const base = createInitialState(SEED);
    const fired = fireBullet(base);
    expect(fired.bullets).toHaveLength(1);
    expect(fired.ship.ammo).toBeLessThan(base.ship.ammo);
  });

  it("is a no-op with no ammo", () => {
    const base = createInitialState(SEED);
    const empty = { ...base, ship: { ...base.ship, ammo: 0 } };
    expect(fireBullet(empty)).toBe(empty);
  });
});

describe("advanceLevel", () => {
  it("issues a fresh colonist batch sized to the new level, carrying fuel/ammo over", () => {
    const base = createInitialState(SEED);
    const spent = { ...base, ship: { ...base.ship, fuel: 0.5, ammo: 0.5 } };
    const next = advanceLevel(spent);
    expect(next.level.index).toBe(base.level.index + 1);
    expect(next.ship.colonists).toBe(colonistBatchForLevel(next.level.plan));
    expect(next.ship.fuel).toBe(0.5);
    expect(next.ship.ammo).toBe(0.5);
    expect(checkEndCondition(next)).toEqual({ status: "playing" });
  });
});
