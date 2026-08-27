# Build plan --- crit-5, "A game"

## What this is

A single full-screen page: a top-down rocket flies an endless vertical
scroll, rendered in real WebGL (Three.js) through an elevated, lightly
tilted orthographic camera over a strictly 2D play plane. Planets and
asteroids scroll toward the ship from ahead. A/D rotate the ship, W thrusts
along the current heading with true Newtonian inertia --- no drag, no
auto-brake, so slowing down means turning around and thrusting the other
way --- and Space fires a bullet. Landing gently on a planet deposits
colonists and tops up fuel and ammo; colliding with an asteroid costs
colonists but destroys it; a bullet destroys an asteroid for free.
Colonising every planet in a level advances to a harder one; running out of
colonists or fuel first ends the run. There is no instruction anywhere on
screen --- the opening frame has to make the first move obvious by what it
shows, not what it says.

## The entities, and how they interact

**Ship** owns position, heading, velocity, colonists, fuel, ammo. It is the
only entity the player directly manipulates.

**Planet** owns position, radius, colonistsRequired, colonized. It never
initiates anything --- it is landed on.

**Asteroid** owns position, drift velocity, radius. It moves on its own each
tick, independent of the ship.

**Bullet** owns position, velocity, a countdown lifetime. It is spawned by
the ship and destroys the asteroid it reaches.

**Level** owns a fully pre-generated plan (every planet's position, size and
requirement for that level, decided once at level start) and the running
counts (`spawnedCount`, `colonizedCount`) against that plan.

**The reducer** is the only place that resolves interactions between
entities: it owns no persistent state itself, just the pure functions that
take one `GameState` and produce the next.

Flow per tick:

```
input (keyboard/touch)          -> ship.applyInput            -> ship moves
scroll advancing                -> spawn.decidePlanetActivation -> a planned planet becomes live
scroll advancing                -> spawn.decideAsteroidSpawn    -> a new asteroid appears
ship overlaps live planet, slow -> reducer.attemptLanding      -> colonists deposited, fuel/ammo topped up, colonizedCount++
ship overlaps asteroid          -> reducer.applyAsteroidHit    -> colonists lost, asteroid destroyed
bullet overlaps asteroid        -> both removed, no colonist cost
colonizedCount == planetsRequired -> reducer.advanceLevel      -> new plan, fresh colonist batch, fuel/ammo untouched
colonists == 0 or fuel == 0 (level not just completed) -> reducer.checkEndCondition -> run over
```

Couplings deliberately absent: **the renderer never decides gameplay** ---
`src/render/*` only reads `GameState` and mirrors it into Three.js meshes and
DOM, so a headless test can drive the whole game with no browser. **The
level plan never depends on the render layer or on wall-clock time** --- it
is a pure function of level index and RNG state, so difficulty is
reproducible and testable. **Fuel and ammo never depend on the level plan**
except through the top-up percentage --- they persist across levels and are
never reset.

## The published spec, sorted

Checkable:

- **C1** deployed and live at the public Pages URL by the cutoff --- served
  by the CI/ship flow, not this plan's architecture.
- **C2** a wrong move is possible and play ends somewhere --- served by
  `reducer.checkEndCondition`, `attemptLanding`, `applyAsteroidHit`; tested
  in `spec/game.test.ts`.
- **C3** (checkable half) no instructional markup/text in the built DOM ---
  tested in `spec/game.test.ts` against `dist/index.html`.
- **C6** the repo shows the process --- commits, `PROCESS.md`,
  `reflections/crit-5.md` --- process, not architecture.

Judged:

- **J1** a stranger can pick it up and reach an ending inside five minutes
  --- served by the opening-frame affordance and by tuning (Step 9).
- **J2** one rule has a focused automated test, and one change came from
  playing the finished game --- the level-complete-precedence test
  (`spec/game.test.ts`) is the automated half; a tuning change from
  playtesting is logged in `PROCESS.md`.
- **J3** can account for how the work was directed, grounded and corrected
  --- oral, at the crit.

## Decisions taken

1. **Level plans are generated whole, up front, not built up as the world
   scrolls.** This is what lets the colonist batch be sized to exactly cover
   the level's total requirement as a single sum over a known set of
   planets, rather than an estimate. Planets are merely *activated* as
   scroll reaches their planned position; asteroids stay genuinely
   endless/procedural since they have no fixed total to sum against.
2. **Level-complete outranks a loss, and the guard lives inside
   `checkEndCondition` itself, not only in `tick`'s call order.**
   `checkEndCondition` checks `colonizedCount >= planetsRequired` first and
   returns `"playing"` before it looks at colonists or fuel, so a caller
   that invokes it directly on a post-landing state (as `spec/game.test.ts`
   does) still gets the win reading --- `tick` additionally resolves
   `advanceLevel` before ever calling it, so the ordering reinforces the
   guard rather than being the only thing enforcing it. This is the one
   rule J2's focused test targets.
3. **Landing too fast is a pure no-op:** no deposit, no penalty, no state
   change. Anything else would create a second, unstated wrong-move
   mechanism, diluting C2's one canonical loss path (colonists or fuel
   hitting zero) into something judged tests could disagree about.
4. **Fuel and ammo persist across levels; colonists are re-issued fresh per
   level.** This matches the brief precisely and is why the landing top-up
   is a *percentage* (`1 / planetsRequiredThisLevel`) rather than a flat
   amount --- a flat amount would over- or under-reward levels of different
   length.
5. **HUD is a DOM overlay, not in-scene sprites.** DOM/CSS scales legibly at
   both 1920x1080 and 390x844 with `clamp()` alone; screen-space
   billboarding of 3D sprites would need extra machinery to avoid
   shrinking/growing unreadably across that range.
6. **Touch controls are on-screen icon-only pads, shown only under
   `pointer: coarse`.** WASD/space has no touch equivalent; icon pads that
   feed the same `Input` shape keep `src/game/*` input-source-agnostic and
   add nothing textual.
7. **The run has no ultimate "win screen."** Per-level completion is the win
   beat the brief describes; the run itself is endless-escalating until a
   loss, satisfying "ends somewhere" via the classic arcade shape.

## Architecture

```
src/game/          -- pure logic. No `three`, no DOM/document/window. Runs headless in vitest.
  vector.ts / .test.ts       Vec2 math
  rng.ts / .test.ts          seeded PRNG: nextFloat(rng) -> [value, nextRng]
  types.ts                   Vec2, Ship, Planet, Asteroid, Bullet, LevelState, GameState, Input, EndState
  constants.ts               every tunable (THRUST_ACCEL, LANDING_SPEED_THRESHOLD, ASTEROID_DAMAGE_SCALE, ...)
  ship.ts / .test.ts         applyInput(ship, input, dt) -> Ship  (integration, no drag term)
  collisions.ts / .test.ts   circlesOverlap, isGentleLanding
  level.ts / .test.ts        planetsRequiredForLevel, asteroidSpawnRatePerSecond, generateLevelPlan,
                              colonistBatchForLevel, fuelAmmoTopUpFraction
  spawn.ts / .test.ts        decidePlanetActivation, decideAsteroidSpawn (take/return RngState)
  state.ts / .test.ts        createInitialState(seed) -> GameState
  reducer.ts / .test.ts      tick, attemptLanding, applyAsteroidHit, fireBullet, advanceLevel, checkEndCondition

src/render/        -- side effects. `three`, DOM, input, rAF. Reads GameState, never owns it.
  scene.ts                   Scene/OrthographicCamera/lights/renderer
  ship-mesh.ts / planet-mesh.ts / asteroid-mesh.ts / bullet-mesh.ts   pooled, id-keyed sync(scene, entities)
  pool.ts                    generic acquire/release-by-id mesh pool
  camera-follow.ts           camera position/lookAt from ship each frame (the whole "scroll" effect)
  hud.ts                     DOM overlay: 3 icon-only meters (colonists/fuel/ammo), reads state, writes DOM
  input.ts                   keyboard (WASD/space) + touch pads (pointer:coarse only) -> one Input shape
  loop.ts                    requestAnimationFrame: owns dt, calls tick(), calls render syncs

main.ts             composition root: build renderer/scene/camera, wire input->tick->render+hud, start loop
index.html          visually-hidden skip-link nav + visually-hidden h1 "Colony Run" + canvas + #hud, in <main>
styles.css          HUD bars, full-bleed canvas, touch-pad styling, .visually-hidden utility

spec/game.test.ts   new: C2 loss/level-complete-precedence cases (against src/game/* directly, no browser),
                     C3 checkable half (dist/index.html has no instructional markup/text)
```

Build-time only: nothing beyond the existing `vite.config.ts` entry
discovery (unchanged, single HTML page). Everything under `src/` and
`main.ts` ships in the bundle. No file under `src/game/` may import `three`
or reference `document`/`window`/`requestAnimationFrame` --- that import
boundary is the enforceable seam that keeps the game logic testable without
a browser.

## Steps

Each step runs the full loop from `CLAUDE.md`: design scaffold, implement,
optimise, review the code, review alignment against spec/brief/plan, review
the design principles, check+look+commit, re-align the plan --- before
starting the next step.

1. **Pure math + RNG.** Build `vector.ts`, `rng.ts`. Tests: exact arithmetic,
   determinism of `rng` given a seed. Serves: foundation for C2.
2. **Ship physics.** Build `types.ts`, `constants.ts`, `ship.ts`. Tests:
   rotation, thrust with no drag, fuel drain. Serves: foundation for C2.
3. **Collisions.** Build `collisions.ts`. Tests: overlap boundary cases,
   gentle vs fast landing. Serves: foundation for C2.
4. **Level generation + spawning.** Build `level.ts`, `spawn.ts`. Tests:
   `planetsRequiredForLevel` monotonic, `colonistBatchForLevel` sums
   correctly, `asteroidSpawnRatePerSecond` scales with level. Serves:
   level-progression half of C2, sets up J2's test.
5. **The reducer.** Build `state.ts`, `reducer.ts`. Tests:
   `spec/game.test.ts`'s loss cases and the level-complete precedence case.
   Serves: C2, J2 (automated half).
6. **Rendering skeleton.** Build `render/scene.ts`, `*-mesh.ts`, `pool.ts`,
   `camera-follow.ts`, wire into `main.ts`. No new tests (needs a browser)
   --- verified by looking. Serves: J1 (playable at all).
7. **Input + HUD.** Build `input.ts`, `hud.ts`; reshape `index.html` /
   `styles.css` for the nav/h1/canvas/hud shape. Tests: `spec/game.test.ts`'s
   C3 checkable half. Serves: C3, general interface rules (44px targets,
   keyboard parity).
8. **Opening-frame affordance.** Idle engine-glow cue, initial camera
   framing a nearby planet/asteroid. No new automated test --- named
   explicitly as the judged half of C3/J1.
9. **Playtesting tuning pass.** Adjust `constants.ts` from actually playing
   the built game; log the before/after and why in `PROCESS.md`. Serves: J1,
   J2 (process-evidence half).
10. **Ship, deploy, evidence.** `PROCESS.md`, `reflections/crit-5.md`, CI
    green, deployed. Serves: C1, C6.

## Risks

- Three.js bundle size/CI build time: import only `three` core, no example
  add-ons; measure `pnpm check` duration once wired in.
- WASD/space is keyboard-only; the 390x844 marking viewport is touch.
  On-screen touch pads (Step 7) are the mitigation and the highest-risk item
  for J1.
- Tuning colonist/fuel/ammo/asteroid-density so a stranger reaches an ending
  inside five minutes without instructions is a playtesting risk, not a
  coding one --- budgeted as Step 9, and doubles as J2's evidence.
- The "gently" landing threshold: too strict reads as unresponsive, too
  lenient removes the challenge --- tunable via one named constant.
- Endless spawn/despawn without pooling risks GPU/memory growth over a long
  run --- mitigated by `render/pool.ts`; checked by a manual soak-test look,
  not a unit test, since it needs the browser.
- The opening-frame affordance's *effectiveness* (not its absence of text)
  is judged, not checkable --- named here so no test is mistaken for
  covering it.
