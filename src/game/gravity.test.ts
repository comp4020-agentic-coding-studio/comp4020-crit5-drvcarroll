import { describe, expect, it } from "vitest";
import { GRAVITY_MAX_ACCEL, GRAVITY_RADIUS_MULT } from "./constants.ts";
import { applyGravity } from "./gravity.ts";
import type { Planet, Ship } from "./types.ts";
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
    position: { x: 100, y: 0 },
    radius: 40,
    colonistsRequired: 3,
    colonized: false,
    driftX: 0,
    spin: 0,
    ...overrides,
  };
}

describe("applyGravity", () => {
  it("does not pull a ship outside the well", () => {
    const p = planet({ position: { x: 0, y: 0 }, radius: 10 });
    const s = ship({ position: { x: p.radius * GRAVITY_RADIUS_MULT + 1, y: 0 } });
    const next = applyGravity(s, [p], 1);
    expect(next.velocity).toEqual({ x: 0, y: 0 });
  });

  it("pulls toward the planet's centre", () => {
    const p = planet({ position: { x: 100, y: 50 } });
    const s = ship({ position: { x: 0, y: 0 } });
    const next = applyGravity(s, [p], 1);
    const toPlanet = subtract(p.position, s.position);
    const dot = next.velocity.x * toPlanet.x + next.velocity.y * toPlanet.y;
    expect(dot).toBeGreaterThan(0);
    // Direction is parallel to toPlanet: cross product ~= 0.
    const cross = next.velocity.x * toPlanet.y - next.velocity.y * toPlanet.x;
    expect(cross).toBeCloseTo(0, 6);
  });

  it("falls off monotonically with distance inside the well", () => {
    const p = planet({ position: { x: 0, y: 0 }, radius: 40 });
    const near = ship({ position: { x: 20, y: 0 } });
    const mid = ship({ position: { x: 60, y: 0 } });
    const far = ship({ position: { x: 100, y: 0 } });
    const accel = (s: Ship) => length(applyGravity(s, [p], 1).velocity);
    expect(accel(near)).toBeGreaterThan(accel(mid));
    expect(accel(mid)).toBeGreaterThan(accel(far));
  });

  it("caps acceleration arbitrarily close to the surface", () => {
    const p = planet({ position: { x: 0, y: 0 }, radius: 40 });
    const atSurface = ship({ position: { x: p.radius, y: 0 } });
    const next = applyGravity(atSurface, [p], 1);
    expect(length(next.velocity)).toBeLessThanOrEqual(GRAVITY_MAX_ACCEL + 1e-9);
  });

  it("sums two overlapping wells vectorially", () => {
    const left = planet({ id: 1, position: { x: -50, y: 0 }, radius: 20 });
    const right = planet({ id: 2, position: { x: 50, y: 0 }, radius: 20 });
    const s = ship({ position: { x: 0, y: 0 } });
    const next = applyGravity(s, [left, right], 1);
    // Equal, opposite pulls cancel out at the midpoint.
    expect(next.velocity.x).toBeCloseTo(0, 6);
    expect(next.velocity.y).toBeCloseTo(0, 6);
  });
});
