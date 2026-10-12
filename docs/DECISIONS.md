# Architecture decisions

## D001: Research before application code

- **Status:** Accepted.
- **Decision:** Establish requirements, integration evidence, and boundaries before building a large app.
- **Reason:** Current workspace is empty and agent hook contracts determine whether enforcement is real.
- **Consequence:** Initial deliverable is documentation and a focused hook spike.

## D002: Local-first vertical slice; defer hosted persistence

- **Status:** Proposed.
- **Decision:** Begin with local enforcement and storage; do not adopt Firebase by default.
- **Reason:** No existing Firebase project, hosting requirement, or multi-user workflow exists in the workspace. Approval needs explicit transaction semantics.
- **Consequence:** Revisit relational or managed storage when team use is designed; migration must preserve event IDs and history.

## D003: GuardSaaB owns authorization semantics

- **Status:** Accepted as a design constraint.
- **Decision:** Third-party tools may inform adapter and parser design, but mandatory policies, approval identity, revalidation, and authorization remain controlled by GuardSaaB.
- **Reason:** Candidate integration semantics and coverage differ; some agent hooks document fail-open or incomplete action coverage.
