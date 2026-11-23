# Instructions for one-map-react contributors and agents

What to read and when:
- **Before implementation:** the [library boundary](docs/architecture.md) and [testing](docs/testing.md). Historical results in `records/` apply only to the artifact they name.
- **First-party code, tests, scripts, and examples:** the [shared coding style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/coding-style.md). Bring affected existing code into compliance; generated and upstream code keep their required conventions.
- **New apps or requested migrations:** the [default architecture](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/default-architecture.md).
- **Markdown:** the [shared documentation style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/documentation-style.md) and the `technical-writing` skill. Keep `FILES.md` through depth 3 (root = 0). Describe the current implementation separately from recorded runtime acceptance. Use the [mapping names](#mapping-names) below.

**Acceptance.** Obtain explicit permission for the exact scope, and run it only after implementation, structural/comment review, and applicable routine checks are complete, with no known substantive changes remaining. Implementing, refactoring, or satisfying acceptance criteria does not grant that permission. The rule covers real-renderer browser tests, mixed Metro SDK transport tests, native acceptance builds, installations, and canonical flows, including acceptance launched through another script. A retry or a changed artifact needs permission for that scope. Before preparing, approving, running, diagnosing, or resuming acceptance, follow the [complete batch protocol](docs/testing.md#complete-acceptance-units): complete or explicitly block one platform, backend, and device unit at a time. Acceptance stays deferred until release preparation or an explicit owner request.

Routine formatting, documentation, type, unit, mocked adapter/component, library build, and package/selection checks may run during development. Inspect aggregate commands so they do not launch acceptance. Without permission, report runtime acceptance as unverified and continue the authorized routine work.

Dispatch approved acceptance under the [worker policy](docs/testing.md#workers). The coordinator prepares, verifies the artifact, diagnoses, and audits. The worker stops at the first unexpected failure, leaves production code unchanged, and does not retry. Follow the [retention policy](docs/testing.md#storage-and-tooling): keep compact outcome and provenance summaries under `records/evidence`, keep raw logs or screenshots only during an active investigation, and remove generated consumers, dependencies, build caches, old binaries, duplicate tools, and raw log archives when a checkpoint finishes or is abandoned.

On a requested commit, use a one-line Conventional Commit subject, a blank line, and a bullet-point summary of the major changes.

## Mapping names

Use **backend** for the selected implementation and **platform** for web, iOS, or Android. Name a specific SDK when describing renderer behavior.

Use these names: one-map-react, RNMapbox (`@rnmapbox/maps`), MapLibre React Native (`@maplibre/maplibre-react-native`), react-map-gl, Mapbox GL JS, and MapLibre GL JS. Preserve upstream API spelling.

For a nontrivial difference, use a four-column table in this order: RNMapbox, MapLibre React Native, react-map-gl, proposed one-map-react API. The last column states whether the difference is a rename, a data conversion, a behavioral adaptation, a fallback, or an unsupported feature. Link the inspected source or official documentation beside each material claim.

A missing React wrapper component does not prove the renderer lacks the capability.

## Audit and fix completion

An audit authorizes investigation and a report. Change code only when a fix is requested. Preserve the full intended behavior with the smallest change that does so.

- Map workflows, state transitions, and resource ownership across callers and adapters. Check overlap, stale results, replacement, cancellation, failure, and teardown against the contract.
- Report concrete correctness and contract failures. Do not fill a finding quota.
- Fix the root cause on every affected path and search for the same pattern elsewhere. Add a regression that fails before the fix and passes after, review new failure modes, and run applicable routine checks.
- Before claiming completion, account for every finding and path: fixed and verified (name the checks), implemented but unverified, still open, and outside scope. State any gap between the request and the inspected or tested behavior. Passing checks cover only the behavior they exercise.

The acceptance permission rules above still apply. Deferred acceptance remains an open verification gate.
