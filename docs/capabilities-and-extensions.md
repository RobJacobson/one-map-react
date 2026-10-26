# Capabilities and extensions

**Working offline migration.** Native offline operations use the selected WrapperOfflineManager. The common OfflineService, OfflinePack types, and MapServices.offline are removed. Applications own native pack keys, metadata lookup, observers, errors, and recovery. Keep existing databases, packs, metadata, and imported backend aliases intact. Common location services remain until U18. See [offline migration](revised-api-proposal.md#offline-creation-and-existing-packs) and [U11 status](revised-api-implementation-plan.md#u11-migrate-offline-use-and-remove-the-common-manager). Live downloads, imports, cache/database operations, renderer execution, and native builds/installations are unverified for this migration. The service contracts and acceptance results below retain their historical artifact scope.

**Working capture overlay.** Working current-map capture uses selected wrapper access: RNMapbox takeSnap, MapLibre Native createStaticMapImage, or web getMap().getCanvas().toDataURL after application-selected drawing-buffer setup. MapRef.capture and Map.captureEnabled are removed. Applications own ref checks, readiness, output validation, errors, inclusion, dimensions, files, and bounded waiting. Working independent images use selected WrapperSnapshotManager and WrapperStaticMapImageManager. MapServices.staticMapImage and common capture/image-output types are removed; applications own inputs, output, errors, and waiting. Changed image routes have no renderer acceptance. See the [capture migration](revised-api-proposal.md#capture-and-advanced-ref-access) and [U10 status](revised-api-implementation-plan.md#u10-migrate-and-remove-common-map-capture). Capture guarantees, renderer observations, and execution instructions below retain their historical artifact scope.

**Working next-release marker scope.** The [migration contract](revised-api-proposal.md#markers-images-popups-and-controls) excludes common native Marker dragging in live and annotation modes: selected native Marker types permit draggable=false and omit drag callbacks; common-entry native requests for draggable=true or any drag callback must fail clearly. Web dragging and selected raw native annotation dragging remain available. The capability comparisons and optional-drag example below preserve the broader historical proposal. The [unit plan](revised-api-implementation-plan.md#u07-remove-common-native-marker-dragging) owns implementation and verification status; retained native marker interactions await new touch acceptance.

**Current advanced facilities:** See [advanced rendering](tf09-rendering.md) for the implemented selected routes and explicit wrapper/native boundaries; targeted six-environment acceptance passed for the recorded scope.

**Preserved research.** Upstream comparisons and inventory references below remain useful at their recorded versions. Previous facade contracts, stage assignments, and implementation/acceptance claims are historical. Use the [thin-facade requirements](requirements.md) and [new stage plan](stage-plan.md) when implementing these APIs; full coverage remains required.

**Historical TF08 implementation:** [Location, offline, and capture](tf08-location-offline-capture.md) records the broader common service and capture implementation and its bounded acceptance. The working tree retains adapter.services/useMapServices for location until U18; independent images, offline, and current-map capture follow selected routes. Common capture/image-output types and MapServices.staticMapImage are removed. The extension dispatcher and capability registry below remain retired proposals.

one-map-react should expose common behavior through its core API and make additional functionality discoverable through named capabilities. A capability describes a supported contract, including relevant options, rather than merely the existence of a similarly named SDK method.

**Agreed design:** Reusing existing wrappers, optional backend peer dependencies, and strict unsupported-feature handling are accepted decisions. Capability types, the typed `supports` query, diagnostics, and errors were implemented in the retired portable core; per-backend fulfillment and runtime verification remain separate. The archived implementation-status document records that evidence.

**Proposed API:** Extension module signatures and the marker/control components below remain proposals until their owning stages implement and verify them.

## Research basis

**Existing API:** These comparisons describe the frozen current releases inspected on October 8, 2026. Source and declaration review establish exports, fields, return types, and wrapper dispatch paths. They do not certify one-map-react capability availability, native SDK behavior, or physical-device interactions.

Inspected [RNMapbox 10.3.7][rn-index] at `0f50e8164c1aefe45de9ed9cde310f310076a310`; [MapLibre React Native 11.5.0][ml-index] at `059f46b2dc728fb6259af91b27a071bcda19a2ae`; react-map-gl 8.1.3's [Mapbox][web-mapbox-index] and [MapLibre][web-index] entries at `3df834290bdecf4f5c9b90d7c117d95af12c1f0a`; [Mapbox GL JS 3.32.0][sdk-mapbox-map] at valid release tag `v3.32.0`; and [MapLibre GL JS 6.13.0][sdk-maplibre-map] at `f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d`. [version-baseline.json](../records/version-baseline.json) records package provenance and the shared React 19.2.3 / React Native 0.87.1 host baseline. [The inventory](api-coverage.md) accounts for public fields and their assigned implementation stages.

Readable references accompany the pinned source: RNMapbox's [offlineManager](https://rnmapbox.github.io/docs/components/offlineManager) and [snapshotManager](https://rnmapbox.github.io/docs/components/snapshotManager), and MapLibre React Native's [OfflineManager](https://maplibre.org/maplibre-react-native/docs/modules/offline-manager/) and [StaticMapManager](https://maplibre.org/maplibre-react-native/docs/modules/static-map-manager/). Live documentation can differ from the frozen declarations; for example, RNMapbox's readable offline docs mark its progress listener optional, while 10.3.7's declaration requires it.

[The current review evidence](../records/evidence/capabilities-extensions-current-review.json) records exact source hashes, every comparison row, and declaration checks. Upstream excerpts and the existing provider policy are checked against the frozen declarations with TypeScript 7.0.2. The proposed Marker and offline/snapshot extension excerpts have retained compiler failures because the current common entry does not export Marker and MapRef has no `extensions` property. They illustrate future caller syntax, not runnable current APIs. No download, capture, location permission, hardware sensor, native gesture, or extension runtime was exercised by this review.

## Capability contracts

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [Native camera targets; strict control remains unverified][rn-camera] | [Native camera stops; strict control remains unverified][ml-camera] | [Mapbox][web-mapbox-props] / [MapLibre][web-camera-impl] controlled-camera implementations | `controlledCamera`; true only for validated controlled behavior. |
| [Live MarkerView has no dragging prop][rn-marker] | [Live Marker has no dragging prop][ml-marker] | [Draggable DOM Marker][web-marker] | `markerDragging` for the default live-view contract. |
| [Draggable PointAnnotation][rn-annotation] | [Draggable ViewAnnotation][ml-annotation] | [Marker can serve static-content use][web-marker] | `annotationDragging` for explicitly static annotation mode. |
| [Attached native Callout][rn-callout] | [Attached native Callout][ml-callout] | [Standalone Popup][web-popup] | `standalonePopup`; native adapter implementation required. |
| [Source/map queries return collections][rn-map] | [Source refs have different query methods][ml-vector] | [Map source queries][web-ref] | `sourceQuery`; validate loaded-data scope and results before advertising. |
| [No browser cursor][rn-map] | [No browser cursor][ml-map] | [Mapbox][web-mapbox-props] / [MapLibre][web-props] CSS cursor prop | `desktopCursor`; acceptable explicit presentation degradation. |
| [Offline managers][rn-offline] / [TileStore][rn-tile-store] | [Native OfflineManager][ml-offline] | [No offline-pack manager in wrapper exports][web-index] | `offline`; pack extension with a defined download/storage contract. |
| [Map capture][rn-map] / [snapshot manager][rn-snapshot] | [Map capture][ml-map] / [static image manager][ml-snapshot] | [Underlying canvas access][web-ref] | `snapshot` for defined viewport capture; separate static-render capability. |
| [Location manager][rn-location] / [native pucks][rn-index] | [Location manager][ml-location] / [location display components][ml-index] | [Browser GeolocateControl][web-geolocate] | `deviceLocation`; distinguish tracking, permissions, and display. |
| [No direct browser WebGL custom layer][rn-index] | [No direct browser WebGL custom layer][ml-index] | [Custom layer support through generic Layer][web-layer] | `customWebGLLayer` extension; native GPU integration is a different contract. |

These comparison names are part of the agreed portable capability declarations (`src/core/capabilities/capability-contracts.ts`, now retired), derived from the capability-name tuple (`src/core/capabilities/capability-names.ts`, now retired). The declaration also names `staticMapImage`, `fullscreen`, `terrain`, `projection`, `rain`, `snow`, `canvasSource`, and `videoSource`; their fulfillment remains assigned extension work. A boolean describes a narrow contract; the implemented `supports(feature, options)` type accounts for defined combinations such as live children plus dragging. Capability metadata describes implementation availability and must be checked against independent expected-support fixtures. A complete property/operator support schema for broader style families remains assigned work; a generic boolean does not certify that schema.

Capability information must not pretend that permission has already been granted or resources are available. A backend can support device location while a user denies access. That is an operational outcome, not a missing API.

The agreed map handle exposes read-only capabilities and `supports`; extension modules remain proposed. This proposed excerpt chooses an annotation mode without checking the backend. `Marker` is not exported by the current common entry; its owning stage must implement this syntax before the excerpt can compile:

```tsx
import { Marker, useMap } from "one-map-react";

// Inside a React component and OneMapProvider; ferry-map is registered.
// Proposed Marker syntax; no current Marker export. useMap exists.
const map = useMap("ferry-map");

<Marker
  longitude={-122.34}
  latitude={47.61}
  renderMode="annotation"
  draggable={map.capabilities.annotationDragging}
/>;
```

The application has explicitly made dragging optional. If dragging is essential to its workflow, it should handle an unavailable capability with a user-visible alternative instead of disabling it accidentally.

## Unsupported requests and failures

An automatic fallback is valid when it preserves the promised behavior. For example, an adapter can translate a feature collection into a feature array or convert camera field names. Replacing a live marker with a bitmap, discarding a filter, or ignoring camera bounds changes the contract.

Default handling is strict. A substantiated unavailable contract produces `UnsupportedFeatureError`; unfinished adapter work remains pending implementation and must not be reported as an SDK limitation. An application may explicitly allow a named presentation degradation only when that outcome is documented and acceptable. See [the portable policy](decisions/0002-portable-contracts.md#capabilities-and-diagnostics).

The agreed provider policy accepts an unavailable cursor option and records diagnostics. This setup excerpt does not establish renderer conformance:

```tsx
import { OneMapProvider, Map } from "one-map-react";
import { adapter } from "one-map-react/maplibre";

// Agreed provider policy; cursor is presentation-only in this application.
// Runtime adapter evidence is recorded separately.
<OneMapProvider
  adapter={adapter}
  unsupportedFeatures={{ desktopCursor: "ignore" }}
  onDiagnostic={(diagnostic) => console.warn(diagnostic.message)}
>
  <Map
    id="ferry-map"
    cursor="pointer"
    mapStyle="https://demotiles.maplibre.org/style.json"
    initialViewState={{ longitude: -122.34, latitude: 47.61, zoom: 11 }}
  />
</OneMapProvider>;
```

An ignore policy suppresses the exception; it need not suppress an explicitly registered diagnostic callback. The provider delivers diagnostics after React commits and deduplicates them by map, feature, and operation for its lifetime. Abandoned renders do not deliver or consume diagnostics. Do not change defaults between development and production, and do not offer a global “ignore everything” switch that turns failed operations into apparent successes.

The implemented portable error model distinguishes:

- `UnsupportedFeatureError`: the selected adapter cannot fulfill the requested contract. Include feature, operation, backend, platform, and any documented alternative.
- `InvalidMapOptionError`: malformed or contradictory input, such as non-finite coordinates or invalid bounds.
- `MapNotReadyError`: an operation requires an initialized map or registered source.
- `MapBackendError`: an operational SDK failure, preserving a useful cause when available.

Component configuration errors use the React error path. Async methods reject their promises. SDK event failures are reported through `onError`; the implementation must avoid duplicate reporting and must clean up partially created resources.

Never catch every backend exception and reclassify it as unsupported. Authentication, network, resource, initialization, and permission failures remain failures. An empty query array means successful execution with no matches; a failed query must reject. The only implemented ignore policy is `desktopCursor`, as recorded by the retired portable policy code (`src/core/feature-policy.ts`). An unavailable void operation must still fail unless a named, documented degradation is implemented; an extension proposal does not add an ignore policy.

## Offline packs

Offline resources involve persistent storage and download progress. Sharing `createPack` names does not establish the same storage model or downloadable resources.

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`offlineManager.createPack`: promise of void][rn-offline] | [`OfflineManager.createPack`: promise of pack][ml-offline] | [No equivalent pack manager][web-index] | `map.extensions.offline.createPack(options)` returns a common pack handle; capability required. |
| [`name`, `styleURL`, NE/SW bounds][rn-offline-options] | [`mapStyle`, flat bounds, generated pack ID][ml-offline] | [No corresponding wrapper fields][web-index] | Common name, `mapStyle`, southwest/northeast bounds; convert and retain logical identity. |
| [Progress/error listeners; named pack access][rn-offline] | [Progress/error listeners; generated-ID pack access][ml-offline] | [No corresponding wrapper callbacks][web-index] | Normalize pack identity, progress, errors, and subscription cleanup. |
| [`TileStore`, modern and legacy managers][rn-index] | [Offline database manager and packs][ml-index] | [Browser resource caching is separate from wrapper exports][web-index] | Tile-store-specific operations remain extensions. |

The same region is downloaded with different option shapes. These upstream snippets request a pack; they do not wait for the entire download to complete.

```ts
import { offlineManager } from "@rnmapbox/maps";

await offlineManager.createPack(
  {
    name: "seattle",
    styleURL: "https://demotiles.maplibre.org/style.json",
    bounds: [[-122.30, 47.70], [-122.60, 47.50]], // NE, SW.
    minZoom: 10, maxZoom: 12,
  },
  (_pack, status) => console.log(status),
  (_pack, error) => console.error(error),
);
```

```ts
import { OfflineManager } from "@maplibre/maplibre-react-native";

const pack = await OfflineManager.createPack(
  {
    mapStyle: "https://demotiles.maplibre.org/style.json",
    bounds: [-122.60, 47.50, -122.30, 47.70],
    minZoom: 10, maxZoom: 12,
    metadata: { name: "seattle" },
  },
  (_pack, status) => console.log(status),
  (_pack, error) => console.error(error),
);
```

react-map-gl has no equivalent offline-pack API. A browser application would need a separate resource-caching implementation and a defined offline contract. Do not fabricate a wrapper method or equate ordinary browser caching with a completed offline region.

The proposed one-map-react extension converts bounds and identifiers:

```ts
// Proposed one-map-react map handle; readiness and capability check omitted.
const pack = await map.extensions.offline.createPack({
  name: "seattle",
  mapStyle: "https://demotiles.maplibre.org/style.json",
  bounds: [[-122.60, 47.50], [-122.30, 47.70]], // SW, NE.
  minZoom: 10, maxZoom: 12,
});
```

The adapter must map the common name to MapLibre's generated pack ID, including across application restarts. Pack creation, completed download, resume, deletion, quotas, and resource-provider constraints need separate documented semantics. The `offline` capability name is declared in the core; the extension contract and its backend fulfillment remain proposed until those semantics are verified.

RNMapbox's creation method resolves without a pack; the adapter must call `getPack(name)` and reject if the result is undefined before returning a common handle. MapLibre returns a pack directly and throws when `getPack(id)` cannot find it. Their declared status shapes also differ: RNMapbox uses a name and numeric state, while MapLibre uses a generated ID and string state ([RNMapbox][rn-offline-pack], [MapLibre][ml-offline-pack]). Normalize identity and progress, including restart persistence. Listener cleanup uses RNMapbox `unsubscribe(name)` and MapLibre `removeListener(id)`; creating a pack or attaching a listener does not prove completed download.

## Snapshots and static images

Capturing the current map and rendering a new map image are different operations. A capture should define whether it includes native/DOM overlays, controls, and marker children.

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`MapView.takeSnap(writeToDisk)`][rn-map] | [`MapRef.createStaticMapImage({output})`][ml-map] | [`getMap().getCanvas()`][web-ref] | `extensions.snapshot.capture({output: "data-url"})`: promise of normalized image string. |
| [`snapshotManager.takeSnap(options)`][rn-snapshot] | [`StaticMapImageManager.createImage(options)`][ml-snapshot] | [No matching wrapper offscreen-image manager][web-index] | Separate `staticMapImage` extension. |
| [`centerCoordinate`, `zoomLevel`, `heading`, `styleURL`][rn-snapshot-options] | [`center`, `zoom`, `bearing`, `mapStyle`][ml-snapshot] | [Offscreen rendering requires setup beyond the wrapper][web-index] | Normalize camera/options only for an implemented static-render contract. |

Current-map capture excerpts use initialized map refs. Browser capture needs constructor setup: Mapbox GL JS 3.32.0 accepts `preserveDrawingBuffer: true`, while MapLibre GL JS 6.13.0 puts it inside `canvasContextAttributes: { preserveDrawingBuffer: true }` ([Mapbox][sdk-mapbox-map], [MapLibre][sdk-maplibre-map]). The excerpts assume that setup and an observed rendered frame; capture inclusion and output still need runtime validation:

```ts
// RNMapbox: base64 capture; exact prefix/output is adapter-normalized.
const image = await map.takeSnap(false);
```

```ts
// MapLibre React Native: base64 capture.
const image = await map.createStaticMapImage({ output: "base64" });
```

```ts
// Initialized react-map-gl ref; drawing-buffer setup described above.
const image = map.getMap().getCanvas().toDataURL("image/png");
```

```ts
// Proposed one-map-react API.
const image = await map.extensions.snapshot.capture({ output: "data-url" });
```

Canvas capture depends on renderer drawing-buffer configuration and resource restrictions, and excludes DOM content layered outside the canvas. Native capture inclusion must also be checked. **Proposed API:** The initial common snapshot contract should capture renderer content only; advertise it only when the adapter can honor that scope. Filesystem output is a separate capability, not a browser string that pretends to be a native file URI.

## Location and backend-specific facilities

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`locationManager`][rn-location], [Android permission helper][rn-permission] | [`LocationManager`][ml-location], [`useCurrentPosition`][ml-current-position] | [GeolocateControl and browser geolocation][web-geolocate] | Location extension with explicit permission and update lifecycle. |
| [`UserLocation`, `LocationPuck`, `CustomLocationProvider`][rn-index] | [`UserLocation`, `NativeUserLocation`][ml-index] | [Browser location display][web-geolocate] | Separate location display and tracking contracts; SDK-native puck styling remains an extension. |
| [`Viewport`, `CameraGestureObserver`][rn-index] | [Camera tracking and region events][ml-camera] | [Camera controller/event machinery][web-camera-impl] | No unconditional component aliases; common state first, advanced follow/gesture extensions separately. |
| [`StyleImport`, Standard-style configuration][rn-style-import] | [No corresponding public component][ml-index] | [Mapbox 3.32.0 `addImport`, `setConfigProperty` SDK methods][sdk-mapbox-map] | Mapbox-specific style extension. |
| [`Rain`, `Snow`, `Atmosphere`, lights/models][rn-index] | [Different style-spec/renderer surface][ml-index] | [Mapbox 3.32.0 rain/snow/model SDK methods][sdk-mapbox-map]; [different MapLibre props][web-props] | Individually named style capabilities, not a generic “advanced styles” boolean. |
| [`PointAnnotationManager`, annotation-layer helpers][rn-index] | [Annotation components and source refs][ml-index] | [DOM markers and source/layer objects][web-index] | Adapter implementation details unless a portable task needs them. |
| [`Animated`][rn-animated] and [coordinate/shape animators][rn-index] | [`Animated`][ml-animated], [Reanimated marker ref access][ml-marker] | [React updates and GL JS camera animation][web-index] | Ordinary updates in core; host animation integrations are explicit extensions. |
| [`Logger`][rn-logger] and [module configuration][rn-module] | [`LogManager`][ml-log-manager], [`NetworkManager`][ml-network-manager], [`TransformRequestManager`][ml-transform-request] | [SDK options and request hooks][web-props] | Normalize one-map-react diagnostics; backend configuration remains adapter-specific. |

Displaying a location, collecting location updates, and following it with the camera are separate operations. Never activate device tracking merely because a map or marker mounted. Permission denial and interrupted subscriptions need useful error/status behavior and cleanup.

The current location wrappers have different permission and failure paths. RNMapbox's [Android helper][rn-permission] returns true if either requested coarse or fine permission is granted and throws when called outside Android. MapLibre's [manager][ml-location] requires both requested Android permissions; on iOS it returns true when the native request resolves and false when it rejects. MapLibre `getCurrentPosition()` catches and logs native errors and can resolve undefined. RNMapbox `getLastKnownLocation()` also catches and logs native errors before returning its cached value. These source observations do not establish physical-device authorization behavior. **Open question:** define permission/status/error normalization in the location stages, including approximate location and interrupted subscriptions.

MapLibre's [useCurrentPosition][ml-current-position] defaults `enabled` to true and registers a listener, which starts its manager. The common location design must require an explicit tracking request; displaying a map alone must not start that hook. Browser `GeolocateControl` forwards the SDK control's geolocation and error events; it is not a native permission-helper alias. Browser permission and tracking behavior still need their own runtime checks.

Raw backend access must identify its backend and return its actual handle, without promising a portable GL JS object on native. Mutations through that handle can invalidate one-map-react's resource registry or React state. Document which operations bypass the facade and how ownership is reconciled.

## Installation and backend switching

The common package must not eagerly import optional backends or their types into every consumer. Use isolated adapter entry points and a backend-independent public type surface. Keep backend packages external during one-map-react's build. Initial optional peers use exact stable pins; wider ranges require renewed inventory and conformance checks. React is required and shared; web/native host dependencies apply only to the selected adapter.

A facade cannot remove the backend's host requirements. MapLibre React Native 11.5.0's [pinned setup guide][ml-setup] and [readable setup guide](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/) document React Native 0.80 or later and only the new architecture from v11. Its pinned manifest also declares the React Native 0.80 peer minimum. The one-map-react baseline selects React Native 0.87.1 and React 19.2.3; wrapper peer ranges alone do not establish runtime compatibility for arbitrary newer hosts.

The current one-map-react [package exports](../packages/one-map-react/package.json) provide four explicit adapter entries and platform aliases with `browser` before `react-native`, then the default web target. The backend is selected by the application. These conditions control JavaScript resolution, while native autolinking uses host dependency/build configuration and must be verified separately. See [Metro exports][metro-exports], [npm optional peers][npm-peers], and [React Native autolinking][autolinking].

Switching a backend means initializing a new map with the chosen adapter, style, credentials, and resources. Preserve compatible application state explicitly; do not reuse SDK objects across backends. Native experiments with both SDKs need both native integrations included and validated, or separate builds with the unused integration excluded. Installing an optional peer, including it in a JavaScript bundle, and linking its native SDK are three separate outcomes. [The selection decision](decisions/0003-adapter-selection.md) records the mixed-engine setup and Metro web transport facility; selecting a JavaScript entry does not replace its native build or browser-worker setup.

Capability defaults, supported peer ranges, and backend-specific setup should be published with conformance results. Use the [maps/camera](maps-and-camera.md), [sources/layers](sources-and-layers.md), and [markers/controls](markers-and-controls.md) contracts as the acceptance scenarios.

[autolinking]: https://github.com/react-native-community/cli/blob/9013a480c66aece0e23cc8082ee23f92274e3cf4/docs/autolinking.md
[metro-exports]: https://metrobundler.dev/docs/package-exports/
[ml-annotation]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/annotations/view-annotation/ViewAnnotation.tsx
[ml-callout]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/annotations/callout/Callout.tsx
[ml-camera]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/camera/Camera.tsx
[ml-index]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/index.ts
[ml-location]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/modules/location/LocationManager.ts
[ml-map]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/map/Map.tsx
[ml-marker]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/annotations/marker/Marker.tsx
[ml-offline]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/modules/offline/OfflineManager.ts
[ml-snapshot]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/modules/static-map/StaticMapManager.ts
[ml-vector]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/sources/vector-source/VectorSource.tsx
[npm-peers]: https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#peerdependenciesmeta
[rn-annotation]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/PointAnnotation.tsx
[rn-callout]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/Callout.tsx
[rn-camera]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/Camera.tsx
[rn-index]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/Mapbox.native.ts
[rn-location]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/modules/location/locationManager.ts
[rn-map]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx
[rn-marker]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MarkerView.tsx
[rn-offline]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/modules/offline/offlineManager.ts
[rn-offline-options]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/modules/offline/OfflineCreatePackOptions.ts
[rn-snapshot]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/modules/snapshot/snapshotManager.ts
[rn-snapshot-options]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/modules/snapshot/SnapshotOptions.ts
[web-camera-impl]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/maplibre/maplibre.ts
[web-geolocate]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/geolocate-control.ts
[web-index]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/index.ts
[web-layer]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/layer.ts
[web-map]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/map.tsx
[web-mapbox-props]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/mapbox/mapbox.ts
[web-marker]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/marker.ts
[web-popup]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/popup.ts
[web-props]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/maplibre/maplibre.ts
[web-ref]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/maplibre/create-ref.ts

[web-mapbox-index]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/index.ts
[sdk-mapbox-map]: https://github.com/mapbox/mapbox-gl-js/blob/v3.32.0/src/ui/map.ts
[sdk-maplibre-map]: https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/map.ts
[rn-permission]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/requestAndroidLocationPermissions.ts
[ml-current-position]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/hooks/useCurrentPosition.ts
[rn-offline-pack]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/modules/offline/OfflinePack.ts
[ml-offline-pack]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/modules/offline/OfflinePack.ts
[rn-style-import]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/StyleImport.tsx
[rn-animated]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/utils/animated/Animated.ts
[ml-animated]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/utils/animated/Animated.ts
[rn-logger]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/utils/Logger.ts
[rn-module]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/RNMBXModule.ts
[ml-log-manager]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/modules/log/LogManager.ts
[ml-network-manager]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/modules/network/NetworkManager.ts
[ml-transform-request]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/modules/transform-request/TransformRequestManager.ts
[ml-setup]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/docs/content/setup/getting-started.md

[rn-tile-store]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/modules/offline/TileStore.ts
