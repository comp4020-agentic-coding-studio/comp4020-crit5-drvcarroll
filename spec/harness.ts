// Tier 2 simulation harness (§7.2): drives the real `tick` for a fixed
// step count with a scripted pilot. Pure --- no describe/it here.
import { createInitialState } from "../src/game/state.ts";
import { tick } from "../src/game/reducer.ts";
import type { GameState, Input } from "../src/game/types.ts";

// A frame time, not a game tunable --- the harness's own fixed step.
export const SIM_DT = 1 / 60;

export interface Pilot {
  (state: GameState, step: number): Input;
}

export function simulate(opts: {
  seed: number;
  pilot: Pilot;
  steps: number;
  onStep?: (s: GameState, i: number) => void;
}): { final: GameState; history: GameState[] } {
  let state = createInitialState({ seed: opts.seed });
  const history: GameState[] = [state];
  opts.onStep?.(state, 0);

  for (let i = 1; i <= opts.steps; i++) {
    const input = opts.pilot(state, i);
    state = tick(state, input, SIM_DT);
    history.push(state);
    opts.onStep?.(state, i);
  }

  return { final: state, history };
}
