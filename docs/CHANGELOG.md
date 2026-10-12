# Changelog

## 2026-10-11

- Cloned Cerberus (`Asati-git/ai-agent-firewall`, `078120b`) into `warden/` as the hackathon application base; preserved its separate Git history and Apache-2.0 notices.
- Installed root and dashboard dependencies; build and selected policy, adapter, audit, and local API smoke checks passed.
- Established initial product, architecture, security, repository research, integration, testing, roadmap, deployment, decision, limitation, and project-state documentation.
- No third-party source was copied into Warden-owned files; the app is an upstream clone.

## 2026-10-12

- Consolidated the GuardSaaB application, Northstar Works website, engine, rules, and legal notices into the root repository as normal tracked files under `warden/`.
- Preserved the local PostgreSQL/audit state, ignored credentials, and installed dependencies in the working copy; these remain excluded from Git.
- Updated the root README and repository context to describe the single-repository layout and launch path.
