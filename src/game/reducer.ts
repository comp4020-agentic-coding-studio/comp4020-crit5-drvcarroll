import {
  AMMO_COST_PER_SHOT,
  ASTEROID_DAMAGE_SCALE,
  BULLET_LIFETIME,
  BULLET_SPEED,
  FLOURISH_DURATION,
  FRAME_HALF_HEIGHT,
  INVULN_DISTANCE,
  LANDING_SPEED_THRESHOLD,
  PLANET_CRASH_DAMAGE_SCALE,
} from "./constants.ts";
import { circlesOverlap, isGentleLanding, resolvePlanetContact } from "./collisions.ts";
import { isOutsideFrame } from "./frame.ts";
import { colonistBatchForLevel, fuelAmmoTopUpFraction, generateLevelPlan, planetsRequiredForLevel } from "./level.ts";
import { advanceScroll, driftEntities, scrollSpeedForLevel } from "./scroll.ts";
import { decideAsteroidSpawn, decidePlanetActivation } from "./spawn.ts";
import { add, fromAngle, length, scale, subtract, type Vec2 } from "./vector.ts";
import { applyGravity } from "./gravity.ts";
import { applyInput } from "./ship.ts";
import type { EndState, GameState, Input, Planet, Ship } from "./types.ts";

// The world drifts, the ship does not (R2): every non-ship entity's y falls
// by scroll.speed*dt, on top of whichever own velocity it already has.
function driftWorld(state: GameState, dt: number): GameState {
  const scroll = advanceScroll(state.scroll, dt);
  const planets = driftEntities(state.planets, dt, scroll.speed);

  const asteroidsMoved = state.asteroids.map((a) => ({
    ...a,
    position: add(a.position, scale(a.velocity, dt)),
  }));
  const asteroids = driftEntities(asteroidsMoved, dt, scroll.speed);

  // Bullets are never scroll-drifted --- only their own velocity moves them.
  const bullets = state.bullets.map((b) => ({
    ...b,
    position: add(b.position, scale(b.velocity, dt)),
    ttl: b.ttl - dt,
  }));

  return { ...state, scroll, planets, asteroids, bullets };
}

function activatePlannedPlanets(state: GameState): GameState {
  const spec = decidePlanetActivation(state.level, state.scroll.distance);
  if (!spec) return state;

  const planet: Planet = {
    id: state.nextId,
    position: { x: spec.lane, y: FRAME_HALF_HEIGHT + spec.radius },
    radius: spec.radius,
    colonistsRequired: spec.colonistsRequired,
    colonized: false,
    driftX: spec.driftX,
    spin: spec.spin,
  };

  return {
    ...state,
    planets: [...state.planets, planet],
    level: { ...state.level, spawnedCount: state.level.spawnedCount + 1 },
    nextId: state.nextId + 1,
  };
}

function spawnAsteroids(state: GameState, dt: number): GameState {
  const { asteroid, rng } = decideAsteroidSpawn(state.rng, {
    levelIndex: state.level.index,
    dt,
  });
  if (!asteroid) return { ...state, rng };

  return {
    ...state,
    rng,
    asteroids: [...state.asteroids, { ...asteroid, id: state.nextId }],
    nextId: state.nextId + 1,
  };
}

function resolveBulletAsteroidHits(state: GameState): GameState {
  const hitAsteroidIds = new Set<number>();
  const survivingBullets = state.bullets.filter((bullet) => {
    const hit = state.asteroids.find(
      (a) => !hitAsteroidIds.has(a.id) && circlesOverlap(bullet.position, 0, a.position, a.radius),
    );
    if (!hit) return true;
    hitAsteroidIds.add(hit.id);
    return false;
  });

  if (hitAsteroidIds.size === 0) return state;
  return {
    ...state,
    bullets: survivingBullets,
    asteroids: state.asteroids.filter((a) => !hitAsteroidIds.has(a.id)),
  };
}

// Shared i-frame gate (R9): a hit while still inside the last hit's
// INVULN_DISTANCE is suppressed entirely --- no damage, no removal either,
// so a charging asteroid isn't given a free kill during i-frames.
function isInvulnerable(state: GameState): boolean {
  return state.scroll.distance < state.ship.invulnUntil;
}

function grantInvuln(ship: Ship, scrollDistance: number): Ship {
  return { ...ship, invulnUntil: scrollDistance + INVULN_DISTANCE };
}

/** Ship+asteroid contact: colonists lost proportional to size, asteroid destroyed. */
export function applyAsteroidHit(state: GameState, asteroidId: number): GameState {
  const asteroid = state.asteroids.find((a) => a.id === asteroidId);
  if (!asteroid || isInvulnerable(state)) return state;

  const damage = Math.ceil(asteroid.radius * ASTEROID_DAMAGE_SCALE);
  return {
    ...state,
    ship: grantInvuln(
      { ...state.ship, colonists: Math.max(0, state.ship.colonists - damage) },
      state.scroll.distance,
    ),
    asteroids: state.asteroids.filter((a) => a.id !== asteroidId),
  };
}

function resolveShipAsteroidHits(state: GameState): GameState {
  const hit = state.asteroids.find((a) => circlesOverlap(state.ship.position, 0, a.position, a.radius));
  return hit ? applyAsteroidHit(state, hit.id) : state;
}

/**
 * Deposits colonists on a gentle, in-range landing and tops up fuel/ammo.
 * A fast pass is a pure no-op --- no deposit, no penalty here (the crash
 * cost is a separate path, applyPlanetCrash, R14).
 */
export function attemptLanding(state: GameState, planetId: number): GameState {
  const planet = state.planets.find((p) => p.id === planetId);
  if (!planet || planet.colonized) return state;

  const planetVelocity = { x: planet.driftX, y: -state.scroll.speed };
  if (!isGentleLanding(state.ship, planet, planetVelocity)) return state;

  const deposit = Math.min(planet.colonistsRequired, state.ship.colonists);
  const topUp = fuelAmmoTopUpFraction(state.level.planetsRequired);

  return {
    ...state,
    ship: {
      ...state.ship,
      colonists: state.ship.colonists - deposit,
      fuel: Math.min(1, state.ship.fuel + topUp),
      ammo: Math.min(1, state.ship.ammo + topUp),
    },
    planets: state.planets.map((p) => (p.id === planetId ? { ...p, colonized: true } : p)),
    level: { ...state.level, colonizedCount: state.level.colonizedCount + 1 },
  };
}

/**
 * A fast planet touch (R14): the surface has already stopped the ship
 * (resolvePlanetContact ran first), so this only charges the colonist cost,
 * scaled by how far over LANDING_SPEED_THRESHOLD the pre-contact relative
 * speed was --- gated by the same i-frames an asteroid hit grants (R9).
 */
export function applyPlanetCrash(
  state: GameState,
  planetVelocity: Vec2,
  preContactVelocity: Vec2,
): GameState {
  if (isInvulnerable(state)) return state;

  const relativeSpeed = length(subtract(preContactVelocity, planetVelocity));
  const damage = Math.ceil((relativeSpeed - LANDING_SPEED_THRESHOLD) * PLANET_CRASH_DAMAGE_SCALE);

  return {
    ...state,
    ship: grantInvuln(
      { ...state.ship, colonists: Math.max(0, state.ship.colonists - damage) },
      state.scroll.distance,
    ),
  };
}

/**
 * Planets are solid (R14): the first uncolonized planet the ship overlaps
 * always gets stopped at the surface, then forks on the *pre-contact*
 * relative speed --- gentle deposits, fast crashes. The fork must read
 * velocity before resolvePlanetContact runs, since contact zeroes the
 * radial component and changes the magnitude the fork depends on.
 */
function resolveShipPlanetContact(state: GameState): GameState {
  const target = state.planets.find(
    (p) => !p.colonized && circlesOverlap(state.ship.position, 0, p.position, p.radius),
  );
  if (!target) return state;

  const planetVelocity = { x: target.driftX, y: -state.scroll.speed };
  const preContactVelocity = state.ship.velocity;
  const gentle = isGentleLanding(state.ship, target, planetVelocity);

  const contacted = { ...state, ship: resolvePlanetContact(state.ship, target, planetVelocity) };

  return gentle
    ? attemptLanding(contacted, target.id)
    : applyPlanetCrash(contacted, planetVelocity, preContactVelocity);
}

// Anything that has fully left the frame is gone; bullets despawn by ttl
// only, decremented during the drift phase.
function despawn(state: GameState): GameState {
  return {
    ...state,
    bullets: state.bullets.filter((b) => b.ttl > 0),
    planets: state.planets.filter((p) => !isOutsideFrame(p.position, p.radius)),
    asteroids: state.asteroids.filter((a) => !isOutsideFrame(a.position, a.radius)),
  };
}

export function fireBullet(state: GameState): GameState {
  if (state.ship.ammo <= 0) return state;
  return {
    ...state,
    ship: { ...state.ship, ammo: Math.max(0, state.ship.ammo - AMMO_COST_PER_SHOT) },
    bullets: [
      ...state.bullets,
      {
        id: state.nextId,
        position: state.ship.position,
        velocity: scale(fromAngle(state.ship.heading), BULLET_SPEED),
        ttl: BULLET_LIFETIME,
      },
    ],
    nextId: state.nextId + 1,
  };
}

/**
 * A fresh, harder level: new plan, colonist batch sized exactly to it,
 * fuel/ammo carried over untouched (Decision 4), scroll reset to the new
 * level's speed. Called from tick() before the loss check ever runs
 * (Decision 2) --- that ordering, not a special case, is what makes the
 * deposit that completes a level a win.
 */
export function advanceLevel(state: GameState): GameState {
  const index = state.level.index + 1;
  const { plan, rng } = generateLevelPlan(index, state.rng);
  return {
    ...state,
    rng,
    planets: [],
    level: { index, plan, spawnedCount: 0, colonizedCount: 0, planetsRequired: planetsRequiredForLevel(index) },
    ship: { ...state.ship, colonists: colonistBatchForLevel(plan) },
    scroll: { speed: scrollSpeedForLevel(index), distance: 0 },
    end: { status: "playing" },
    flourish: { levelIndex: index, ttl: FLOURISH_DURATION },
  };
}

/**
 * Level-complete outranks any loss (Decision 2): a deposit that zeroes
 * colonists while also finishing the level is a win, checked here directly
 * rather than relying on callers to check completion first.
 */
export function checkEndCondition(state: GameState): EndState {
  if (state.level.colonizedCount >= state.level.planetsRequired) return { status: "playing" };
  if (state.ship.colonists <= 0) return { status: "lost", cause: "colonists" };
  if (state.ship.fuel <= 0) return { status: "lost", cause: "fuel" };
  return { status: "playing" };
}

// Tick order follows BUILD_PLAN.md 2.3 exactly: drift -> input/gravity/clamp
// -> spawn -> collide -> despawn -> level -> end.
export function tick(state: GameState, input: Input, dt: number): GameState {
  if (state.end.status === "lost") return state;

  let next = driftWorld(state, dt);

  const pulled = applyGravity(next.ship, next.planets, dt);
  next = { ...next, ship: applyInput(pulled, input, dt) };

  next = activatePlannedPlanets(next);
  next = spawnAsteroids(next, dt);
  if (input.fire) next = fireBullet(next);

  next = resolveBulletAsteroidHits(next);
  next = resolveShipAsteroidHits(next);
  next = resolveShipPlanetContact(next);

  next = despawn(next);

  if (next.level.colonizedCount >= next.level.planetsRequired) {
    return advanceLevel(next);
  }

  return { ...next, end: checkEndCondition(next) };
}
