import {
  AMMO_COST_PER_SHOT,
  ASTEROID_AIR_DAMAGE_SCALE,
  BULLET_LIFETIME,
  BULLET_SPEED,
  FIRE_COOLDOWN,
  FRAME_HALF_HEIGHT,
  INVULN_DISTANCE,
  LANDING_SPEED_THRESHOLD,
  PLANET_CRASH_DAMAGE_SCALE,
  PLANET_GAP_SCROLL,
  REFILL_ON_LANDING,
} from "./constants.ts";
import { circlesOverlap, isGentleLanding, resolvePlanetContact } from "./collisions.ts";
import { clampToFrame, isOutsideFrame } from "./frame.ts";
import { advanceScroll, driftEntities } from "./scroll.ts";
import { decideAsteroidSpawn, rollPlanetSpec } from "./spawn.ts";
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

// The endless-run replacement for a finite level plan: once the odometer
// reaches nextPlanetScroll, roll a planet and book the one after it. A
// missed landing costs the resupply, never the supply of planets.
function spawnScheduledPlanet(state: GameState): GameState {
  if (state.scroll.distance < state.nextPlanetScroll) return state;

  const { spec, rng } = rollPlanetSpec(state.rng);
  const planet: Planet = {
    id: state.nextId,
    position: { x: spec.lane, y: FRAME_HALF_HEIGHT + spec.radius },
    radius: spec.radius,
    colonized: false,
    driftX: spec.driftX,
    spin: spec.spin,
  };

  return {
    ...state,
    rng,
    planets: [...state.planets, planet],
    nextId: state.nextId + 1,
    nextPlanetScroll: state.nextPlanetScroll + PLANET_GAP_SCROLL,
  };
}

function spawnAsteroids(state: GameState, dt: number): GameState {
  const { asteroid, rng } = decideAsteroidSpawn(state.rng, {
    scrollDistance: state.scroll.distance,
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

function ventAir(ship: Ship, amount: number, scrollDistance: number): Ship {
  return {
    ...ship,
    air: Math.max(0, ship.air - amount),
    invulnUntil: scrollDistance + INVULN_DISTANCE,
  };
}

/** Ship+asteroid contact: air vented proportional to size, asteroid destroyed. */
export function applyAsteroidHit(state: GameState, asteroidId: number): GameState {
  const asteroid = state.asteroids.find((a) => a.id === asteroidId);
  if (!asteroid || isInvulnerable(state)) return state;

  return {
    ...state,
    ship: ventAir(state.ship, asteroid.radius * ASTEROID_AIR_DAMAGE_SCALE, state.scroll.distance),
    asteroids: state.asteroids.filter((a) => a.id !== asteroidId),
  };
}

function resolveShipAsteroidHits(state: GameState): GameState {
  const hit = state.asteroids.find((a) => circlesOverlap(state.ship.position, 0, a.position, a.radius));
  return hit ? applyAsteroidHit(state, hit.id) : state;
}

/**
 * A gentle, in-range touchdown resupplies every tank and spends the planet.
 * A fast pass is a pure no-op here --- the crash cost is a separate path,
 * applyPlanetCrash (R14).
 */
export function attemptLanding(state: GameState, planetId: number): GameState {
  const planet = state.planets.find((p) => p.id === planetId);
  if (!planet || planet.colonized) return state;

  const planetVelocity = { x: planet.driftX, y: -state.scroll.speed };
  if (!isGentleLanding(state.ship, planet, planetVelocity)) return state;

  const topUp = (level: number) => Math.min(1, level + REFILL_ON_LANDING);

  return {
    ...state,
    ship: {
      ...state.ship,
      air: topUp(state.ship.air),
      fuel: topUp(state.ship.fuel),
      ammo: topUp(state.ship.ammo),
    },
    planets: state.planets.map((p) => (p.id === planetId ? { ...p, colonized: true } : p)),
  };
}

/**
 * A fast planet touch (R14): the surface has already stopped the ship
 * (resolvePlanetContact ran first), so this only charges the air cost,
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
  const excess = Math.max(0, relativeSpeed - LANDING_SPEED_THRESHOLD);

  return {
    ...state,
    ship: ventAir(state.ship, excess * PLANET_CRASH_DAMAGE_SCALE, state.scroll.distance),
  };
}

/**
 * Planets are solid (R14): the first unspent planet the ship overlaps
 * always gets stopped at the surface, then forks on the *pre-contact*
 * relative speed --- gentle resupplies, fast crashes. The fork must read
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

  // The surface point can sit past the frame clamp near a large planet
  // close to the edge (R8 finding) --- Decision R3 says the ship never
  // leaves the frame, so reclamp same as any other contact.
  const contacted = {
    ...state,
    ship: clampToFrame(resolvePlanetContact(state.ship, target, planetVelocity)),
  };

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

// Cooldown-gated, so a held fire key spends the clip over seconds rather
// than over two ticks of a 120Hz loop.
export function fireBullet(state: GameState): GameState {
  if (state.ship.ammo <= 0 || state.ship.fireCooldown > 0) return state;
  return {
    ...state,
    ship: {
      ...state.ship,
      ammo: Math.max(0, state.ship.ammo - AMMO_COST_PER_SHOT),
      fireCooldown: FIRE_COOLDOWN,
    },
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
 * Air is the only death clock (Decision 2, amended): an empty fuel tank or
 * an empty clip is a squeeze, not an ending --- it just makes the next
 * planet, and so the next lungful, much harder to reach.
 */
export function checkEndCondition(state: GameState): EndState {
  if (state.ship.air <= 0) return { status: "lost", cause: "air" };
  return { status: "playing" };
}

// Tick order follows BUILD_PLAN.md 2.3: drift -> input/gravity/clamp ->
// spawn -> collide -> despawn -> end.
export function tick(state: GameState, input: Input, dt: number): GameState {
  if (state.end.status === "lost") return state;

  let next = driftWorld(state, dt);

  const pulled = applyGravity(next.ship, next.planets, dt);
  next = { ...next, ship: applyInput(pulled, input, dt) };

  next = spawnScheduledPlanet(next);
  next = spawnAsteroids(next, dt);
  if (input.fire) next = fireBullet(next);

  next = resolveBulletAsteroidHits(next);
  next = resolveShipAsteroidHits(next);
  next = resolveShipPlanetContact(next);

  next = despawn(next);

  return { ...next, end: checkEndCondition(next) };
}
