// Composition root: wires the pure src/game/* state into the Three.js
// render skeleton. No live input yet --- Step 7 adds keyboard/touch.
import { createInitialState } from "./src/game/state.ts";
import type { Input } from "./src/game/types.ts";
import { createAsteroidPool, syncAsteroids } from "./src/render/asteroid-mesh.ts";
import { createBulletPool, syncBullets } from "./src/render/bullet-mesh.ts";
import { followShip } from "./src/render/camera-follow.ts";
import { startLoop } from "./src/render/loop.ts";
import { createPlanetPool, syncPlanets } from "./src/render/planet-mesh.ts";
import { createRenderTarget, resizeRenderTarget } from "./src/render/scene.ts";
import { createShipMesh, syncShipMesh } from "./src/render/ship-mesh.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("missing #scene canvas");

const target = createRenderTarget(canvas);
const shipMesh = createShipMesh(target.scene);
const planetPool = createPlanetPool(target.scene);
const asteroidPool = createAsteroidPool(target.scene);
const bulletPool = createBulletPool(target.scene);

window.addEventListener("resize", () => {
  resizeRenderTarget(target, canvas.clientWidth, canvas.clientHeight);
});

const NO_INPUT: Input = { rotateLeft: false, rotateRight: false, thrust: false, fire: false };
const initialState = createInitialState({ seed: Date.now() });

startLoop(initialState, () => NO_INPUT, (state) => {
  syncShipMesh(shipMesh, state.ship);
  syncPlanets(planetPool, state.planets);
  syncAsteroids(asteroidPool, state.asteroids);
  syncBullets(bulletPool, state.bullets);
  followShip(target.camera, state.ship);
  target.renderer.render(target.scene, target.camera);
});
