# Maps and camera

**Working capture overlay.** Working current-map capture uses selected wrapper access: RNMapbox takeSnap, MapLibre Native createStaticMapImage, or web getMap().getCanvas().toDataURL after application-selected drawing-buffer setup. MapRef.capture and Map.captureEnabled are removed. Applications own ref checks, readiness, output validation, errors, inclusion, dimensions, files, and bounded waiting. Common independent snapshot services remain until U12; no changed capture route has renderer acceptance. See the [capture migration](revised-api-proposal.md#capture-and-advanced-ref-access) and [U10 status](revised-api-implementation-plan.md#u10-migrate-and-remove-common-map-capture). Capture guarantees, renderer observations, and execution instructions below retain their historical artifact scope.

**Working native camera overlay.** The [agreed camera contract](revised-api-proposal.md#camera-and-feature-state-guarantees) gives native viewState changed-target semantics, with observations driving events and readouts. U08 migration is merged as PR27; [routine verification is recorded](../records/evidence/revised-api-u08-native-camera.json). Historical rejection, release, clamping, command-overlap outcomes, and rollback-specific native probe instructions below belong to their recorded artifacts; that rollback probe is retired in the working native fixtures. These records do not verify the changed implementation; its renderer acceptance is unverified. Web controlled behavior remains delegated.

**Current advanced map routes:** See [advanced rendering](tf09-rendering.md) for portable terrain/projection/light/elevation and selected constructor options/ref methods. Targeted six-environment acceptance passed for the recorded scope; unexercised selected SDK combinations remain explicit.

**Preserved research.** Upstream comparisons and inventory references below remain useful at their recorded versions. Previous facade contracts, stage assignments, and implementation/acceptance claims are historical. Use the [thin-facade requirements](requirements.md) and [new stage plan](stage-plan.md) when implementing these APIs; full coverage remains required.

This reference compares map containers, camera configuration, events, and imperative refs. Camera configuration determines what the map shows; React control determines who owns that state when a user or command changes it.

**Existing API:** The wrapper names, declaration shapes, and source mechanisms below were rechecked against the frozen stable versions. This source review does not establish one-map-react adapter support or native runtime equivalence.

**Historical design:** Portable map, camera, event, and ref declarations were implemented in the retired source; their existence does not certify adapter behavior. The archived implementation-status document records the owning stages' runtime evidence. Other interfaces remain proposed, and strict native controlled-camera behavior remains an open implementation question.

**Implemented in TF02:** `Map` accepts `mapStyle` (URL or a plain style document), `initialViewState` with longitude, latitude, zoom, bearing, and pitch, optional host `style`, `onMove`, and `ref.flyTo({ center, duration })`. Native adapters copy `initialViewState` on first render and keep passing that copy. `onMove` receives `{ viewState, origin }` with `origin` `user`, `programmatic`, or `unknown`; adapters currently report `user` or `unknown`. `flyTo` returns `Promise<void>` that adopts the wrapper result: RNMapbox resolves after synchronous `setCamera` with `animationMode: "flyTo"`; MapLibre Native awaits `setStop`; web resolves after react-map-gl `flyTo` returns the map instance. Fulfillment does not mean the animation finished. The camera command family, gestures, and `viewState` are implemented in TF04. Map ids and provider registration stay future contracts. The six-environment smoke passed. Mapbox Android's opening camera matches pinned `@rnmapbox/maps` 10.3.7. See the [TF02 record](tf02-shared-map.md) and the [TF04 record](tf04-camera.md).

**Implemented in TF03:** `Map` also accepts `reuseMaps`, a structural `gl` context, `onLoad`, `onStyleLoad`, `onError`, and `onResize`. `MapRef.resize()` measures a web map. Web adapters forward `reuseMaps` and `gl` to react-map-gl. Native adapters reject both, and native `resize()` rejects, because those wrappers have no reuse prop, external context, or resize method. `onStyleLoad` listens for web `style.load`. If that event was missed, the following `load`, or the next `idle` after reuse, reports it once when the style is loaded. It follows native `onDidFinishLoadingStyle`. Mapbox native `onError` copies the iOS loading-error string. Android's pinned wrapper does not deliver that callback. MapLibre native omits `error`. The renderer smoke passed. See the [TF03 record](tf03-reuse.md).

**Implemented in TF04:** `Map` also accepts `viewState`, `minZoom`, `maxZoom`, `maxBounds`, `padding`, the portable gesture flags, and `onMoveStart`, `onMoveEnd`, `onIdle`, and `onClick`. `onLongPress` is forwarded on native and rejected on web. Desktop gesture options are forwarded on web and rejected on native when set. `MapRef` adds `jumpTo`, `easeTo`, `fitBounds`, `zoomTo`, `stop`, the camera getters, `project`, and `unproject`. Each promise resolves when the wrapper accepts the call. RNMapbox flight, ease, and jump set `animationMode` explicitly. Getters the wrapper lacks reject. Web `viewState` is delegated to react-map-gl. Native `viewState` writes the camera props, and `controlledCamera` is not advertised. The renderer smoke passed. See the [TF04 record](tf04-camera.md).

## Research basis

Revalidated October 8, 2026: [RNMapbox 10.3.7][rn-index] at `0f50e8164c1aefe45de9ed9cde310f310076a310`; [MapLibre React Native 11.5.0][ml-index] at `059f46b2dc728fb6259af91b27a071bcda19a2ae`; react-map-gl 8.1.3 at `3df834290bdecf4f5c9b90d7c117d95af12c1f0a`, including its [MapLibre][web-index] and [Mapbox][web-mapbox-index] entry points. Forwarded browser options and methods were checked against [Mapbox GL JS 3.32.0][sdk-mapbox-map] and [MapLibre GL JS 6.13.0][sdk-maplibre-map].

These versions match [version-baseline.json](../records/version-baseline.json). [The review evidence](../records/evidence/maps-camera-current-review.json) records the exact inspected source files, table checks, and declaration results. All eight TSX excerpts and the matching Mapbox-web variations of the two MapLibre-web excerpts type-check against current published declarations with the explicitly omitted component scope supplied. They remain illustrative excerpts, not assembled applications or runtime conformance evidence. [The inventory](api-coverage.md) accounts for additional fields and methods; the owning stages must verify adapter behavior independently.

Readable API references are available for RNMapbox's [MapView][rn-map-docs] and [Camera][rn-camera-docs], MapLibre React Native's [Map][ml-map-docs] and [Camera][ml-camera-docs], and react-map-gl's [Mapbox Map][web-mapbox-docs] and [MapLibre Map][web-maplibre-docs]. Those sites may change; the pinned source links establish the version-specific comparisons here.

## Map containers

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`MapView`][rn-map] | [`Map`][ml-map] | [`MapLibre Map`][web-map] / [`Mapbox Map`][web-mapbox-map] | `Map`; native camera children are internal. |
| [`styleURL`, serialized `styleJSON`][rn-map] | [`mapStyle`: URL or style object][ml-map] | [`mapStyle`: URL or style object][web-props] | `mapStyle`: URL or plain JSON `StyleDocument` with version `8`, a sources object, and a layers array; root name and JSON metadata are preserved. Serialize for RNMapbox; source/layer schema behavior keeps its feature-stage owners. |
| [`ViewProps.style`][rn-map] | [`ViewProps.style`][ml-map] | [`style`: CSS properties][web-map] | `style` retains host-specific typing; common width/height layout is translated where valid. |
| [`scrollEnabled`][rn-map] | [`dragPan`][ml-map] | [`dragPan`][web-props] | `dragPan?: boolean`; rename and apply explicitly. |
| [`zoomEnabled`, `gestureSettings`][rn-map] | [`touchZoom`, `doubleTapZoom`, `doubleTapHoldZoom`][ml-map] | [`touchZoomRotate`, `scrollZoom`, `doubleClickZoom`][web-props] | Separate `touchZoom`, `touchRotate`, and `doubleTapZoom` intent; desktop options are capabilities. |
| [`rotateEnabled`, `pitchEnabled`][rn-map] | [`touchRotate`, `touchPitch`][ml-map] | [`touchZoomRotate`, `touchPitch`, `dragRotate`][web-props] | `touchRotate` and `touchPitch`; adapt coupled web gesture handlers. |
| [`surfaceView`][rn-map] | [`androidView`: surface or texture][ml-map] | [Browser canvas and WebGL context][web-props] | Native renderer-view choice is a backend extension. |
| [`preferredFramesPerSecond`][rn-map] | [`preferredFramesPerSecond`][ml-map] | [Browser render scheduling][web-props] | Native frame-rate request is an extension; no fabricated web equivalent. |

The camera's padding is distinct from container layout. `style` describes the view's size; camera padding shifts the visible map area. React Native Web can let a cross-platform application share native-style container declarations, but one-map-react cannot turn arbitrary CSS into native layout rules.

Gesture flags need behavioral adaptation. MapLibre React Native [documents][ml-map] that disabling `touchZoom` also disables Android double-tap and quick zoom; its [Android implementation][ml-geometry-android] applies the zoom flag and explicit double-tap flags separately, so combined options need runtime checks. Both browser renderers combine pinch zoom and rotation in a handler and provide `disableRotation()` to leave pinch zoom enabled; see the [Mapbox handler][sdk-mapbox-touch] and [MapLibre handler][sdk-maplibre-touch]. Adapters must configure those handlers deliberately. A boolean with the same name is not evidence of identical gesture sequences or default settings.

The retired facade required every map to have a stable nonempty `id` unique within its OneMapProvider. `useMap()` returned the enclosing map; `useMap(id)` resolved a registered map in that provider. Those registration contracts are not in the TF02 package. See the [portable contract decision](decisions/0002-portable-contracts.md).

The retired facade's selected web constructor options used `createMapConfiguration` from `one-map-react/mapbox-web` or `one-map-react/maplibre-web`, passed to `Map.configuration`. The factory validated an explicit option set and copied its values. Constructor settings were immutable for a mounted map; changing them raised `InvalidMapOptionError` and required a deliberate remount. The [constructor decision](decisions/0004-map-constructor-configuration.md) supplies equivalent initial-map examples, verified behavior, and remaining configuration investigations. Camera and gesture props keep their separately assigned contracts.

The retired facade's selected web `getMapSettings(mapRef)` controllers implemented renderer readiness getters and named mutable world-copy settings; Mapbox web also exposed language, worldview, and scale-factor settings. Native Mapbox `createMapConfiguration` supplied a mutable attribution-button tint, and `getMapLayout(mapRef)` copied the wrapper's host-layout snapshot independently of SDK readiness. See the [configuration contract](decisions/0004-map-constructor-configuration.md) and [S04 acceptance](decisions/0006-s04-acceptance.md) for their validation, lifetime, reset, ownership, and verification scope. Public camera commands and normalized movement events retain their later stage owners. None of those helpers are in the current package. TF03 forwards `reuseMaps` and `gl` to the web wrapper and does not restore the provider pool or `createMapConfiguration`. See the [TF03 record](tf03-reuse.md).

The retired facade's four selected adapter entries exported `createHostProps`. Callers passed its result to `Map.hostProps`, using DOM attributes on web and React Native view attributes on native. The [host-property decision](decisions/0005-host-properties.md) compares host ownership, supplies equivalent examples, and distinguishes packed browser observations from pending native input and accessibility acceptance. Host callbacks retained platform event types and did not replace normalized map callbacks. That helper is not in the TF02 package.

## Camera configuration

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`Camera` child][rn-camera] | [`Camera` child][ml-camera] | [Camera props on `Map`][web-props] | Camera props on `Map`; adapters manage native `Camera`. |
| [`defaultSettings`][rn-camera] | [`initialViewState` on `Camera`][ml-camera] | [`initialViewState` on `Map`][web-props] | `Map.initialViewState`; initialization only. |
| [`centerCoordinate: [lng, lat]`][rn-camera] | [`center: [lng, lat]`][ml-camera] | [`longitude`, `latitude`][web-common] | `longitude`, `latitude` in view state; convert to tuples. |
| [`zoomLevel`][rn-camera] | [`zoom`][ml-camera] | [`zoom`][web-common] | `zoom`; rename RNMapbox's field. |
| [`heading`][rn-camera] | [`bearing`][ml-camera] | [`bearing`][web-common] | `bearing`; rename RNMapbox's field and validate orientation. |
| [`pitch`][rn-camera] | [`pitch`][ml-camera] | [`pitch`][web-common] | `pitch`; preserve the name and validate backend ranges. |
| [`paddingTop/Right/Bottom/Left` inside `padding`][rn-camera] | [`padding: {top, right, bottom, left}`][ml-camera] | [`padding: {top, right, bottom, left}`][web-common] | Full padding object with missing sides normalized to zero. |
| [`bounds: {ne, sw}`][rn-camera] | [`bounds: [west, south, east, north]`][ml-camera] | [`initialViewState.bounds` accepts GL JS bounds][web-props] | Bounds `[[west, south], [east, north]]`; explicit conversion. |
| [`minZoomLevel`, `maxZoomLevel`][rn-camera] | [`minZoom`, `maxZoom` on `Camera`][ml-camera] | [`minZoom`, `maxZoom` on `Map`][web-props] | `Map.minZoom`, `Map.maxZoom`; configure native camera. |
| [`maxBounds: {ne, sw}`][rn-camera] | [`maxBounds`: flat bounds][ml-camera] | [`maplibre`: flat `[west, south, east, north]` declaration][web-props]; [`mapbox`: SDK bounds-like option][web-mapbox-map] | `Map.maxBounds`: common bounds tuple; convert per entry point. |
| [`animationDuration`, `animationMode`][rn-camera] | [`duration`, named `easing`][ml-camera] | [`Mapbox`][sdk-mapbox-camera] / [`MapLibre`][sdk-maplibre-camera] command options include duration and easing callback | Command `duration`; `jumpTo`/`easeTo`/`flyTo` select movement intent. Arbitrary easing is a capability. |
| [`followUserLocation`, follow fields][rn-camera] | [`trackUserLocation`, ordinary camera fields][ml-camera] | [`GeolocateControl` tracking][web-geolocate] | Location-follow extension; not ordinary controlled view state. |
| [Declarative camera targets and native callbacks][rn-camera] | [Declarative stops and native callbacks][ml-camera] | [React-controlled camera machinery][web-camera-impl] | `viewState` and `onMove`; strict equivalence requires `controlledCamera` capability. |

Bounds use southwest then northeast in the proposed API. RNMapbox camera objects name the corners; MapLibre uses a flat array. Adapters should use named conversion functions, including tests for bounds crossing the antimeridian. Do not guess ordering from a two-element array returned by a native method.

Screen positions and padding in the common API use logical map-view units: CSS pixels on web and layout points on native. The inspected Android [RNMapbox projection code][rn-geometry-android] and [MapLibre projection code][ml-geometry-android] already convert between density-independent coordinates and renderer pixels. Adapters must preserve those wrapper conventions and verify them at different pixel densities, rather than apply a second conversion. Zoom and pitch are camera values, not pixel distances.

## Initial camera examples

All four examples start over Seattle at zoom 11. The neutral style URL makes the data setup comparable. Mapbox applications also need their access-token setup; web applications need the relevant GL JS stylesheet.

RNMapbox uses a camera child:

```tsx
import { MapView, Camera } from "@rnmapbox/maps";

// Inside a sized native parent; Mapbox token setup omitted.
<MapView
  style={{ flex: 1 }}
  styleURL="https://demotiles.maplibre.org/style.json"
>
  <Camera
    defaultSettings={{
      centerCoordinate: [-122.34, 47.61],
      zoomLevel: 11,
      heading: 0,
      pitch: 0,
    }}
  />
</MapView>;
```

MapLibre React Native retains the child with revised field names:

```tsx
import { Map, Camera } from "@maplibre/maplibre-react-native";

// Inside a sized native parent.
<Map
  style={{ flex: 1 }}
  mapStyle="https://demotiles.maplibre.org/style.json"
>
  <Camera
    initialViewState={{
      center: [-122.34, 47.61], zoom: 11, bearing: 0, pitch: 0,
    }}
  />
</Map>;
```

react-map-gl puts initialization on the map:

```tsx
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

<Map
  style={{ width: "100%", height: 400 }}
  mapStyle="https://demotiles.maplibre.org/style.json"
  initialViewState={{
    longitude: -122.34, latitude: 47.61,
    zoom: 11, bearing: 0, pitch: 0,
  }}
/>;
```

The agreed one-map-react declaration preserves the web camera shape; adapter runtime verification remains separate:

```tsx
import { Map } from "one-map-react";

// Agreed declaration; see implementation status for runtime evidence.
// Backend setup belongs in OneMapProvider.
<Map
  id="seattle"
  style={{ width: "100%", height: 400 }}
  mapStyle="https://demotiles.maplibre.org/style.json"
  initialViewState={{
    longitude: -122.34, latitude: 47.61,
    zoom: 11, bearing: 0, pitch: 0,
  }}
/>;
```

The native adapter converts the state into the appropriate camera child. Changing `initialViewState` after initialization must not unexpectedly reset a user's camera. Use controlled state or an imperative command for subsequent changes.

## Controlled camera behavior

A controlled map receives its camera from React state. Movement events describe proposed changes; application code can accept the proposal, constrain it, or leave the state unchanged. An uncontrolled map lets the backend own its camera after initialization.

These illustrative component excerpts show each wrapper accepting movement into React state. Imports, matching initial state, and the same style URL are included; place the JSX inside a component. Sized containers, tokens, web stylesheets, and provider setup are omitted. Accepting every movement does not establish strict control when an application rejects a movement proposal.

RNMapbox reports native camera state through `properties`:

```tsx
import { useState } from "react";
import { MapView, Camera } from "@rnmapbox/maps";

// Inside a component; map/container setup omitted.
const [viewState, setViewState] = useState({
  longitude: -122.34, latitude: 47.61,
  zoom: 11, bearing: 0, pitch: 0,
});

<MapView
  styleURL="https://demotiles.maplibre.org/style.json"
  onCameraChanged={({ properties }) => {
    setViewState({
      longitude: properties.center[0], latitude: properties.center[1],
      zoom: properties.zoom, bearing: properties.heading,
      pitch: properties.pitch,
    });
  }}
>
  <Camera
    centerCoordinate={[viewState.longitude, viewState.latitude]}
    zoomLevel={viewState.zoom}
    heading={viewState.bearing}
    pitch={viewState.pitch}
  />
</MapView>;
```

MapLibre wraps its region payload in a native event:

```tsx
import { useState } from "react";
import { Map, Camera } from "@maplibre/maplibre-react-native";

// Inside a component; map/container setup omitted.
const [viewState, setViewState] = useState({
  longitude: -122.34, latitude: 47.61,
  zoom: 11, bearing: 0, pitch: 0,
});

<Map
  mapStyle="https://demotiles.maplibre.org/style.json"
  onRegionIsChanging={({ nativeEvent }) => {
    setViewState({
      longitude: nativeEvent.center[0], latitude: nativeEvent.center[1],
      zoom: nativeEvent.zoom, bearing: nativeEvent.bearing,
      pitch: nativeEvent.pitch,
    });
  }}
>
  <Camera
    center={[viewState.longitude, viewState.latitude]}
    zoom={viewState.zoom}
    bearing={viewState.bearing}
    pitch={viewState.pitch}
  />
</Map>;
```

react-map-gl reports a web view-state proposal:

```tsx
import { useState } from "react";
import Map from "react-map-gl/maplibre";

// Inside a component; map/container setup omitted.
const [viewState, setViewState] = useState({
  longitude: -122.34, latitude: 47.61,
  zoom: 11, bearing: 0, pitch: 0,
});

<Map
  {...viewState}
  mapStyle="https://demotiles.maplibre.org/style.json"
  onMove={(event) => setViewState(event.viewState)}
/>;
```

The agreed one-map-react declaration receives the same common state; strict native fulfillment remains an investigation:

```tsx
import { useState } from "react";
import { Map, type ViewState } from "one-map-react";

// Inside a component; agreed declaration, runtime fulfillment pending.
// OneMapProvider and map/container setup omitted.
const [viewState, setViewState] = useState<ViewState>({
  longitude: -122.34, latitude: 47.61,
  zoom: 11, bearing: 0, pitch: 0,
});

<Map
  id="seattle"
  mapStyle="https://demotiles.maplibre.org/style.json"
  viewState={viewState}
  onMove={(event) => setViewState(event.viewState)}
/>;
```

Accepting every event can look similar across these examples. Native reporting does not itself prevent movement when an application ignores an event. Sending the previous props back can introduce a visible correction, timing problems, or an event loop. react-map-gl's Mapbox entry uses a [proxy transform][web-mapbox-proxy] to retain controlled values while reporting proposals. Its [MapLibre entry][web-camera-impl] installs the renderer's [camera-update callback][sdk-maplibre-map], saves the proposed camera, and applies controlled props before the update is accepted. These inspected mechanisms explain the web control model; source and declaration checks do not certify native strict control.

The agreed contract is strict: if `viewState` is supplied, unaccepted movement must not become the persistent displayed camera state. Native adapters must validate that contract before advertising `controlledCamera`. A weaker eventual-synchronization mode, if introduced, needs a separate name and opt-in. Event deduplication and command attribution are adapter responsibilities; neither proves strict control.

## Events and readiness

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`onCameraChanged`, `onMapIdle`][rn-map] | [`onRegionIsChanging`, `onRegionDidChange`][ml-map] | [`onMove`, `onMoveEnd`, `onIdle`][web-events] | `onMove`, `onMoveEnd`, `onIdle`; normalize payloads and define settling separately from resource idleness. |
| [`onPress`, GeoJSON point payload with screen-point properties][rn-map] | [`onPress`, `nativeEvent.lngLat` and `point` tuples][ml-map] | [`MapLibre onClick`][web-events] / [`Mapbox onClick`][web-mapbox-events], SDK event objects | `onClick({lngLat, point, features?})`; tuples and arrays, no required raw SDK event. |
| [`onLongPress`][rn-map] | [`onLongPress`][ml-map] | [No dedicated wrapper long-press callback][web-events] | `onLongPress` capability; browser gesture recognition would be an explicit implementation. |
| [`onDidFinishLoadingStyle`, load callbacks][rn-map] | [`onDidFinishLoadingStyle`, load callbacks][ml-map] | [`onLoad`, `onStyleData`, `onError`][web-events] | Implemented `onLoad` for map load, including a reused web map; `onStyleLoad` for style completion, including an already-loaded reused web map; `onError` for wrapper failures. |

The agreed move payload has a common `viewState` and an interaction origin that may be `user`, `programmatic`, or `unknown`. Do not infer origin when the backend cannot establish it. Raw events may be available through proposed backend extensions; they are not portable payloads.

The common `onLoad` contract does not promise that every future tile or source is loaded. `onStyleData` reports style-data activity; it does not alone establish replacement-style readiness. Both renderers expose `style.load`, but react-map-gl's internal style-component refresh uses `styledata` in its [Mapbox entry][web-mapbox-camera] and `style.load` in its [MapLibre entry][web-camera-impl]. An adapter's replacement-style readiness must use the promised renderer condition rather than assume those wrapper callbacks are equivalent. Style replacement invalidates style-dependent resources. Restoring sources after a style replacement stays TF05. Frame-rendering and source-loading events require separate contracts if exposed.

## Imperative refs

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`Camera.moveTo(center, 0)` or `setCamera` with `animationMode: "none"`][rn-camera] | [`CameraRef.jumpTo(options)`][ml-camera] | [`MapRef.jumpTo(options)`][web-ref] | `MapRef.jumpTo(options): Promise<void>`; internal camera dispatch with explicit nonanimated intent. |
| [`Camera.setCamera` with ease mode][rn-camera] | [`CameraRef.easeTo(options)`][ml-camera] | [`MapRef.easeTo(options)`][web-ref] | `easeTo(options): Promise<void>`; translate camera options and dispatch. |
| [`Camera.flyTo(center, duration)` or `setCamera` with explicit flight mode][rn-camera] | [`CameraRef.flyTo(options)`][ml-camera] | [`MapRef.flyTo(options)`][web-ref] | `flyTo(options): Promise<void>`; select flight mode explicitly. Advanced flight-path controls are capabilities. |
| [`Camera.fitBounds(ne, sw, padding?, duration?)`][rn-camera] | [`CameraRef.fitBounds(flatBounds, options?)`][ml-camera] | [`MapRef.fitBounds(bounds, options?)`][web-ref] | `fitBounds(commonBounds, options?): Promise<void>`. |
| [`Camera.zoomTo(zoom, duration?)`][rn-camera] | [`CameraRef.zoomTo(zoom, options?)`][ml-camera] | [`MapRef.zoomTo(zoom, options?)`][web-ref] | `zoomTo(zoom, options?): Promise<void>`. |
| [`MapView.getCenter`, `getZoom`: promises][rn-map] | [`MapRef.getCenter`, `getZoom`: promises][ml-map] | [Synchronous MapLibre getters][web-ref]; [Mapbox ref getters read the controlled transform][web-mapbox-ref] | Promise-based getters; tuples instead of SDK classes. |
| [`getPointInView`, `getCoordinateFromView`][rn-map] | [`project`, `unproject`][ml-map] | [`project`, `unproject`][web-ref] | `project` and `unproject`, returning promises of tuples. |
| [`getVisibleBounds`][rn-map] | [`getBounds`: flat tuple][ml-map] | [`getBounds`: SDK bounds object][web-ref] | `getBounds(): Promise<Bounds>`; normalize corner order. |
| [No raw GL JS map][rn-map] | [No raw GL JS map][ml-map] | [`getMap()`][web-ref] | Backend extension only; no portable raw map promise. |

For an explicit one-second flight request, the calls differ as follows. Variables represent typed refs to initialized maps or cameras; initialization is omitted. A request does not establish equal animation paths or completion timing.

```ts
// RNMapbox camera ref.
camera.setCamera({
  centerCoordinate: [-122.34, 47.61],
  animationDuration: 1000,
  animationMode: "flyTo",
});
```

```ts
// MapLibre React Native camera ref.
camera.flyTo({ center: [-122.34, 47.61], duration: 1000 });
```

```ts
// react-map-gl map ref.
map.flyTo({ center: [-122.34, 47.61], duration: 1000 });
```

```ts
// Agreed one-map-react map-ref declaration.
await map.flyTo({ center: [-122.34, 47.61], duration: 1000 });
```

RNMapbox's [`flyTo` helper][rn-camera] sets the center and duration without setting `animationMode`. The inspected [Android stop defaults to ease][rn-camera-android], while [iOS stop parsing defaults to flight][rn-camera-ios]. The example selects flight explicitly to avoid relying on those different defaults. MapLibre React Native [declares][ml-camera] its convenience camera methods as returning `void`, although their implementations return the `setStop` promise; inspect that delegation rather than infer completion from the public return annotation. Browser commands return renderer instances through refs. Neither a method name nor its return type establishes animation completion.

**TF02 `flyTo` result:** the facade promise adopts the wrapper call. RNMapbox `setCamera` returns `void`, so the facade resolves after that synchronous call returns without throwing; the bridge result is not available. MapLibre Native `flyTo` returns `setStop(...)`, and a rejection or synchronous throw rejects the facade promise. react-map-gl `flyTo` returns the map instance, which is not thenable, so the facade resolves after the call returns. If the camera or map ref is missing, the facade rejects immediately and does not call the wrapper. This is a precondition check, not an error-class hierarchy.

The command family is implemented in TF04. Completion of an animation is still not what the promise means. Native `stop()` rejects because those wrappers have no cancel. Web `viewState` follows react-map-gl. Native `viewState` writes camera props, and strict native control is not advertised. See the [TF04 record](tf04-camera.md).

## Adapter work and open questions

Adapters need a camera handle, readiness state, event normalization, and lifecycle cleanup. Apply explicit defaults across backends for the promised common properties. Keep unsupported SDK options out of the core command type rather than accepting and discarding them.

Antimeridian bounds and combined gesture flags are converted in TF04. Jest covers those conversions with mocked wrappers. The renderer smoke passed: web cancelled its flight and held the fit, and both native engines rejected `stop` with `held` 0. The MapLibre Android double tap stayed put because that SDK requires zoom gestures. The MapLibre iOS double tap zoomed. Native strict control is not advertised, and there is no weaker camera mode. See the [TF04 record](tf04-camera.md) and [capability policy](capabilities-and-extensions.md).

[ml-camera]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/camera/Camera.tsx
[ml-geometry-android]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/android/src/main/java/org/maplibre/reactnative/components/mapview/MLRNMapView.kt
[ml-index]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/index.ts
[ml-map]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/map/Map.tsx
[ml-map-docs]: https://maplibre.org/maplibre-react-native/docs/components/map/
[ml-camera-docs]: https://maplibre.org/maplibre-react-native/docs/components/camera/
[rn-camera]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/Camera.tsx
[rn-camera-android]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/android/src/main/java/com/rnmapbox/rnmbx/components/camera/CameraStop.kt
[rn-camera-ios]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/ios/RNMBX/RNMBXCamera.swift
[rn-geometry-android]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/android/src/main/java/com/rnmapbox/rnmbx/components/mapview/RNMBXMapView.kt
[rn-index]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/Mapbox.native.ts
[rn-map]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx
[rn-map-docs]: https://rnmapbox.github.io/docs/components/MapView
[rn-camera-docs]: https://rnmapbox.github.io/docs/components/Camera
[sdk-mapbox-camera]: https://github.com/mapbox/mapbox-gl-js/blob/v3.32.0/src/ui/camera.ts
[sdk-mapbox-map]: https://github.com/mapbox/mapbox-gl-js/blob/v3.32.0/src/ui/map.ts
[sdk-mapbox-touch]: https://github.com/mapbox/mapbox-gl-js/blob/v3.32.0/src/ui/handler/shim/touch_zoom_rotate.ts
[sdk-maplibre-camera]: https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/camera.ts
[sdk-maplibre-map]: https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/map.ts
[sdk-maplibre-touch]: https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/two_fingers_touch.ts
[web-camera-impl]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/maplibre/maplibre.ts
[web-common]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/types/common.ts
[web-events]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/types/events.ts
[web-geolocate]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/geolocate-control.ts
[web-index]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/index.ts
[web-map]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/map.tsx
[web-mapbox-docs]: https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/map
[web-maplibre-docs]: https://visgl.github.io/react-map-gl/docs/api-reference/maplibre/map
[web-mapbox-camera]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/mapbox/mapbox.ts
[web-mapbox-events]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/types/events.ts
[web-mapbox-index]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/index.ts
[web-mapbox-map]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/components/map.tsx
[web-mapbox-proxy]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/mapbox/proxy-transform.ts
[web-mapbox-ref]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/mapbox/create-ref.ts
[web-props]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/maplibre/maplibre.ts
[web-ref]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/maplibre/create-ref.ts
