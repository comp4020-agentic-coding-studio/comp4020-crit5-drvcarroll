// This week's contract (BUILD_PLAN.md, "the published spec, sorted").
// C2/C3 checkable lines. Runs against src/game/* directly (no `three`, no
// browser) except the C3 case, which loads the BUILT page (`pnpm build`
// first, same as invariants.test.ts).
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/game/state.ts";
import {
  applyAsteroidHit,
  attemptLanding,
  checkEndCondition,
  tick,
} from "../src/game/reducer.ts";
import {
  colonistBatchForLevel,
  generateLevelPlan,
  planetsRequiredForLevel,
} from "../src/game/level.ts";

const SEED = { seed: 1 };
const NO_INPUT = {
  rotateLeft: false,
  rotateRight: false,
  thrust: false,
  retro: false,
  fire: false,
};

describe("C2: a wrong move is possible, and play ends somewhere", () => {
  it("fuel hitting zero before the level's planet count is reached is a loss", () => {
    const base = createInitialState(SEED);
    const state = { ...base, ship: { ...base.ship, fuel: 0 } };
    expect(checkEndCondition(state)).toEqual({ status: "lost", cause: "fuel" });
  });

  it("an asteroid hit that zeroes colonists before the requirement is met is a loss", () => {
    const base = createInitialState(SEED);
    const asteroid = { id: 1, position: base.ship.position, velocity: { x: 0, y: 0 }, radius: 20, spin: 0 };
    const hit = applyAsteroidHit(
      { ...base, ship: { ...base.ship, colonists: 1 }, asteroids: [asteroid] },
      1,
    );
    expect(hit.ship.colonists).toBe(0);
    expect(checkEndCondition(hit)).toEqual({ status: "lost", cause: "colonists" });
  });

  it("tick freezes the run once it has been lost --- play has ended", () => {
    const base = createInitialState(SEED);
    const lost = { ...base, end: { status: "lost" as const, cause: "fuel" as const } };
    expect(tick(lost, { ...NO_INPUT, thrust: true }, 1 / 60)).toBe(lost);
  });
});

describe("C2 / J2: level-complete takes precedence over a same-instant colonist-zero", () => {
  it("the landing that deposits the last colonist and also completes the level is a win, not a loss", () => {
    const base = createInitialState(SEED);
    const oneAway = {
      ...base,
      level: { ...base.level, colonizedCount: base.level.planetsRequired - 1 },
    };
    const planet = oneAway.planets[0];
    const arriving = {
      ...oneAway,
      ship: {
        ...oneAway.ship,
        colonists: planet.colonistsRequired,
        position: planet.position,
        velocity: { x: 0, y: 0 },
      },
    };

    const landed = attemptLanding(arriving, planet.id);

    expect(landed.ship.colonists).toBe(0);
    expect(landed.level.colonizedCount).toBe(arriving.level.planetsRequired);
    // Loss check alone must NOT see this as a loss --- tick()'s ordering
    // (level-complete resolved first) is what makes it a win overall.
    expect(checkEndCondition(landed)).toEqual({ status: "playing" });
  });
});

describe("level progression is generated, not hand-authored", () => {
  it("planetsRequiredForLevel grows with level index", () => {
    expect(planetsRequiredForLevel(3)).toBeGreaterThan(planetsRequiredForLevel(1));
  });

  it("a fresh colonist batch exactly covers the level's total planet requirement", () => {
    const { plan } = generateLevelPlan(2, SEED);
    const total = plan.planets.reduce((sum, p) => sum + p.colonistsRequired, 0);
    expect(colonistBatchForLevel(plan)).toBe(total);
  });
});

describe("C3 (checkable half): no instructions anywhere in the built page", () => {
  const doc = new JSDOM(readFileSync("dist/index.html", "utf8")).window.document;

  it("carries no help/tutorial markup", () => {
    expect(
      doc.querySelector('[data-help], [class*="help" i], [class*="tutorial" i], [class*="instructions" i]'),
    ).toBeNull();
  });

  it("has no on-screen prose beyond the visually-hidden title and skip-link", () => {
    const visibleText = Array.from(doc.body.querySelectorAll("*"))
      .filter((el) => !el.classList.contains("visually-hidden") && !el.closest(".visually-hidden"))
      .map((el) => el.textContent?.trim())
      .join("");
    expect(visibleText, `found on-screen text: "${visibleText}"`).toBe("");
  });
});
