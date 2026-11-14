---
name: subagents
description: Build a multi-task plan by handing each task to a fresh subagent and accepting it only after review.
argument-hint: "[plan file or task list]"
disable-model-invocation: true
---

You coordinate, subagents implement, and nothing is accepted without your review. Subagents receive the Betterpowers rules at start, so a brief carries only the task. Keep your own context for decisions: read code only as far as a brief or a review needs.

1. Start from an agreed plan, from `/betterpowers:plan` or the user. Each task needs an outcome, acceptance criteria, the files it touches, and its verification. Split or merge tasks until each is one coherent change a subagent can verify on its own; do a task of a few lines yourself.
2. Order tasks by dependency. Run tasks in parallel only when they touch disjoint files; otherwise run them one at a time.
3. Brief each implementer as one that knows nothing, because it does not: the task, its acceptance criteria, the files, flows, signatures, and line numbers already found, the test command, the decisions already made, and what it must not touch. Paste these into the brief; never send it to reread the plan or rediscover what you know.
4. Pick its model by turns, not price. A weaker model often takes two or three times the turns on multi-step work and costs more overall. Use the cheapest model only when the brief holds the complete change or the change is a mechanical fix to one file. Use a mid-tier model otherwise, and the session's model for design or debugging.
5. Answer its questions fully before it goes on. Require a report of the files changed, each verification command with its result, the assumptions made, and anything left undone.
6. Review before accepting. Read the diff from the commit recorded before the dispatch, rerun the verification, and check the result against the acceptance criteria and the Done rules. For a large or risky task, also have a fresh subagent review the diff with `/betterpowers:review`. Send each defect back to the same implementer with the failing evidence, and recheck after its fix.
7. Record each task as accepted with its evidence, changed, or blocked. When a result disproves the plan, revise the remaining tasks before the next dispatch.
8. After the last task, run the affected test suites once and review the whole diff for problems between tasks: broken callers, duplicated code, leftovers.

Report as Output requires, with each task's evidence and every task not accepted.
