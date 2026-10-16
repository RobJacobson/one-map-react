# API research and evidence

[support-matrix.json](support-matrix.json) and [evidence/tf10-release.json](evidence/tf10-release.json) own current candidate versions, patch paths, routine checks and open release gates. The reconciled api-coverage.json separates current dispositions from runtime verification. [TF10 native style sources](evidence/tf10-native-style-sources.json) preserves compact exact-tag source identities for native unsupported boundaries.

The [facade simplification evidence](evidence/facade-simplification.json) records the compiler configuration, unchanged public contracts, routine outcomes, frozen archive, and proposed acceptance scope. Renderer acceptance for that archive remains unrun and requires separate permission.

The [independent simplification audit](evidence/facade-simplification-audit.json) records two creation-validation regressions, reproduced routine checks, compiler output verification and prioritized consolidation recommendations.

The [creation-validation repair evidence](evidence/facade-simplification-repair.json) records the corrected behavior, consolidation, lossless inventory migration and routine checks against the repaired archive. Renderer acceptance remains unverified; no commit or publication is recorded.

Earlier JSON records in this directory were produced for the implementation retired during TF01. They remain useful for upstream API inventory, versioned sources, discovered incompatibilities, and provenance. Their stage assignments, implementation mappings, artifact hashes, and runtime results apply to that implementation only.

`api-coverage.json` and `inventory-inputs/` supply the completeness checklist for the replacement. Reconcile their mappings as each new feature is implemented; do not rebuild the old stage-ledger tooling. `version-baseline.json` and `tooling-baseline.json` record historical versions, not the current supported development or renderer matrix. `stage-status.json` and `evidence/` preserve historical outcomes; they are not active gates.

The inventory uses schema version 2 to share repeated support and evidence profiles. [inventory-format.mjs](../scripts/inventory-format.mjs) provides lossless expansion to schema version 1 and deterministic compaction; [the coverage reference](../docs/api-coverage.md) describes editing and validation. This storage format does not change any entry's coverage or runtime status.

Current direction and status live in the [requirements](../docs/requirements.md), [stage plan](../docs/stage-plan.md), [TF01 record](../docs/tf01-foundation.md), and [TF02 record](../docs/tf02-shared-map.md). Compact TF02 checkpoint evidence is [evidence/tf02-shared-map.json](evidence/tf02-shared-map.json). The [testing policy](../docs/testing-policy.md) governs new evidence and acceptance runs.

The [TF08 implementation evidence](evidence/tf08-implementation.json) preserves routine checkpoints and their original authorization limits. The subsequent [TF08 acceptance evidence](evidence/tf08-acceptance.json) records browser passes, native failures, artifact identity, and corrected runner results. TF08 mappings in api-coverage.json retain their routine verification scope; runtime claims must use the acceptance record's exercised scenarios.
