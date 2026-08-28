import { describe, expect, it } from "vitest";
import {
  FRAME_HALF_HEIGHT,
  FRAME_HALF_WIDTH,
  SHIP_DAMPING,
  SHIP_EDGE_MARGIN,
} from "./constants.ts";
import { applyInput } from "./ship.ts";
import type { Input, Ship } from "./types.ts";

const CLAMP_X = FRAME_HALF_WIDTH - SHIP_EDGE_MARGIN;
const CLAMP_Y = FRAME_HALF_HEIGHT - SHIP_EDGE_MARGIN;

const NO_INPUT: Input = {
  rotateLeft: false,
  rotateRight: false,
  thrust: false,
  retro: false,
  fire: false,
};

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

  it("thrust has no effect once fuel is empty", () => {
    const empty = ship({ fuel: 0 });
    const next = applyInput(empty, { ...NO_INPUT, thrust: true }, 1);
    expect(next.velocity).toEqual({ x: 0, y: 0 });
    expect(next.fuel).toBe(0);
  });

  it("integrates position from the damped velocity", () => {
    const moving = ship({ velocity: { x: 10, y: 0 } });
    const next = applyInput(moving, NO_INPUT, 2);
    const dampedVx = 10 * Math.exp(-SHIP_DAMPING * 2);
    expect(next.velocity.x).toBeCloseTo(dampedVx, 10);
    expect(next.position.x).toBeCloseTo(dampedVx * 2, 10);
    expect(next.position.y).toBeCloseTo(0, 10);
  });

  describe("damping", () => {
    it("decays speed but never reverses its sign", () => {
      const moving = ship({ velocity: { x: 100, y: -40 } });
      const next = applyInput(moving, NO_INPUT, 1 / 30);
      expect(next.velocity.x).toBeGreaterThan(0);
      expect(next.velocity.x).toBeLessThan(100);
      expect(next.velocity.y).toBeLessThan(0);
      expect(next.velocity.y).toBeGreaterThan(-40);
    });

    it("composes identically across two small steps and one large step", () => {
      const start = ship({ velocity: { x: 60, y: -25 } });
      const oneSmallStep = applyInput(start, NO_INPUT, 1 / 60);
      const twoSmallSteps = applyInput(oneSmallStep, NO_INPUT, 1 / 60);
      const oneLargeStep = applyInput(start, NO_INPUT, 1 / 30);
      expect(twoSmallSteps.velocity.x).toBeCloseTo(oneLargeStep.velocity.x, 6);
      expect(twoSmallSteps.velocity.y).toBeCloseTo(oneLargeStep.velocity.y, 6);
    });
  });

  it("retro-thrust reduces forward speed", () => {
    const moving = ship({ velocity: { x: 100, y: 0 }, heading: 0 });
    const next = applyInput(moving, { ...NO_INPUT, retro: true }, 1 / 60);
    expect(next.velocity.x).toBeLessThan(moving.velocity.x);
    expect(next.fuel).toBeLessThan(1);
  });

  // Retro adds no acceleration with no fuel, but damping still decays it.
  it("retro-thrust adds no acceleration once fuel is empty", () => {
    const empty = ship({ velocity: { x: 100, y: 0 }, fuel: 0 });
    const next = applyInput(empty, { ...NO_INPUT, retro: true }, 1 / 60);
    const expectedVx = 100 * Math.exp(-SHIP_DAMPING / 60);
    expect(next.velocity.x).toBeCloseTo(expectedVx, 10);
    expect(next.velocity.y).toBe(0);
    expect(next.fuel).toBe(0);
  });

  it("sets thrusting only while forward thrust fires, not on retro", () => {
    const withThrust = applyInput(ship(), { ...NO_INPUT, thrust: true }, 1 / 60);
    const withRetro = applyInput(ship(), { ...NO_INPUT, retro: true }, 1 / 60);
    const withNeither = applyInput(ship(), NO_INPUT, 1 / 60);
    expect(withThrust.thrusting).toBe(true);
    expect(withRetro.thrusting).toBe(false);
    expect(withNeither.thrusting).toBe(false);
  });

  it("stops a cornered ship with both components zeroed and in bounds", () => {
    const cornering = ship({
      position: { x: CLAMP_X - 1, y: CLAMP_Y - 1 },
      velocity: { x: 500, y: 500 },
      heading: Math.atan2(1, 1),
    });
    const next = applyInput(cornering, { ...NO_INPUT, thrust: true }, 1);
    expect(next.position.x).toBeLessThanOrEqual(CLAMP_X);
    expect(next.position.y).toBeLessThanOrEqual(CLAMP_Y);
    expect(next.position.x).toBe(CLAMP_X);
    expect(next.position.y).toBe(CLAMP_Y);
    expect(next.velocity).toEqual({ x: 0, y: 0 });
  });
});
