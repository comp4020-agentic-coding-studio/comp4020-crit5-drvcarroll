import { describe, expect, it } from "vitest";
import { SCROLL_SPEED_MAX } from "./constants.ts";
import { advanceScroll, driftEntities, scrollSpeedForDistance } from "./scroll.ts";
import type { Scroll, Vec2 } from "./types.ts";

describe("scrollSpeedForDistance", () => {
  it("is monotonic non-decreasing in distance travelled", () => {
    let prev = scrollSpeedForDistance(0);
    for (let i = 1; i <= 40; i++) {
      const speed = scrollSpeedForDistance(i * 1000);
      expect(speed).toBeGreaterThanOrEqual(prev);
      prev = speed;
    }
  });

  it("caps at SCROLL_SPEED_MAX however long the run gets", () => {
    expect(scrollSpeedForDistance(10_000_000)).toBe(SCROLL_SPEED_MAX);
  });
});

describe("advanceScroll", () => {
  it("accumulates distance at the current speed, then re-derives speed", () => {
    const scroll: Scroll = { speed: 100, distance: 50 };
    const next = advanceScroll(scroll, 0.5);
    expect(next.distance).toBe(100);
    expect(next.speed).toBe(scrollSpeedForDistance(100));
  });

  it("never slows the world down", () => {
    let scroll: Scroll = { speed: scrollSpeedForDistance(0), distance: 0 };
    for (let i = 0; i < 200; i++) {
      const next = advanceScroll(scroll, 1);
      expect(next.speed).toBeGreaterThanOrEqual(scroll.speed);
      scroll = next;
    }
  });

  it("does not mutate its input", () => {
    const scroll: Scroll = { speed: 100, distance: 50 };
    advanceScroll(scroll, 1);
    expect(scroll).toEqual({ speed: 100, distance: 50 });
  });
});

describe("driftEntities", () => {
  interface Entity {
    id: number;
    position: Vec2;
    radius: number;
  }

  function entities(): Entity[] {
    return [
      { id: 1, position: { x: 5, y: 10 }, radius: 3 },
      { id: 2, position: { x: -5, y: -20 }, radius: 7 },
    ];
  }

  it("moves every entity down by exactly speed * dt", () => {
    const list = entities();
    const drifted = driftEntities(list, 0.25, 40);
    expect(drifted[0].position.y).toBe(10 - 10);
    expect(drifted[1].position.y).toBe(-20 - 10);
  });

  it("touches nothing but position.y", () => {
    const list = entities();
    const drifted = driftEntities(list, 0.25, 40);
    expect(drifted[0].position.x).toBe(list[0].position.x);
    expect(drifted[0].id).toBe(list[0].id);
    expect(drifted[0].radius).toBe(list[0].radius);
    expect(drifted[1].id).toBe(list[1].id);
    expect(drifted[1].radius).toBe(list[1].radius);
  });

  it("does not mutate the input array or its elements", () => {
    const list = entities();
    const snapshot = JSON.parse(JSON.stringify(list));
    driftEntities(list, 1, 10);
    expect(list).toEqual(snapshot);
  });

  it("returns a new array, not the same reference", () => {
    const list = entities();
    expect(driftEntities(list, 1, 10)).not.toBe(list);
  });
});
