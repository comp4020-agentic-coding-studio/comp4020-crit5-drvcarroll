// §5.3's palette, defined once. styles.css's :root mirrors these values
// exactly so the DOM HUD and the WebGL scene cannot drift apart.
export const PALETTE = {
  void: 0x05060f,
  voidLift: 0x0c1024,
  accent: 0x6cf0ff,
  accentDim: 0x2b6b78,
  warn: 0xffb347,
  danger: 0xff5470,
  rock: 0x7d8496,
  starNear: 0xffffff,
  starMid: 0xc9d4ff,
  starFar: 0x6b7699,
} as const;

// Renamed aliases for render-constants.ts's existing call sites --- same
// values as PALETTE, kept separate so a mesh file's import name still
// reads "what this colours" rather than "which token it is".
export const SHIP_COLOR = PALETTE.accent;
export const ENGINE_GLOW_COLOR = PALETTE.warn;
export const ASTEROID_COLOR = PALETTE.rock;

// No §5.3 token covers "ammo" distinctly from accent/warn/danger, and
// danger is reserved for the <25% critical meter state (§6.3). Ammo keeps
// its own hue, paired with the bullets it fires.
export const BULLET_COLOR = 0xffe066;

// The pulsing "land here" halo on an unspent planet: accent, the same
// token the ship wears, so the affordance reads as "yours to reach".
export const LANDING_RING_COLOR = PALETTE.accent;

// Per-id hue (Decision 9): a fixed golden-angle step spaces ids evenly
// around the wheel instead of drawing from the full random range, so
// nearby ids can't land on near-identical hues by chance.
export const PLANET_HUE_STEP = 0.6180339887;
export const PLANET_SATURATION = 0.55;
export const PLANET_LIGHTNESS = 0.52;
// Not a §5.3 token --- an existing tuning decision, unchanged.
export const PLANET_COLONIZED_LIGHTNESS = 0.26;
