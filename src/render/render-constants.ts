// Visual-only tunables --- never imported by src/game/*.

// Colour is the §5.3 palette; materials.ts is the single source of truth,
// re-exported here so existing mesh-file imports need no change.
export {
  ASTEROID_COLOR,
  BULLET_COLOR,
  ENGINE_GLOW_COLOR,
  LANDING_RING_COLOR,
  PLANET_COLONIZED_LIGHTNESS,
  PLANET_HUE_STEP,
  PLANET_LIGHTNESS,
  PLANET_SATURATION,
  SHIP_COLOR,
} from "./materials.ts";

export const CAMERA_HEIGHT = 420;
