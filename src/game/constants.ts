// Every tunable number, named. Step 9 (playtesting) retunes these values;
// nothing else in src/game/ should hardcode a magic number.

// Ship physics --- space has no friction and the rocket has one engine
// (Decision R4): velocity is never damped, and thrust only ever pushes
// along the heading. Slowing down means turning around and burning.
export const THRUST_ACCEL = 220; // world units / s^2 while thrusting
export const ROTATE_SPEED = 3.2; // radians / s while rotating
export const LANDING_SPEED_THRESHOLD = 55; // max relative speed a landing survives

// Resources. Air is the death clock and drains no matter what the pilot
// does (C2's "play ends somewhere"); fuel and ammo are spent only by the
// engine and the gun, so an empty tank is a squeeze, not an instant loss.
export const AIR_DRAIN_RATE = 0.022; // fraction of full tank / s --- ~45s from full
export const FUEL_PER_ENGINE_SECOND = 0.09; // fraction / s while the engine burns
export const REFILL_ON_LANDING = 1; // fraction restored to every tank per landing

// Weapons
export const BULLET_SPEED = 600;
export const BULLET_LIFETIME = 1.1; // seconds
export const AMMO_COST_PER_SHOT = 0.05; // fraction of full ammo per shot
export const FIRE_COOLDOWN = 0.18; // seconds --- without this a held key empties the clip in a tick or two

// Asteroids
export const ASTEROID_AIR_DAMAGE_SCALE = 0.006; // air lost = radius * this
export const ASTEROID_MIN_RADIUS = 14;
export const ASTEROID_MAX_RADIUS = 42;
export const ASTEROID_SPEED_MIN = 30;
export const ASTEROID_SPEED_MAX = 90;
export const ASTEROID_ANGLE_SPREAD = 0.45; // radians either side of horizontal (R5)
export const ASTEROID_SPIN_MAX = 2; // decorative tumble rate, +/- rad/s

// Difficulty. The run is endless, so intensity ramps with odometer
// distance rather than a level counter, and both curves cap so a long run
// stays flyable instead of turning into a wall of rock.
export const BASE_ASTEROID_RATE = 0.35; // spawns / s at distance 0
export const ASTEROID_RATE_GROWTH = 0.00032; // rate multiplier gained per odometer unit
export const ASTEROID_RATE_MAX = 2.6; // spawns / s ceiling

// Scroll (world drift speed --- see BUILD_PLAN.md Decision R2)
export const SCROLL_SPEED_BASE = 68; // world units / s at distance 0
export const SCROLL_SPEED_GROWTH = 0.0045; // units/s gained per odometer unit
export const SCROLL_SPEED_MAX = 165;

// Planets
export const PLANET_MIN_RADIUS = 30;
export const PLANET_MAX_RADIUS = 70;
export const PLANET_GAP_SCROLL = 520; // odometer units between scheduled planets
export const PLANET_DRIFT_MAX = 14; // +/- lateral drift, so planet columns don't line up
export const PLANET_SPIN_MAX = 1; // decorative spin rate, +/- rad/s
// The opening frame's pre-placed planet sits at this fraction of
// FRAME_HALF_HEIGHT --- already in view on the first frame, with no
// instruction needed to say "look, a planet".
export const OPENING_PLANET_FRAC = 0.55;
// Air lost = excess relative speed * this on a fast planet touch (R14) ---
// mirrors ASTEROID_AIR_DAMAGE_SCALE's formula shape.
export const PLANET_CRASH_DAMAGE_SCALE = 0.001;

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
// overlap across ticks can't charge air damage more than once.
export const INVULN_DISTANCE = 60;
