import type { RngState } from "./rng.ts";
import type { Vec2 } from "./vector.ts";

export type { Vec2, RngState };

export interface Ship {
  position: Vec2;
  heading: number; // radians, 0 = +x, ccw
  velocity: Vec2; // inertial, frictionless (Decision R4)
  air: number; // 0..1, constant drain --- the only death clock
  fuel: number; // 0..1, spent by the engine only
  ammo: number; // 0..1
  thrusting: boolean; // true while forward thrust fired this tick
  fireCooldown: number; // seconds until the next shot is allowed
  invulnUntil: number; // scroll-odometer value; re-damage suppressed below it (R9)
}

export interface Planet {
  id: number;
  position: Vec2;
  radius: number;
  colonized: boolean; // spent: already resupplied the ship once
  driftX: number; // small lateral drift, so columns don't line up
  spin: number; // render-only decoration, stored for determinism
}

export interface Asteroid {
  id: number;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  spin: number; // deterministic tumble rate, render-only
}

export interface Bullet {
  id: number;
  position: Vec2;
  velocity: Vec2;
  ttl: number; // seconds remaining
}

// Everything a planet needs that isn't derived from where it entered.
export interface PlanetSpec {
  lane: number;
  radius: number;
  driftX: number;
  spin: number;
}

// Odometer, not a camera position: distance drifted, and the speed that
// drift is currently happening at (see BUILD_PLAN.md 2.2).
export interface Scroll {
  speed: number;
  distance: number;
}

export type EndState =
  | { status: "playing" }
  | { status: "lost"; cause: "air" };

export interface Input {
  rotateLeft: boolean;
  rotateRight: boolean;
  thrust: boolean;
  fire: boolean;
}

export interface GameState {
  ship: Ship;
  planets: Planet[];
  asteroids: Asteroid[];
  bullets: Bullet[];
  scroll: Scroll;
  rng: RngState;
  end: EndState;
  nextId: number;
  // The run never ends, so planets are scheduled by odometer rather than
  // drawn from a finite level plan: the next one is due at this distance.
  nextPlanetScroll: number;
}
