---
name: plan
description: Plan before building when a task is large, ambiguous, spans many files, or is high risk (data, security, public API). Skip for small or clear tasks.
---

Produce the plan the task needs and nothing more. Keep it in chat unless the user asks for a file.

1. State the outcome and the acceptance criteria as observable behavior.
2. Separate what is known, with its evidence level, from what is unknown. Investigate the unknowns that can be discovered.
3. Read the code the change touches and name the files and flows involved.
4. Choose the approach with the ladder: reuse before new code, the smallest change that satisfies the criteria.
5. Split into steps only where order matters or a step can be verified on its own. Each step says how it will be verified.
6. Ask the user only about decisions that are theirs: scope, trade-offs, high-risk actions.

Once the plan is agreed, execute it with judgment. A plan is a hypothesis; when the code disproves part of it, adjust and say what changed.
