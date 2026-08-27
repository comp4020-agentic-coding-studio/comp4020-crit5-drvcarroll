# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so look at the deployed head when you add pages.

## The checks

`pnpm check` runs them (`pnpm check:evidence` is the extra gate before you
ship); CI runs the same plus links, secrets and the deploy. Read the failure.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## This file is yours

A starting point, not a rulebook. As you learn what your prototype needs --- a
convention the work has to hold to, a sensor that keeps catching you out (a
linter, say), a fact about the stack that is easy to get wrong --- write it down
here and wire it into `check`. Growing this file is the work.

## Work against the spec and the marking criteria, every stage

The published spec is the contract and the marking bands are how it is scored.
Neither lives in this repo, so they are easy to drift from, which is exactly why
they get consulted rather than remembered. Pull them from the course API
(`/api/crits/<slug>.json` or `/api/assessments/<slug>.json`, fields `spec` and
`body`) at the start of a session and re-read them at each of these points:

- **Before planning.** Restate which spec lines the proposed work serves. Work
  that serves no spec line is scope creep, however good the idea is.
- **Before building.** Name the marking band being aimed at, and what separates
  it from the band below. "Better" is not a target; the band's own words are.
- **After building.** Walk the spec line by line against what now exists, and
  say which lines are met, which are partial, and which are untouched.
- **Before shipping.** Re-read both. The spec can be updated during the week,
  and a contract last read on Monday is not the one being marked against.

Two standing rules fall out of this:

- **Weight the effort by this deliverable's own weights.** The criteria are
  never equal, and the split is published with the deliverable. Read it, then
  say out loud in the plan where the hours are going and why that matches.
- **Sort every spec line into checkable or judged.** Checkable lines become
  tests in `spec/`. Judged lines get named in the plan so they stay visible
  without pretending a test holds them.

# Your iterative building process

Work proceeds from `BUILD_PLAN.md`, a committed list of numbered steps. Keeping
the plan in the repo makes it process evidence and lets it survive a session
ending. It is written and agreed before any code, and amended in place as the
work teaches you something, never rewritten from scratch.

## What `BUILD_PLAN.md` contains

Seven sections, in this order. The first two are what make the rest readable by
someone arriving cold, including you in a later session.

1. **What this is.** A few sentences describing the whole artefact: what it is,
   what a person does with it, and what it is made of. Written for a reader who
   has seen nothing else, and specific enough that a wrong idea of the project
   could not survive it.
2. **The entities, and how they interact.** Name every entity the artefact has:
   the things a person acts on, the things that hold state, the things that
   produce output. For each, say what it owns. Then say what passes between
   them, as a short flow per interaction rather than a paragraph, and name the
   couplings that are deliberately absent, since an entity that must never
   depend on another is a design decision and not an oversight. These names are
   the project's vocabulary: use them unchanged in the code, the tests and the
   commit messages.
3. **The published spec, sorted.** Every spec line given an id, split into the
   mechanically checkable and the ones only a person can judge. Ids are what
   the steps cite.
4. **Decisions taken.** The numbered interpretations the plan rests on, each
   with the reasoning that chose it. A reader must be able to reject one
   decision without rejecting the plan, which is only possible if each is
   stated separately and justified on its own terms.
5. **Architecture.** The file tree with one line per module, the split between
   pure logic and code with side effects, what is built at runtime versus what
   ships in the source, and any mechanism that cuts across steps.
6. **Steps.** Numbered, each naming what it builds, what its tests assert, and
   which spec ids it serves. A step that serves no spec id is scope creep.
   Order them so that the artefact is coherent at the end of each one.
7. **Risks.** What could fail, which step will find out, and the fallback if it
   does.

Every step runs the loop below, and the loop is never skipped. Steps 3 to 6 are
review passes: each either finds nothing and falls through to the next, or
writes what it found to the ephemeral scaffold file and returns to step 1. A
step is not finished when the code works. It is finished when it has been
scaffolded, implemented, optimised, reviewed against the code, the spec and the
principles, checked, looked at, and committed.

1. **Design scaffold.** Plan how the step will be implemented in code, from the
   high-level architecture down to the exact functions, types and files it
   touches. If an earlier pass through this loop left review notes, read them
   first and fold them in, so the scaffold is a revision rather than a restart.
   Write the scaffold to an ephemeral working file, not a committed one.
2. **Implement.** Build the scaffold, and nothing beyond it. Get `pnpm check`
   green before going further: a review pass over code that does not compile is
   wasted.
3. **Optimise.** Assess what was just written for optimisations and
   efficiencies. Work recomputed per frame that could be derived once,
   duplication that should have been a modification rather than an addition, an
   algorithm doing more than the problem needs. Findings go to the ephemeral
   file; return to step 1.
4. **Review the code.** Clarity, maintainability, readability. Is it readable
   end to end by someone who did not write it? Does it work for the reasons the
   tests claim, or only in the cases the tests happen to cover? Comments are one
   line, concise and descriptive, never elaborate. Findings go to the ephemeral
   file; return to step 1.
5. **Review alignment.** Re-read the published spec, the brief, and the agreed
   plan. Judge critically whether what was just built still serves all three,
   and name any scope drift in either direction: work that answers no spec line,
   and spec lines this step claimed to move but did not. Findings go to the
   ephemeral file; return to step 1.
6. **Review the design principles.** Walk the **Design principles** section
   below against what now exists, including the general interface rules at
   the end of it. Findings go to the ephemeral file; return to step 1.
7. **Check, look, and commit.** `pnpm check` green; never commit a red state.
   Open the rendered page at both marking viewports, 1920x1080 and 390x844, and
   confirm what is on screen matches what the step claimed to build. A green
   suite is not a substitute for looking. Then one commit, naming what changed
   and why.
8. **Re-align the plan.** If the review passes changed the picture, amend the
   remaining steps in `BUILD_PLAN.md` before starting the next one. Amending the
   plan is the expected outcome of a review, not a sign the plan was wrong.

**The loop needs no human input.** It is a self-check performed and acted on
alone, in the same run, precisely so that drift is caught while it is one step
old and cheap. Nothing in it is a question for the user, a place to hand back,
or a reason to pause: it is the mechanism that makes running to the end safe,
not an interruption to it.

## Test at every stage

Every step ships with unit tests, and the target is full coverage of what that
step added. Design the code for testability as it is written rather than
retrofitting seams later: pure functions over hidden state, dependencies passed
in, side effects at the edges. A step whose logic cannot be exercised without
the browser has been designed wrong, not tested wrong.

## Run the plan to the end without stopping

Once the plan is agreed, work it start to finish in one go. Do not stop between
steps to summarise, ask whether to continue, or announce what is next. The loop
above is run silently, and the commit message is the report: a legible commit
trail is the process evidence, and a running commentary is not.

- **Do not hand back at a step boundary.** The only reasons to stop are the plan
  being complete, a genuine blocker that no assumption can get past, or
  something outside this machine that only the user can do. Name that one thing,
  keep working on everything it does not block, and never stop on it twice.
- **Re-aligning is a silent edit to `BUILD_PLAN.md`**, not a message. Reordering
  or cutting steps needs no permission; the plan already says the cut order.
- **Report once, at the end**: what shipped, what was cut and why, and anything
  left for the user.

The loop and this rule are not in tension. The loop is what makes running to
completion safe: every step is reviewed before the next one starts, so a long
unattended run cannot drift far, and the review costs a few minutes against a
whole pass rebuilt later. Skipping it to move faster is the one way to make the
run worth less than not having made it.

# Design principles

## Never remove what you were not asked to remove

**Do not delete or remove any element, label, title, control, behaviour, line of
code, or file unless the prompt asked for that removal.** A request to change
one thing is not permission to prune its neighbours, and "this reads cleaner
without it" is not a prompt.

This outranks every other principle here, because the two failure modes are not
symmetric: something wrongly kept is visible and can be cut next turn, while
something wrongly deleted is invisible, and the user has to notice an absence
and then work out what used to be there. Entity titles were removed once on
density reasoning and the interface stopped being legible.

If a change genuinely seems to require deleting something, make the change
without the deletion, then say what you would cut and why, and let the user
decide.

## Compress, then condense

Aim for the most information in the least interface. A minimal UI is not one
with less in it, it is one where nothing is spent twice. When adding material,
prefer in order:

1. **Cut it.** Anything not serving the one idea is removed, not shrunk. This
   ranks options for material being *added*; it is never licence to delete what
   is already on screen.
2. **Fold it into something already on screen.** A value belongs on the object
   it describes. Prefer direct manipulation of the thing over a separate control
   acting on it at a distance.
3. **Reveal it on demand.** Detail hides behind the object it belongs to and
   appears when asked for, so depth costs nothing until it is wanted.
4. **Only then, add a control.** A new persistent element is the last resort and
   needs a justification the other three could not meet.

Idioms that buy density cheaply and are expected here: direct manipulation over
form controls, hover and focus for detail rather than permanent labels, state
carried in the visual (colour, weight, motion) rather than restated in prose,
and one canvas reconfigured rather than stacked panels.

This is a density target, not a sparseness target. Empty fails as hard as
cluttered: whitespace carrying no information is wasted, and so is a paragraph
restating what the graphic already shows.

What the finished display owes the visitor:

- **At rest, show the minimum that carries the current state.** An object shows
  its identity and one status glyph; content, detail, history and full text live
  in the inspector opened from it.
- **Surface grows only as the visitor earns it.** Regions not yet reached stay
  closed rather than pre-populated, and a closed thing carries a small badge of
  what is inside so folding it away costs no information.
- **Two lines of prose on the canvas, ever**: one suggestion of what to do next,
  one consequence of what just happened. Anything more belongs beside the thing
  it explains, where it costs nothing until asked for.
- **Disclosure is not a pop-up.** A verb belongs to the object it acts on, but
  that is about position, not about being locked behind a panel. Where a thing
  has two states and few verbs, its verbs stand beside it while it is open. Keep
  a panel only where there is something to work in, and count every
  summon-and-dismiss the visitor performs to reach a button that could have been
  on screen already.
- **Feedback appears at the object it happened to.** Information placed far from
  what it describes reads as unrelated. A page-level live region is the
  accessible mirror, not the primary channel.
- **Prefer a difference that can be seen over one that must be read.** Where the
  argument turns on same or different, carry it in a preattentive channel like
  colour or position and let text be the supporting detail. Never colour alone.

## Manipulation, not narration

The visitor must change the system, not their position in a story about it. A
control that only advances a fixed sequence is narration with a button on it,
and no amount of polish on that button makes the page interactive.

- **Every parameter the artefact depends on is one the visitor can set**, and
  the outcome has to visibly move when they set it. A constant the design leans
  on is a knob that has not been built yet.
- **Prefer knobs that can produce a bad outcome.** A model that cannot be broken
  teaches nothing about why it holds up. Failure states reachable by the
  visitor's own hand are the point, not an edge case to defend against.
- **Name the pairs before building.** For each control, say which parameter it
  changes and which readout moves in response. A control with no readout is a
  toy; a readout with no control is a chart.
- **Count the verbs before shipping.** If the honest answer is "two buttons",
  the artefact is a diagram, whatever else is true of it.
- **Sequencing controls** (play, step, speed, next, back) are a transport for a
  model, never the interaction itself. They earn their place once there is a
  model to pace, and they are not evidence that the page is interactive.

Where the artefact reveals itself in stages:

- **A stage unlocks on a real change to the model, never on a button press.**
  The unlock condition is a predicate over system state. A stage reachable
  without the visitor changing anything is narration.
- **Stages record, they never gate.** Any action legal in the current state
  stays available at all times, whatever stage introduced it. A fixed enforced
  order is a next button in a costume, and willingness to be poked out of order
  is the difference between an explorable model and a tutorial.
- **Later stages reuse earlier verbs** rather than introducing new controls. The
  last stage should add no surface at all.
- **Scaffolding fades.** When the stages are exhausted the instruction retires
  and everything stays available.

## Every action can be taken back

A visitor who cannot back out stops poking the model, and a model nobody pokes
teaches nothing. Reversal is a correctness requirement, not a courtesy, and it
is what makes "prefer knobs that can produce a bad outcome" safe to mean.

Where the subject has its own vocabulary for undoing, **use that vocabulary
rather than a generic undo button**. The reversal is then part of the artefact
rather than an escape hatch, and it is often the thing the visitor most wanted
to understand. A verb ships with its reversal or it is not finished.

**Always have an undo, reachable by the same gesture that made the change.**
In this project: tapping an already-armed drum pad on its own beat toggles
that step back off, rather than the 400ms hold-to-clear being the only way
back.

This sits in tension with compress-then-condense, deliberately. That principle
removes surface; this one demands the visitor have things to do. They resolve
the same way every time: a knob belongs on the object it changes, so growing
what the visitor can do should grow the page's density rather than its area.

## The general interface rules

The principles above are this project's own and will not catch a page that
breaks the general ones. Against what is on screen at both marking viewports:

- **UI design.** Alignment, proximity, and a visual hierarchy matching the order
  things should be read in. Consistent spacing from a scale rather than
  per-element guesses. One idea per region. Nothing decorative that carries no
  information.
- **Interaction design.** Is every affordance signified before it is used rather
  than discovered by failing? Does every action produce visible feedback at the
  object it happened to? Is state legible without being narrated? Can the
  visitor always tell where they are and what they can do next?
- **Usability.** Steps to reach the first meaningful action; targets at or above
  44px; whether anything is reachable by pointer alone; whether a keyboard
  visitor gets the same path; whether an error state explains itself rather than
  merely refusing.
- **Colour.** Contrast at or above 4.5:1 for text and 3:1 for boundaries that
  carry meaning. One accent, used for one idea, not three. Hue reserved for
  identity rather than spent on decoration. Nothing signalled by colour alone.
- **Visual Minimalism.** The user interface should be visually minimal, with a
  sleek, trimmed down and modern style prioritised.

# Code style

The architecture and structure of a solution is planned and confirmed with the
user before execution. All code written is modular, efficient, extensible and
readable.

Each language follows its official style guide, or Google's where no official
one exists.

Comments are descriptive but concise, two lines of text at most. Lines are at
most 80 characters; an expression may span multiple lines, since the limit is
purely for readability.

# Overall direction

The artefact is an interactive system a person uses, not a document they read.
Do not overengineer it. At every stage, ask whether the model has grown more
complicated than the idea requires, and whether someone meeting it for the first
time can build the mental model it depends on.
