# Architecture proposal

**Status:** Proposed; verify against implementation before claiming any component exists.

## First deployment shape

The selected base already implements a local agent hook adapter, governance service, and dashboard. For the hackathon, adapt these existing seams instead of introducing a second backend. Keep the synchronous decision path deterministic. Treat the dashboard as a client of engine state, not the enforcement point. Verify which state is persisted versus in memory before relying on replay or recovery behavior.

## Components and boundaries

- **Agent adapter:** registers supported pre-action and post-action hooks; validates input, normalizes action/identity/context, translates verdicts into the agent's documented response shape, and fails closed for configured protected actions.
- **Decision service:** validates the request and context; evaluates permissions and deterministic policies; invokes explain/risk analysis; creates pending approvals; returns a short-lived decision bound to the canonical request.
- **Policy engine:** pure, versioned evaluator for allow/ask/block. Mandatory deny and approval rules have explicit precedence and cannot be overturned by classifier output.
- **Risk/explanation service:** derives intent, likely effects, risk factors, confidence, and unknowns. No AI output is executable authority.
- **Approval service:** authenticates approver, checks role, expiration, and request digest, records decision, then triggers fresh authorization. Never accepts frontend-only approval.
- **Execution boundary:** initially the agent's verified synchronous hook. Return deny/ask before the agent executes the action. This only protects actions routed through that hook; OS sandboxing/credential restriction is needed for stronger containment.
- **Outcome observer:** ingests adapter post-action evidence such as exit code and bounded/redacted output. It does not equate command intent with actual side effects.
- **Audit store/projector:** append lifecycle events and derive session/action views. Restrict access and support export; independently checkpoint hashes for stronger tamper evidence when operationally justified.
- **Dashboard/API:** authenticated reads and approval actions; state reflects service records, not local optimistic success.

## Logical flow

Identity → Permissions → Policy → Risk/Explanation → Approval → Revalidation → Execution authorization → Outcome evidence → Audit projection.

## Event lifecycle

Use immutable application-level event records with `event_id`, `action_id`, `session_id`, `sequence`, UTC time, actor/agent references, event type, policy version, action digest, decision/reason, approval reference, and redacted evidence metadata. Event types include proposed, evaluated, approval_requested, approval_resolved, authorized/denied, execution_observed, and containment_requested. Store raw commands only when needed and apply redaction/retention; never store raw credential values. Deduplicate by event ID and detect sequence gaps without claiming all gaps are observable.

## Stack decision

The clone uses a TypeScript/Node local engine and a React/Vite dashboard. Reuse this stack for the hackathon to avoid another process boundary. The original Python/FastAPI and Firestore proposal is deferred. The cloned engine uses local files and loopback APIs; it does not provide enterprise multi-user identity. Revisit transactional relational persistence and managed authentication only when team deployment is in scope.
