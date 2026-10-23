# Contributing

Thank you for considering a contribution. Ratchet is a research release; the most useful contributions are evidence.

## Most wanted

1. **Replications.** Run the method on a project and report the metrics of [`docs/evaluation.md`](docs/evaluation.md), including negative results. Open an issue titled `Replication: <short description>` with the numbers and the context (project size, language, model, period, human involvement).
2. **Guard false positives and misses.** A command that a guard blocked wrongly, or a harmful command it let through. Include the exact command and the expected outcome; add the case to `template/.claude/hooks/selftest.mjs` in your pull request.
3. **Ports.** The principles to another agent runtime that offers pre-tool hooks and scripted orchestration.

## Rules for changes

- Every rule added to a guard comes with selftest cases: at least one blocked command and one allowed look-alike.
- Changes to the method in `docs/method.md` that alter the template update the template in the same pull request, and the other way round. The case study showed what happens when a method and its scripts drift apart.
- Keep prose plain: short sentences, no marketing language, claims marked as measured or argued.
- Run `node template/.claude/hooks/selftest.mjs` and `node template/.claude/scripts/check-spec-selftest.mjs` before opening a pull request.
- Write in American English.
