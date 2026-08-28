// The eight per-step invariants of §7.2, as one reusable assertion —
// called from every pilot's onStep, never duplicated per pilot.
import { expect } from "vitest";
import { FRAME_HALF_WIDTH, FRAME_HALF_HEIGHT, SHIP_EDGE_MARGIN } from "../src/game/frame.ts";
import { SIM_DT } from "./harness.ts";
import type { GameState } from "../src/game/types.ts";

// §7.2's own literal leak-guard thresholds --- not a game tunable, so
// they live here rather than in src/game/constants.ts.
const MAX_ASTEROIDS = 40;
const MAX_BULLETS = 30;
const MAX_PLANETS = 12;

// Rounding across many adds/subtracts; not a game tunable, purely how
// tightly this test harness holds the invariants to their exact numbers.
const EPS = 1e-6;

function assertFiniteDeep(value: unknown, path: string): void {
  if (typeof value === "number") {
    // invulnUntil's documented sentinel for "never hit yet" (R9) is
    // -Infinity by design (state.ts) --- not a bug. NaN and +Infinity
    // there would still be, and everywhere else -Infinity still is.
    if (path === "state.ship.invulnUntil" && value === -Infinity) return;
    expect(Number.isFinite(value), `${path} is not finite: ${value}`).toBe(true);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => assertFiniteDeep(v, `${path}[${i}]`));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertFiniteDeep(v, `${path}.${k}`);
  }
}

/**
 * Checks all eight invariants for one step's resulting state `curr`.
 * `prev` is the state one tick earlier, or null for the initial state
 * (before any tick has run, so the drift-based invariants don't apply).
 */
export function assertInvariants(curr: GameState, prev: GameState | null): void {
  // 1. Ship stays inside the frame clamp.
  const clampX = FRAME_HALF_WIDTH - SHIP_EDGE_MARGIN;
  const clampY = FRAME_HALF_HEIGHT - SHIP_EDGE_MARGIN;
  expect(Math.abs(curr.ship.position.x)).toBeLessThanOrEqual(clampX + EPS);
  expect(Math.abs(curr.ship.position.y)).toBeLessThanOrEqual(clampY + EPS);

  // 2. No NaN/Infinity anywhere in the state tree.
  assertFiniteDeep(curr, "state");

  // 3. fuel, ammo in [0, 1]; colonists >= 0.
  expect(curr.ship.fuel).toBeGreaterThanOrEqual(0);
  expect(curr.ship.fuel).toBeLessThanOrEqual(1);
  expect(curr.ship.ammo).toBeGreaterThanOrEqual(0);
  expect(curr.ship.ammo).toBeLessThanOrEqual(1);
  expect(curr.ship.colonists).toBeGreaterThanOrEqual(0);

  // 4. The leak guard.
  expect(curr.asteroids.length).toBeLessThanOrEqual(MAX_ASTEROIDS);
  expect(curr.bullets.length).toBeLessThanOrEqual(MAX_BULLETS);
  expect(curr.planets.length).toBeLessThanOrEqual(MAX_PLANETS);

  // 8. Never over-colonized.
  expect(curr.level.colonizedCount).toBeLessThanOrEqual(curr.level.planetsRequired);

  if (!prev) return;

  // 7. Frozen once lost: tick() is idempotent on a lost state, and
  // simulate() keeps ticking for the full step count, so this is
  // exercised every remaining step of the run, not just once.
  if (prev.end.status === "lost") {
    expect(curr).toBe(prev);
    return; // frozen --- none of the drift invariants below apply.
  }

  // A level-up resets scroll.distance to 0 and planets to [] the same
  // tick (advanceLevel) --- invariants 5 and 6 are per-level, so skip
  // them across that boundary rather than treating the reset as a bug.
  if (curr.level.index !== prev.level.index) return;

  // 5. scroll.distance is strictly non-decreasing within a level.
  expect(curr.scroll.distance).toBeGreaterThanOrEqual(prev.scroll.distance);

  // 6. Every planet present before and after this tick fell by at
  // least scroll.speed * dt * 0.99 --- using the speed the drift phase
  // actually ran at, i.e. prev's (advanceLevel only changes it for the
  // *next* tick's drift, and resets planets to [] the same tick anyway).
  const minFall = prev.scroll.speed * SIM_DT * 0.99;
  const prevById = new Map(prev.planets.map((p) => [p.id, p]));
  for (const planet of curr.planets) {
    const before = prevById.get(planet.id);
    if (!before) continue; // newly activated this tick --- nothing to compare.
    expect(before.position.y - planet.position.y).toBeGreaterThanOrEqual(minFall);
  }
}
