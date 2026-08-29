import { describe, expect, it } from "vitest";
import { FRAME_HALF_HEIGHT, OPENING_PLANET_FRAC, PLANET_GAP_SCROLL } from "./constants.ts";
import { createInitialState } from "./state.ts";

describe("createInitialState", () => {
  it("places exactly one planet, already within opening-frame reach", () => {
    const state = createInitialState({ seed: 1 });
    expect(state.planets).toHaveLength(1);
    expect(state.planets[0].position.y).toBe(FRAME_HALF_HEIGHT * OPENING_PLANET_FRAC);
    expect(Math.abs(state.planets[0].position.y)).toBeLessThanOrEqual(FRAME_HALF_HEIGHT);
  });

  it("books the next planet one gap along the odometer", () => {
    const state = createInitialState({ seed: 1 });
    expect(state.nextPlanetScroll).toBe(PLANET_GAP_SCROLL);
  });

  it("starts with full air, fuel and ammo, and the game in progress", () => {
    const state = createInitialState({ seed: 1 });
    expect(state.ship.air).toBe(1);
    expect(state.ship.fuel).toBe(1);
    expect(state.ship.ammo).toBe(1);
    expect(state.end).toEqual({ status: "playing" });
  });

  it("is deterministic for the same seed", () => {
    const a = createInitialState({ seed: 42 });
    const b = createInitialState({ seed: 42 });
    expect(a).toEqual(b);
  });
});
