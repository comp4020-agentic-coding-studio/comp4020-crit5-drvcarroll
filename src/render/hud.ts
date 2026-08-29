import type { GameState, Input } from "../game/types.ts";

// Below this a meter turns danger-red: the one state that has to be read
// at a glance while dodging (§6.3).
const CRITICAL_FRACTION = 0.25;

interface MeterEls {
  root: HTMLElement;
  fill: HTMLElement;
}

// A DOM overlay, not in-scene sprites (Decision 5): CSS keeps three
// icon-labelled meters legible at both 1920x1080 and 390x844. All three
// resources are already fractions of a full tank, so nothing is derived.
export function createHud(root: ParentNode): (state: GameState) => void {
  const meters = {
    air: meterEls(root, "air"),
    fuel: meterEls(root, "fuel"),
    ammo: meterEls(root, "ammo"),
  };

  return (state) => {
    setMeter(meters.air, state.ship.air);
    setMeter(meters.fuel, state.ship.fuel);
    setMeter(meters.ammo, state.ship.ammo);
  };
}

/**
 * Lights the on-screen keycap for whichever action is being held. The caps
 * are always visible and always pressable, so they teach the controls by
 * responding to them rather than by captioning them (C3).
 */
export function createControlHint(root: ParentNode): (input: Input) => void {
  const keys = Array.from(root.querySelectorAll<HTMLElement>(".key")).map((el) => ({
    el,
    action: el.dataset.action as keyof Input,
  }));

  return (input) => {
    for (const { el, action } of keys) el.classList.toggle("is-down", input[action]);
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
  meter.root.classList.toggle("is-critical", clamped < CRITICAL_FRACTION);
  meter.root.setAttribute("aria-valuenow", clamped.toFixed(2));
}
