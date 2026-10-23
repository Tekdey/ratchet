# Evaluating the method

Ratchet makes claims that can be checked. This document lists what to measure, how, and what result would count against the method. Report negative results; they are as useful as positive ones.

## Questions

| # | Question | Claim under test |
|---|---|---|
| Q1 | Do guards block real harm, and how often do they block legitimate work? | P3, guardrails as code |
| Q2 | Does skeptic verification remove false findings without removing true ones? | P5, findings must survive refutation |
| Q3 | Does tiered review keep coverage up under time pressure? | P8, rigor proportional to risk |
| Q4 | How many defects escape review, by tier? | The review loop as a whole |
| Q5 | Does the architecture drift? | P2, decisions only move forward |
| Q6 | Does the run block on the human? | P6, decide and log |
| Q7 | What does a task cost? | Cost model, method section 7 |

## Metrics and how to collect them

**M1. Guard activity.** Count blocks per rule. The template hooks write one line per block to `.ratchet/guard.log` (JSON lines: time, hook, rule, tool). For a sample of blocks, label each as *prevented harm*, *legitimate action blocked* (false positive) or *ambiguous*. A false positive rate above 10 % on a rule is a reason to rewrite that rule.

**M2. Refutation rate.** The workflow returns every finding with its votes. Record, per tier: findings raised, findings refuted, findings confirmed. To estimate whether refutation is too aggressive, have a human (or a stronger model with full context) adjudicate a random sample of refuted findings. The share of refuted findings that were real is the *false refutation rate*. If it exceeds the share of confirmed findings that were not real, the skeptics are doing harm.

**M3. Coverage.** Share of merged pull requests that went through the full loop for their tier. Plot it per day alongside merge throughput. A drop when throughput rises reproduces the case study's main negative result.

**M4. Escaped defects.** Defects found after merge (by later tasks, tests, users) that trace back to a reviewed change. Normalize per merged pull request and split by tier. This is the most important metric and the most expensive to collect; tag fixing commits with the identifier of the pull request that introduced the defect.

**M5. Drift.** Count proposed ADRs that supersede or amend accepted ones, and decision log entries that cite an ADR as the reason for a choice. A healthy run has many of the second and few of the first. Edits to accepted ADRs should be zero; any non-zero value means the write guard failed.

**M6. Blocking.** Time from an escalation's creation to its decision; number of tasks marked blocked; number of times an agent asked a question in conversation instead of logging or escalating (should be zero).

**M7. Cost.** Tokens per task, split by role (implementer, reviewers, skeptics, fixer, gate) and by tier. Claude Code session transcripts carry usage data; aggregate them per workflow run.

## Suggested protocol for a replication

1. Adopt the template on a project with an existing specification, or write one first.
2. Run at least 50 tasks. Assign tiers from the configured path patterns, not by hand.
3. Collect M1 to M7 from the start; retrofitting them is unreliable.
4. If possible, run a matched set of tasks without skeptic verification (fix every finding) to compare M2 and M4.
5. Publish the numbers with the project's size, language, model, period and the owner's involvement.

## What would falsify the method's main claims

- Guards with a false positive rate so high that operators disable them (against P3).
- A false refutation rate higher than the false finding rate (against P5).
- Coverage under pressure no better with tiers than without (against P8).
- Escaped defects per pull request no lower with the loop than with a single reviewer, at a higher cost (against the review loop).
