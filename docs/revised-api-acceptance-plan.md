# Native acceptance plan

## Current handoff

The complete **Android Mapbox** unit is conditionally prepared under the authoritative [batch protocol](testing-policy.md#complete-acceptance-units). The [unit packet](../records/evidence/revised-api-u26-mapbox-android-unit-preparation.json) accounts for retained coverage through accepted evidence plus core then retained, reusing camera without rerun. Independent coordinator audit passed; storage readiness and one complete-unit execution approval remain pending. The preparation snapshot has about8.4GiB free against the12GiB planning gate; capacity must be rechecked before dispatch. This is preparation, not executable readiness or a new runtime pass.

The latest [attempt21 outcome](../records/evidence/revised-api-u26-signal-diagnostic-attempt-21.json) stopped in calibration before app launch. Its saved trace reports missing periodic flush configuration and separately marks `signal/signal_generate` unknown; it contains no signal9 or canary-victim signal event. Fixing flush alone does not establish sender capture. The original foreground application SIGKILL remains unresolved. Owned cleanup and unchanged-input checks passed within that outcome's scope.

Bounded saved-evidence diagnosis is closed without a supported causal fix. The original SIGKILL cause remains blocked/unknown. The owner selected the complete Mapbox Android batch on the existing emulator with that prior crash risk explicit and no tracing calibration; this selects the proposal, not execution permission or a waiver. A recurrence stops the unit at its first failure. No further environment-choice question or incremental calibration is proposed.

Keep the [retained requirements](requirements.md#purpose-and-scope), [migration contract](revised-api-proposal.md) and [coverage checklist](api-coverage.md) unchanged. This plan changes execution organization, not the public contract or the meaning of a pass.

## Coverage matrix and order

The [fixed baseline matrix](../records/evidence/revised-api-u26-platform-batches-preparation.json) owns the twelve camera/core/retained row IDs, thirteen core recipes, six retained recipes, accepted evidence and scope dispositions. Its historical two-platform dispatch instructions are superseded by the four complete backend units below. The baseline remains twelve rows, with one accepted camera row and eleven remaining rows.

| Order | Immutable platform/backend unit | Camera | Core | Retained | Remaining rows |
| --- | --- | --- | --- | --- | --- |
| 1 | Android Mapbox | Reuse accepted evidence | Pending | Pending | 2 |
| 2 | Android MapLibre | Pending | Pending | Pending | 3 |
| 3 | iOS Mapbox | Pending | Pending | Pending | 3 |
| 4 | iOS MapLibre | Pending | Pending | Pending | 3 |

The [Android Mapbox camera outcome](../records/evidence/revised-api-u26-android-platform-batch-attempt-01.json) remains accepted. Its reuse is not a new execution claim. Partial core observations and calibration runs do not complete a row. Finish or explicitly block Android Mapbox before changing backend; an owner may redirect after the blocker report. Do not interleave features across these units.

All nine browser rows passed on unchanged f05 within the [recorded browser scope](../records/evidence/revised-api-u25-web-attempt-07.json); web has no pending row. The fixed matrix links the accepted four-environment minimal, lifetime, query/cluster, bounded source/image and targeted rendering evidence. Reuse those results where artifact and behavior remain applicable, retaining their original limits. A changed observer or runner alone does not require their repetition.

The twelve rows are the remaining execution baseline, not a replacement for full retained-contract accounting. Before approval, map every retained requirement to valid reused evidence, a remaining scenario or an explicit owner-approved exclusion. A newly demonstrated gap must be resolved in the selected unit's complete packet; it must not be hidden by relabeling the requirement unsupported.

## Android Mapbox preparation

The [fixed Mapbox entrypoint](../scripts/mapbox-android-acceptance.mjs) reuses existing resource ownership, recorder and validated operator/writer flows. It installs the retained Mapbox APK once, executes core then retained, preserves earlier passed rows on failure, and never starts camera, MapLibre, a build or tracing calibration. An inherited signal-output flag is cleared for both rows. All thirteen core and six retained recipes, accepted evidence, resolved package/APK metadata, pins and exact operator/writer forms are in the self-contained unit packet.

The conditional launcher is shown for audit only. Independent audit passed; dispatch waits for the capacity gate and one complete-unit owner approval:

```sh
/Users/rob/code/mapbox-code/one-map-f05-android-recovery/runtime-bin/node /private/tmp/one-map-android-restoration-review/scripts/mapbox-android-acceptance.mjs /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-22
```

The packet owns all nineteen recipes and the execution sequence. These initial core command forms use only the current helper and attempt; they are transport references, not permission to execute or a substitute for that sequence. These are templates: before dispatch, replace both guarded tap placeholders with literal numeric coordinates just observed in the visible child's fresh bounds. Do not rely on variables from a previous tool call or dispatch an uninstantiated template. Use a unique hierarchy filename for each later read. The retained row uses the same packet-bound helper with its own fresh report and six recipes.

```sh
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-22 mapbox-android-core live-child-button adb shell uiautomator dump /sdcard/one-map-attempt22-hierarchy-001.xml
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-22 mapbox-android-core live-child-button adb shell cat /sdcard/one-map-attempt22-hierarchy-001.xml
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-22 mapbox-android-core live-child-button toolbar "Read renderer"
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-22 mapbox-android-core live-child-button adb shell input tap "${CHILD_X:?Set fresh child X}" "${CHILD_Y:?Set fresh child Y}"
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-22 mapbox-android-core live-child-button adb shell screencap -p /sdcard/one-map-attempt22-live-child-button.png
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-22 mapbox-android-core live-child-button adb pull /sdcard/one-map-attempt22-live-child-button.png /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-22/live-child-button.png
python3 /private/tmp/one-map-android-restoration-review/scripts/android-operator.py /Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-22 mapbox-android-core live-child-button status
```

The new unit requires 12GiB free before dispatch. The packet records current read-only free space and shortfall; the coordinator must recheck capacity outside the launcher and hold without native preflight or output creation until the budget is met. No measured whole-unit peak exists. This is a conservative planning allocation for configured userdata/sdcard, APK/install/cache allowance, host headroom and cleanup reserve, not a measured peak or an explanation of SIGKILL. Historical storage gates remain unchanged. No cleanup is authorized by this preparation.

Estimate 45-75 minutes for both rows, with existing 30-minute manual and 35-minute driver bounds per row, 180-second boot and 120-second installation bounds, bounded command/identity reads and a 100-minute worker allocation including cleanup. That allocation is coordinator supervision, not a new global launcher watchdog. One exclusive owner-selected Terra Medium worker owns the selected unit; the coordinator keeps diagnosis and audit.

With audit complete, request one approval conditional on capacity readiness for required setup, both remaining rows, duration, cleanup and retry scope on the exact frozen candidate/device/SDK. The accepted camera and earlier minimal/lifetime/query/source/rendering evidence retain their original identities and limits. The unit packet does not certify the general SDK or convert the unknown prior failure into a pass. No application, emulator, Metro, installation, calibration or native acceptance ran during preparation.

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
