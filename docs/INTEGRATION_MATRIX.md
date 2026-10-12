# Integration matrix

The selected Cerberus clone includes adapters for several agents. They are available in `warden/` but have not yet been qualified as Warden-supported integrations. See its README and source for current adapter claims.

| Agent | Candidate upstream evidence | Proposed priority | Coverage questions before support |
|---|---|---|---|
| Claude Code | Reflex, Cerberus, Claude Warden expose hook approaches in source/docs | Candidate 1 for spike, pending versioned test harness | PreToolUse action types, ask/deny result contract, timeout semantics, post-tool result, file/MCP/subagent coverage, child processes, platform support |
| Codex CLI | Installed `0.158.0-alpha.2.1`; Cerberus source has a Codex adapter. Official docs define PreToolUse denial. | Available in clone; pending Warden end-to-end qualification | Cerberus documents dashboard/socket holds because native `ask` is unavailable. Test exact version, timeout/failure handling, dashboard disconnect, and approval identity. Hook callback errors/timeouts/malformed responses may fail open at agent level. |
| Cursor | Cerberus adapter and hook docs | Later | Exact supported hook lifecycle and deny/ask enforcement per version |
| Other compatible agents | None assessed | Deferred | Must provide supported interception contract and reproducible tests |

## Adapter contract proposal

Each adapter must document supported versions; hook events; normalized action fields; pre-execution response mapping; approval and denial behavior; timeout/error mapping; post-execution evidence; supported platforms; direct and nested execution gaps; and uninstall/upgrade procedure. CI fixtures should validate captured hook payloads against real supported versions. A configuration file alone does not prove interception.

Current references: [Codex hooks documentation](https://developers.openai.com/codex/hooks) and [Claude Code hooks reference](https://code.claude.com/docs/en/hooks). These specifications can change; verify behavior against the installed CLI release before support claims.

## First-agent selection and current prototype

Codex is installed locally and the clone contains a Codex adapter. Official documentation says `PreToolUse` deny is supported but `ask` is not; the project routes held calls through a dashboard/socket wait. Actual CLI-mediated behavior still needs verification on the installed version. Claude Code is not installed locally.
