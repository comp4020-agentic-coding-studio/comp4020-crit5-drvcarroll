import type { RngState } from "./rng.ts";
import type { Vec2 } from "./vector.ts";

export type { Vec2, RngState };

export interface Ship {
  position: Vec2;
  heading: number; // radians, 0 = +x, ccw
  velocity: Vec2; // inertial, with light exponential damping (Decision R4)
  colonists: number;
  fuel: number; // 0..1
  ammo: number; // 0..1
  thrusting: boolean; // true while forward thrust fired this tick
  invulnUntil: number; // scroll-odometer value; re-damage suppressed below it (R9)
}

export interface Planet {
  id: number;
  position: Vec2;
  radius: number;
  colonistsRequired: number;
  colonized: boolean;
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

export interface PlanetSpec {
  atScroll: number; // odometer distance at which this planet activates
  lane: number;
  radius: number;
  colonistsRequired: number;
  driftX: number;
  spin: number;
}

export interface LevelPlan {
  index: number;
  planets: PlanetSpec[];
}

// Odometer, not a camera position: distance drifted, and the speed that
// drift is currently happening at (see BUILD_PLAN.md 2.2).
export interface Scroll {
  speed: number;
  distance: number;
}

export interface LevelState {
  index: number;
  plan: LevelPlan;
  spawnedCount: number;
  colonizedCount: number;
  planetsRequired: number;
}

export type EndState =
  | { status: "playing" }
  | { status: "lost"; cause: "colonists" | "fuel" };

export interface Input {
  rotateLeft: boolean;
  rotateRight: boolean;
  thrust: boolean;
  retro: boolean; // brakes along heading + PI (Decision R4)
  fire: boolean;
}

export interface Flourish {
  levelIndex: number;
  ttl: number;
}

export interface GameState {
  ship: Ship;
  planets: Planet[];
  asteroids: Asteroid[];
  bullets: Bullet[];
  level: LevelState;
  scroll: Scroll;
  rng: RngState;
  end: EndState;
  nextId: number;
  flourish: Flourish | null;
}
