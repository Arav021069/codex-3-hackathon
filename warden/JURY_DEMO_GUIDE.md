# GuardSaaB presentation walkthrough

## Before presenting

1. Follow [README.md](README.md) to start PostgreSQL, the engine, and both frontends.
2. Confirm that Ollama is connected if you plan to show live model responses from Zeo.
3. Keep the synthetic Northstar Works employee and HR credentials local in `credentials.txt`.
4. Open the company client at `http://127.0.0.1:5173` and GuardSaaB at `http://127.0.0.1:5174`.

## Five-minute walkthrough

### 1. Employee workspace

Sign in as an employee. Show attendance, leave balance, salary, bonus history, and the simulated account balance. Ask Zeo a personal question such as “How many leaves do I have left?” to demonstrate role-scoped company data.

### 2. Fund request and policy decision

Ask Zeo to request ₹75,000 for a company purpose. The agent attempts to prepare the credit, but the configured limit blocks direct execution and routes the request for HR review. Show the request and policy event on the GuardSaaB side.

### 3. Human review and credit

Sign in as HR, inspect the request, and approve or reject it. On approval, confirm the simulated employee ledger balance and activity update. Explain that the ledger is local application state; it does not initiate an external bank transfer.

### 4. Governance views

Show the Agents registry, approval queue, activity log, policy view, and session review. Use a harmless policy scenario to show the decision pipeline. Never execute a destructive command to demonstrate that it is blocked.

### 5. Close with boundaries

Explain that local policy and the audit chain operate at the configured gateway boundary. Coverage does not include unconfigured adapters or alternate execution paths, and local administrators can alter local files and the database. The detailed [security review](SECURITY_REVIEW.md) and [operations guide](OPERATIONS.md) document these constraints.

## If the live setup fails

- If Ollama is unavailable, explain that Zeo requires the configured local model and show the persisted request screens instead.
- If no request appears, confirm both frontends use the same running engine and PostgreSQL instance.
- If approval does not update the ledger, stop the walkthrough and describe the failure rather than presenting stale state as live.
- If the gateway is disconnected, do not claim that a displayed policy event is a live interception.
