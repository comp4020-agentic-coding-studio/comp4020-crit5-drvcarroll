import { AmbientLight, DirectionalLight, OrthographicCamera, Scene, WebGLRenderer } from "three";
import { CAMERA_BACK_OFFSET, CAMERA_HEIGHT, VIEW_HALF_HEIGHT } from "./render-constants.ts";

export interface RenderTarget {
  scene: Scene;
  camera: OrthographicCamera;
  renderer: WebGLRenderer;
}

// Orthographic (no perspective distortion of distance) but elevated and
// tilted --- the "cool 3D, still top-down" look the brief asks for.
export function createRenderTarget(canvas: HTMLCanvasElement): RenderTarget {
  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 0.6));
  const sun = new DirectionalLight(0xffffff, 0.8);
  sun.position.set(1, 1, 0.5);
  scene.add(sun);

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
  camera.position.set(0, CAMERA_HEIGHT, CAMERA_BACK_OFFSET);
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({ canvas, antialias: true });

  const target = { scene, camera, renderer };
  resizeRenderTarget(target, canvas.clientWidth, canvas.clientHeight);
  return target;
}

export function resizeRenderTarget(target: RenderTarget, width: number, height: number): void {
  const aspect = width / height;
  target.camera.left = -VIEW_HALF_HEIGHT * aspect;
  target.camera.right = VIEW_HALF_HEIGHT * aspect;
  target.camera.top = VIEW_HALF_HEIGHT;
  target.camera.bottom = -VIEW_HALF_HEIGHT;
  target.camera.updateProjectionMatrix();
  target.renderer.setSize(width, height, false);
}
