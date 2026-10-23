# Adopting Ratchet

## Prerequisites

- Claude Code (the template uses its hooks, subagents, skills and the Workflow tool).
- Node.js 20 or later (the hooks are plain Node scripts with no dependencies).
- git. The GitHub CLI (`gh`) if your tasks end in pull requests.
- A definition of done: the commands that must pass before any change merges (lint, type check, tests, build, secret scan). Ratchet enforces it; it does not provide it.

## 1. Copy the template

```bash
cp -r template/. /path/to/your-project/
cd /path/to/your-project
node .claude/hooks/selftest.mjs
```

The selftest runs every guard against known commands and paths and must print `all cases pass`. If your project already has a `.claude/settings.json`, merge the `hooks` and `permissions.deny` sections by hand instead of overwriting the file.

Add `.ratchet/` to your `.gitignore`: it holds the guard log and the owner's unlock file, both local.

## 2. Configure

Edit `ratchet.config.json`:

- `definitionOfDone`: the exact commands, in order.
- `tiers.critical` and `tiers.low`: path patterns. A change touching any critical path gets the full review; a change touching only low paths gets the light one; everything else is standard. Put authentication, permissions, persistence migrations, payment code, the hooks and this file under `critical`.
- `remoteCiRequired`: whether remote CI must be green before merge. The local definition of done is always required.
- `reservedDecisions`: the decisions agents must escalate instead of taking.
- `guards.forbiddenCommands`: project-specific command patterns to block, each with the reason shown to the agent.
- `guards.secretDirs`: directories outside the project that hold secrets and must never be read by an agent.
- `guards.protectedPaths`: files agents may not write without an owner unlock (by default the hooks, the settings and this configuration).

## 3. Write the specification

At minimum:

1. `spec/README.md`: what the product is, in a page.
2. `spec/requirements.md`: requirements with stable identifiers (`REQ-001`). Agents cite them in pull requests and tests.
3. A first set of ADRs in `spec/adr/`, from `ADR-0000-template.md`, each with a **Compliance** section. Mark the ones you agree with as `Status: accepted`. From then on, the write guard refuses edits to them.
4. An iteration file in `spec/iterations/` from the template: a goal and a list of tasks with identifiers (`I1-T01`), dependencies and acceptance commands.

Fill the `<placeholders>` in `AGENTS.md`. `CLAUDE.md` imports it, so both stay identical.

## 4. Run

Start Claude Code in the project and run `/resume`. The session-start hook prints the state; the `resume` skill reconciles it with git and open pull requests, applies decided escalations, picks the next unblocked task and runs it through the `run-task` workflow (or the `run-task` skill if you prefer a single agent loop).

You govern through three files:

- `spec/escalations.md`: fill the `Decision:` line of open entries. The next agent applies them.
- `spec/decisions-log.md`: read it to audit what was decided without you.
- `spec/state.md`: where the run is.

## 5. Adopting on an existing codebase

Do not try to write a full specification of what already exists: the code is the best description of itself, and a parallel description drifts.

1. Write ADRs for the decisions you want to protect (layering, data ownership, security rules), not for everything.
2. Write requirements only for the work ahead.
3. Start with `low` and `standard` tiers on most paths and a short `critical` list; widen it after the first incidents.
4. Turn each recurring agent mistake into a guard or a definition-of-done check, with a selftest case. This is the ratchet: the set of things that cannot go wrong only grows.

## 6. Owner unlock

Some writes are refused even when they are legitimate: editing a hook, amending an accepted ADR after a real mistake. The owner can allow them temporarily by creating `.ratchet/unlock.json` by hand:

```json
{
  "expires": "2026-12-31T18:00:00Z",
  "paths": ["spec/adr/ADR-0004-data-ownership.md"],
  "reason": "typo in the compliance section"
}
```

Agents cannot write this file through their file tools, and the command guard refuses the usual shell forms. This is a speed bump against mistakes, not a security boundary against a determined attacker with shell access.

## 7. Turning the method down, not off

The case study shows that under pressure, owners remove review entirely. If you need speed, lower the tiers instead: move paths from `standard` to `low` in the configuration and log the change as a decision. The guards and the definition of done keep running at every tier.
