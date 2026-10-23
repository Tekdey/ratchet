#!/usr/bin/env node
// Runs check-spec.mjs against a valid specification and against one with known defects, and fails when a defect is
// missed or a valid specification is refused. Run: node .claude/scripts/check-spec-selftest.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-spec.mjs');

function project(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ratchet-spec-'));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return dir;
}
const run = (dir) => spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });

const REQS = `# Requirements

\`\`\`
### REQ-999 · Example inside a fence, ignored
\`\`\`

### REQ-001 · Sign in
Statement: the system shall let a user sign in with an email link.
Acceptance: e2e test sign-in.spec passes.
Status: active

### REQ-002 · Export
Statement: the system shall export a CSV.
Acceptance: unit test export.test passes.
Status: active
`;
const ADR = (n, status, compliance = 'dependency-cruiser rule no-ui-to-db.') =>
  `# ADR-000${n}: Decision ${n}\n\n- Status: ${status}\n\n## Context\n\nx\n\n## Decision\n\nx\n\n## Compliance\n\n${compliance}\n`;
const INDEX = '# ADRs\n\n| ADR | Title | Status |\n|---|---|---|\n| ADR-0001 | Layers | accepted |\n| ADR-0002 | Cache | proposed |\n';
const ITER = `# I1: First slice

### I1-T01 · Sign-in
Covers: REQ-001, ADR-0001
Depends on: none
Acceptance: npm test -- sign-in

### I1-T02 · Export
Covers: REQ-002
Depends on: I1-T01
Acceptance: npm test -- export

### I1-T99 · Close the iteration
Run the skill close-iteration.
`;

const valid = {
  'spec/requirements.md': REQS,
  'spec/adr/README.md': INDEX,
  'spec/adr/ADR-0001-layers.md': ADR(1, 'accepted'),
  'spec/adr/ADR-0002-cache.md': ADR(2, 'proposed'),
  'spec/iterations/I1.md': ITER,
};

const broken = {
  'spec/requirements.md': REQS + '\n### REQ-001 · Duplicate\nStatement: x\nStatus: maybe\n',
  'spec/adr/README.md': INDEX,
  'spec/adr/ADR-0001-layers.md': ADR(1, 'accepted', ''),
  'spec/adr/ADR-0002-cache.md': ADR(2, 'proposed'),
  'spec/adr/ADR-0003-queue.md': ADR(3, 'proposed').replace('ADR-0003', 'ADR-0004'),
  'spec/iterations/I1.md': ITER.replace('Covers: REQ-002', 'Covers: REQ-007').replace('Depends on: I1-T01', 'Depends on: I1-T05') +
    '\n### I2-T01 · Wrong file\nCovers: REQ-001\n',
};

const EXPECTED_ERRORS = [
  'REQ-001 is defined twice',
  'has no "Acceptance:" line',
  'needs "Status: active" or "Status: withdrawn"',
  'non-empty "## Compliance" section',
  'the title says ADR-0004 but the file name says ADR-0003',
  'ADR-0003 is not listed in the index',
  'covers REQ-007, which does not exist',
  'depends on I1-T05, which does not exist',
  'I2-T01 is in the file of iteration I1',
];

let failures = 0;
const fail = (msg) => {
  failures++;
  process.stdout.write(`FAIL ${msg}\n`);
};

const ok = project(valid);
const r1 = run(ok);
if (r1.status !== 0) fail(`a valid specification was refused:\n${r1.stdout}`);
if (r1.stdout.includes('REQ-999')) fail('content inside a code fence was read');
rmSync(ok, { recursive: true, force: true });

const bad = project(broken);
const r2 = run(bad);
if (r2.status !== 1) fail(`a broken specification passed (exit ${r2.status})`);
for (const e of EXPECTED_ERRORS) if (!r2.stdout.includes(e)) fail(`missed: ${e}\n${r2.stdout}`);
rmSync(bad, { recursive: true, force: true });

const total = 3 + EXPECTED_ERRORS.length;
process.stdout.write(failures === 0 ? `all cases pass (${total})\n` : `${failures} of ${total} cases fail\n`);
process.exit(failures === 0 ? 0 : 1);
