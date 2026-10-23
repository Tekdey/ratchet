# <Project name>: specification

This folder is the source of truth. Code, tests, reviews and pull requests cite its identifiers.

| File | Content |
|---|---|
| `requirements.md` | Requirements with stable identifiers (`REQ-001`). |
| `adr/` | Architecture decision records. Accepted ones are immutable. |
| `iterations/` | One file per iteration: goal, tasks, acceptance; then its report. |
| `state.md` | Where the run is. Updated after every task. |
| `decisions-log.md` | Every decision taken without a human. Append-only. |
| `escalations.md` | Reserved decisions waiting for the human. |
| `facts.md` | External facts verified against official sources. |
| `archive/` | Planning documents imported from another method (skill `import-plan`). Not authoritative: `spec/` is. |

## Product in one page

<What the product does, for whom, and what it must never do.>
