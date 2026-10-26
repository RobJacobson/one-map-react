# Revised API implementation plan

**Agreed unit sequence; U06 merged as PR25 and U07 as PR26; U08 merged as PR27; U09 merged as PR28; U10 merged as PR29; U11 implemented and audited, applicable routine verification recorded, PR authorized under the unit workflow; U12 onward undispatched.** Implement the [revised shared API](revised-api-proposal.md) as small, independently reviewable changes. Every unit ends with subagent handoff, coordinator review, routine verification, and explicit user sign-off before the next unit starts. Creating this plan authorizes no successor implementation, acceptance run, package publication, or peer-version change.

The proposal owns the target API and before/after consumer examples. This plan owns the work order, assignments, proof required, and permission gates. The [requirements](requirements.md) define the agreed next-release scope. The [coverage checklist](api-coverage.md) separates pending migration from current routes, and the [release record](tf10-release.md) continues owning the unchanged candidate gates. Source paths, dependencies, routine command routes, and existing guarantees below describe the 0.1.0-rc.11 working basis captured by [U01](../records/evidence/revised-api-u01-baseline.md), inspected on 2026-10-24. This publication uses an older main-branch base, not that working implementation; every assignment must refresh its caller inventory against the approved working state before editing.

## Motivation and intended result

The adapter's central value is shared rendering and map access: applications supply sources, layers, camera requests, and queries through one interface. Several broader guarantees required it to own much more. The historical [offline service](https://github.com/RobJacobson/one-map-react/blob/bf00bc1aa0b85ef206cb9dff9538f6fff94f933f/packages/one-map-react/src/adapters/shared/offline-service.ts) managed persistent identity and observer recovery; [location acquisition](../packages/one-map-react/src/adapters/shared/create-location-service.ts) and [following](../packages/one-map-react/src/facade/use-geolocation-control.ts) coordinate permissions, freshness, subscriptions, foreground changes, and camera dispatch. [Native camera correction](https://github.com/RobJacobson/one-map-react/blob/7d440810570983140735945e69351a1d3d09b275/packages/one-map-react/src/adapters/shared/use-native-controlled-camera.ts) and [feature-state replacement](https://github.com/RobJacobson/one-map-react/blob/55e9f9268971a731e20e7e3f0658262a90cad182/packages/one-map-react/src/adapters/shared/native-feature-state.ts) impose behavior beyond a direct wrapper call.

Those responsibilities connect otherwise separate paths. A rendered-frame callback participates in capture readiness and state cleanup. Native control measurements move SDK ornaments. Marker dragging disables map gestures and owns asynchronous projection. More cases must be checked when a source is replaced, an operation fails, or a component unmounts. Removing an approved guarantee removes its coordination and its testing obligation; deleting a failing test without removing its promised behavior does not simplify the contract.

The intended result keeps the common rendering/query surface and lets the selected renderer own ordinary platform behavior. Application services and screen UI become explicit application responsibilities. Native dragging, continuous camera rollback, automatic state clearing, source-level synthetic bubbling, and automatic image replay are excluded as described in the proposal. Validation, observable errors, accessibility, attribution, and cleanup of retained adapter-owned work remain required.

This trades convenience and strict parity for a smaller library-owned contract. Applications using offline downloads, tracking, capture, or controls need real migration work. They should select existing application/SDK facilities rather than inherit a mandatory copy of the old common services. Review library deletions alongside application additions so that moving the same framework into examples cannot be reported as a net simplification.

## Agreed planning decisions

The owner adopted the narrower target and initially released U01 only. U01 supplied the [frozen baseline and caller inventory](../records/evidence/revised-api-u01-baseline.md). U02 was merged as PR21, U03 as PR22, U04 as PR23, and U05 as PR24. U06 is merged as PR25. U07 is merged as PR26 and U08 as PR27. U09 is merged as PR28. U10 is merged as PR29. The owner released U11 only, with automatic commit and PR creation authorized after its audits and routine checks pass. The default remains one unit at a time. An owner can explicitly change that authorization later; a general progress acknowledgement, agent completion, or coordinator recommendation is not permission to advance.

These planning decisions define the next-release target; they do not claim implementation:

- Adopt the deliberately narrower shared scope from the proposal, with a breaking prerelease rather than silent changes to the current candidate. Keep native SDK service exports as pass-through facilities, with application-owned policy and verification.
- Retain live native marker children, annotation refresh, all retained source/layer families, shared camera commands, rendered/source/cluster queries, explicit feature-state operations, mixed backend selection, and named-map access. Keep the live marker overlay and portal dependency until a separately approved replacement proves the retained behavior.
- Add only the proposed asynchronous selected-ref getWrapperMap access route. Keep the common MapRef free of SDK types; do not replace method mirroring with another dispatcher or registry.
- Include one newly identified contract clarification: remove UserLocation.onPress. Its [current implementation](../packages/one-map-react/src/facade/user-location.tsx) uses Source.onClick, which is being removed. UserLocation becomes position/accuracy display only. An application requiring activation can render its own known source/layer IDs and use Map.onClick. This is an agreed next-release exclusion, not a discovered SDK limitation.
- Keep existing peers and patches during the first implementation. Narrowing peer ranges, removing native patch sections, replacing marker hosts, changing native linking, and publishing are separate decisions. The plan does not promise a particular deletion count or smaller native binaries.

## Sign-off and subagent protocol

The user is the owner who releases the next unit. A subagent implements only its assigned unit. A second, read-only subagent reviews the final diff and connected paths after implementation. The coordinator reconciles findings, verifies the evidence and current base, and presents the owner with a concrete result. Neither implementer nor reviewer can sign on the user's behalf. Starting with U04, the owner authorizes the coordinator to commit, push, and open a PR for the currently released unit automatically after implementation, independent review, coordinator audit, and required routine checks pass. This authorization covers only that unit's reviewed artifact; owner approval remains required to start its successor, merge, run renderer acceptance or native builds/installations, or publish a package.

Use one implementation writer at a time because many units share map/ref adapters, public entries, native-ui, and scenario files. Implementation agents inherit the coordinator's model unless the owner requests otherwise. The model requirement for later approved smoke workers is specified separately below. Do not launch implementation or review agents merely because their assignments appear in this document.

At dispatch, give the implementer the approved base identity, unit ID, outcome, exact write allowlist, related caller/test inventory, required checks, forbidden changes, and handoff format. Source paths in the unit cards are starting points; the coordinator refreshes the allowlist before dispatch. The coordinator may add a necessary caller/test within that same outcome and records the addition. A new feature, new guarantee, changed target API, runtime dependency, peer/patch change, or successor unit needs owner approval.

Every implementation unit includes its callers, public types, representative tests, applicable fixtures/scripts, and local documentation. Keep relevant builds and declarations valid at the end of each unit. Do not leave unresolved compilation failures for an integration unit. Add getWrapperMap before migrating its consumers; remove each old API only when that unit migrates or deliberately retires every affected caller. Temporary coexistence of old and new routes in the unpublished branch is allowed during this sequence, but it must not become a permanent compatibility layer or release claim.

### Required handoff and owner decision

Each unit produces a compact review packet containing:

1. The approved unit/base, changed files, concrete consumer changes, and any allowed-scope adjustment.
2. What was removed, what remains, application code added, new dependencies if any, and remaining patch obligations. Measure task-owned changes against the unit's start, accounting for the pre-existing dirty workspace; do not attribute another task's edits or moved code to this work.
3. Exact routine commands, exit results, relevant versions, and first failures plus repairs. Separate pre-existing failures from new failures. A required new failure blocks sign-off; an unrelated baseline failure remains visible and bounded by evidence.
4. Tests retired because their contract was deliberately removed, tests rewritten for retained behavior, and regression evidence for errors, replacement, cancellation, and teardown where affected. Preserve useful cases from mixed feature suites.
5. Read-only reviewer findings, their disposition, and coordinator review. Resolve substantive findings within the unit before presenting it as ready; fixes within the approved outcome do not release additional units.
6. Runtime checks not run, known risks, data implications, and the exact next unit for which approval is requested. Routine success supports only the behavior it covers.

Record the owner's actual decision and its scope in a compact checkpoint note or the conversation. Never prepopulate approval. Until explicit sign-off arrives, stop unit work and leave the next unit undispatched. If a unit cannot complete its approved contract safely, report the specific obstacle and a concrete alternative; do not silently weaken the contract or begin a new approach.

Sign-off to proceed is distinct from acceptance permission and publication permission. An owner can accept a unit's implementation/routine evidence while native integration remains explicitly unverified. No such sign-off authorizes renderer builds, installations, or scenarios unless it also approves the separately specified acceptance request.

### Workspace and recovery rules

U01 records current workspace contents, including pre-existing uncommitted work. Do not reset, clean, bulk-format, commit, or copy an unrelated release artifact over that work. Prefer the existing checkout with serialized writers. If the owner later chooses an isolated worktree, the coordinator must preserve the approved uncommitted base explicitly; creating a worktree from HEAD alone does not copy it.

Recheck shared files before each dispatch. If another task changes them, reconcile the affected unit base before writing and show material changes at the next owner gate. Recovery uses a reviewed reverse patch of task-owned edits or a separately authorized saved snapshot. No destructive Git operation or automatic whole-workspace revert is part of this plan. Keep temporary compiler probes, package consumers, raw logs, and builds temporary under the [retention policy](testing-policy.md#storage-and-tooling).

## Work order

U01 has supplied its frozen evidence. U06 is merged as PR25 and U07 as PR26. U08 native camera target migration is merged as PR27. U09 feature-state lifetime migration is merged as PR28. U10 current-map capture migration is merged as PR29. U11 selected offline manager migration is implemented and audited; [applicable routine verification is recorded](../records/evidence/revised-api-u11-offline.json), and the PR is authorized under the unit workflow. U12-U27 remain undispatched and unapproved for execution. The [U08 evidence](../records/evidence/revised-api-u08-native-camera.json) owns its bounded scope, provenance, and verification status. The [U07 evidence](../records/evidence/revised-api-u07-native-markers.json) records its bounded scope and verification status. The [U03 evidence](../records/evidence/revised-api-u03-web-wrapper.json), [U04 evidence](../records/evidence/revised-api-u04-mapbox-wrapper.json), [U05 evidence](../records/evidence/revised-api-u05-maplibre-wrapper.json), and [U06 evidence](../records/evidence/revised-api-u06-advanced-refs.json) record routine verification and provenance; renderer acceptance remains unverified and requires separate permission. The U06 record distinguishes the passing working-tree checks and bounded publication suite from two publication wrapper-callback import failures reproduced on its pre-U06 baseline. The U07 record likewise separates passing original checks and the bounded main publication suite from those two unchanged baseline wrapper-callback import failures; mocked and packed checks do not establish touch, renderer, Metro, or native linking acceptance. The sequence below is the default; dependencies highlight why related work cannot be reversed. Each row ends at its own owner sign-off gate. The fuller cards below define scope and proof.

| Unit | Deliverable | Key dependency | Gate after completion |
| --- | --- | --- | --- |
| U01 | Frozen working baseline and caller/test inventory | Plan approval | Approve baseline and U02 |
| U02 | Agreed next-release contract, without current-runtime claims | U01 | Approve contract and U03 |
| U03 | Selected web getWrapperMap | U02 | Approve U04 |
| U04 | RNMapbox getWrapperMap | U03 | Approve U05 |
| U05 | MapLibre native getWrapperMap | U04 | Approve U06 |
| U06 | Migrate advanced calls and remove ref method mirrors | U03-U05 | Approve U07 |
| U07 | Remove common native marker dragging | U06 | Approve U08 |
| U08 | Native camera targets without rollback | U07 | Approve U09 |
| U09 | Renderer-owned feature-state lifetime | U08 | Approve U10 |
| U10 | SDK capture callers; remove common map capture | U03-U05, U09 | Approve U11 |
| U11 | SDK offline callers; remove common offline service | U10 | Approve U12 |
| U12 | SDK independent snapshots; remove shared snapshot service | U03-U05, U10-U11 | Approve U13 |
| U13 | Wrapper/app popups; remove common Popup | U12; access from U03-U05 | Approve U14 |
| U14 | Screen/browser camera buttons; remove common NavigationControl/FullscreenControl | U13 | Approve U15 |
| U15 | SDK ornaments; remove common ScaleControl/AttributionControl | U14 | Approve U16 |
| U16 | App location UI; remove common GeolocateControl/following | U15 | Approve U17 |
| U17 | Screen layout; remove common Control and placement registry | U13-U16 | Approve U18 |
| U18 | App acquisition; remove library location services and service contexts | U11-U12, U16 | Approve U19 |
| U19 | Map feature clicks; remove Source.onClick and UserLocation.onPress | U13, U16-U18 | Approve U20 |
| U20 | Explicit image remount after style replacement | U19 | Approve U21 |
| U21 | Remove unused private context/event plumbing | U07-U20 | Approve U22 |
| U22 | Public surface, custom adapters, consumers, and package audit | U21 | Approve U23 |
| U23 | Patch/peer decision report, with no default removals | U22 | Approve U24 or scoped follow-up |
| U24 | Final routine checks, frozen candidate, acceptance request | U23 | Explicit acceptance permission |
| U25 | Approved web renderer checks | U24 and scoped permission | Approve web result and native scope |
| U26 | Approved sequential native renderer checks | U24, U25 and scoped permission | Approve native result and U27 |
| U27 | Final evidence, documentation, and retention review | U25-U26 or explicit verification disposition | Owner accepts result; publishing separate |

U23 can identify necessary extra patch work. It cannot authorize it. The coordinator proposes a separately named, bounded follow-up unit, obtains approval, completes it and its checks, and returns to the remaining sequence. The same rule applies to a failed later renderer check. No worker changes production code or retries a changed artifact independently.

## Unit cards

### U01: Establish the working baseline

**Outcome and scope.** A coordinator-preparation subagent performs read-only inventory. Inspect current instructions, requirements, the proposal, package scripts, working changes, current candidate evidence, public exports, custom adapters, maintained application scenarios, and test runners. Record relevant file/artifact hashes, peers, host versions, and existing routine outcomes. Preserve the current candidate; no new release status is inferred.

**Proof.** Search each removed API and each private owner across source, examples, tests, scripts, package configuration, and documentation. Classify every caller as retained, migrated, or deliberately retired; note dynamic/string references. Inspect aggregate commands before running any routine baseline checks. Produce the write/dependency inventory for later units and identify unrelated failures. No renderer, SDK storage operation, sensor acquisition, build/install, or database mutation runs.

**Owner decision.** Accept the concrete baseline and inventory before U02. If current work differs materially from the proposal's inspection basis, present that difference before changing its target.

### U02: Record the approved next-release scope

**Outcome and write scope.** A documentation subagent reconciles the proposal, active requirements/stage plan, grouped API checklist, package migration guidance, and applicable agent guidance after owner approval. Mark the smaller scope as agreed for the next incompatible release; keep existing implementation and historical acceptance described separately. Include the agreed UserLocation.onPress removal and application replacement. Do not edit public runtime types yet.

**Proof.** Documentation/link checks and review that every exclusion is explicit, every retained group has an implementation owner, and no unchecked existing work became a fictitious completed SDK limitation. Preserve current candidate/version/patch facts. Consult the writing-for-agents skill for any AGENTS.md edits and retain acceptance/retention instructions. The API proposal continues owning exact consumer examples; the plan does not duplicate a second coverage ledger.

### U03: Add selected web wrapper access

**Outcome and write scope.** One implementation subagent adds asynchronous getWrapperMap to both selected web refs through the existing web ref factory, selected entry types, and affected callback/ref tests. Keep current advanced methods temporarily so consumers remain valid. Do not add it to the common MapRef or expose raw SDK types through the common entry.

**Proof.** Test the actual react-map-gl wrapper result, current replacement handle, detached rejection, retained facade refs, no waiting for load, and absence of a new map owner. Add positive selected and negative common declaration examples. Run web ref/adapter tests, type checks, library build, and affected packed entry checks. Test the existing proxy's asynchronous method behavior rather than bypassing it with an unrelated handle cache.

### U04: Add RNMapbox wrapper access

**Outcome and write scope.** Add getWrapperMap to the RNMapbox map-ref factory and NativeAdvancedMapRef, with selected entry declarations and RNMapbox mocked adapter tests. Return the actual attached MapView wrapper ref. Keep its camera commands, source registry, and existing advanced methods unchanged.

**Proof.** Detached rejection, ref replacement, correct wrapper identity and type, no Camera substitution, and common-entry peer isolation. Run RNMapbox mocked adapter tests, type/build checks, and affected selected/packed checks. Import/type checking cannot certify native linking; record that gate without building a native app.

### U05: Add MapLibre native wrapper access

**Outcome and write scope.** Add the corresponding method to the MapLibre native map-ref factory, selected ref type, and mocked adapter tests. Read the current handle when called because the wrapper can refresh imperative handles; do not retain an earlier source/map ref unnecessarily.

**Proof.** Detached rejection, replacement handle, exact wrapper type, and existing map-loaded camera guards still apply to common camera commands. Run MapLibre mocked adapter tests and selected declaration/build/packed checks. Check both mixed selections with the accumulated access additions; no linking or renderer run occurs.

### U06: Stop mirroring advanced ref methods

**Outcome and write scope.** Migrate selected advanced callers and fixtures to getWrapperMap or the existing web useWrapperMap. Remove the advanced method inventories/helpers and duplicated selected ref members after searching every call. Expected owners include both selected web entries, native selected extras, web method-forwarders, selected tests, peer probes, and the selected acceptance scenarios.

**Proof.** Preserve all common camera/query/state methods and their result conversions. Check representative advanced reads and plugin/event routes through their true wrapper, with detached behavior documented. Keep inexpensive raw exports. Negative declarations reject removed facade methods. Do not change a React-owned source/layer/style through an SDK setter merely to make a fixture work. Run affected unit/mocked, type, build, and package-selection checks.

### U07: Remove common native marker dragging

**Outcome and write scope.** Remove use-native-marker-drag, common annotation drag forwarding/restoration, and drag-only gesture-lock plumbing from native marker composition, both native maps, and native presentation. Narrow selected native marker props and clearly reject unsupported common JavaScript requests. Migrate native marker scenes and retire only common-native-drag scenarios/scripts; web dragging and selected raw annotation facilities remain.

**Proof.** Existing live marker clicks share the drag hook, so replace their activation path and retain child buttons, scrolling, offsets, providers, refresh, coordinate updates, multiple maps, and cleanup. Keep RNMapbox per-tap annotation workarounds if still needed. Test that ordinary touches do not toggle SDK gestures and no obsolete asynchronous drag changes a marker. Update compiler ownership checks and script references to a deleted hook. Routine native UI, web UI, host, wrapper-callback, declaration, and example checks apply; actual touch acceptance remains open.

### U08: Remove native camera rollback

**Status.** Merged as PR27. The [U08 evidence](../records/evidence/revised-api-u08-native-camera.json) separates passing working-tree and covered publication checks from the two unchanged baseline wrapper-callback import failures in the full main web/unit suite. It also distinguishes the original-only TF10 harness migration from the older existing main fixtures; these fixture and artifact differences are recorded centrally. Actual native prop application, touch, renderer, Metro, and native linking acceptance remain unverified and require separate permission. The strict controlledCamera capability remains unadvertised. U09 is merged as PR28 and U10 as PR29; U11 is released; U12 and later units remain undispatched.

**Outcome and write scope.** Remove use-native-controlled-camera and its observers/scheduling from both native maps/refs. Keep changed viewState targets, imperative commands, constraints, reset fixes, load guards, and error handling. Migrate camera/release fixtures from ignored-proposal rollback expectations to explicit target/command behavior and observed state. Preserve the native camera context shape and overlay/native UI consumers; both viewState and observedViewState carry observations rather than the application target. A native target A followed by user movement to B stays at B while A is unchanged, including a fresh equal-valued object. Changed target C and explicit jumpTo(A) remain requests; removing viewState releases the target.

**Proof.** Mocked tests cover changed versus unchanged targets, release of control, explicit jumpTo reapplication, commands after movement, teardown, and errors. Preserve native location-follow ownership checks and all web controlled behavior. Do not advertise missing getters, fit-cap support, or animation completion. Do not remove native SDK camera patches that fix ordinary dispatch/reset. Run camera converter, native adapter, reconciliation replacement, type and example checks.

### U09: Delegate feature-state lifetime

**Status.** Merged as PR28. The [U09 evidence](../records/evidence/revised-api-u09-feature-state.json) owns scope, provenance, audit and routine results. It distinguishes passing original checks and covered main publication checks from the two unchanged baseline wrapper-callback import failures in the full main web/unit suite. Original and main fixtures and existing patches differ; the record preserves those artifact boundaries. The Kotlin source-lifetime static stub was skipped because its cached compiler was absent; no bridge or patch changes, native build, or installation were performed. Real feature-state lifetime, renderer, browser, Metro, and native linking acceptance remain unverified and require separate permission. U12 and later units remain undispatched.

**Outcome and write scope.** Remove NativeFeatureState reset journals, queues, style reset/flush scheduling, and the same-ID source-remount clearing promise. Simplify both native feature-state method modules and registration effects. Keep registries needed by source/cluster/state dispatch, owner-bound cleanup, current ref lookup, validation, immutable argument capture, and SDK errors. Update the query contract and state/lifetime examples together.

**Proof.** Test explicit set/get/key removal/whole-state removal, GeoJSON/vector routing, missing and replaced refs, unrelated sources, errors, and argument mutation. Replace automatic-reset expectations with renderer-owned lifetime and application state ownership. Do not promise cancellation of an SDK call already sent or add a shadow state cache. Render-frame callbacks still serve map capture at this point; preserve their capture.frame calls. Run state, source-registry, adapter, query/lifetime-fixture, type and example checks.

### U10: Migrate and remove common map capture

**Status.** Merged as PR29. The [U10 evidence](../records/evidence/revised-api-u10-map-capture.json) owns the reviewed original and main publication scopes, routine outcomes, inherited baseline failures, artifact provenance, and remaining verification limits. Current-map capture callers use selected wrapper access; independent snapshot services and their shared image-output helpers remain for U12. Original advanced rendering, global-state, native model and service scenes retain PNG observations; the older main publication fixtures retain their narrower scene scope. Renderer, browser, Metro, native build/install, output inclusion and file behavior remain unverified for the changed artifact and require separate permission. U12 and later units remain undispatched.

**Outcome and write scope.** Migrate capture callers to selected wrapper access, then remove MapRef.capture, captureEnabled, MapCaptureGate, capture-only listeners, and ref/factory parameters. Inspect the advanced rendering, global-state, model, and service scenes, not only the capture sample. Keep current independent snapshot services until U12.

**Proof.** Preserve rendered-observation intent for retained rendering tests using application/SDK capture where required. Retire common capture guarantees explicitly, rather than deleting the visual assertion that happened to use capture. Type-check native file/base64 and web buffer option routes; mock the app-owned error/ref handling. Neither this unit nor application examples promise uniform overlay inclusion, dimensions, files, or deadline behavior. Shared image-output functions remain if independent snapshots still use them. Run capture-call-site, rendering-fixture, adapter, type, build, and package checks.

### U11: Migrate offline use and remove the common manager

**Status.** Implemented and audited; applicable routine verification is recorded, and automatic commit and PR creation are authorized under the unit workflow. The [U11 evidence](../records/evidence/revised-api-u11-offline.json) owns original and main publication provenance, bounded routine outcomes, inherited publication failures, and the repaired cross-screen observer race. Application commands preserve existing IDs, user metadata, native operation keys, and imported aliases through read-only discovery; malformed and ambiguous metadata remain visible. A per-SDK observer slot rejects replacement claims while ownership or pending setup/create remains, without automatic queueing or retry. These routine checks establish no live database preservation claim. Live offline downloads, imports, cache/database operations, renderer execution, and native builds/installations are unverified and require separate permission. Location and independent image services remain; U12 and later units remain undispatched.

**Outcome and write scope.** Convert necessary application examples to selected managers and remove common OfflineService/OfflinePack types, MapServices.offline, shared offline-service, backend service conversions, and obsolete normalized-manager tests. Keep raw wrapper exports and current patches. Add a small application-owned reader for existing facade metadata only if the example/application needs it; do not recreate the common subscription manager outside the library.

**Proof.** Unit fixtures establish preservation of old oneMapReactOffline IDs, user metadata, native names/generated IDs, imported backend aliases, duplicate/malformed metadata reporting, and no writes during discovery. Check installed SDK argument/callback shapes and necessary application subscription teardown. Preserve persisted packs after failed creation; avoid automatic delete, rename, database reset, or redownload. Live download/import/cache/database operations are outside routine checks and require separate approved execution if needed. Historical service outcomes remain historical.

### U12: Remove common independent snapshots

**Outcome and write scope.** Migrate required independent image examples to WrapperSnapshotManager/WrapperStaticMapImageManager and remove MapServices.staticMapImage, shared snapshot/capture types, associated conversions, and image-output code that has no retained owner. Keep both raw managers, current patches, and application-specific output/error handling.

**Proof.** Selected declaration probes verify zero zoom, bounds ordering, output choices, dimensions, and manager names against the installed packages. Retire only common format/dimension/scope guarantees. Search for image validators shared with still-retained operations before deletion. Keep LocationService and MapServices.location until U18 so intermediate builds remain valid. Run service/image, affected fixture, type, build and package checks; no native snapshot execution.

### U13: Remove common popup composition

**Outcome and write scope.** Migrate web consumers to WrapperPopup and native consumers to a screen-owned bubble in Marker or a selected annotation/Callout. Remove the common Popup component, props, adapter field, selected facade aliases, and only the associated web/native composition. Keep native marker hosts and portal ownership.

**Proof.** Preserve the actual migrated application's close affordance, accessibility and lifetime through its application tests. State which old common dismissal/focus/width guarantees no longer apply. Keep raw SDK exports and source/marker interaction tests that remain relevant. Native bubble touches and provider/state retention remain later integration gates. Run UI/host/wrapper callback, type/build and example checks; leave the shared map subscription facility until its other consumers are gone.

### U14: Remove common navigation and fullscreen controls

**Outcome and write scope.** Move web navigation/fullscreen consumers to Wrapper components and native camera buttons to ordinary screen UI. Remove the two common components, props, adapter slots, selected facade aliases, constructor guards, and now-unused navigation readback logic. Keep camera methods and native SDK compass options.

**Proof.** Example button tests cover accessible activation, unavailable map/error handling, and its intended camera command. Preserve camera getter correctness tests independently of retired NavigationControl. Native FullscreenControl rejection disappears with the removed common API; upstream browser fullscreen remains selected. Update custom adapter fixtures when fields are removed. Run UI, camera, host, type/build, and affected packed checks.

### U15: Delegate scale and attribution ornaments

**Outcome and write scope.** Move web scale/attribution to Wrapper components and native presentation to selected SDK ornaments plus screen-owned supplemental text where necessary. Remove common ScaleControl/AttributionControl, their props/adapter slots/aliases, scale calculation/readback, and common attribution override state. Keep SDK defaults and explicit selected options.

**Proof.** Mocked forwarding and example tests preserve visible attribution configuration, legal text, supported SDK scale enablement, and application placement. Native positions and units are documented platform behavior; unsupported common width requests are no longer accepted via a deleted type. Do not remove the RNMapbox SDK scale-position refresh workaround while selected scale position/resize behavior still depends on it. Control stacking remains until U17. Run UI, ornament option, host, type/build and selected checks.

### U16: Remove common geolocation control and follow controller

**Outcome and write scope.** Web examples use WrapperGeolocateControl; native examples use an application button and the application's location integration. Remove common GeolocateControl, its props/adapter field/aliases, use-geolocation-control, and common follow/coalescing logic. Keep display-only UserLocation and raw SDK pucks/follow facilities. Library location services still exist for remaining callers until U18.

**Proof.** Migrate or retire each acquisition/follow fixture explicitly. Application tests cover the policies it chooses, including owned cancellation, disposal, and failure paths; avoid a mandatory replacement follow controller. Preserve display geometry/accuracy tests and native map locationOptions ownership constraints. Confirm web Wrapper controls no longer route through MapSetup location overrides. Run location/UI, native service, application, type/build and relevant selected tests.

### U17: Remove common control layout

**Outcome and write scope.** Move any remaining Control children to their application layout and remove common Control, NativeControl, web custom-control composition, overlay row registration/measurement, and automatic SDK ornament avoidance. Remove NativeOverlayContext and control-only placement state. Retain marker overlay host names, viewport size, portal setup, observed camera movement, and selected ornament option forwarding.

**Proof.** Check that all built-in control compositions were removed before deleting their internal host. Application examples retain providers and state by their own sibling layout, accessible buttons, safe-area/attribution spacing, resize, and multiple maps. Do not claim a portal dependency removal while native live markers still use it. Run native/web UI, map-context, host, selected-option, type/build and consumer checks. Preserve SDK scale refresh until U23 can assess its actual removal condition.

### U18: Remove library acquisition and service contexts

**Outcome and write scope.** Move remaining location callers to app/SDK code, then remove useMapServices, MapServices, MapSetup.locationProvider, Adapter.services, service contexts/scoping, native/web acquisition factories, and acquisition-only types/helpers. Native services.ts files can disappear once U11/U12 removed their other responsibilities. Migrate custom adapter constructions and compiler/unit/package fixtures together.

**Proof.** Keep GeolocationPosition, UserLocationProps, and validation/geometry needed by display-only UserLocation. Do not discard coordinate validation or unit meaning with the acquisition functions. Removing a MapSetup no longer disposes app services; the owning application must dispose its own work. Verify common imports need no service manager, no sensor work starts from retained rendering, and backend peer isolation still holds. Preserve SDK manager aliases; no global stop/removeAllListeners is added to examples. Run display, setup/context, application, type/build and package-selection checks.

### U19: Use map feature clicks only

**Outcome and write scope.** Move shared source callbacks to Map.onClick plus interactiveLayerIds. Remove Source.onClick, SourceClickEvent, facade/native source callback registries and synthetic bubbling, selected facade hitbox additions, and UserLocation.onPress. Display-only UserLocation no longer installs a source click handler. Keep raw wrapper source APIs and retained source-ref registries.

**Proof.** Native filtered clicks still query the actual map point, produce shared feature results, propagate SDK errors, and suppress obsolete asynchronous callbacks after detachment/replacement. Web can use the wrapper's feature event where equivalent; do not drop necessary normalization. Tests cover multiple sources/layers and per-map routing. Applications needing pressable location geometry use known IDs through Source/Layer and map clicks, not a new registration API. Run interaction, source-hit, query, display, context, adapter, type and consumer checks.

### U20: Bind Images to one style lifetime

**Outcome and write scope.** Keep shared image entry updates/removals within a style, initial usable-style waiting, failures, ownership and cleanup. Remove automatic replay/retry into replacement styles and update maintained consumers to remount Images after onStyleLoad. Inspect both native wrappers' normal restoration and the web registration implementation; document normal backend differences rather than suppressing upstream behavior to enforce uniformity.

**Proof.** Check initial/missed style load, ordinary styledata, same-style updates, replacement, explicit keyed remount, sprite-name conflicts, rapid A/B/A changes, failure, unmount/reuse, and obsolete loads. An old instance must never add/remove an image owned by the replacement style. A callback-triggered replacement cannot redirect work into a new owner. If safe ownership still requires substantial machinery, report the actual retained code and stop for a scope decision; do not weaken cleanup to meet a deletion goal. Run web/native image adapter, lifecycle, declaration and example checks; renderer image checks remain open.

### U21: Remove orphaned private coordination

**Outcome and write scope.** Search remaining readers of map interaction subscriptions, session camera/constraint fields, native location-follow presentation state, and native camera contexts. Delete only unused private pieces left by U07-U20. Keep ready/ref access, named maps, native marker projection/layout observations, and asynchronous filtered-click safety. Consolidate the observed camera representation if no retained caller needs the old target/observation split.

**Proof.** Treat this as bounded ownership cleanup, not a new architecture or file-reorganization project. Retain current callbacks during concurrent/suspended renders, logical unmount cleanup during web reuse, multiple-map isolation, source queries and marker projection. Run context, callback, lifetime, interaction and native UI tests plus types/build. Demonstrate each deletion by its removed readers; no generic replacement event bus, controller, or context inspector is introduced.

### U22: Audit the final public and consumer surface

**Outcome and write scope.** A review-focused unit checks the eight root runtime exports, retained types, smaller Adapter shape, selected getter signatures, raw exports, aliases, custom adapters, maintained examples, compiler/fixture checks, and package documentation. Each earlier unit must already compile; this is the final cross-surface audit, not a place to park broken callers.

**Proof.** Positive and negative packed/declaration cases cover every deliberate removal, common import safety, selected native drag restrictions, and both mixed selections. Confirm examples use app-owned services rather than relocated common service frameworks. Keep retained advanced-rendering observations and meaningful unit regressions while retiring obsolete common-service/drag harness entry points. Reconcile the existing checklist and migration document without rewriting historical results. New substantive runtime findings go through reviewed rework with an explicit bounded scope.

### U23: Review patches and peers before changing them

**Outcome and scope.** A read-only reviewer maps every active patch section to a retained core behavior, raw selected facility, delegated app service, build/linking requirement, or obsolete guarantee. Inspect duplicate supported RNMapbox patch versions and actual consumer peer constraints. Report keep/remove/upstream-fix-needed recommendations and consequences; change no patch, peer range, lockfile, or linked artifact by default.

**Proof.** Distinguish service abstraction removal from an upstream service bug. Keep per-map event isolation, ordinary camera dispatch/reset, source/query/state error propagation, and codegen/linking repairs while required. Native scale refresh and the marker portal remain until their retained uses are resolved. A removal requires an explicit owner-approved follow-up unit with affected static checks and later scoped builds/runtime verification. Do not certify the development host as the release baseline.

### U24: Freeze a candidate and prepare acceptance

**Outcome and write scope.** The coordinator integrates all approved work, runs applicable accumulated routine checks, records measured code moved/deleted and dependencies retained, builds/packs the agreed breaking candidate, and freezes its hashes, patches, selected peers, host versions, harness, and application binaries/build inputs. Current candidate evidence remains separate. Confirm no known substantive implementation/review issue remains.

**Proof.** Full applicable routine web/unit and mocked native suites, types, library/example build, common/selected packed consumers, aliases, mixed resolution, and relevant standalone/compiled-fixture checks pass or have an explicit independently bounded baseline disposition. No retained-contract test is merely removed to make the candidate green. Prepare exact acceptance commands from the migrated harness; commands and duration are intentionally not invented in this plan because scenario entry points are being changed.

**Owner decision.** Present the candidate, named scenarios, six affected environments or justified subset, exact commands, expected elapsed time, resource assignments, open gates, and retry/artifact scope. Obtain explicit acceptance permission. Until then, stop before renderer execution and report integration as unverified. A package archive or successful routine check is not publication or renderer acceptance.

### U25: Execute approved web checks

**Outcome and scope.** After the owner approves the prepared commands and artifact, dispatch fixed web smoke workers using GPT-6 Luna (gpt-6-luna) with low reasoning under the [worker policy](testing-policy.md#smoke-workers-and-models). Give Mapbox web and MapLibre web separate ports, browser profiles and Vite caches. Parallel execution is allowed only within that explicit scope. Workers do not change production code or choose retries.

**Proof.** Observe retained source/layer/image rendering, camera behavior, filtered clicks/queries/clusters/state, explicit style/image transitions, wrapper access, migrated browser UI, logical unmount/reuse, and both mixed selection paths where affected. Preserve first-attempt failures and artifact identity in compact evidence. Stop on unexpected failures and return diagnosis to the coordinator. User sign-off on results is required before proceeding to native execution; web permission alone does not authorize native builds or installs.

### U26: Execute approved native checks

**Outcome and scope.** Obtain the separately specified native build/install/flow authorization if not already included explicitly. One GPT-6 Luna (gpt-6-luna) worker at medium reasoning owns Metro, native build directories, simulators/emulators, installation and input tools. Run the approved RNMapbox iOS/Android and MapLibre iOS/Android targets sequentially. Other workers cannot touch those shared resources.

**Proof.** Verify the installed artifact/host and actual drawing/query results, unchanged targets allowing gestures, explicit camera targets, native drag rejection, marker buttons/scrolling/annotation refresh, multiple maps, image replacement/remount, source/state lifetime observations, and migrated screen controls/attribution. Raw-ref capture used for observing retained rendering needs evidence for that use; it does not revive the deleted common capture guarantee. No physical-device or full assistive-technology certification is inferred. Unexpected failure stops the worker; changed artifacts and retries require the relevant new permission.

### U27: Complete evidence and hand over

**Outcome and write scope.** The coordinator reviews the approved renderer results against every retained contract and open gate, reconciles migration/public docs and the existing support matrix, and removes temporary consumers, caches, unused binaries and nonessential raw logs under the retention policy. Preserve compact provenance and the recovery information for existing offline data.

**Proof and owner decision.** Report implementation complete, routine results, actual renderer evidence, deliberately excluded behavior, remaining gaps, actual code/dependency movement, and any migration risks. Unfinished retained behavior remains unfinished; do not relabel it unsupported at the end. Owner sign-off accepts this result and its verification limits. The current unit PR workflow above governs commits, pushes, and PR creation. Package publication, merge, and tagging require separate authorization; commits use the repository's Conventional Commit subject and bullet summary.

## Routine verification menu

These are command routes inspected in the U01 working basis from [package.json](../package.json), [Vite configuration](../vite.config.ts), and [Jest configuration](../jest.config.cjs). They are proposed execution instructions for approved units, not results of this documentation task. Inspect them again at dispatch, including nested scripts, for accidental acceptance execution. Use focused cases for the unit; broaden once for final integration unless new failures or substantive changes justify more checks.

```sh
bun run check
bun run check:docs
bun run typecheck
bun run typecheck:apps
bun run build
```

For focused routine tests, use the existing local runners with a real file path from that unit's refreshed inventory. For example, before its contract is changed, the native UI suite can be selected directly:

```sh
./node_modules/.bin/jest --runInBand --runTestsByPath packages/one-map-react/test/tf07-ui.native.test.tsx
```

The corresponding ordinary Vitest route for web/unit cases is:

```sh
./node_modules/.bin/vp test run packages/one-map-react/test/map-interactions.web.test.tsx
```

Use the build/packed consumer/peer/example-resolution scripts with their actual discovered options for export changes. Final integration uses the applicable full routine suites, package checks, and compiler coverage. Inspect the long root test/validate chains before running them; a script's historical name or a `.test` suffix alone does not establish whether it starts a renderer. Native builds, Expo/Metro renderer transport, browser scenarios, live storage/sensor operations, and simulator/emulator input remain outside these routine test instructions.

## Ready-to-dispatch assignment template

Use this compact template for approved routine implementation work. Fill the actual paths, commands and base; do not send placeholders as an implementation assignment. U25/U26 use dedicated smoke-worker instructions containing their explicitly approved renderer commands and build/install permissions instead of this template's prohibition on renderer execution.

```text
Implement only <approved unit and outcome> from the approved plan.
Base: <workspace path, current revision/workspace identity, relevant hashes>.
Allowed writes: <exact files and necessary agreed caller/test closure>.
Read: <current instructions, approved contract, connected owners/callers>.
Retain: <specific behavior and resource/error/teardown guarantees>.
Remove or migrate: <specific APIs, consumers, fixtures, and old expectations>.
Routine checks: <exact allowed commands; no acceptance execution>.
Do not change peers, patches, unrelated files, or start the next unit.
Do not commit, publish, build/install a native app, or retry renderer runs.
Return the concrete diff, checks and first failures, retained/retired tests,
consumer consequences, actual code movement, risks, and unverified gates.
Then return for coordinator review under the unit PR workflow above; leave the successor undispatched until owner sign-off.
```

The reviewer receives the same base/contract, the completed diff and check outputs, a read-only assignment, and explicit instructions to trace callers, replacement, stale work, errors, teardown, and deliberate exclusions. The coordinator keeps the owner gate; agents do not chain their own successor tasks.
