# GuardSaaB repository context

Updated 12 October 2026. This file supersedes earlier feature and test-count claims below the current checkout; read implementation and test results as the source of truth.

## Repositories

The application is tracked in the repository root as part of this repository. GuardSaaB is based on the Apache-2.0 licensed Cerberus AI Agent Firewall. Upstream attribution and notices are retained there. Product behavior and verified limits are documented in [`../README.md`](../README.md), [`../SECURITY_REVIEW.md`](../SECURITY_REVIEW.md), and [`../OPERATIONS.md`](../OPERATIONS.md).

## Current application capabilities

- Distinct Northstar Works employee/HR/CEO company workspace and GuardSaaB HR/CEO governance interface.
- Local username/password accounts for five employees, one HR account, and one CEO account; local passwords are in the ignored `credentials.txt` file.
- Local Ollama bridge for Zeo and company fund requests, with rule-based company answers available when Ollama is unavailable.
- PostgreSQL-backed company state, sessions, and audit rows in local mode. If configured PostgreSQL cannot initialize, the engine refuses startup rather than silently choosing volatile state.
- Server-side company state merge protects salary, attendance, quota, account, and ledger fields from employee payloads. Requests are identity/tier checked, and approvals derive account credits on the server. Client-provided activity descriptions remain non-authoritative.
- Audit event secret sanitization, HMAC-linked PostgreSQL chain, mutation-rejection trigger, local checkpoint file, verification UI, and sanitized JSON export.
- Engine health endpoint, SIGINT/SIGTERM shutdown handling, policy-file validator, and focused regression suites.

## Security limits

This remains a local, single-operator prototype. Loopback is not process authentication; hooks and proxy only cover configured and supported paths; adapter coverage varies; fail-open overrides exist; audit controls are tamper-evident rather than administrator-proof; Windows ACLs require operator configuration; and the company ledger is not connected to any bank. Client-supplied activity text cannot be treated as a trusted authorization record. The full boundary review and follow-up list are in `../SECURITY_REVIEW.md`.

## Verification

The application build and regression checks are run from the repository root within this repository:

```powershell
npm run build
npm run test:policy-validation
npm run test:audit-sanitize
npm run test:regression
```

The regression suite covers structured health, allow, audit, review, block, malformed input, replayed expired approval, session timeline replay, secret redaction, and employee self-credit/forged-ledger attempts. Passing these tests is not a full security assessment. Earlier drafts in this workspace contain stale personas, feature descriptions, and test counts; consult the above live files for current behavior.
