# Feature matrix

Legend: **Verified** means source was inspected in the candidate snapshot, not that GuardSaaB has qualified the feature. **Partial** means a narrower mechanism or documented limitation exists. **Missing/unverified** means no evidence sufficient for a positive claim. The selected base contains implementation code, but GuardSaaB qualification is pending.

| Capability | Cerberus | Reflex | Claude Warden | srjn45/warden | GuardSaaB status/source to evaluate |
|---|---|---|---|---|---|
| Pre-execution command interception | Verified in server/hook path | Verified in hook/gate modules | Verified/documented PreToolUse | Missing as per-action governance | Present in clone; GuardSaaB qualification pending |
| Shell parsing | Partial; inspect actual parsers before relying | Partial custom lexical shell analysis | AST claim via bash-parser | Missing/unverified | Missing; required |
| Effect explanation | Partial risk factors/reasons | Partial command/context reasons | Partial rule reasons | Missing | Missing; distinguish intent/prediction/observation |
| Contextual risk | Verified rule/anomaly/content pipeline | Verified context-aware policies in docs/source | Partial command rules | Partial process/fleet context | Missing |
| Human approval | Verified pending hold/native ask paths | Verified queue/agent-dependent asks | Partial ask; Codex limitations | Orchestration approvals, not necessarily action approval | Missing; required |
| Agent integrations | Verified adapters claimed: Claude/Codex/Cursor/Cline | Verified setup/hooks for documented agents | Verified hooks; version limitations | Agent process backends | Missing; first agent TBD pending reliability criterion |
| Policy management | Verified data-driven rules | Verified policy modules/files | Verified configurable rules | Not governance policy | Missing |
| File-operation visibility | Partial; depends on intercepted tool | Explicit gaps by agent/tool path | Partial | Worktree visibility only | Missing |
| API/MCP governance | Partial implementation/docs; verify each path | Partial MCP hooks, agent-dependent | Missing/partial | MCP orchestration tools | Missing |
| Session timeline | Verified projections/dashboard | Verified audit/report/replay | Partial | Verified agent activity UI | Present in clone; inspect persistence/recovery |
| Replay | Verified timeline replay surface | Verified replay module | Partial/unknown | Historical agent records, not decision replay | Missing |
| Audit trail | Verified local event append path | Verified local audit/export | Partial hook records | Verified append-only file for daemon actions | Present in clone; no immutability claim |
| Agent registry | Partial adapter/agent settings | Partial configured agents | Missing/partial | Verified backend/fleet registry | Missing |
| Emergency controls | Partial freeze/pending controls; inspect process termination | Partial freeze/block future actions | Partial | Verified orchestration stop/kill switch | Missing |
| Multi-user authorization | Missing/unverified local approval is not team auth | Partial team policy; not full central auth | Missing/unverified | Partial local operator controls | Missing |
| Install/deploy | Node local engine/dashboard | Node hooks; installer limitations | Node package/hooks | Go daemon/service; checkout issue | Missing |
| License | Apache-2.0 + NOTICE | MIT | MIT | Apache-2.0 per GitHub | No third-party code imported |
| Production suitability | Unverified; prototype snapshot | Unverified; local hook tool | Unverified; hook coverage limitations | Not a governance product | Not assessable |

Source pointers and classification rationale: [repository research](REPOSITORY_RESEARCH.md). Recheck exact upstream snapshots and agent versions before adoption.
