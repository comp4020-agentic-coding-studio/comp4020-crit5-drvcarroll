import { describe, expect, it } from "vitest";
import { FIXED_DT, MAX_ACCUMULATOR, ticksForElapsed } from "./loop.ts";

describe("ticksForElapsed", () => {
  it("runs the expected tick count for a given elapsed time", () => {
    const { ticks, accumulator } = ticksForElapsed(0, 5 * FIXED_DT);
    expect(ticks).toBe(5);
    expect(accumulator).toBeCloseTo(0, 9);
  });

  it("carries a partial tick into the returned accumulator", () => {
    const { ticks, accumulator } = ticksForElapsed(0, 1.5 * FIXED_DT);
    expect(ticks).toBe(1);
    expect(accumulator).toBeCloseTo(0.5 * FIXED_DT, 9);
  });

  it("conserves ticks across split calls versus one combined call", () => {
    const whole = ticksForElapsed(0, 7.5 * FIXED_DT);
    const first = ticksForElapsed(0, 3 * FIXED_DT);
    const second = ticksForElapsed(first.accumulator, 4.5 * FIXED_DT);
    expect(first.ticks + second.ticks).toBe(whole.ticks);
    expect(second.accumulator).toBeCloseTo(whole.accumulator, 9);
  });

  it("returns zero ticks for zero elapsed time", () => {
    const { ticks, accumulator } = ticksForElapsed(0, 0);
    expect(ticks).toBe(0);
    expect(accumulator).toBe(0);
  });

  it("never spirals after a 3s stall: bounded by MAX_ACCUMULATOR, not elapsed", () => {
    const { ticks } = ticksForElapsed(0, 3); // a 3-second tab stall
    const bound = Math.floor(MAX_ACCUMULATOR / FIXED_DT);
    expect(ticks).toBe(bound);
    expect(ticks).toBeLessThan(3 / FIXED_DT); // far fewer than a naive catch-up
  });

  it("caps a large starting accumulator the same way", () => {
    const { ticks, accumulator } = ticksForElapsed(1, 3);
    const bound = Math.floor(MAX_ACCUMULATOR / FIXED_DT);
    expect(ticks).toBe(bound);
    expect(accumulator).toBeLessThan(FIXED_DT);
  });
});
