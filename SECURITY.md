# Security policy

## Reporting a vulnerability

Please avoid posting exploitable vulnerabilities or secret material in a public issue. Use the private vulnerability reporting feature on the repository if it is enabled; otherwise contact the repository owner privately through GitHub.

Include the affected version or commit, deployment mode, reproduction steps, and impact. Do not include real employee data, credentials, audit signing keys, or database backups in a report.

## Scope

GuardSaaB evaluates supported agent actions at configured integration boundaries. Coverage depends on the adapter and execution path in use. A process can bypass controls by using an unconfigured tool path or changing the local machine, database, or engine. The application is a local presentation prototype; its simulated company ledger is not banking or payroll infrastructure. Review [SECURITY_REVIEW.md](SECURITY_REVIEW.md) and [OPERATIONS.md](OPERATIONS.md) before exposing any service beyond loopback.
