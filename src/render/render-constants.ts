// Visual-only tunables --- never imported by src/game/*.
export const CAMERA_HEIGHT = 420;
export const CAMERA_BACK_OFFSET = 260;
export const VIEW_HALF_HEIGHT = 380;
// Frames ahead-of-ship space rather than centring on the ship exactly ---
// what's coming (planets, asteroids) matters more than what's passed.
export const CAMERA_LOOK_AHEAD = 220;
export const ENGINE_GLOW_COLOR = 0xff8a3d;
export const SHIP_COLOR = 0x6cf0ff;
// Per-id hue (Decision 9): a fixed golden-angle step spaces ids evenly
// around the wheel instead of drawing from the full random range, so
// nearby ids can't land on near-identical hues by chance.
export const PLANET_HUE_STEP = 0.6180339887;
export const PLANET_SATURATION = 0.55;
export const PLANET_LIGHTNESS = 0.5;
export const PLANET_COLONIZED_LIGHTNESS = 0.26;
export const ASTEROID_COLOR = 0x8a8a8a;
export const BULLET_COLOR = 0xffe066;
