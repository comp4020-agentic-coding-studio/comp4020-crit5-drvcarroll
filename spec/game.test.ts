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
import { asteroidSpawnRatePerSecond } from "../src/game/spawn.ts";

const SEED = { seed: 1 };
const NO_INPUT = {
  rotateLeft: false,
  rotateRight: false,
  thrust: false,
  fire: false,
};

describe("C2: a wrong move is possible, and play ends somewhere", () => {
  it("air is the death clock --- empty air is a loss, empty fuel is not", () => {
    const base = createInitialState(SEED);
    expect(checkEndCondition({ ...base, ship: { ...base.ship, air: 0 } })).toEqual({
      status: "lost",
      cause: "air",
    });
    expect(checkEndCondition({ ...base, ship: { ...base.ship, fuel: 0, ammo: 0 } })).toEqual({
      status: "playing",
    });
  });

  it("an asteroid hit that vents the last of the air is a loss", () => {
    const base = createInitialState(SEED);
    const asteroid = { id: 1, position: base.ship.position, velocity: { x: 0, y: 0 }, radius: 20, spin: 0 };
    const hit = applyAsteroidHit(
      { ...base, ship: { ...base.ship, air: 0.01 }, asteroids: [asteroid] },
      1,
    );
    expect(hit.ship.air).toBe(0);
    expect(checkEndCondition(hit)).toEqual({ status: "lost", cause: "air" });
  });

  it("tick freezes the run once it has been lost --- play has ended", () => {
    const base = createInitialState(SEED);
    const lost = { ...base, end: { status: "lost" as const, cause: "air" as const } };
    expect(tick(lost, { ...NO_INPUT, thrust: true }, 1 / 60)).toBe(lost);
  });
});

describe("C2: landing is the only way to buy more time", () => {
  it("a gentle touchdown refills every tank at once", () => {
    const base = createInitialState(SEED);
    const planet = base.planets[0];
    const arriving = {
      ...base,
      ship: {
        ...base.ship,
        air: 0.2,
        fuel: 0.2,
        ammo: 0.2,
        position: planet.position,
        // Gentle is relative to the planet's own drift (R5), not zero.
        velocity: { x: planet.driftX, y: -base.scroll.speed },
      },
    };

    const landed = attemptLanding(arriving, planet.id);

    expect(landed.ship.air).toBe(1);
    expect(landed.ship.fuel).toBe(1);
    expect(landed.ship.ammo).toBe(1);
    expect(landed.planets.find((p) => p.id === planet.id)?.colonized).toBe(true);
  });
});

describe("the run escalates, and never runs dry of planets", () => {
  it("asteroids arrive faster the further the run goes", () => {
    expect(asteroidSpawnRatePerSecond(30_000)).toBeGreaterThan(asteroidSpawnRatePerSecond(0));
  });

  it("a planet is always already booked ahead on the odometer", () => {
    let state = createInitialState(SEED);
    for (let i = 0; i < 120 * 120; i++) {
      state = tick(state, NO_INPUT, 1 / 120);
      expect(state.nextPlanetScroll).toBeGreaterThan(state.scroll.distance);
    }
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
