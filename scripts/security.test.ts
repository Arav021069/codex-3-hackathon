// Security regression: WebSocket + /decision Origin allowlist (CSWSH fix). Run: npx tsx scripts/security.test.ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { WebSocket } from 'ws';
import { Engine } from '../src/engine/server.js';
import { DEFAULT_ANOMALY_CONFIG } from '../src/signals/behavioral.js';
import { DEFAULT_CONTENT_CONFIG } from '../src/signals/content.js';

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) (pass++, console.log(`  ✅ ${name}`));
  else (fail++, console.log(`  ❌ ${name} — ${detail}`));
}

const ROOT = resolve(import.meta.dirname, '..');
const PORT = 9357;
const authAccounts = [{ username: 'security.test.hr', password: 'Security-Test-HR-2026!', displayName: 'Test HR', role: 'HR' as const }];
const opts = {
  port: PORT,
  rulesPath: join(ROOT, 'rules', 'default_policy.yaml'),
  weightsPath: join(ROOT, 'rules', 'risk_weights.yaml'),
  auditFile: join(mkdtempSync(join(tmpdir(), 'ag-sec-')), 'audit.jsonl'),
  ttlMs: 500,
  behavioral: { ...DEFAULT_ANOMALY_CONFIG },
  content: { ...DEFAULT_CONTENT_CONFIG },
  injection: { enabled: false, threshold: 0.5 },
  authAccounts,
};

/** Resolve to 'open' if the handshake succeeds, 'rejected' if the server refuses it. */
function tryWs(origin?: string, cookie?: string): Promise<'open' | 'rejected' | 'timeout'> {
  return new Promise((res) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, {
      ...(origin ? { origin } : {}),
      ...(cookie ? { headers: { cookie } } : {}),
    });
    const done = (r: 'open' | 'rejected' | 'timeout') => { try { ws.close(); } catch { /*noop*/ } res(r); };
    ws.on('open', () => done('open'));
    ws.on('error', () => done('rejected'));
    ws.on('unexpected-response', () => done('rejected'));
    setTimeout(() => done('timeout'), 1500);
  });
}
const decide = (origin?: string, cookie?: string) =>
  fetch(`http://127.0.0.1:${PORT}/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ type: 'decision', violationId: 'nope', action: 'ALLOW' }),
  }).then((r) => r.status);
const browserPost = (path: string, body: unknown, cookie?: string) =>
  fetch(`http://127.0.0.1:${PORT}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${PORT}`, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  }).then((response) => response.status);

async function run() {
  const engine = new Engine(opts as any);
  await engine.listen();
  try {
    // ── WebSocket handshake (CSWSH vector) ──
    check('WS from a cross-site Origin is REJECTED', (await tryWs('https://evil.example')) === 'rejected');

    // Authenticate a test warden session for browser origin checks
    const loginRes = await fetch(`http://127.0.0.1:${PORT}/auth/login?site=guardsaab`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${PORT}` },
      body: JSON.stringify({ username: 'security.test.hr', password: 'Security-Test-HR-2026!' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const cookie = setCookie ? setCookie.split(';')[0] : '';

    check('WS from loopback Origin with authorized session is allowed', (await tryWs(`http://127.0.0.1:${PORT}`, cookie)) === 'open');
    check('WS from localhost dev Origin with authorized session is allowed', (await tryWs('http://localhost:5173', cookie)) === 'open');
    check('WS with no Origin (non-browser hook client) is allowed', (await tryWs(undefined)) === 'open');

    // ── /decision (same resolveContext sink) ──
    check('POST /decision from a cross-site Origin is 403', (await decide('https://evil.example')) === 403);
    check('POST /decision from unauthenticated browser origin is 401', (await decide(`http://127.0.0.1:${PORT}`)) === 401);
    check('POST /decision from loopback Origin with authorized session is allowed', (await decide(`http://127.0.0.1:${PORT}`, cookie)) === 200);
    check('POST /decision with no Origin (the agent hook path) is allowed', (await decide(undefined)) === 200);

    // Browser-originated engine intake requires an authenticated GuardSaaB operator. Local hooks
    // without Origin remain available and are separately covered by the engine regression suite.
    check('POST /intercept from unauthenticated loopback browser is 401', (await browserPost('/intercept', { tool: 'Read', input: { file_path: 'README.md' } })) === 401);
    check('POST /intercept from authorized GuardSaaB browser is allowed', (await browserPost('/intercept', { tool: 'Read', input: { file_path: 'README.md' } }, cookie)) === 200);
    check('POST /inspect from unauthenticated loopback browser is 401', (await browserPost('/inspect', { tool: 'Read', input: { file_path: 'README.md' }, toolResponse: 'ok' })) === 401);
    check('POST /session from unauthenticated loopback browser is 401', (await browserPost('/session', { event: 'started', sessionId: 'browser-test' })) === 401);
  } finally {
    await engine.close();
  }
}

run()
  .catch((e) => { fail++; console.log('  ❌ harness error —', (e as Error).message); })
  .finally(() => { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); });
