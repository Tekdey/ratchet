#!/usr/bin/env node
// Checks that spec/ is well formed, so that an agent (or an import from another planning method) cannot leave it in a
// state the rest of the method silently misreads. Exit 1 on errors; warnings are printed but do not fail.
//   Requirements: unique REQ-NNN identifiers, each with Statement, Acceptance and a valid Status.
//   ADRs: number in the file name matches the title, a valid Status, a non-empty Compliance section, listed in the index.
//   Iterations: unique task identifiers matching the file, Covers and Depends on pointing at things that exist,
//   an Acceptance line on every task.
// Content inside fenced code blocks is ignored: the templates keep their examples there.
// Usage: node .claude/scripts/check-spec.mjs [project root]
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
let config = {};
try {
  config = JSON.parse(readFileSync(join(root, 'ratchet.config.json'), 'utf8'));
} catch {
  config = {};
}
const paths = { spec: 'spec', adrDir: 'spec/adr', iterations: 'spec/iterations', ...(config.paths ?? {}) };
const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const stripFences = (text) => text.replace(/^```[\s\S]*?^```[^\n]*$/gm, '');
const field = (block, name) => {
  const m = block.match(new RegExp(`^${name}:[ \\t]*(.*)$`, 'mi'));
  return m ? m[1].trim() : null;
};
/** Splits a document into blocks starting at `### <id>` headings matching `idPattern`. */
function blocks(text, idPattern) {
  const out = [];
  const re = new RegExp(`^### (${idPattern})\\b.*$`, 'gm');
  const heads = [...text.matchAll(re)];
  heads.forEach((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
    out.push({ id: h[1], body: text.slice(h.index, end) });
  });
  return out;
}
const idsIn = (value) => (value ?? '').match(/\b(REQ-\d{3,}|ADR-\d{4}|I\d+-T\d{2})\b/g) ?? [];

// ---------------------------------------------------------------- Requirements
const reqFile = join(root, paths.spec, 'requirements.md');
const requirements = new Map();
if (existsSync(reqFile)) {
  const rel = `${paths.spec}/requirements.md`;
  for (const b of blocks(stripFences(read(reqFile)), 'REQ-\\d{3,}')) {
    if (requirements.has(b.id)) err(rel, `${b.id} is defined twice`);
    const status = field(b.body, 'Status');
    if (!field(b.body, 'Statement')) err(rel, `${b.id} has no "Statement:" line`);
    if (!field(b.body, 'Acceptance')) err(rel, `${b.id} has no "Acceptance:" line`);
    if (!status || !/^(active|withdrawn)$/i.test(status)) err(rel, `${b.id} needs "Status: active" or "Status: withdrawn"`);
    requirements.set(b.id, (status ?? '').toLowerCase());
  }
} else {
  warn(`${paths.spec}/requirements.md`, 'missing');
}

// ---------------------------------------------------------------- ADRs
const adrDir = join(root, paths.adrDir);
const adrs = new Map();
if (existsSync(adrDir)) {
  const indexFile = join(adrDir, 'README.md');
  const index = existsSync(indexFile) ? read(indexFile) : '';
  if (!index) warn(`${paths.adrDir}/README.md`, 'missing index');
  for (const name of readdirSync(adrDir).filter((n) => /^ADR-\d{4}-.+\.md$/.test(n)).sort()) {
    const id = name.slice(0, 8);
    if (id === 'ADR-0000') continue;
    const rel = `${paths.adrDir}/${name}`;
    const text = read(join(adrDir, name));
    if (adrs.has(id)) err(rel, `${id} is used by two files`);
    const title = text.match(/^# (ADR-\d{4})\b/m);
    if (!title) err(rel, 'the first heading must be "# ADR-NNNN: Title"');
    else if (title[1] !== id) err(rel, `the title says ${title[1]} but the file name says ${id}`);
    const status = (text.match(/^\W*Status\W*:?\s*(\w+)/im) ?? [])[1]?.toLowerCase();
    if (!status || !['proposed', 'accepted', 'superseded'].includes(status)) err(rel, 'needs "Status: proposed", "accepted" or "superseded"');
    const compliance = text.match(/^## Compliance[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
    if (!compliance || !compliance[1].trim()) err(rel, 'needs a non-empty "## Compliance" section: how a script or a reviewer checks the decision');
    if (index && !index.includes(id)) err(`${paths.adrDir}/README.md`, `${id} is not listed in the index`);
    adrs.set(id, status ?? '');
  }
}

// ---------------------------------------------------------------- Iterations
const iterDir = join(root, paths.iterations);
const tasks = new Map();
const pending = [];
if (existsSync(iterDir)) {
  for (const name of readdirSync(iterDir).filter((n) => /^I\d+\.md$/.test(n)).sort()) {
    const rel = `${paths.iterations}/${name}`;
    const n = basename(name, '.md').slice(1);
    for (const b of blocks(stripFences(read(join(iterDir, name))), 'I\\d+-T\\d{2}')) {
      if (tasks.has(b.id)) err(rel, `${b.id} is defined twice`);
      if (!b.id.startsWith(`I${n}-`)) err(rel, `${b.id} is in the file of iteration I${n}`);
      tasks.set(b.id, rel);
      if (/-T99$/.test(b.id)) continue;
      if (!field(b.body, 'Acceptance')) err(rel, `${b.id} has no "Acceptance:" line`);
      const covers = idsIn(field(b.body, 'Covers'));
      if (covers.length === 0) warn(rel, `${b.id} covers no requirement or ADR`);
      pending.push({ rel, id: b.id, covers, deps: idsIn(field(b.body, 'Depends on')) });
    }
  }
}
for (const t of pending) {
  for (const c of t.covers) {
    if (c.startsWith('REQ-') && !requirements.has(c)) err(t.rel, `${t.id} covers ${c}, which does not exist`);
    else if (c.startsWith('REQ-') && requirements.get(c) === 'withdrawn') warn(t.rel, `${t.id} covers ${c}, which is withdrawn`);
    if (c.startsWith('ADR-') && !adrs.has(c)) err(t.rel, `${t.id} covers ${c}, which does not exist`);
  }
  for (const d of t.deps) {
    if (!d.startsWith('I')) continue;
    if (!tasks.has(d)) err(t.rel, `${t.id} depends on ${d}, which does not exist`);
    if (d === t.id) err(t.rel, `${t.id} depends on itself`);
  }
}
const covered = new Set(pending.flatMap((t) => t.covers));
for (const [id, status] of requirements) {
  if (status === 'active' && !covered.has(id)) warn(`${paths.spec}/requirements.md`, `${id} is not covered by any task yet`);
}

// ---------------------------------------------------------------- Report
for (const w of warnings) process.stdout.write(`warning  ${w}\n`);
for (const e of errors) process.stdout.write(`error    ${e}\n`);
process.stdout.write(
  `check-spec: ${requirements.size} requirements, ${adrs.size} ADRs, ${tasks.size} tasks; ${errors.length} errors, ${warnings.length} warnings\n`,
);
process.exit(errors.length === 0 ? 0 : 1);
