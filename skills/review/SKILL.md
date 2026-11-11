---
name: review
description: Review a diff, branch, or pull request for correctness bugs and Betterpowers rule violations.
argument-hint: "[file, branch, or PR; default: uncommitted changes, else current branch vs its base]"
---

Read the target diff and the code around it. Report findings most severe first:

1. Correctness: wrong behavior, broken callers, data loss, security holes, races.
2. Data trust: validation repeated past the entry boundary, or missing at the entry.
3. Tests: assertions on implementation (internal mocks, call order) instead of behavior; behavior changed without evidence.
4. Code amount: code that need not exist, reimplemented helpers, abstractions with one implementation.
5. Clean code: names that need comments, surprising side effects, flag arguments, null passed or returned.
6. Comments: anything other than a domain rule or a `limit:` marker.

Each finding gives `file:line`, the defect, and a concrete failure scenario or fix. Check every finding against the code before reporting it and drop the ones that do not hold. No praise, no restating the diff. Report "no findings" when there are none.
