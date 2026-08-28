import { describe, expect, it } from "vitest";
import { FRAME_HALF_HEIGHT, OPENING_PLANET_FRAC } from "./constants.ts";
import { colonistBatchForLevel } from "./level.ts";
import { createInitialState } from "./state.ts";

describe("createInitialState", () => {
  it("pre-activates exactly one planet, already within opening-frame reach", () => {
    const state = createInitialState({ seed: 1 });
    expect(state.planets).toHaveLength(1);
    expect(state.level.spawnedCount).toBe(1);
    expect(state.planets[0].position.y).toBe(FRAME_HALF_HEIGHT * OPENING_PLANET_FRAC);
  });

  it("places the first planet inside the frame at step 0", () => {
    const state = createInitialState({ seed: 1 });
    expect(Math.abs(state.planets[0].position.y)).toBeLessThanOrEqual(FRAME_HALF_HEIGHT);
  });

  it("issues a colonist batch sized to exactly cover level 0's requirement", () => {
    const state = createInitialState({ seed: 1 });
    expect(state.ship.colonists).toBe(colonistBatchForLevel(state.level.plan));
  });

  it("starts with full fuel and ammo, and the game in progress", () => {
    const state = createInitialState({ seed: 1 });
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
