# Crit 5 --- reflection

## What was the breakthrough that moved the work forward?

Writing the `/execute_plan` skill and letting it dispatch a fresh subagent for
every step of the build.

I decided to further up my game with "harness engineering", where i designed a skill
[comp4020-crit5-drvcarroll/.claude/skills/execute_plan] that explicitly splits the
detailed build file into atomic steps, each run by a subagent with no memory of the previous
one. This fixes a lot of structural issues like context rot and breakdown in long-horizon 
reasoning over long interactive sessions, instead of by prompting harder. Every subagent
reconstructs context from the repo, the plan and `CLAUDE.md`, all of which are
true right now, rather than from a transcript that is mostly history.

The underlying principle was atomic chunking, in which a smaller scope with a fresher
context is simply a better problem to hand an LLM. Because each step ends in its
own commit, I get a reviewable history instead of one diff I have to trust.

## What did this work change about who I want to be as a software developer?

It mostly changed where I think the engineering actually takes place. I spent 
most of this week building a harness that i can easily apply to future crits;
the plan schema, the review loop, the invariants, the scripted pilots, and 
the determinism hash. I see it as a different kind of systems engineering,
in which the system being designed is the one that produces the software, 
and its components are agents, subagents, context boundaries and checks.

I also want to try ensuring that i dont want simple specific fixes to land
in the harness, but try modify the harness to target the structural roots of 
issues that i keep encountering, as an amended plan or a new invariant fixes 
the whole remaining run, including the parts I haven't thought of yet. I feel that 
designing constraints carefully enough makes correctness the default behaviour,
and i can start spending my own attention on the twenty minutes of judgement at the end
that no harness can do for me.