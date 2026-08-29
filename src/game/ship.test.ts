import { describe, expect, it } from "vitest";
import {
  AIR_DRAIN_RATE,
  FRAME_HALF_HEIGHT,
  FRAME_HALF_WIDTH,
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
  fire: false,
};

function ship(overrides: Partial<Ship> = {}): Ship {
  return {
    position: { x: 0, y: 0 },
    heading: 0,
    velocity: { x: 0, y: 0 },
    air: 1,
    fuel: 1,
    ammo: 1,
    thrusting: false,
    fireCooldown: 0,
    invulnUntil: -Infinity,
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

  it("coasts forever: no drag, so velocity is unchanged without thrust", () => {
    const moving = ship({ velocity: { x: 10, y: -4 } });
    const next = applyInput(moving, NO_INPUT, 2);
    expect(next.velocity).toEqual({ x: 10, y: -4 });
    expect(next.position.x).toBeCloseTo(20, 10);
    expect(next.position.y).toBeCloseTo(-8, 10);
  });

  it("counter-thrust is the only brake: flip 180 and burn to reverse", () => {
    // Coasting +x at 100, pointed -x. Burning must slow, stop, then reverse.
    let s = ship({ velocity: { x: 100, y: 0 }, heading: Math.PI });
    const burn = { ...NO_INPUT, thrust: true };
    const slowed = applyInput(s, burn, 0.1);
    expect(slowed.velocity.x).toBeLessThan(100);
    expect(slowed.velocity.x).toBeGreaterThan(0);
    s = slowed;
    for (let i = 0; i < 120; i++) s = applyInput(s, burn, 1 / 60);
    expect(s.velocity.x).toBeLessThan(0);
  });

  it("drains air at a constant rate whatever the pilot does", () => {
    const idle = applyInput(ship(), NO_INPUT, 1);
    const busy = applyInput(ship(), { ...NO_INPUT, thrust: true, rotateLeft: true }, 1);
    expect(idle.air).toBeCloseTo(1 - AIR_DRAIN_RATE, 10);
    expect(busy.air).toBeCloseTo(idle.air, 10);
  });

  it("never drains air below empty", () => {
    const gasping = ship({ air: 0.001 });
    expect(applyInput(gasping, NO_INPUT, 10).air).toBe(0);
  });

  it("ticks the fire cooldown down to zero and no further", () => {
    expect(applyInput(ship({ fireCooldown: 0.5 }), NO_INPUT, 0.2).fireCooldown).toBeCloseTo(0.3, 10);
    expect(applyInput(ship({ fireCooldown: 0.1 }), NO_INPUT, 5).fireCooldown).toBe(0);
  });

  it("sets thrusting only while the engine actually burns", () => {
    const withThrust = applyInput(ship(), { ...NO_INPUT, thrust: true }, 1 / 60);
    const dry = applyInput(ship({ fuel: 0 }), { ...NO_INPUT, thrust: true }, 1 / 60);
    const withNeither = applyInput(ship(), NO_INPUT, 1 / 60);
    expect(withThrust.thrusting).toBe(true);
    expect(dry.thrusting).toBe(false);
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
