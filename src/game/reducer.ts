import { AMMO_COST_PER_SHOT, ASTEROID_DAMAGE_SCALE, BULLET_LIFETIME, BULLET_SPEED, DESPAWN_BEHIND, FLOURISH_DURATION } from "./constants.ts";
import { circlesOverlap, isGentleLanding } from "./collisions.ts";
import { colonistBatchForLevel, fuelAmmoTopUpFraction, generateLevelPlan, planetsRequiredForLevel } from "./level.ts";
import { decideAsteroidSpawn, decidePlanetActivation } from "./spawn.ts";
import { add, fromAngle, scale } from "./vector.ts";
import { applyInput } from "./ship.ts";
import type { EndState, GameState, Input, Planet } from "./types.ts";

function advanceProjectiles(state: GameState, dt: number): GameState {
  const bullets = state.bullets
    .map((b) => ({ ...b, position: add(b.position, scale(b.velocity, dt)), ttl: b.ttl - dt }))
    .filter((b) => b.ttl > 0);

  const asteroids = state.asteroids
    .map((a) => ({ ...a, position: add(a.position, scale(a.velocity, dt)) }))
    .filter((a) => state.ship.position.y - a.position.y < DESPAWN_BEHIND);

  return { ...state, bullets, asteroids };
}

function activatePlannedPlanets(state: GameState): GameState {
  const spec = decidePlanetActivation(state.level, state.scrollY);
  if (!spec) return state;

  const planet: Planet = {
    id: state.nextId,
    position: { x: spec.lane, y: spec.scrollY },
    radius: spec.radius,
    colonistsRequired: spec.colonistsRequired,
    colonized: false,
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
    scrollY: state.scrollY,
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

/** Ship+asteroid contact: colonists lost proportional to size, asteroid destroyed. */
export function applyAsteroidHit(state: GameState, asteroidId: number): GameState {
  const asteroid = state.asteroids.find((a) => a.id === asteroidId);
  if (!asteroid) return state;
  const damage = Math.ceil(asteroid.radius * ASTEROID_DAMAGE_SCALE);
  return {
    ...state,
    ship: { ...state.ship, colonists: Math.max(0, state.ship.colonists - damage) },
    asteroids: state.asteroids.filter((a) => a.id !== asteroidId),
  };
}

function resolveShipAsteroidHits(state: GameState): GameState {
  const hit = state.asteroids.find((a) => circlesOverlap(state.ship.position, 0, a.position, a.radius));
  return hit ? applyAsteroidHit(state, hit.id) : state;
}

/**
 * Deposits colonists on a gentle, in-range landing and tops up fuel/ammo.
 * A fast pass is a pure no-op --- no deposit, no penalty (Decision 3):
 * a second unstated wrong-move mechanism would dilute C2's one loss path.
 */
export function attemptLanding(state: GameState, planetId: number): GameState {
  const planet = state.planets.find((p) => p.id === planetId);
  if (!planet || planet.colonized || !isGentleLanding(state.ship, planet)) return state;

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

function resolveShipPlanetLandings(state: GameState): GameState {
  const target = state.planets.find((p) => !p.colonized && isGentleLanding(state.ship, p));
  return target ? attemptLanding(state, target.id) : state;
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
 * fuel/ammo carried over untouched (Decision 4). Called from tick() before
 * the loss check ever runs (Decision 2) --- that ordering, not a special
 * case, is what makes the deposit that completes a level a win.
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

export function tick(state: GameState, input: Input, dt: number): GameState {
  if (state.end.status === "lost") return state;

  let next = { ...state, ship: applyInput(state.ship, input, dt) };
  next = { ...next, scrollY: Math.max(next.scrollY, next.ship.position.y) };
  next = advanceProjectiles(next, dt);
  next = activatePlannedPlanets(next);
  next = spawnAsteroids(next, dt);
  if (input.fire) next = fireBullet(next);
  next = resolveBulletAsteroidHits(next);
  next = resolveShipAsteroidHits(next);
  next = resolveShipPlanetLandings(next);

  if (next.level.colonizedCount >= next.level.planetsRequired) {
    return advanceLevel(next);
  }

  return { ...next, end: checkEndCondition(next) };
}
