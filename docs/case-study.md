# Case study: one deployment

This is an observational account of the only deployment of the method so far. It is reported so that others can judge the method on evidence rather than on its description, and so that replications have a baseline. Identifying details of the project have been removed.

## Setting

- **Project.** An open-source infrastructure control plane written in TypeScript: a server, a web client, a command-line tool, agents, about a dozen adapters to third-party systems, and a native client developed on a separate track against a versioned contract. About 145,000 lines of non-test TypeScript and 415 test files at the end of the period.
- **Human.** A single owner who did not write or review code. The owner supplied accounts, secrets and servers, answered reserved decisions when they chose to, and changed the operating regime twice by written directive.
- **Agents.** Claude Code sessions, with the roles, hooks, skills and workflow of this repository in an earlier, project-specific form. One to three sessions ran at the same time.
- **Period.** Ten consecutive days, from the first commit.

## Output

| Measure | Value |
|---|---|
| Merged pull requests | 361 |
| Commits on the main branch (squash merges) | 363 |
| Iteration reports | 47 |
| Architecture decision records | 61 (48 accepted, 12 proposed, 1 superseded) |
| Entries in the decision log | 520 |
| Escalations to the human | 46 (6 decided, 39 still open at the end) |
| Median time from pull request opening to merge | under one hour |

The decision log is the clearest trace of the governance model at work: about fifty decisions a day were taken and recorded without a human, against fewer than five escalations a day.

## Two regimes

The owner changed the operating regime on day 7. Before, every task ran the full loop (three review lenses and sceptic verification). After, the owner asked for speed: merge as soon as the type check and the build pass, and defer tests and reviews to the end.

A pull request is counted as reviewed when it carries a review comment produced by the review step (a structured review with a verdict).

| Day | Merged | Reviewed | Share reviewed |
|---|---|---|---|
| 1 | 20 | 15 | 75 % |
| 2 | 28 | 28 | 100 % |
| 3 | 18 | 18 | 100 % |
| 4 | 57 | 56 | 98 % |
| 5 | 2 | 0 | 0 % |
| 6 | 27 | 27 | 100 % |
| 7 | 39 | 13 | 33 % |
| 8 | 66 | 13 | 20 % |
| 9 | 78 | 4 | 5 % |
| 10 (partial) | 26 | 1 | 4 % |

| Regime | Days | Merged | Per day | Share reviewed |
|---|---|---|---|---|
| Full loop | 1 to 6 | 152 | 25 | 95 % |
| Fast | 7 to 10 | 209 | 52 | 15 % |

Throughput roughly doubled and review coverage collapsed. The deferred work was tracked explicitly as test and review debt, to be paid before release; at the end of the period it had not been paid.

## Observations

**O1. Guards held where prompts would not have.** The command and write guards blocked forbidden actions throughout both regimes, including in the fast regime where review had stopped. The fast regime removed review, not enforcement. This is the strongest argument for guardrails as code: they are the part of the method that survives pressure.

**O2. The full loop was too expensive to survive a deadline.** The owner did not reduce review depth for some changes; they removed it for almost all of them. A uniform maximal review leaves only two options under pressure, all or nothing, and pressure picks nothing. This motivated the risk tiers (principle P8), which are untested.

**O3. The human was the bottleneck of governance.** 39 of 46 escalations were still open at the end. The agents did not wait (they moved to unblocked work, as designed), but work that depended on those decisions accumulated. Reserved decisions need a review cadence on the human side, or a smaller reserved list.

**O4. Deciding and logging kept the run moving.** No session stopped to ask a question. The volume of the decision log (520 entries) shows how many questions a run of this size raises; each would have been a blocking interruption under a method where agents ask.

**O5. The method drifted from its own rules.** After the regime change, parts of the orchestration still encoded the previous rules (for example, waiting for remote CI that was no longer a merge condition). A method expressed as code has to be maintained like code: changes to the contract must be applied to the scripts in the same change.

**O6. Two tracks, one contract.** The separation of a server track and a client track, each allowed to write only its own paths (enforced by the write guard) and communicating through a versioned contract and a request file, let both progress in parallel without merge conflicts between them. This pattern is kept in the method as an option rather than a default.

## Threats to validity

- **One project, one owner, one model family.** Nothing here separates the effect of the method from the effect of the model, the project or the owner's choices.
- **No control.** There is no comparable project run without the method.
- **Review counted by presence, not quality.** A pull request with a review comment may still have had a weak review. The quality of reviews and the rate of defects that escaped them were not measured.
- **No cost data.** Token consumption was not recorded per task, so the cost model in [`method.md`](method.md) is analytical, not measured.
- **Short period.** Ten days say nothing about long-term maintainability of code produced this way.

## What a replication should measure

See [`evaluation.md`](evaluation.md). In priority order: escaped defects per merged pull request by tier, finding refutation rate, token cost per task by tier, share of pull requests that went through the loop, escalation resolution time, and the number of times a guard blocked an action, by rule.
