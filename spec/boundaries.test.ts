import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Structural regression guards for the coordinate-space seam Phase R rests
// on (BUILD_PLAN.md §2.4, §7.1). These check imports/text, not behaviour.
function tsFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsFilesUnder(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

const GAME_DIR = resolve("src/game");
const RENDER_DIR = resolve("src/render");

const FORBIDDEN_IN_GAME: [name: string, pattern: RegExp][] = [
  ['from "three"', /from\s+["']three["']/],
  ["document", /\bdocument\b/],
  ["window", /\bwindow\b/],
  ["performance", /\bperformance\b/],
  ["requestAnimationFrame", /\brequestAnimationFrame\b/],
];

describe("boundaries: src/game stays headless", () => {
  const files = tsFilesUnder(GAME_DIR);

  it("found game source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const label = relative(resolve("."), file);
    it(`${label} imports no three/DOM globals`, () => {
      const src = readFileSync(file, "utf8");
      for (const [name, pattern] of FORBIDDEN_IN_GAME) {
        expect(pattern.test(src), `${label} references "${name}"`).toBe(false);
      }
    });
  }
});

describe("boundaries: only scene.ts's constructor sets camera.position", () => {
  const files = tsFilesUnder(RENDER_DIR).filter((f) => f !== join(RENDER_DIR, "scene.ts"));
  const pattern = /camera\.position\s*(=|\.set\()/;

  for (const file of files) {
    const label = relative(resolve("."), file);
    it(`${label} does not assign camera.position`, () => {
      const src = readFileSync(file, "utf8");
      expect(pattern.test(src), `${label} assigns camera.position`).toBe(false);
    });
  }
});
