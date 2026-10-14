# one-map-react

A thin React mapping facade under development over RNMapbox, MapLibre React Native, and react-map-gl. Full upstream API coverage and map reuse are project requirements.

**TF02–TF07 are implemented; the authorized R16 renderer acceptance passed across all six environments for the recorded exercised scope.** Application setup selects one explicit adapter. Shared map code imports common components and does not import a wrapper. Runtime outcomes remain attached to their tested artifacts; full VoiceOver and TalkBack audits are outside the R16 checkpoint. Mapbox Android's opening camera matches pinned `@rnmapbox/maps` 10.3.7. Web `reuseMaps` and `gl` delegate to the wrapper; native requests are rejected.

```tsx
import { Map, MapSetup, Source, Layer } from "one-map-react";
import { adapter } from "one-map-react/mapbox-web";

<MapSetup adapter={adapter}>
  <Map mapStyle={emptyStyle} initialViewState={initialViewState} onMove={handleMove} ref={mapRef}>
    <Source id="routes" type="geojson" data={routes}>
      <Layer
        id="route-line"
        type="line"
        paint={{ "line-color": "#2563eb", "line-width": 3 }}
        layout={{ "line-cap": "round" }}
      />
    </Source>
  </Map>
</MapSetup>
```

`Map` supports initial and updated camera props, camera methods, gestures and interaction events, lifecycle callbacks, and `interactiveLayerIds`. `Source` supports GeoJSON, vector, raster, raster DEM, and image families; `Layer` supports eight portable drawing types. `Images` registers style images. Map refs expose promise-returning camera, feature-query, cluster-query, and feature-state operations. Promise fulfillment distinguishes dispatch from observed animation completion. Web `resize()` delegates to the wrapper; native `resize()`, `reuseMaps`, and `gl` reject.

TF07 exports `Marker`, `Popup`, `Control`, `NavigationControl`, `AttributionControl`, `ScaleControl`, `GeolocateControl`, `FullscreenControl`, and `useMap`. Markers preserve live children by default; `renderMode="annotation"` explicitly opts into native static content. Drag events propose `lngLat` coordinates that application state can accept, and `MarkerRef.refresh()` refreshes native annotation snapshots. Popups request dismissal through `onClose`; teardown does not emit it. TF08 implements explicit location services, supplied-position `UserLocation`, and native/provider-following controls; one-shot injection remains supported. TF08 browser acceptance passed; native acceptance exposed failures and remains open. Browser fullscreen requires browser facilities.

`useMap()` returns the enclosing map ref. Optional `Map.id` enables `useMap(id)` under the same `MapSetup`; named consumers mount after registration. GeoJSON and vector `Source.onClick` support `stopPropagation()`. Selected entries expose typed host attributes/styles and named wrapper annotations, callouts, and controls while preserving common-entry peer isolation. Native live dragging and nested child interaction passed real-touch acceptance for the recorded R16 artifact.

Explicit entries are `mapbox-web`, `maplibre-web`, `mapbox-native`, and `maplibre-native`. Each exports `adapter` with its literal `backend` name. The common entry does not import wrapper packages. The `mapbox` and `maplibre` aliases resolve to web for the `browser` condition, native for `react-native`, and web by default.

React is required; host runtimes, wrappers, SDKs, and native portals are optional peers. Native applications install `react-native-teleport@1.2.1` alongside their selected map wrapper. The adapter owns its portal provider and host; control children retain their original React providers and state. This native dependency requires linking and rebuilding the application. Existing map peers retain their frozen versions. TF07 portal linking, drawing, and touch acceptance passed for the recorded R16 artifact; full VoiceOver and TalkBack audits remain outside that checkpoint.

Android applications using the pinned `@rnmapbox/maps@10.3.7` must apply [the included per-view event patch](patches/rnmapbox-10.3.7-per-view-events.patch) before a native rebuild when using multiple maps. The wrapper's event throttle shares cache entries across maps and can drop a map's load or input callback. The patch includes the native view identifier in that cache key; the Mapbox example registers it through Bun's `patchedDependencies`. Consumer package managers must apply it to their own selected wrapper. It leaves iOS and the facade's lifecycle meanings unchanged. Remove the patch when the selected wrapper scopes event throttling by view.

TF08 adds `adapter.services` and common `useMapServices()` for location, optional native offline packs, and independent native images. Acquisition starts explicitly, permission results preserve backend differences, and subscriptions dispose individually. RNMapbox iOS explicit permission requests require an application `MapSetup.locationProvider`. Common `UserLocation` only draws a supplied position. Selected native entries retain SDK pucks, managers, and `Map.locationOptions` tracking modes.

Set `Map.captureEnabled` at construction and call `map.capture({ output: "data-url", scope: "backend" })` for wrapper-scope PNG output. Browser capture requires a preserved drawing buffer and excludes DOM UI. Native view/SDK inclusion differs; strict renderer scope rejects iOS hierarchy capture. Native-only file output is temporary. Independent native images take explicit style/camera/dimensions and do not inherit mounted resources. Browser offline/static-image services remain absent.

For TF08, apply [the combined RNMapbox patch](patches/rnmapbox-10.3.7-tf08.patch), which also includes the TF07 per-view event fix, or [the MapLibre patch](patches/maplibre-native-11.5.0-tf08.patch) to the selected application-owned peer. These fix zero zoom, failure cleanup, and native image pixel scale. They also preserve RNMapbox download cancellation handles during status reads and prevent MapLibre Android observer attachment from resuming paused downloads. The native examples register them through patchedDependencies; other consumers must apply the selected patch through their package manager before rebuilding. Applications using an earlier TF08 patch must reapply the updated patch and rebuild. Authorized acceptance built and verified both patched wrappers on iOS/Android; image dimensions and the exercised capture scope passed. Native offline and file-output translation failures, runtime timeouts, and device-only checks remain open; see the TF08 record.

Licensed under MIT. See the included LICENSE.
