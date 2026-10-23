---
name: close-iteration
description: Close an iteration: verify its definition of done, write the report in spec/iterations/, consolidate decisions and escalations, update the state file. Use when every task of the iteration is merged or explicitly deferred.
---

# Close an iteration

1. Check that every task of the iteration is merged or explicitly deferred (with the reason). Run the full definition of done on the main branch, plus the iteration's own acceptance commands.
2. Write `spec/iterations/I<N>-report.md`:
   - Goal and result, with the command or URL to see it working.
   - Tasks done, not done (with the reason), deferred.
   - Figures: tests, coverage, build time, and the method metrics of the iteration: pull requests by tier, findings raised, refuted and confirmed, fix rounds, guard blocks by rule (from `.ratchet/guard.log`), share of pull requests that went through the loop.
   - Decisions taken (links to the log), proposed ADRs, open escalations.
   - Agent mistakes seen more than once, and the guard or check added for each (the ratchet).
   - Recommendation for the next iteration.
3. Update `spec/state.md`: the next iteration becomes current.
4. Proposed ADRs whose acceptance rule is met change status in the index; log each change.
