# Warden application base

## Selection and repository layout

Warden's application is in [`../warden/`](../warden/), a separate clone of [Asati-git/ai-agent-firewall](https://github.com/Asati-git/ai-agent-firewall), the Cerberus local agent security gateway. The folder name and dashboard brand are Warden. The clone retains its upstream Git history and internal package/CLI names; these identify the source project and are not Warden product branding. It was cloned from `main` at `078120b` on 2026-10-11.

Cerberus was selected as the hackathon base because its existing code includes a local enforcement engine, agent adapters, policy and risk modules, approval paths, audit events, session projections, and a React dashboard. The Warden dashboard now supplies the product identity and live operations presentation. Preserve upstream notices whenever changing or distributing the inherited code.

## License and attribution

The clone carries an Apache License 2.0 `LICENSE`, `NOTICE`, and `THIRD_PARTY_NOTICES.md`. Preserve these files and upstream copyright and attribution. The upstream project describes itself as an extended fork of Adirdabush1/cerberus; review the NOTICE and dependency license inventory before shipping a derivative. No external code was copied into Warden-owned parent-workspace files.

## Setup and checks completed

- Runtime: Node.js `v26.7.0`, npm `12.0.2` (upstream requires Node.js 20 or later).
- Root and dashboard dependencies are installed. npm skipped the `esbuild` install script under its current allow-scripts policy; builds still succeeded with the installed platform package.
- `node bin/cerberus.mjs rules validate`: passed.
- `npm run build`: engine and dashboard production builds passed after the Warden visual changes.
- `npm run test:policy`: 31 passed.
- `npm run test:adapters`: 22 passed.
- `npm run test:audit`: 14 passed.
- Local API smoke test on port `19000` with a temporary `CB_STATE_DIR`: health returned OK; a normal Read decision returned ALLOW; a submitted `rm -rf` decision returned BLOCK. The command was evaluated only and was not executed. The server was stopped after the check.

## Remaining validation before presenting

- Connect the intended agent and verify one harmless allow, a policy denial, and a human-review lifecycle live in the Warden UI.
- Test the exact agent versions, timeout/disconnection behavior, and approval identity. Codex uses a dashboard/socket hold because it lacks the same native `ask` response available to some adapters.
- Dashboard approval is local and is not authenticated multi-user authorization. Loopback binding and Origin checks do not replace identity and CSRF analysis.
- The inherited engine and adapters have not received a line-by-line release review or external penetration test. The checks above are baseline evidence, not a security certification.
- The dashboard package install reported five advisories in transitive development dependencies; the production dependency audit found none.

## Next steps

1. Start the gateway and Warden dashboard using `warden/README.md`.
2. Run the deterministic demo flow and verify the visible allow, block, and review outcomes against the engine.
3. Rehearse the Warden walkthrough and keep the upstream source and license attribution clear.
4. Add Warden-specific regression coverage before changing inherited enforcement behavior.
