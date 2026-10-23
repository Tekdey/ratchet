// Shared helpers for the Ratchet hooks. No dependencies: Node built-ins only.
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';

export const DEFAULT_CONFIG = {
  paths: {
    spec: 'spec',
    state: 'spec/state.md',
    decisions: 'spec/decisions-log.md',
    escalations: 'spec/escalations.md',
    adrDir: 'spec/adr',
    iterations: 'spec/iterations',
  },
  mainBranch: 'main',
  guards: { forbiddenCommands: [], secretDirs: [], protectedPaths: [] },
  sessionStart: { stateLines: 60, reminders: [] },
};

export function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/** Parses the hook input. An unreadable input allows the call: hooks must never break a session on their own bug. */
export function readInput() {
  try {
    return JSON.parse(readStdin() || '{}');
  } catch {
    return null;
  }
}

/** The project root: the nearest directory holding ratchet.config.json, else the working directory. */
export function projectRoot(start = process.env.CLAUDE_PROJECT_DIR || process.cwd()) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, 'ratchet.config.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

export function loadConfig(root) {
  const file = join(root, 'ratchet.config.json');
  let user = {};
  if (existsSync(file)) {
    try {
      user = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      user = {};
    }
  }
  return {
    ...DEFAULT_CONFIG,
    ...user,
    paths: { ...DEFAULT_CONFIG.paths, ...(user.paths ?? {}) },
    guards: { ...DEFAULT_CONFIG.guards, ...(user.guards ?? {}) },
    sessionStart: { ...DEFAULT_CONFIG.sessionStart, ...(user.sessionStart ?? {}) },
  };
}

/**
 * The owner's temporary unlock, `.ratchet/unlock.json`: `{ "expires": ISO date, "paths": [...] }`. Ignored when
 * expired, malformed, or when RATCHET_STRICT=1 (used by the selftest: an unlock can only make guards more permissive).
 */
export function readUnlock(root) {
  if (process.env.RATCHET_STRICT === '1') return { paths: [] };
  const file = join(root, '.ratchet', 'unlock.json');
  if (!existsSync(file)) return { paths: [] };
  try {
    const u = JSON.parse(readFileSync(file, 'utf8'));
    if (!u.expires || Number.isNaN(Date.parse(u.expires)) || Date.parse(u.expires) < Date.now()) return { paths: [] };
    return { ...u, paths: Array.isArray(u.paths) ? u.paths : [] };
  } catch {
    return { paths: [] };
  }
}

/** Converts a glob (`**`, `*`, `?`) to a regular expression over forward-slash paths, compared in lower case. */
export function globToRegExp(glob) {
  let re = '';
  const g = glob.replace(/\\/g, '/').toLowerCase();
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') {
      if (g[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^$()|[\]{}\\]/g, '\\$&');
  }
  return new RegExp(g.includes('/') ? `^${re}$` : `(^|/)${re}$`);
}

export const matchesAny = (path, globs) => globs.some((g) => globToRegExp(g).test(path));

/** Real absolute path with forward slashes and in lower case; tolerates paths that do not exist yet. */
export function canonical(p, root) {
  let abs = resolve(root, String(p).replace(/^~(?=$|[\\/])/, homedir()));
  const rest = [];
  while (!existsSync(abs)) {
    const parent = dirname(abs);
    if (parent === abs) break;
    rest.unshift(basename(abs));
    abs = parent;
  }
  try {
    abs = realpathSync.native(abs);
  } catch {
    // keep the unresolved path
  }
  return join(abs, ...rest).replace(/\\/g, '/').toLowerCase();
}

/** Path relative to the root (forward slashes, lower case), or null when the path is outside the root. */
export function relativeToRoot(abs, root) {
  const r = relative(canonical(root, root), abs).replace(/\\/g, '/');
  return r.startsWith('..') || /^[a-z]:/i.test(r) ? null : r;
}

/** Appends one JSON line to .ratchet/guard.log; never throws. */
export function logBlock(root, entry) {
  try {
    const dir = join(root, '.ratchet');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'guard.log'), JSON.stringify({ time: new Date().toISOString(), ...entry }) + '\n');
  } catch {
    // logging is best effort
  }
}

/** Refuses the tool call: exit code 2 makes Claude Code show stderr to the agent and cancel the call. */
export function block(root, hook, rule, tool, message) {
  logBlock(root, { hook, rule, tool });
  process.stderr.write(`[ratchet] Blocked (${rule}): ${message}\n`);
  process.exit(2);
}
