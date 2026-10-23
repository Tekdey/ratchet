---
name: log-decision
description: Append an entry to spec/decisions-log.md when a decision is taken without a human (specification gap, wrong external fact, choice between equivalent options). Use every time you choose instead of asking.
---

# Log a decision

Append (never rewrite) to `spec/decisions-log.md`, in this exact shape:

```
### YYYY-MM-DD · I<N>-T<NN> · Short title
Finding: what was observed (a verified fact, with its source if external).
Options: A (the simplest), B (the most complete), C if relevant.
Choice: A, because ...
Impact: requirements and ADRs affected; proposed ADR: no | ADR-NNNN; documents to update: ...
```

Rules:
- Date is today; the task is the one you are on (`I0` outside a task).
- One decision per entry. Link the pull request in `Impact` when it exists, and mention the entry in the pull request under "How".
- If the decision changes the meaning of an accepted ADR, also run the skill `propose-adr`.
- If the decision is reserved (see `reservedDecisions` in `ratchet.config.json`), do not log it here: run the skill `escalate`.
