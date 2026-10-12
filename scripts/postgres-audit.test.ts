import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { AuditStore } from '../src/db/audit-store.js';

const databaseUrl = process.env['GUARDSAAB_TEST_DATABASE_URL'];
if (!databaseUrl) throw new Error('Set GUARDSAAB_TEST_DATABASE_URL to run the PostgreSQL audit integration checks.');

const stateDir = mkdtempSync(join(tmpdir(), 'guardsaab-pg-audit-'));
const store = new AuditStore(databaseUrl, stateDir);
const probe = new Pool({ connectionString: databaseUrl, max: 1 });
let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
}

try {
  await store.initialize();
  await store.writeCompanyState({ employees: [], requests: [], ledger: [], events: [{ id: 'pg-integrity-event', time: Date.now(), actor: 'HR · Test', action: 'Request approved', detail: 'authorization=Bearer ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890', outcome: 'APPROVED' }] });
  const rows = await store.recent();
  const status = await store.status();
  check('PostgreSQL persists company activity in the audit chain', rows.length === 1 && rows[0]?.stream === 'company');
  check('PostgreSQL audit chain verifies after a committed event', status.verified && status.count === 1);
  check('PostgreSQL audit payload is sanitized before persistence', !JSON.stringify(rows[0]?.payload).includes('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'));

  let updateBlocked = false;
  let deleteBlocked = false;
  try { await probe.query("UPDATE guardsaab_audit_chain SET payload = '{}'::jsonb WHERE seq = 1"); } catch { updateBlocked = true; }
  try { await probe.query('DELETE FROM guardsaab_audit_chain WHERE seq = 1'); } catch { deleteBlocked = true; }
  check('PostgreSQL trigger rejects audit row updates', updateBlocked);
  check('PostgreSQL trigger rejects audit row deletes', deleteBlocked);
} catch (error) {
  failed++;
  console.error(`  ❌ PostgreSQL integration setup or operation failed — ${(error as Error).message}`);
} finally {
  await store.close().catch(() => undefined);
  await probe.end().catch(() => undefined);
  rmSync(stateDir, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
