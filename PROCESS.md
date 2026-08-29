# Process overview

## What I built

**Colony Run** --- a top-down endless scroller in TypeScript and Three.js. The
world falls past a fixed camera; you fly a rocket with real inertia, hunting
planets to refill three tanks. Air is the only death clock and drains no matter
what you do, so every planet is a decision: burn fuel to reach it, or coast and
run the tank down. There is no on-screen prose anywhere --- the pulsing landing
ring, the keycaps that depress under your fingers, and the three icon-labelled
meters are the entire tutorial.

The interesting part of this week wasn't the game. It was that I stopped
prompting for features and started really polishing a harness that executes a plan.

## The moments that mattered

**1. The plan stopped being a design doc and became a build script.**
The obvious move was to write an architecture doc and then prompt feature by
feature. Instead I wrote [`BUILD_PLAN.md`](BUILD_PLAN.md) so that every step
carries a fixed schema. I knew it was working when the first
execution pass produced commits whose messages I could read back against the
plan line by line without opening the diffs.
[`744abf5`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-drvcarroll/commit/744abf5),
rewritten for the scrolling-world architecture at
[`67b931d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-drvcarroll/commit/67b931d).

**2. `/execute_plan` --- one fresh subagent per step, never a long conversation.**
I wrote a skill, committed here at
[`skills/execute_plan/SKILL.md`](skills/execute_plan/SKILL.md),
that decomposes a plan into atomic steps and then dispatches a *new* subagent
for each one. The subagent never inherits the previous step's transcript; it
reconstructs context from the repo, the plan, `CLAUDE.md`, and its step brief,
and it owns the step all the way through commit. Each step runs a mandatory
loop --- scaffold, implement, optimise, review as code, review against spec,
review against design principles, `pnpm check`, look at it at 1920x1080 and
390x844, commit --- and any finding sends it back to scaffold rather than
forward. The obvious alternative, one long session, is exactly what produces
drift: context fills with dead ends and the model starts optimising for the
conversation instead of the repo. Sixteen steps, sixteen clean commits:
[`1321fcd...1ea1039`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-drvcarroll/compare/1321fcd...1ea1039).

**3. Corrections landed in the plan, not in a retry.**
The step-6 review found that relative-speed landing bites at level 0 --- the
scroll speed already exceeded the landing threshold, so a pilot who merely
pointed at a planet and burned always arrived too fast. The retry-shaped fix
would have been to nudge a constant and move on. Instead the finding was
written back into `BUILD_PLAN.md` as an amendment
([`9c3b83b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-drvcarroll/commit/9c3b83b),
and the same pattern at
[`b001575`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-drvcarroll/commit/b001575)
and
[`b295499`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-drvcarroll/commit/b295499)),
so every *later* subagent read the corrected physics as a precondition. Backing
it up is the Tier 2 simulation harness at
[`b25d93d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-drvcarroll/commit/b25d93d):
five scripted pilots, eight invariants asserted on every one of ~30,000 ticks,
and a committed determinism hash so a tuning change shows up as a diff instead
of a vibe.

**4. Twenty minutes of hand-driven polish on top was enough.**
After the plan executed, I sat with Opus and played the thing. Seven changes
came out of that session: planets that mysteriously stopped spawning, colonists
replaced by air/fuel/ammo, an escalating asteroid curve, the landing ring, the
starfield, the keycap cluster, resource icons, and two corrections I made
mid-flight, that space has no friction and that there is no brake, only turning
around and burning. The real benefit here is that i needed a short amount of 
time interacting with the finished code at the end, because the plan
had left the codebase in a state where a live change was cheap.
[`282cd5c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-drvcarroll/commit/282cd5c).
