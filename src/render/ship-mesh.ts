import { ExtrudeGeometry, Mesh, MeshStandardMaterial, Scene, Shape } from "three";
import type { Ship } from "../game/types.ts";
import { SHIP_COLOR } from "./render-constants.ts";
import { toWorld } from "./camera-follow.ts";

// A flat arrowhead in local XY, apex at +X, extruded and laid onto the
// ground plane --- apex direction then matches vector.fromAngle(0) = +x.
function shipGeometry(): ExtrudeGeometry {
  const shape = new Shape();
  shape.moveTo(16, 0);
  shape.lineTo(-10, 10);
  shape.lineTo(-6, 0);
  shape.lineTo(-10, -10);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: 4, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function createShipMesh(scene: Scene): Mesh {
  const mesh = new Mesh(shipGeometry(), new MeshStandardMaterial({ color: SHIP_COLOR }));
  scene.add(mesh);
  return mesh;
}

// mesh.rotation.y = heading exactly: with the geometry's apex built along
// +X and toWorld's y-flip, a game heading of `h` rotates the apex to world
// (cos h, 0, -sin h) --- the same direction fromAngle(h) means in game space.
export function syncShipMesh(mesh: Mesh, ship: Ship): void {
  const [worldX, worldZ] = toWorld(ship.position.x, ship.position.y);
  mesh.position.set(worldX, 0, worldZ);
  mesh.rotation.y = ship.heading;
}
