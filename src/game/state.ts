import { FRAME_HALF_HEIGHT, OPENING_PLANET_FRAC } from "./constants.ts";
import { colonistBatchForLevel, generateLevelPlan, planetsRequiredForLevel } from "./level.ts";
import type { GameState, Planet } from "./types.ts";
import type { RngState } from "./rng.ts";

// A fresh run: level 0's plan generated whole, its first planet already
// placed inside the frame at OPENING_PLANET_FRAC (not scheduled at its
// plan-generated atScroll) so the opening frame has something in view to
// react to (the affordance the "no instructions" spec line asks for), ship
// pointing "up" (the direction scroll and the world both advance in).
export function createInitialState(seed: RngState): GameState {
  const { plan, rng } = generateLevelPlan(0, seed);
  const planetsRequired = planetsRequiredForLevel(0);
  const firstSpec = plan.planets[0];

  const firstPlanet: Planet = {
    id: 1,
    position: { x: firstSpec.lane, y: FRAME_HALF_HEIGHT * OPENING_PLANET_FRAC },
    radius: firstSpec.radius,
    colonistsRequired: firstSpec.colonistsRequired,
    colonized: false,
    driftX: firstSpec.driftX,
    spin: firstSpec.spin,
  };

  return {
    ship: {
      position: { x: 0, y: 0 },
      heading: Math.PI / 2,
      velocity: { x: 0, y: 0 },
      colonists: colonistBatchForLevel(plan),
      fuel: 1,
      ammo: 1,
      thrusting: false,
    },
    planets: [firstPlanet],
    asteroids: [],
    bullets: [],
    level: {
      index: 0,
      plan,
      spawnedCount: 1,
      colonizedCount: 0,
      planetsRequired,
    },
    scrollY: 0,
    rng,
    end: { status: "playing" },
    nextId: 2,
    flourish: null,
  };
}
