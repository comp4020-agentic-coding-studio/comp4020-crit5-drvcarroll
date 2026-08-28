import { describe, expect, it } from "vitest";
import { circlesOverlap, isGentleLanding } from "./collisions.ts";
import type { Planet, Ship } from "./types.ts";

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
    ...overrides,
  };
}

describe("circlesOverlap", () => {
  it("is true when circles touch exactly at the boundary", () => {
    expect(circlesOverlap({ x: 0, y: 0 }, 10, { x: 20, y: 0 }, 10)).toBe(true);
  });

  it("is false once separated beyond the combined radius", () => {
    expect(circlesOverlap({ x: 0, y: 0 }, 10, { x: 21, y: 0 }, 10)).toBe(false);
  });
});

describe("isGentleLanding", () => {
  it("is true inside the planet radius, below the speed threshold", () => {
    const s = ship({ velocity: { x: 5, y: 0 } });
    expect(isGentleLanding(s, planet())).toBe(true);
  });

  it("is false outside the planet radius even at zero speed", () => {
    const s = ship({ position: { x: 200, y: 0 } });
    expect(isGentleLanding(s, planet())).toBe(false);
  });

  it("is false inside the planet radius but moving too fast", () => {
    const s = ship({ velocity: { x: 999, y: 0 } });
    expect(isGentleLanding(s, planet())).toBe(false);
  });
});
