import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Scene,
  Vector3,
} from "three";
import type { Ship } from "../game/types.ts";
import { ENGINE_GLOW_COLOR, SHIP_COLOR } from "./render-constants.ts";
import { toWorld } from "./frame-to-world.ts";

// Nose cone + body + two fins, grouped. Local +X is the nose direction
// (matches vector.fromAngle(0) = +x), local Y is height off the ground
// plane, local Z is the left/right span --- so mesh.rotation.y = heading
// (below) still rotates the whole assembly the same way the old flat
// arrowhead did (Decision 10).
function rocketGroup(): Group {
  const group = new Group();
  const material = new MeshStandardMaterial({ color: SHIP_COLOR });

  // ConeGeometry/CylinderGeometry are authored along +Y; rotateZ(-90deg)
  // swings that axis onto +X, i.e. onto the heading direction.
  const nose = new Mesh(new ConeGeometry(5, 12, 8), material);
  nose.geometry.rotateZ(-Math.PI / 2);
  nose.position.set(12, 0, 0);
  group.add(nose);

  const body = new Mesh(new CylinderGeometry(5, 5, 16, 8), material);
  body.geometry.rotateZ(-Math.PI / 2);
  body.position.set(-2, 0, 0);
  group.add(body);

  // A thin wedge along X, spanning outward in Z --- reads as a fin from
  // the tilted overhead camera without needing its own extruded shape.
  const finGeometry = new BoxGeometry(6, 2, 10);
  const finLeft = new Mesh(finGeometry, material);
  finLeft.position.set(-9, 0, 8);
  group.add(finLeft);
  const finRight = new Mesh(finGeometry, material);
  finRight.position.set(-9, 0, -8);
  group.add(finRight);

  return group;
}

export function createShipMesh(scene: Scene): Group {
  const group = rocketGroup();
  scene.add(group);
  return group;
}

// group.rotation.y = heading exactly: the assembly's nose is built along
// +X, and with toWorld's y-flip a game heading of `h` rotates the nose to
// world (cos h, 0, -sin h) --- the same direction fromAngle(h) means in
// game space.
export function syncShipMesh(group: Group, ship: Ship): void {
  const [worldX, worldZ] = toWorld(ship.position.x, ship.position.y);
  group.position.set(worldX, 0, worldZ);
  group.rotation.y = ship.heading;
}

// Just behind the body/fins, re-measured against the rocket's own local
// space (Decision 10) --- the old TAIL_LOCAL was tuned to the flat arrow.
const TAIL_LOCAL = new Vector3(-14, 2, 0);

export function createEngineGlow(scene: Scene): PointLight {
  const glow = new PointLight(ENGINE_GLOW_COLOR, 0.6, 140, 2);
  scene.add(glow);
  return glow;
}

// The opening-frame affordance: a gentle idle pulse says "this is alive,
// try it"; a flare under thrust confirms the press landed. No text needed.
export function syncEngineGlow(glow: PointLight, ship: Group, thrusting: boolean, elapsedSeconds: number): void {
  const tail = TAIL_LOCAL.clone().applyAxisAngle(new Vector3(0, 1, 0), ship.rotation.y).add(ship.position);
  glow.position.copy(tail);
  glow.intensity = thrusting ? 2.4 : 0.5 + 0.35 * Math.sin(elapsedSeconds * 3);
}
