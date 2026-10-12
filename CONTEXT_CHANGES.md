# GuardSaaB implementation status

Updated 12 October 2026. This file records implemented behavior and known limits for the current checkout; it is not a security certification.

## Inherited and GuardSaaB-specific work

The repository retains the upstream GuardSaaB `LICENSE`, `NOTICE`, upstream history, and third-party notices. GuardSaaB provides the gateway/policy engine, CLI, hook and egress proxy, agent adapters, risk signals, session projection, and inherited tests. GuardSaaB-specific additions include the Northstar Works company workspace, Zeo local Ollama bridge, local employee/HR/CEO authentication, scoped workspace views, approval and account ledger UI, PostgreSQL persistence, HMAC-linked audit chain, sanitized export, operations UI, and policy/security/operations documentation. Details are in [README.md](README.md), [SECURITY_REVIEW.md](SECURITY_REVIEW.md), and [OPERATIONS.md](OPERATIONS.md).

## Current security behavior

- Engine and proxy bind to IPv4 loopback. Browser routes use session cookies and Origin checks; local hook/CLI callers use the no-Origin path.
- Hook and proxy fail closed by default. `AG_FAIL_OPEN=1` and `FAIL_OPEN=1` opt into bypassing enforcement on engine failure.
- Agent event coverage is adapter and version dependent. The proxy only sees traffic routed through it; direct sockets and unsupported hooks remain bypasses.
- PostgreSQL mode refuses to start if configured storage cannot initialize. Without a database URL, memory mode is explicit in `/health` and is not durable.
- Company writes now ignore employee-supplied salary, attendance, quota, account, and ledger fields. Employee requests must match their identity and configured threshold/status routing; approvals update balances and ledger server-side. HR and CEO can increase scoped bonus records. Client activity descriptions are still supplied by browser clients and must not be treated as authoritative proof of a security decision.
- Audit writes sanitize common secret patterns and sensitive field names. PostgreSQL audit rows are HMAC-linked and protected by update/delete triggers, plus a local checkpoint journal. This is tamper evidence, not protection from a database owner or host administrator. Sanitized exports change payloads and cannot independently reproduce original payload hashes.

## Verification added

`scripts/validate-policy.test.ts` covers safe validation, priority order, malformed regex, duplicate rule IDs, and the bundled policy. `scripts/audit-sanitize.test.ts` covers structured secrets and sanitized exports. `scripts/regression.test.ts` covers structured health, allow/audit/review/block, malformed requests, session timeline replay, expired approval replay, audit redaction, and company ledger authorization against employee self-credit and forged ledger submissions. Run:

```bash
npm run build
npm run test:policy-validation
npm run test:audit-sanitize
npm run test:regression
```

These checks do not establish complete adapter coverage, OS-level process isolation, production-grade authentication, or immutability against an administrator. See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for remaining findings.
