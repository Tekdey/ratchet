---
name: escalate
description: Write a reserved decision for the human in spec/escalations.md (see reservedDecisions in ratchet.config.json), then continue with unblocked work. Use instead of asking the human anything.
---

# Escalate a reserved decision

Reserved decisions are listed in `ratchet.config.json` under `reservedDecisions`. For anything else, decide yourself (skill `log-decision`).

Append to `spec/escalations.md`:

```
## [open] YYYY-MM-DD · I<N>-T<NN> · Title
Context: why the decision is needed, what is blocked and what is not.
Options: A ... (cost, delay, risk); B ...
Recommendation: A, because ...
Prepared: files, texts and commands ready, so the decision takes the human one minute.
Decision: (to be filled by the human)
```

Then:
- List the escalation under "Blocked" in `spec/state.md`, with the tasks it blocks.
- Finish every part of the task that does not depend on the decision; mark the rest as postponed in the iteration report.
- Move to the next unblocked task. Never wait; never ask in the conversation.
- When the human fills `Decision:`, the next agent that reads the file changes the status to `[decided]`, applies the decision and logs the application.

Keep escalations few and ready to decide. In the reference deployment most escalations stayed open; each one should cost the human as little as possible.
