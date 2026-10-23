# <Project name>: working contract for coding agents

This file is the working contract of every agent on this repository. `CLAUDE.md` imports it. The specification under `spec/` is the source of truth; this file says how to work with it. Replace every `<placeholder>`.

## 1. Before doing anything

Read, in this order:

1. `spec/README.md`: what the product is.
2. `spec/adr/README.md`, then every accepted ADR. They are short and binding.
3. `spec/requirements.md`: the requirements, with their identifiers.
4. `spec/state.md`: where the run is. Then the current iteration file in `spec/iterations/`, `spec/decisions-log.md` and `spec/escalations.md`.

`spec/archive/` holds planning documents imported from another method. They are history, not specification: do not read them during ordinary tasks, and never follow them where they differ from `spec/`.

A fresh session resumes from these files, `git log` and open pull requests, never from the memory of a previous conversation. If `spec/state.md` disagrees with git or with open pull requests, git wins: update the state file.

## 2. Rules

- **The specification is binding.** Accepted ADRs are never edited (the write guard refuses it). When a fact contradicts an ADR, write a proposed ADR (skill `propose-adr`), apply the simplest option compatible with the accepted ADRs meanwhile, log the decision, and continue. Never work around the specification silently.
- **Decide and log.** When the specification is silent or wrong, choose the simplest option compatible with the accepted ADRs and append it to `spec/decisions-log.md` (skill `log-decision`). Do not ask the human.
- **Reserved decisions.** These are never taken by an agent: <list, defaults in ratchet.config.json: purchases and paid services; publication of a major version; deletion of user data or audit history; change of license, name, prices or telemetry policy; public announcements>. Write them in `spec/escalations.md` (skill `escalate`) and move to the next unblocked task. Never wait.
- **Roles are separate.** The agent that writes a change never reviews it.
- **Secrets** are never read, written, logged, or sent to an agent. They come from the environment. `.env.example` is committed; `.env` never.
- **Guardrails are not negotiable.** When a hook blocks an action, do not look for another way to do the same thing. Report the block in the task result.
- <project-specific rules: layering, vocabulary, conventions>

## 3. Definition of done

All of these pass at the repository root before a pull request is opened. Run them; do not assume. The list is also in `ratchet.config.json`.

```
node .claude/scripts/check-spec.mjs
<command 1>
<command 2>
```

Plus: tests for error paths, not only the nominal case; no disabled or skipped test; documentation of the changed module updated.

## 4. Task cycle

Unit of work: a task `I<N>-T<NN>` from the current iteration file. One task, one branch `i<N>-t<NN>-<slug>`, one pull request. Prefer the workflow `.claude/workflows/run-task.js`; the skill `run-task` describes the same steps for a single session.

1. Read the task, the requirements and ADRs it cites.
2. Verify the external facts you depend on (skill `verify-facts`).
3. Write the tests first when the behavior is specified.
4. Implement the simplest thing compatible with the ADRs.
5. Run the definition of done and the task's acceptance commands.
6. Open the pull request with the template below.
7. A distinct reviewer reviews it; findings are verified by skeptics; the implementer fixes. Merge only when the review approves and the definition of done passes.
8. Update `spec/state.md`.

Review depth follows the risk tier of the change (`ratchet.config.json`, `tiers`). Under time pressure, lower tiers by configuration and log it; never skip the loop.

## 5. Pull request template

```
## What
One sentence.

## Why
Task, requirements and ADRs covered.

## How
Notable points; decisions logged (links to the decision log).

## Verification
Summarized real output of the definition of done and the acceptance commands.

## Risks
What could break; how to roll back.
```

## 6. Review grid

1. Does what the task asks, nothing more.
2. Accepted ADRs respected.
3. Tests cover error paths; nothing disabled.
4. No sensitive data can leak (responses, logs, errors, events, UI).
5. User-facing text understandable by a non-developer.
6. Documentation lets a third party use the change.
7. Reversible: rollback described, risky changes behind a flag.

## 7. Commits

<convention, for example Conventional Commits>. Squash-merge, linear history. Never force-push, never skip hooks, never push to the main branch directly, never publish from a workstation.
