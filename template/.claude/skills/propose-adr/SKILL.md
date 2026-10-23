---
name: propose-adr
description: Write a proposed ADR when a verified fact or a design need contradicts or extends an accepted ADR. Accepted ADRs are immutable; this is the only way to change a decision. Use together with log-decision.
---

# Propose an ADR

1. Take the next free number from the index in `spec/adr/README.md`.
2. Copy `spec/adr/ADR-0000-template.md` to `spec/adr/ADR-NNNN-<kebab-slug>.md` and fill it:
   - `Status: proposed`, `Date`, `Decider: agent, awaiting acceptance`, `Origin: I<N>-T<NN>`, and `Supersedes: ADR-xxxx` or `Amends: ADR-xxxx` when applicable.
   - Context with the verified fact and its dated source.
   - Decision in the present tense, then the concrete rules.
   - Alternatives, Consequences (positive; negative and mitigations), and **Compliance**: how a script or a reviewer checks the decision. Prefer a check that can become a guard or a definition-of-done command.
3. Add the row to the index in `spec/adr/README.md` with the status `proposed`.
4. Log the decision (skill `log-decision`) with `proposed ADR: ADR-NNNN`.
5. Meanwhile, apply in the code the simplest option compatible with the accepted ADRs, and say so under Consequences.
6. The ADR becomes `accepted` when the human accepts it (or by the default rule stated in `spec/adr/README.md`). From then on the write guard refuses edits to it.
