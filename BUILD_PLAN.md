# Build plan --- crit-5, "A game"

## What this is

A single full-screen page: a rocket ship flies an endless vertical scroll
through a starfield, rendered in real WebGL (Three.js) through an elevated,
lightly tilted orthographic camera over a strictly 2D play plane. Round
planets and asteroids scroll toward the ship from ahead, asteroids drifting
slowly cross-wise so they read as crossing the screen rather than falling
straight down it. A/D rotate the ship, W thrusts along the current heading
with true Newtonian inertia --- no drag, no auto-brake, so slowing down
means turning around and thrusting the other way --- and Space fires a
bullet. Close to a planet, its gravity pulls the ship in too, on top of
thrust: coast in with the engine off and gravity alone can carry the ship
to a gentle landing, or approach too fast and gravity accelerates a crash
instead. Landing gently on a planet deposits colonists and tops up fuel and
ammo; colliding with an asteroid costs colonists but destroys it; a bullet
destroys an asteroid for free. Colonising every planet in a level advances
to a harder one; running out of colonists or fuel first ends the run. There
is no instruction anywhere on screen --- the opening frame has to make the
first move obvious by what it shows, not what it says.

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

**Gravity** is not an entity --- it owns no state of its own --- but a pure
per-tick force computed from `ship.position` against every live `Planet`
within its well, and it is the one new coupling between those two entities.
It never touches fuel or ammo: it is a free force, same as any real gravity
well, which is what makes "coast in on gravity alone" a real option and not
a fuel-refund in disguise.

**Starfield** is render-only: two fixed-size point clouds owned entirely by
`src/render/starfield.ts`, with no representation in `GameState` at all. It
reads the ship's speed to set its own scroll rate and nothing else; the
reducer and every test in `src/game/*` are unaware it exists.

**The reducer** is the only place that resolves interactions between
entities: it owns no persistent state itself, just the pure functions that
take one `GameState` and produce the next.

Flow per tick:

```
input (keyboard/touch)          -> ship.applyInput            -> ship moves
ship near a live planet         -> gravity.applyGravity        -> ship velocity pulled toward planet
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
never reset. **Gravity never depends on the render layer** --- it is a pure
function of `Ship` and `Planet[]`, tested the same headless way as `ship.ts`.
**The starfield never depends on `GameState`'s shape** beyond a speed
scalar --- it cannot regress a game-logic test, and a game-logic change
cannot silently break the starfield.

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

## Decisions taken --- modification phase (round planets, rocket, starfield, gravity)

8. **Planets become true spheres (`IcosahedronGeometry`, uniform scale),
   not cylinders scaled on X/Z.** The tilted camera reads a flat-topped
   cylinder as a disc with a visible side wall, not a ball; a sphere reads
   as round from any angle the camera could ever take, including a future
   tuning of `CAMERA_HEIGHT`. Low-subdivision icosahedron (facets, not a
   smooth sphere) keeps the "slick, modern" low-poly language the ship and
   asteroids already use, and needs no texture asset --- nothing new to
   load, nothing new for CI's link check to verify.
9. **Each planet's hue is derived deterministically from its `id`, not
   fixed.** Colour is reserved for identity, not decoration (general
   interface rules): with several planets visible at once under the wider
   responsive frustum (Decision 13), a fixed single colour makes them
   indistinguishable at a glance. The colonized-state tint stays a
   lightness cut on top of that hue, so "landed on" is still legible by
   colour shift alone, layered on identity rather than replacing it.
10. **The ship mesh becomes a grouped rocket (nose cone + body + fins) in
    place of the flat arrowhead, as a `Group` with the same nose-along-+X,
    apex-at-heading convention the arrowhead used.** Keeping that
    convention is what makes this a render-only change: `syncShipMesh`'s
    `mesh.rotation.y = ship.heading` line, and every game-logic file, need
    not change at all. The ship's collision radius is already `0` (a point
    ship, per `collisions.ts`) so the mesh's visual size was always
    decorative --- growing it to rocket-sized geometry changes nothing about
    fairness.
11. **Gravity is one pure function, `applyGravity(ship, planets, dt)`, called
    in `tick` before `applyInput`, not folded into `ship.ts`.** `ship.ts`
    stays planet-free and independently testable (matches the existing
    "couplings deliberately absent" rule); calling gravity first means its
    acceleration lands in `ship.velocity` before `applyInput`'s existing
    `position = position + velocity * dt` line integrates it, so no second
    position-integration line has to be written or kept in sync with the
    first. Gravity is capped (`GRAVITY_MAX_ACCEL`) and softened
    (`GRAVITY_SOFTENING` added to squared distance) so it strengthens
    smoothly on approach rather than spiking near the surface --- an
    uncapped inverse-square term would make "gently" unreachable close in
    and turn every near-miss into an instant, unavoidable crash.
12. **Gravity does not relax `LANDING_SPEED_THRESHOLD`.** The threshold is
    the same number whether gravity helped the ship in or thrust did all
    the work; gravity only changes how a player reaches a landing speed
    under it (coast in early, or fight it late), not what counts as gentle.
    This keeps C2's one canonical loss path unchanged and gives gravity a
    real way to produce a bad outcome (a fast, greedy approach now
    accelerates into a crash) rather than only ever helping ("knobs that
    can produce a bad outcome").
13. **The camera's ortho half-height is `max(VIEW_HALF_HEIGHT, LANE_HALF_WIDTH / aspect)`,
    not a fixed constant.** At the 390x844 marking viewport (aspect ~0.46)
    the old fixed `VIEW_HALF_HEIGHT` left roughly half the play lane's width
    off-screen --- asteroids and planets near the lane edge were invisible
    until they were already close. Widening vertically instead of ever
    cropping the lane means a narrow viewport sees more of what's ahead, not
    less of what's beside it, which is the same "what's coming matters more
    than what's passed" reasoning `CAMERA_LOOK_AHEAD` already rests on. The
    formula is extracted to a pure, browser-free function so it stays
    testable (`design for testability`, `PROCESS.md`).
14. **Starfield motion, not camera motion, sells forward speed.**
    `camera-follow.ts` already tracks the ship 1:1, so the ship never moves
    relative to its own camera; the only thing that can visibly move at a
    rate tied to speed is something the camera does *not* lock to the ship.
    Two independently-recycled point layers (near/far) at different scroll
    rates give parallax depth for free and need no new `GameState` field ---
    consistent with the starfield owning no game state at all.

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
  gravity.ts / .test.ts      new: applyGravity(ship, planets, dt) -> Ship, planet-aware, ship-only
  state.ts / .test.ts        createInitialState(seed) -> GameState
  reducer.ts / .test.ts      tick, attemptLanding, applyAsteroidHit, fireBullet, advanceLevel, checkEndCondition
                              (tick gains one line: applyGravity before applyInput)

src/render/        -- side effects. `three`, DOM, input, rAF. Reads GameState, never owns it.
  scene.ts                   Scene/OrthographicCamera/lights/renderer; ortho-bounds math extracted to a
                              pure, tested helper (Decision 13)
  ship-mesh.ts               rewritten: grouped rocket (nose/body/fins) replaces the flat arrowhead
  planet-mesh.ts             rewritten: icosahedron sphere, uniform scale, per-id hue (Decisions 8-9)
  asteroid-mesh.ts           extended: a pooled trail mesh per asteroid, oriented along velocity
  bullet-mesh.ts             pooled, id-keyed sync(scene, entities) --- unchanged
  starfield.ts               new: two fixed-size recycled Points layers, speed-linked scroll (Decision 14)
  pool.ts                    generic acquire/release-by-id mesh pool --- unchanged
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

## Steps --- modification phase

Same loop as above, every time: design scaffold, implement, optimise,
review the code, review alignment, review the design principles,
check+look+commit, re-align the plan. Steps 1-10 above shipped the playable
game; these extend it and touch no already-shipped test's assertions except
where a step says so explicitly.

11. **Gravity core physics.** Build `src/game/gravity.ts`: `applyGravity`,
    new constants `GRAVITY_RADIUS_MULT`, `GRAVITY_STRENGTH`,
    `GRAVITY_MAX_ACCEL`, `GRAVITY_SOFTENING` in `constants.ts`. Tests: no
    pull outside the well; pull direction points at the planet's centre;
    monotonic falloff with distance; the accel cap holds arbitrarily close
    to the surface; two overlapping wells sum vectorially. No wiring into
    `tick` yet --- this step is pure math, reviewable and correct in
    isolation before anything depends on it. Serves: the brief's gravity
    requirement, foundation for Step 12.
12. **Wire gravity into the reducer.** Add the `applyGravity` call to
    `tick` (Decision 11); no change to `ship.ts`, `collisions.ts`, or
    `LANDING_SPEED_THRESHOLD` (Decision 12). Tests: a ship coasting
    (`thrust: false`) within a planet's well ends the tick closer to it and
    at nonzero inward velocity; a ship approaching too fast still fails
    `isGentleLanding` after gravity's added speed, i.e. gravity can turn a
    borderline-gentle approach into a crash. Re-run the existing
    `spec/game.test.ts` loss/level-complete cases unchanged to confirm no
    regression. Serves: the brief's gravity requirement, C2 (gravity adds a
    genuine new way a wrong move ends the run).
13. **Round planets.** Rewrite `planet-mesh.ts` per Decisions 8-9:
    icosahedron geometry, uniform scale by `radius`, per-id hue, colonized
    lightness cut retained. No test (needs a browser) --- verified by
    looking at both marking viewports. Serves: the brief's round-planets
    requirement, general interface rules (colour reserved for identity).
14. **Rocket ship mesh.** Rewrite `ship-mesh.ts` per Decision 10: grouped
    nose/body/fins, same heading convention, engine-glow tail position
    re-measured against the new geometry's local space. Verified by
    looking, both viewports, thrust on and off. Serves: the brief's
    rocket-ship requirement, J1 (a recognisable rocket reads as "this is
    what I'm flying" faster than an arrowhead did).
15. **Starfield.** Build `src/render/starfield.ts`: two fixed-size `Points`
    layers, positions recycled (wrapped forward) as the camera passes
    them, far layer static per-frame, near layer's Z offset advanced by
    ship speed each frame (Decision 14); wire into `main.ts`. No
    per-frame allocation --- buffers are mutated in place. No test (needs a
    browser) --- verified by looking, and by a soak-test look for particle
    growth over a long run. Serves: the brief's starfield/motion
    requirement, J1 (visible motion is itself an affordance that thrust
    works).
16. **Asteroid tuning for "slow, cross-screen."** Lower
    `ASTEROID_SPEED_MIN`/`MAX` in `constants.ts`; add
    `ASTEROID_ANGLE_SPREAD` and bias `decideAsteroidSpawn`'s angle roll
    toward near-horizontal instead of isotropic. Tests: sampled angles stay
    within the spread band across many RNG draws; speed stays within the
    new, lower range. Add a pooled trail mesh in `asteroid-mesh.ts`,
    oriented along `asteroid.velocity`, verified by looking. Serves: the
    brief's asteroid-motion requirement.
17. **Responsive camera frustum.** Extract the ortho half-height
    calculation in `scene.ts` to a pure function (Decision 13); add a
    matching test asserting the visible half-width never falls below
    `LANE_HALF_WIDTH` at the 390x844 aspect ratio. Add an
    `orientationchange` listener alongside the existing `resize` one, and
    cap `renderer.setPixelRatio` at 2 for high-DPI phones. Verified by
    looking at both marking viewports plus a rotated-phone aspect. Serves:
    the brief's responsiveness requirement, general interface rules
    (usability across viewports).
18. **Visual cohesion pass.** With round planets, rocket, starfield and
    asteroid trails all in place at once, review lighting and material
    consistency (one light rig, not per-mesh guesses), re-check contrast
    (4.5:1 text, 3:1 boundaries) against the darker starfield background,
    and confirm nothing is signalled by colour alone now that planets carry
    per-id hue. Look at both marking viewports. No new test --- this is the
    "review the design principles" pass made explicit as its own step
    because it spans every file touched in Steps 13-17 at once. Serves:
    general interface rules (visual minimalism, colour).
19. **Playtesting tuning pass for the new mechanics.** Play the game with
    gravity and the retuned asteroids live; adjust `GRAVITY_STRENGTH`,
    `GRAVITY_MAX_ACCEL`, and the Step 16 asteroid constants from how the
    run actually feels; log the before/after and why in `PROCESS.md`, same
    format as Step 9's entry. Serves: J1 (still reachable inside five
    minutes with gravity added), J2 (further process-evidence).
20. **Ship, deploy, evidence.** Update `PROCESS.md` and
    `reflections/crit-5.md` with this phase's moments; `pnpm check` green;
    CI green; deployed; confirm the live URL at both marking viewports.
    Serves: C1, C6.

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

## Risks --- modification phase

- Gravity fighting the "gently" landing threshold is the single highest-risk
  item here: too weak and it's invisible, too strong and every approach
  becomes an unavoidable crash before the player can react. Mitigated by
  capping/softening the force (Decision 11) and budgeting a dedicated
  playtesting step (Step 19) rather than guessing the constants once.
- The responsive-frustum fix (Step 17) changes what's on screen at the
  390x844 viewport for every existing entity, not just new ones --- it is
  reviewed against Steps 1-10's already-shipped look, not only against the
  new content, so it needs a full re-look at both viewports, not a diff.
- Starfield + asteroid trails add draw calls and particle counts on top of
  an already-3D scene; the devicePixelRatio cap and fixed-size recycled
  buffers (Step 15) are the mitigation, checked by the same soak-test look
  as the existing pooling risk above, now also watching frame time.
- Per-id planet hue (Decision 9) risks colliding with the HUD's or a
  planet's own colonized-tint colour semantics by coincidence at some id;
  mitigated by deriving hue from a fixed rotation step rather than full
  random range, and caught in Step 18's contrast/colour review.
- The rocket mesh's added geometry (nose/body/fins as separate primitives
  in a `Group`) risks a heavier draw per ship instance, though there is
  only ever one ship; negligible, but named so Step 14's "verified by
  looking" also glances at frame time, not appearance alone.
