// Same seed + same input tape => byte-identical final state, twice.
// The committed hash makes a tuning change's effect visible as a diff.
import { describe, expect, it } from "vitest";
import { simulate } from "./harness.ts";
import { seekPilot } from "./pilots.ts";

const SEED = 42;
const STEPS = 2000;

// Committed hash for seekPilot @ seed 42, STEPS steps. Re-baselined for
// the air/fuel/ammo model and frictionless flight. Not meaningful in
// itself --- its stability is the evidence; a diff here on an unrelated
// change is a tuning regression.
const COMMITTED_HASH = "76a7369a";

// A tiny non-cryptographic hash (FNV-1a): only needs to be stable and
// cheap, not secure --- no need for a crypto dependency in a test file.
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

describe("determinism", () => {
  it("the same seed and input tape produce a byte-identical final state, twice", () => {
    const run = () => JSON.stringify(simulate({ seed: SEED, pilot: seekPilot, steps: STEPS }).final);
    expect(run()).toBe(run());
  });

  it("matches the committed hash for seekPilot @ seed 42", () => {
    const json = JSON.stringify(simulate({ seed: SEED, pilot: seekPilot, steps: STEPS }).final);
    expect(fnv1a(json)).toBe(COMMITTED_HASH);
  });
});
