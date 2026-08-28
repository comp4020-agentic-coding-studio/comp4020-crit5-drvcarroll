import { describe, expect, it } from "vitest";
import { FRAME_HALF_HEIGHT, FRAME_HALF_WIDTH, SHIP_EDGE_MARGIN } from "./constants.ts";
import { clampToFrame, isOutsideFrame } from "./frame.ts";
import type { Ship } from "./types.ts";

const CLAMP_X = FRAME_HALF_WIDTH - SHIP_EDGE_MARGIN;
const CLAMP_Y = FRAME_HALF_HEIGHT - SHIP_EDGE_MARGIN;

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

describe("clampToFrame", () => {
  it("leaves a ship inside the frame untouched", () => {
    const s = ship({ position: { x: 10, y: -20 }, velocity: { x: 5, y: 7 } });
    expect(clampToFrame(s)).toEqual(s);
  });

  it("does not clamp a ship exactly on the clamp edge", () => {
    const s = ship({ position: { x: CLAMP_X, y: CLAMP_Y }, velocity: { x: 3, y: -4 } });
    expect(clampToFrame(s)).toEqual(s);
  });

  it("clamps the +x wall and zeroes only vx", () => {
    const s = ship({ position: { x: CLAMP_X + 5, y: 12 }, velocity: { x: 40, y: -8 } });
    const next = clampToFrame(s);
    expect(next.position).toEqual({ x: CLAMP_X, y: 12 });
    expect(next.velocity).toEqual({ x: 0, y: -8 });
  });

  it("clamps the -x wall and zeroes only vx", () => {
    const s = ship({ position: { x: -CLAMP_X - 5, y: 12 }, velocity: { x: -40, y: 8 } });
    const next = clampToFrame(s);
    expect(next.position).toEqual({ x: -CLAMP_X, y: 12 });
    expect(next.velocity).toEqual({ x: 0, y: 8 });
  });

  it("clamps the +y wall and zeroes only vy", () => {
    const s = ship({ position: { x: -12, y: CLAMP_Y + 5 }, velocity: { x: 8, y: 40 } });
    const next = clampToFrame(s);
    expect(next.position).toEqual({ x: -12, y: CLAMP_Y });
    expect(next.velocity).toEqual({ x: 8, y: 0 });
  });

  it("clamps the -y wall and zeroes only vy", () => {
    const s = ship({ position: { x: -12, y: -CLAMP_Y - 5 }, velocity: { x: 8, y: -40 } });
    const next = clampToFrame(s);
    expect(next.position).toEqual({ x: -12, y: -CLAMP_Y });
    expect(next.velocity).toEqual({ x: 8, y: 0 });
  });

  it("clamps both axes in a corner and zeroes both components", () => {
    const s = ship({
      position: { x: 9000, y: -9000 },
      velocity: { x: 500, y: -500 },
    });
    const next = clampToFrame(s);
    expect(next.position).toEqual({ x: CLAMP_X, y: -CLAMP_Y });
    expect(next.velocity).toEqual({ x: 0, y: 0 });
  });

  it("does not mutate the input ship", () => {
    const s = ship({ position: { x: CLAMP_X + 5, y: 0 }, velocity: { x: 1, y: 0 } });
    const before = JSON.parse(JSON.stringify(s));
    clampToFrame(s);
    expect(s).toEqual(before);
  });
});

describe("isOutsideFrame", () => {
  it("is false at the frame centre", () => {
    expect(isOutsideFrame({ x: 0, y: 0 }, 10)).toBe(false);
  });

  it("is false when the circle merely touches an edge", () => {
    expect(isOutsideFrame({ x: FRAME_HALF_WIDTH + 10, y: 0 }, 10)).toBe(false);
  });

  it("is true just past tangent to the right edge", () => {
    expect(isOutsideFrame({ x: FRAME_HALF_WIDTH + 10.01, y: 0 }, 10)).toBe(true);
  });

  it("is true just past tangent to the left edge", () => {
    expect(isOutsideFrame({ x: -FRAME_HALF_WIDTH - 10.01, y: 0 }, 10)).toBe(true);
  });

  it("is true just past tangent to the top edge", () => {
    expect(isOutsideFrame({ x: 0, y: FRAME_HALF_HEIGHT + 10.01 }, 10)).toBe(true);
  });

  it("is true just past tangent to the bottom edge", () => {
    expect(isOutsideFrame({ x: 0, y: -FRAME_HALF_HEIGHT - 10.01 }, 10)).toBe(true);
  });

  it("is true far outside the frame", () => {
    expect(isOutsideFrame({ x: 100000, y: -100000 }, 5)).toBe(true);
  });
});
