---
name: verify-facts
description: Verify an external fact (third-party API shape, webhook payload, tool flag or version, library behavior) against official dated sources before building on it, and record the result. Use whenever code depends on a third-party behavior.
---

# Verify external facts

1. Write each fact as one falsifiable sentence.
2. Find the primary source: vendor documentation, specification, release notes, or source code at a tagged version. Secondary sources (blogs, forums, model memory) do not verify anything.
3. Record in `spec/facts.md`, one row per fact: fact, status (confirmed, contradicted, unverifiable), source URL, version, date read.
4. For a contradicted fact the specification relies on: log a decision (skill `log-decision`), and propose an ADR (skill `propose-adr`) if it changes an accepted one.
5. Build tests on recorded fixtures of the verified behavior, never on live calls.

For many facts at once, delegate to the agent `verifier`.
