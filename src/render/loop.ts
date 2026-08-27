import { tick } from "../game/reducer.ts";
import type { GameState, Input } from "../game/types.ts";

const MAX_DT = 1 / 20; // clamp a stalled tab's first frame to something sane

// Owns dt and the running GameState; the caller only supplies input and
// receives each new state to render --- the loop itself renders nothing.
export function startLoop(
  initial: GameState,
  getInput: () => Input,
  onFrame: (state: GameState) => void,
): void {
  let state = initial;
  let last = performance.now();

  function frame(now: number): void {
    const dt = Math.min(MAX_DT, (now - last) / 1000);
    last = now;
    state = tick(state, getInput(), dt);
    onFrame(state);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
