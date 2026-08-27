// Every tunable number, named. Step 9 (playtesting) retunes these values;
// nothing else in src/game/ should hardcode a magic number.

// Ship physics
export const THRUST_ACCEL = 220; // world units / s^2 while thrusting
export const ROTATE_SPEED = 3.2; // radians / s while rotating
export const FUEL_PER_THRUST_TICK = 0.06; // fraction of full tank / s while thrusting
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
export const BASE_ASTEROID_RATE = 0.15; // spawns / s at level 0
export const DIFFICULTY_STEP = 0.35; // spawn-rate growth per level

// Planets
export const PLANET_MIN_RADIUS = 30;
export const PLANET_MAX_RADIUS = 70;
export const REQ_PER_RADIUS = 0.9; // colonistsRequired = round(radius * this)
export const PLANET_GAP_SCROLL = 900; // world units of scroll between planets
export const BASE_PLANETS_PER_LEVEL = 3;
export const MAX_PLANETS_PER_LEVEL = 10;

// World
export const LANE_HALF_WIDTH = 340; // horizontal play-field half-width

// UI
export const FLOURISH_DURATION = 1.2; // seconds the level-up flash is shown
