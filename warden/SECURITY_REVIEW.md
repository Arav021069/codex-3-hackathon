# Security boundary review

Reviewed 12 October 2026 against the checked-in engine, hooks, adapters, proxy, and local PostgreSQL implementation. This is a code review of this checkout, not a penetration test or certification.

## Summary

GuardSaaB is a same-machine development and evaluation system. Engine and proxy listeners bind to IPv4 loopback. Hook and proxy decisions fail closed by default; fail-open is an explicit environment override. Browser-facing state and audit routes require a site session and validate Origin. Database-backed audit rows are append-only to the application role and HMAC-linked. These controls provide useful local enforcement and tamper evidence, but do not protect against a user with control of the Windows account, process, database owner, or signing key.

## Findings and changes

| Area | Current behavior | Boundary / residual risk |
|---|---|---|
| Hook adapters | Claude Code, Codex, Cursor, and Cline have format adapters. The shared hook evaluates supported pre-action events. | Adapter schemas and event coverage vary by host and version. Cursor before-read, after-edit, and stop events are not all enforced as pre-action gates; post-action inspection cannot undo an action. Keep vendor versions pinned and verify each integration after upgrades. |
| Hook failure mode | Engine unreachable fails closed by default; `AG_FAIL_OPEN=1` opts into allow-on-error. | Fail-open defeats policy during engine outage and must only be used for a deliberate availability tradeoff. |
| Egress proxy | HTTP CONNECT and optional MITM paths ask the engine; `FAIL_OPEN` defaults false. Response inspection is capped (default 8 MiB); larger bodies stream without content scanning. | Proxy coverage applies only to traffic explicitly routed through it. Direct sockets, alternate proxies, and unconfigured applications bypass it. MITM is opt-in and requires local trust of its CA. |
| Engine/API exposure | Engine and proxy bind `127.0.0.1`. Browser-originated `/intercept`, `/inspect`, `/session`, approvals, and company/audit routes require a site session and accept only loopback Origins. Hook/CLI endpoints accept no-Origin requests for local integrations. | A same-user local process can omit Origin and call hook routes directly. Loopback is not a process identity boundary. Do not port-forward or bind to LAN without authentication, TLS, CSRF review, and deployment hardening. |
| Company-state writes | The endpoint still receives full-state browser payloads, but merges them against server-owned state. Employee-supplied salary, attendance, quota, account, ledger rows, and activity events are ignored. New fund requests are bound to the signed-in employee and threshold/status routing; approvals enforce HR/CEO scope, then the server derives balance, ledger mutations, and audit events from accepted state transitions. | The bulk-state API should be replaced with narrow transactional domain endpoints before production. Existing activity events from earlier versions are not retroactively authenticated; retain them as legacy history. No company balance connects to banking. |
| Policy regex validation | Candidate rules are parsed offline; regexes must compile, are capped at 4096 characters, and common nested-repetition forms are rejected by the shared compiler. | JavaScript regex has no execution timeout. The static guard is best-effort, not a proof against all expensive expressions; test long inputs and keep patterns simple. |
| Authentication | Separate company/GuardSaaB cookie names, password hashing in PostgreSQL, login throttling, HttpOnly and SameSite cookies. | Memory fallback compares process-local credentials; loopback HTTP cookies cannot use `Secure`. No MFA, identity provider, password rotation UI, or privileged OS service account is configured. |
| PostgreSQL/audit | PostgreSQL storage is optional; health reports actual audit backend. Audit rows have update/delete triggers, an HMAC chain, and local checkpoint file/key. | Database owner can disable triggers or rewrite rows. Local key and database on one device do not provide independent trust. Checkpoint files require external backup for stronger evidence. |
| Secrets | New audit writes sanitize structured credentials and common token patterns; export applies redaction again. | Pattern redaction cannot guarantee detection of every secret format. Sanitized exports intentionally alter payloads and therefore their original row hashes are not independently verifiable from the export alone. |
| Process permissions | State and key are stored beneath `.cerberus/`; key creation requests mode `0600`. | Windows ACL behavior is inherited from the current user and has not been explicitly provisioned or audited. Any process running as that user can read/replace local files. |

## Fail-open / fail-closed matrix

| Component | Default on engine/service failure | Override |
|---|---|---|
| Agent hook | Fail closed (deny or ask the agent to retry, depending on adapter) | `AG_FAIL_OPEN=1` |
| Network proxy | Fail closed with an error response | `FAIL_OPEN=1` |
| Company UI state sync | Keeps its last browser state when API is unavailable | No safe authoritative write fallback; restart PostgreSQL/engine and reload |
| PostgreSQL | Engine may run in memory-only mode when no database URL is configured; a configured DB initialization failure now stops startup instead of silently switching storage | Use `npm run engine:local` and inspect `/health` |

## Required follow-up before real company records

1. Replace bulk client-state writes with narrow authenticated request, approval, bonus, and ledger commands. Apply policy, balance/quota checks, state changes, and audit append in one database transaction; retain the authorization regression cases while doing so.
2. Run the service under a dedicated least-privilege OS account, set and verify Windows ACLs for `.cerberus/` and `credentials.txt`, and keep signing checkpoints off-host.
3. Add authenticated local API tokens for hook clients if hostile same-user processes are in scope; otherwise document the same-user trust boundary.
4. Verify hook coverage against supported agent versions, and add CI contract fixtures for every adapter and every event that claims pre-execution enforcement.
5. Add proxy bypass telemetry and decide whether oversized response bodies should be blocked, sampled, or explicitly accepted unscanned.
6. Use TLS, secure cookies, CSRF defenses, external identity, secrets management, backups, and operational monitoring before any network-accessible or production deployment.

## Local verification

The repository suites exercise policy outcomes, adapters, expiry/replay behavior, malformed requests, audit secret redaction, and employee self-credit prevention. CI also starts PostgreSQL and verifies audit persistence, sanitization, chain validation, and update/delete triggers with `npm run test:postgres-audit`. These checks do not establish OS isolation, full adapter coverage, resistance to a local administrator, or database-owner immutability. See `npm run test:regression`, `npm run test:audit-sanitize`, `npm run test:policy-validation`, and the inherited adapter suite.
