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
  it("burns the tank dry, then still dies of air --- fuel alone never ends a run", () => {
    const steps = Math.ceil(90 / SIM_DT);
    const { history, final } = run(thrustPilot, steps);

    const dryAt = history.findIndex((s) => s.ship.fuel === 0);
    const lostAt = history.findIndex((s) => s.end.status === "lost");
    expect(dryAt).toBeGreaterThan(-1);
    expect(lostAt).toBeGreaterThan(dryAt); // survived a while on an empty tank
    expect(final.end).toEqual({ status: "lost", cause: "air" });
  });
});

describe("seekPilot: proportional controller toward the most urgent planet", () => {
  // 28800 steps with a per-tick invariant check is real work, not a hang;
  // the default 5s budget is for a typical unit test, not this one.
  it("resupplies often enough to outlive the air clock many times over", () => {
    const steps = Math.ceil(480 / SIM_DT);
    const seen = new Set<number>();
    let landings = 0;

    const { history } = run(seekPilot, steps, SEED, (state) => {
      for (const planet of state.planets) {
        if (planet.colonized && !seen.has(planet.id)) {
          seen.add(planet.id);
          landings++;
        }
      }
    });

    // A full tank is ~45s of air, so lasting minutes is only possible by
    // landing repeatedly. The bot does eventually lose --- the escalating
    // scroll outruns its controller --- which is the difficulty curve
    // working, not a regression. Both numbers guard that curve's shape.
    const lostAt = history.findIndex((s) => s.end.status === "lost");
    expect(landings).toBeGreaterThanOrEqual(10);
    expect(lostAt === -1 ? steps * SIM_DT : lostAt * SIM_DT).toBeGreaterThanOrEqual(120);
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
