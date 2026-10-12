# Project state

**As of:** 2026-10-11

## Current implementation

The workspace contains Warden planning documents, an isolated Codex hook prototype, and the selected app in `warden/`. The app is an upstream Cerberus clone with preserved Git history and legal notices; its dashboard now uses Warden branding and a custom sentinel mark. The engine builds and selected policy, adapter, and audit suites pass. The inherited engine has not been fully reviewed or qualified for production.

## Selected application base

`warden/` is a separate Git clone of `Asati-git/ai-agent-firewall` at `078120b` (Apache-2.0; retain LICENSE, NOTICE, and third-party notices). Root and dashboard dependencies installed, the build succeeded, 67 selected upstream checks passed, and a local API smoke check succeeded. Details and limitations are in [BASE_REPOSITORY.md](BASE_REPOSITORY.md).

## Research snapshot

Four specified repositories were shallow-cloned for read-only source inspection in the temporary directory `warden-research`. Cerberus, Reflex, and Claude Warden source and license files were inspectable. The `srjn45/warden` checkout had a broken branch/ref and could not be locally inspected; GitHub docs identify it as an Apache-2.0 orchestration product. See [REPOSITORY_RESEARCH.md](REPOSITORY_RESEARCH.md) for details and classifications. No third-party code was copied.

## Prototype

The installed Codex CLI is `0.158.0-alpha.2.1`; `codex features list` reports hooks enabled. Claude Code is not installed. `scripts/warden_codex_hook.py` handles only Bash, denies a small set of known high-impact textual patterns, abstains on other nonempty commands, and writes a JSONL record containing a command hash rather than raw command text. The example hook config is deliberately not auto-loaded. Codex's documented `ask` behavior is unsupported for PreToolUse, and hook errors/timeouts can fail open.

## Decisions and next work

The next recommended task is to launch the app using its README, wire the agent used in the demo, verify one harmless allow and one harmless policy block end to end, then inspect dashboard approval behavior while preserving upstream notices and history.

## Verification performed

- Inspected the initially empty workspace and shallow-cloned candidate repositories for research.
- Shallow-cloned candidate repositories and inspected selected source modules, license headers, and docs.
- Clone: rules validation passed; `npm run build` passed; `test:policy` 31, `test:adapters` 22, and `test:audit` 14 passed.
- Clone local API smoke: health OK, safe Read allowed, destructive command decision blocked without execution; temporary server stopped.
- Parent prototype: Python `unittest` passed 5 tests; it is not the selected enforcement implementation.

## Open questions

No blocking product decision is required before the hook spike. The initial agent and precise deployment stack should be chosen from measured compatibility rather than assumed in advance.
