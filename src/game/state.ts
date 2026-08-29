import { FRAME_HALF_HEIGHT, OPENING_PLANET_FRAC, PLANET_GAP_SCROLL } from "./constants.ts";
import { rollPlanetSpec } from "./spawn.ts";
import { scrollSpeedForDistance } from "./scroll.ts";
import type { GameState, Planet } from "./types.ts";
import type { RngState } from "./rng.ts";

// A fresh run: full tanks, one planet already placed inside the frame at
// OPENING_PLANET_FRAC (rather than waiting on the odometer) so the opening
// frame has something in view to react to --- the affordance the "no
// instructions" spec line asks for --- and the ship pointing "up", the
// direction scroll and the world both advance in.
export function createInitialState(seed: RngState): GameState {
  const { spec, rng } = rollPlanetSpec(seed);

  const firstPlanet: Planet = {
    id: 1,
    position: { x: spec.lane, y: FRAME_HALF_HEIGHT * OPENING_PLANET_FRAC },
    radius: spec.radius,
    colonized: false,
    driftX: spec.driftX,
    spin: spec.spin,
  };

  return {
    ship: {
      position: { x: 0, y: 0 },
      heading: Math.PI / 2,
      velocity: { x: 0, y: 0 },
      air: 1,
      fuel: 1,
      ammo: 1,
      thrusting: false,
      fireCooldown: 0,
      invulnUntil: -Infinity,
    },
    planets: [firstPlanet],
    asteroids: [],
    bullets: [],
    scroll: { speed: scrollSpeedForDistance(0), distance: 0 },
    rng,
    end: { status: "playing" },
    nextId: 2,
    nextPlanetScroll: PLANET_GAP_SCROLL,
  };
}
