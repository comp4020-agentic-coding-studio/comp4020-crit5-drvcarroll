import type { Input } from "../game/types.ts";

const KEY_MAP: Record<string, keyof Input> = {
  a: "rotateLeft",
  ArrowLeft: "rotateLeft",
  d: "rotateRight",
  ArrowRight: "rotateRight",
  w: "thrust",
  ArrowUp: "thrust",
  " ": "fire",
};

// Keyboard (WASD + arrow-key equivalents + space) and the on-screen touch
// pads both drive the same Input record --- src/game/* never knows which
// one was used (Decision 6).
export function createInputSource(root: ParentNode): () => Input {
  const state: Input = { rotateLeft: false, rotateRight: false, thrust: false, fire: false };

  window.addEventListener("keydown", (event) => {
    const action = KEY_MAP[event.key];
    if (!action) return;
    event.preventDefault(); // stop space/arrows from scrolling the page
    state[action] = true;
  });
  window.addEventListener("keyup", (event) => {
    const action = KEY_MAP[event.key];
    if (action) state[action] = false;
  });

  for (const pad of root.querySelectorAll<HTMLButtonElement>(".pad")) {
    const action = pad.dataset.action as keyof Input | undefined;
    if (!action) continue;
    const setPressed = (pressed: boolean) => (event: Event) => {
      event.preventDefault();
      state[action] = pressed;
    };
    pad.addEventListener("pointerdown", setPressed(true));
    pad.addEventListener("pointerup", setPressed(false));
    pad.addEventListener("pointercancel", setPressed(false));
    pad.addEventListener("pointerleave", setPressed(false));
  }

  return () => ({ ...state });
}
