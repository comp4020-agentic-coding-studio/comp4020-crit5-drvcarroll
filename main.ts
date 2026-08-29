// Composition root: wires the pure src/game/* state into input, the
// Three.js render skeleton, and the HUD.
import { createInitialState } from "./src/game/state.ts";
import type { GameState, Input } from "./src/game/types.ts";
import { createAsteroidPool, syncAsteroids } from "./src/render/asteroid-mesh.ts";
import { createBulletPool, syncBullets } from "./src/render/bullet-mesh.ts";
import { createControlHint, createHud } from "./src/render/hud.ts";
import { createInputSource } from "./src/render/input.ts";
import { startLoop } from "./src/render/loop.ts";
import { createPlanetPool, syncPlanets } from "./src/render/planet-mesh.ts";
import { createRenderTarget, resizeRenderTarget } from "./src/render/scene.ts";
import { createStarField } from "./src/render/starfield.ts";
import { createEngineGlow, createShipMesh, syncEngineGlow, syncShipMesh } from "./src/render/ship-mesh.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const game = document.querySelector<HTMLElement>("#game");
if (!canvas || !game) throw new Error("missing #scene canvas or #game root");

const target = createRenderTarget(canvas);
const syncStarField = createStarField(target.scene);
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
const renderControlHint = createControlHint(game);
const initialState = createInitialState({ seed: Date.now() });
const startTime = performance.now();

const controller = startLoop(initialState, getInput, (state) => {
  // One input read per frame, shared by the engine flame and the keycaps,
  // so the two can never disagree about what is being held.
  const input = getInput();
  const elapsed = (performance.now() - startTime) / 1000;

  syncStarField(state.scroll.distance);
  syncShipMesh(shipMesh, state.ship);
  syncEngineGlow(engineGlow, shipMesh, input.thrust, elapsed);
  syncPlanets(planetPool, state.planets, elapsed);
  syncAsteroids(asteroidPool, state.asteroids);
  syncBullets(bulletPool, state.bullets);
  target.renderer.render(target.scene, target.camera);
  renderHud(state);
  renderControlHint(input);
});

// Precondition for Tier 3 (BUILD_PLAN §7.3): a Playwright harness drives
// the game deterministically through this, instead of racing rAF.
declare global {
  interface Window {
    __game?: {
      state: GameState;
      paused: boolean;
      setInput: (input: Input | null) => void;
      stepN: (n: number) => void;
    };
  }
}

if (import.meta.env.DEV || new URLSearchParams(location.search).get("test") === "1") {
  window.__game = {
    get state() {
      return controller.getState();
    },
    get paused() {
      return controller.isPaused();
    },
    set paused(value) {
      controller.setPaused(value);
    },
    setInput: controller.setInputOverride,
    stepN: controller.stepN,
  };
}
