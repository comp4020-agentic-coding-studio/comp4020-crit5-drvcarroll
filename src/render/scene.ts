import { DirectionalLight, HemisphereLight, OrthographicCamera, Scene, WebGLRenderer } from "three";
import { FRAME_HALF_HEIGHT, FRAME_HALF_WIDTH } from "../game/constants.ts";
import { PALETTE } from "./materials.ts";
import { CAMERA_HEIGHT } from "./render-constants.ts";

export interface RenderTarget {
  scene: Scene;
  camera: OrthographicCamera;
  renderer: WebGLRenderer;
}

// Pure and browser-free (BUILD_PLAN.md §5.2): the play frame is never
// cropped horizontally --- a narrow viewport grows the vertical bound
// instead, so the clamp in frame.ts stays identical on every device.
export function orthoBounds(viewportW: number, viewportH: number) {
  const aspect = viewportW / viewportH;
  const halfH = Math.max(FRAME_HALF_HEIGHT, FRAME_HALF_WIDTH / aspect);
  const halfW = halfH * aspect;
  return { left: -halfW, right: halfW, top: halfH, bottom: -halfH };
}

// Straight top-down orthographic camera, built once and never moved again
// (Decision R1/R7): the camera reads no ship, ever.
export function createRenderTarget(canvas: HTMLCanvasElement): RenderTarget {
  const scene = new Scene();

  // The one light rig (§5.3 rule 2): a hemisphere fill plus one directional
  // key from the upper-left. No per-mesh lighting guesses.
  scene.add(new HemisphereLight(0xdfe8ff, 0x3a4a7a, 0.55));
  const key = new DirectionalLight(0xffffff, 0.9);
  key.position.set(-1, 1, -0.5);
  scene.add(key);

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
  camera.position.set(0, CAMERA_HEIGHT, 0);
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  // Scene clear colour is --void (§5.3): the frame between drawn objects
  // reads as space, not the canvas default black/transparent.
  renderer.setClearColor(PALETTE.void);

  const target = { scene, camera, renderer };
  resizeRenderTarget(target, canvas.clientWidth, canvas.clientHeight);
  return target;
}

export function resizeRenderTarget(target: RenderTarget, width: number, height: number): void {
  const bounds = orthoBounds(width, height);
  target.camera.left = bounds.left;
  target.camera.right = bounds.right;
  target.camera.top = bounds.top;
  target.camera.bottom = bounds.bottom;
  target.camera.updateProjectionMatrix();
  target.renderer.setSize(width, height, false);
}
