---
name: resume
description: Resume work in a fresh session from the repository state only (state file, git, open pull requests, escalations), then pick and run the next task. Use at the start of every session and whenever the human says "continue" or "go".
---

# Resume from the repository

1. Read `AGENTS.md`, then `spec/state.md`. If the state file does not exist, create it from the template below after reading `spec/README.md`, the iteration files and `git log`.
2. Run `git fetch origin`, `git status`, `git log --oneline -20`, `gh pr list --state open` and `git worktree list`. Reconcile with the state file: a pull request open but not listed, a worktree left behind, a task listed in progress with no branch. Git wins.
3. Read `spec/escalations.md`. For each entry whose `Decision:` line the human has filled: change its status to `[decided]`, apply the decision, and log the application (skill `log-decision`). List what is still open and what it blocks.
4. Pick the next task: the first task of the current iteration whose dependencies are merged and which no open escalation blocks. Run the workflow `.claude/workflows/run-task.js` with `{ task: "<id>", merge: true }` (or the skill `run-task`). Independent tasks may run in parallel, one worktree each; keep the number of concurrent tasks small.
5. When every task of the iteration is merged or explicitly deferred, run the skill `close-iteration`.
6. Reply in five lines at most: where the run is, what was just done, what is next, what is blocked and where it is written.

Template of `spec/state.md`:

```
# State

Updated: YYYY-MM-DD by <agent or session>.

## Current iteration
I<N>: <goal>. Dependencies satisfied: yes | no.

## Done (this iteration)
- I<N>-T<NN> · PR #n · one line

## In progress
- I<N>-T<NN> · branch · PR #n · implementation | review | fixes

## Blocked
- I<N>-T<NN> · escalation "<title>" · what is missing

## Next task
I<N>-T<NN>
```
