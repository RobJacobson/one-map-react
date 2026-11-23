# Instructions for one-map-react contributors and agents

What to read and when:
- **Before implementation:** the [native compatibility design](docs/native-compatibility-design.md) and [testing policy](docs/testing-policy.md). Historical results do not certify the working checkout.
- **Next-release API work:** the [migration contract](docs/revised-api-proposal.md), [unit protocol](docs/revised-api-implementation-plan.md), and [API coverage checklist](docs/api-coverage.md).
- **First-party code, tests, scripts, and examples:** the [shared coding style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/coding-style.md). Bring affected existing code into compliance; generated and upstream code keep their required conventions.
- **New apps or requested migrations:** the [default architecture](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/default-architecture.md).
- **Markdown:** the [shared documentation style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/documentation-style.md), the `technical-writing` skill, [mapping conventions](docs/STYLE_GUIDE.md), and [docs/AGENTS.md](docs/AGENTS.md). Keep `FILES.md` through depth 3 (root = 0). Describe current implementation separately from agreed future contracts and recorded runtime acceptance.

**Acceptance.** Obtain explicit permission for the exact scope, and run it only after implementation, structural/comment review, and applicable routine checks are complete, with no known substantive changes remaining. Implementing, refactoring, or satisfying acceptance criteria does not grant that permission. The rule covers real-renderer browser tests, mixed Metro SDK transport tests, native acceptance builds, installations, and canonical flows, including acceptance launched through another script. A retry or a changed artifact needs permission for that scope. Before preparing, approving, running, diagnosing, or resuming acceptance, follow the [complete batch protocol](docs/testing-policy.md#complete-acceptance-units) and [current handoff](docs/revised-api-acceptance-plan.md#current-handoff): complete or explicitly block one platform/backend/device unit at a time. Acceptance stays deferred until release preparation or an explicit owner request.

Routine formatting, documentation, type, unit, mocked adapter/component, library build, and package/selection checks may run during development. Inspect aggregate commands so they do not launch acceptance. Without permission, report runtime acceptance as unverified and continue the authorized routine work.

Dispatch approved acceptance under the [worker policy](docs/testing-policy.md#smoke-workers-and-models). The coordinator prepares, verifies the artifact, diagnoses, and audits. The worker stops at the first unexpected failure, leaves production code unchanged, and does not retry. Follow the [retention policy](docs/testing-policy.md#storage-and-tooling): keep compact outcome and provenance summaries under `records/evidence`, keep raw logs or screenshots only during an active investigation, and remove generated consumers, dependencies, build caches, old binaries, duplicate tools, and raw log archives when a checkpoint finishes or is abandoned.

On a requested commit, use a one-line Conventional Commit subject, a blank line, and a bullet-point summary of the major changes.

## Audit and fix completion

An audit authorizes investigation and a report. Change code only when a fix is requested. Preserve the full intended behavior with the smallest change that does so.

- Map workflows, state transitions, and resource ownership across callers and adapters. Check overlap, stale results, replacement, cancellation, failure, and teardown against the contract.
- Report concrete correctness and contract failures. Do not fill a finding quota.
- Fix the root cause on every affected path and search for the same pattern elsewhere. Add a regression that fails before the fix and passes after, review new failure modes, and run applicable routine checks.
- Before claiming completion, account for every finding and path: fixed and verified (name the checks), implemented but unverified, still open, and outside scope. State any gap between the request and the inspected or tested behavior. Passing checks cover only the behavior they exercise.

The acceptance permission rules above still apply. Deferred acceptance remains an open verification gate.
