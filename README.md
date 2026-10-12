# Warden

Warden is a local-first control layer for coding agents. It evaluates supported actions before execution, applies policy and approval decisions, and records outcomes for review.

The application lives in the separate Git clone at [`warden/`](warden/). It is based on the Apache-2.0 licensed Cerberus AI Agent Firewall, which provides the interception engine, agent adapters, policies, approval paths, audit timelines, and dashboard. Its upstream Git history and legal notices are retained; run Git commands for the application from that directory. Warden research and product planning remain in this parent workspace.

## Project status

See [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) for the current state, [docs/ROADMAP.md](docs/ROADMAP.md) for milestones, [docs/BASE_REPOSITORY.md](docs/BASE_REPOSITORY.md) for the cloned codebase assessment, and [docs/INTEGRATION_MATRIX.md](docs/INTEGRATION_MATRIX.md) for coverage and limitations. Initial repository research is in [docs/REPOSITORY_RESEARCH.md](docs/REPOSITORY_RESEARCH.md).

## Quick start

On Windows, double-click [`start-demo.bat`](start-demo.bat) to start PostgreSQL, the GuardSaaB engine, and both websites, then open the company and governance pages. Keep the service windows open during the presentation. The private `warden/credentials.txt` file is required for sign-in and is not included in Git.

For the app, follow [`warden/README.md`](warden/README.md). In this environment its dependencies are installed, the engine and dashboard builds passed, and the policy, adapter, and audit suites passed. See [the base assessment](docs/BASE_REPOSITORY.md) for exact commands and limitations.

The parent workspace also retains an isolated Codex hook prototype and tests as research artifacts; it is not the selected app or auto-loaded.

## Product principles

- Safe autonomy: routine compliant actions may proceed; mandatory prohibitions cannot be overridden by risk scoring or approval.
- Enforcement at the supported execution boundary, not an agent-facing warning alone.
- Explain intended, predicted, and observed effects separately.
- Record enough linked events to reconstruct a decision lifecycle while minimizing sensitive data.
- State integration gaps and bypass paths plainly; a hook is not an operating-system sandbox.

## Documentation

Start with [the product specification](docs/PRODUCT_SPEC.md), [architecture](docs/ARCHITECTURE.md), [security model](docs/SECURITY_MODEL.md), and [known limitations](docs/KNOWN_LIMITATIONS.md). Project documents are planning evidence, not proof that the described controls exist.
