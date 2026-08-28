import { describe, expect, it } from "vitest";
import {
  FRAME_HALF_HEIGHT,
  LANDING_SPEED_THRESHOLD,
  PLANET_CRASH_DAMAGE_SCALE,
  SHIP_DAMPING,
} from "./constants.ts";
import { createInitialState } from "./state.ts";
import {
  advanceLevel,
  applyAsteroidHit,
  applyPlanetCrash,
  attemptLanding,
  checkEndCondition,
  fireBullet,
  tick,
} from "./reducer.ts";
import { colonistBatchForLevel } from "./level.ts";
import { scrollSpeedForLevel } from "./scroll.ts";

// A gentle landing is now measured relative to the planet's own downward
// drift (R5), so a still ship must match that drift, not sit at zero.
function planetVelocity(planet: { driftX: number }, levelIndex: number) {
  return { x: planet.driftX, y: -scrollSpeedForLevel(levelIndex) };
}

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
      ship: { ...base.ship, position: planet.position, velocity: planetVelocity(planet, base.level.index) },
    };
    const next = tick(state, NO_INPUT, 1 / 60);
    expect(next.planets.find((p) => p.id === planet.id)?.colonized).toBe(true);
  });

  it("resolves a ship~asteroid overlap into a colonist loss", () => {
    const base = createInitialState(SEED);
    const asteroid = { id: 99, position: base.ship.position, velocity: { x: 0, y: 0 }, radius: 20, spin: 0 };
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

  it("a fast planet approach stops the ship at the surface and loses colonists, same tick", () => {
    const base = createInitialState(SEED);
    const planet = { ...base.planets[0], position: { x: 0, y: 0 }, radius: 100, driftX: 0 };
    const ship = { ...base.ship, position: { x: 0, y: 150 }, velocity: { x: 0, y: -500 } };
    const state = { ...base, ship, planets: [planet] };
    const next = tick(state, NO_INPUT, 1);

    const landedPlanet = next.planets.find((p) => p.id === planet.id);
    expect(landedPlanet?.colonized).toBe(false);
    // Stopped exactly at the surface, not passed through it.
    expect(Math.abs(next.ship.position.y - landedPlanet!.position.y)).toBeCloseTo(planet.radius, 5);
    expect(next.ship.colonists).toBeLessThan(ship.colonists);
  });

  it("an entity that has drifted outside the frame is gone next tick", () => {
    const base = createInitialState(SEED);
    const belowFrame = -FRAME_HALF_HEIGHT - 100;
    const goneAsteroid = { id: 50, position: { x: 0, y: belowFrame }, velocity: { x: 0, y: 0 }, radius: 10, spin: 0 };
    const gonePlanet = {
      id: 51, position: { x: 0, y: belowFrame }, radius: 20,
      colonistsRequired: 5, colonized: false, driftX: 0, spin: 0,
    };
    const state = { ...base, asteroids: [goneAsteroid], planets: [gonePlanet] };
    const next = tick(state, NO_INPUT, 1 / 60);
    expect(next.asteroids.find((a) => a.id === 50)).toBeUndefined();
    expect(next.planets.find((p) => p.id === 51)).toBeUndefined();
  });
});

describe("invulnerability (R9)", () => {
  it("a second overlapping asteroid within INVULN_DISTANCE is suppressed, not a free kill", () => {
    const base = createInitialState(SEED);
    const first = { id: 10, position: base.ship.position, velocity: { x: 0, y: 0 }, radius: 20, spin: 0 };
    const afterFirst = applyAsteroidHit({ ...base, asteroids: [first] }, 10);
    expect(afterFirst.asteroids).toHaveLength(0);
    expect(afterFirst.ship.colonists).toBeLessThan(base.ship.colonists);

    const second = { id: 11, position: afterFirst.ship.position, velocity: { x: 0, y: 0 }, radius: 20, spin: 0 };
    const afterSecond = applyAsteroidHit({ ...afterFirst, asteroids: [second] }, 11);
    expect(afterSecond.ship.colonists).toBe(afterFirst.ship.colonists);
    expect(afterSecond.asteroids).toHaveLength(1);
  });

  it("repeated fast planet contact within INVULN_DISTANCE charges damage exactly once", () => {
    const base = createInitialState(SEED);
    const planetVelocity = { x: 0, y: 0 };
    const fastVelocity = { x: 0, y: -200 };
    let state = base;
    for (let i = 0; i < 10; i++) {
      state = applyPlanetCrash(state, planetVelocity, fastVelocity);
    }
    const damage = Math.ceil((200 - LANDING_SPEED_THRESHOLD) * PLANET_CRASH_DAMAGE_SCALE);
    expect(state.ship.colonists).toBe(base.ship.colonists - damage);
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
      ship: {
        ...base.ship,
        position: planet.position,
        velocity: planetVelocity(planet, base.level.index),
        fuel: 0.1,
        ammo: 0.1,
      },
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
    const asteroid = { id: 5, position: base.ship.position, velocity: { x: 0, y: 0 }, radius: 10, spin: 0 };
    const hit = applyAsteroidHit({ ...base, asteroids: [asteroid] }, 5);
    expect(hit.ship.colonists).toBe(base.ship.colonists - Math.ceil(10 * 0.6));
    expect(hit.asteroids).toHaveLength(0);
  });

  it("never drops colonists below zero", () => {
    const base = createInitialState(SEED);
    const asteroid = { id: 5, position: base.ship.position, velocity: { x: 0, y: 0 }, radius: 1000, spin: 0 };
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
