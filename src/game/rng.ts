// A pure PRNG (mulberry32): no hidden state, the caller threads RngState
// through every call, so a fixed seed makes the whole game deterministic.
export interface RngState {
  seed: number;
}

// Returns the next float in [0, 1) and the RngState to use for the call
// after it. Never mutates the state passed in.
export function nextFloat(rng: RngState): [number, RngState] {
  let s = (rng.seed + 0x6d2b79f5) | 0;
  s = Math.imul(s ^ (s >>> 15), s | 1);
  s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
  const value = ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  return [value, { seed: s }];
}

// A float in [min, max).
export function nextRange(rng: RngState, min: number, max: number): [number, RngState] {
  const [value, next] = nextFloat(rng);
  return [min + value * (max - min), next];
}
