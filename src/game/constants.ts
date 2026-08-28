// Every tunable number, named. Step 9 (playtesting) retunes these values;
// nothing else in src/game/ should hardcode a magic number.

// Ship physics
export const THRUST_ACCEL = 220; // world units / s^2 while thrusting
export const RETRO_ACCEL = 170; // world units / s^2 while retro-thrusting
export const ROTATE_SPEED = 3.2; // radians / s while rotating
export const FUEL_PER_THRUST_TICK = 0.06; // fraction of full tank / s while thrusting
// Ambient drain, always on --- without it a do-nothing pilot never loses,
// breaking C2's "play ends somewhere" guarantee (R8 finding).
export const FUEL_DRAIN_PASSIVE = 0.0125; // fraction of full tank / s
export const SHIP_DAMPING = 0.6; // per-second exponent: v *= exp(-this * dt)
export const LANDING_SPEED_THRESHOLD = 40; // max speed to register a landing

// Weapons
export const BULLET_SPEED = 600;
export const BULLET_LIFETIME = 1.1; // seconds
export const AMMO_COST_PER_SHOT = 0.05; // fraction of full ammo per shot

// Asteroids
export const ASTEROID_DAMAGE_SCALE = 0.6; // colonists lost = ceil(radius * this)
export const ASTEROID_MIN_RADIUS = 14;
export const ASTEROID_MAX_RADIUS = 42;
export const ASTEROID_SPEED_MIN = 30;
export const ASTEROID_SPEED_MAX = 90;
export const ASTEROID_ANGLE_SPREAD = 0.45; // radians either side of horizontal (R5)
export const ASTEROID_SPIN_MAX = 2; // decorative tumble rate, +/- rad/s
export const BASE_ASTEROID_RATE = 0.15; // spawns / s at level 0
export const DIFFICULTY_STEP = 0.35; // spawn-rate growth per level

// Scroll (world drift speed --- see BUILD_PLAN.md Decision R2)
export const SCROLL_SPEED_BASE = 95; // world units / s at level 0
export const SCROLL_SPEED_PER_LEVEL = 18;
export const SCROLL_SPEED_MAX = 220;

// Planets
export const PLANET_MIN_RADIUS = 30;
export const PLANET_MAX_RADIUS = 70;
export const REQ_PER_RADIUS = 0.9; // colonistsRequired = round(radius * this)
export const PLANET_GAP_SCROLL = 520; // was 900 --- the "spawns halfway through" fix (R6)
export const PLANET_DRIFT_MAX = 14; // +/- lateral drift, so planet columns don't line up
export const PLANET_SPIN_MAX = 1; // decorative spin rate, +/- rad/s
export const BASE_PLANETS_PER_LEVEL = 3;
export const MAX_PLANETS_PER_LEVEL = 10;
// The opening frame's pre-activated planet sits at this fraction of
// FRAME_HALF_HEIGHT --- already in view on the first frame, with no
// instruction needed to say "look, a planet".
export const OPENING_PLANET_FRAC = 0.55;
// Colonists lost = ceil(excess relative speed * this) on a fast planet
// touch (R14) --- mirrors ASTEROID_DAMAGE_SCALE's formula shape.
export const PLANET_CRASH_DAMAGE_SCALE = 0.08;

// Frame (the fixed play area a scrolling world drifts through --- see
// BUILD_PLAN.md Decision R1/R2)
export const FRAME_HALF_WIDTH = 360; // frame is 720 world units wide
export const FRAME_HALF_HEIGHT = 450; // frame is 900 world units tall
export const SHIP_EDGE_MARGIN = 18; // clamp inset, so the rocket never half-exits

// Gravity
export const GRAVITY_RADIUS_MULT = 6; // well radius = planet.radius * this
export const GRAVITY_STRENGTH = 4000; // accel = this * radius / distSq, capped
export const GRAVITY_MAX_ACCEL = 90; // world units / s^2, holds near the surface
export const GRAVITY_SOFTENING = 400; // added to distSq so pull can't spike

// Invulnerability (R9): odometer units of i-frames after a hit, so repeated
// overlap across ticks can't charge colonist damage more than once.
export const INVULN_DISTANCE = 60;

// UI
export const FLOURISH_DURATION = 1.2; // seconds the level-up flash is shown
