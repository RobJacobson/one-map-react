# TF03 reuse and lifecycle

**Implemented in the package. The renderer smoke passed.** Web maps can opt into react-map-gl's map reuse. Native maps reject that option because the pinned wrappers have no reuse facility. Load, style, error, and resize callbacks are translated where the wrapper has them. Jest covers the mocked contract. The six-environment smoke passed on packed SHA-256 `1a6c2970f10f185f5cd82b5bdb160a7c6e51dad04e009c3f65000e42b418d2cf`. Web reuse keeps the canvas and reports `onStyleLoad`. Native remounts create a new map. TF04 has not started.

## Contract

`reuseMaps` is optional on `Map`. Web adapters forward it to react-map-gl. Native adapters throw before creating a map when it is `true`. Omitted and `false` keep the TF02 native remount, which creates a new map.

`gl` is an optional structural drawing context: `canvas`, `drawingBufferWidth`, and `drawingBufferHeight`. The common types do not import a DOM or Mapbox type. Web adapters forward `gl` to react-map-gl, which installs it when the map is constructed. Native adapters throw if `gl` is provided. A map created without `gl` can still be reused. A reused map keeps the context from the construction that created it. Passing a different `gl` on the next mount does not move that context onto the existing renderer. The context stays bound to the canvas it was created on, so drawing goes to that canvas and the map element in the page can stay blank.

`onLoad` follows react-map-gl `onLoad`, including the synthetic load react-map-gl fires when it reuses a map whose style is already loaded. RNMapbox and MapLibre Native use `onDidFinishLoadingMap`. On MapLibre Native that is the same callback that allows `flyTo`. `onLoad` does not mean later tiles or sources have finished.

`onStyleLoad` follows native `onDidFinishLoadingStyle`. On the web it listens for the map's `style.load` event and removes that listener on logical unmount, including when `reuseMaps` keeps the renderer. A fresh web map can finish `style.load` before that listener is attached, while `isStyleLoaded()` is still false; the map's following `load` then reports `onStyleLoad` once if the style is loaded. A reused web map can reach that listener after react-map-gl has already fired its synthetic `load`, with `isStyleLoaded()` still false. The next `idle` then reports `onStyleLoad` once if the style is loaded. Later `idle` events do not report again. react-map-gl `onStyleData` is style activity, so it is not this callback. Restoring sources after a style replacement stays TF05.

`onError` receives `{ error?: unknown }`. Web adapters copy the wrapper's `error` value. RNMapbox types `onMapLoadingError` with no argument. On iOS, pinned `@rnmapbox/maps` 10.3.7 still passes `{ error, tileId?, sourceId? }`, and the common event copies `error` and leaves the tile and source ids out. On Android, that release registers the listener with `MapboxMap.subscribe` in `mapbox-v11-compat`, and that function is empty, so `onMapLoadingError` does not run and `onError` is not called for a load failure. The style-URI `OnMapLoadErrorListener` only logs the message. MapLibre Native `onDidFailLoadingMap` drops the message before JavaScript, so that common event omits `error`.

`onResize` is forwarded from react-map-gl `onResize`. Native wrappers have no resize callback, and native adapters do not call `onResize`. Native size follows the host `style`. `MapRef.resize()` calls the web wrapper's `resize()` and fulfills when that call is accepted, which is not a painted frame. Native `resize()` rejects. There is no native resize bridge.

Every new callback goes through the same mounted-callback guard as `onMove`. After logical unmount, a retained renderer cannot call the facade callback. `initialViewState` stays frozen for one mounted instance. A remount is a new instance, so the next `initialViewState` is what react-map-gl applies when it reuses a map.

`MapSetup` is still only the selected adapter. Reuse is not keyed by map id, so this stage adds no named-map registry and no `useMap`.

## Wrapper behavior

Pinned `@vis.gl/react-mapbox` 8.1.3 and `@vis.gl/react-maplibre` 8.1.3 each keep a static last-in, first-out pool (`Mapbox.savedMaps`, `Maplibre.savedMaps`). The pools are separate. With `reuseMaps`, unmount calls `recycle()` and does not call `map.remove()`. The next mount pops that instance, reparents the canvas, applies the new props with style diffing disabled, applies `initialViewState`, resizes, and fires `load` when the style is already loaded. The pool is not limited to one `MapSetup`, and it does not match maps by style, camera, or context. The last recycled map stays in the pool until a later mount takes it or the page goes away. That disposal rule is the wrapper's. The facade still drops its own callbacks and the `style.load` listener at logical unmount.

`gl` is read in the map constructor. `reuse()` does not install a different context. See the [Mapbox entry's mount effect](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/components/map.tsx#L63-L97) and [`Mapbox.reuse`](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/mapbox/mapbox.ts#L243-L286). The MapLibre entry has the same shape in its own module.

`@rnmapbox/maps` 10.3.7 and `@maplibre/maplibre-react-native` 11.5.0 expose no reuse prop or method. A native remount creates a new map. The web result does not imply a native one.

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| No reuse prop. Remount creates a map. | No reuse prop. Remount creates a map. | [`reuseMaps`](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/components/map.tsx#L63-L97) keeps a static pool per entry. | `reuseMaps` is forwarded on web and rejected on native. |
| No external WebGL context. | No external WebGL context. | [`gl`](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/mapbox/mapbox.ts) is a constructor option. | `gl` is forwarded on web and rejected on native. Reuse keeps the original context. |
| [`onDidFinishLoadingMap`](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx) | [`onDidFinishLoadingMap`](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/map/Map.tsx) | `onLoad`, including a synthetic load on reuse | `onLoad` |
| `onDidFinishLoadingStyle` | `onDidFinishLoadingStyle` | Map `style.load`. `onStyleData` is style activity. `reuse()` does not fire `style.load` when the style is already loaded. | `onStyleLoad`. The web listener is removed on logical unmount. A missed `style.load` is reported from the following `load` or, after reuse, from the next `idle` once the style is loaded. |
| `onMapLoadingError` is typed with no argument. iOS passes `{ error: string, tileId?, sourceId? }`. Android's v11 compat `subscribe` is empty, so the callback does not run. | `onDidFailLoadingMap` has a null payload. | `onError` includes `error`. | `onError`. iOS copies `error`. Android does not receive the load failure. MapLibre native omits `error`. |
| No resize callback or method. Size follows the view. | No resize callback or method. Size follows the view. | `onResize` and `resize()` on the map ref. | `onResize` and `MapRef.resize()` on web. Native `resize()` rejects. |

```tsx
import { Map, MapSetup } from "one-map-react";
import { adapter } from "one-map-react/maplibre-web";

// MapSetup selects the adapter. reuseMaps asks react-map-gl to keep the
// renderer across this remount. Omit it for a new map.
<MapSetup adapter={adapter}>
  <Map
    reuseMaps
    mapStyle={emptyStyle}
    initialViewState={initialViewState}
    onLoad={handleLoad}
    onStyleLoad={handleStyleLoad}
    onError={handleError}
  />
</MapSetup>;
```

## What stays later

Gesture and interaction options, including `interactive`, `clickTolerance`, `scrollZoom`, `dragPan`, and the native gesture flags, stay TF04. `preserveDrawingBuffer` and `canvasContextAttributes` stay TF08. Renderer settings such as `antialias`, `language`, `worldview`, `projection`, `fog`, and `terrain` stay TF09. Host `style` width, height, and flex stay on `Map`. Other inherited host attributes are not forwarded one by one in this stage. Control and ornament presentation stays TF07. The historical inventory ledger is not regenerated here.

The retired provider pool, configuration fingerprints, and `createMapConfiguration` factory are not this implementation. They remain described in the [constructor decision](decisions/0004-map-constructor-configuration.md) as history.

## Checks

`bun run validate` runs format, docs, types, Jest, and packed selection. The web Jest mocks keep a one-slot pool: `reuseMaps` preserves the wrapper id and shows the remounted children; omitting it creates a new id even when a map is pooled; a second `gl` is forwarded and does not replace the context recorded at construction. Load, error, and resize callbacks stop after unmount. The `style.load` listener is removed on unmount. A map `load` or, after reuse, the next `idle` reports `onStyleLoad` when `style.load` was missed and the style is loaded by then. A reused mount calls the new `onLoad`. After `style.load`, unmount leaves no listener on the retained target; the next `reuseMaps` mount calls the new `onStyleLoad` once because the style is already loaded, and a later `style.load` calls that callback again. A `StrictMode` replay leaves the current `onLoad` active, including after that callback is replaced. Native tests reject `reuseMaps`, `gl`, and `resize()`, map load and style callbacks onto the wrapper events, pass a style update through, and show that a remount creates a new view. Mapbox native copies an iOS `onMapLoadingError` string, drops `tileId` and `sourceId`, and omits `error` when that payload has none. That Jest case does not show Android delivery. MapLibre native omits `error`.

These tests use mocked wrappers. They do not show a browser canvas, a real WebGL context, or a native view. The renderer smoke below ran with permission. A native remount that creates a new map supports the recorded limitation. It does not show native reuse. Do not rerun the TF02 six-environment smoke unless a shared lifecycle defect requires it.

## Renderer run

Permission covered this stage's smoke: web reuse, a separate external-context case, and native load, remount, and loading-error behavior. It did not cover a TF02 Seattle-route rerun or TF04. The passing pack is SHA-256 `1a6c2970f10f185f5cd82b5bdb160a7c6e51dad04e009c3f65000e42b418d2cf`. The compact record is [tf03-reuse.json](../records/evidence/tf03-reuse.json).

Mapbox web and MapLibre web reuse both finished at `loads=2 styles=2 errors=0 canvas=same`, with the blue route still on the reused canvas. The external-context case finished at `loads=2 styles=2 canvas=same context=first`: the first supplied context was painted, and the second context passed on remount was not. The page canvas stayed blank because the context remains bound to the canvas it was created on.

Mapbox iOS finished at `loads=2 styles=2 errors=1` with `Failed to load style 'mapbox://styles/mapbox/not-a-style': HTTP status code 404. Style not found` and remount `-122.34,47.61`. The route was visible on the remounted map before the bad style. MapLibre iOS finished at `loads=2 styles=2 errors=1 error=omitted remount=-122.34,47.61`. Later style retries raised the error count and still omitted `error`. Mapbox Android finished at `loads=2 styles=2 errors=0 error=timeout remount=-122.34,0.00`. The remount left the north camera and kept latitude 0, which is the pinned `@rnmapbox/maps` 10.3.7 cold-cache behavior, and `onError` was not called. MapLibre Android finished at `loads=2 styles=2 errors=1 error=omitted remount=-122.34,47.61`. The missing style then retried. None of the native remounts show native reuse.
