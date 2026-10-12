# Testing plan

The parent workspace has a Python `unittest` hook spike (`python -m unittest discover -s tests -v`); it does not invoke Codex. The selected app is in `warden/` and currently provides upstream checks, including `npm run build`, `npm run test:policy`, `npm run test:adapters`, and `npm run test:audit`. These passed at the cloned revision; they are baseline tests, not proof of production security.

## Required layers

- **Policy unit tests:** precedence, allow/ask/block, mandatory deny, missing policy, context mismatch, deterministic explanation fields.
- **Adapter contract tests:** captured supported-version payloads, malformed/missing fields, response shape, timeout, nonzero hook failure, action coverage.
- **Approval lifecycle tests:** authorized/unauthorized approver, expiry, replay, changed action/context/policy, concurrent resolution, duplicate requests.
- **Audit tests:** ordering, duplicate IDs, missing sequence, restart/recovery, redaction, event-to-timeline reconstruction, export consistency.
- **Adversarial command tests:** chaining, pipelines, redirections, quoting/escaping, substitutions, nested shells, wrappers, downloaded scripts, privilege escalation, Git force/destruction, cloud deletion.
- **Boundary/failure tests:** service/store outage, disconnected dashboard, direct bypass documentation, child process, repeated requests, interrupted execution.
- **UI tests:** pending, allow, deny, failure, and outcome state sourced from service; accessible approval flow; never frontend-only authorization.

Initial required command categories include safe read, ordinary write, protected file read, destructive delete, production mutation, modified-after-approval action, and unavailable enforcement. Tests must use isolated fixtures, never real production infrastructure.

## Release checks

Run format/lint/type checks, unit and adapter contract suites, integration tests with pinned agent versions or fixtures, dependency/license audit, and a documented manual smoke flow. Do not report security completeness from a successful build alone. Exact commands will be added with the first implementation.
