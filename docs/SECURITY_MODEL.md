# Security model

**Status:** Implemented local controls with explicit same-machine trust boundaries. This document describes the application, not a penetration-test result or production approval. The code-level review is in [`SECURITY_REVIEW.md`](../SECURITY_REVIEW.md); operating procedures are in [`OPERATIONS.md`](../OPERATIONS.md).

## Assets and threats

Protected assets include source and developer data, credentials, agent capabilities, approval authority, policy versions, company personnel and account records, action evidence, and audit history. Relevant threats include manipulated agent/tool output, destructive commands, secret disclosure, unauthorized approval, stale adapter behavior, malformed requests, direct API calls, session replay, service/store outages, audit tampering, and denial of service.

## Implemented controls

- The engine and optional egress proxy bind to `127.0.0.1`. Browser endpoints use site-specific sessions, SameSite/HttpOnly cookies, loopback Origin checks, and login throttling.
- Agent hooks and the egress proxy fail closed by default; explicit `AG_FAIL_OPEN=1` and `FAIL_OPEN=1` overrides permit fail-open behavior.
- Authenticated company state is scoped by role. The server ignores employee-submitted salary, attendance, quota, account, and ledger edits; it validates fund-request identity and tier routing and derives credits on approval. PostgreSQL initialization failure stops configured DB mode instead of changing persistence mode silently.
- Rule YAML can be validated without starting the engine using `node bin/guardsaab.mjs rules validate --file <path>`. First-match priority is documented in `../POLICY_GUIDE.md`.
- Audit payloads are sanitized before persistence and again at export. PostgreSQL audit rows use HMAC-linked records, mutation-rejection triggers, and local signed checkpoints.
- Engine and proxy CLI processes handle SIGINT/SIGTERM and close active listeners; health is reported at `/health`.

## Trust boundaries and known gaps

A hook governs only tool events that its specific adapter observes before execution. Adapter versions and supported events differ; post-action events cannot undo completed work. The proxy only covers applications that route traffic through it. Direct APIs from another local process, alternate agents, child/background processes, native file-edit mechanisms, direct sockets, and host-level credentials may bypass controls. Loopback does not authenticate a process.

This prototype is intended for one local operator. Memory mode is volatile. PostgreSQL plus a signing key on the same host gives tamper evidence, not administrator-proof immutability. Windows filesystem ACLs have not been provisioned or audited. Client-supplied company activity descriptions are useful UI records but not authoritative proof. Company account credits are internal ledger changes and do not execute banking transfers. Secret-pattern redaction can miss unknown formats, and sanitized exports cannot independently recompute hashes over the original payloads.

## Required before network exposure or real records

Use narrow transactional domain endpoints instead of whole-state updates; use least-privilege service identity and explicit Windows ACLs; protect audit checkpoints independently; validate supported agent versions and coverage; add process-level authentication if same-user processes are adversarial; and deploy TLS, secure cookies, CSRF defenses, external identity, secrets management, backup/restore, retention, and monitoring. Never describe a local hook or hash chain as a sandbox or absolute immutability guarantee.
