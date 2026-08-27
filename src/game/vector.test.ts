import { describe, expect, it } from "vitest";
import { add, distance, fromAngle, length, scale, subtract } from "./vector.ts";

describe("vector", () => {
  it("adds and subtracts componentwise", () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
    expect(subtract({ x: 4, y: 6 }, { x: 1, y: 2 })).toEqual({ x: 3, y: 4 });
  });

  it("scales both components", () => {
    expect(scale({ x: 2, y: -3 }, 2)).toEqual({ x: 4, y: -6 });
  });

  it("measures length", () => {
    expect(length({ x: 3, y: 4 })).toBe(5);
  });

  it("builds a unit vector from an angle", () => {
    const v = fromAngle(0);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
  });

  it("scales the angle vector by magnitude", () => {
    const v = fromAngle(0, 5);
    expect(v.x).toBeCloseTo(5);
  });

  it("measures distance between two points", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
