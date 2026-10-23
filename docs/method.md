# The Ratchet method

A harness for unattended coding agents.

## Abstract

Coding agents are now able to implement non-trivial changes end to end. The limiting factor of long autonomous runs is no longer the model's ability to write code, but the reliability of everything around it: whether rules hold when nobody watches, whether reviews can be trusted, whether the architecture survives hundreds of independent changes, and whether a fresh session can pick up where the last one stopped. Ratchet is a method that addresses these four problems with one design rule: **move every constraint that can be checked mechanically out of the prompt and into code, and spend model capacity only on the work that needs judgement.** It combines a binding specification with immutable architecture decision records, deterministic guards implemented as tool hooks, a scripted task loop with independent reviewers and sceptic verification of their findings, and a governance model in which the agent decides and logs instead of asking, except for a closed list of reserved decisions. This document describes the method, its threat and cost models, and its known limitations. An observational account of one deployment is given in [`case-study.md`](case-study.md).

## 1. Problem

An agent working with a human at the keyboard benefits from constant correction. An agent working alone for hours does not. Four failure modes dominate unattended runs.

**F1. Rule decay.** Instructions in a context file or a prompt are followed most of the time, not every time. Over a long run, a rule followed 95 % of the time is broken many times. Some rules (never leak a secret, never rewrite shared history, never publish from a workstation) cannot afford a single breach.

**F2. Review noise.** A model asked to review code produces findings. Many are real; many are not: the issue is handled elsewhere, the reviewer misread the diff, or the remark is stylistic. An implementer that fixes every finding wastes effort and sometimes introduces defects. An implementer that ignores findings defeats the purpose of review.

**F3. Architectural drift.** Each change is made by an agent that sees a slice of the system. Without a mechanism that makes past decisions binding, agents re-decide them, each locally reasonable, globally inconsistent.

**F4. Blocking and amnesia.** An agent that stops to ask a question halts the run until a human answers. An agent that resumes from a conversation summary loses state; one that resumes from nothing repeats work.

## 2. Design principles

**P1. Specification as law.** One versioned specification is the source of truth: requirements with stable identifiers, user journeys, and architecture decision records (ADRs). Code, tests and reviews cite these identifiers. Nothing else (a conversation, a memory file, a summary) can override it.

**P2. Decisions only move forward.** An accepted ADR is immutable. To change a decision, an agent writes a new ADR with the status `proposed` that supersedes or amends the old one, applies the simplest option compatible with the accepted ADRs meanwhile, and logs why. The edit of an accepted ADR is blocked by a hook, not by a convention.

**P3. Guardrails as code.** A rule that can be checked by a program is checked by a program: a pre-tool hook that refuses a command, a write guard that refuses a path or a content, a script in the definition of done. The prompt explains the rule; the code enforces it. This costs no tokens and does not depend on the model's compliance.

**P4. Separation of roles.** The agent that writes a change never reviews it. Reviewers run with a fresh context and read-only tools. Sceptics run without the reviewer's reasoning.

**P5. Findings must survive refutation.** A review finding is a hypothesis. Before it costs a fix, independent sceptic agents try to refute it against the actual code. A finding that a majority refutes is dropped.

**P6. Decide and log; escalate only what is reserved.** When the specification is silent or wrong, the agent chooses the simplest option compatible with the accepted ADRs, writes the decision (finding, options, choice, impact) in an append-only log, and continues. A closed list of reserved decisions goes to the human in writing, with options and a recommendation; the agent then continues with unblocked work.

**P7. The repository is the memory.** A fresh session resumes from the state file, the version control history, open pull requests and the logs. Never from the memory of a previous conversation. If the state file disagrees with version control, version control wins.

**P8. Rigour proportional to risk.** Review depth is chosen per change from its risk (what it touches), not set once for the whole project. A uniform maximal review is too expensive to survive deadline pressure; this was the main lesson of the case study.

## 3. Architecture

```
            +--------------------------------------------------+
            |  Specification (spec/)                           |
            |  requirements, journeys, ADRs (immutable)        |
            +-----------------------+--------------------------+
                                    | read, cited
            +-----------------------v--------------------------+
            |  Contract (AGENTS.md)                            |
            |  reading order, task cycle, definition of done,  |
            |  review grid, reserved decisions                 |
            +-----------------------+--------------------------+
                                    |
  +--------------------+   +--------v---------+   +----------------------+
  |  Guardrails        |   |  Orchestration   |   |  Memory              |
  |  hooks: commands,  |<->|  run-task.js:    |<->|  state, decision log,|
  |  writes, session   |   |  implement,      |   |  escalations,        |
  |  start             |   |  review, refute, |   |  iteration reports   |
  |  DoD scripts       |   |  fix, gate       |   |                      |
  +--------------------+   +--------+---------+   +----------------------+
                                    |
                  +-----------------v------------------+
                  |  Roles (subagents)                 |
                  |  implementer, reviewer, sceptic,   |
                  |  security reviewer, verifier       |
                  +------------------------------------+
```

The **guardrails** run on every tool call of every agent, including subagents and workflow agents. The **orchestration** is a script, not an agent: the order of steps, the number of reviewers, the refutation rule and the fix budget are code. Agents are called for the steps that need judgement and return structured results validated against a schema.

## 4. The task loop

A unit of work is a task with an identifier, a goal, the requirements it covers and its acceptance commands. One task produces one branch and one pull request.

1. **Implement.** The implementer works in a dedicated worktree. It verifies the external facts it depends on, writes the tests first when the behaviour is specified, implements the simplest design compatible with the ADRs, and runs the full definition of done. It opens a pull request only when everything is green, and returns a structured result including the list of files changed.
2. **Classify.** The workflow derives the risk tier of the change from the files it touches (configured path patterns) or from an explicit argument. Tiers are `low`, `standard` and `critical`.
3. **Review.** Reviewers read the diff and the cited specification and apply the review grid. The number of reviewers and their lenses depend on the tier: one generalist for `low`; three lenses (specification compliance, security, tests) for `standard` and `critical`.
4. **Refute.** Each distinct finding is given to sceptic agents whose instruction is to refute it against the actual code, defaulting to refutation when uncertain. A finding survives when fewer than half of the sceptics refute it. `low` skips this step; `standard` uses one sceptic for medium and high findings; `critical` uses three for every finding.
5. **Fix.** The implementer fixes the surviving findings, reruns the definition of done and pushes. A reviewer checks only the open findings against the new diff. The loop is bounded (three rounds by default); a task still failing after the bound is split or escalated, never merged.
6. **Gate.** A final agent posts the consolidated review on the pull request, confirms that the definition of done passes, and merges only if the review approves. Whether remote CI is a merge condition is a configuration choice; a local definition of done is always one.
7. **Record.** The state file is updated: task done, pull request, next task.

## 5. Governance

### 5.1 Decision log

Every decision taken without a human is appended to `spec/decisions-log.md`:

```
### YYYY-MM-DD · TASK-ID · Short title
Finding: what was observed, with its source if external.
Options: A (the simplest), B (the most complete).
Choice: A, because ...
Impact: requirements or ADRs affected; proposed ADR: no | ADR-NNNN.
```

The log is append-only. It serves three purposes: it lets the human audit what was decided in their absence, it lets later agents understand why the code is the way it is, and it makes silent workarounds visible as their absence.

### 5.2 Reserved decisions and escalations

The contract lists decisions the agent must not take. A reasonable default list: purchases and paid services, publication of a major version, deletion of user data or of audit history, changes of licence, name, prices or telemetry policy, and public announcements. For these, the agent writes an entry in `spec/escalations.md` with the context, the options, a recommendation and everything prepared in advance, marks the blocked tasks in the state file, and moves to the next unblocked task. It never waits and never asks in the conversation.

The human answers by filling the `Decision:` line. The next agent that reads the file applies the decision and logs the application.

### 5.3 Architecture decision records

ADRs follow the usual structure (context, decision, alternatives, consequences, compliance) with one addition: a **compliance** section that says how a script or a reviewer checks the decision. A decision that nothing checks tends to decay; the compliance section is where a decision becomes a guardrail.

Proposed ADRs can be accepted by the human, or by default after a stated period if the human does not object. Projects choose; the template defaults to explicit acceptance.

## 6. Threat model

The harness assumes that a coding agent is a capable but fallible actor that can be misled by the content it reads. It considers four sources of harm.

| Source | Example | Primary control | Secondary control |
|---|---|---|---|
| Model error | Force-pushes to rewrite a mistake; edits an accepted ADR to make a test pass | Command and write guards | Review grid, sceptics |
| Instruction drift | Forgets a rule late in a long session | Guards do not depend on context | Session-start hook re-injects state and reminders |
| Hostile content | A dependency README or an issue tells the agent to publish a package or print an environment variable | Guards block publishing and environment dumps regardless of the reason | Security reviewer lens |
| Secret exposure | Reads a `.env` file into its context; writes a token into a fixture | Read and write guards on secret-bearing paths and credential-shaped content | Secret scanner in the definition of done |

**Out of scope.** The harness does not defend against a malicious human with write access to the repository, nor against a compromised hook configuration: whoever can edit the hooks can disable them. Hook files must be reviewed like code. Rule-based guards also miss semantically equivalent actions written in forms their patterns do not anticipate; they lower the probability of harm and make violations loud, they do not prove its absence. This is why every guard is paired with a review lens.

**The bypass flag.** Running agents with permission prompts disabled is incompatible with this method's intent even though hooks still run, because it removes the last interactive check. The command guard refuses the flag. Orchestrators that need unattended permission handling should use allow and deny lists in the settings instead.

## 7. Cost model

The token cost of a task is dominated by agent runs, and the number of agent runs is driven by the tier and by the number of findings.

| Tier | Reviewers | Sceptic runs | Fix rounds (max) | Runs for a task with *f* findings (upper bound) |
|---|---|---|---|---|
| low | 1 | 0 | 1 | 1 + 1 + 2 + 1 = 5 |
| standard | 3 | 1 per medium or high finding | 3 | 1 + 3 + *f* + 6 + 1 |
| critical | 3 | 3 per finding | 3 | 1 + 3 + 3*f* + 6 + 1 |

With ten findings, a critical task can reach about forty agent runs. The orchestration itself costs nothing: it is a script. The prompts of the method are small (the contract plus one role file per agent) because enforcement lives in code. Ratchet therefore spends tokens on work and verification rather than on ceremony, but verification is not cheap. Tiering is the lever.

## 8. Limitations

1. **Evidence.** One deployment, observational, no control group, no token accounting. The claims of this document are design arguments supported by one case, not measured effects.
2. **Self-bypass.** The method does not prevent its owner from switching it off. In the case study, review coverage fell from 95 % to 15 % under time pressure. Tiers make the cheap path compliant instead of forcing a choice between full review and none; whether that holds under pressure is untested.
3. **Specification cost.** The method assumes a specification exists. Writing one is the largest part of the work and the method gives little help with it; spec-authoring toolkits are complementary.
4. **Human throughput.** Agents produce escalations faster than a busy human resolves them. Without a cadence for reserved decisions, the backlog grows and blocks work.
5. **Pattern guards.** See section 6.
6. **Platform coupling.** The template targets Claude Code (hooks, subagents, skills, the Workflow tool). The principles transfer to any agent runtime that offers pre-tool hooks and scripted orchestration.

## 9. Related work

**Harness engineering.** The term, which appeared in early 2026, names the practice of designing the system around a model (rules files, tools, sensors, feedback loops) so that an agent's output can be trusted; it is often summarised as *agent = model + harness* [1][2][3]. Ratchet is a harness in this sense, specialised for unattended runs. Its rule of turning each observed agent mistake into a permanent mechanical check is the practice those authors describe as fixing the cause so the mistake cannot recur.

**Spec-driven development.** Toolkits such as GitHub Spec Kit [4] structure work as specification, plan, tasks and implementation, with a human validating each stage. Ratchet shares the binding specification and adds what unattended operation requires: enforcement in code, adversarial review and decision governance. The two are complementary: a spec toolkit can produce the specification Ratchet runs on.

**Persona-based agile frameworks.** The BMad Method [5] organises work through agent personas (analyst, product manager, architect, developer) and generated planning documents. It is strongest when a project starts from nothing. Ratchet uses fewer, narrower roles, keeps a single source of truth, and expresses rules as code rather than as persona instructions.

**Skill libraries.** Collections such as Superpowers [6] provide reusable procedures (planning, test-driven development, debugging) for an agent working with a developer. Ratchet's skills are deliberately few; its distinctive parts are the hooks, the workflow and the governance files.

**Architecture decision records.** ADRs as short, numbered, immutable records come from Nygard [7]. Ratchet adds a compliance section and enforces immutability with a write guard.

**Limits of rule-based guards.** Recent work on runtime monitors for autonomous agents shows that rule-based hooks miss semantically equivalent actions and benefits from model-backed review [8]. This supports pairing guards with review lenses rather than relying on either alone.

## References

1. B. Böckeler, "Harness engineering for coding agent users", martinfowler.com, 2026. https://martinfowler.com/articles/harness-engineering.html
2. A. Osmani, "Agent Harness Engineering", 2026. https://addyosmani.com/blog/agent-harness-engineering/
3. "Harness Engineering: Anatomy, Architecture, and Evolution of Coding Agents. A Source-Code Study of Eleven Systems", arXiv:2609.00006, 2026. https://arxiv.org/abs/2609.00006
4. GitHub, "Spec Kit". https://github.github.com/spec-kit/
5. BMad Code, "BMad Method". https://github.com/bmad-code-org/BMAD-METHOD
6. "Superpowers". https://github.com/obra/superpowers
7. M. Nygard, "Documenting Architecture Decisions", 2011. https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
8. "ClawSentry: A Progressive Multi-Tier Security Monitor for Safeguarding Autonomous LLM Agents", arXiv:2608.21101, 2026. https://arxiv.org/abs/2608.21101
