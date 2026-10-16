# TF10 coverage and release implementation plan

> Historical plan: the per-entry JSON inventory and its tooling are superseded by the [grouped coverage checklist](api-coverage.md). Preserve the original plan and counts as provenance; use the checklist for current coverage work.

TF10 should produce a verified release candidate, its public documentation, and compact release evidence. Publication is a separate action. Expand peer ranges within the current majors, retaining the existing versions as the minimum supported baseline. Complete inventory reconciliation before freezing the candidate so missing features remain visible and can be fixed before acceptance.

The [requirements](requirements.md), [stage plan](stage-plan.md), and [testing policy](testing-policy.md) govern this work. TF09 is complete for its recorded scope in [advanced rendering](tf09-rendering.md). This proposal defines implementation work; it does not renew earlier runtime results for a release candidate.

## Coverage closure

The current [inventory](https://github.com/RobJacobson/one-map-react/blob/ba029a50c339c9efb00f7543792e0ce31a0a5ec0/records/api-coverage.json) contains 12,131 entries: 1,261 marked implemented and 10,870 marked pending. These are ledger states, not a count of missing features. TF09 records many implemented families separately in [its coverage evidence](../records/evidence/tf09-coverage.json), while some existing inventory references still point to retired tests. Reconcile the current code and evidence into the inventory before estimating the remaining implementation work.

1. Review entries by owning behavior: selection and host forwarding; lifecycle and camera; sources, layers, images and expressions; queries and feature state; UI and interactions; services; advanced rendering and selected facilities. Preserve inventory IDs and upstream provenance. Use existing TF01-TF09 records to locate implementations, then inspect the actual exports, callers, tests, and pinned peer sources. Historical implementation or verification flags do not establish current support.
2. Give every applicable entry a current common API, named selected API, documented composition, substantiated unsupported boundary, or internal-only disposition. Record owner-approved exclusions and deferrals separately. Group unchanged fields under their actual forwarding path and representative tests; resolve aliases to their canonical operation. Raw SDK access, a compatible type, or a capability flag cannot close a missing operation.
3. Update existing mapping, rationale, implementation scope, test references, and per-environment evidence. Preserve historical evidence files and distinguish declaration checks, mocked behavior, and real renderer verification. Link runtime results only to the scenarios and artifacts actually exercised. A forwarded field can be complete without an independent renderer test for that field.
4. Implement uncovered required behavior at its existing owning boundary. Prefer wrapper delegation, then a local conversion or named extension. Update affected callers, types, exports, examples, and regression tests together. Keep unresolved wrapper feasibility as a release blocker until the supported extension paths and SDK facilities have been investigated; do not label unfinished facade work unsupported.
5. Add a small inventory check to routine validation. It must reject duplicate IDs, unresolved or cyclic alias references, missing current source/test/evidence targets, and unresolved applicable work without an explicit owner exception. Add focused valid/invalid fixtures for these checks. Reuse the existing inventory fields, with only an optional canonical-ID reference where needed; do not rebuild the historical stage execution system. Explicitly historical references may remain when current evidence is also supplied.

Preserve the [owner-deferred native fitBounds.maxZoom work](native-fitbounds-maxzoom-memo.md), including rejection of supplied zero, and the [owner scope exclusions](requirements.md#purpose-and-scope) for physical devices and the two RNMapbox cache operations. Carry these into the proposed release limitations without calling them implemented. Review native controlled-camera semantics and other unresolved investigations explicitly; camera prop forwarding alone does not prove gesture rejection. Any additional exception requires an owner decision and leaves TF10 incomplete until resolved.

## Compatibility and package boundaries

Use these proposed peer ranges. Resolve and record stable endpoint versions when implementation begins; exclude prerelease peers. For React Native, widen patches within 0.87 because a change of minor version under major zero is a compatibility boundary. Keep React and React DOM versions aligned, and respect the selected React Native renderer's React requirement.

| Peer | Existing minimum | Proposed range |
| --- | --- | --- |
| React | 19.2.3 | `^19.2.3` |
| React DOM | 19.2.3 | `^19.2.3` |
| React Native | 0.87.1 | `^0.87.1` |
| react-map-gl | 8.1.3 | `^8.1.3` |
| Mapbox GL JS | 3.32.0 | `^3.32.0` |
| MapLibre GL JS | 6.13.0 | `^6.13.0` |
| RNMapbox | 10.3.7 | `^10.3.7` |
| MapLibre React Native | 11.5.0 | `^11.5.0` |
| react-native-teleport | 1.2.1 | `^1.2.1` |

Create one current support matrix under `records/` containing exact tested versions, admitted ranges, host combinations, native SDK defaults, patch requirements, and evidence. Pin the native Mapbox Maps SDK to exactly `11.23.1` on iOS and Android through the wrapper-supported Podfile and root Gradle settings. The npm wrapper remains `@rnmapbox/maps` 10.3.7 or a compatible admitted 10.x release; its package major is distinct from the deprecated native SDK v10. Leave the historical version baseline intact. Compare upstream public declarations and wrapper behavior across the admitted releases; append inventory entries for newly supported APIs without renumbering existing entries. Cover intermediate changes that introduce a distinct API, native SDK, or patch boundary. Endpoint checks alone do not establish compatibility across an incompatible intermediate release. If a proposed range cannot be supported, record the blocker and the compatible intervals explicitly before claiming the broader range.

The current native patches are tied to exact wrapper versions. For every stable native wrapper release admitted by the final range, establish whether each repair is upstream or needs a version-specific patch. Prefer upstream repairs; retain narrow patches where necessary. Document reproducible application-owned installation using the existing Bun workflow, including clean install and native rebuild. Read patches from the installed candidate package during consumer checks rather than copying them from the workspace. Verify patched source, compiled JavaScript, declarations, and native files where the fix spans them. A patch that only applies at the minimum version cannot certify an entire major range.

Preserve the common entry, four explicit adapter entries, and two conditional aliases. Keep backend SDK types out of portable declarations, React required, and other peers optional. Preserve browser precedence when both browser and native conditions are enabled. No new runtime API is planned solely for release preparation; add exports only to close a demonstrated coverage gap. Retain declaration comments and synchronous versus asynchronous method semantics.

Extend the existing package and peer-consumer scripts to accept the frozen tarball and exact version sets, keeping current defaults for routine development. Test a common consumer without backend peers, each selected backend alone, both aliases under all existing condition combinations, and both mixed web/native engine choices. Assert absence of unrelated engines in consumer installs and bundles. Preserve explicit checks for transitive dependencies genuinely required by the chosen peer; document exceptions such as native portal dependencies rather than claiming they are absent.

## Public documentation and examples

Update the package README into a complete installation and usage entry point. Include selected peer installation, alias behavior, native linking and patches, one runnable shared map, selected extension usage, service permissions, capture scope, and current limitations. Use verified public repository links for detailed API documents absent from the archive, and include essential setup instructions directly. Reconcile the root README, documentation index, inventory summary, records index, and current status in the stage plan with this public material; do not duplicate an independent support matrix or reactivate the historical stage-status ledger.

Keep the existing four example shells and shared map. Make their normal entry paths demonstrate current public setup, with optional focused examples for advanced rendering, location/offline/capture, and UI. Exercise both mixed engine combinations through setup modules while keeping the shared map free of backend imports. Typecheck documented snippets and build the web examples from the packed candidate. Native release consumers must link and run against that same package, with their own selected peers and patches.

Audit obsolete handoffs and temporary probes before removal. Remove unreferenced execution instructions and temporary example files from the active release tree, repairing their links and imports. Preserve historical decisions and compact outcome/provenance records. Keep active requirements, testing policy, fixtures, and regression harnesses. The published archive should contain only built output, the public README, license, manifest, and required patches; extend the existing file-list assertion if patch filenames change. Public setup must not depend on the external backup or contributor-only documents absent from the archive.

## Verification and acceptance

Complete implementation, structural and public-comment review, and routine checks before requesting renderer acceptance. Run `bun run validate`, `bun run test:peers`, and `bun run test:example-resolution`, followed by candidate packing and checks against the exact final archive. Keep routine commands free of browsers, Metro transport, simulators, and native builds. Add meaningful regression cases for newly implemented behavior, inventory validation, consumer patch installation, and admitted version boundaries.

Use the existing harnesses and observations to prepare a release scenario checklist. Add only missing release observations or the minimal command selection needed to run them against the frozen package. Record the concrete commands, endpoint versions, environments, ports, expected duration, and artifact identities in the acceptance request. Allow several hours for the expanded matrix, especially native builds; refine this estimate after selecting the exact version sets.

| Acceptance group | Required scenarios |
| --- | --- |
| Core in all six environments | Shared map rendering, camera command and independent readback, normalized movement/click, source/layer update and removal, style replacement, queries, clusters, feature state, unmount/remount and stale callback cleanup. |
| Lifecycle and UI | Actual web reuse with current callbacks/children, external context where supported, native reuse rejection, representative marker dragging and nested child interaction, popup dismissal, controls, named maps and source propagation. |
| Services | Foreground permission/acquisition and cleanup, supplied-position display/follow, persistent native packs and error/cancel paths, populated database import/migration, independent images, map capture dimensions and documented inclusion. |
| Advanced and selected facilities | Terrain/no-data/disable, supported projection, hillshade, web canvas/video/custom layer lifecycle, representative named renderer/global facilities, and additional paths identified by coverage or version differences. |
| Compatibility and selection | Final candidate on the minimum and newest compatible stable version sets across all six environments; real Metro transport and selected native linking for both mixed engine setups; focused intermediate-version cases where the compatibility audit identifies a distinct boundary. |

Use the existing browsers, iOS simulators, and Android emulators; preserve the owner exclusions above. Record full VoiceOver and TalkBack audits as outside the proposed release certification, while retaining accessibility checks for facade-owned controls and changed interactions. Representative facade integration does not independently certify every upstream operator, host property, build option, or hardware sensor.

Follow the [acceptance permission rule](testing-policy.md#acceptance-timing-and-user-permission). Permission is needed before running any of these real renderer, transport, build, or installation checks, including scoped runs. Prefer the policy's web workers with isolated ports/profiles/caches and one native worker owning Metro, builds, simulators/emulators, and installations. Serialize the existing TF09 web runs while they share their fixture port. Preserve first-attempt failures; workers report them without independently changing code or retrying.

Freeze the tarball, built-file digest, harness identity, consumer lockfiles, patched peer hashes, and native binary/install identities before execution. Verify each consumer's package against the tarball and keep it unchanged during acceptance. Record passed, failed, deliberately skipped, and unverified separately. Acceptance-affecting repairs require a new artifact and authorized affected reruns; historical passes stay attached to their original artifacts.

## Candidate delivery and completion

Use `0.1.0-rc.1` as the proposed first candidate version and increment the candidate suffix for subsequent freezes. Keep root workspace metadata private. Deliver the tarball and checksum, support matrix, public documentation, inventory reconciliation, and compact routine/acceptance evidence. Add one current TF10 completion record and link it from the stage plan and documentation index. Publishing, tagging, and committing require separate instructions.

TF10 is complete when every applicable inventory entry has a substantiated disposition, required gaps are implemented, the admitted peer ranges and patch paths pass their checks, the final archive passes isolated consumers, and authorized release acceptance passes for the declared matrix. Required failures, unknown patch compatibility, and missing acceptance keep the release gate open. Owner exceptions remain visible in the support claim.

Retain compact outcomes and provenance under `records/evidence`. Remove only test-owned temporary consumers, caches, downloads, and disposable binaries. Preserve pre-existing app installations and data; use separate acceptance identities or back up any application container before an authorized replacement. Cleanup must not repeat the app-data loss recorded in [TF09](tf09-rendering.md#recorded-acceptance).
