import { describe, expect, it } from "vitest";
import {
  ASTEROID_AIR_DAMAGE_SCALE,
  FIRE_COOLDOWN,
  FRAME_HALF_HEIGHT,
  LANDING_SPEED_THRESHOLD,
  PLANET_CRASH_DAMAGE_SCALE,
  PLANET_GAP_SCROLL,
} from "./constants.ts";
import { createInitialState } from "./state.ts";
import {
  applyAsteroidHit,
  applyPlanetCrash,
  attemptLanding,
  checkEndCondition,
  fireBullet,
  tick,
} from "./reducer.ts";
import type { GameState } from "./types.ts";

// A gentle landing is measured relative to the planet's own downward drift
// (R5), so a "still" ship must match that drift, not sit at zero.
function planetVelocity(planet: { driftX: number }, scrollSpeed: number) {
  return { x: planet.driftX, y: -scrollSpeed };
}

const SEED = { seed: 1 };
const NO_INPUT = {
  rotateLeft: false,
  rotateRight: false,
  thrust: false,
  fire: false,
};

describe("tick", () => {
  it("coasts the ship by its velocity over dt --- space has no drag", () => {
    const base = createInitialState(SEED);
    // No planets in range: isolates movement from gravity (see gravity.test.ts).
    const state = { ...base, ship: { ...base.ship, velocity: { x: 10, y: 0 } }, planets: [] };
    const next = tick(state, NO_INPUT, 1);
    expect(next.ship.position.x).toBeCloseTo(10, 5);
    expect(next.ship.velocity.x).toBeCloseTo(10, 5);
  });

  it("running out of air is a loss; running out of fuel is not", () => {
    const base = createInitialState(SEED);
    const suffocating = tick({ ...base, ship: { ...base.ship, air: 0 } }, NO_INPUT, 1 / 60);
    expect(suffocating.end).toEqual({ status: "lost", cause: "air" });

    const dry = tick({ ...base, ship: { ...base.ship, fuel: 0 } }, NO_INPUT, 1 / 60);
    expect(dry.end).toEqual({ status: "playing" });
  });

  it("keeps booking planets forever --- a missed landing costs supplies, not planets", () => {
    let state: GameState = { ...createInitialState(SEED), planets: [] };
    let spawned = 0;
    // Long enough for many gaps at any scroll speed the curve reaches.
    for (let i = 0; i < 120 * 600; i++) {
      const before = state.planets.length;
      state = tick(state, NO_INPUT, 1 / 120);
      if (state.planets.length > before) spawned++;
    }
    expect(spawned).toBeGreaterThan(5);
    expect(state.nextPlanetScroll).toBeGreaterThan(state.scroll.distance);
    expect(state.nextPlanetScroll - state.scroll.distance).toBeLessThanOrEqual(PLANET_GAP_SCROLL);
  });

  it("resolves a gentle ship~planet overlap into a landing", () => {
    const base = createInitialState(SEED);
    const planet = base.planets[0];
    const state = {
      ...base,
      ship: {
        ...base.ship,
        position: planet.position,
        velocity: planetVelocity(planet, base.scroll.speed),
      },
    };
    const next = tick(state, NO_INPUT, 1 / 60);
    expect(next.planets.find((p) => p.id === planet.id)?.colonized).toBe(true);
  });

  it("resolves a ship~asteroid overlap into vented air", () => {
    const base = createInitialState(SEED);
    const asteroid = { id: 99, position: base.ship.position, velocity: { x: 0, y: 0 }, radius: 20, spin: 0 };
    const state = { ...base, asteroids: [asteroid] };
    const next = tick(state, NO_INPUT, 1 / 60);
    expect(next.ship.air).toBeLessThan(base.ship.air);
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

  it("a fast planet approach stops the ship at the surface and vents air, same tick", () => {
    const base = createInitialState(SEED);
    const planet = { ...base.planets[0], position: { x: 0, y: 0 }, radius: 100, driftX: 0 };
    // Close enough that one short tick lands inside the radius --- a big dt
    // at this speed would tunnel straight past it.
    const ship = { ...base.ship, position: { x: 0, y: 60 }, velocity: { x: 0, y: -500 } };
    const state = { ...base, ship, planets: [planet] };
    const next = tick(state, NO_INPUT, 1 / 60);

    const hitPlanet = next.planets.find((p) => p.id === planet.id);
    expect(hitPlanet?.colonized).toBe(false);
    // Stopped exactly at the surface, not passed through it.
    expect(Math.abs(next.ship.position.y - hitPlanet!.position.y)).toBeCloseTo(planet.radius, 5);
    expect(next.ship.air).toBeLessThan(ship.air);
  });

  it("an entity that has drifted outside the frame is gone next tick", () => {
    const base = createInitialState(SEED);
    const belowFrame = -FRAME_HALF_HEIGHT - 100;
    const goneAsteroid = { id: 50, position: { x: 0, y: belowFrame }, velocity: { x: 0, y: 0 }, radius: 10, spin: 0 };
    const gonePlanet = {
      id: 51, position: { x: 0, y: belowFrame }, radius: 20,
      colonized: false, driftX: 0, spin: 0,
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
    expect(afterFirst.ship.air).toBeLessThan(base.ship.air);

    const second = { id: 11, position: afterFirst.ship.position, velocity: { x: 0, y: 0 }, radius: 20, spin: 0 };
    const afterSecond = applyAsteroidHit({ ...afterFirst, asteroids: [second] }, 11);
    expect(afterSecond.ship.air).toBe(afterFirst.ship.air);
    expect(afterSecond.asteroids).toHaveLength(1);
  });

  it("repeated fast planet contact within INVULN_DISTANCE charges damage exactly once", () => {
    const base = createInitialState(SEED);
    const drift = { x: 0, y: 0 };
    const fastVelocity = { x: 0, y: -200 };
    let state = base;
    for (let i = 0; i < 10; i++) {
      state = applyPlanetCrash(state, drift, fastVelocity);
    }
    const damage = (200 - LANDING_SPEED_THRESHOLD) * PLANET_CRASH_DAMAGE_SCALE;
    expect(state.ship.air).toBeCloseTo(base.ship.air - damage, 10);
  });
});

describe("attemptLanding", () => {
  it("is a no-op on a fast pass --- no resupply, no penalty", () => {
    const base = createInitialState(SEED);
    const planet = base.planets[0];
    const fast = {
      ...base,
      ship: { ...base.ship, position: planet.position, velocity: { x: 1000, y: 0 } },
    };
    expect(attemptLanding(fast, planet.id)).toBe(fast);
  });

  it("is a no-op on an already-spent planet", () => {
    const base = createInitialState(SEED);
    const planet = base.planets[0];
    const colonized = {
      ...base,
      ship: { ...base.ship, position: planet.position, velocity: { x: 0, y: 0 } },
      planets: [{ ...planet, colonized: true }],
    };
    expect(attemptLanding(colonized, planet.id)).toBe(colonized);
  });

  it("refills air, fuel and ammo, and spends the planet", () => {
    const base = createInitialState(SEED);
    const planet = base.planets[0];
    const depleted = {
      ...base,
      ship: {
        ...base.ship,
        position: planet.position,
        velocity: planetVelocity(planet, base.scroll.speed),
        air: 0.1,
        fuel: 0.1,
        ammo: 0.1,
      },
    };
    const landed = attemptLanding(depleted, planet.id);
    expect(landed.ship.air).toBe(1);
    expect(landed.ship.fuel).toBe(1);
    expect(landed.ship.ammo).toBe(1);
    expect(landed.planets.find((p) => p.id === planet.id)?.colonized).toBe(true);
  });
});

describe("applyAsteroidHit", () => {
  it("scales air loss to the asteroid's radius", () => {
    const base = createInitialState(SEED);
    const asteroid = { id: 5, position: base.ship.position, velocity: { x: 0, y: 0 }, radius: 10, spin: 0 };
    const hit = applyAsteroidHit({ ...base, asteroids: [asteroid] }, 5);
    expect(hit.ship.air).toBeCloseTo(base.ship.air - 10 * ASTEROID_AIR_DAMAGE_SCALE, 10);
    expect(hit.asteroids).toHaveLength(0);
  });

  it("never drops air below zero", () => {
    const base = createInitialState(SEED);
    const asteroid = { id: 5, position: base.ship.position, velocity: { x: 0, y: 0 }, radius: 1000, spin: 0 };
    const hit = applyAsteroidHit({ ...base, ship: { ...base.ship, air: 0.01 }, asteroids: [asteroid] }, 5);
    expect(hit.ship.air).toBe(0);
    expect(checkEndCondition(hit)).toEqual({ status: "lost", cause: "air" });
  });
});

describe("fireBullet", () => {
  it("spends ammo and appends a bullet heading along the ship's heading", () => {
    const base = createInitialState(SEED);
    const fired = fireBullet(base);
    expect(fired.bullets).toHaveLength(1);
    expect(fired.ship.ammo).toBeLessThan(base.ship.ammo);
    expect(fired.ship.fireCooldown).toBe(FIRE_COOLDOWN);
  });

  it("is a no-op with no ammo", () => {
    const base = createInitialState(SEED);
    const empty = { ...base, ship: { ...base.ship, ammo: 0 } };
    expect(fireBullet(empty)).toBe(empty);
  });

  it("rate-limits: a held trigger cannot empty the clip in a handful of ticks", () => {
    let state = createInitialState(SEED);
    const holding = { ...NO_INPUT, fire: true };
    for (let i = 0; i < 12; i++) state = tick(state, holding, 1 / 120);
    expect(state.bullets.length).toBeLessThanOrEqual(1);
  });
});
