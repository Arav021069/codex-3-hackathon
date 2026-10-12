# Roadmap

| Phase | Priority | Deliverables | Exit criteria |
|---|---|---|---|
| 0. Research and design | Complete | Workspace baseline, candidate source/license review, initial docs | Evidence and uncertainty documented |
| 1. Reuse a working base | Complete for selection/setup | Cloned Cerberus into `warden/`; dependencies installed; build, focused tests, and local API smoke passed | Preserve upstream history/license; assess exact integration and security limits |
| 2. Hackathon demo adaptation | Next | Run app with the demo agent; verify allow/block; narrow Warden branding/configuration; test approval path | Live pre-execution allow/block demo with clear coverage and no unsupported security claims |
| 3. Warden hardening | P0 | Parser/adversarial tests, redaction, replay, integrity checkpoints, installer and recovery docs | Explicit coverage and residual risk review; regression corpus |
| 4. Developer pilot | P1 | Policy editing/simulation, session search, containment controls, limited second integration | User workflow feedback and compatibility matrix |
| 5. Team governance | Later | Auth, roles, shared policy, team approvals, relational transactional workflow | Threat model and tenant isolation design reviewed |
| 6. Enterprise options | Later | Private deployment, retention/admin/compliance operations | Validated user requirements, support/deployment plan |

Phase 1 is the smallest next task. Firestore and enterprise services are deferred. No market-demand or customer claims have been validated.
