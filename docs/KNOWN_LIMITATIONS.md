# Known limitations

- The selected upstream application is present in `warden/`; Warden branding, product adaptation, and full security review remain incomplete.
- Candidate research is a point-in-time snapshot from 2026-10-11; upstream revisions and agent hook contracts can change.
- The `srjn45/warden` shallow checkout was unusable because its branch/ref appeared broken; its GitHub docs were reviewed, but local source was not.
- Cerberus dependencies are installed and a limited local smoke test was run; no adversarial security assessment was performed.
- Candidate claims about risk accuracy, coverage, security, and production suitability remain independently unverified.
- Hook-only integration cannot control direct API calls, unsupported tools, or all child/background execution unless the host adds stronger OS controls.
- The separate parent-workspace Codex Bash hook prototype denies a small set of textual patterns and records command hashes. It is not the selected application base and does not parse shell syntax structurally, predict effects, provide approval, observe outcomes, cover non-Bash tools, or resist obfuscation and alternate execution paths.
- The cloned Cerberus project documents that Codex lacks native `ask` and uses a dashboard/socket hold. Its behavior under timeout, dashboard disconnect, and unauthorized local approval remains to be assessed.
