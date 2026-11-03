# Project records

The [acceptance checkpoint](evidence/acceptance-checkpoint.md) preserves historical artifact identities, bounded browser/Android outcomes and deferred release verification. Acceptance is deferred until release preparation or an explicit owner request; it does not block ordinary development.

The [support matrix](support-matrix.json), [version baseline](version-baseline.json) and [tooling baseline](tooling-baseline.json) describe their recorded package and tooling scope. Technical research, implementation audits and patch decisions remain under `evidence/`; they are reference material, not current execution instructions. The [API coverage checklist](../docs/api-coverage.md) owns retained contract coverage.

Keep only compact outcome/provenance metadata and fixtures used by maintained checks. Use Git history for old campaigns. Remove completed or abandoned attempt packets, generated consumers, dependencies, build caches, app binaries, duplicate tools and raw logs/screenshots. Keep raw material only while essential to an active investigation. See the [testing policy](../docs/testing-policy.md#storage-and-tooling).

Historical results apply to the artifact and exercised scope recorded at the time. They neither certify changed code nor require rerunning every test after every edit. Select checks by changed behavior and keep unresolved release verification explicit.
