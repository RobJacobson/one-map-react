# one-map-react

A thin React mapping facade under development over RNMapbox, MapLibre React Native, and react-map-gl. Full upstream API coverage and map reuse are project requirements.

**TF02 complete.** Application setup selects one explicit adapter. Shared map code imports the common components and does not import a wrapper. The six-environment smoke passed. Mapbox Android's opening camera matches pinned `@rnmapbox/maps` 10.3.7. **TF03 implemented, and its renderer smoke passed:** optional `reuseMaps` and `gl` are forwarded on web and rejected on native. `onLoad`, `onStyleLoad`, `onError`, web `onResize`, and web `MapRef.resize()` are available. Native `resize()` rejects.

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

`Map` accepts `mapStyle`, `initialViewState`, optional host `style`, `onMove`, `onLoad`, `onStyleLoad`, `onError`, `onResize`, `reuseMaps`, `gl`, `ref.flyTo({ center, duration })`, and `ref.resize()`. `Source` accepts GeoJSON object `data`. `Layer` accepts a line with `line-color`, `line-width`, and optional `line-cap`. Native adapters freeze the first camera. `flyTo` adopts the wrapper return value; fulfillment is not animation completion. RNMapbox uses `setCamera` with `animationMode: "flyTo"`. Web `resize()` adopts the wrapper call. Native `resize()`, `reuseMaps`, and `gl` throw. The common `Layer` stays the direct child of the wrapper source so injected `source` or `sourceID` is forwarded.

Explicit entries are `mapbox-web`, `maplibre-web`, `mapbox-native`, and `maplibre-native`. Each exports `adapter` with its literal `backend` name. The common entry does not import wrapper packages. The `mapbox` and `maplibre` aliases resolve to web for the `browser` condition, native for `react-native`, and web by default.

React is required; host runtimes, wrappers, and SDKs are optional peers. Consumers install only the backend they select. Exact peer versions are a candidate baseline. Package selection and selected-peer typechecks have been run. Renderer smoke passed on Mapbox web, Mapbox iOS, Mapbox Android, and MapLibre web, iOS, and Android. On Mapbox Android the opening camera is longitude 0, latitude 0, matching `@rnmapbox/maps` 10.3.7 on a cold style cache.

Licensed under MIT. See the included LICENSE.
