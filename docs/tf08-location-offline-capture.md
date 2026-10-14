# TF08 location offline and capture

TF08 implements app-level foreground location, explicit location display and following, native offline packs, current-map capture, and independent native images. The [proposal](tf08-proposal.md) records the reviewed baseline and intended boundaries. Routine verification passed, and the owner subsequently authorized acceptance. Both browser runs passed; native acceptance exposed failures and remains open. The [implementation evidence](../records/evidence/tf08-implementation.json) preserves the routine checkpoints, and the [acceptance evidence](../records/evidence/tf08-acceptance.json) records runtime results and corrections to the test runner.

## Services and setup

Every adapter exposes `services.location`; native adapters also expose `services.offline` and `services.staticMapImage`. `useMapServices()` reads a stable, setup-scoped view inside `MapSetup`, including outside a `Map`. Check optional services directly; their availability does not imply granted permissions, connectivity, credentials, or downloaded resources. Accessing a service starts no sensor or download.

`MapSetup.locationProvider` replaces acquisition and permission behavior for its tree. Provider identity is fixed for that setup; changing it requires a new React key. `GeolocateControl.locationProvider` overrides the setup provider. Its existing `getCurrentPosition` function remains a one-shot override and cannot be combined with a streaming provider or tracking. Browser controls with no explicit provider preserve SDK delegation. Direct selected `WrapperGeolocateControl` exports preserve all SDK control props and refs.

`LocationService` provides `requestPermission`, `getCurrentPosition`, and `watchPosition`. Acquisition accepts a finite initial `timeoutMs` (default 15000), `maximumAgeMs` (default zero), and an optional portable abort signal. This cancellation input exists to release control/setup-owned acquisition on teardown. The default service rejects a pending one-shot request when foreground acquisition is interrupted. Watches suspend their facade listener while backgrounded and restore it on return; initial deadlines still apply until the first acceptable fix.

Location values use `[longitude, latitude]`, meter accuracy/altitude, meters-per-second speed, millisecond epoch timestamps, and optional travel course in degrees. Course does not imply device heading. MapLibre iOS seconds are converted at its adapter boundary. Unknown measurements remain absent; cache without a timestamp cannot establish freshness. Native update-only managers cannot report every revocation or sensor failure; an application provider can supply stronger permission/error behavior.

RNMapbox iOS can emit a heading-only update before its first location fix. The foreground service ignores that intermediate update and keeps the original acquisition deadline. Missing or malformed coordinates in other payloads still fail acquisition.

## Permissions and display

Explicit foreground permission results distinguish granted, denied, and unknown, with authorization accuracy reported independently as precise, approximate, or unknown. Android coarse-only permission is accepted as approximate authorization. MapLibre iOS delegates its public foreground request and reports unknown authorization precision. RNMapbox iOS has no matching public manager request API: calling its default `requestPermission()` rejects with instructions to provide application integration. Explicit acquisition retains the wrapper/OS authorization path and does not certify a permission-query contract.

Before native acquisition, application permission UI should request or establish authorization. Add Android coarse/fine manifest permissions and the appropriate iOS location usage description in the consuming app. The native example generator adds foreground declarations without overwriting an application explanation; it was not executed for this checkpoint. Applications that need always-use/background behavior use named native manager facilities and their platform setup. Select MapLibre Android's location engine through its existing supported project configuration; simulated positions do not establish physical-engine compatibility. No background/device-heading guarantee is inferred from the common foreground service.

Common `UserLocation` accepts an explicit `position`, optional `showAccuracyCircle`, and `onPress`. It composes renderer layers with a spherical meter-based uncertainty polygon; it never starts acquisition. Native `LocationPuck`, `CustomLocationProvider`, `NativeUserLocation`, and `WrapperUserLocation` remain selected exports, with their wrapper-specific acquisition/display behavior. MapLibre also exports `useWrapperCurrentPosition`; its upstream default enables updates, so call it deliberately.

`GeolocateControl` starts after user activation. Native and explicitly supplied-provider controls center once or own one streaming subscription. Native centering uses `easeTo`; browser injection retains `flyTo`. Default browser tracking-mode changes recreate the SDK control so its construction-only option takes effect and its old watch is released. User movement suspends composed following while updates/display continue, and activation resumes at the latest fix without another watch. Provider/mode changes and teardown retire acquisition and stale callbacks, including errors from pending resumed camera requests. Current camera failures release tracking; controls with an `onError` handler can acquire again on activation. Tracking conflicts with authoritative `viewState` or selected native follow requests fail explicitly, including in the default browser control. Native SDK follow fields and mode events are typed `Map.locationOptions`, applied to the existing wrapper camera.

The [shared TF08 scene](../examples/shared/tf08-map.tsx) typechecks for web and native. Shells own `MapSetup`, permissions, host layout, credentials, and user-triggered actions. For example, after selecting the adapter, application code can request a position and display it separately:

```ts
const services = adapter.services;
const permission = await services.location.requestPermission();
if (permission.status === "granted") {
  const position = await services.location.getCurrentPosition();
  // Store position in application state and pass it to UserLocation.
}
```

For RNMapbox iOS, supply the application permission provider before using this explicit request example. A bare injected `getCurrentPosition` function has no cancellation operation; the facade suppresses its late result while the application retains responsibility for its acquisition resources.

## Native offline downloads

`services.offline` exposes `createPack`, `getPack`, `getPacks`, `deletePack`, `invalidatePack`, and `subscribe`. Pack handles provide persistent identity, user metadata, normalized bounds, `status`, `pause`, and `resume`. Creation resolves when a pack is discoverable, while download completion must be observed from status. Storage failures reject; a genuinely absent lookup returns `undefined`.

```ts
const offline = adapter.services.offline;
if (!offline) throw new Error("This backend has no offline pack service.");

const pack = await offline.createPack({
  id: "seattle-ferry",
  mapStyle: styleUrl,
  bounds: [[-122.5, 47.5], [-122.2, 47.8]],
  minZoom: 8,
  maxZoom: 10,
  metadata: { route: "ferry" },
});
const unsubscribe = offline.subscribe(pack.id, onProgress, onError);
// Release observation independently of the persistent download.
unsubscribe();
```

RNMapbox names packs by application ID and receives reversed northeast/southwest corners. MapLibre receives flat west/south/east/north bounds and stores a versioned `oneMapReactOffline` identity alongside separately nested user metadata. `getPacks()` reconstructs identity after restart. Imported packs use `backend:<native-id>` and retain their original metadata. Duplicate application IDs reject, and duplicate persisted identities require reconciliation. Common creation rejects antimeridian regions and metadata that cannot round-trip as plain JSON; named wrapper facilities preserve their broader backend inputs.

Each facade-managed pack has one wrapper observer with local subscriber fan-out. Initial status readback catches completion before subscription. Resume/invalidation reattach after wrapper completion cleanup. Disposal suppresses stale callbacks and never pauses/deletes a pack. The wrappers allow one callback pair per pack, so applications must coordinate direct named-manager subscriptions to the same pack rather than overwrite the facade observer.

Acceptance found that RNMapbox creation returns serialized GeoJSON bounds that the facade currently rejects, so common `createPack` fails on both native platforms after the backend has created the pack. MapLibre creation, two-subscriber observation, duplicate rejection, pause/resume, invalidation, and completion passed on both platforms. MapLibre cold-restart rendering with fixture resources unavailable timed out; completion status alone does not establish usable offline rendering.

Selected `WrapperOfflineManager` exports preserve cache controls, merging, invalidation, migration, limits, and throttling. RNMapbox additionally exports `offlineManagerLegacy` and `TileStore`; these retain their upstream semantics and require applicable native acceptance, especially legacy v11 operations. No cleanup resets the offline database. Browsers expose no native pack service; ordinary cache contents do not establish a completed offline region.

## Capture and independent images

Set `Map.captureEnabled` at construction, then call `map.capture({ output: "data-url", scope: "backend" })`. It waits for an observed frame and nonzero measured dimensions, returns PNG output, and rejects on rendering errors, logical detach, or its finite deadline. `file` output is native-only, and temporary files must be copied by the application for permanent storage. PNG data URLs are validated, normalized once, and checked for nonempty dimensions.

`backend` scope retains wrapper capture inclusion differences. Web exports the renderer canvas and excludes DOM UI. iOS draws the native map hierarchy; Android uses SDK snapshots. Acceptance PNGs contained the known map point and background on all six environments and excluded the fixture's green live Marker child. Other overlays, annotations, pucks, and ornaments require their own inclusion evidence. Strict `renderer` scope rejected on iOS as designed. Cross-backend identical pixels are outside this contract.

Web construction maps capture enablement to Mapbox's `preserveDrawingBuffer` or MapLibre's nested context option. Capture inspects actual context attributes, including retained or caller-supplied contexts, and rejects incompatible buffers with instructions to create a fresh map. Context reconfiguration is not inferred from remount props. Selected `WrapperMap` and `useWrapperMap` preserve direct canvas/container access and typed constructor fields; they use wrapper context and lifetime, rather than common-map registration.

Independent `services.staticMapImage.create` requires a style URL, positive integer pixel dimensions, explicit output, and either center/zoom/bearing/pitch or bounds. It does not inherit mounted sources, layers, feature state, children, or subscriptions. Native services translate camera/output fields and validate data-URL output dimensions. Browsers have no equivalent wrapper snapshot manager, so this optional service is absent. A deadline bounds caller waiting and does not claim SDK cancellation.

Native acceptance verified 96×64 data-URL images and a visible offset point at zoom zero on all four native environments, plus 128×80 images at a second Android density. File output passed on both Android engines and RNMapbox iOS. MapLibre iOS returns an absolute filesystem path that the facade rejects as an invalid file URI; that translation remains to be fixed. Invalid style requests rejected before the facade deadline on all four native environments.

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| `MapView.takeSnap(false)` | `MapRef.createStaticMapImage({ output: "base64" })` | `getMap().getCanvas().toDataURL("image/png")` after preserved-buffer setup | Implemented `MapRef.capture({ output: "data-url", scope: "backend" })`; scope preserves wrapper inclusion. |
| `snapshotManager.takeSnap` with `centerCoordinate`, `zoomLevel`, `heading`, `styleURL` | `StaticMapImageManager.createImage` with `center`, `zoom`, `bearing`, `mapStyle` | No corresponding independent wrapper manager | Implemented optional `services.staticMapImage.create`; camera/output translation, separate from current-map content. |

The pinned upstream source links and equivalent acquisition/offline examples remain in [the reviewed proposal](tf08-proposal.md). These mappings describe implementation, with runtime verification tracked separately.

## Required wrapper patches

The package ships [the combined RNMapbox patch](../packages/one-map-react/patches/rnmapbox-10.3.7-tf08.patch) and [the MapLibre patch](../packages/one-map-react/patches/maplibre-native-11.5.0-tf08.patch). Applications apply the selected peer patch through their package manager before a native rebuild. The native example lockfiles register them. The common package cannot patch application-owned peers automatically.

RNMapbox's combined patch includes TF07 per-view Android event throttling, preserves snapshot zoom zero in source and published JavaScript, and fixes independent Android snapshot pixel ratio to one. Its offline status methods construct a response without replacing the live pack that owns cancellation handles on either platform. Remove each change when the pinned wrapper implements the corresponding behavior. MapLibre's patch rejects Android snapshot errors, releases the retained snapshotter on null output, and fixes native snapshot scales for requested PNG pixels. Its Android offline observer only attaches observation; creation and explicit resume start the download. Its iOS scale override follows the SDK's [documented output scale](https://maplibre.org/maplibre-native/ios/latest/documentation/maplibre/mlnmapsnapshotoptions/). Remove these hunks when the selected wrapper provides equivalent behavior. Applications using an earlier TF08 patch must reapply the updated patch and rebuild.

Routine patch checks execute RNMapbox's snapshot-option constructor with mocked dependencies, inspect native operation bodies for offline ownership and image fixes, and verify that each published patch reconstructs the inspected installed files after reverse/forward application. The authorized acceptance run also built and verified installations of both patched wrappers on iOS and Android. Output dimensions and invalid-style rejection passed for the exercised scope. Offline restart, permission revocation, physical location/course behavior, and untested image inclusion combinations remain open.

## Checkpoint status

The API, focused mocked/unit tests, selected exports, example typing, patch registration, and coverage mappings are implemented. Initial routine verification passed 602 Jest tests in 28 suites, four type configurations, formatting, documentation checks, build, thirteen packed selections, all four selected-peer consumers, example resolution, and the focused script checks. The audit follow-up adds ten regressions and the offline peer-patch corrections described above. Follow-up verification passed 612 Jest tests in 28 suites, all four type configurations, formatting, documentation checks, build, thirteen packed selections, and the routine script checks. Selected-peer installation and example bundling were not repeated because exports, public declarations, peer versions, and example imports are unchanged. The [evidence record](../records/evidence/tf08-implementation.json) records initial and follow-up verification separately from pending acceptance. Historical `records/stage-status.json` remains a preserved old-stage ledger; current TF08 status lives here and in the thin-facade stage plan.

The subsequent three-finding observer audit fixed duplicate creation releasing an existing observer, completion retiring observation before resume/invalidation, and synchronous location callbacks leaking a watch during setup teardown. Seven added regressions passed; the full routine checkpoint passed 619 Jest tests in 28 suites, including 72 TF08 tests, four type configurations, formatting, documentation, build, thirteen packed selections, and patch/permission checks.

## Authorized runtime results

The owner then instructed, “Run acceptance tests.” The tested library digest stayed `229f5792efcc4a56d992cd102952d3dd01673e93fd65edce6c8564e3fc97bf35` throughout. The runner used real browser renderers, freshly built and verified native applications, an Android 16 emulator, and an iPhone 18 Pro running iOS 27.0. Native applications used Metro for the frozen library and test scene. Results below combine valid full runs with scoped retries; the evidence preserves first failures and explains every superseded result.

- Mapbox web: 11 scenarios passed.
- MapLibre web: 11 scenarios passed.
- Mapbox Android: 11 passed, offline creation failed on bounds conversion, and offline restart was blocked by that prerequisite.
- Mapbox iOS: 10 passed, offline creation failed on bounds conversion, and offline restart was blocked by that prerequisite.
- MapLibre Android: 11 passed; fresh native location acquisition and offline rendering after restart timed out.
- MapLibre iOS: 9 passed; gesture interruption/resume timed out, file snapshot output failed, and offline rendering after restart timed out.

The browser runs covered location activation, injected following and gesture interruption/resume, browser geolocation grant/denial, actual capture, incompatible retained/external drawing buffers, export errors, and teardown. Injected following and teardown passed on all native environments. Physical gestures and resume passed on both Android engines and RNMapbox iOS. Fresh simulator-injected native positions passed on RNMapbox Android/iOS and MapLibre iOS; these results do not certify hardware sensors. RNMapbox iOS retained its documented application-owned permission boundary.

The coordinator corrected three runner errors without changing the library: readiness now accepts numeric or string feature IDs, native commands/replies carry environment identity and stale test apps are terminated, and the iOS gesture test waits for tracking and drag readback. A fourth correction handles PNG color profiles: the saved RNMapbox iOS capture visibly contained its point, but its profiled red samples were approximately 234/51/35 and failed an overly strict green-channel threshold. Reevaluating the exact PNG found 5,344 red pixels; four classifier regressions now cover this case. The initial contaminated MapLibre Android run and interrupted MapLibre iOS run do not support library conclusions.

Offline retries began inside the downloaded region at [0, 0], zoom 1, after correcting the fixture's earlier Seattle/zoom-10 setup. Both MapLibre packs still timed out during restart/load/readback. The fixture returned HTTP 503 for style/tile requests while local command and Metro transport remained available; global device networking was not disabled. Actual offline rendering therefore remains unverified. Physical-device authorization/revocation/course behavior, a second iOS display density, and named cache/tile-store/legacy operations were not exercised. TF08 acceptance remains failed.
