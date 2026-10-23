---
name: review
description: Independent review of one pull request with the grid of AGENTS.md, posted on the pull request with a verdict. Use before every merge, with an agent that did not write the change.
---

# Review a pull request

1. Confirm you did not write this change. If you did, stop: ask the orchestrator for a fresh reviewer.
2. Follow `.claude/agents/reviewer.md`: read the task, the cited requirements and ADRs, the diff and the touched files in full; rerun read-only checks; check the declared tier.
3. For each finding, give severity, file, line, problem, expected fix and evidence. A finding you cannot point to in the code is not a finding.
4. Optional but recommended for medium and high findings: run the agent `sceptic` on each before posting, and drop the refuted ones (list them in one line each).
5. Post one comment on the pull request:

```
## Review
Tier: low | standard | critical
Grid: 1 ok · 2 ok · 3 finding · ...
Findings:
- [high] path/file.ts:42 · problem · expected fix
Refuted: one line each, or none.
Verdict: approve | request-changes
```
