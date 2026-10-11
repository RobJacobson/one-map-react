# Historical API research and evidence

The JSON records in this directory were produced for the implementation retired during TF01. They remain useful for upstream API inventory, versioned sources, discovered incompatibilities, and provenance. Their stage assignments, implementation mappings, artifact hashes, and runtime results apply to that implementation only.

`api-coverage.json` and `inventory-inputs/` supply the completeness checklist for the replacement. Reconcile their mappings as each new feature is implemented; do not rebuild the old stage-ledger tooling. `version-baseline.json` and `tooling-baseline.json` record historical versions, not the current supported development or renderer matrix. `stage-status.json` and `evidence/` preserve historical outcomes; they are not active gates.

Current direction and status live in the [requirements](../docs/requirements.md), [stage plan](../docs/stage-plan.md), [TF01 record](../docs/tf01-foundation.md), and [TF02 record](../docs/tf02-shared-map.md). Compact TF02 checkpoint evidence is [evidence/tf02-shared-map.json](evidence/tf02-shared-map.json). The [testing policy](../docs/testing-policy.md) governs new evidence and acceptance runs.
