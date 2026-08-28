import { tick } from "../game/reducer.ts";
import type { GameState, Input } from "../game/types.ts";

// Fixed timestep (Decision R10): physics always advances by this much,
// so the simulation is identical at 60Hz and 120Hz displays.
export const FIXED_DT = 1 / 120;
// Real-time budget the accumulator may hold. Bounds catch-up ticks after
// a tab stall to MAX_ACCUMULATOR / FIXED_DT, instead of spiralling.
export const MAX_ACCUMULATOR = 0.25;

// Pure accumulator math, exported for testing without faking rAF timing:
// how many fixed ticks fit in newly-elapsed real time, and the leftover
// accumulator to carry into the next frame.
export function ticksForElapsed(
  accumulator: number,
  elapsedSeconds: number,
  fixedDt = FIXED_DT,
  maxAccumulator = MAX_ACCUMULATOR,
): { ticks: number; accumulator: number } {
  const capped = Math.min(accumulator + elapsedSeconds, maxAccumulator);
  const ticks = Math.floor(capped / fixedDt);
  return { ticks, accumulator: capped - ticks * fixedDt };
}

// Controller handed to the composition root: read the live state, pause
// ticking, override input, or force ticks deterministically (Tier 3 needs
// this to drive the game without racing rAF).
export interface LoopController {
  getState: () => GameState;
  isPaused: () => boolean;
  setPaused: (paused: boolean) => void;
  setInputOverride: (input: Input | null) => void;
  stepN: (n: number) => void;
}

// Owns dt and the running GameState; the caller only supplies input and
// receives each new state to render --- the loop itself renders nothing.
// Ticks run zero or more times per frame via a fixed-step accumulator
// (R10); onFrame still runs exactly once per rAF regardless of tick count.
export function startLoop(
  initial: GameState,
  getInput: () => Input,
  onFrame: (state: GameState) => void,
): LoopController {
  let state = initial;
  let last = performance.now();
  let accumulator = 0;
  let paused = false;
  let inputOverride: Input | null = null;

  const readInput = (): Input => inputOverride ?? getInput();

  function frame(now: number): void {
    if (!paused) {
      const elapsed = (now - last) / 1000;
      const stepped = ticksForElapsed(accumulator, elapsed);
      accumulator = stepped.accumulator;
      for (let i = 0; i < stepped.ticks; i++) {
        state = tick(state, readInput(), FIXED_DT);
      }
    }
    last = now;
    onFrame(state);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  return {
    getState: () => state,
    isPaused: () => paused,
    setPaused: (p) => {
      paused = p;
    },
    setInputOverride: (input) => {
      inputOverride = input;
    },
    stepN: (n) => {
      for (let i = 0; i < n; i++) state = tick(state, readInput(), FIXED_DT);
      onFrame(state);
    },
  };
}
