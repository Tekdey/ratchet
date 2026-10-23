---
name: run-task
description: Run one task I<N>-T<NN> end to end (worktree, tests first, implementation, definition of done, pull request, review by tier, refutation, fix loop, merge, state update). Prefer the workflow .claude/workflows/run-task.js, which encodes these steps with parallel reviewers; use this skill when running in a single session.
---

# Run a task: from identifier to merged pull request

Input: a task identifier such as `I1-T03`. Nothing below is skipped because a change "looks simple"; simple changes get the `low` tier instead.

## 0. Preconditions

- `spec/state.md` says the task's iteration is current and its dependencies are merged.
- `git fetch origin` done; the main branch is clean.
- The task block, its requirements and ADRs, `spec/decisions-log.md` and `spec/escalations.md` have been read.

## 1. Implement (agent `implementer`)

1. `git worktree add .worktrees/<branch> -b <branch> origin/<main branch>`.
2. Verify external facts (skill `verify-facts`).
3. Tests first for specified behavior; implementation; documentation.
4. The full definition of done from `ratchet.config.json`, plus the task's acceptance commands, inside the worktree. All green or no pull request.
5. Classify the tier from the files changed and `tiers` in `ratchet.config.json`. Changes under `.claude/`, `spec/adr/` or to `ratchet.config.json` are always critical.
6. Commit, push, open the pull request with the template of `AGENTS.md`.

## 2. Review (agent `reviewer`, never the implementer)

- `low`: one reviewer with the whole grid.
- `standard` and `critical`: three reviewers with distinct lenses (specification compliance; security and secrets; tests and definition of done).

## 3. Refute (agent `skeptic`)

- `low`: skipped.
- `standard`: one skeptic per medium or high finding.
- `critical`: three skeptics per finding; a finding survives when fewer than half refute it.

## 4. Fix loop

The implementer fixes surviving findings in the same worktree, reruns the definition of done and pushes; a reviewer rechecks only the open findings. At most `review.maxFixRounds` rounds (three by default). Beyond that, split the task or escalate; never merge with open medium or high findings.

## 5. Gate and merge

Post one consolidated review on the pull request ending with `Verdict: approve` or `Verdict: request-changes`. Merge (`gh pr merge <n> --squash --delete-branch`) only when the verdict is approve and the definition of done is green; remote CI too when `remoteCiRequired` is true.

## 6. Close the task

Remove the worktree, update `spec/state.md` (task done, pull request, next task), and record decisions and escalations in the iteration report.
