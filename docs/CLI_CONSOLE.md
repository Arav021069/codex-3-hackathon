# GuardSaaB Terminal Console

The terminal console is a local, keyboard-first companion to the GuardSaaB governance website. It uses the same engine APIs and policy decisions as the dashboard; it does not bypass the gateway or execute simulated commands.

## Start

Start the engine in one terminal:

```bash
npm run engine
```

Open the interactive console in a second terminal:

```bash
npx tsx src/cli/index.ts console
```

For a packaged installation, use:

```bash
guardsaab console
```

The engine is local-only by default at `127.0.0.1:9000`. Configure another loopback endpoint with `CB_ENGINE_HOST` and `CB_ENGINE_PORT` (the legacy `AG_` prefix also works).

## Command groups

The commands are grouped to mirror the governance website tabs.

### Dashboard

| Command | Website equivalent | What it does |
| --- | --- | --- |
| `overview` | Overview | Shows gateway status, registered-agent count, held approvals, blocked-action count, and storage posture. Supports `--json`. |
| `agents` | Agents | Shows the registered agent directory, department, state, and responsibility. |

Use the explicit subcommand form when scripting:

```bash
guardsaab console dashboard overview
guardsaab console agent list --status Guarded
guardsaab console agent list --department Engineering --json
```

### Security operations

| Command | Website equivalent | What it does |
| --- | --- | --- |
| `policy list` | Policies | Lists the loaded rule directory. Filter by action or search text. |
| `system status` | Governance overview | Shows engine health, policy state, review count, audit backend, and injection classifier. Supports `--json`. |
| `scenario list` | Scenario Lab cards | Lists the built-in security demonstrations. |
| `scenario run <name>` | Run Scenario | Sends a harmless simulated tool-call payload through the live policy engine and prints its actual verdict, rule, reason, and risk band. |
| `approval list` | Approvals | Displays every held request, including its tool input and risk score. |
| `approval approve <id>` | Approve | Resolves a pending request as `ALLOW`. |
| `approval deny <id>` | Reject | Resolves a pending request as `BLOCK`. |
| `activity list` | Activity Logs | Shows recent sanitized gateway audit events, their verdicts, risk, and session references. |
| `session list` | Sessions | Lists recorded agent sessions and their decision totals. |
| `session show <id>` | Session timeline | Displays the selected session's event history. |

Commands may be used interactively or as one-shot commands:

```bash
guardsaab console system status
guardsaab console policy list --action BLOCK --limit 20
guardsaab console scenario run resource-bomb --session demo-01
guardsaab console approval list --risk HITL
guardsaab console activity list --action BLOCK --limit 25
guardsaab console session list --blocked
```

## Flags and automation

All read/list commands support `--json` for scripts and CI. `--limit N` accepts `1` through `500` and is available on policy, approval, activity, and session lists.

| Command | Flags | Meaning |
| --- | --- | --- |
| `agent list` | `--status STATE`, `--department NAME`, `--json` | Filter the local agent registry. |
| `policy list` | `--action ACTION`, `--search TEXT`, `--limit N`, `--json` | Filter policies by `ALLOW`, `HITL`, or `BLOCK`; match text in ID/description. |
| `scenario list` | `--json` | Emit the built-in scenario catalogue. |
| `scenario run` | `--session ID`, `--json` | Associate a simulation with a known session ID; emit the complete verdict object. |
| `approval list` | `--risk BAND`, `--tool NAME`, `--limit N`, `--json` | Filter held actions by risk band or tool name. |
| `activity list` | `--limit N`, `--action ACTION`, `--session ID`, `--search TEXT`, `--json` | Filter audit events by decision/risk band, session, or free text. |
| `session list` | `--blocked`, `--limit N`, `--json` | Show only sessions that include blocks, cap output, or emit JSON. |

Examples suitable for automation:

```bash
# Obtain structured, machine-readable blocked rules.
guardsaab console policy list --action BLOCK --json

# Print recent block events for a particular investigation.
guardsaab console activity list --session incident-104 --action BLOCK --json

# Use a deterministic session identifier during a demo.
guardsaab console scenario run untrusted-binary --session jury-demo --json
```

Flags take either `--flag value` or `--flag=value` form. Unknown commands and missing required values fail with a clear error and do not contact the engine.

## Built-in command help

Every console command and subcommand accepts `--help` (or `-h`). Help is available without a running engine and only describes the selected command, its required arguments, and its flags.

```bash
guardsaab console --help
guardsaab console policy list --help
guardsaab console scenario run --help
guardsaab console approval approve --help
guardsaab console activity list --help
guardsaab console session show --help
```

The short aliases provide the same local help, for example `guardsaab console pending --help` and `guardsaab console simulate --help`.

## Completion, versioning, and validation

The console includes the remaining standard command-line conveniences:

```bash
# Display the console version without contacting the engine.
guardsaab console --version

# Enable completion for the current Bash session.
source <(guardsaab console completion bash)

# Persist completion in Zsh or Fish using your shell's normal completion directory.
guardsaab console completion zsh
guardsaab console completion fish
```

Every command validates its own flags before it calls the engine. For example, `guardsaab console activity list --limt 20` fails with an actionable error instead of silently ignoring the typo. This is deliberate: an operator should never think a safety filter was applied when it was not.

## Built-in demonstrations

| Scenario | Expected result | Purpose |
| --- | --- | --- |
| `secret-exfil` | Block | Prevents `.env` credential access. |
| `supply-chain-ioc` | Block | Prevents installation of a known malicious package. |
| `destructive-command` | Block | Prevents recursive forced deletion. |
| `resource-bomb` | Block | Prevents the demonstrated Python fork bomb. |
| `os-tweaker` | Block | Prevents kernel/network configuration changes. |
| `untrusted-binary` | Ask | Requests review before parsing a downloaded firmware artifact. |
| `force-push` | Ask | Requests review before pushing to a remote branch. |

`simulate` sends an **approval request**, so a review result returns `ASK` instead of leaving a terminal process hanging. It is safe to use for demos: GuardSaaB evaluates the payload and records the governance event, but never runs the represented shell command.

## Review workflow

1. Run `guardsaab console pending`.
2. Inspect the tool, rule, request input, and reason.
3. Resolve it explicitly with `guardsaab console approve <id>` or `guardsaab console deny <id>`.
4. Confirm the result in `activity` or `session <id>`.

Approving a held action authorizes the connected agent execution path. Treat approvals as security decisions; do not approve a command simply because it appears in a demonstration.

## Troubleshooting

- **Cannot reach GuardSaaB**: start the engine and verify `curl http://127.0.0.1:9000/health` returns `ok: true`.
- **No pending requests**: the engine may use terminal approval mode, which returns `ASK` directly to a compatible agent instead of creating a held request. Start the engine with `CB_APPROVAL_SURFACE=dashboard` when demonstrating queue-based approval.
- **No activity**: activity is written only after requests reach the engine. Run a simulation or connect an agent hook first.
- **Command unavailable in a package install**: update to a package version that includes `console`, or invoke the source command shown above while developing locally.

## Security boundaries

The console is an operator interface, not a sandbox. It provides visibility and approval control; host-level resource limits and artifact isolation must be supplied by the execution environment. See `SECURITY_REVIEW.md` for the current prototype boundary.
