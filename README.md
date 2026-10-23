# Ratchet

**A harness for unattended coding agents: specification as law, guardrails as code, adversarial review, and decisions that only move forward.**

Ratchet is a working method, plus a template kit for Claude Code, that lets autonomous coding agents build and maintain a software project with a human who governs instead of executing. The human writes or approves the specification, decides a short list of reserved questions, and can stop everything. Agents do the rest: implement, review each other, verify the reviews, fix, and record every decision they take.

The name comes from the mechanism it imitates. A ratchet turns one way. In this method, every accepted architecture decision is locked, every agent mistake is turned into a permanent check, and a change advances only by passing gates that the model cannot talk its way through.

> Status: research release. The method has been used on one project (described in [`docs/case-study.md`](docs/case-study.md)). It has not been replicated elsewhere yet. Read the limitations before adopting it.

## Why another method

Most methods for AI-assisted development (spec-driven toolkits, persona-based agile frameworks, skill libraries) help a developer **steer** an agent. A human validates each step, and the rules live in prompts that the model follows most of the time.

Ratchet targets a different regime: **long unattended runs**. That changes three things.

1. **Rules must hold without supervision.** A rule written in a prompt is advice. A rule written as a hook that exits non-zero is a wall. Ratchet moves every rule that can be checked mechanically out of the prompt and into code: command guards, write guards, a definition of done run by scripts.
2. **The agent must never block on a question.** When the specification is silent, the agent decides, writes the decision in an append-only log, and continues. Only a closed list of reserved decisions (money, licence, publication, deletion of user data) goes to the human, in writing, and the agent moves on to unblocked work meanwhile.
3. **Review must be cheap to trust.** Model reviewers produce many false positives. Ratchet runs independent reviewers with distinct lenses, then asks sceptic agents to refute each finding before anyone fixes it.

## The method in one page

| Layer | What it is | Where it lives |
|---|---|---|
| Specification | Vision, requirements with identifiers, architecture decision records (ADRs). The single source of truth. | `spec/` |
| Contract | How agents work: reading order, task cycle, definition of done, review grid, reserved decisions. | `AGENTS.md` |
| Guardrails | Hooks that block forbidden commands, secret leaks and edits to accepted ADRs, whatever the prompt says. | `.claude/hooks/` |
| Roles | Implementer, reviewer, sceptic, security reviewer, verifier. Whoever writes never reviews. | `.claude/agents/` |
| Orchestration | A deterministic script: implement, review in parallel, refute findings, fix, gate. Review depth follows the risk of the change. | `.claude/workflows/run-task.js` |
| Memory | State file, decision log, escalations, iteration reports. A fresh session resumes from the repository, never from a conversation. | `spec/state.md`, `spec/decisions-log.md`, `spec/escalations.md` |

The full rationale, the threat model and the cost model are in [`docs/method.md`](docs/method.md).

## Quick start

Requirements: [Claude Code](https://code.claude.com), Node.js 20 or later, git, and the GitHub CLI if you use pull requests.

For a new project, one command copies the template (nothing is installed globally):

```bash
npx degit Tekdey/ratchet/template my-project
cd my-project
node .claude/hooks/selftest.mjs
```

For an existing project, copy the template next to it first, then merge by hand: a blind copy would overwrite your `.claude/settings.json` and your `CLAUDE.md`.

```bash
npx degit Tekdey/ratchet/template ratchet-template
```

Then fill `ratchet.config.json` (your definition of done commands and your risk tiers), write your first ADRs in `spec/adr/`, and start a session with `/resume`. Step-by-step instructions, including adoption on an existing codebase, are in [`docs/adoption.md`](docs/adoption.md).

## What is in this repository

```
docs/
  method.md        the method: principles, architecture, loop, governance, threat and cost models, limitations
  case-study.md    one deployment, measured: 361 merged pull requests in 10 days, and what broke
  evaluation.md    how to measure whether the method works in your project
  adoption.md      how to install the template, on a new or an existing project
template/          copy into the root of a project
  AGENTS.md        the working contract (CLAUDE.md imports it)
  ratchet.config.json
  spec/            state, decision log, escalations, ADR template, iteration template
  .claude/         agents, skills, workflow, hooks, settings
```

## Known limitations

These are stated up front because they are what a careful adopter needs to know first.

- **One project, no control group.** The case study is an observational account of one deployment, not an experiment.
- **Rigour competes with throughput.** In the case study, the share of merged pull requests carrying a review fell from 95 % to 15 % when the owner asked for speed. The method does not prevent its own bypass. The risk tiers in the workflow are the response to that finding; they have not been evaluated yet.
- **Full review is expensive.** A critical-tier task can spawn dozens of agent runs. Token cost was not measured in the case study.
- **Rule-based hooks have blind spots.** A pattern guard misses semantically equivalent commands written in an unexpected form. Hooks are a floor, not a proof; that is why they are paired with model review.
- **The human can become the bottleneck.** In the case study, most escalations stayed open. Reserved decisions need a cadence on the human side too.
- **Claude Code specific.** The concepts are portable; the template uses Claude Code hooks, subagents, skills and the Workflow tool.

## Contributing

Replications are the most valuable contribution: run the method on a project, measure it with [`docs/evaluation.md`](docs/evaluation.md), and report the numbers, including the bad ones. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licence

MIT. See [`LICENSE`](LICENSE).
