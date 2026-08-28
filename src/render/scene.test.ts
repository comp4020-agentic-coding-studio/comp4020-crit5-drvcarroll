import { describe, expect, it } from "vitest";
import { FRAME_HALF_HEIGHT, FRAME_HALF_WIDTH } from "../game/constants.ts";
import { orthoBounds } from "./scene.ts";

// §5.2's invariant: never crop the frame, at any marking or extreme aspect.
const ASPECTS = [0.4, 3.0, 1920 / 1080, 390 / 844, 0.7, 1.0, 2.2];

describe("orthoBounds", () => {
  for (const aspect of ASPECTS) {
    it(`never crops the frame at aspect ${aspect.toFixed(3)}`, () => {
      const { left, right, top, bottom } = orthoBounds(aspect, 1);
      const halfW = right;
      const halfH = top;
      expect(left).toBe(-halfW);
      expect(bottom).toBe(-halfH);
      expect(halfW).toBeGreaterThanOrEqual(FRAME_HALF_WIDTH);
      expect(halfH).toBeGreaterThanOrEqual(FRAME_HALF_HEIGHT);
    });
  }

  it("matches the frame's own half-dimensions exactly at its natural aspect", () => {
    const naturalAspect = FRAME_HALF_WIDTH / FRAME_HALF_HEIGHT;
    const { right, top } = orthoBounds(naturalAspect, 1);
    expect(right).toBeCloseTo(FRAME_HALF_WIDTH, 9);
    expect(top).toBeCloseTo(FRAME_HALF_HEIGHT, 9);
  });
});
