#!/usr/bin/env node
// PreToolUse guard for the Bash tool. Exit 2 blocks the command and shows the reason to the agent; exit 0 allows it.
// Pattern guards are a floor, not a proof: they miss equivalent commands written in unexpected forms (docs/method.md
// section 6). Every rule here has selftest cases in selftest.mjs.
import { block, loadConfig, projectRoot, readInput } from './lib.mjs';

const input = readInput();
if (!input) process.exit(0);
const cmd = String(input?.tool_input?.command ?? '');
if (!cmd) process.exit(0);

const root = projectRoot();
const config = loadConfig(root);
const main = config.mainBranch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const RULES = [
  {
    id: 'permission-bypass',
    re: /--dangerously-skip-permissions|--permission-mode[\s=]+["']?bypassPermissions/,
    why: 'Running agents with permission checks disabled is forbidden. Use allow and deny lists in the settings.',
  },
  {
    id: 'force-push',
    re: /\bgit\s+push\b[^|;&]*\s(--force\b|-f\b|--force-with-lease\b|\+\S)/,
    why: 'Force pushes rewrite shared history. Add a new commit instead.',
  },
  {
    id: 'skip-hooks',
    re: /\bgit\s+commit\b[^|;&]*\s(--no-verify|-n)(?=\s|$)|\bgit\s+(push|merge)\b[^|;&]*\s--no-verify\b/,
    why: 'Skipping git hooks is forbidden. Fix the failing check.',
  },
  {
    id: 'push-main',
    re: new RegExp(`\\bgit\\s+push\\b[^|;&]*\\s\\S+\\s+(?:HEAD:)?(?:refs/heads/)?${main}\\b`),
    why: `Direct pushes to \`${config.mainBranch}\` are forbidden: push a task branch and open a pull request.`,
  },
  {
    id: 'delete-main',
    re: new RegExp(`\\bgit\\s+(branch\\s+(-D|-d|--delete)\\s+${main}\\b|push\\b[^|;&]*\\s--delete\\s+\\S+\\s+${main}\\b)`),
    why: `Do not delete \`${config.mainBranch}\`.`,
  },
  {
    id: 'reset-main',
    re: new RegExp(`\\bgit\\s+reset\\s+--hard\\b[^|;&]*\\b(origin/)?${main}\\b`),
    why: `Do not hard-reset onto \`${config.mainBranch}\` from an agent session.`,
  },
  {
    id: 'admin-merge',
    re: /\bgh\s+pr\s+merge\b[^|;&]*--admin\b/,
    why: 'Bypassing branch protection is forbidden. Make the checks and the review pass.',
  },
  {
    id: 'publish-package',
    re: /(^|[;&|(`"'\s])(npx\s+)?(npm|pnpm|yarn|bun)\b[^|;&\n]*\spublish(?=\s|$|[;&|"'`)])/,
    why: 'Packages are published by CI from a release workflow, never from an agent session.',
  },
  {
    id: 'publish-image',
    re: /\bdocker\s+(push\b|buildx\s+build\b[^|;&]*--push\b)/,
    why: 'Images are published by CI, never from an agent session.',
  },
  {
    id: 'publish-release',
    re: /\bgh\s+release\s+(create|upload|edit|delete)\b/,
    why: 'Releases are created by CI.',
  },
  {
    id: 'recursive-delete-root',
    re: /\brm\s+(-[a-zA-Z]*[rR][a-zA-Z]*)\s+(--\s+)?["']?(\/|~|\$HOME|\.|\.\.|\*|[A-Za-z]:[\\/]?)["']?(\s|$)/,
    why: 'Refusing a recursive delete of a root, home or current directory.',
  },
  {
    id: 'pipe-to-shell',
    re: /\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|pwsh|powershell|iex|python\d?|node)\b/i,
    why: 'Piping a download into an interpreter is forbidden. Download, inspect, then run.',
  },
  {
    id: 'read-env-file',
    re: /(^|[\s;&|(])(cat|type|head|tail|less|more|grep|rg|sed|awk|strings|source|\.|Get-Content|gc|cp|scp)\s+(?:[^|;&]*\s)?["']?(?:[^\s"'|;&]*[/\\])?\.env(?:\.(?!example\b|sample\b)[\w.-]+)?(?=["'\s]|$)/,
    why: '`.env` files hold real secrets and are never read by agents. Use `.env.example`.',
  },
  {
    id: 'write-env-file',
    re: />>?\s*["']?(?:[^\s"'|;&]*[/\\])?\.env(?:\.(?!example\b|sample\b)[\w.-]+)?(?=["'\s]|$)/,
    why: 'Never write `.env` files from an agent session. Commit `.env.example`; real values come from the environment.',
  },
  {
    id: 'dump-environment',
    re: /(^|[;&|]\s*)(printenv|env|set|export\s+-p|Get-ChildItem\s+env:|gci\s+env:|dir\s+env:)\s*($|[|;&>])|\bprintenv\s+\w*(TOKEN|SECRET|KEY|PASSWORD)/i,
    why: 'Dumping the environment may print secrets. Check one harmless variable instead.',
  },
  {
    id: 'git-identity',
    re: /\bgit\s+config\b[^|;&]*\s(user\.email|user\.name|user\.signingkey)\s+\S/,
    why: 'The git identity is configured by the human.',
  },
  {
    id: 'unlock-file',
    re: /\.ratchet[\\/]+unlock\.json/,
    why: 'The unlock file belongs to the human owner. Agents never create, edit or delete it.',
  },
];

for (const dir of config.guards.secretDirs ?? []) {
  const escaped = dir.replace(/^~[\\/]?/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '[\\\\/]');
  RULES.push({
    id: 'secret-dir',
    re: new RegExp(escaped, 'i'),
    why: `${dir} holds secrets and is never accessed from an agent session. Pass secrets through the environment.`,
  });
}

for (const [i, rule] of (config.guards.forbiddenCommands ?? []).entries()) {
  try {
    RULES.push({ id: rule.id ?? `project-${i + 1}`, re: new RegExp(rule.pattern, rule.flags ?? ''), why: rule.why });
  } catch {
    // An invalid project pattern must not disable the built-in rules.
  }
}

for (const rule of RULES) {
  if (rule.re.test(cmd)) block(root, 'guard-bash', rule.id, 'Bash', `${rule.why}\nCommand: ${cmd}`);
}
process.exit(0);
