/**
 * GuardSaaB P2 Regression Test Suite
 *
 * Covers cases required by the P2 checklist:
 *   ✔ ALLOW, AUDIT (risk-elevated allow), HITL/review, BLOCK decisions
 *   ✔ Expired HITL approval (TTL fires → auto-blocked)
 *   ✔ Malformed /intercept requests (missing fields, oversized payload)
 *   ✔ Session replay integrity via audit log projection
 *   ✔ Secret redaction — credentials must NOT appear in audit input payloads
 *
 * Run: npx tsx scripts/regression.test.ts
 * Exit codes: 0 = all pass, 1 = failures
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Engine } from '../src/engine/server.js';
import { DEFAULT_ANOMALY_CONFIG } from '../src/signals/behavioral.js';
import { DEFAULT_CONTENT_CONFIG } from '../src/signals/content.js';
import { JsonLogicPolicyEngine } from '../src/policy/engine.js';
import { AuditLog } from '../src/audit/index.js';
import { summarizeSessions, projectTimeline } from '../src/audit/projector.js';
import type { AuditEntry, MCPToolCall } from '../src/contract/types.js';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = 9361;

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

const opts = {
  port: PORT,
  rulesPath: join(ROOT, 'rules', 'default_policy.yaml'),
  weightsPath: join(ROOT, 'rules', 'risk_weights.yaml'),
  auditFile: join(mkdtempSync(join(tmpdir(), 'ag-reg-')), 'audit.jsonl'),
  ttlMs: 300,          // very short TTL so the expired-approval test runs quickly
  behavioral: { ...DEFAULT_ANOMALY_CONFIG },
  content: { ...DEFAULT_CONTENT_CONFIG },
  injection: { enabled: false, threshold: 0.5 },
  approvalSurface: 'terminal' as const,
  authAccounts: [],
};

/* ----------------------------- helpers ------------------------------------ */

function intercept(body: Record<string, unknown>): Promise<Response> {
  return fetch(`http://127.0.0.1:${PORT}/intercept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function inspect(body: Record<string, unknown>): Promise<Response> {
  return fetch(`http://127.0.0.1:${PORT}/inspect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function testHealthDetails(): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${PORT}/health`);
  const health = await response.json() as { service?: string; ready?: boolean; uptimeSeconds?: number; auditStorage?: string; pendingApprovals?: number; recovery?: string | null };
  check('Health: structured status includes readiness and persistence mode', response.ok && health.service === 'guardsaab-engine' && health.ready === true && health.auditStorage === 'disabled');
  check('Health: uptime, queue count, and recovery guidance are reported', typeof health.uptimeSeconds === 'number' && typeof health.pendingApprovals === 'number' && Boolean(health.recovery));
}

/* ========================= SECTION 1: Policy decisions ==================== */

async function testPolicyDecisions(): Promise<void> {
  console.log('\n── Section 1: ALLOW / AUDIT / HITL / BLOCK decisions ──');

  // ALLOW: a benign read-only command
  {
    const r = await intercept({ tool: 'Bash', input: { command: 'ls -la' }, sessionId: 'reg-s1' });
    const body = await r.json() as { action: string; band?: string };
    check('ALLOW: ls -la → action=ALLOW', body.action === 'ALLOW');
    check('ALLOW: ls -la → band is ALLOW or AUDIT', body.band === 'ALLOW' || body.band === 'AUDIT');
  }

  // AUDIT band: a Read tool — ALLOW action, but the risk engine may flag it AUDIT
  {
    const r = await intercept({ tool: 'Read', input: { file_path: 'src/index.ts' }, sessionId: 'reg-s1' });
    const body = await r.json() as { action: string };
    check('AUDIT: Read tool → action=ALLOW (audit band; agent unblocked)', body.action === 'ALLOW');
  }

  // HITL (ASK surface): git push requires review
  {
    const r = await intercept({ tool: 'Bash', input: { command: 'git push origin main' }, sessionId: 'reg-s1' });
    const body = await r.json() as { action: string };
    // terminal surface → ASK; dashboard surface → HITL hold. Both are correct here.
    check('HITL: git push → action is HITL or ASK', body.action === 'HITL' || body.action === 'ASK');
  }

  // BLOCK: destructive command
  {
    const r = await intercept({ tool: 'Bash', input: { command: 'rm -rf /' }, sessionId: 'reg-s1' });
    const body = await r.json() as { action: string; band?: string };
    check('BLOCK: rm -rf / → action=BLOCK', body.action === 'BLOCK');
    check('BLOCK: rm -rf / → band=BLOCK', body.band === 'BLOCK');
  }

  // BLOCK: reading a .env file
  {
    const r = await intercept({ tool: 'Bash', input: { command: 'cat .env' }, sessionId: 'reg-s1' });
    const body = await r.json() as { action: string };
    check('BLOCK: cat .env → action=BLOCK', body.action === 'BLOCK');
  }

  // BLOCK: .env via the path fact
  {
    const r = await intercept({ tool: 'Read', input: { file_path: '.env' }, sessionId: 'reg-s1' });
    const body = await r.json() as { action: string };
    check('BLOCK: Read .env path → action=BLOCK', body.action === 'BLOCK');
  }
}

/* ========================= SECTION 2: Expired approval ==================== */

async function testExpiredApproval(): Promise<void> {
  console.log('\n── Section 2: Expired HITL approval ──');

  // Restart engine with dashboard surface so we get a real HITL hold
  const expiredEngine = new Engine({
    ...opts,
    port: PORT + 1,
    auditFile: join(mkdtempSync(join(tmpdir(), 'ag-exp-')), 'audit.jsonl'),
    ttlMs: 200,              // 200 ms — expires before we do anything
    approvalSurface: 'dashboard',
  } as any);
  await expiredEngine.listen();

  try {
    // submit git push (HITL rule) — do NOT resolve it; let it expire
    const interceptPromise = fetch(`http://127.0.0.1:${PORT + 1}/intercept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool: 'Bash', input: { command: 'git push origin main' }, sessionId: 'exp-s1' }),
    });

    await new Promise(r => setTimeout(r, 30));
    const pendingResponse = await fetch(`http://127.0.0.1:${PORT + 1}/pending`);
    const pendingData = await pendingResponse.json() as { pending?: Array<{ id: string }> };
    const expiredId = pendingData.pending?.[0]?.id;

    // wait for TTL to fire
    await new Promise(r => setTimeout(r, 500));

    const r = await interceptPromise;
    const body = await r.json() as { action: string; reason?: string };
    check('Expired: held call resolves eventually', r.ok);
    check('Expired: expired call is blocked (BLOCK)', body.action === 'BLOCK');
    check('Expired: reason mentions expiry or timeout', /expir|timeout|timed/i.test(body.reason ?? ''));
    if (expiredId) {
      const replay = await fetch(`http://127.0.0.1:${PORT + 1}/decision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'decision', violationId: expiredId, action: 'ALLOW' }) });
      const afterReplay = await fetch(`http://127.0.0.1:${PORT + 1}/pending`).then((response) => response.json()) as { pending?: unknown[] };
      check('Replay: expired approval cannot be replayed', replay.ok && afterReplay.pending?.length === 0);
    } else check('Replay: expired approval ID was observable before expiry', false);
  } finally {
    await expiredEngine.close();
  }
}

/* ========================= SECTION 3: Malformed requests ================== */

async function testMalformedRequests(): Promise<void> {
  console.log('\n── Section 3: Malformed /intercept requests ──');

  // Missing tool field — engine should not crash; returns 400 or still a valid decision
  {
    const r = await intercept({ input: { command: 'ls' }, sessionId: 'mal-s1' });
    check('Malformed: missing tool field → server replies (no crash)', r.status < 500, `status=${r.status}`);
  }

  // Completely empty body — must not crash
  {
    const r = await fetch(`http://127.0.0.1:${PORT}/intercept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    check('Malformed: empty {} body → server replies (no crash)', r.status < 500, `status=${r.status}`);
  }

  // Non-JSON body
  {
    const r = await fetch(`http://127.0.0.1:${PORT}/intercept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    check('Malformed: non-JSON body → 400 or server replies', r.status < 500, `status=${r.status}`);
  }

  // Very large payload (100 KB of filler)
  {
    const big = 'x'.repeat(100_000);
    const r = await intercept({ tool: 'Bash', input: { command: big }, sessionId: 'mal-s1' });
    check('Malformed: 100 KB command → server replies (no crash)', r.status < 500, `status=${r.status}`);
  }
  {
    const big = JSON.stringify({ tool: 'Bash', input: { command: 'x'.repeat(1_100_000) } });
    const r = await fetch(`http://127.0.0.1:${PORT}/intercept`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: big });
    check('Malformed: body over 1 MB is rejected without crashing engine', r.status === 400, `status=${r.status}`);
  }
}

/* ========================= SECTION 4: Session replay integrity ============= */

async function testSessionReplay(): Promise<void> {
  console.log('\n── Section 4: Session replay integrity ──');

  // Write a synthetic audit log and verify the projector produces a consistent timeline.
  const dir = mkdtempSync(join(tmpdir(), 'ag-replay-'));
  const file = join(dir, 'audit.jsonl');
  const log = new AuditLog(file);

  const ts = Date.now();
  const entries: AuditEntry[] = [
    { event: 'session-started', ts: ts + 0, sessionId: 'replay-s1', reason: 'Session started.' },
    { event: 'decision', ts: ts + 100, sessionId: 'replay-s1', requestId: 'req-1', reason: 'ls -la', action: 'ALLOW' },
    { event: 'hitl-opened',   ts: ts + 200, sessionId: 'replay-s1', requestId: 'req-2', reason: 'git push requires review' },
    { event: 'hitl-resolved', ts: ts + 300, sessionId: 'replay-s1', requestId: 'req-2', reason: 'Approved by operator', action: 'ALLOW', resolution: 'approved', latencyMs: 100 },
    { event: 'decision', ts: ts + 400, sessionId: 'replay-s1', requestId: 'req-3', reason: 'rm -rf blocked', action: 'BLOCK' },
    { event: 'session-ended', ts: ts + 500, sessionId: 'replay-s1', reason: 'Session ended — monitor state reset.' },
  ] as AuditEntry[];

  for (const e of entries) log.record(e);

  const replayed = log.read();
  check('Replay: all 6 entries persist', replayed.length === 6, `got ${replayed.length}`);
  check('Replay: entries are in order', replayed[0]?.event === 'session-started' && replayed[5]?.event === 'session-ended');

  const sessions = summarizeSessions(replayed);
  check('Replay: session summary has 1 session', sessions.length === 1, `got ${sessions.length}`);
  const sess = sessions[0];
  check('Replay: session id matches', sess?.sessionId === 'replay-s1');
  check('Replay: session has events recorded', (sess?.verdicts ?? 0) >= 2);

  const timeline = projectTimeline(replayed, 'replay-s1');
  check('Replay: timeline has entries', Array.isArray(timeline.events) && timeline.events.length > 0);
  // Verify chronological order
  const tsList = timeline.events.map((e: { ts: number }) => e.ts);
  const sorted = [...tsList].sort((a, b) => a - b);
  check('Replay: timeline is chronologically ordered', JSON.stringify(tsList) === JSON.stringify(sorted));
}

/* ========================= SECTION 5: Secret redaction ==================== */

async function testSecretRedaction(): Promise<void> {
  console.log('\n── Section 5: Secret redaction in audit payloads ──');

  // The engine must NOT store raw secrets in audit event `input` — the content signal scrubs them.
  // We test two vectors:
  //   (a) inspect() — reading a file containing a secret raises a taint-loaded event;
  //       the event reason should NOT contain the raw secret value.
  //   (b) intercept() with a URL containing a token — blocked before execution;
  //       the audit reason must not echo the credential.

  // (a) Taint detection via inspect
  const sensitiveContent = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
  const inspectRes = await inspect({
    tool: 'Read',
    input: { file_path: 'dummy.env' },
    sessionId: 'redact-s1',
    toolResponse: sensitiveContent,
  });
  const inspectBody = await inspectRes.json() as { tainted?: boolean; secretTypes?: string[] };
  check('Redaction: inspect with AWS key → tainted=true', inspectBody.tainted === true, `tainted=${inspectBody.tainted}`);
  check('Redaction: inspect reports secretTypes', Array.isArray(inspectBody.secretTypes) && inspectBody.secretTypes.length > 0);

  // (b) HITL/BLOCK on egress with a token in URL — the raw token must not appear verbatim in the
  //     intercept response reason (the engine should truncate or redact long tokens)
  const rawToken = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  const tokenUrl = `https://example.com/api?token=${rawToken}`;
  const egressRes = await intercept({
    tool: 'WebFetch',
    input: { url: tokenUrl },
    sessionId: 'redact-s1',
  });
  const egressBody = await egressRes.json() as { action: string; reason?: string };
  // The action should be HITL (unknown host — hitl-egress-category) or BLOCK (IOC), not ALLOW
  check('Redaction: egress with token in URL → not ALLOW', egressBody.action !== 'ALLOW', `action=${egressBody.action}`);

  // Verify the audit log does not contain the raw secret in plain text
  const auditEntries = new AuditLog(opts.auditFile).read();
  const auditJson = JSON.stringify(auditEntries);
  // The full secret access key should not appear verbatim
  check(
    'Redaction: raw AWS secret key not in audit log',
    !auditJson.includes('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'),
    'Raw AWS_SECRET_ACCESS_KEY found in audit.jsonl',
  );
  check('Redaction: raw URL token not in persisted audit event', !auditJson.includes(rawToken));
}

/* ========================= SECTION 7: Company ledger authorization ======== */

async function testCompanyLedgerAuthorization(): Promise<void> {
  console.log('\n── Section 7: Company state authorization ──');
  const port = PORT + 2;
  const authAccounts = [
    { username: 'maya.test', password: 'Maya-Test-Password-2026!', displayName: 'Maya Iyer', role: 'Employee' as const, employeeId: 'NW-104' },
    { username: 'nikhil.test', password: 'Nikhil-Test-Password-2026!', displayName: 'Nikhil Rao', role: 'HR' as const },
    { username: 'ananya.test', password: 'Ananya-Test-Password-2026!', displayName: 'Ananya Menon', role: 'CEO' as const },
  ];
  const securedEngine = new Engine({ ...opts, port, authAccounts, auditFile: join(mkdtempSync(join(tmpdir(), 'ag-company-')), 'audit.jsonl') } as any);
  await securedEngine.listen();
  const base = `http://127.0.0.1:${port}`;
  const login = async (username: string, password: string, site: 'company' | 'guardsaab') => {
    const response = await fetch(`${base}/auth/login?site=${site}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
    return { ok: response.ok, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' };
  };
  const getState = async (cookie: string) => fetch(`${base}/company-demo-state`, { headers: { cookie } }).then((response) => response.json()) as Promise<{ state: any }>;
  const putState = async (cookie: string, state: unknown) => fetch(`${base}/company-demo-state`, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(state) });
  try {
    const employeeLogin = await login('maya.test', authAccounts[0]!.password, 'company');
    check('Company auth: employee account signs in', employeeLogin.ok && Boolean(employeeLogin.cookie));
    const employeeState = await getState(employeeLogin.cookie);
    const maya = employeeState.state.employees[0];
    maya.salary = 1; maya.fundsRemaining = 9;
    employeeState.state.ledger.push({ id: 'forged', employeeId: 'NW-104', amount: 999999, purpose: 'forged', time: Date.now(), requestId: 'forged' });
    employeeState.state.events.unshift({ id: 'forged-audit', time: Date.now(), actor: 'CEO', action: 'Funds credited', detail: 'Forged entry', outcome: 'APPROVED' });
    await putState(employeeLogin.cookie, employeeState.state);
    const afterTamper = await getState(employeeLogin.cookie);
    check('Company auth: employee cannot rewrite salary or available quota', afterTamper.state.employees[0].salary === 118000 && afterTamper.state.employees[0].fundsRemaining === 164000);
    check('Company auth: employee cannot insert a ledger credit', !afterTamper.state.ledger.some((entry: any) => entry.id === 'forged'));
    check('Company auth: client cannot forge a company audit event', !afterTamper.state.events.some((event: any) => event.id === 'forged-audit'));

    const requestState = afterTamper.state;
    requestState.requests.push({ id: 'AUTHZ-75K', employeeId: 'NW-104', amount: 75000, purpose: 'Authorized equipment purchase', status: 'PENDING_HR', createdAt: Date.now(), kind: 'FUND_TRANSFER' });
    await putState(employeeLogin.cookie, requestState);
    const hrLogin = await login('nikhil.test', authAccounts[1]!.password, 'guardsaab');
    const hrState = await getState(hrLogin.cookie);
    hrState.state.employees.push({ id: 'NW-112', name: 'Leela Das', manager: 'Nikhil Rao', department: 'People', bonus: 9999999 });
    hrState.state.requests.push({ id: 'OUT-OF-SCOPE', employeeId: 'NW-112', amount: 25000, purpose: 'Out of scope', status: 'PENDING_HR', createdAt: Date.now() });
    hrState.state.requests.find((request: any) => request.id === 'AUTHZ-75K').status = 'APPROVED';
    hrState.state.ledger.push({ id: 'forged-approval', employeeId: 'NW-104', amount: 999999, purpose: 'forged', time: Date.now(), requestId: 'AUTHZ-75K' });
    await putState(hrLogin.cookie, hrState.state);
    const afterApproval = await getState(employeeLogin.cookie);
    const credit = afterApproval.state.ledger.find((entry: any) => entry.requestId === 'AUTHZ-75K');
    check('Company auth: HR approval credits only the approved request amount', credit?.amount === 75000 && afterApproval.state.employees[0].fundsRemaining === 89000);
    check('Company auth: client-supplied ledger amount is ignored', !afterApproval.state.ledger.some((entry: any) => entry.id === 'forged-approval'));
    check('Company auth: server records the authenticated approver for accepted request', afterApproval.state.events.some((event: any) => event.requestId === 'AUTHZ-75K' && event.actor === 'HR · Nikhil Rao' && event.outcome === 'APPROVED'));
    const ceoLogin = await login('ananya.test', authAccounts[2]!.password, 'guardsaab');
    const allState = await getState(ceoLogin.cookie);
    check('Company auth: HR cannot expand scope by forging employee manager fields', allState.state.employees.find((employee: any) => employee.id === 'NW-112')?.manager === 'Ananya Menon');
    check('Company auth: HR cannot create requests outside assigned reports', !allState.state.requests.some((request: any) => request.id === 'OUT-OF-SCOPE'));

    const quotaRequestState = await getState(employeeLogin.cookie);
    quotaRequestState.state.requests.push({ id: 'CEO-QUOTA-250K', employeeId: 'NW-104', amount: 250000, purpose: 'Regional launch travel', status: 'PENDING_CEO', createdAt: Date.now(), kind: 'QUOTA_INCREASE' });
    await putState(employeeLogin.cookie, quotaRequestState.state);
    const hrReviewState = await getState(hrLogin.cookie);
    hrReviewState.state.requests.find((request: any) => request.id === 'CEO-QUOTA-250K').status = 'APPROVED';
    await putState(hrLogin.cookie, hrReviewState.state);
    const afterHrAttempt = await getState(ceoLogin.cookie);
    check('Company auth: HR cannot approve a CEO-tier quota increase', afterHrAttempt.state.requests.find((request: any) => request.id === 'CEO-QUOTA-250K')?.status === 'PENDING_CEO');
    afterHrAttempt.state.requests.find((request: any) => request.id === 'CEO-QUOTA-250K').status = 'APPROVED';
    await putState(ceoLogin.cookie, afterHrAttempt.state);
    const afterCeoApproval = await getState(employeeLogin.cookie);
    check('Company auth: CEO approval applies quota increase on server', afterCeoApproval.state.requests.find((request: any) => request.id === 'CEO-QUOTA-250K')?.status === 'APPROVED' && afterCeoApproval.state.employees[0].fundQuota === 450000 && afterCeoApproval.state.employees[0].fundsRemaining === 339000);
    check('Company auth: CEO quota decision has a server-authored audit event', afterCeoApproval.state.events.some((event: any) => event.requestId === 'CEO-QUOTA-250K' && event.actor === 'CEO · Ananya Menon' && event.outcome === 'APPROVED'));
  } finally { await securedEngine.close(); }
}

/* ========================= SECTION 6: Policy dry-run (in-process) ========= */

async function testPolicyDryRun(): Promise<void> {
  console.log('\n── Section 6: Policy dry-run (no engine, no port) ──');

  const engine = new JsonLogicPolicyEngine(join(ROOT, 'rules', 'default_policy.yaml'));
  const call = (tool: string, command: string): MCPToolCall => ({ tool, input: { command } });
  const read = (p: string): MCPToolCall => ({ tool: 'Read', input: { file_path: p } });

  // Verify all four outcome bands are reachable without starting anything
  const allow = engine.evaluate(call('Bash', 'ls -la'));
  check('Dry-run: ls -la → ALLOW', allow.action === 'ALLOW', `got ${allow.action}`);

  const block = engine.evaluate(call('Bash', 'rm -rf /'));
  check('Dry-run: rm -rf / → BLOCK', block.action === 'BLOCK', `got ${block.action}`);

  const hitl = engine.evaluate(call('Bash', 'git push origin main'));
  check('Dry-run: git push → HITL', hitl.action === 'HITL', `got ${hitl.action}`);

  const readBlock = engine.evaluate(read('.env'));
  check('Dry-run: Read .env → BLOCK', readBlock.action === 'BLOCK', `got ${readBlock.action}`);

  // AUDIT is a risk-engine band, not a policy action — policy actions are ALLOW/HITL/BLOCK.
  // Verify that a Read tool returns ALLOW at the policy layer (risk engine may upgrade it to AUDIT).
  const auditRead = engine.evaluate({ tool: 'Read', input: { file_path: 'src/index.ts' } });
  check('Dry-run: Read normal file → ALLOW (policy)', auditRead.action === 'ALLOW', `got ${auditRead.action}`);

  // Verify rule IDs are set correctly
  check('Dry-run: block-rm-rf ruleId correct', block.ruleId === 'block-rm-rf', `got ${block.ruleId}`);
  check('Dry-run: hitl-git-push ruleId correct', hitl.ruleId === 'hitl-git-push', `got ${hitl.ruleId}`);
}

/* ========================= Main =========================================== */

async function run(): Promise<void> {
  const engine = new Engine(opts as any);
  await engine.listen();

  try {
    await testHealthDetails();
    await testPolicyDecisions();
    await testMalformedRequests();
    await testSessionReplay();
    await testSecretRedaction();
    await testCompanyLedgerAuthorization();
    await testPolicyDryRun();
    await testExpiredApproval();  // runs its own engine — call after main tests
  } finally {
    await engine.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

run().catch((err: unknown) => {
  fail++;
  console.log('  ❌ harness error —', (err as Error).message ?? err);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(1);
});
