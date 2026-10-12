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

## Commands

| Command | Website equivalent | What it does |
| --- | --- | --- |
| `status` | Governance overview | Shows engine health, policy state, review count, audit backend, and injection classifier. |
| `scenarios` | Scenario Lab cards | Lists the built-in security demonstrations. |
| `simulate <name>` | Run Scenario | Sends a harmless simulated tool-call payload through the live policy engine and prints its actual verdict, rule, reason, and risk band. |
| `pending` | Approvals | Displays every held request, including its tool input and risk score. |
| `approve <id>` | Approve | Resolves a pending request as `ALLOW`. |
| `deny <id>` | Reject | Resolves a pending request as `BLOCK`. |
| `activity` | Sessions / Activity Logs | Lists recorded agent sessions. |
| `session <id>` | Session timeline | Displays the selected session's event history. |

Commands may be used interactively or as one-shot commands:

```bash
guardsaab console status
guardsaab console scenarios
guardsaab console simulate resource-bomb
guardsaab console pending
```

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
