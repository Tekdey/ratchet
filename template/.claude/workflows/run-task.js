export const meta = {
  name: 'run-task',
  description: 'Run one task: implement in a worktree, review with depth set by the risk tier, refute findings with sceptics, fix loop, final gate',
  whenToUse: 'For every task I<N>-T<NN> of spec/iterations/. args: { task: "I1-T03", tier?: "low" | "standard" | "critical", merge?: boolean, requireCi?: boolean, maxFixRounds?: number }',
  phases: [
    { title: 'Implement', detail: 'tests first, full definition of done, pull request opened' },
    { title: 'Review', detail: 'one or three reviewers depending on the tier' },
    { title: 'Refute', detail: 'sceptics try to refute each finding; majority rule' },
    { title: 'Fix', detail: 'implementer addresses surviving findings, bounded rounds' },
    { title: 'Gate', detail: 'review posted, definition of done confirmed, merge if approved' },
  ],
}

const task = typeof args === 'string' ? args : args && args.task
if (!task || !/^I\d+-T\d{2}$/.test(task)) throw new Error('args.task is required, e.g. { task: "I1-T03" }')
const TIERS = ['low', 'standard', 'critical']
const forcedTier = args && TIERS.includes(args.tier) ? args.tier : null
const wantMerge = !!(args && args.merge)
const requireCi = !!(args && args.requireCi)
const maxFixRounds = args && Number.isInteger(args.maxFixRounds) ? args.maxFixRounds : 3

// Paths that are critical whatever the configuration says: the guardrails and the decisions themselves.
const ALWAYS_CRITICAL = [/^\.claude\//, /^ratchet\.config\.json$/, /^spec\/adr\//]

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    worktree: { type: 'string' },
    prNumber: { type: 'integer' },
    prUrl: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    tier: { type: 'string', enum: TIERS },
    done: { type: 'string' },
    notDone: { type: 'string' },
    decisionsLogged: { type: 'array', items: { type: 'string' } },
    escalations: { type: 'array', items: { type: 'string' } },
    dod: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, status: { type: 'string', enum: ['green', 'red', 'skipped'] }, note: { type: 'string' } }, required: ['command', 'status'] } },
  },
  required: ['branch', 'worktree', 'done', 'dod', 'filesChanged', 'tier'],
}

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'request-changes'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          problem: { type: 'string' },
          expectedFix: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['severity', 'file', 'problem', 'expectedFix'],
      },
    },
    grid: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['refuted', 'reason'],
}

const GATE_SCHEMA = {
  type: 'object',
  properties: {
    ready: { type: 'boolean' },
    dodGreen: { type: 'boolean' },
    ciStatus: { type: 'string' },
    reviewPosted: { type: 'boolean' },
    blockers: { type: 'array', items: { type: 'string' } },
    merged: { type: 'boolean' },
  },
  required: ['ready', 'dodGreen', 'reviewPosted', 'blockers'],
}

// ---------------------------------------------------------------- Implement
phase('Implement')
const impl = await agent(
  `Implement task ${task} following .claude/agents/implementer.md and AGENTS.md section 4. Work in a dedicated git worktree under .worktrees/. Run the complete definition of done from ratchet.config.json; open the pull request only when everything is green. Report the files changed and the tier they imply under "tiers" in ratchet.config.json. Return the structured result.`,
  { label: `implement:${task}`, phase: 'Implement', agentType: 'implementer', schema: IMPL_SCHEMA },
)
if (!impl) throw new Error('implementer returned nothing')
if (!impl.prNumber) {
  log(`No pull request opened for ${task}: ${impl.notDone || 'see implementer output'}`)
  return { task, impl, tier: null, reviews: [], confirmed: [], gate: null }
}

// The tier is the highest of: the explicit argument, the implementer's classification, the paths always critical.
const touchesCritical = impl.filesChanged.some((f) => ALWAYS_CRITICAL.some((re) => re.test(f.replace(/\\/g, '/'))))
const rank = (t) => TIERS.indexOf(t)
let tier = impl.tier
if (touchesCritical) tier = 'critical'
if (forcedTier && rank(forcedTier) > rank(tier)) tier = forcedTier
log(`PR #${impl.prNumber} on ${impl.branch}, tier ${tier}`)

// ---------------------------------------------------------------- Review
const LENSES = {
  general: 'the whole grid of AGENTS.md section 6, with equal weight',
  spec: 'specification and ADR compliance: the change does exactly what the task asks, respects every accepted ADR, and logs its deviations',
  security: 'security and secrets: authorisation on every entry point, validated and allowlisted external input, no secret in code, logs, errors, events or payloads, audit of destructive actions, no weakening of the guardrails',
  tests: 'tests and definition of done: error paths covered, nothing skipped, fixtures recorded rather than live, documentation updated, the definition of done output in the pull request is real',
}
const lenses = tier === 'low' ? ['general'] : ['spec', 'security', 'tests']

phase('Review')
const reviews = (await parallel(lenses.map((key) => () =>
  agent(
    `Review pull request #${impl.prNumber} (branch ${impl.branch}, task ${task}, declared tier ${tier}) following .claude/agents/reviewer.md. Your lens: ${LENSES[key]}. Apply the full grid but dig deepest on your lens. Do not post anything on the pull request; return the structured findings only.`,
    { label: `review:${key}`, phase: 'Review', agentType: 'reviewer', schema: FINDINGS_SCHEMA },
  ).then((r) => (r ? { lens: key, ...r } : null)),
))).filter(Boolean)

const seen = new Set()
const candidates = []
for (const r of reviews) {
  for (const f of r.findings) {
    const key = `${f.file}:${f.line || 0}:${f.problem.slice(0, 60).toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push({ ...f, lens: r.lens })
  }
}
log(`${candidates.length} distinct findings from ${reviews.length} reviewer(s)`)

// ---------------------------------------------------------------- Refute
// low: no sceptic, every finding stands. standard: one sceptic for medium and high findings. critical: three for all.
const sceptics = (f) => (tier === 'critical' ? 3 : tier === 'standard' && f.severity !== 'low' ? 1 : 0)

phase('Refute')
const verified = await parallel(candidates.map((f) => () => {
  const n = sceptics(f)
  if (n === 0) return Promise.resolve({ ...f, survives: true, votes: [] })
  return parallel(Array.from({ length: n }, (_, i) => () =>
    agent(
      `Follow .claude/agents/sceptic.md. Try to REFUTE this finding on pull request #${impl.prNumber} (task ${task}) by reading the actual code (gh pr diff ${impl.prNumber}, then the files in full). Default to refuted=true when uncertain. Finding: ${JSON.stringify(f)}`,
      { label: `sceptic:${i + 1}:${f.file}`, phase: 'Refute', agentType: 'sceptic', schema: VERDICT_SCHEMA },
    ),
  )).then((votes) => {
    const v = votes.filter(Boolean)
    const refutations = v.filter((x) => x.refuted).length
    return { ...f, survives: v.length > 0 && refutations * 2 < v.length, votes: v.map((x) => x.reason) }
  })
}))
const confirmed = verified.filter((f) => f.survives)
log(`${confirmed.length} findings survive, ${verified.length - confirmed.length} refuted`)

// ---------------------------------------------------------------- Fix
phase('Fix')
let round = 0
let remaining = confirmed.filter((f) => f.severity !== 'low')
const lowOnly = confirmed.filter((f) => f.severity === 'low')
while (remaining.length > 0 && round < maxFixRounds) {
  round += 1
  log(`Fix round ${round}: ${remaining.length} findings`)
  const fix = await agent(
    `Fix these confirmed findings on pull request #${impl.prNumber} in the existing worktree ${impl.worktree} (branch ${impl.branch}), following .claude/agents/implementer.md. Rerun the full definition of done, commit, push, and update the "Verification" section of the pull request. Also address these low-severity findings if cheap: ${JSON.stringify(lowOnly)}. Findings to fix: ${JSON.stringify(remaining)}. Return the structured result.`,
    { label: `fix:${round}`, phase: 'Fix', agentType: 'implementer', schema: IMPL_SCHEMA },
  )
  if (!fix) break
  const recheck = await agent(
    `Recheck pull request #${impl.prNumber} after fix round ${round}. For each of these findings, verify with evidence from the code whether it is resolved: ${JSON.stringify(remaining)}. Return only the findings still open (same shape), and verdict approve if none remain.`,
    { label: `recheck:${round}`, phase: 'Fix', agentType: 'reviewer', schema: FINDINGS_SCHEMA },
  )
  remaining = recheck && Array.isArray(recheck.findings) ? recheck.findings.filter((f) => f.severity !== 'low') : []
}
if (remaining.length > 0) log(`${remaining.length} findings still open after ${round} rounds: the pull request must not merge; split the task or escalate`)

// ---------------------------------------------------------------- Gate
phase('Gate')
const approve = remaining.length === 0
const ciStep = requireCi
  ? `Check remote CI with gh pr checks ${impl.prNumber} (wait up to 15 minutes if pending); a red or missing check is a blocker.`
  : `Remote CI is not a merge condition for this project; report its status (gh pr checks ${impl.prNumber}) without waiting.`
const mergeStep = wantMerge && approve
  ? `If the definition of done is green${requireCi ? ' and CI is green' : ''}, merge with gh pr merge ${impl.prNumber} --squash --delete-branch, remove the worktree ${impl.worktree}, and update spec/state.md (task done, pull request, next task).`
  : 'Do not merge.'
const gate = await agent(
  `Final gate for pull request #${impl.prNumber} (task ${task}, tier ${tier}). 1) Post one consolidated review comment on the pull request: the tier, the grid, the confirmed findings and their resolution, the refuted findings in one line each, ending with "Verdict: ${approve ? 'approve' : 'request-changes'}". 2) Rerun the definition of done from ratchet.config.json in ${impl.worktree} and report whether it is green. 3) ${ciStep} 4) ${mergeStep} Confirmed findings: ${JSON.stringify(confirmed)}. Open findings: ${JSON.stringify(remaining)}.`,
  { label: `gate:${task}`, phase: 'Gate', schema: GATE_SCHEMA },
)

return {
  task,
  tier,
  pr: impl.prUrl || impl.prNumber,
  reviews: reviews.map((r) => ({ lens: r.lens, verdict: r.verdict, findings: r.findings.length })),
  findings: { raised: candidates.length, refuted: verified.length - confirmed.length, confirmed: confirmed.length },
  confirmed,
  openFindings: remaining,
  fixRounds: round,
  gate,
}
