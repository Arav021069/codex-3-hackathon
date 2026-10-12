# GuardSaaB

**Software as a Blockade.** GuardSaaB is a local-first control plane for AI agent actions, with policy decisions, human approvals, activity logs, session review, and a separate Northstar Works company workspace for the live HR and finance scenario.

## Run locally

### Requirements

- Node.js 20+ and npm
- Docker Desktop with PostgreSQL support for persistent local records
- Ollama and a downloaded model for Zeo's local language-model responses

```powershell
npm install
npm --prefix dashboard install
npm run build
npm run db:up
npm run engine:local
```

In separate terminals, start the frontends:

```powershell
npm run dev:company   # http://127.0.0.1:5173
npm run dev:guardsaab # http://127.0.0.1:5174
```

The engine binds to `127.0.0.1:9000`. PostgreSQL runs on `127.0.0.1:54329`. The two clients share company records, employee requests, approvals, and the local audit store through the engine. `npm run engine` starts the memory-backed development mode; it does not provide PostgreSQL persistence.

The seven local accounts are read from the ignored `credentials.txt` file. Keep it private and do not commit it. Ollama defaults to `http://127.0.0.1:11434`; configure `GUARDSAAB_OLLAMA_URL` to use another loopback HTTP endpoint. For account and model setup, use the local operator notes in [OPERATIONS.md](OPERATIONS.md).

## Walkthrough

1. Sign in to Northstar Works as an employee and ask Zeo for an allowed amount or a request requiring HR review.
2. Follow the policy result in the employee request list and the GuardSaaB **Approvals** or **Activity logs** view.
3. Sign in to GuardSaaB as HR or CEO, review the request, and approve or reject it.
4. Confirm approved funds are added to the employee's simulated company ledger and the activity is recorded.
5. Use the **Agents**, **Policies**, **Sessions**, and **Activity logs** areas to explore gateway governance.

Use only the synthetic Northstar Works records provided for the presentation. Account credits are ledger entries; no external bank or payroll service is connected.

## Policy, audit, and operations

- [Policy authoring and validation](POLICY_GUIDE.md)
- [Audit storage, export, recovery, and rotation](OPERATIONS.md)
- [Security boundary review and tested fixes](SECURITY_REVIEW.md)
- [Presentation walkthrough](JURY_DEMO_GUIDE.md)
- [Change context](CONTEXT_CHANGES.md)

Validate policy files and build the application:

```powershell
node bin/guardsaab.mjs rules validate
npm run typecheck
npm run build
```

Selected automated checks:

```powershell
npm run test:policy-validation
npm run test:audit-sanitize
npm run test:postgres-audit
npm run test:regression
```

The PostgreSQL audit integration check requires a reachable database configured with `GUARDSAAB_TEST_DATABASE_URL`. The previous `WARDEN_TEST_DATABASE_URL` name remains accepted for compatibility. The GitHub Actions workflow provisions PostgreSQL for this check.

## Project identity and notices

GuardSaaB is the product name used by the interfaces, setup commands, and current project documentation. Existing local storage and database identifiers retain compatibility names so an operator can keep existing records when upgrading. The repository includes third-party code and retains its applicable license, copyright, and notice files. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); those legal notices are part of the source distribution.

The product builds on inherited agent gateway and policy components and adds the GuardSaaB presentation, Northstar Works workspace, Zeo integration, role-scoped approval flow, PostgreSQL-backed company state, audit sanitization, and audit-chain storage. The included security review describes its limits; this prototype is not a bank, payroll provider, identity service, or production security guarantee.
