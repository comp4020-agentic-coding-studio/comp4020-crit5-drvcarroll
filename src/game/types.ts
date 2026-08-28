import type { RngState } from "./rng.ts";
import type { Vec2 } from "./vector.ts";

export type { Vec2, RngState };

export interface Ship {
  position: Vec2;
  heading: number; // radians, 0 = +x, ccw
  velocity: Vec2; // true inertia: no drag term is ever applied to this
  colonists: number;
  fuel: number; // 0..1
  ammo: number; // 0..1
}

export interface Planet {
  id: number;
  position: Vec2;
  radius: number;
  colonistsRequired: number;
  colonized: boolean;
}

export interface Asteroid {
  id: number;
  position: Vec2;
  velocity: Vec2;
  radius: number;
}

export interface Bullet {
  id: number;
  position: Vec2;
  velocity: Vec2;
  ttl: number; // seconds remaining
}

export interface PlanetSpec {
  scrollY: number;
  lane: number;
  radius: number;
  colonistsRequired: number;
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
  scrollY: number;
  rng: RngState;
  end: EndState;
  nextId: number;
  flourish: Flourish | null;
}
