// Composition root: wires the pure src/game/* state into input, the
// Three.js render skeleton, and the HUD.
import { createInitialState } from "./src/game/state.ts";
import { createAsteroidPool, syncAsteroids } from "./src/render/asteroid-mesh.ts";
import { createBulletPool, syncBullets } from "./src/render/bullet-mesh.ts";
import { createHud } from "./src/render/hud.ts";
import { createInputSource } from "./src/render/input.ts";
import { startLoop } from "./src/render/loop.ts";
import { createPlanetPool, syncPlanets } from "./src/render/planet-mesh.ts";
import { createRenderTarget, resizeRenderTarget } from "./src/render/scene.ts";
import { createEngineGlow, createShipMesh, syncEngineGlow, syncShipMesh } from "./src/render/ship-mesh.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const game = document.querySelector<HTMLElement>("#game");
if (!canvas || !game) throw new Error("missing #scene canvas or #game root");

const target = createRenderTarget(canvas);
const shipMesh = createShipMesh(target.scene);
const engineGlow = createEngineGlow(target.scene);
const planetPool = createPlanetPool(target.scene);
const asteroidPool = createAsteroidPool(target.scene);
const bulletPool = createBulletPool(target.scene);

window.addEventListener("resize", () => {
  resizeRenderTarget(target, canvas.clientWidth, canvas.clientHeight);
});

const getInput = createInputSource(game);
const renderHud = createHud(game);
const initialState = createInitialState({ seed: Date.now() });
const startTime = performance.now();

startLoop(initialState, getInput, (state) => {
  syncShipMesh(shipMesh, state.ship);
  syncEngineGlow(engineGlow, shipMesh, getInput().thrust, (performance.now() - startTime) / 1000);
  syncPlanets(planetPool, state.planets);
  syncAsteroids(asteroidPool, state.asteroids);
  syncBullets(bulletPool, state.bullets);
  target.renderer.render(target.scene, target.camera);
  renderHud(state);
});
