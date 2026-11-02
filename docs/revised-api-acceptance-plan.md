# Native acceptance plan

## Current handoff

**The complete Android Mapbox API36 proposal is prepared offline; coordinator audit passed; capacity and one execution approval remain required.** The [API36 packet](../records/evidence/revised-api-u26-mapbox-android-api36-preparation.json) binds the unchanged f05 candidate/APK to stable Android16 API36 Google APIs revision7, arm64-v8a standard4K, on one private AVD. One exclusive Terra Medium worker would set up the official image and run automated camera, all thirteen core scenarios, then all six retained scenarios. No tracing calibration, build or MapLibre execution is included.

The original SIGKILL remains unexplained. [Attempt22](../records/evidence/revised-api-u26-android-mapbox-unit-attempt-22.json) stopped after one live-child observation, before nested-scroll input, with PID3342 signal9; core did not pass and retained never started. Owned cleanup and frozen-input checks passed. The [authorized cleanup](../records/evidence/revised-api-u26-attempt22-storage-cleanup.json) and [old API37 packet](../records/evidence/revised-api-u26-mapbox-android-unit-preparation.json) remain historical. Selecting API36 changes the environment; it is not a demonstrated causal fix or a retry authorization.

Before dispatch, the coordinator must run the packet's read-only capacity check and hold without creating an attempt or acquiring native resources if it fails. A fresh image requires 17,459,998,649 bytes (~16.26GiB) free; a verified reused image requires12GiB. The packet records the current shortfall. Preserve the global API37 image by default; its deletion or any further cleanup requires its own authorized scope. No native execution or image installation has occurred during preparation.

## Coverage matrix and order

The [fixed baseline matrix](../records/evidence/revised-api-u26-platform-batches-preparation.json) owns the twelve camera/core/retained row IDs, thirteen core recipes, six retained recipes, accepted evidence and scope dispositions. Its historical two-platform dispatch instructions are superseded by the four complete backend units below. The historical baseline remains twelve rows, with one accepted API37 camera row and eleven remaining rows. Selecting API36 reopens Android Mapbox camera for the new OS, so the selected targets have twelve pending rows; the old pass remains accurate history.

| Order | Immutable platform/backend unit | Camera | Core | Retained | Remaining rows |
| --- | --- | --- | --- | --- | --- |
| 1 | Android Mapbox, API36 | Pending for new OS | Pending | Pending | 3 |
| 2 | Android MapLibre | Pending | Pending | Pending | 3 |
| 3 | iOS Mapbox | Pending | Pending | Pending | 3 |
| 4 | iOS MapLibre | Pending | Pending | Pending | 3 |

The [Android Mapbox camera outcome](../records/evidence/revised-api-u26-android-platform-batch-attempt-01.json) remains accepted. It does not establish an API36 camera pass; the new unit runs camera first. Partial core observations and calibration runs do not complete a row. Finish or explicitly block Android Mapbox before changing backend; an owner may redirect after the blocker report. Do not interleave features across these units.

All nine browser rows passed on unchanged f05 within the [recorded browser scope](../records/evidence/revised-api-u25-web-attempt-07.json); web has no pending row. The fixed matrix links the accepted four-environment minimal, lifetime, query/cluster, bounded source/image and targeted rendering evidence. Reuse those results where artifact and behavior remain applicable, retaining their original limits. The API36 packet reviews OS-change impact: reuse unchanged-contract evidence within its original limits, then obtain fresh camera/GL, query, style/replacement, live UI and density observations through the three selected rows. Any new OS-dependent gap blocks the unit; no general SDK certification is implied.

The twelve rows are the remaining execution baseline, not a replacement for full retained-contract accounting. Before approval, map every retained requirement to valid reused evidence, a remaining scenario or an explicit owner-approved exclusion. A newly demonstrated gap must be resolved in the selected unit's complete packet; it must not be hidden by relabeling the requirement unsupported.

## Prepared Android Mapbox API36 packet

The [API36 entrypoint](../scripts/mapbox-android-api36-acceptance.mjs) reuses the existing launcher, recorder and validated operator/writer flows. Its bounded setup helper downloads the pinned official image, verifies size/SHA1 and all28 ZIP64 members, validates source/build/kernel hashes, and atomically installs only the task-owned image. It creates a fixed private AVD without borrowing a host device profile. API36/arm64/4096-byte pages/GLES3 are checked after boot and before the unchanged APK is installed. The API37-only local-network grant is skipped; historical modes remain unchanged.

The source checks establish compatibility with the APK's minSdk24/targetSdk36 and the installed emulator37.2.12 (image minimum35.4.9). They do not certify runtime behavior or resolve SIGKILL. The packet contains exact image provenance, configuration, artifact/SDK pins, full contract accounting, commands and cleanup ownership. Camera, core and retained execute in order, preserving earlier passes at the first failure. Inherited tracing is disabled.

The proposed launcher is for audit; dispatch requires the single complete-unit approval and successful capacity check:

```sh
/Users/rob/code/mapbox-code/one-map-f05-android-recovery/runtime-bin/node /private/tmp/one-map-android-restoration-review/scripts/mapbox-android-api36-acceptance.mjs /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-23
```

Use the packet's exact launcher tool parameters (`/bin/sh`, login false, yield1000ms), then wait on its returned session with existing `write_stdin` calls bounded at30000ms. Image setup and automated camera precede manual operations. Do not invoke the operator helper until stdout contains `API36 core operator phase starting`; then use the packet's core status command, which handles driver readiness. After core, await `API36 retained operator phase starting` before retained status. These markers announce a phase transition, not readiness. If the launcher exits first, stop and preserve its failure; do not invent polling commands.

The packet owns all nineteen recipes and the execution sequence. These initial core command forms use only the current helper and attempt; they are transport references, not permission to execute or a substitute for that sequence. These are templates: before dispatch, replace both guarded tap placeholders with literal numeric coordinates just observed in the visible child's fresh bounds. Do not rely on variables from a previous tool call or dispatch an uninstantiated template. Use a unique hierarchy filename for each later read. The retained row uses the same packet-bound helper with its own fresh report and six recipes.

```sh
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-23 mapbox-android-core live-child-button adb shell uiautomator dump /sdcard/one-map-attempt23-hierarchy-001.xml
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-23 mapbox-android-core live-child-button adb shell cat /sdcard/one-map-attempt23-hierarchy-001.xml
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-23 mapbox-android-core live-child-button toolbar "Read renderer"
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-23 mapbox-android-core live-child-button adb shell input tap "${CHILD_X:?Set fresh child X}" "${CHILD_Y:?Set fresh child Y}"
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-23 mapbox-android-core live-child-button adb shell screencap -p /sdcard/one-map-attempt23-live-child-button.png
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-23 mapbox-android-core live-child-button adb pull /sdcard/one-map-attempt23-live-child-button.png /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-23/live-child-button.png
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-23 mapbox-android-core live-child-button status
```

The packet separates conservative download/extraction and batch budgets. The ZIP is1,872,691,175bytes; resolved ZIP64 expansion is4,575,096,761bytes. Delete only the helper-owned ZIP/staging after verified extraction; retain the verified image plus12GiB batch reserve. No measured whole-unit peak exists. These capacity allocations are planning bounds, not an explanation of the app's SIGKILL.

Estimate60-110minutes including download/setup, automated camera and both manual rows. Bounds include20minutes download,25minutes setup-helper execution,180seconds boot,120seconds installation, and existing30-minute manual/35-minute driver limits per UI row. A150-minute worker allocation includes cleanup; it is coordinator supervision, not a new launcher watchdog. One approval covers this complete declared unit and setup; the worker stops on its first failure and never retries itself.

After audit, request that single approval conditional on capacity readiness. Runtime acceptance remains unverified, retained requirements remain unchanged, and no API36 pass is inferred from historical evidence. The [batch policy](testing-policy.md#complete-acceptance-units) governs dispatch and any later resume.

## Execution, failure and completion

Dispatch only the audited selected-unit packet. It must contain the exact runnable commands and current evidence references; workers must not reconstruct them from history. Reuse owned setup within the packet's boundaries and preserve foreign processes, devices and files.

The worker stops at the first unexpected failure, preserves the first outcome and performs owned cleanup. The coordinator reviews saved evidence and keeps completed applicable results. Workers do not repair code or retry independently. A resume proposal consolidates all known related fixes and addresses every remaining requirement under the [approval and execution policy](testing-policy.md#approval-and-execution).

If the same operational failure recurs after an audited repair, or a failed diagnostic supplies no discriminator, stop the escalation loop and report the unit blocked with options. The [bounded diagnosis policy](testing-policy.md#bounded-blocker-diagnosis) governs further work. This plan authorizes neither indefinite guard additions nor repeated one-feature runtime approvals.

Complete a unit only when every retained requirement is passed, validly reused or explicitly excluded by the owner. Failed, blocked and unverified requirements remain open. Keep compact immutable outcomes and one current handoff; retain raw traces, logs and screenshots only while essential to an active investigation under the [retention policy](testing-policy.md#storage-and-tooling).

After all four units, reconcile actual `window.scale` and artifact identities from the four retained-row outcomes under the existing density closeout gate: each engine needs two distinct positive observed scales. Missing aggregate proof remains blocked; assumed values or an unrun row cannot supply a pass. This is offline evidence reconciliation, not another feature test or platform switch. [U27](revised-api-implementation-plan.md#u27-complete-evidence-and-hand-over) owns closeout and owner signoff; merge, tagging and publication retain separate authorization.

## Verification boundaries

The [fixed matrix](../records/evidence/revised-api-u26-platform-batches-preparation.json) preserves approved dispositions and exclusions. Retained coverage does not mean certification of every upstream SDK feature, raw service, sensor or layer pixel. Physical-device testing, full VoiceOver/TalkBack certification and the two owner-excluded RNMapbox cache operations retain their recorded boundaries. An untested retained behavior remains unverified.

## Native composition limitation

The retained mixed-selection contract pairs a web backend with one native backend. It does not require co-installing both native SDKs. The [candidate record](../records/evidence/revised-api-u24-candidate.json) preserves codegen controls and their build/link limitations; none constitutes native renderer acceptance. Each native unit binds one selected SDK and device environment.

## Historical links

The [historical plan](revised-api-acceptance-history.md) preserves the previous plan byte-for-byte after its archive banner. Read it only to inspect a specific outcome or recipe; never dispatch its commands. Compact evidence records remain unchanged.

The anchors below preserve verified incoming links from older records. They route to archived context and grant no current execution permission.

<a id="next-approval-mapbox-android-ordinary-queries-and-clusters"></a>

<a id="next-approval-mapbox-ios-ordinary-queries-and-clusters"></a>

<a id="next-approval-minimal-mapbox-android-retry"></a>

<a id="proposed-next-ios-readiness-run"></a>

Earlier readiness and query proposals are [historical](revised-api-acceptance-history.md#previous-handoff). Their recorded outcomes and the fixed matrix determine reusable evidence.

<a id="proposed-maplibre-android-restoration-and-ordinary-queries"></a>

The earlier restoration/query proposal is [archived](revised-api-acceptance-history.md#proposed-maplibre-android-restoration-and-ordinary-queries).

<a id="proposed-single-mapbox-android-rendering-scene"></a>

<a id="proposed-single-mapbox-ios-rendering-scene"></a>

<a id="proposed-single-maplibre-ios-rendering-scene"></a>

The earlier rendering proposals are [archived](revised-api-acceptance-history.md#proposed-single-mapbox-android-rendering-scene); their accepted outcomes remain bounded evidence, not new dispatch requests.

<a id="proposed-single-mapbox-ios-source-scene"></a>

<a id="proposed-single-maplibre-ios-source-scene"></a>

The earlier source proposals are [archived](revised-api-acceptance-history.md#proposed-single-mapbox-ios-source-scene). Use the fixed matrix for accepted source evidence and the current unit for remaining work.
