import { describe, expect, it } from "vitest";
import { nextFloat, nextRange } from "./rng.ts";

describe("rng", () => {
  it("is deterministic given a seed", () => {
    const [a] = nextFloat({ seed: 1 });
    const [b] = nextFloat({ seed: 1 });
    expect(a).toBe(b);
  });

  it("advances state so consecutive calls differ", () => {
    const [a, s1] = nextFloat({ seed: 1 });
    const [b] = nextFloat(s1);
    expect(a).not.toBe(b);
  });

  it("never mutates the state it was given", () => {
    const state = { seed: 42 };
    nextFloat(state);
    expect(state).toEqual({ seed: 42 });
  });

  it("stays within [0, 1)", () => {
    let rng = { seed: 7 };
    for (let i = 0; i < 100; i++) {
      const [value, next] = nextFloat(rng);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      rng = next;
    }
  });

  it("nextRange stays within [min, max)", () => {
    const [value] = nextRange({ seed: 3 }, 10, 20);
    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThan(20);
  });
});
