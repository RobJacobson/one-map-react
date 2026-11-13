# Camera, marker, feature-state, and control contract review

**Superseded control-layout alternative.** The [current control-layout unit](revised-api-implementation-plan.md#u17-remove-common-control-layout) removes the common layout and ornament-avoidance machinery described below. This review preserves its original analysis and recommendations.

**Working feature-state overlay.** U09 migration is implemented and audited, with routine verification recorded under the [renderer-owned lifetime contract](revised-api-proposal.md#camera-and-feature-state-guarantees); the [query record](tf06-queries.md) explains the working semantics and its separate verification status. Reset guarantees, outcomes, and instructions below apply only to their historical artifacts; renderer acceptance for the changed implementation is unverified.

**Working native camera overlay.** The [agreed camera contract](revised-api-proposal.md#camera-and-feature-state-guarantees) gives native viewState changed-target semantics, with observations driving events and readouts. U08 migration is merged as PR27; [routine verification is recorded](../records/evidence/revised-api-u08-native-camera.json). Historical rejection, release, clamping, command-overlap outcomes, and rollback-specific native probe instructions below belong to their recorded artifacts; that rollback probe is retired in the working native fixtures. These records do not verify the changed implementation; its renderer acceptance is unverified. Web controlled behavior remains delegated.

**Historical broader alternative.** The [agreed migration contract](revised-api-proposal.md) supersedes this review's recommendation to retain common native dragging. U07 removal is implemented and audited with routine verification recorded; its retained native marker interactions require new touch acceptance. The mechanisms and proposed checks below describe the pre-removal implementation.

The [revised API and migration proposal](revised-api-proposal.md) defines the narrower alternative with application-owned services and explicit feature exclusions. This review retains the broader feature-preserving alternative and its supporting investigation.

**Proposal only.** Preserve every applicable component, prop, event, and operation through the unified interface or its existing named backend extension. Simplify native camera ownership and feature-state lifetime where the selected wrapper already supplies a usable contract. Retain compatibility code that provides a feature absent from the wrapper, including live-marker dragging and complete scale controls. No runtime code or existing contract changes in this review.

The [requirements](requirements.md) remain authoritative until a proposal is adopted. The [coverage checklist](api-coverage.md) remains the sole coverage ledger; this review proposes changes to behavior and ownership without marking implementation work complete. A raw wrapper export does not replace a promised shared feature. Existing unsupported boundaries and deferred work remain visible.

## Review basis

Inspected on October 21, 2026: the current first-party contracts, adapters, and regression tests; installed react-map-gl 8.1.3, RNMapbox 10.3.8, MapLibre React Native 11.5.0, and Teleport 1.2.2 source. The [support matrix](../records/support-matrix.json) owns release hosts, minimum versions, and exact patches. RNMapbox 10.3.7 remains a supported minimum and a required verification target for any implementation; its replacement paths were not freshly executed here. The installed native source files inspected include `Camera.tsx`, `MarkerView.tsx`, `PointAnnotation.tsx`, MapLibre's `Marker.tsx`, `ViewAnnotation.tsx`, and both source-family components. Historical comparisons and equivalent examples remain in [maps and camera](maps-and-camera.md), [markers and controls](markers-and-controls.md), and [queries and feature state](tf06-queries.md).

Source inspection establishes the current mechanisms. Proposed deletions and replacement paths below have not been implemented or renderer-tested. Existing acceptance belongs to its recorded artifacts and does not verify these proposals.

## Recommended decisions

1. Use native `viewState` as an application camera target, with native movement reported as observed state. Remove automatic rollback after a rejected proposal only after adopting this explicit behavioral change.
2. Keep live markers, annotation mode, dragging, activation, popups, and authoritative coordinates. Separate live and annotation implementations. Evaluate SDK-positioned live hosts while retaining the custom drag behavior that the wrappers do not expose.
3. Keep `setFeatureState`, `getFeatureState`, and `removeFeatureState`, with renderer-owned retention across source/style changes. Remove automatic facade reset journals only after adopting that lifetime change.
4. Keep every control and its options. Allow ScaleControl.maxWidth updates already handled by the adapters, and compute native control offsets and ornament insets in one placement owner. Retain portals, accessibility, asynchronous navigation guards, and the composed scale.

The camera and state decisions change existing guarantees. The marker and control recommendations preserve existing features, with scale width updates becoming less restrictive; replacement paths require evidence. None of these decisions adds a backend-selection flag, a second camera mode, a state-retention option, or a general lifecycle controller.

## Camera

### Current behavior

Native `viewState` currently has two writers: declarative camera props and the imperative corrections in [useNativeControlledCamera](https://github.com/RobJacobson/one-map-react/blob/7d440810570983140735945e69351a1d3d09b275/packages/one-map-react/src/adapters/shared/use-native-controlled-camera.ts). The hook observes movement, waits for application state to commit, restores rejected proposals, suppresses clamping feedback, and coordinates public commands through callbacks in both native map refs. Web delegates controlled behavior to react-map-gl. The [public camera contract](../packages/one-map-react/src/contracts/map-types.ts) documents native reconciliation; strict native `controlledCamera` remains unavailable.

The correction loop is required by the current rollback guarantee. It is not dead code. [react-map-gl controlled state](https://visgl.github.io/react-map-gl/docs/get-started/state-management) lets applications decide whether to accept a movement proposal. The inspected native cameras expose target props and imperative commands rather than that browser proposal mechanism; see the [MapLibre camera API](https://maplibre.org/maplibre-react-native/docs/components/camera/) and the [versioned camera comparison](maps-and-camera.md#maps-and-camera).

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| Camera props use centerCoordinate, zoomLevel, heading, and pitch; commands use setCamera. | Camera props use center, zoom, bearing, and pitch; commands use camera methods. | Controlled camera delegates through viewState/top-level camera props. | Keep existing field conversion, initialViewState, viewState, and all camera commands. |
| Gesture events report native movement. | Region events report native movement. | Controlled callbacks can carry proposed state. | Native onMove reports observed state. An unchanged native viewState does not veto gestures or imperative commands. |

### Proposed contract and simplification

Apply `initialViewState` once. Forward committed changes to native `viewState` through the existing camera props. Let the native SDK own gesture movement, animation, and constraint enforcement. Changing the native target moves the map; keeping that target unchanged does not continually reapply it. To reapply identical coordinates, use the existing `jumpTo` command. Web keeps react-map-gl's controlled semantics. Preserve normalized events, units, validation, availability errors, and promise-based dispatch acknowledgement.

Remove the correction hook and its movement/load scheduling, target-key latch, clamping feedback suppression, and public-command observer plumbing from the two native maps and refs. Keep each adapter's camera conversion, load guard, bounds/reset repairs, and immediate-camera patch. This proposal does not make missing native getters or native fitBounds.maxZoom complete.

Native presentation must then use the observed camera for compass, scale, and other readouts. Consolidate `NativeCameraContext.viewState` and `observedViewState` around observations, keeping the application target in props. Otherwise controls could display an old requested camera while the renderer has moved. Preserve the single-owner rule for native location following and explicit camera targets.

**Consumer consequence:** With viewState centered at A, dragging to B while ignoring onMove would leave a native map at B. A web controlled map can reject B. Applications implementing arbitrary geofences by ignoring proposals must use native constraints or explicitly issue a correction command. Automatic native rollback is the guarantee being removed; this is a contract change, not a behavior-preserving refactor. If automatic rollback is required, retain the existing hook.

### Affected paths and verification

Implementation would reach both native `map.tsx` and `map-ref.ts` files, `use-native-controlled-camera.ts`, `native-map-presentation.tsx`, `contracts/map-types.ts`, the camera documentation, and the shared camera/release fixtures. Preserve declarations and selected camera facilities. Replace rollback/clamping-loop expectations in [camera reconciliation tests](https://github.com/RobJacobson/one-map-react/blob/7d440810570983140735945e69351a1d3d09b275/packages/one-map-react/test/native-controlled-camera.web.test.tsx) with assertions for changed targets, unchanged targets during gestures, explicit reapplication, released targets, observed control state, and errors/teardown. Retain the converter and native adapter command tests. Later acceptance must observe actual movement, readback, constraints/reset, and command/gesture interaction on both native engines and OSes; web controlled rejection remains independently covered.

## Markers and popups

### Current behavior

Common live markers and standalone popups use [NativeMarkerOverlay](../packages/one-map-react/src/adapters/shared/native-marker-overlay.tsx), which projects each coordinate through the bridge after camera/layout changes and positions children in a portal. [useNativeMarkerDrag](https://github.com/RobJacobson/one-map-react/blob/90e54f104777b2c2910aa9ee9636006170934996/packages/one-map-react/src/adapters/shared/use-native-marker-drag.ts) supplies long-press dragging, projection ordering, gesture locking, foreground cancellation, and child-scroll handling. Annotation mode already delegates to the SDK annotation wrappers, with offset conversion and refresh.

Neither inspected native live-marker prop interface declares dragging. MapLibre distinguishes its [interactive Marker](https://maplibre.org/maplibre-react-native/docs/components/annotations/marker/) from [ViewAnnotation](https://maplibre.org/maplibre-react-native/docs/components/annotations/view-annotation/), whose Android children are bitmaps. Replacing a draggable live marker with an annotation would remove interactive content. The [portal decision](decisions/0007-native-control-portals.md) also records actual native child-touch failures that motivated the current overlay. Wrapper documentation alone does not establish that a replacement fixes those failures.

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| MarkerView provides live children; PointAnnotation provides native annotation dragging and refresh. | Marker provides live children; ViewAnnotation provides dragging and refresh, with Android bitmap content. | Marker provides DOM children and dragging. | Keep renderMode=view as live content and renderMode=annotation as the explicit static-content choice. Keep draggable and every drag callback. |
| Anchor needs conversion; live offset needs composition. | Named anchor and offset are wrapper props. | Named anchor/offset and coordinate setters. | Keep current geometry, activation, default pin, coordinate ownership, and selected annotation/collision facilities. |

### Proposed simplifications

First separate the live and annotation implementations inside the existing native UI module. Only the live path should initialize the custom drag hook, its AppState subscription, and live projection work. Keep annotation refresh and SDK drag callbacks on the annotation path. A shared coordinate/anchor/offset conversion is sufficient; a general marker controller would add another interface.

Next evaluate RNMapbox MarkerView and MapLibre Marker as the positioning hosts for all live markers and standalone popups. Retain the current custom live-drag hook because those live hosts have no corresponding draggable prop. Adapt RNMapbox offset using measured content/anchor composition, preserve the current common visibility behavior explicitly, and retain one activation path. Use the same live host when draggable changes so children do not remount during a prop update. Preserve host props, current providers, child state, authoritative coordinate restoration after drag, and explicit annotation mode.

If both engines pass the replacement checks, delete the common per-camera projection overlay and its offscreen-sentinel handling. The SDK would position live content, while the drag hook would still use project/unproject for gesture coordinates. This removes repeated bridge positioning work without removing live dragging. It does not remove Teleport while controls still need it.

**Consumer consequence:** The recommended marker contract remains unchanged. Native long-press activation, gesture slop, event frequency, and visual presentation can differ from the browser. Children must remain interactive in live mode. Keep the current annotation remount/coordinate-restoration workarounds until a replacement preserves activation and rejected-coordinate behavior; native selection toggles alone do not establish equivalent onClick delivery. Native callouts remain distinct from shared standalone popups.

### Affected paths and verification

Implementation would reach `shared/native-ui.tsx`, both native `ui.tsx` host mappings, `native-marker-overlay.tsx`, and the native UI fixtures/tests. Reuse [existing marker regressions](../packages/one-map-react/test/tf07-ui.native.test.tsx) for default content, providers, child state, offsets, anchor measurement, dragging, coordinate rejection, stale results, refresh, popup lifetime, and teardown. Add an assertion that annotation mode starts no live-drag subscription and that toggling live draggable preserves child state.

The SDK-host replacement remains proof-gated. Approved later native acceptance must cover child buttons and scrolling, physical long press, Home interruption, second contact, gesture recovery, drag-coordinate rejection, offscreen movement, offsets at two Android densities, multiple maps, style replacement, and viewport/orientation changes. Check RNMapbox 10.3.7 as well as 10.3.8. If one host fails, retain its existing overlay and documented workaround; do not turn that failure into an unsupported common marker feature.

## Feature state

### Current behavior

Set/get/remove already dispatch to the SDK. [NativeFeatureState](https://github.com/RobJacobson/one-map-react/blob/55e9f9268971a731e20e7e3f0658262a90cad182/packages/one-map-react/src/adapters/shared/native-feature-state.ts) additionally serializes operations, tracks written feature identifiers per source family, and automatically clears them after source recreation or style replacement. It retries attachment gaps on rendered frames and retains failed reset obligations. The [public state contract](https://github.com/RobJacobson/one-map-react/blob/55e9f9268971a731e20e7e3f0658262a90cad182/packages/one-map-react/src/contracts/query-types.ts) explicitly promises that behavior, and [state lifetime tests](https://github.com/RobJacobson/one-map-react/blob/55e9f9268971a731e20e7e3f0658262a90cad182/packages/one-map-react/test/native-feature-state.test.ts) protect it.

The bookkeeping stores written targets rather than a duplicate state-value store. Its main cost comes from the automatic reset promise. MapLibre's [source state API](https://maplibre.org/maplibre-react-native/docs/components/sources/geo-json-source/) also distinguishes dispatch from a rendered removal; an immediate read can still see removed keys.

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| State operations dispatch through MapView with source/feature arguments. | State operations dispatch through the mounted GeoJSON/vector source ref. | State operations dispatch through the map with an identifier object. | Keep setFeatureState, getFeatureState, and removeFeatureState with the existing common identifiers, validation, and result shapes. |
| Native replacement can retain same-ID state. | Native replacement can retain same-ID/family state; removal visibility follows rendered frames. | Retention follows the web style/source implementation. | State lifetime follows the selected renderer. React keys and style callbacks do not imply facade-owned resets. |

### Proposed contract and simplification

Remove automatic reset on source remount, family changes, and style replacement. Preserve the selected renderer's retention behavior and direct operation timing. Applications own the state they want to restore or clear; use the existing removeFeatureState operation for explicit clearing. Keep key removal, whole-feature removal, vector source-layer identity, validation, and SDK error propagation. Do not add a resetOnReplace option or another retained-state cache.

This permits removal of the written-target journals, sticky reset failures, automatic frame flushes, and the queue needed to order those resets. Retain source-ref registries for cluster and source queries and for MapLibre state dispatch. Keep owner-bound registry cleanup and the attachment checks that prevent new work from using a retired ref. Mapbox vector registration currently used solely for state-reset bookkeeping could disappear; its rendering and source-click handling remain.

Calls already dispatched to a native SDK cannot be retroactively cancelled. They retain that SDK's ordering and resource-lifetime behavior. Avoid resolving old results into facade UI or scheduling new work after detachment; retain map/source attachment guards where the adapter owns that asynchronous work. Caller-issued concurrent operations do not gain cross-renderer transaction semantics. Applications needing a particular sequence should await dispatch and use the appropriate renderer observation where visibility matters.

**Consumer consequence:** Set selected=true on a feature, then remount its Source with the same renderer ID. Under this proposal the value may remain or disappear according to the renderer; the facade no longer clears it automatically. Code relying on an empty state after a React key or style change must explicitly clear/reapply application state. This removes a cleanup guarantee and its implicit writes, without removing set/get/remove functionality. A failed SDK operation remains a failure rather than an empty successful result.

### Affected paths and verification

Implementation would reach `native-feature-state.ts`, both native feature-state method modules and source registries, native source registration effects, both native map style/frame callbacks, `contracts/query-types.ts`, and the query/lifetime fixtures and documents. Keep capture.frame delivery when removing state flushes from rendered-frame callbacks. Do not delete native error-propagation patches merely because automatic cleanup no longer needs its attachment-gap classifier.

Replace reset-policy tests with forwarding, immutable argument capture, explicit key/whole-feature removal, source-family dispatch, attachment failure, and teardown assertions. Retain query/cluster and unrelated-source regressions. Renderer tests must establish each backend's actual retention after same-ID remount, style replacement, and GeoJSON/vector round trips, plus explicit removal and visible feature-state styling. Accept documented backend outcomes instead of asserting that every remount empties state. Native SDK failures must still reach callers, including when a source is unavailable.

## Controls

### Current behavior

The [native UI module](../packages/one-map-react/src/adapters/shared/native-ui.tsx) composes navigation, scale, geolocation, popup dismissal, and custom controls. Control children use portals to preserve their original React ancestry. NativeControl computes each row's offset from neighboring registrations; [ornament positioning](https://github.com/RobJacobson/one-map-react/blob/0424acf55aff09f7fc26e33121caf4a26319c486/packages/one-map-react/src/adapters/shared/native-ornament-position.ts) separately totals those rows. [Native presentation](../packages/one-map-react/src/adapters/shared/native-map-presentation.tsx) owns their registrations and measurements.

These compositions supply real shared features. React-map-gl's [ScaleControl](https://visgl.github.io/react-map-gl/docs/api-reference/maplibre/scale-control) exposes width and unit options. The inspected RNMapbox 10.3.8 map has scaleBarUnits, but its native scale props do not cover the complete shared width contract; MapLibre's inspected map exposes scale visibility/position, with an Android corner restriction. A universal switch to SDK scale bars would lose supported shared requests. Keep the composed scale rather than adding default/fallback render paths.

The shared [ScaleControl creation guard](../packages/one-map-react/src/facade/ui.tsx) rejects maxWidth changes, although both inspected react-map-gl 8.1.3 scale components update that option and the native composition already recomputes when maxWidth changes. The [web wrapper source](https://github.com/visgl/react-map-gl/blob/v8.1.3/modules/react-maplibre/src/components/scale-control.ts) and native effect support relaxing this restriction without replacing either implementation.

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| Native ornaments plus camera methods; arbitrary corner UI needs a host. | Native ornaments plus camera methods; arbitrary corner UI needs a host. | SDK controls and DOM control containers. | Keep Control, NavigationControl, AttributionControl, ScaleControl, GeolocateControl, and FullscreenControl with their current applicable behavior. |
| SDK placement and native host layout. | SDK placement and native host layout. | Browser control layout. | Preserve common corner stacking and explicit positions. Allow host appearance and platform defaults to differ. |

### Proposed simplification

Remove maxWidth from the shared ScaleControl creation-only check, keeping position and genuinely immutable constructor settings guarded. Update its declaration comment to describe mutable width, and retain native positive/finite validation and wrapper validation. A change from width 100 to 200 should use the existing update paths without a new React key; do not introduce automatic remounting or another width-setting API. Rendering follows each wrapper's normal update timing.

Compute one derived placement snapshot when the existing registration/height map changes. Place that pure calculation in `native-map-presentation.tsx`: it supplies each control's offset and each corner's total ornament inset. NativeControl and the native map adapters read the same result, instead of independently reconstructing order and sums. Retain the current registration order, bottom-corner reversal, eight-point gaps, restoration after removal, and explicit SDK-position precedence. Reuse the current registry; add no general layout engine, new public props, or second placement owner.

Keep portal reparenting. Moving stored React elements into a sibling container loses intermediate providers, as recorded in the [portal decision](decisions/0007-native-control-portals.md). A four-corner flex layout is not established as a replacement: [Teleport portals fill their host by default](https://kirillzyusko.github.io/react-native-teleport/docs/api/components/portal), and their layout needs native verification. No deletion of the measurement registry is recommended on that assumption.

Keep renderer zoom readback for navigation, because camera-event snapshots can lag, and retain stale-read/teardown guards. Keep provider/permission and follow-state behavior in GeolocateControl, legal attribution, all scale units/width requests, accessibility labels/roles, and native viewport sizing. Keep the RNMapbox scale-position refresh workaround until the upstream setter issue is independently fixed. Browser-only fullscreen/focus and documented native attribution limits remain explicit existing boundaries.

**Consumer consequence:** Scale width can change without remounting. No other behavior change is intended for the placement consolidation. Custom controls still stack, nested providers and state survive, and native ornaments avoid managed rows. Different button styling or native attribution presentation is acceptable; dropping unit choices, child state, labels, or asynchronous navigation safeguards is not.

### Affected paths and verification

Implementation would reach `facade/ui.tsx`, `contracts/ui-types.ts`, `native-map-presentation.tsx`, NativeControl in `native-ui.tsx`, `native-ornament-position.ts`, and both native map ornament consumers. Replace the width-change rejection in [creation tests](../packages/one-map-react/test/ui-creation.web.test.tsx) with width update/reset assertions through shared and selected entries; retain position/default guards and invalid native width checks. Preserve the selected position props and the scale-refresh hook. Reuse the existing all-corner stacking, removal/reset, explicit-position, multiple-map, provider, navigation-readback, and resize regressions. Assert the single derived calculation against the existing placement values. Later renderer checks should confirm scale width updates and native drawing/touches after dynamic child size, orientation, and removal; no native dependency replacement is proposed.

## Implementation order and release impact

Start with the scale width restriction, separation of live and annotation paths, and consolidation of control placement. Make camera-target semantics a separate change from feature-state lifetime, so each change has its own public documentation and regression evidence. Evaluate SDK live-marker hosts after those changes, retaining the existing host until the complete interaction contract passes. No step requires a new runtime dependency or a generic cross-platform controller.

For each future change, review the matching coverage rows and all callers, update public declaration comments and examples, and preserve existing selected facilities. Keep each consumer-visible relaxation explicit in release notes. A marker or control prototype that fails its stated requirements remains an unsuccessful simplification; it does not justify removing the requirement or marking coverage complete.

The camera and state proposals offer concrete deletion of facade-owned coordination. Marker host replacement offers conditional removal of bridge positioning; control placement offers a smaller local consolidation. No net line-count or dependency reduction is established by this review. Full feature coverage requires retaining the portions that supply dragging, live children, complete controls, validation, errors, and safe teardown.

This document does not authorize renderer execution or alter current release readiness. Follow the [testing policy](testing-policy.md) after any implementation and routine checks are complete. Source review is complete for the mechanisms named here; replacement feasibility, native retention observations under the proposed contract, and renderer acceptance remain unverified.
