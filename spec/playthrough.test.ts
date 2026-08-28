// Tier 2 --- simulation (§7.2). One harness, five pilots, the eight
// invariants asserted on every tick of every run. No browser, no flake.
import { describe, expect, it } from "vitest";
import { simulate, SIM_DT } from "./harness.ts";
import { idlePilot, thrustPilot, seekPilot, createPanicPilot, wallPilot } from "./pilots.ts";
import { assertInvariants } from "./simInvariants.ts";
import type { GameState } from "../src/game/types.ts";

const SEED = 42;

// Runs a pilot, checking all eight invariants every step via onStep.
// `extra` lets a test also observe the run (e.g. milestone timing)
// without duplicating the invariant wiring.
function run(
  pilot: Parameters<typeof simulate>[0]["pilot"],
  steps: number,
  seed = SEED,
  extra?: (state: GameState, i: number) => void,
) {
  let prev: GameState | null = null;
  return simulate({
    seed,
    pilot,
    steps,
    onStep: (state, i) => {
      assertInvariants(state, prev);
      prev = state;
      extra?.(state, i);
    },
  });
}

describe("idlePilot: never presses anything", () => {
  it("ends in a loss within 90s of sim time", () => {
    const steps = Math.ceil(150 / SIM_DT); // generous margin past 90s
    const { history } = run(idlePilot, steps);

    const lostAt = history.findIndex((s) => s.end.status === "lost");
    expect(lostAt).toBeGreaterThan(-1);
    expect(lostAt * SIM_DT).toBeLessThanOrEqual(90);
  });
});

describe("thrustPilot: holds W forever", () => {
  it("never leaves the frame, drains fuel, and loses to fuel", () => {
    const steps = Math.ceil(60 / SIM_DT);
    const { final } = run(thrustPilot, steps);

    expect(final.ship.fuel).toBe(0);
    expect(final.end).toEqual({ status: "lost", cause: "fuel" });
  });
});

describe("seekPilot: proportional controller toward the most urgent planet", () => {
  // 28800 steps with a per-tick invariant check is real work, not a hang;
  // the default 5s budget is for a typical unit test, not this one.
  it("completes level 0 within 120s and reaches level 3 within 8 minutes", () => {
    const steps = Math.ceil(480 / SIM_DT);
    let level0DoneAt = -1;
    let level3At = -1;

    const { final } = run(seekPilot, steps, SEED, (state, i) => {
      if (level0DoneAt === -1 && state.level.index >= 1) level0DoneAt = i;
      if (level3At === -1 && state.level.index >= 3) level3At = i;
    });

    expect(level0DoneAt).toBeGreaterThan(-1);
    expect(level0DoneAt * SIM_DT).toBeLessThanOrEqual(120);
    expect(level3At).toBeGreaterThan(-1);
    expect(level3At * SIM_DT).toBeLessThanOrEqual(480);
    expect(final.level.index).toBeGreaterThanOrEqual(3);
  }, 30000);
});

describe("panicPilot: uniformly random input", () => {
  it("never throws, never NaNs, and keeps entity counts bounded", () => {
    const steps = 5000;
    expect(() => run(createPanicPilot(7), steps)).not.toThrow();
  });
});

describe("wallPilot: holds W and D forever", () => {
  it("position stays within the clamp on every single step", () => {
    const steps = Math.ceil(60 / SIM_DT);
    // assertInvariants (invariant 1) already checks the clamp every step;
    // running it to completion without throwing is the assertion itself.
    expect(() => run(wallPilot, steps)).not.toThrow();
  });
});
