# Planning elsewhere, executing with Ratchet

Ratchet assumes a specification exists and gives little help writing one (method, limitation 3). Other methods are good at that part. This document describes the hand-off: plan with the method that suits the project, convert its output into `spec/`, then let Ratchet execute.

```
  plan                         hand-off                          execute
  BMad Method   ---+
  Spec Kit      ---+--> skill import-plan --> spec/ --> check-spec --> resume --> run-task ...
  your own docs ---+         (agent)                    (script)
```

The conversion needs judgment (what is a requirement, what is a decision), so an agent does it with the skill `import-plan`. Whether the result is well formed does not need judgment, so a script checks it: `check-spec.mjs`. This is the method's design rule applied to its own input.

## Choosing a planning method

| Situation | Use | Why |
|---|---|---|
| The product is still vague | BMad Method (brief, PRD, architecture, epics) | Guided dialogue with personas helps find what to build. |
| The product is clear, the work is a set of features | GitHub Spec Kit (`/specify`, `/plan`, `/tasks`) | Lighter, one folder per feature. |
| A change to an existing system | Claude Code plan mode, or write it yourself | Most of the knowledge is already in the code. |

## Mapping

### From the BMad Method

| BMad output (typical names) | Ratchet |
|---|---|
| Product brief | `spec/README.md` "Product in one page" |
| PRD: functional and non-functional requirements | `spec/requirements.md` |
| Architecture document: decisions, technology choices, patterns | `spec/adr/`, one proposed ADR per decision |
| UX design | Requirements for behavior; ADRs for design-system decisions |
| Epics and stories | `spec/iterations/I<N>.md`, one task per story |
| Sprint status, finished stories | `spec/state.md` "Done" |

### From GitHub Spec Kit

| Spec Kit output | Ratchet |
|---|---|
| `.specify/memory/constitution.md` | Proposed ADRs (one per principle that can be checked) and rules in `AGENTS.md` section 2 |
| `specs/<NNN-feature>/spec.md` | `spec/requirements.md` |
| `plan.md`, `research.md`, `data-model.md`, `contracts/` | Proposed ADRs; contracts stay as files and are cited by the ADRs |
| `tasks.md` | `spec/iterations/I<N>.md` |

File names change between versions of these tools; the skill reads content, not names.

## Rules of the hand-off

1. **Nothing is invented.** Each requirement, ADR and task cites its source line.
2. **Imported ADRs are proposed.** The human accepts them through one escalation. This keeps the governance model intact: an agent never accepts a decision on the human's behalf.
3. **`spec/` becomes the single source of truth.** Source documents move to `spec/archive/` and are marked non-authoritative. Two live plans drift apart; the case study's project avoided a second planning system for this reason.
4. **The checker must pass.** Unique identifiers, every task covering requirements or ADRs that exist, every ADR with a Compliance section, every task with an acceptance line.

## Example

A Spec Kit feature folder with a requirement "Users can export their data as CSV", a plan choosing a streaming writer, and two tasks, becomes:

```
### REQ-004 · CSV export
Statement: the system shall let a user export their data as a CSV file.
Acceptance: e2e test export.spec downloads a file whose header matches the documented columns.
Status: active
Source: specs/003-export/spec.md, FR-002
```

```
# ADR-0007: Stream exports instead of building them in memory
- Status: proposed
...
## Compliance
A test exports 100,000 rows with the process memory limit set to 256 MB.
```

```
### I2-T03 · CSV export endpoint
Covers: REQ-004, ADR-0007
Depends on: I2-T01
Acceptance: npm test -- export && npx playwright test export.spec
```

## Running the check on its own

```bash
node .claude/scripts/check-spec.mjs
```

Add it to `definitionOfDone` in `ratchet.config.json` (the template does) so that no task can leave `spec/` malformed.
