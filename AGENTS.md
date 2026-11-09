# Instructions for one-map-react contributors and agents

**Acceptance work:** Before preparing, approving, running, diagnosing or resuming acceptance, read the authoritative [complete batch protocol](docs/testing-policy.md#complete-acceptance-units) and [current handoff](docs/revised-api-acceptance-plan.md#current-handoff). Complete or explicitly block one platform/backend/device unit at a time; this protocol and its owner-selected worker override older native smoke instructions below.

Read [requirements](docs/requirements.md), the [stage plan](docs/stage-plan.md), and [testing policy](docs/testing-policy.md) before implementation. For next-release API work, read the [migration contract](docs/revised-api-proposal.md), [unit protocol](docs/revised-api-implementation-plan.md), and [API coverage checklist](docs/api-coverage.md). Acceptance is deferred until release preparation or an explicit owner request; see the [current handoff](docs/revised-api-acceptance-plan.md#current-handoff). Historical results do not certify the working checkout.

Follow the [shared coding style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/coding-style.md) for first-party code, tests, scripts, and examples. Bring affected existing code into compliance; generated and upstream code keep required conventions. Use the [default architecture](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/default-architecture.md) for new apps or requested migrations.

For Markdown, follow the [shared documentation style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/documentation-style.md) and the `technical-writing` skill for substantive prose. Keep the curated project-source tree in `FILES.md` through depth 3 (root = 0) so the public README can open with its introduction. Follow [mapping-specific conventions](docs/STYLE_GUIDE.md) and [local instructions](docs/AGENTS.md) under `docs/`. Describe current implementation separately from agreed future contracts and recorded runtime acceptance.

Acceptance tests can take over an hour. Agents must not run them without explicit user permission, and must defer them until the checkpoint is close to acceptance: implementation, structural/comment review, and applicable routine checks are complete, with no known substantive changes remaining. Before requesting permission, identify the checkpoint, proposed artifact, environments, commands, and expected duration. An instruction to implement, refactor, or satisfy acceptance criteria does not itself authorize running acceptance tests. This rule covers full and scoped real-renderer browser tests, mixed Metro SDK transport tests, native acceptance builds/installations and canonical flows, and acceptance launched indirectly through other scripts. Permission applies only to the agreed scope; retries or changed artifacts outside that scope need permission. See [testing policy](docs/testing-policy.md#acceptance-timing-and-user-permission).

Routine formatting, documentation, type, unit, mocked adapter/component, library build, and package/selection checks may run during development. Inspect aggregate commands before running them to ensure they do not launch acceptance tests. When acceptance permission has not been given, report runtime acceptance as unverified or awaiting permission and continue authorized routine work; do not start acceptance in the background.

Prefer subagents for approved acceptance execution under the authoritative [worker policy](docs/testing-policy.md#smoke-workers-and-models). Fixed web workers use Luna Low; each complete native unit uses one exclusive owner-selected Terra Medium worker. The coordinator retains preparation, artifact verification, diagnosis and audit. Workers stop at the first unexpected failure and never change production code or retry independently.

Keep test storage temporary. The owner requires minimal retention: preserve compact outcome and provenance summaries under `records/evidence`, and keep raw logs or screenshots only when essential to an active investigation. Remove generated consumers, dependencies, build caches, old app binaries, duplicate downloaded tools, and raw log archives when a checkpoint finishes or is abandoned. Historical outcomes must remain accurately recorded, but permanent evidence must not require multi-gigabyte test workspaces. See [retention policy](docs/testing-policy.md#storage-and-tooling).

When a commit is requested, use a one-line Conventional Commit subject followed by a blank line and a bullet-point summary of the major improvements and changes. Do not commit merely because files have been edited.

## Audit and fix completion standard

Audit requests authorize investigation and reporting; change code only when fixes are requested. Keep code as simple as possible while preserving the full intended behavior.

- Map important workflows, state transitions, and resource ownership across callers and adapters. Check overlapping operations, stale results, replacement, cancellation, failure, and teardown against the intended contract.
- Prioritize concrete correctness and contract failures over minor cleanup. Do not stop at a finding quota or invent issues to fill one.
- For fixes, address the root cause across every affected path and search for the same failure pattern elsewhere. Make the smallest complete change, add regression tests that fail before the fix and pass afterward, review for new failure modes, and run applicable routine checks.
- Before claiming completion, account for every finding and affected path. Distinguish fixed and verified (name the checks), implemented but unverified, outstanding work, and areas outside the review scope.
- State any gap between requested scope and inspected or tested behavior. Never silently narrow scope or present partial progress as completion. Distinguish reported findings fixed, checks passed, and system readiness; passing checks support only the behavior they cover.

The renderer acceptance permission and timing rules above still apply. Required but deferred acceptance remains an explicit open verification gate.
