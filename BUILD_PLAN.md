# Build plan --- crit-5, "Colony Run"

> **Status.** Phases A and B (steps 1--20 of the previous revision) shipped a
> playable but wrong-feeling game. This document is a **complete rewrite** of
> the plan around one architectural inversion --- a fixed camera and a world
> that scrolls through it --- plus a real testing methodology. Steps 1--20 of
> the old plan are not repeated here; the "What already exists" table below
> records what they left behind, and Phase R's steps say for each file whether
> it is kept, modified, rewritten or new. Nothing is deleted that a step does
> not name.

---

## 1. What this is

**Colony Run** is a single full-screen browser page holding one arcade game.

You fly a rocket through a vertical column of space. The **camera never
moves.** The world drifts steadily downward through a fixed frame: planets
enter from the top edge, fall slowly toward the bottom, and leave. A
three-layer starfield drifts down behind them at slower rates, so the frame
reads as a window onto continuous forward flight even when you hold still.
The rocket flies freely anywhere inside that frame --- left, right, up,
down --- under rotate-and-thrust control with real inertia, and is stopped
softly by the frame edges rather than being pinned to the centre of them.

A planet has a **gravity well**. Fly inside it and the well pulls you in for
free, no fuel. A planet is **solid**: you cannot fly through one. Touch it
**gently** --- meaning slowly *relative to the planet's own downward drift*,
not slowly in absolute terms --- and you colonise it: colonists disembark,
and your fuel and ammo top up. Touch it fast and you crash: the surface
still stops you cold, but the impact costs colonists, same as an asteroid.
Asteroids tumble across the frame; hitting one costs colonists and destroys
the asteroid, shooting one costs a little ammo and destroys it for free.

Colonise every planet the level plans and you advance to a harder one:
more planets, faster scroll, more asteroids. Run out of colonists or fuel
first and the run ends. Everything you need to know is shown, never
written: **there is no instructional text anywhere on the page.**

It is built as plain TypeScript on Vite. Game logic is pure and headless
(`src/game/`); rendering is Three.js over a straight top-down orthographic
camera (`src/render/`); the HUD is a DOM overlay. It deploys as a static
site to GitHub Pages.

### What already exists (Phases A and B)

| Area | State | Phase R disposition |
|---|---|---|
| `src/game/vector.ts`, `rng.ts` | Correct, fully tested | **Keep unchanged** |
| `src/game/types.ts` | Shapes exist; frame model needs new fields | **Modify** |
| `src/game/constants.ts` | Values tuned for a scrolling camera | **Rewrite values, keep the "one file, every tunable" rule** |
| `src/game/ship.ts` | Newtonian, no drag, no brake | **Modify** (damping + retro-thrust) |
| `src/game/collisions.ts` | `isGentleLanding` uses absolute speed | **Modify** (relative speed) |
| `src/game/gravity.ts` | Correct and well-tested | **Keep unchanged** |
| `src/game/level.ts`, `spawn.ts` | Schedule by absolute `scrollY`; planets start 900u out | **Rewrite scheduling** |
| `src/game/reducer.ts` | Correct structure, wrong world model | **Modify** (frame drift, clamping, despawn) |
| `src/render/scene.ts` | Tilted ortho camera, default lights | **Rewrite** (top-down, art-directed rig) |
| `src/render/camera-follow.ts` | The bug: locks camera to ship | **Delete the follow behaviour, keep `toWorld`** |
| `src/render/*-mesh.ts` | Functional, visually flat | **Rewrite** to the art direction in §5 |
| `src/render/starfield.ts` | Never built | **New** |
| `src/render/pool.ts`, `hud.ts`, `input.ts` | Sound | **Keep / extend** |
| `src/render/loop.ts` | Variable timestep | **Modify** (fixed-timestep accumulator) |
| `spec/`, `scripts/check-evidence.ts` | Thin | **Extend** per §7 |

---

## 2. The entities, and how they interact

These names are the project's vocabulary. Use them unchanged in code, tests,
and commit messages.

### 2.1 The coordinate model (read this first)

There are exactly **three** coordinate spaces, and confusing them is the
single most likely way to reintroduce the bug this rewrite exists to fix.

| Space | Units | Origin | Who uses it |
|---|---|---|---|
| **Frame space** | world units | centre of the visible frame; `+x` right, `+y` up | *All of `src/game/`.* Every entity position is a frame position. |
| **Three space** | same units | same point; `+x` right, `+y` up out of the screen, `+z` down the screen | `src/render/` only. `toWorld(x, y) -> [x, -y]` maps frame to the `(x, z)` ground plane. |
| **Screen space** | CSS px | top-left | DOM HUD overlay only. |

The frame is `FRAME_HALF_WIDTH * 2` by `FRAME_HALF_HEIGHT * 2` world units.
The camera's orthographic bounds are derived from those two constants and the
viewport aspect ratio (§5.2) --- **the camera is never repositioned after
construction.**

`Scroll` is *not* a camera position. It is a scalar odometer: total distance
the world has drifted, used for spawn scheduling, difficulty ramp, starfield
rate and the distance readout. Nothing reads it as a coordinate.

### 2.2 Entities

**Ship** --- the only entity the player directly manipulates.

| Owns | Type | Notes |
|---|---|---|
| `position` | `Vec2` | frame space, clamped to `±(FRAME_HALF_* - SHIP_EDGE_MARGIN)` |
| `heading` | `number` | radians; `0` = `+x`, increases counter-clockwise on screen |
| `velocity` | `Vec2` | inertial; light damping only (Decision R4) |
| `colonists` | `number` | integer; re-issued per level |
| `fuel` | `number` | `0..1`; persists across levels |
| `ammo` | `number` | `0..1`; persists across levels |
| `thrusting` | `boolean` | last tick's effective thrust, for the render layer's plume |
| `invulnUntil` | `number` | scroll-odometer value; brief i-frames after an asteroid hit (Decision R9) |

**Planet** --- never initiates anything. It is fallen past, or landed on.

| Owns | Type | Notes |
|---|---|---|
| `id` | `number` | monotonic; drives the deterministic hue |
| `position` | `Vec2` | frame space; `y` decreases by the scroll each tick |
| `radius` | `number` | 30--70 world units |
| `colonistsRequired` | `number` | `round(radius * REQ_PER_RADIUS)` |
| `colonized` | `boolean` | |
| `driftX` | `number` | small lateral drift so columns of planets don't line up |
| `spin` | `number` | render-only decoration, but stored in state so it is deterministic |

**GravityWell** --- *derived, not stored.* A planet's well is the annulus from
its surface out to `radius * GRAVITY_RADIUS_MULT`. `applyGravity` computes it
per tick; the renderer draws a ring for it only while the ship is inside
(§6.6), which is the entire, wordless explanation of the mechanic.

**Asteroid** --- moves on its own, independent of the ship.

| Owns | Type | Notes |
|---|---|---|
| `id`, `position`, `radius` | | 14--42 world units |
| `velocity` | `Vec2` | biased near-horizontal (`ASTEROID_ANGLE_SPREAD`) so it crosses the frame rather than racing it down |
| `spin` | `number` | deterministic tumble rate |

**Bullet** --- spawned by the ship, consumed by the asteroid it reaches.
Owns `id`, `position`, `velocity`, `ttl`.

**Level** --- owns a plan generated whole at level start, and the counts run
against it: `index`, `plan: PlanetSpec[]`, `spawnedCount`, `colonizedCount`,
`planetsRequired`. A `PlanetSpec` schedules by **odometer distance**
(`atScroll`), not by an absolute `y`.

**Scroll** --- `{ distance: number; speed: number }`. `speed` is
`scrollSpeedForLevel(level.index)`; `distance` accumulates `speed * dt`.

**Flourish** --- a transient `{ kind: "level" | "landing" | "damage";
ttl: number }` used purely to drive feedback at the object it happened to.

**EndState** --- `{ status: "playing" } | { status: "lost"; cause:
"colonists" | "fuel" }`.

**Starfield** --- **render-only.** Three `Points` layers owned entirely by
`src/render/starfield.ts`, with no representation in `GameState`. It reads
`scroll.speed` and nothing else.

**The reducer** --- owns no state. It is the only place interactions between
entities are resolved.

### 2.3 Flow, per tick

```
                                        the world moves first, then the player
scroll.distance += scroll.speed * dt
  every Planet.y   -= scroll.speed * dt      -> planets fall through the frame
  every Asteroid.y -= scroll.speed * dt      -> asteroids fall, plus own drift
  (the Ship is NOT scrolled: it flies in the frame, not in the world)

input                     -> ship.applyInput      -> heading, thrust, fuel drain
ship inside a well        -> gravity.applyGravity -> velocity pulled planetward
integration + clamp       -> ship.clampToFrame    -> position bounded, wall velocity zeroed
scroll.distance >= spec   -> spawn.activatePlanet -> a planned planet enters at the top edge
probability roll          -> spawn.decideAsteroid -> an asteroid enters at the top edge
bullet overlaps asteroid  -> both removed, no colonist cost
ship overlaps asteroid    -> reducer.applyAsteroidHit  -> colonists lost, asteroid gone, i-frames
ship contacts planet      -> collisions.resolvePlanetContact -> ship stopped at the surface,
                                                                  radial velocity zeroed, ALWAYS
  ... RELATIVE speed gentle -> reducer.attemptLanding  -> colonists deposited, fuel/ammo topped
  ... RELATIVE speed fast   -> reducer.applyPlanetCrash -> colonists lost, no deposit, i-frames
anything below the frame  -> reducer.despawn           -> removed
colonized == required     -> reducer.advanceLevel      -> new plan, fresh colonists, faster scroll
colonists == 0 or fuel==0 -> reducer.checkEndCondition -> run over
```

### 2.4 Couplings deliberately absent

- **The renderer never decides gameplay.** `src/render/*` reads `GameState`
  and mirrors it. A headless test drives the whole game with no browser.
- **`src/game/*` never imports `three`, nor touches `document`, `window`,
  `performance` or `requestAnimationFrame`.** This import boundary is the
  enforceable seam that makes the simulation tier of §7 possible, and it is
  checked mechanically (Step R1).
- **The camera never reads the ship.** After Phase R there is no code path
  from `Ship` to `camera.position`. This is asserted by a test, because it is
  the exact regression this rewrite is undoing.
- **The level plan never depends on wall-clock time or the render layer.** It
  is a pure function of level index and RNG state.
- **Fuel and ammo never depend on the level plan** except through the top-up
  fraction. They persist across levels.
- **The starfield never reads `GameState`'s shape** beyond one speed scalar.
- **`ship.ts` never sees a `Planet`.** Gravity is a separate pure function.

---

## 3. The published spec, sorted

### Checkable (each becomes a test in `spec/`)

- **C1** --- Deployed and live at the public Pages URL by the cutoff.
  *Served by the CI/ship flow.* Asserted by the deploy job's 200 check.
- **C2** --- A wrong move is possible and play ends somewhere.
  *Served by* `checkEndCondition`, `applyAsteroidHit`, fuel drain.
  *Tested by* `spec/game.test.ts` (unit) **and** `spec/playthrough.test.ts`
  (a do-nothing pilot always loses; §7.2).
- **C3** (checkable half) --- No instructional markup or text in the built
  DOM. *Tested by* `spec/dom.test.ts` against `dist/index.html`.
- **C6** --- The repo shows the process. *Served by* commits, `PROCESS.md`,
  `reflections/crit-5.md`, `pnpm check:evidence`.

### Judged (named here so no test is mistaken for covering them)

- **J1** --- A stranger picks it up and reaches an ending inside five minutes.
  *Served by* the opening frame (§6.1), the landing-safety ring (§6.6), the
  off-screen planet indicator (§6.7), and Step R14's tuning pass.
- **J2** --- One rule has a focused automated test, and one change came from
  playing the finished game. *Automated half:* the level-complete-precedence
  test. *Playing half:* the Step R14 tuning entry in `PROCESS.md`.
- **J3** --- Can account for how the work was directed, grounded, corrected.
  Oral, at the crit; the commit trail is the evidence.

### Weighting

Effort goes where the marks are: **J1 (feel and legibility) is the largest
single block** --- Steps R6--R14 are all in service of it. C2 is cheap and
already mostly held. C1/C6 are procedural.

---

## 4. Decisions taken

Each is separately rejectable. Decisions 1--14 of the previous revision stand
except where a decision below explicitly supersedes one.

**R1. The camera is fixed. Full stop.**
`followShip` is the defect. A camera locked 1:1 to the ship makes the ship,
by construction, immovable on screen; every other symptom (no sense of
motion, no falling planets, nowhere for a starfield to scroll against)
follows from it. The fix is not to soften the follow --- a lerped or
dead-zoned follow still couples the two --- but to remove the coupling
entirely. *Supersedes Decision 14's premise (though not its conclusion: the
starfield still sells speed, and now the falling world does too).*

**R2. The world scrolls; the ship does not.**
Each tick, every non-ship entity's `y` decreases by `scroll.speed * dt`. The
ship's `y` is untouched by the scroll. This is what makes the ship's frame
position a thing the *player* owns rather than a thing the camera dictates,
and it is what makes "planets fall from above" true in the simulation rather
than faked in the renderer. Faking it in the renderer was considered and
rejected: gameplay (where a planet is, whether it has left the frame) would
then disagree with what is drawn.

**R3. The ship is clamped to the frame, and the clamp zeroes the offending
velocity component --- it does not bounce, wrap, or kill.**
Bouncing fights the Newtonian read and produces uncontrollable pinball.
Wrapping makes the frame edges meaningless and destroys the "column of
space" fiction. Killing on contact with the *frame edge itself* would add a
loss path that has nothing to do with the game's one stated hazard set
(asteroids, fuel, now planets --- R14): the edge is a boundary, not a body.
A soft stop is the only option
that leaves the edge legible as a boundary without making it a hazard.

**R4. Light damping and a retro-thrust replace pure no-drag inertia.**
*Supersedes the "no drag term, ever" half of the original ship design.* In an
unbounded scroll, no-drag was elegant --- slowing down meant turning around,
which was a real skill. In a **bounded** frame the same physics means the
ship accumulates velocity it cannot shed before the wall arrives, pins there,
and stays pinned. `SHIP_DAMPING` (a per-second velocity multiplier, ~0.6/s)
and `S` for retro-thrust (thrust along `heading + PI`, same fuel cost) make
the ship controllable in a small space without making it feel weightless.
Inertia is still clearly present; it is just no longer unbounded. The damping
term lives in `ship.ts` as one named constant so Step R14 can tune or zero it.

**R5. Landing gentleness is measured against the planet, not against the
world.**
A planet drifts down at `scroll.speed`. A ship holding perfectly still in the
frame therefore *approaches* it at `scroll.speed`, and at higher levels that
alone exceeds `LANDING_SPEED_THRESHOLD` --- landing would become impossible
by difficulty ramp alone, which is a bug, not a challenge. So
`isGentleLanding` compares `|ship.velocity - planetVelocity|`, where
`planetVelocity = { x: planet.driftX, y: -scroll.speed }`. The threshold
number itself is unchanged (Decision 12 still holds): gravity does not relax
it, and neither does the scroll.

**R6. Planets are scheduled by odometer distance, and the first one is
already in frame on the first tick.**
`PlanetSpec.atScroll` replaces `scrollY`, and `PLANET_GAP_SCROLL` drops from
900 to ~520 --- roughly one frame-height and a half, so there is a planet
visible or imminent essentially always. The level's *first* planet is not
scheduled at all: it is placed directly into `GameState` by
`createInitialState` at `y = FRAME_HALF_HEIGHT * 0.55`, already inside the
opening frame. This is the whole answer to "planets spawn halfway through",
and it is also the opening-frame affordance (§6.1) --- the first frame shows
a rocket, a planet, and a gravity ring, and that is the instruction.

**R7. The camera is straight top-down orthographic, not tilted.**
*Supersedes the tilted camera in `scene.ts`.* The tilt was bought to read as
"cool 3D", and it cost more than it bought: spheres project as ellipses,
collision circles no longer coincide with what is drawn (so a near-miss looks
like a hit), and the frame edges are trapezoidal, which makes the clamp of
Decision R3 illegible. Straight down means **what is drawn is exactly the
collision geometry**. Depth comes back from the art direction (§5.3) ---
parallax layers, rim lighting, drop shadows, glow --- not from camera angle.

**R8. Glow is faked with additive sprite halos, not postprocessing.**
An `UnrealBloomPass` needs `three/examples`, which the risk register already
rules out for bundle size, and it costs a full-screen pass on a phone GPU. A
single procedurally-generated radial-gradient canvas texture, reused by every
glowing object as an additive-blended billboard, gets 90% of the look for one
texture and zero extra passes. It is also deterministic, so screenshot tests
are stable.

**R9. An asteroid hit grants brief invulnerability.**
Without it, a single asteroid overlapping the ship for several consecutive
ticks charges its full colonist cost several times, which reads as an
instant unexplained death. `INVULN_DISTANCE` (measured in odometer units so
it needs no wall-clock) gates re-damage, and the ship flashes for its
duration --- feedback at the object it happened to.

**R10. The loop runs a fixed timestep with an accumulator.**
Variable `dt` makes physics frame-rate-dependent, makes the simulation tests
of §7.2 non-representative of what a player experiences, and makes a
120 Hz display play a different game from a 60 Hz one. `FIXED_DT = 1/120`,
accumulate real time, run `tick` zero or more times per frame, clamp the
accumulator to avoid a spiral of death after a tab stall. Rendering still
happens once per rAF.

**R11. Testing is three tiers, and the middle tier is the one that was
missing.** See §7. Unit tests prove functions; **simulation tests prove
playthroughs**, headless and in CI; browser tests prove the page actually
renders and responds. "It compiles and the units pass" was never evidence
that the game was playable, and the current state of the build is the proof.

**R12. Difficulty ramps on three axes, all derived from `level.index`.**
Scroll speed, planet count, and asteroid rate. Scroll speed is the important
new one: it is what makes a later level *feel* faster rather than merely
busier, and because landing is relative-speed (R5) it raises difficulty
without breaking landing.

**R13. Colour is reserved for identity and safety, never decoration.**
One accent (cyan) for everything the player owns --- ship, bullets, HUD
fills, safe-landing state. One warning hue (amber) for energy and danger ---
engine plume, unsafe-landing state, damage flash. Planets carry per-id hue
for identity (Decision 9 stands). Asteroids are desaturated grey and carry
*no* hue, so they never compete with a planet for attention. Nothing is
signalled by colour alone: the landing ring changes **thickness and dash
pattern** as well as hue.

**R14. Planets are solid: a fast touch is a collision, not a pass-through.**
*Supersedes Decision 3.* The ship is a zero-radius point for collisions, so
without an explicit contact rule a fast approach silently clips straight
through a planet --- gravity pulls hard, the ship never gets a chance to
correct, and nothing happens. That is a hole in the one mechanic the whole
game teaches (the gravity ring, §6.6): "solid objects with collisions" means
contact with a planet is resolved the **same way the frame edge already is**
(Decision R3) --- the ship's position is stopped at the surface and the
radial velocity component is zeroed, unconditionally, gentle or not. What
happens *on top of* that stop still forks on relative speed (Decision R5):
gentle --- `attemptLanding` deposits colonists and tops up fuel/ammo, same
as before; fast --- `applyPlanetCrash` costs colonists (scaled by how far
over threshold the impact was, `PLANET_CRASH_DAMAGE_SCALE`, mirroring
`ASTEROID_DAMAGE_SCALE`'s formula shape) and grants the same
`INVULN_DISTANCE` i-frames an asteroid hit does (Decision R9), so repeated
overlap across ticks can't charge damage twice. This makes a planet a second
genuine hazard alongside asteroids and fuel --- "knobs that can produce a
bad outcome" --- rather than a body you can fly through by going fast enough
to outrun the consequence, which was the opposite of what a gravity well is
supposed to teach.

**R15. Geometry is smooth and lit, not low-poly or faceted.**
*Supersedes Decision 8 and §5.3 rule 4 as originally written.* A faceted
icosahedron reads as a placeholder asset, not as "sleek and modern" ---
visible flat triangles are the single fastest way to make a scene look
unfinished. Planets, the ship hull and asteroids all use smooth-shaded
geometry (`SphereGeometry`/`CapsuleGeometry`-family primitives with enough
segments that no facet is visible at either marking viewport, `flatShading`
never set) lit by the one rig in §5.3 rule 2, with a `MeshStandardMaterial`
roughness/metalness pair chosen per class (matte rock for asteroids, a
slight sheen for planets, a brighter clear-coat-like finish for the ship)
so the *material* carries the visual distinction that faceting used to fake.
Low-poly is not revived anywhere in this rewrite.

**R16. Levels are gone; the run is endless and paced by the odometer.**
*Supersedes Decisions 3 and 6 and R12, and deletes `src/game/level.ts`.* A finite
`LevelPlan` array was the direct cause of planets ceasing to spawn: a level
only ended on completion, so a single missed landing left
`decidePlanetActivation` indexing past the end of the plan forever, and the
player coasted through an empty universe with no way to refuel. Planets are
now scheduled off `state.nextPlanetScroll`: whenever the odometer passes it,
one planet is rolled and the next is booked `PLANET_GAP_SCROLL` further on.
The schedule is therefore always ahead of the odometer --- an invariant
asserted every tick in `spec/simInvariants.ts`. Difficulty comes from two
monotonic curves of `scroll.distance` instead of a level index:
`scrollSpeedForDistance` and `asteroidSpawnRatePerSecond`, both capped so a
long run stays flyable.

**R17. Three tanks; air is the only death clock.**
*Supersedes Decision 2.* Colonists are removed. The ship carries `air`
(drains at a constant rate whatever the pilot does --- the clock that makes
landing urgent), `fuel` (spent only while the engine burns) and `ammo`
(spent per shot, rate-limited by `Ship.fireCooldown` so a held trigger
cannot empty the clip in two ticks of a 120Hz loop). A gentle touchdown
refills all three. Only empty air ends the run: an empty tank or an empty
clip is a squeeze that makes the *next* lungful harder to reach, which is a
more interesting failure than an instant one.

**R18. Space has no friction: momentum is conserved, and there is no brake.**
*Supersedes the damping term in Decision 4.* `SHIP_DAMPING` is deleted, and
so is retro-thrust and its `S` binding --- `Input` carries no `retro`. A
ship that stops thrusting coasts at exactly its current velocity forever.
The only way to slow down is to rotate and burn against the direction of
travel, which makes turning-and-burning the core skill of the game rather
than a flourish on top of an autocorrecting drift.

**R19. The on-screen affordances stay wordless (C3).**
The keycap cluster (bottom-right), the resource icons under each meter, and
the pulsing landing ring on each unspent planet are all the tutorial there
is. The keycaps depress on press, so a first keystroke explains the rest.
Every glyph is a stroked SVG path, never a text node, so the C3 "no
on-screen prose" test over the built page still passes by construction.

---

## 5. Architecture

### 5.1 File tree

```
src/game/            pure logic. No `three`, no DOM. Runs headless in vitest.
  vector.ts                KEEP.     Vec2 math
  rng.ts                   KEEP.     seeded PRNG: nextFloat(rng) -> [value, next]
  types.ts                 MODIFY.   + Scroll, + ship.thrusting/invulnUntil,
                                     + planet.driftX/spin, + asteroid.spin,
                                     PlanetSpec.scrollY -> atScroll
  constants.ts             REWRITE.  every tunable, retuned for the frame model (§5.5)
  frame.ts                 NEW.      FRAME bounds + clampToFrame(ship) + isOutsideFrame(e)
  ship.ts                  MODIFY.   + damping, + retroThrust, sets `thrusting`
  collisions.ts            MODIFY.   isGentleLanding takes relative velocity (R5)
  gravity.ts               KEEP.     applyGravity(ship, planets, dt) -> Ship
  scroll.ts                NEW.      scrollSpeedForLevel, advanceScroll,
                                     driftEntities(entities, dt, speed)
  level.ts                 MODIFY.   plan schedules by atScroll; + scrollSpeedForLevel
  spawn.ts                 MODIFY.   entities enter at the TOP edge, not ahead in Z
  state.ts                 MODIFY.   createInitialState seeds the opening planet (R6)
  reducer.ts               MODIFY.   drift -> input -> gravity -> clamp -> spawn ->
                                     collide -> despawn -> level -> end
  index.ts                 NEW.      the public surface src/render and spec/ import

src/render/          side effects. `three`, DOM, input, rAF. Reads GameState, never owns it.
  scene.ts                 REWRITE.  top-down ortho camera, art-directed light rig,
                                     pure `orthoBounds(w, h)` helper (tested)
  frame-to-world.ts        NEW.      toWorld(x, y) -> [x, -y]  (lifted out of camera-follow)
  camera-follow.ts         DELETE.   its only export that survives moves above (R1)
  textures.ts              NEW.      procedural canvas textures: radial glow, star dot,
                                     soft shadow. Generated once, cached, no assets.
  materials.ts             NEW.      one place every material is defined, so the
                                     palette is a table and not scattered guesses
  ship-mesh.ts             REWRITE.  sleek rocket + additive plume scaling with thrust
                                     + damage flash + ground shadow
  planet-mesh.ts           REWRITE.  sphere + terminator shading + identity hue +
                                     colonist progress arc + gravity ring + shadow
  asteroid-mesh.ts         REWRITE.  irregular mesh, tumble, rim light, motion trail
  bullet-mesh.ts           MODIFY.   additive capsule + halo
  starfield.ts             NEW.      3 recycled Points layers at parallax rates (§5.4)
  indicator.ts             NEW.      top-edge chevron for the next planet (§6.7)
  pool.ts                  KEEP.     generic acquire/release-by-id mesh pool
  hud.ts                   MODIFY.   3 meters + level pips + distance + live region
  overlay.ts               NEW.      game-over / level-up flourish DOM, restart control
  input.ts                 MODIFY.   + S retro-thrust, + a 5th touch pad, + Enter restart
  loop.ts                  MODIFY.   fixed-timestep accumulator (R10)

main.ts                    MODIFY.   composition root
index.html                 MODIFY.   + level pips, + overlay, + 5th pad, + live region
styles.css                 MODIFY.   design tokens as CSS custom properties (§5.3)

spec/
  invariants.test.ts       KEEP.     shipped template invariants
  game.test.ts             KEEP+EXT. C2 loss cases, level-complete precedence
  dom.test.ts              NEW.      C3: no instructional text in dist/index.html
  playthrough.test.ts      NEW.      TIER 2 simulation harness (§7.2)
  determinism.test.ts      NEW.      same seed + same tape -> identical state hash
  boundaries.test.ts       NEW.      no game file imports three/DOM; camera reads no ship

test/e2e/                  NEW.      TIER 3, Playwright (§7.3)
  harness.ts                         boot page, expose window.__game, key tape driver
  smoke.spec.ts                      renders, no console errors, canvas non-blank
  playthrough.spec.ts                scripted keys reach a landing, then an ending
  visual.spec.ts                     screenshots at 1920x1080 and 390x844
  perf.spec.ts                       60s soak: frame budget, no object growth
```

### 5.2 Camera and frame geometry

The camera is constructed once and **never moved**. Its orthographic bounds
come from one pure, testable function:

```ts
// scene.ts --- pure, browser-free, unit-tested
export function orthoBounds(viewportW: number, viewportH: number) {
  const aspect = viewportW / viewportH;
  // Never crop the play frame horizontally; grow vertically instead.
  const halfH = Math.max(FRAME_HALF_HEIGHT, FRAME_HALF_WIDTH / aspect);
  const halfW = halfH * aspect;
  return { left: -halfW, right: halfW, top: halfH, bottom: -halfH };
}
```

Invariant, asserted in `spec/`: at every aspect ratio between 0.4 and 3.0,
`halfW >= FRAME_HALF_WIDTH` and `halfH >= FRAME_HALF_HEIGHT`. A narrow phone
sees *more* vertical space, never less horizontal space. The clamp in
`frame.ts` uses the constants, not the derived bounds, so the ship is bounded
identically on every device --- letterbox space beyond the frame is scenery,
not play area.

### 5.3 Art direction (the concrete answer to "sleek and modern")

Defined once in `styles.css` as custom properties and mirrored in
`materials.ts`, so the DOM HUD and the WebGL scene cannot drift apart.

| Token | Value | Used for |
|---|---|---|
| `--void` | `#05060f` | scene clear colour, page background |
| `--void-lift` | `#0c1024` | vertical gradient toward the top edge |
| `--accent` | `#6cf0ff` | ship, bullets, HUD fills, SAFE landing state |
| `--accent-dim` | `#2b6b78` | inactive meter tracks, frame edge hint |
| `--warn` | `#ffb347` | engine plume, UNSAFE landing state |
| `--danger` | `#ff5470` | damage flash, colonist meter when critical |
| `--rock` | `#7d8496` | asteroids (desaturated, hueless by rule R13) |
| `--star-near/mid/far` | `#ffffff` / `#c9d4ff` / `#6b7699` | starfield layers |
| planet hue | `hsl((id * 137.5deg), 55%, 52%)` | per-planet identity (Decision 9) |

Rules that make it read as one system:

1. **Everything the player owns glows; nothing else does.** Ship, plume,
   bullets and HUD fills use additive materials over the glow texture.
   Planets and asteroids are lit, not emissive. This single split is what
   gives the frame a figure/ground at a glance.
2. **One light rig, defined once in `scene.ts`.** A hemisphere light
   (`#3a4a7a` ground / `#dfe8ff` sky, 0.55) plus one directional key from the
   upper-left (`#ffffff`, 0.9). No per-mesh lighting guesses.
3. **Every solid object casts a soft elliptical shadow** onto a plane just
   below the play plane, using the shadow texture --- not real shadow maps.
   Cheap, and it is the depth cue the camera tilt used to provide.
4. **Geometry is smooth-shaded, never faceted or low-poly (Decision R15).**
   High-segment `SphereGeometry(r, 48, 32)` for planets, a smoothed,
   noise-displaced sphere (displacement baked into vertex positions once,
   not per frame) for asteroids so they read as rugged rock without visible
   facets, `flatShading` never set.
5. **Motion is eased, never linear, wherever it is decorative.** Meter fills,
   flourishes and the gravity ring's fade use `cubic-bezier(.2,.8,.2,1)`;
   physics is never eased.
6. **Contrast is checked, not assumed.** 4.5:1 for anything textual or
   numeric, 3:1 for any boundary carrying meaning, verified against `--void`
   in Step R13.

### 5.4 Starfield

Three `Points` layers, fixed size, buffers mutated in place --- never
reallocated:

| Layer | Count | Point size | Rate (× `scroll.speed`) | Colour |
|---|---|---|---|---|
| far | 400 | 1.5 | 0.15 | `--star-far` |
| mid | 220 | 2.5 | 0.40 | `--star-mid` |
| near | 90 | 4.0 | 0.85 | `--star-near` |

Each layer advances its points **downward** on screen, in the same direction
the planets fall, at a fraction of the scroll speed. A point falling below
the bottom bound is recycled to the top with a fresh random `x`. Parallax
comes from the differing rates: distant things appear to move less, which is
the cue that produces the sensation of depth and forward flight.

> **Interpretation, flagged.** The brief for this rewrite asked for a
> starfield moving *upward*. Stars moving up while planets move down is
> counter-parallax and reads as a rendering fault rather than as motion, so
> this plan specifies downward-with-parallax --- the same direction, slower.
> If the intent was literally upward, only the sign of `RATE` per layer
> changes; nothing else in the plan depends on it.

### 5.5 The constants table

`src/game/constants.ts` remains the single home for every gameplay tunable.
Starting values for Phase R --- **all of these are Step R14's to change**:

```
FRAME_HALF_WIDTH            360      frame is 720 x 900 world units
FRAME_HALF_HEIGHT           450
SHIP_EDGE_MARGIN            18       clamp inset, so the rocket never half-exits

THRUST_ACCEL                260
RETRO_ACCEL                 170      S; deliberately weaker than forward thrust
ROTATE_SPEED                3.4
SHIP_DAMPING                0.60     per-second velocity multiplier exponent (R4)
FUEL_PER_THRUST_TICK        0.045
LANDING_SPEED_THRESHOLD     55       now RELATIVE to the planet (R5)

SCROLL_SPEED_BASE           95       world units / s at level 0
SCROLL_SPEED_PER_LEVEL      18
SCROLL_SPEED_MAX            220

PLANET_MIN_RADIUS           30
PLANET_MAX_RADIUS           70
PLANET_GAP_SCROLL           520      was 900 --- the "spawns halfway through" fix (R6)
PLANET_DRIFT_MAX            14
REQ_PER_RADIUS              0.9
BASE_PLANETS_PER_LEVEL      3
MAX_PLANETS_PER_LEVEL       10
OPENING_PLANET_FRAC         0.55     first planet's y as a fraction of FRAME_HALF_HEIGHT
PLANET_CRASH_DAMAGE_SCALE   0.08     colonists lost = ceil(excess relative speed * this) (R14)

ASTEROID_MIN_RADIUS         14
ASTEROID_MAX_RADIUS         42
ASTEROID_SPEED_MIN          22
ASTEROID_SPEED_MAX          70
ASTEROID_ANGLE_SPREAD       0.45     radians either side of horizontal
ASTEROID_DAMAGE_SCALE       0.6
BASE_ASTEROID_RATE          0.20
DIFFICULTY_STEP             0.30

BULLET_SPEED                620
BULLET_LIFETIME             1.1
AMMO_COST_PER_SHOT          0.05

GRAVITY_RADIUS_MULT         6
GRAVITY_STRENGTH            4000
GRAVITY_MAX_ACCEL           90
GRAVITY_SOFTENING           400

INVULN_DISTANCE             60       odometer units of i-frames after a hit (R9)
FIXED_DT                    1/120
MAX_ACCUMULATOR             0.25
FLOURISH_DURATION           1.2
```

---

## 6. Every UI element, and what it owes the player

No element on this list carries instructional text. Each earns its place by
showing state that the player must act on.

### 6.1 The opening frame (the only "tutorial" there is)

On the very first rendered frame, before any input, the player must see:
a **rocket** at frame centre-bottom with its **idle engine flicker** already
animating; a **planet** in the upper half, close enough that its **gravity
ring is already faintly drawn**; **starfield already scrolling**; and the
**three HUD meters full**. From that alone the model is: I am the glowing
thing, that is a destination, the world is moving, I have three resources.
This is the judged half of C3 and the largest single lever on J1.

### 6.2 The canvas

Full-bleed, `#scene`, `position: fixed`, `inset: 0`. `devicePixelRatio`
capped at 2. Redrawn once per rAF regardless of how many fixed ticks ran.

### 6.3 HUD meters (left edge, vertical)

Three 44px-wide vertical meters --- **colonists**, **fuel**, **ammo** ---
stacked with 12px gaps, inset 16px from the left, vertically centred. Each is
`role="meter"` with an `aria-label` and a live `aria-valuenow`. Icon-only, no
numerals: a person glyph, a droplet, a chevron, each drawn as inline SVG.

- Fill height animates over 160ms; a **top-up** from landing overshoots 4%
  and settles, so a gain is distinguishable from a drain by motion alone.
- Below 25%, the fill switches to `--danger` **and** begins a 1.2s pulse ---
  never colour alone.
- The colonist meter's maximum is the level's colonist batch, recomputed only
  when `level.index` changes.

### 6.4 Level pips (top-left, beside the meters)

One small dot per planet in the current level's plan; a dot fills with that
planet's own identity hue when it is colonised. This is the entire
progress-toward-next-level readout, and it costs no text. Cap the row at 10
(`MAX_PLANETS_PER_LEVEL`).

### 6.5 Distance readout (top-right)

`scroll.distance` rendered as an integer with a `km` suffix, tabular
numerals, `--accent-dim`. The one numeral on screen; it is a score, and
scores are the arcade vocabulary for "how well did I do", which the game-over
overlay reuses.

### 6.6 The gravity ring and landing-safety state (on each planet)

The single most important affordance in the game, and it lives on the object
it describes.

| Condition | Ring |
|---|---|
| Ship outside the well | not drawn |
| Ship inside the well, relative speed **above** threshold | thick, dashed, `--warn`, slowly rotating |
| Ship inside the well, relative speed **below** threshold | thin, solid, `--accent`, still |
| Planet colonised | ring gone; planet drops to `PLANET_COLONIZED_LIGHTNESS`, and a solid ring of its own hue sits at the rim |

The state changes on **hue, thickness, dash pattern and motion** together, so
it survives colour-blindness and greyscale. It teaches the whole landing rule
without a word: fly close, see amber, slow down, see cyan, touch down.

### 6.7 Off-screen planet indicator (top edge)

A small chevron slides along the top edge at the `x` of the next planet due
to enter, appearing when it is within one frame-height of entering and fading
as it arrives. It answers "where should I be going" before the target is
visible, which is what keeps a player from wandering into the wrong half of
the frame at speed.

### 6.8 Engine plume

An additive cone behind the rocket whose length and opacity are driven by
whether the ship is thrusting, with a small per-frame noise flicker. At idle
it does not vanish --- it drops to a 15% ember, which is what makes the
rocket read as "on" in the opening frame (§6.1). Retro-thrust draws a
shorter plume from the **nose**, so the direction of push is visible.

### 6.9 Damage feedback

On an asteroid hit: the ship's material flashes `--danger` for the invuln
window and its opacity strobes at 8Hz; a short screen-edge vignette in
`--danger` fades over 400ms; the colonist meter's fill drops with a hard, un-
eased transition (distinguishable from the eased top-up); the asteroid
bursts into 8 pooled debris shards. Feedback at the object it happened to,
plus one page-level mirror.

### 6.10 Level-up flourish

On `advanceLevel`: the level pips clear and re-deal with a 40ms stagger; a
one-second `--accent` pulse sweeps outward from frame centre; the new scroll
speed eases in over 800ms rather than snapping, so the difficulty change is
felt as acceleration.

### 6.11 Game-over overlay

Centred, `--void` at 82% opacity with a backdrop blur. It contains: the
distance reached, large; the level reached, as filled pips; and a single
**restart** control --- a 56px circular button with a reload glyph, focusable,
activated by click, tap, `Enter` or `Space`. The cause of loss is shown by
which HUD meter is left pulsing empty behind the overlay, not by a sentence.
The overlay is `role="dialog"` with `aria-label="Run over"`, focus is moved
to the restart button, and the underlying canvas gets `aria-hidden`.

### 6.12 Touch controls (`@media (pointer: coarse)` only)

Five icon-only pads, each at least 56px, thumb-reachable: rotate-left,
rotate-right on the left; thrust, retro, fire on the right. Each is a
`<button>` feeding the same `Input` record as the keyboard, so `src/game/`
never learns which was used. `touch-action: none` on the pads,
`overscroll-behavior: none` on `body`, and pointer capture so a finger that
slides off the pad still releases it.

### 6.13 Keyboard map

`A`/`←` rotate left · `D`/`→` rotate right · `W`/`↑` thrust ·
`S`/`↓` retro-thrust · `Space` fire · `Enter` restart when the overlay is up.
Every touch affordance has a keyboard equivalent and vice versa.

### 6.14 Accessibility scaffolding (kept, do not remove)

The visually-hidden skip link, the `<nav>`, and the visually-hidden
`<h1>Colony Run</h1>` all stay. Add one `aria-live="polite"` region that
announces only level changes and the run ending --- it is the accessible
mirror of the visual feedback, not a second channel of instruction, and it is
excluded from the C3 no-instructional-text assertion by an explicit allowlist
in `spec/dom.test.ts`.

---

## 7. Testing methodology

Three tiers. A step is not done until its tier-appropriate tests are green.

### 7.1 Tier 1 --- unit (vitest, headless, `src/game/*.test.ts`)

Every pure function, colocated. Target is full branch coverage of what the
step added. Boundary cases explicitly, not just happy paths: zero `dt`, a
planet exactly at the threshold, an asteroid exactly tangent, a level with
one planet, fuel at exactly 0.

Two structural tests that are not about behaviour at all
(`spec/boundaries.test.ts`), because they protect the seams everything else
rests on:

- No file under `src/game/` contains `from "three"`, `document`, `window`,
  `performance`, or `requestAnimationFrame`. Read the sources, regex, assert.
- No file under `src/render/` assigns to `camera.position` outside
  `scene.ts`'s constructor. **This is the regression guard for R1** --- the
  bug this whole rewrite exists to remove must not be able to come back
  silently.

### 7.2 Tier 2 --- simulation (vitest, headless, `spec/playthrough.test.ts`)

The missing tier. A harness drives the real `tick` for thousands of fixed
steps with scripted input, and asserts over the whole run --- no browser, no
flake, runs in CI in under two seconds.

```ts
// spec/harness.ts
export interface Pilot { (state: GameState, step: number): Input }

export function simulate(opts: {
  seed: number;
  pilot: Pilot;
  steps: number;
  onStep?: (s: GameState, i: number) => void;
}): { final: GameState; history: GameState[] };
```

Pilots to write, each a plain function:

| Pilot | Behaviour | Asserts |
|---|---|---|
| `idlePilot` | never presses anything | run ends in a loss within 90s of sim time (**C2**) |
| `thrustPilot` | holds W forever | ship never leaves the frame; fuel reaches 0; loss cause is `"fuel"` |
| `seekPilot` | proportional controller: rotate toward the nearest uncolonised planet, thrust when facing it, cut thrust inside the well | completes level 0 within 120s; reaches level 3 within 8 min |
| `panicPilot` | uniformly random input from the seeded RNG | never throws; never NaNs; entity counts stay bounded |
| `wallPilot` | holds W and D forever | position stays within the clamp on every single step |

Invariants asserted **on every step of every pilot's run** (this is where the
value is --- one harness, five pilots, hundreds of assertions):

1. `|ship.x| <= FRAME_HALF_WIDTH - SHIP_EDGE_MARGIN` and likewise for `y`.
2. No `NaN` or `Infinity` anywhere in the state tree.
3. `fuel`, `ammo` ∈ `[0, 1]`; `colonists >= 0`.
4. `asteroids.length <= 40`, `bullets.length <= 30`, `planets.length <= 12`
   --- the **leak guard**, which no unit test can express.
5. `scroll.distance` is strictly non-decreasing.
6. Every planet's `y` decreased by at least `scroll.speed * dt * 0.99`
   this step --- **planets really do fall**, asserted rather than assumed.
7. Once `end.status === "lost"`, the state is frozen: `tick` is idempotent.
8. `level.colonizedCount <= level.planetsRequired`.

Plus `spec/determinism.test.ts`: the same seed and the same input tape
produce a byte-identical `JSON.stringify` of the final state, twice, and a
stored hash for `seekPilot` at seed 42 is committed. When a tuning change
moves that hash, the diff is the evidence of what the change did --- this is
what makes Step R14's `PROCESS.md` entry factual rather than impressionistic.

### 7.3 Tier 3 --- browser (Playwright, `test/e2e/`)

Not in `pnpm check` (it needs a browser download); wired as
`pnpm test:e2e` and run in CI as a separate, non-blocking job until it is
stable, then made blocking.

`main.ts` exposes `window.__game = { state, paused, setInput, stepN }` under
`import.meta.env.DEV` **or** a `?test=1` query flag, so the harness can drive
the real game deterministically instead of racing rAF.

| Spec | Asserts |
|---|---|
| `smoke.spec.ts` | page loads at both viewports; zero `console.error`; the canvas has non-uniform pixels within 2s (**catches a black screen, which the unit suite never could**); `window.__game.state` exists |
| `playthrough.spec.ts` | with `?test=1&seed=42`, a scripted key tape reaches a landing (`colonizedCount === 1`) and later an ending; the game-over overlay appears and the restart button returns to `level.index === 0` |
| `visual.spec.ts` | screenshots at 1920×1080 and 390×844: the opening frame, mid-flight, inside a gravity well, game over. Compared to committed baselines with a 0.5% pixel tolerance. Baselines are the artefact for the "look at it" loop step. |
| `perf.spec.ts` | 60s soak at 390×844: p95 frame time under 20ms; `renderer.info.memory.geometries` and `.textures` do not grow after the first 5s (**the pooling leak check, finally automated**) |

### 7.4 Where each check runs

| | `pnpm typecheck` | `pnpm test` (T1+T2) | `pnpm test:e2e` (T3) | CI |
|---|---|---|---|---|
| every save | dev server | -- | -- | -- |
| before commit | ✓ | ✓ | -- | -- |
| before push | ✓ | ✓ | ✓ | -- |
| on push | ✓ | ✓ | ✓ (non-blocking first) | ✓ + links, secrets, deploy |

`package.json` gains: `"test:e2e": "playwright test"`, and `check` becomes
`typecheck && build && vitest run`. E2E stays out of `check` so `check` stays
fast enough to run constantly.

---

## 8. Steps

Every step runs the full `CLAUDE.md` loop without exception: design scaffold →
implement → optimise → review the code → review alignment → review the design
principles → `pnpm check` green + **look at the rendered page at both marking
viewports** → one commit → re-align this plan. Run the whole phase start to
finish; do not stop at a step boundary to ask.

**R1. Seams and scaffolding.** Add `spec/boundaries.test.ts` (both structural
tests, §7.1). Add `src/game/frame.ts` with `FRAME_*` constants,
`clampToFrame`, `isOutsideFrame`, fully unit-tested against corners,
exact-boundary and far-outside cases. Nothing else changes yet, and the
camera guard is expected to **fail** at this point --- commit it
red-documented as a skipped test with a `TODO(R4)`, then un-skip in R4.
*Amendment:* `src/game/index.ts` (the public surface §5.1 describes) is
deferred to whichever later step first gives `src/render`/`spec` a reason to
import through it, rather than created empty here.
*Serves:* the foundation for every step below.

**R2. The scroll model.** New `src/game/scroll.ts`:
`scrollSpeedForLevel(index)`, `advanceScroll(scroll, dt)`,
`driftEntities(list, dt, speed)`. Extend `types.ts` with `Scroll`, and
`constants.ts` with the `SCROLL_*` and `FRAME_*` values from §5.5. Tests:
speed is monotonic in level and capped at `SCROLL_SPEED_MAX`; distance is
strictly increasing; drift moves every entity down by exactly
`speed * dt` and touches nothing else. *Serves:* R2, R12, C2.

**R3. Ship in a bounded frame.** Modify `ship.ts`: `SHIP_DAMPING`
(`v *= exp(-SHIP_DAMPING * dt)`, an exponential so it is frame-rate
independent), `retroThrust` input along `heading + PI` at `RETRO_ACCEL` and
the same fuel cost, and set `thrusting`. Apply `clampToFrame` after
integration, zeroing the velocity component normal to the wall touched.
Tests: damping decays speed but never reverses its sign; retro-thrust reduces
forward speed; a ship driven into a corner stops with **both** components
zeroed and neither position component out of bounds; damping is identical
across `dt = 1/60` run twice and `dt = 1/30` run once, to within 1e-6.
*Serves:* R3, R4, J1.

**R4. Kill the camera follow.** Rewrite `scene.ts`: straight top-down
`OrthographicCamera` at `(0, CAMERA_HEIGHT, 0)` looking at the origin, the
one light rig of §5.3, and the pure `orthoBounds` helper. Move `toWorld`
into `frame-to-world.ts` and **delete `camera-follow.ts`**. Un-skip the
camera guard from R1. Tests: `orthoBounds` never crops the frame across
aspect 0.4--3.0; the camera guard passes. Look at both viewports: the world
is still and the ship now moves. *Serves:* R1, R7 --- this is the step that
fixes the headline complaint.

**R5. Entities enter from the top.** Rewrite the scheduling half of
`level.ts` (`PlanetSpec.atScroll`, `PLANET_GAP_SCROLL = 520`, `driftX`,
`spin`) and `spawn.ts` (both planets and asteroids enter at
`y = FRAME_HALF_HEIGHT + radius`, `x` uniform in the frame; asteroid angle
biased near-horizontal by `ASTEROID_ANGLE_SPREAD`). Modify `state.ts` so
`createInitialState` places the first planet directly in frame at
`OPENING_PLANET_FRAC`. Tests: the first planet is inside the frame at step
0; sampled asteroid angles stay inside the spread band over 5000 draws;
consecutive planets are exactly `PLANET_GAP_SCROLL` apart in `atScroll`.
*Serves:* R6, J1 --- the "planets spawn halfway through" fix.
*Amendment:* §5.5 names no constant for `spin`'s range, so this step adds
`PLANET_SPIN_MAX = 1` and `ASTEROID_SPIN_MAX = 2` (rad/s-ish, decorative
tumble only) alongside the table's existing tunables. `decideAsteroidSpawn`
also drops its now-unused `scrollY` option, since entry `y` is
`FRAME_HALF_HEIGHT + radius` and no longer depends on it --- R6/R7 should
not expect that option to still exist.

**R6. Relative-speed landing, and solid planet contact.** Modify
`collisions.ts`: `isGentleLanding(ship, planet, planetVelocity)` (relative
speed, R5), plus new `resolvePlanetContact(ship, planet, planetVelocity):
Ship` --- same shape as `clampToFrame` (Decision R3): if the ship overlaps
the planet, push its position back to the surface along the
planet-to-ship line and zero the radial velocity component, unconditionally
(Decision R14). Thread `planetVelocity` (`{ x: planet.driftX, y:
-scroll.speed }`) through `reducer.ts`. Tests: a ship at rest in the frame
is **not** a gentle landing once `scroll.speed > threshold`; a ship matching
the planet's drift exactly is gentle at any scroll speed; the existing
absolute-speed cases still pass at `scroll.speed = 0`;
`resolvePlanetContact` never leaves the ship's position inside the planet's
radius, at any approach angle or speed; only the radial velocity component
is zeroed, the tangential one survives (so a fast graze slides rather than
snapping to a dead stop). *Serves:* R5, R14, C2.

**R7. Reducer rewrite to the new tick order, plus the planet-crash path.**
Reorder `tick` to §2.3 exactly: drift → input → gravity → clamp → spawn →
collide → despawn → level → end. In the collide phase, planet contact
always runs `resolvePlanetContact` first, then forks on relative speed:
gentle → `attemptLanding` (unchanged deposit/top-up); fast → new
`applyPlanetCrash` (colonists lost via `PLANET_CRASH_DAMAGE_SCALE`, no
deposit, same `INVULN_DISTANCE` gating as `applyAsteroidHit`). Add
`INVULN_DISTANCE` gating to `applyAsteroidHit` too, and `despawn` by
`isOutsideFrame` rather than by `DESPAWN_BEHIND`. Re-run every existing
`spec/game.test.ts` case unchanged to confirm the loss and
level-complete-precedence rules did not move. Tests: an asteroid or a
planet-crash overlapping for 10 consecutive ticks charges damage exactly
once; a fast planet approach stops the ship at the surface **and** loses
colonists, in the same tick; a gentle approach still deposits, never
crashes; an entity below the bottom edge is gone next tick. *Serves:* C2,
R9, R14, J2.
*Amendment:* `applyPlanetCrash`'s signature dropped `planetId`
(`(state, planetVelocity, preContactVelocity)`) --- unlike `attemptLanding`,
a crash never touches the `planets` array (no colonize, no removal), so the
id bought nothing. Also: `resolvePlanetContact` places the ship at exactly
`distance === radius` from the planet centre, and the normalize/rescale
round-trip can put that a hair outside on the very tick it happens ---
`circlesOverlap` (`collisions.ts`) gained a `1e-6` `OVERLAP_EPSILON` so a
gentle landing resolved the same tick as contact isn't missed by float
noise. Neither changes any test-visible behaviour beyond the boundary case
it fixes. Real repeat-fast-crashes on one planet turn out to be
self-limiting (contact zeroes the radial component every tick, so a second
fast hit on the *same* planet is rare by construction) --- the 10-tick
invuln test exercises `applyPlanetCrash`'s shared gate directly rather than
via `tick()`, the same way the existing suite already unit-tests
`attemptLanding`/`applyAsteroidHit` directly; the asteroid invuln test uses
two distinct overlapping asteroids, matching Decision R9's actual
motivation (a cluster, not one asteroid re-hitting itself).

**R8. The simulation tier.** Build `spec/harness.ts`, the five pilots and
all eight per-step invariants of §7.2, plus `spec/determinism.test.ts` with
a committed state hash. Expect this step to **find real bugs in R2--R7** ---
that is its purpose, and any it finds are fixed here before moving on.
*Serves:* R11, C2, J2 (this is the strongest automated-test evidence the
deliverable has).

*Re-align (post-R8):* `harness.ts` (pure `Pilot`/`simulate`, no
describe/it) is split from `pilots.ts` (the five pilots),
`simInvariants.ts` (the one reusable `assertInvariants`, called from
every pilot's `onStep`), `playthrough.test.ts` (describe/it per pilot) and
`determinism.test.ts` --- five files instead of two, each independently
readable and none re-implementing another's assertions.

Two real `src/game/*` bugs surfaced and were fixed, smallest-scope first:

- **No idle-loss guarantee (C2).** Fuel only drained while thrusting, so
  `idlePilot` could sit forever, contradicting C2's "play ends somewhere."
  Fix: `FUEL_DRAIN_PASSIVE` (constants.ts), applied unconditionally every
  tick in `ship.ts`'s `applyInput` --- an idle ship now loses to fuel by
  t=80s, inside the 90s bound.
- **Planet contact could push the ship past the frame clamp (risk #3).**
  `resolvePlanetContact` places the ship at `planet.position + direction *
  planet.radius`; near a large planet close to an edge that surface point
  can sit outside `CLAMP_X`/`CLAMP_Y`, violating Decision R3 ("the ship
  never leaves the frame"). Fix: `reducer.ts`'s `resolveShipPlanetContact`
  now reclamps with `clampToFrame` after `resolvePlanetContact`, the same
  as any other wall contact.

`seekPilot` needed a per-axis proportional controller (independent
closing-velocity caps on x and y) rather than one normalized direction
vector, so a large vertical gap to a falling planet can never starve
lateral correction --- that was pilot-authoring, not a `src/game/*` bug.
The determinism hash is committed for seekPilot @ seed 42, 2000 steps; its
value carries no meaning, only its stability does --- a diff here on an
unrelated change is a tuning regression to look at, not silence to fix.

**R9. Fixed timestep.** Rewrite `loop.ts` as an accumulator (`FIXED_DT`,
`MAX_ACCUMULATOR`, render once per rAF regardless of tick count). Expose
`window.__game` under dev-or-`?test=1`. Tests: the accumulator runs the
expected tick count for a given elapsed time and never spirals after a 3s
stall. *Serves:* R10, and it is a precondition for Tier 3.

*Re-align (post-R9):* the tick-count math (`accumulator + elapsed`, capped
at `MAX_ACCUMULATOR`, divided into `FIXED_DT` steps) is pulled out as a
pure `ticksForElapsed`, exported from `loop.ts` and unit-tested directly in
`src/render/loop.test.ts` --- the only way to assert an exact tick count
without faking rAF's timing end-to-end. `FIXED_DT`/`MAX_ACCUMULATOR` stay
local to `loop.ts` rather than moving to `render-constants.ts`, since that
file's own header scopes it to "visual-only tunables" and these are a
timing concern, not a visual one. `startLoop` now returns a
`LoopController` (`getState`, `isPaused`/`setPaused`,
`setInputOverride`, `stepN`) instead of `void`, so `main.ts` --- the
composition root, not `loop.ts` --- can build `window.__game = { state,
paused, setInput, stepN }` from it; `loop.ts` itself stays a pure timing
mechanism with no DOM/window concerns. `stepN(n)` runs `n` ticks
synchronously and renders once, for a later Playwright harness to drive
the game deterministically. Only `main.ts`, `src/render/loop.ts` and the
new `src/render/loop.test.ts` changed.

**R10. Art foundation.** Build `textures.ts` (procedural radial glow, star
dot, soft shadow --- generated to an offscreen canvas once, cached, zero
assets so CI's link check has nothing new to verify) and `materials.ts` (the
§5.3 palette as one table). Rewrite `styles.css`'s tokens to the same values.
No visual change lands yet beyond the scene clear colour and light rig; this
step exists so R11--R13 are assembly rather than invention. *Serves:* R8,
R13, general interface rules.

*Re-align (post-R10):* `materials.ts` exports `PALETTE` (the ten §5.3
tokens, hex numbers) plus the render-constant aliases derived from it
(`SHIP_COLOR`, `ENGINE_GLOW_COLOR`, `ASTEROID_COLOR`, the planet
hue/saturation/lightness constants) --- one table, as the step asked.
`render-constants.ts`'s pre-existing near-duplicate colours (`ENGINE_GLOW_
COLOR` 0xff8a3d, `ASTEROID_COLOR` 0x8a8a8a, `PLANET_LIGHTNESS` 0.5) were
drift, now resolved by making `render-constants.ts` a thin re-export of
`materials.ts` plus its two remaining non-colour values (`CAMERA_HEIGHT`,
`PLANET_COLONIZED_LIGHTNESS`, neither a §5.3 token) --- zero mesh-file
changes needed. Ammo has no §5.3 token (danger is reserved for the <25%
critical state, §6.3): its existing 0xffe066 stays, as `BULLET_COLOR` in
materials.ts and as its own value in `styles.css`, justified by the
ammo/bullet colour pairing rather than forced onto an ill-fitting token.
`textures.ts` exports `createGlowTexture`/`createStarDotTexture`/
`createShadowTexture`, each lazily building and caching one `CanvasTexture`
on first call (module-level cache, never regenerated); the shadow texture
is a circular soft blob, with the ellipse from §5.3 rule 3 left to a
non-uniform plane scale at the R12/R13 call sites. No unit test exercises
the canvas drawing: this repo's vitest run has no `document` at all by
default, and jsdom has no working 2D context without the (uninstalled)
`canvas` npm package, confirmed by hand before deciding to rely on reading
the gradient-stop code instead. `scene.ts` gained one line,
`renderer.setClearColor(PALETTE.void)`; the light rig was already correct
and untouched. No mesh file changed beyond what the re-export made
unnecessary to touch.

**R11. Starfield.** Build `starfield.ts` per §5.4: three fixed-size `Points`
layers, positions mutated in place, recycled at the bottom bound, rate from
`scroll.speed`. Wire into `main.ts`. Verified by looking, and by a soak look
for particle growth. *Serves:* the motion feedback the brief asks for, J1.

**R12. Entity meshes, smooth-shaded throughout.** Rewrite `ship-mesh.ts`
(rocket group, additive plume scaling with `thrusting`, nose plume on
retro, damage strobe, ground shadow), `planet-mesh.ts` (smooth
`SphereGeometry(r, 48, 32)`, no `flatShading`, identity hue, colonised
lightness cut, colonist progress arc, gravity ring with all four states of
§6.6, shadow), `asteroid-mesh.ts` (smooth noise-displaced sphere --- vertex
positions perturbed then normals recomputed, never a jittered low-poly hull
--- tumble by `spin`, rim light, motion trail, 8-shard pooled debris burst)
and `bullet-mesh.ts` (additive capsule + halo). Material (roughness /
metalness), not facet count, carries the visual distinction between planet
identities. All pooled through the existing `pool.ts`. Verified by looking
at both viewports, thrust on and off, inside and outside a well, confirming
no visible facets on any body at rest or under rotation. *Serves:* the
graphics rework, R15, R13, J1.

**R13. HUD, indicator, overlay, input.** Extend `hud.ts` (meters with eased
top-up and un-eased drain, low-fuel pulse, level pips, distance readout,
live region), build `indicator.ts` (§6.7) and `overlay.ts` (§6.11), extend
`input.ts` (`S`, fifth pad, `Enter` restart, pointer capture), reshape
`index.html` and `styles.css` to match. Then run the whole colour/contrast
pass of §5.3 rule 6 and confirm nothing is signalled by colour alone.
Tests: `spec/dom.test.ts` (C3, with the live-region allowlist). *Serves:*
C3, J1, general interface rules (44px targets, keyboard parity, contrast).

**R14. Browser tier.** Add Playwright, `test/e2e/*` per §7.3, the
`test:e2e` script, and a non-blocking CI job. Commit the four visual
baselines at both viewports. *Serves:* R11 and every judged line, since the
baselines are what makes "look at it" reviewable by someone else.

**R15. Playtesting and tuning.** Actually play the built game, repeatedly, at
both viewports and with touch controls. Tune `SCROLL_SPEED_*`,
`SHIP_DAMPING`, `LANDING_SPEED_THRESHOLD`, `GRAVITY_STRENGTH`,
`PLANET_GAP_SCROLL` and the asteroid rates from how the run feels, not from
theory. Every change is logged in `PROCESS.md` in the cited-moment format
with the before/after value, the reason, and the resulting change to the
committed determinism hash. Re-run `seekPilot` after each change: if the
seeking pilot can no longer finish level 0 inside 120s, the tuning went too
far. *Serves:* J1, J2 (this step **is** J2's "one change came from playing
the finished game").

**R16. Ship, deploy, evidence.** Update `PROCESS.md` and
`reflections/crit-5.md` with this phase's moments. `pnpm check` green,
`pnpm check:evidence` green, `pnpm test:e2e` green, CI green, deployed.
Confirm the live URL at both marking viewports on real hardware. *Serves:*
C1, C6.

---

## 9. Risks

| # | Risk | Which step finds out | Fallback |
|---|---|---|---|
| 1 | **A bounded frame plus rotate-and-thrust is simply not fun** --- the ship spends its life against a wall and the player never feels agency. This is the largest design risk in the rewrite. | R3, confirmed or denied at R15 | Raise `SHIP_DAMPING` toward 1.2 and lower `THRUST_ACCEL`; if that still fails, replace rotate-with-inertia by direct 8-way velocity control, which costs `ship.ts` and nothing else --- the seam is already there. |
| 2 | **Relative-speed landing makes late levels unlandable anyway**, because the ship must both match a fast drift and fight gravity. *R6 finding:* `SCROLL_SPEED_BASE` (95) already exceeds `LANDING_SPEED_THRESHOLD` (40), so a ship holding perfectly still fails to land from **level 0**, not only at high levels --- the pilot must actively match the planet's downward drift from the first planet on. | R6 unit tests, then R8's `seekPilot` at level 3+ | Cap the drift component used by `isGentleLanding` at a constant, so scroll speed stops raising the landing bar past a point. One named constant. R15 should confirm level-0 landing still feels reachable, not just level 3+. |
| 3 | **Gravity fights the frame clamp**: a planet near the frame edge pulls the ship into the wall and pins it there with no escape. | R8 `panicPilot` invariant 1, and R15 | Fade gravity to zero within `SHIP_EDGE_MARGIN * 3` of a wall, or exclude planets whose centre is outside the frame from the gravity sum. |
| 4 | **Screenshot baselines are flaky** --- procedural textures, `Date.now()` seeding, and rAF timing all vary. | R14 | The `?test=1` flag already fixes the seed and pauses rAF; if still flaky, raise tolerance to 2% or assert on structural properties (mean luminance per quadrant) rather than pixels. |
| 5 | **Playwright inflates CI time and install size.** | R14 | Keep it a separate non-blocking job, `--project=chromium` only, and cache the browser download. It never enters `pnpm check`. |
| 6 | **The additive-glow look reads as noise rather than sleek**, especially with 700 star points and a plume on a small phone screen. | R11--R12, looked at, not reasoned about | Cut the near star layer, drop halo opacity, and rely on the shadow plane for depth. The palette table makes this a one-file change. |
| 7 | **Perf on a real phone**: 700 points + up to 40 pooled meshes + shadows + halos at DPR 2. | R14 `perf.spec.ts`, and looking on hardware | DPR cap is already 1.5 away; then merge the three star layers into one buffer, then drop shadows. |
| 8 | **This rewrite regresses a rule Phase A/B already got right.** | R7 explicitly re-runs the existing `spec/game.test.ts` unchanged | The existing tests are the contract; a Phase R step that needs one changed must say so in its own text and justify it, which only R6 currently does. |
| 9 | **The starfield direction is an interpretation** (§5.4), not a confirmed requirement. | Asked at plan review; visible at R11 | One sign flip per layer. Nothing depends on it. |
| 10 | Five minutes to an ending, with no instructions, for a stranger --- still the judged risk that no test covers. | R15, by watching someone else play | Slow `SCROLL_SPEED_BASE`, widen `LANDING_SPEED_THRESHOLD`, and lean harder on the gravity ring (§6.6) as the teacher. |
| 11 | **Gravity now feeds a real collision, not a no-op**: a ship pulled in hard by a planet's gravity well can cross the gentle-landing threshold into a crash before the player can react, so `applyPlanetCrash` fires on approaches that read as "just gravity assist" rather than "pilot error." | R6 unit tests (threshold placement), R8 `seekPilot`/`panicPilot` near a well | Widen `LANDING_SPEED_THRESHOLD` relative to the gravity well's peak pull speed, or taper gravity strength in the last `SHIP_EDGE_MARGIN`-scale ring above the surface so terminal velocity at contact stays landable by default. |
