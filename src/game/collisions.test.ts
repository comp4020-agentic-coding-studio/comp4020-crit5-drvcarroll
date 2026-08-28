import { describe, expect, it } from "vitest";
import { circlesOverlap, isGentleLanding, resolvePlanetContact } from "./collisions.ts";
import { LANDING_SPEED_THRESHOLD } from "./constants.ts";
import type { Planet, Ship } from "./types.ts";
import type { Vec2 } from "./vector.ts";
import { length, subtract } from "./vector.ts";

function ship(overrides: Partial<Ship> = {}): Ship {
  return {
    position: { x: 0, y: 0 },
    heading: 0,
    velocity: { x: 0, y: 0 },
    colonists: 10,
    fuel: 1,
    ammo: 1,
    thrusting: false,
    ...overrides,
  };
}

function planet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 1,
    position: { x: 0, y: 0 },
    radius: 50,
    colonistsRequired: 5,
    colonized: false,
    driftX: 0,
    spin: 0,
    ...overrides,
  };
}

const STILL: Vec2 = { x: 0, y: 0 };

describe("circlesOverlap", () => {
  it("is true when circles touch exactly at the boundary", () => {
    expect(circlesOverlap({ x: 0, y: 0 }, 10, { x: 20, y: 0 }, 10)).toBe(true);
  });

  it("is false once separated beyond the combined radius", () => {
    expect(circlesOverlap({ x: 0, y: 0 }, 10, { x: 21, y: 0 }, 10)).toBe(false);
  });
});

describe("isGentleLanding", () => {
  it("is true inside the planet radius, below the speed threshold (zero drift)", () => {
    const s = ship({ velocity: { x: 5, y: 0 } });
    expect(isGentleLanding(s, planet(), STILL)).toBe(true);
  });

  it("is false outside the planet radius even at zero speed (zero drift)", () => {
    const s = ship({ position: { x: 200, y: 0 } });
    expect(isGentleLanding(s, planet(), STILL)).toBe(false);
  });

  it("is false inside the planet radius but moving too fast (zero drift)", () => {
    const s = ship({ velocity: { x: 999, y: 0 } });
    expect(isGentleLanding(s, planet(), STILL)).toBe(false);
  });

  it("a ship at rest is not gentle once the planet's drift alone exceeds the threshold", () => {
    const s = ship({ velocity: { x: 0, y: 0 } });
    const fastDrift: Vec2 = { x: 0, y: -(LANDING_SPEED_THRESHOLD + 1) };
    expect(isGentleLanding(s, planet(), fastDrift)).toBe(false);
  });

  it("a ship matching the planet's drift exactly is gentle at any drift speed", () => {
    const fastDrift: Vec2 = { x: 3, y: -500 };
    const s = ship({ velocity: fastDrift });
    expect(isGentleLanding(s, planet(), fastDrift)).toBe(true);
  });
});

describe("resolvePlanetContact", () => {
  it("returns the ship unchanged when there is no overlap", () => {
    const s = ship({ position: { x: 200, y: 0 }, velocity: { x: 5, y: -5 } });
    const result = resolvePlanetContact(s, planet(), STILL);
    expect(result).toEqual(s);
  });

  it("never leaves the ship's position inside the planet's radius (dead centre)", () => {
    const s = ship({ position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } });
    const result = resolvePlanetContact(s, planet(), STILL);
    expect(length(subtract(result.position, planet().position))).toBeCloseTo(planet().radius, 6);
    expect(Number.isNaN(result.position.x)).toBe(false);
    expect(Number.isNaN(result.velocity.x)).toBe(false);
  });

  it("never leaves the ship's position inside the planet's radius (angled graze, slow)", () => {
    const p = planet();
    const s = ship({ position: { x: 30, y: 40 }, velocity: { x: -5, y: -8 } });
    const result = resolvePlanetContact(s, p, STILL);
    expect(length(subtract(result.position, p.position))).toBeCloseTo(p.radius, 6);
  });

  it("never leaves the ship's position inside the planet's radius (angled graze, fast)", () => {
    const p = planet();
    const s = ship({ position: { x: 10, y: 48 }, velocity: { x: 400, y: -20 } });
    const result = resolvePlanetContact(s, p, STILL);
    expect(length(subtract(result.position, p.position))).toBeCloseTo(p.radius, 6);
  });

  it("zeroes only the radial velocity component; the tangential one survives", () => {
    const p = planet();
    // Ship deep inside, moving straight along +x: relative to the surface
    // normal at (0, radius) that velocity is purely tangential.
    const s = ship({ position: { x: 0, y: 10 }, velocity: { x: 120, y: 0 } });
    const result = resolvePlanetContact(s, p, STILL);
    const direction = subtract(result.position, p.position);
    const dirLen = length(direction);
    const unit = { x: direction.x / dirLen, y: direction.y / dirLen };
    const radial = result.velocity.x * unit.x + result.velocity.y * unit.y;
    expect(Math.abs(radial)).toBeCloseTo(0, 6);
    expect(length(result.velocity)).toBeGreaterThan(1);
  });

  it("does not throw or produce NaN when the ship sits exactly on the planet's centre", () => {
    const p = planet();
    const s = ship({ position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } });
    expect(() => resolvePlanetContact(s, p, STILL)).not.toThrow();
    const result = resolvePlanetContact(s, p, STILL);
    expect(Number.isNaN(result.position.x)).toBe(false);
    expect(Number.isNaN(result.position.y)).toBe(false);
    expect(Number.isNaN(result.velocity.x)).toBe(false);
    expect(Number.isNaN(result.velocity.y)).toBe(false);
  });

  it("degenerate centre case falls back to the ship's velocity direction when nonzero", () => {
    const p = planet();
    const s = ship({ position: { x: 0, y: 0 }, velocity: { x: 3, y: 4 } });
    const result = resolvePlanetContact(s, p, STILL);
    // direction should be the normalized (3,4) -> (0.6, 0.8), scaled by radius
    expect(result.position.x).toBeCloseTo(p.radius * 0.6, 6);
    expect(result.position.y).toBeCloseTo(p.radius * 0.8, 6);
  });

  it("resolves relative to a moving planet, keeping only the tangential relative velocity", () => {
    const p = planet();
    const planetVelocity: Vec2 = { x: 4, y: -100 };
    const s = ship({ position: { x: 50, y: 0 }, velocity: { x: -300, y: -100 } });
    const result = resolvePlanetContact(s, p, planetVelocity);
    expect(length(subtract(result.position, p.position))).toBeCloseTo(p.radius, 6);
    const relative = subtract(result.velocity, planetVelocity);
    const direction = subtract(result.position, p.position);
    const dirLen = length(direction);
    const unit = { x: direction.x / dirLen, y: direction.y / dirLen };
    const radial = relative.x * unit.x + relative.y * unit.y;
    expect(Math.abs(radial)).toBeCloseTo(0, 6);
  });
});
