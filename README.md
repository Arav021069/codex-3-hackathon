# GuardSaaB and Northstar Works

GuardSaaB (Software as a Blockade) is a local-first governance console for AI agents. The repository also contains Northstar Works, a company workspace with employee, HR, and CEO views and a local AI assistant.

Both websites, the shared engine, database setup, policies, documentation, and launch scripts are tracked together in this repository. The application source is in [`warden/`](warden/); this is a normal directory on the `main` branch, not a separate checkout or submodule. GuardSaaB is based on the Apache-2.0 licensed Cerberus AI Agent Firewall and retains its required notices in `warden/`.

## Project status

See [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) for the current state, [docs/ROADMAP.md](docs/ROADMAP.md) for milestones, [docs/BASE_REPOSITORY.md](docs/BASE_REPOSITORY.md) for the cloned codebase assessment, and [docs/INTEGRATION_MATRIX.md](docs/INTEGRATION_MATRIX.md) for coverage and limitations. Initial repository research is in [docs/REPOSITORY_RESEARCH.md](docs/REPOSITORY_RESEARCH.md).

## Quick start

On Windows, double-click [`start-demo.bat`](start-demo.bat) to start PostgreSQL, the GuardSaaB engine, and both websites. It opens the Northstar Works company site and GuardSaaB console on separate ports. Keep the service windows open while presenting. The private `warden/credentials.txt` file is required for sign-in and is intentionally excluded from Git.

For setup, accounts, and service details, follow [`warden/README.md`](warden/README.md). Run Git commands from this repository root. See [the base assessment](docs/BASE_REPOSITORY.md) for inherited components and limitations.

Research notes and the isolated Codex hook prototype remain under `docs/`, `examples/`, and `tests/`; they are not loaded by the application.

## Product principles

- Safe autonomy: routine compliant actions may proceed; mandatory prohibitions cannot be overridden by risk scoring or approval.
- Enforcement at the supported execution boundary, not an agent-facing warning alone.
- Explain intended, predicted, and observed effects separately.
- Record enough linked events to reconstruct a decision lifecycle while minimizing sensitive data.
- State integration gaps and bypass paths plainly; a hook is not an operating-system sandbox.

## Documentation

Start with [the product specification](docs/PRODUCT_SPEC.md), [architecture](docs/ARCHITECTURE.md), [security model](docs/SECURITY_MODEL.md), and [known limitations](docs/KNOWN_LIMITATIONS.md). Project documents are planning evidence, not proof that the described controls exist.
