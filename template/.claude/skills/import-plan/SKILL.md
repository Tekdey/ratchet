---
name: import-plan
description: Convert the output of another planning method (BMad Method, GitHub Spec Kit, a PRD, an architecture document, a list of epics or stories) into spec/ (requirements, proposed ADRs, an iteration file), validate it with check-spec, and archive the sources so spec/ stays the single source of truth. Use when a project was planned elsewhere and Ratchet takes over execution.
---

# Import a plan into spec/

Ratchet does not help write a specification; other methods do. This skill is the hand-off: it turns their output into the format the rest of the method reads, without inventing anything. Full mapping and examples: `docs/planning-handoff.md` in the Ratchet repository.

## 1. Find the sources

Look for, in this order, and list what you found with paths:

- **BMad Method**: the planning artifacts folder (by default `_bmad-output/planning-artifacts/`): product brief, PRD, architecture, UX design, epics. Implementation artifacts (stories, sprint status) only to know what is already done.
- **GitHub Spec Kit**: `.specify/memory/constitution.md`, then each `specs/<NNN-feature>/` folder: `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `contracts/`.
- **Anything else** the human points to: a PRD, a design document, an issue list.

File names vary between versions of these tools: trust the content, not the name. If you find nothing, stop and say so; do not write a specification from your own ideas.

## 2. Map

| Source content | Becomes | Rules |
|---|---|---|
| Functional requirements, user stories' acceptance criteria, Spec Kit `spec.md` requirements | `spec/requirements.md`, one `### REQ-NNN` entry each | Keep the wording; add `Source: <file> <section>`. Priorities become a build order, never a release gate. |
| Non-functional requirements (performance, security, accessibility) | Requirements too, with measurable `Acceptance:` lines | A requirement without a way to check it gets an acceptance line marked `to be defined`, and a decision log entry. |
| Architecture choices, Spec Kit `plan.md` decisions, constitution principles | One ADR each in `spec/adr/`, from the template, `Status: proposed` | Each ADR gets a **Compliance** section: how a script or a reviewer checks it. Prefer checks that can become guards. |
| Epics and stories, Spec Kit `tasks.md` | `spec/iterations/I1.md` (and further iterations), one `### I<N>-T<NN>` task each | `Covers:` lists the REQ and ADR identifiers; `Depends on:` the task identifiers; `Acceptance:` the command or test. Group by demonstrable goal, not by layer. |
| Work already done (merged stories, completed tasks) | Nothing in requirements; a line in `spec/state.md` under "Done" | Do not re-plan finished work. |
| Open questions in the sources | Decision log entries, or escalations if reserved | Never resolve a reserved question yourself. |

## 3. Rules of the import

- **Do not invent.** Every requirement, ADR and task traces to a source line. If you split or merge items, say so in the decision log.
- **Imported ADRs are proposed, not accepted.** The human accepts them. Write one escalation, "Accept the imported ADRs", listing them with a one-line summary each and your recommendation. Until then, agents follow them as if accepted.
- **One source of truth.** After the import, move the source documents to `spec/archive/<method>/` (or record their location if they cannot move) and add a line at the top of `spec/README.md`: "Archived planning sources are not authoritative; spec/ is." Agents never read the archive during ordinary tasks.
- **Identifiers are permanent.** Number from `REQ-001`, `ADR-0001` (or after the highest existing number), `I1-T01`. Never renumber later.

## 4. Validate

Run `node .claude/scripts/check-spec.mjs` and fix every error. Warnings (a requirement no task covers yet) are acceptable if they are listed in the import report.

## 5. Report

Append one decision log entry, `Import of <method> planning`, with: sources read, counts (requirements, ADRs, tasks), items split or merged, open questions and where they went. Update `spec/state.md` with the first iteration and its next task. Then run the skill `resume`.
