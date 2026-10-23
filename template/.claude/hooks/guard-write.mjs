#!/usr/bin/env node
// PreToolUse guard for the file tools (Read, Grep, Glob, Write, Edit, MultiEdit, NotebookEdit). Exit 2 blocks.
//   Reads and writes: secret-bearing files (.env, private keys) and the configured secret directories.
//   Writes only: the user-level Claude settings, the owner's unlock file, accepted ADRs, protected paths, and any
//   content that looks like a real credential.
// Accepted ADRs and protected paths can be written while the owner's .ratchet/unlock.json lists them.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename } from 'node:path';
import { block, canonical, loadConfig, matchesAny, projectRoot, readInput, readUnlock, relativeToRoot } from './lib.mjs';

const input = readInput();
if (!input) process.exit(0);
const tool = String(input.tool_name ?? '');
const ti = input.tool_input ?? {};
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const isWrite = WRITE_TOOLS.has(tool);

const root = projectRoot();
const config = loadConfig(root);
const deny = (rule, message) => block(root, 'guard-write', rule, tool, message);

const rawPath = String(ti.file_path ?? ti.notebook_path ?? ti.path ?? '');
const glob = String(ti.glob ?? ti.pattern ?? '');

const isEnvName = (name) => /^\.env(\..+)?$/i.test(name) && !/^\.env\.(example|sample|template)$/i.test(name);
const isKeyName = (name) => /^(id_(rsa|dsa|ecdsa|ed25519)|.*\.(pem|p12|pfx|key))$/i.test(name) && !/\.pub$/i.test(name);

// 1. Secret-bearing files and directories, for every file tool.
if (rawPath) {
  const name = basename(rawPath.replace(/[\\/]+$/, ''));
  if (isEnvName(name)) deny('secret-file', `${rawPath} holds secrets and is never read or written by an agent.`);
  if (isKeyName(name)) deny('secret-file', `${rawPath} looks like a private key and is never read or written by an agent.`);
  const abs = canonical(rawPath, root);
  for (const dir of config.guards.secretDirs ?? []) {
    const d = canonical(dir, root);
    if (abs === d || abs.startsWith(`${d}/`)) deny('secret-dir', `${dir} holds secrets and is never accessed by an agent.`);
  }
}
if ((tool === 'Grep' || tool === 'Glob') && /(^|[/*])\.env\b(?!\.(example|sample|template)\b)/i.test(glob)) {
  deny('secret-file', `The pattern ${glob} would match .env files, which are never read by an agent.`);
}

if (!isWrite) process.exit(0);

// 2. Paths no agent writes.
const abs = canonical(rawPath, root);
const userSettings = canonical(`${homedir()}/.claude/settings.json`, root);
if (abs === userSettings) deny('user-settings', 'The user-level Claude settings belong to the human. Project settings live in .claude/settings.json.');
const rel = relativeToRoot(abs, root);
if (rel === '.ratchet/unlock.json') deny('unlock-file', 'The unlock file belongs to the human owner. Agents never write it.');

// 3. Accepted ADRs and protected paths, unless the owner unlocked them.
if (rel !== null) {
  const unlock = readUnlock(root);
  const unlocked = matchesAny(rel, unlock.paths);
  const adrDir = config.paths.adrDir.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  if (!unlocked && rel.startsWith(`${adrDir}/`) && existsSync(abs)) {
    let text = '';
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      text = '';
    }
    if (/^\W*status\W*:?\W*accepted\b/im.test(text)) {
      deny('accepted-adr', `${rel} is an accepted ADR and is immutable. Write a new ADR with "Status: proposed" that supersedes or amends it (skill propose-adr).`);
    }
  }
  if (!unlocked && matchesAny(rel, config.guards.protectedPaths ?? [])) {
    deny('protected-path', `${rel} is protected: the guardrails are changed by the human owner only. Describe the change in the decision log or an escalation.`);
  }
}

// 4. Content that looks like a real credential.
const content = [ti.content, ti.new_string, ti.new_source, ...(Array.isArray(ti.edits) ? ti.edits.map((e) => e?.new_string) : [])]
  .filter((x) => typeof x === 'string')
  .join('\n');
const CREDENTIALS = [
  ['private key', new RegExp('-----BEGIN ' + '(?:[A-Z]+ )*' + 'PRIVATE' + ' KEY-----')],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ['Anthropic key', /\bsk-ant-[A-Za-z0-9_-]{30,}/],
  ['OpenAI-style key', /\bsk-(proj-)?[A-Za-z0-9]{40,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{20,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Stripe live key', /\b(sk|rk)_live_[A-Za-z0-9]{20,}\b/],
];
for (const [label, re] of CREDENTIALS) {
  if (re.test(content)) deny('credential-content', `The content contains what looks like a ${label}. Secrets come from the environment, never from files.`);
}

process.exit(0);
