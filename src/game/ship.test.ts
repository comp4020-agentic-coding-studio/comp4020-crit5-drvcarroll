import { describe, expect, it } from "vitest";
import { applyInput } from "./ship.ts";
import type { Input, Ship } from "./types.ts";

const NO_INPUT: Input = { rotateLeft: false, rotateRight: false, thrust: false, fire: false };

function ship(overrides: Partial<Ship> = {}): Ship {
  return {
    position: { x: 0, y: 0 },
    heading: 0,
    velocity: { x: 0, y: 0 },
    colonists: 10,
    fuel: 1,
    ammo: 1,
    ...overrides,
  };
}

describe("applyInput", () => {
  it("rotates left/right without moving", () => {
    // toWorld()'s Y-flip mirrors on-screen rotation sense: rotateLeft
    // increases heading, rotateRight decreases it (see ship.ts comment).
    const left = applyInput(ship(), { ...NO_INPUT, rotateLeft: true }, 1);
    expect(left.heading).toBeGreaterThan(0);
    const right = applyInput(ship(), { ...NO_INPUT, rotateRight: true }, 1);
    expect(right.heading).toBeLessThan(0);
  });

  it("thrusting accelerates along the current heading and drains fuel", () => {
    const s = applyInput(ship(), { ...NO_INPUT, thrust: true }, 1);
    expect(s.velocity.x).toBeGreaterThan(0);
    expect(s.fuel).toBeLessThan(1);
  });

  it("has no drag: velocity persists with no input applied", () => {
    const moving = ship({ velocity: { x: 100, y: 0 } });
    const next = applyInput(moving, NO_INPUT, 1);
    expect(next.velocity).toEqual(moving.velocity);
  });

  it("thrust has no effect once fuel is empty", () => {
    const empty = ship({ fuel: 0 });
    const next = applyInput(empty, { ...NO_INPUT, thrust: true }, 1);
    expect(next.velocity).toEqual({ x: 0, y: 0 });
    expect(next.fuel).toBe(0);
  });

  it("integrates position from velocity", () => {
    const moving = ship({ velocity: { x: 10, y: 0 } });
    const next = applyInput(moving, NO_INPUT, 2);
    expect(next.position).toEqual({ x: 20, y: 0 });
  });
});
