import { colonistBatchForLevel } from "../game/level.ts";
import type { GameState } from "../game/types.ts";

interface MeterEls {
  root: HTMLElement;
  fill: HTMLElement;
}

// A DOM overlay, not in-scene sprites (Decision 5): CSS keeps three
// icon-only meters legible at both 1920x1080 and 390x844.
export function createHud(root: ParentNode): (state: GameState) => void {
  const meters = {
    colonists: meterEls(root, "colonists"),
    fuel: meterEls(root, "fuel"),
    ammo: meterEls(root, "ammo"),
  };

  // The colonist batch is fixed for a level (Decision 1), so it's only
  // recomputed when the level actually changes, not every frame.
  let cachedLevelIndex = -1;
  let colonistCapacity = 1;

  return (state) => {
    if (state.level.index !== cachedLevelIndex) {
      cachedLevelIndex = state.level.index;
      colonistCapacity = colonistBatchForLevel(state.level.plan);
    }
    setMeter(meters.colonists, state.ship.colonists / colonistCapacity);
    setMeter(meters.fuel, state.ship.fuel);
    setMeter(meters.ammo, state.ship.ammo);
  };
}

function meterEls(root: ParentNode, name: string): MeterEls {
  const el = root.querySelector<HTMLElement>(`[data-meter="${name}"]`);
  const fill = el?.querySelector<HTMLElement>(".meter-fill");
  if (!el || !fill) throw new Error(`missing #hud meter: ${name}`);
  return { root: el, fill };
}

function setMeter(meter: MeterEls, fraction: number): void {
  const clamped = Math.max(0, Math.min(1, fraction));
  meter.fill.style.height = `${clamped * 100}%`;
  meter.root.setAttribute("aria-valuenow", clamped.toFixed(2));
}
