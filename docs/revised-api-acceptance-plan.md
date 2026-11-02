# Native acceptance plan

## Current handoff

Prepare the complete **Android Mapbox** acceptance unit under the authoritative [native batch protocol](testing-policy.md#complete-acceptance-units). Account for all retained coverage through valid existing evidence plus the remaining core and retained rows in one batch. The full batch command and resource packet are not yet prepared or independently audited. No new native execution, application launch, calibration or retry is authorized by this process revision.

The latest [attempt21 outcome](../records/evidence/revised-api-u26-signal-diagnostic-attempt-21.json) stopped in calibration before app launch. Its saved trace reports missing periodic flush configuration and separately marks `signal/signal_generate` unknown; it contains no signal9 or canary-victim signal event. Fixing flush alone does not establish sender capture. The original foreground application SIGKILL remains unresolved. Owned cleanup and unchanged-input checks passed within that outcome's scope.

Next, review the saved blocker evidence within the [30-minute diagnosis limit](testing-policy.md#bounded-blocker-diagnosis). Identify a supported correction or discriminating experiment and resolve or explicitly block the unit. The repeated diagnostic failures require reassessment, not another incremental runtime probe. A standalone runtime diagnostic would need a separate owner exception with its exact question, budget and outcome; it would earn no acceptance credit.

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

Preparation is offline and must complete the whole unit before the next execution request. The coordinator owns this work and independent audit; the eventual batch uses one exclusive owner-selected Terra Medium worker.

1. Resolve or explicitly block the foreground SIGKILL using saved evidence first. Record the question, hypothesis, discriminating outcome and diagnosis budget. Consolidate all supported related fixes into one reviewed repair PR rather than alternating small diagnostic PRs and runs.
2. Reconcile the fixed matrix with the retained contract. Carry forward accepted camera and earlier feature-family evidence; identify all remaining Android Mapbox core and retained observations, identities, density readback and cleanup gates.
3. Prepare and verify the entire command chain and report flow with device-free regressions. Include actual command errors, remote-process disappearance, readiness, row identity, first-failure reporting and cleanup. Existing individual diagnostic or cross-backend entrypoints do not establish support for the complete unit.
4. Freeze candidate, resolved dependencies, SDK, selected device/OS, installed APK identity, scripts and fixtures. Reuse verified setup and binaries when applicable. The existing [candidate and fixed input evidence](../records/evidence/revised-api-u26-platform-batches-preparation.json) is the starting point; the new packet must establish its current applicability.
5. Budget the complete batch using measured peak storage plus explicit headroom and cleanup reserve, expected duration, owned resources and stop conditions. Storage stops in [attempt20](../records/evidence/revised-api-u26-signal-diagnostic-attempt-20.json) and [attempt21 cleanup](../records/evidence/revised-api-u26-attempt21-storage-cleanup.json) are inputs to that budget, not permission to repeatedly free only the immediate shortfall.
6. Obtain independent audit of one self-contained runnable packet. Then request one owner approval covering required setup, any useful proven existing calibration, both remaining rows, duration, cleanup and explicit retry scope. Do not launch an app or calibration while preparing that request.

There is no proposed executable command here yet. Publishing a runnable packet requires actual implementation and routine verification of the complete Android Mapbox route. Historical micro-run commands are not substitutes.

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
