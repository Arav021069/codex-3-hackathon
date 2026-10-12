# Product specification

**Status:** Initial proposal; no product implementation exists in this repository.

## Product and users

GuardSaaB governs actions proposed by AI coding agents. Initial users are individual developers and small engineering teams who want to let agents work autonomously within explicit limits while retaining approval and accountability for consequential actions. GuardSaaB should report the limits of each integration instead of implying universal agent coverage.

## Core journey

1. A developer configures a supported agent adapter and local policy.
2. The agent proposes a supported action, and an adapter sends a normalized request to a local enforcement service before execution.
3. Deterministic identity, permission, and policy checks run. Risk analysis supplies evidence and explanation but cannot weaken a mandatory prohibition.
4. GuardSaaB returns allow, ask, or block. Ask binds an approval to an exact action and context. The enforcement service revalidates the request after approval.
5. The agent integration executes only when allowed and reports available outcome evidence.
6. The event history links request, decision, approval, execution result, and session for a dashboard view.

## Functional requirements

- Identify user, agent, session, project, working directory, tool, and environment when the integration exposes them.
- Apply deterministic allow/ask/block policy with explicit rule precedence, deny overrides, and default-deny for protected high-impact action classes when policy is missing or unavailable.
- Explain intent as an interpretation, predicted effects as uncertain, and observed effects only from collected evidence.
- Support action-specific, expiring approval; authorize the approver on the backend; bind approval to a canonical action digest and relevant policy/context versions.
- Record lifecycle events with stable IDs, timestamps, actor references, redaction, and integrity metadata. Hash chaining can reveal some tampering but is not absolute immutability.
- Provide a dashboard that reads persisted backend state and presents decisions, pending requests, timelines, and outcomes. UI state cannot grant execution authorization.
- Document integration coverage and unsupported execution routes.

## Non-functional requirements

Local-first operation, safe failure for protected actions, bounded hook latency, privacy-conscious logging, schema validation, idempotent event ingestion, accessible UI, and reproducible setup. Multi-user cloud services, enterprise identity, compliance claims, and cross-agent universal coverage are outside the first milestone.

## First milestone acceptance

One verified, testable agent integration; pre-execution interception for a documented action subset; deterministic allow/ask/block; useful non-fabricated effect explanation; authorized action-bound human approval; enforcement of the decision; persisted audit lifecycle and observed result; basic dashboard; automated allowed, blocked, approval, expiry, modified-action, and failure-path tests. The cloned Cerberus app supplies a substantial starting implementation, but GuardSaaB has not yet validated those acceptance criteria end to end.

### Compatibility constraint discovered

The installed Codex CLI documents `PreToolUse` deny but does not support `ask` there; errors/timeouts can fail open. The current hook spike therefore covers only deterministic deny/abstain and hashed decision audit. It does not satisfy the full end-to-end milestone. Before building the dashboard or approval flow, determine whether another supported Codex event/human prompt path can provide action-bound approval without weakening denial. If not, the first complete milestone must use an agent that supports synchronous approval, or use an execution wrapper that owns the action boundary.
