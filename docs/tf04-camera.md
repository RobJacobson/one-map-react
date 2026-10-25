# TF04 camera, events, and gestures

**Working native camera overlay.** The [agreed camera contract](revised-api-proposal.md#camera-and-feature-state-guarantees) gives native viewState changed-target semantics, with observations driving events and readouts. U08 migration is merged as PR27; [routine verification is recorded](../records/evidence/revised-api-u08-native-camera.json). Historical rejection, release, clamping, command-overlap outcomes, and rollback-specific native probe instructions below belong to their recorded artifacts; that rollback probe is retired in the working native fixtures. These records do not verify the changed implementation; its renderer acceptance is unverified. Web controlled behavior remains delegated.

**Implemented in the package. The renderer smoke passed.** Web Mapbox and MapLibre passed `fitBounds`, click, a cancelled flight, and a rejected controlled jump. Both Android engines and both iOS engines passed the same camera cases. The unaccepted native jump stayed at the far target, so `held` is 0 and `controlledCamera` stays unadvertised. Android MapLibre also passed the double tap: MapLibre Android SDK 13.6.1 requires zoom gestures, so the tap did not zoom while pinch zoom was off. iOS MapLibre passed the double tap by zooming, because that platform keeps the recognizer independent of pinch zoom. Jest covers the converters and mocked adapters. See [records/evidence/tf04-camera.json](../records/evidence/tf04-camera.json).

The recorded renderer result applies to the historical artifact in the evidence record. The TF06 correction adds mutable web padding with a one-time zero reset, portable `doubleTapZoom` mapped to the shared double-click handler, rejection of contradictory tap/click flags, and restoration of facade-owned rotation on reset and unmount. Rotation restoration does not enable a disabled pinch handler. The approved corrected web run passed both engines for mutable padding, shared double-click handling, rotation reset/reuse, and the eight-handler interaction master override with explicit/default restoration. See the [current acceptance record](../records/evidence/tf04-tf06-acceptance-plan.json) for the package hash, attempts, commands, and environments. The command is `bun scripts/tf04-camera-smoke.mjs web corrections`. Both native adapters now reject a supplied `fitBounds.maxZoom` before camera dispatch. This is a gap in the pinned React wrappers, with native cap coverage pending; it does not establish a limitation in the underlying SDKs.

The owner has deferred native fit-cap support and retained the rejection. The [native fitBounds.maxZoom memo](native-fitbounds-maxzoom-memo.md) records the issue, current handling, and proposed upstream changes for both React Native wrappers.

## Contract

`Bounds` is `[[west, south], [east, north]]`. The numbers are not sorted. A west value greater than east is an antimeridian span. Invalid corners throw before a wrapper call.

`Padding` is `{ top, right, bottom, left }` in logical units: CSS pixels on web, layout points on native. A missing side becomes `0`. A single number fills every side. The facade does not apply a second density conversion.

`ViewState` remains the controlled camera: longitude, latitude, zoom, bearing, and pitch. Commands accept a partial target of center, zoom, bearing, pitch, padding, and duration. `flyTo` still requires `center`. Duration is optional, so the existing Seattle call stays valid. An easing function is forwarded only where the wrapper accepts one. Native commands reject it. `jumpTo` rejects any easing and any duration other than `0`.

`Map` also accepts `viewState`, `minZoom`, `maxZoom`, `maxBounds`, and `padding`. Portable gesture flags are `interactive`, `dragPan`, `touchZoom`, `touchRotate`, `touchPitch`, and `doubleTapZoom`. Desktop or web-only options stay optional on the common props and throw on native when set, including when set to `false`: `scrollZoom`, `doubleClickZoom`, `dragRotate`, `boxZoom`, `keyboard`, `cooperativeGestures`, `clickTolerance`, and `hash`. Undefined means the caller did not request them. `interactive: false` forces the portable native flags and all eight web handlers off, including individually enabled flags. Web changes apply to existing handlers; clearing the master override restores explicit flags and wrapper defaults for omitted flags. Rotation restoration keeps a disabled pinch handler off.

Callbacks added here are `onMoveStart`, `onMoveEnd`, `onIdle`, and `onClick`. `onLongPress` is forwarded on native and throws on web, because react-map-gl has no long-press callback and this stage does not add a browser recognizer. Web also forwards `onDblClick`, context menu, mouse, wheel, drag, and touch through the mounted-callback guard. Native throws if those callbacks are set. `onClick` is `{ lngLat, point, features? }` with tuples. `features` is omitted when the wrapper does not supply them. The raw SDK event is not required.

`MapRef` methods return `Promise<void>` or a promised tuple. Resolution means the wrapper accepted the call. It does not mean the animation finished or a frame painted. A missing camera or map ref rejects before the wrapper call. MapLibre Native commands still wait for the existing style-load guard.

Commands are `jumpTo`, `easeTo`, `flyTo`, `fitBounds`, `zoomTo`, and `stop`. Getters are `getCenter`, `getZoom`, `getBearing`, `getPitch`, `getPadding`, `getBounds`, `getMinZoom`, `getMaxZoom`, and `getMaxBounds`. `project` and `unproject` return `[x, y]` and `[longitude, latitude]`. A getter the wrapper does not expose rejects. It is not invented from the last event. `getMaxBounds` returns `null` when the web wrapper has no constraint.

`onMove` origin stays `user` or `unknown`. The facade does not invent `programmatic`. RNMapbox `onCameraChanged` and MapLibre `onRegionIsChanging` stay `onMove`. RNMapbox `onMapIdle` becomes `onMoveEnd` and `onIdle`. MapLibre `onRegionDidChange` becomes `onMoveEnd`. MapLibre Native has no idle callback, so `onIdle` is not called there. RNMapbox has no move-start callback, so `onMoveStart` is not called there. When a native map opens on a settle or idle event and no changing event has fired yet, that first event still reports `onMove` once, then the end or idle callback.

## Bounds and gestures

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| `maxBounds` is `{ ne, sw }`. `getVisibleBounds` returns northeast, then southwest. | `maxBounds` and `getBounds` are flat `[west, south, east, north]`. | `maxBounds` is flat. `getBounds` exposes west, south, east, and north methods. `fitBounds` accepts `[[southwest], [northeast]]`. | `Bounds` is southwest, then northeast, unsorted. Flat values are converted at the adapter boundary. |
| Padding is a stop field. The wrapper converts density. | Padding is a camera option. The wrapper converts density. | Padding is part of the view state, in CSS pixels. | `{ top, right, bottom, left }`, missing sides `0`, no second density conversion. |
| `scrollEnabled`, `zoomEnabled`, `rotateEnabled`, `pitchEnabled`. Double tap is `gestureSettings`. | `dragPan`, `touchZoom`, `touchRotate`, `touchPitch`, `doubleTapZoom`, `doubleTapHoldZoom`. Android SDK 13.6.1 still requires zoom gestures, so `touchZoom: false` prevents a double tap even when the double-tap props are set. iOS enables that recognizer on its own. | `dragPan`, `touchPitch`, and one `touchZoomRotate` handler. `disableRotation()` leaves pinch zoom on. | Portable flags. Pinch zoom stays on when only `touchRotate` is false. MapLibre double-tap props are set together. |
| No `scrollZoom`, `doubleClickZoom`, `dragRotate`, `boxZoom`, `keyboard`, `cooperativeGestures`, `clickTolerance`, or `hash`. | Same desktop options are absent. | Those options are map props. | Forwarded on web. Any provided value throws on native. |

## Commands

RNMapbox flight uses `setCamera` with `animationMode: "flyTo"`. Ease uses `"easeTo"`. Jump uses `"none"`. The convenience helpers are not used: `moveTo` eases, `zoomTo` flies, and `flyTo` omits `animationMode`, so Android would default to ease and iOS to flight. `zoomTo` uses `"easeTo"` unless duration is `0`, which uses `"none"`. `fitBounds` uses `"easeTo"`.

MapLibre Native `flyTo`, `easeTo`, and `jumpTo` pass the converted stop. `jumpTo` forces duration `0`. `fitBounds` receives the flat bounds. `zoomTo` passes the partial command when one is present.

Web methods map onto the react-map-gl ref. Getters wrap the synchronous result. `LngLat` becomes `[longitude, latitude]`. Bounds use the southwest-then-northeast order. `fitBounds` passes the common `Bounds` tuple because Mapbox GL and MapLibre GL accept that shape.

`stop` calls the web wrapper's cancel. Both native adapters reject `stop()`. The facade does not queue or cancel commands to imitate a missing cancel.

## Controlled camera

Web control is delegation. When `viewState` is set, it is passed to react-map-gl together with normalized padding. The facade does not reimplement the transform proxy. `initialViewState` stays frozen for the mounted instance. Later camera movement comes from `viewState` or imperative commands. Padding is also forwarded as a mutable wrapper camera prop, so uncontrolled maps receive updates. Initial omission preserves the wrapper default; clearing a supplied override sends zero padding once.

Native control writes the camera child from `viewState` when that prop is set. RNMapbox uses `animationMode: "none"` and `animationDuration: 0` only in that controlled case, so an uncontrolled opening camera still uses the TF02 `defaultSettings` path. MapLibre writes `center`, `zoom`, `bearing`, and `pitch`. `Camera.triggerKey` is not used. The pinned RNMapbox notes mark it unimplemented.

Passing those props can show a correction, a loop, or no correction. This stage did not reproduce an unaccepted native gesture returning to the supplied state. `controlledCamera` is therefore not advertised. There is no weaker sync mode and no native bridge.

## Named mapbox-native exports

`one-map-react/mapbox-native` exports `CameraGestureObserver` and a `GestureSettings` type derived from the pinned `MapView` props. `MapboxGestureSettings` provides those settings to the Mapbox native `MapView`. Common `doubleTapZoom` overwrites the double-tap fields. The other adapters do not read that context. `gestureSettings` is not a common `Map` prop.

Mapbox GL `addInteraction` stays out. It is a separate interaction system. Location follow stays TF08. Source and tile data events stay TF05. Queries and feature state stay TF06. Markers, controls, and cursor stay TF07. `preserveDrawingBuffer` stays TF08. `projection`, terrain, fog, and renderer settings stay TF09. Mapbox Android's cold-cache latitude 0 is unchanged and remains pinned `@rnmapbox/maps` 10.3.7.

## Checks

`bun run validate` runs format, docs, types, Jest, and packed selection. Converter tests cover padding fill, corner order, antimeridian bounds, RNMapbox animation modes, MapLibre flat bounds, gesture pairs, click tuples, and invalid bounds. Mocked adapter tests call each command and getter with converted arguments, reject a missing ref, keep the MapLibre style-load guard, stop new callbacks after unmount, reject desktop options on native, reject web `onLongPress`, and show that controlled `viewState` is what the wrapper receives after the first mount. `initialViewState` stays frozen.

These tests use mocked wrappers. The renderer smoke is recorded in [records/evidence/tf04-camera.json](../records/evidence/tf04-camera.json). Web passed fit, click, stop, and a rejected controlled jump on both engines. Android and iOS passed the same cases with `held=0` and a rejected `stop`. Android MapLibre's double tap did not zoom, which is the pass for MapLibre Android SDK 13.6.1 while pinch zoom is off. iOS MapLibre's double tap zoomed. That is not a TF02 or TF03 rerun.
