# Betterpowers

Engineering rules for Claude Code that define outcomes instead of procedures.

- Rigor scales with risk; no mandatory workflow or skill.
- Nothing is called fixed, working, or passing without being checked; gaps that could change the conclusion are named.
- Done means the reported failure is reproduced and fixed at its root for every caller, with regression tests, migrations, and docs or release notes when documented behavior changes.
- Questions come only after reading the project, and only about what would change what gets built: one at a time, with every filled-in default stated.
- Feedback is checked against the code before it is acted on, with no performative agreement.
- Changes stay inside the request: behavior it does not change, including overridable library hooks, is preserved; adjacent improvements are reported, not made.
- Minimal mechanism: reuse, standard library, and platform features before new code; never by leaving the change incomplete.
- Lookups, edits, and checks are batched into as few tool calls as possible, since every call re-reads the conversation.
- Data is validated once at the entry boundary and trusted inside.
- Tests assert observable behavior, never implementation steps.
- Comments state domain rules only, plus `limit:` markers for known ceilings.
- Clean code without ceremony: domain names, no surprising side effects.
- Terse, plain replies in the user's language, without the rules' own jargon or defensive caveats.

## Install

```bash
claude plugin marketplace add kyokusakin/Betterpowers
claude plugin install betterpowers@betterpowers
```

To install from a local clone, pass its path to `marketplace add` instead.

Disable plugins that inject overlapping rules (superpowers, caveman, ponytail) to avoid conflicting instructions.

Requires Node.js on PATH.

## Settings

```text
/betterpowers                       show the current state
/betterpowers on | off
/betterpowers talk lite|full|ultra|wenyan
/betterpowers code lite|full|ultra
```

Defaults: `talk lite`, `code full`. Settings persist across sessions in `betterpowers.json` in the plugin data directory.

Levels change only how terse the replies are and how hard new mechanism is minimized. Done, evidence, verification, data trust, and safety rules apply at every level.

## Skills

- `/betterpowers:brainstorming` to settle with you what to build, and why, before planning something new.
- `/betterpowers:plan` for large, ambiguous, or high-risk work.
- `/betterpowers:debug` for root-cause analysis.
- `/betterpowers:review` for reviewing a diff, branch, or pull request.
- `/betterpowers:subagents` to build a multi-task plan by handing each task to a fresh subagent and accepting it only after review.
- `/betterpowers:unattended` for headless, scheduled, or overnight runs with no one to answer. It decides conservatively and acts only on what you approved in advance. It holds everything else instead of asking, and it ends with a report of the grants it used, its assumptions, and the steps it held.

`subagents` runs only when you invoke it. Unattended mode lasts until its final report. You can also start it by asking in plain words ("run this unattended, I'm heading out"). Claude then points you to `/betterpowers:unattended` before asking for approvals. The skill tells Claude never to enter it on its own.

When you start unattended mode in a conversation, Claude first checks the accounts and services the run will use, such as sign-ins, tokens, and OAuth or app permissions. It tells you what to sign in to or grant before you leave. It then asks you once to approve the actions that need it, such as pushes, deletions, and installs, and lists the tool permissions that would stop at a prompt. Ordinary edits and test runs need no approval. What you approve is all it may do; anything else is held. A headless run has no one to ask, so put the approvals in the prompt:

```bash
claude -p "/betterpowers:unattended fix the failing tests in tests/billing. Approved: commit to a new branch fix/billing."
```

## Tests

```bash
node --test hooks/betterpowers.test.js
node evals/run.js [tests|data-trust|bugfix|reuse|review|talk|resume|off ...]
```

The hook tests are fast and free. The evals run real Claude Code sessions against `evals/fixtures/verification`, with and without the plugin, and grade the results with deterministic checks plus a judge model. They cost API usage and take tens of minutes. Set `CLAUDE_BIN`, `EVAL_MODEL`, or `JUDGE_MODEL` to override the defaults (`claude`, `sonnet`, `sonnet`). Results go to `evals/results/`.

The baseline arm runs with `--setting-sources project`, which drops user plugins but still loads the user's global CLAUDE.md.

Eval sessions run in temporary copies of the fixture with file edits accepted and the Bash and PowerShell tools allowed without prompts, so the model can run checks on its own work.

## Layout

```text
rules/core.md        always-on rules
rules/talk/*.md      reply terseness levels
rules/code/*.md      code minimization levels
references/          worked examples, read on demand
hooks/               injects rules at session and subagent start, handles /betterpowers
skills/              brainstorming, plan, debug, review, subagents, unattended, settings
```
