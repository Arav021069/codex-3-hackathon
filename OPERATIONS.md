# Local operations

## Startup and health

Start PostgreSQL, then the engine and the two frontends:

```powershell
npm run db:up
npm run engine:local
npm run dev:company
npm run dev:guardsaab
```

The engine listens on `127.0.0.1:9000`; company and GuardSaaB frontends use ports 5173 and 5174. `GET http://127.0.0.1:9000/health` reports readiness, uptime, pending approvals, policy load, classifier, endpoints, audit storage backend, and a context-specific `recovery` message. If PostgreSQL becomes unavailable after startup, health reports HTTP 503 and `auditStorage: unavailable`; restore PostgreSQL and restart the engine. If configured PostgreSQL cannot initialize, the engine exits with an error instead of switching stores. Memory mode is not a substitute for PostgreSQL persistence.

## Graceful shutdown and recovery

Stop each process with Ctrl+C or a SIGTERM. The CLI stops accepting new engine requests, closes WebSocket clients, waits for the HTTP server to close, and closes the audit-store pool. If shutdown is interrupted, restart PostgreSQL and the engine, then inspect `/health` and GuardSaaB **Activity logs**. Do not delete the signing key or checkpoint journal to clear a verification failure. Preserve the existing `.cerberus/` local state directory (retained for upgrade compatibility), database volume, and `credentials.txt`; restore them from a matching backup, or retain the failed state for investigation. If the audit key is missing while rows exist, startup intentionally stops rather than creating a replacement chain.

For login failures, confirm the account is active in PostgreSQL, use the username from the local credential file, and wait for the login throttle to expire. For a missing approval, refresh the GuardSaaB queue after confirming employee and GuardSaaB clients use the same engine port and PostgreSQL database. For an unavailable local assistant, check that Ollama is running on loopback and has at least one model installed; company records and existing requests remain accessible without it.

## Audit storage and export

In PostgreSQL mode, company state and audit rows persist in the `guardsaab_demo` database. Audit rows are serialized by a database advisory lock, linked with HMAC-SHA-256, and protected from update/delete by triggers. The HMAC key and signed checkpoint journal are local files in `.cerberus/`. These measures expose accidental or limited tampering; an administrator controlling both the database and local key can rewrite history. Keep encrypted, access-controlled backups of PostgreSQL, `.cerberus/audit-chain.key`, and `audit-chain-checkpoints.jsonl` together. Keep a separate copy of checkpoints off the host for independent comparison.

Use **Activity logs → Export sanitized audit** to download a JSON export. Secret-like fields and common token patterns are redacted. Exported payloads may differ from the original payloads, so the original row hashes cannot be recomputed from the sanitized export. Verify the original chain in GuardSaaB against the local PostgreSQL store before export when integrity review is needed. Do not export or share the signing key.

## Rotation and retention

There is no automatic rotation or retention purge for PostgreSQL audit rows or checkpoint JSONL. Keep the audit chain intact if continuity matters. For the JSONL audit file, stop the engine before moving `audit.jsonl`; archive it with a dated name and restrictive ACLs, then restart with the intended `AUDIT` path. In PostgreSQL mode, the database chain remains continuous while the JSONL file is archived. In memory-only mode, the JSONL file is the durable event history and must be retained. Do not rotate, truncate, or replace `.cerberus/audit-chain-checkpoints.jsonl` or `audit-chain.key` independently. Back up before maintenance and run **Verify chain** after restore.

## Local permissions

The app binds to loopback and is intended to run under a dedicated local user. The audit key is created with restrictive POSIX mode where supported; Windows relies on the current account ACL. Restrict `.cerberus/`, PostgreSQL data, and ignored `credentials.txt` to the operator account. Avoid shared Windows sessions and do not expose ports through firewall rules, tunnels, containers, or reverse proxies without a separate deployment security review.
