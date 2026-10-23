#!/usr/bin/env node
// SessionStart hook. Its standard output is added to the agent's context, so that every session resumes from the
// repository (state file, git, open escalations), never from the memory of a previous conversation.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, projectRoot } from './lib.mjs';

const root = projectRoot();
const config = loadConfig(root);
const out = ['[ratchet] Session start. Source of truth: the specification. Working contract: AGENTS.md.'];

const state = join(root, config.paths.state);
if (existsSync(state)) {
  const lines = readFileSync(state, 'utf8').trim().split('\n');
  out.push(`--- ${config.paths.state} ---`, lines.slice(0, config.sessionStart.stateLines).join('\n'), '--- end ---');
} else {
  out.push(`${config.paths.state} is missing: create it with the skill resume.`);
}

const escalations = join(root, config.paths.escalations);
if (existsSync(escalations)) {
  // Fenced blocks hold the entry template, not entries.
  const text = readFileSync(escalations, 'utf8').replace(/^```[\s\S]*?^```/gm, '');
  const open = (text.match(/^## \[open\]/gm) ?? []).length;
  const decided = (text.match(/^Decision:\s*(?!\(to be filled)\S/gm) ?? []).length;
  out.push(`Escalations: ${open} open; entries with a decision filled: ${decided} (apply them before new work).`);
}

const git = (args) => execSync(`git ${args}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
try {
  out.push(`git: branch ${git('rev-parse --abbrev-ref HEAD')}, last commit ${git('log -1 --format=%h%x20%s')}`);
} catch {
  out.push('git: no commit yet.');
}

if (config.sessionStart.reminders.length > 0) out.push(`Reminders: ${config.sessionStart.reminders.join(' ')}`);
process.stdout.write(out.join('\n') + '\n');
