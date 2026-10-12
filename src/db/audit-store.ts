import { createHmac, randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync, fsyncSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { sanitizeAuditPayload } from '../audit/sanitize.js';

export type AuditStream = 'gateway' | 'company' | 'auth';
export type AuditChainRow = { seq: number; id: string; recordedAt: string; stream: AuditStream; payload: unknown; previousHash: string; hash: string };
export type AuditChainStatus = { enabled: boolean; verified: boolean; count: number; headHash: string | null; checkpointSeq: number; checkedAt: string; error?: string };
export type AuthAccount = { username: string; password: string; displayName: string; role: 'Employee' | 'HR' | 'CEO'; employeeId?: string };
export type AuthenticatedUser = { username: string; displayName: string; role: AuthAccount['role']; employeeId?: string };

const GENESIS = '0'.repeat(64);
const LOCK_ID = 0x57415244454e;

/** PostgreSQL-backed company state and locally keyed, tamper-evident audit chain. */
export class AuditStore {
  private readonly pool: Pool;
  private readonly keyFile: string;
  private readonly checkpointFile: string;
  private key!: Buffer;
  private checkpointQueue: Promise<void> = Promise.resolve();

  constructor(databaseUrl: string, stateDir: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 8, application_name: 'warden-local-demo' });
    this.keyFile = join(stateDir, 'audit-chain.key');
    this.checkpointFile = join(stateDir, 'audit-chain-checkpoints.jsonl');
  }

  async initialize(): Promise<void> {
    mkdirSync(dirname(this.keyFile), { recursive: true });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS warden_company_state (
        state_key text PRIMARY KEY CHECK (state_key = 'northstar'),
        state jsonb NOT NULL,
        version bigint NOT NULL DEFAULT 1,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS warden_audit_chain (
        seq bigserial PRIMARY KEY,
        id uuid NOT NULL UNIQUE,
        recorded_at timestamptz NOT NULL,
        stream text NOT NULL CHECK (stream IN ('gateway', 'company', 'auth')),
        payload jsonb NOT NULL,
        previous_hash char(64) NOT NULL,
        hash char(64) NOT NULL UNIQUE
      );
      CREATE INDEX IF NOT EXISTS warden_audit_chain_recorded_at_idx ON warden_audit_chain(recorded_at DESC);
      ALTER TABLE warden_audit_chain DROP CONSTRAINT IF EXISTS warden_audit_chain_stream_check;
      ALTER TABLE warden_audit_chain ADD CONSTRAINT warden_audit_chain_stream_check CHECK (stream IN ('gateway', 'company', 'auth'));
      CREATE OR REPLACE FUNCTION warden_reject_audit_mutation() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'GuardSaaB audit chain is append-only'; END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS warden_audit_immutable ON warden_audit_chain;
      CREATE TRIGGER warden_audit_immutable BEFORE UPDATE OR DELETE ON warden_audit_chain
        FOR EACH ROW EXECUTE FUNCTION warden_reject_audit_mutation();
      CREATE TABLE IF NOT EXISTS warden_users (
        username text PRIMARY KEY, password_salt bytea NOT NULL, password_hash bytea NOT NULL,
        display_name text NOT NULL, role text NOT NULL CHECK (role IN ('Employee', 'HR', 'CEO')),
        employee_id text, active boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS warden_sessions (
        token_hash char(64) PRIMARY KEY, username text NOT NULL REFERENCES warden_users(username) ON DELETE CASCADE,
        site text NOT NULL CHECK (site IN ('company', 'warden')), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS warden_sessions_expiry_idx ON warden_sessions(expires_at);
    `);
    const count = await this.pool.query<{ count: string }>('SELECT count(*)::bigint AS count FROM warden_audit_chain');
    if (!existsSync(this.keyFile) && Number(count.rows[0]?.count ?? 0) > 0) throw new Error(`GuardSaaB audit key is missing at ${this.keyFile}; refusing to append to an unverifiable chain.`);
    if (!existsSync(this.keyFile)) writeFileSync(this.keyFile, randomBytes(32), { mode: 0o600, flag: 'wx' });
    this.key = readFileSync(this.keyFile);
    if (this.key.length !== 32) throw new Error(`Invalid GuardSaaB audit key at ${this.keyFile}; preserve it to verify existing records.`);
  }

  async close(): Promise<void> { await this.pool.end(); }

  async probe(): Promise<boolean> {
    await this.pool.query('SELECT 1');
    return true;
  }

  async seedAccounts(accounts: readonly AuthAccount[]): Promise<void> {
    const counts = { Employee: 0, HR: 0, CEO: 0 };
    const seen = new Set<string>();
    for (const account of accounts) {
      if (!account.username || account.username !== account.username.toLowerCase() || account.password.length < 14 || !account.displayName.trim()) throw new Error('Credentials must include a lowercase username, a 14+ character password, and a display name.');
      if (seen.has(account.username)) throw new Error(`Duplicate username in credentials.txt: ${account.username}`);
      seen.add(account.username); counts[account.role]++;
    }
    if (accounts.length !== 7 || counts.Employee !== 5 || counts.HR !== 1 || counts.CEO !== 1 || accounts.some((account) => account.role === 'Employee' && !account.employeeId)) throw new Error('credentials.txt must contain five employees, one HR account, and one CEO account with employee IDs for employees.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const account of accounts) {
        const salt = randomBytes(16);
        const passwordHash = scryptSync(account.password, salt, 64);
        await client.query(`INSERT INTO warden_users (username, password_salt, password_hash, display_name, role, employee_id, active, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, true, now())
          ON CONFLICT (username) DO UPDATE SET password_salt = EXCLUDED.password_salt, password_hash = EXCLUDED.password_hash,
          display_name = EXCLUDED.display_name, role = EXCLUDED.role, employee_id = EXCLUDED.employee_id, active = true, updated_at = now()`,
        [account.username, salt, passwordHash, account.displayName, account.role, account.employeeId ?? null]);
      }
      await client.query('UPDATE warden_users SET active = false WHERE username <> ALL($1::text[])', [accounts.map((account) => account.username)]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  async login(username: string, password: string, site: 'company' | 'warden'): Promise<{ token: string; user: AuthenticatedUser } | null> {
    const { rows } = await this.pool.query<{ username: string; password_salt: Buffer; password_hash: Buffer; display_name: string; role: AuthAccount['role']; employee_id: string | null; active: boolean }>('SELECT * FROM warden_users WHERE username = $1', [username.trim().toLowerCase()]);
    const record = rows[0];
    if (!record) { scryptSync(password, Buffer.alloc(16), 64); return null; }
    const submitted = scryptSync(password, record.password_salt, record.password_hash.length);
    if (!record.active || !timingSafeEqual(submitted, record.password_hash) || (site === 'warden' && record.role === 'Employee')) return null;
    const token = randomBytes(32).toString('base64url');
    await this.pool.query('DELETE FROM warden_sessions WHERE expires_at < now()');
    await this.pool.query("INSERT INTO warden_sessions (token_hash, username, site, expires_at) VALUES ($1, $2, $3, now() + interval '12 hours')", [this.tokenHash(token), record.username, site]);
    return { token, user: { username: record.username, displayName: record.display_name, role: record.role, ...(record.employee_id ? { employeeId: record.employee_id } : {}) } };
  }

  async session(token: string | null, site: 'company' | 'warden'): Promise<AuthenticatedUser | null> {
    if (!token) return null;
    const { rows } = await this.pool.query<{ username: string; display_name: string; role: AuthAccount['role']; employee_id: string | null }>(`SELECT u.username, u.display_name, u.role, u.employee_id
      FROM warden_sessions s JOIN warden_users u ON u.username = s.username
      WHERE s.token_hash = $1 AND s.site = $2 AND s.expires_at > now() AND u.active = true`, [this.tokenHash(token), site]);
    const record = rows[0];
    return record ? { username: record.username, displayName: record.display_name, role: record.role, ...(record.employee_id ? { employeeId: record.employee_id } : {}) } : null;
  }

  async logout(token: string | null, site: 'company' | 'warden'): Promise<void> {
    if (token) await this.pool.query('DELETE FROM warden_sessions WHERE token_hash = $1 AND site = $2', [this.tokenHash(token), site]);
  }

  private tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }

  async readCompanyState(): Promise<unknown | null> {
    const { rows } = await this.pool.query<{ state: unknown }>("SELECT state FROM warden_company_state WHERE state_key = 'northstar'");
    return rows[0]?.state ?? null;
  }

  /** Serialize full demo-state writes and their company events in one DB transaction. */
  async writeCompanyState(state: unknown): Promise<void> {
    const safeState = sanitizeAuditPayload(state);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.lockChain(client);
      const previous = await client.query<{ state: { events?: Array<{ id?: string }> } }>("SELECT state FROM warden_company_state WHERE state_key = 'northstar' FOR UPDATE");
      const existingIds = new Set((previous.rows[0]?.state?.events ?? []).map((event) => event.id).filter(Boolean));
      const events = (safeState as { events?: Array<{ id?: string; time?: number }> } | null)?.events ?? [];
      for (const event of events.filter((candidate) => candidate.id && !existingIds.has(candidate.id))) {
        await this.appendWithClient(client, 'company', sanitizeAuditPayload(event));
      }
      await client.query(`INSERT INTO warden_company_state (state_key, state, version, updated_at)
        VALUES ('northstar', $1::jsonb, 1, now())
        ON CONFLICT (state_key) DO UPDATE SET state = EXCLUDED.state, version = warden_company_state.version + 1, updated_at = now()`, [JSON.stringify(safeState)]);
      await client.query('COMMIT');
      if (events.some((candidate) => candidate.id && !existingIds.has(candidate.id))) await this.writeCheckpoint();
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  async appendGateway(payload: unknown): Promise<AuditChainRow> {
    return this.appendStream('gateway', payload);
  }

  async appendAuth(payload: unknown): Promise<AuditChainRow> {
    return this.appendStream('auth', payload);
  }

  private async appendStream(stream: AuditStream, payload: unknown): Promise<AuditChainRow> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.lockChain(client);
      const row = await this.appendWithClient(client, stream, payload);
      await client.query('COMMIT');
      await this.writeCheckpoint();
      return row;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  /** Seed the chain once from the previous append-only JSONL history on first DB-backed startup. */
  async importGatewayHistory(entries: readonly unknown[]): Promise<void> {
    if (!entries.length) return;
    const client = await this.pool.connect();
    let imported = false;
    try {
      await client.query('BEGIN');
      await this.lockChain(client);
      const existing = await client.query('SELECT 1 FROM warden_audit_chain LIMIT 1');
      if (existing.rowCount === 0) {
        for (const entry of entries) await this.appendWithClient(client, 'gateway', entry);
        imported = true;
      }
      await client.query('COMMIT');
      if (imported || (this.latestCheckpoint()?.seq ?? 0) < Number((await client.query('SELECT max(seq) AS seq FROM warden_audit_chain')).rows[0]?.seq ?? 0)) await this.writeCheckpoint();
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  async recent(): Promise<AuditChainRow[]> {
    const { rows } = await this.pool.query("SELECT seq, id, recorded_at AS \"recordedAt\", stream, payload, previous_hash AS \"previousHash\", hash FROM warden_audit_chain ORDER BY seq DESC");
    return rows.map((row) => ({ ...row, seq: Number(row.seq), hash: String(row.hash).trim(), previousHash: String(row.previousHash).trim() })) as AuditChainRow[];
  }

  async verify(): Promise<AuditChainStatus> {
    const checkedAt = new Date().toISOString();
    const all = await this.pool.query("SELECT seq, id, recorded_at AS \"recordedAt\", stream, payload, previous_hash AS \"previousHash\", hash FROM warden_audit_chain ORDER BY seq ASC");
    let previous = GENESIS;
    let count = 0;
    for (const raw of all.rows) {
      const row = { ...raw, seq: Number(raw.seq), hash: String(raw.hash).trim(), previousHash: String(raw.previousHash).trim() } as AuditChainRow;
      const expected = this.hashRow(row.seq, row.id, new Date(row.recordedAt).toISOString(), row.stream, row.payload, previous);
      if (row.seq !== count + 1 || row.previousHash !== previous || row.hash !== expected) {
        return { enabled: true, verified: false, count, headHash: previous, checkpointSeq: this.latestCheckpoint()?.seq ?? 0, checkedAt, error: `Audit chain mismatch at sequence ${row.seq}.` };
      }
      previous = row.hash;
      count++;
    }
    const checkpoint = this.latestCheckpoint();
    if (checkpoint && (checkpoint.seq > count || (checkpoint.seq > 0 && all.rows[checkpoint.seq - 1]?.hash?.trim() !== checkpoint.hash))) {
      return { enabled: true, verified: false, count, headHash: previous, checkpointSeq: checkpoint.seq, checkedAt, error: `Local checkpoint does not match database history at sequence ${checkpoint.seq}.` };
    }
    return { enabled: true, verified: true, count, headHash: count ? previous : null, checkpointSeq: checkpoint?.seq ?? 0, checkedAt };
  }

  async status(): Promise<AuditChainStatus> {
    return this.verify();
  }

  private async lockChain(client: PoolClient): Promise<void> { await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [LOCK_ID]); }

  private async appendWithClient(client: PoolClient, stream: AuditStream, payload: unknown): Promise<AuditChainRow> {
    const latest = await client.query<{ seq: string; hash: string }>('SELECT seq, hash FROM warden_audit_chain ORDER BY seq DESC LIMIT 1');
    const previousHash = latest.rows[0]?.hash.trim() ?? GENESIS;
    const seq = Number(latest.rows[0]?.seq ?? 0) + 1;
    const id = randomUUID();
    const recordedAt = new Date().toISOString();
    const hash = this.hashRow(seq, id, recordedAt, stream, payload, previousHash);
    const { rows } = await client.query('INSERT INTO warden_audit_chain (seq, id, recorded_at, stream, payload, previous_hash, hash) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) RETURNING seq', [seq, id, recordedAt, stream, JSON.stringify(payload), previousHash, hash]);
    return { seq: Number(rows[0].seq), id, recordedAt, stream, payload, previousHash, hash };
  }

  private hashRow(seq: number, id: string, recordedAt: string, stream: string, payload: unknown, previousHash: string): string {
    const canonical = JSON.stringify(stableValue({ seq, id, recordedAt, stream, payload, previousHash }));
    return createHmac('sha256', this.key).update(canonical).digest('hex');
  }

  private latestCheckpoint(): { seq: number; hash: string } | null {
    if (!existsSync(this.checkpointFile)) return null;
    let latest: { seq: number; hash: string; mac: string } | null = null;
    for (const line of readFileSync(this.checkpointFile, 'utf8').split('\n')) {
      try { const item = JSON.parse(line) as { seq: number; hash: string; mac: string }; if (this.validCheckpoint(item)) latest = item; } catch { /* ignore torn final record */ }
    }
    return latest ? { seq: latest.seq, hash: latest.hash } : null;
  }

  private validCheckpoint(item: { seq: number; hash: string; mac: string }): boolean {
    const mac = createHmac('sha256', this.key).update(`${item.seq}:${item.hash}`).digest('hex');
    return Number.isInteger(item.seq) && item.seq > 0 && /^[a-f0-9]{64}$/.test(item.hash) && mac === item.mac;
  }

  private async writeCheckpoint(): Promise<void> {
    const queued = this.checkpointQueue.then(() => this.appendCheckpoint());
    this.checkpointQueue = queued.catch(() => undefined);
    return queued;
  }

  private async appendCheckpoint(): Promise<void> {
    const { rows } = await this.pool.query('SELECT seq, hash FROM warden_audit_chain ORDER BY seq DESC LIMIT 1');
    if (!rows[0]) return;
    const seq = Number(rows[0].seq);
    const hash = String(rows[0].hash).trim();
    const mac = createHmac('sha256', this.key).update(`${seq}:${hash}`).digest('hex');
    appendFileSync(this.checkpointFile, JSON.stringify({ seq, hash, mac }) + '\n', { mode: 0o600 });
    const fd = openSync(this.checkpointFile, 'a');
    try { fsyncSync(fd); } finally { closeSync(fd); }
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  return value;
}
