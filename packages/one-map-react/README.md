# one-map-react

Use the same map screen with stock react-map-gl on web and a native map on iOS or Android. one-map-react translates desktop camera, source, layer, marker and query calls to RNMapbox or MapLibre React Native. Choose the renderer in a platform file. The browser can run without installing one-map-react.

## Install one backend

A stock browser app installs React, React DOM, react-map-gl and its chosen GL JS engine. Import the matching stylesheet from `mapbox-gl/dist/mapbox-gl.css` or `maplibre-gl/dist/maplibre-gl.css`. Pass a public Mapbox token in `mapboxAccessToken` when your style requires one.

For native development, install the candidate archive and the peers for one engine. These are the package-check versions. Each application owns its React Native host version and SDK configuration.

```sh
bun add /absolute/path/one-map-react-VERSION.tgz
bun add react@19.2.3 react-dom@19.2.3 react-native@0.87.1 react-native-teleport@1.2.2
# Choose one
bun add --exact @rnmapbox/maps@10.3.19
bun add --exact @maplibre/maplibre-react-native@11.5.1 @types/geojson@7946.0.16
```

Apply the [version-specific native repair](#native-patches-and-linking) and rebuild the app. RNMapbox applications call the native entry's `setAccessToken` with their public token. Native live markers use react-native-teleport to keep interactive children in the React tree.

## Choose a platform import

The example below selects MapLibre GL JS on web and RNMapbox on native. Change either import to use the other engine on that platform.

```ts
// maps.web.ts
export { Map, Layer, Marker, Source, MapProvider, useMap } from "react-map-gl/maplibre";
```

```ts
// maps.native.ts
export { Map, Layer, Marker, Source, MapProvider, useMap } from "one-map-react/mapbox-native";
```

Import from `./maps` in your screen and mount `<Map>` directly. TypeScript platform files can also re-export `MapRef`, `MapProps`, `SourceProps`, `LayerProps`, and `MarkerProps` with the same names on each platform. Each type describes the selected implementation. Use the same selection for its descendants and hook. The [vessel example](https://github.com/RobJacobson/one-map-react/tree/main/packages/example-map/reference) shares its source, layers, click handling and camera call across all four choices. The host supplies marker controls and a sized map container.

| Task | Import or call |
| --- | --- |
| Use stock components on web | Import from `react-map-gl/mapbox` or `react-map-gl/maplibre`. The optional `one-map-react/mapbox-web` and `one-map-react/maplibre-web` entries forward the upstream exports. |
| Use the same engine on both platforms | Import `one-map-react/mapbox` or `one-map-react/maplibre`. The browser and default conditions select stock react-map-gl. The React Native condition selects the native shim. Browser wins when both conditions are active. |
| Share types across native renderers | Use a type-only import such as `import type { ViewState } from "one-map-react"`. Import components, hooks, and the renderer-specific `MapRef` from your selected entry. |
| Use a browser popup, marker, or control | Import the component from react-map-gl. Import SDK classes and functions directly from the chosen GL JS package. |
| Access the browser map instance | Pass upstream options to `Map`. Put DOM attributes on its parent. Call `getMap()` on its ref to access the GL JS instance. |
| Register images or display a supplied location | Import `Images` and `UserLocation` from `one-map-react/native-extensions` inside a native map. On web, register style images through the chosen SDK and reinstall them after style replacement. Draw a supplied location with a marker or GeoJSON layer. The application owns acquisition and permissions. |

**Clicks and queries.** Pass layer IDs to `interactiveLayerIds` and read upstream results in `onClick`. A browser event already carries the hit features. Read coordinates from `event.lngLat.lng`, `event.lngLat.lat`, `event.point.x`, and `event.point.y`. Wheel events expose the upstream wheel event. To check whether a browser style contains a particular layer, call `map.getLayer(id)`.

```tsx
<Map interactiveLayerIds={["vessels"]} onClick={event => {
  selectVessel(event.features?.[0]?.id, event.lngLat.lng, event.lngLat.lat);
}} />
```

**Camera reads.** Web reads such as `map.getZoom()` are synchronous. In shared handlers, use `const zoom = await map.getZoom()`. Native reads cross the bridge. Use `const center = await map.getCenter()` and read `center.lng` and `center.lat`. Pass an options object to commands, for example `map.flyTo({ center: [-122.45, 47.61], zoom: 12 })`.

**Clusters.** Retrieve the mounted source by ID. Narrow the stock web source to the selected SDK's `GeoJSONSource` (for example, `map.getSource<GeoJSONSource>("vessels")` on Mapbox). With the pinned Mapbox GL JS use `source?.getClusterExpansionZoom(id, callback)`. With MapLibre GL JS use `await source?.getClusterExpansionZoom(id)`. Native source handles accept either form. Check for a missing source after replacement or teardown.

On native, move `getClusterExpansionZoom`, `getClusterLeaves`, and `getClusterChildren` calls from the map ref to the source handle. Pass the source ID to `map.getSource(sourceId)` and omit it from the cluster method's arguments. For example, use `await map.getSource(sourceId)?.getClusterLeaves(clusterId, limit, offset)`. The `ClusterQueryMethods` type was removed. Import `NativeGeoJsonSource` from the selected native entry to type the source handle.

### Direct native entries

Import `Map`, `Source`, `Layer`, `Marker`, and `useMap` from `one-map-react/mapbox-native` or `one-map-react/maplibre-native`. The import selects the renderer. Mount the map directly for enclosing access, or wrap the tree in the same entry's `MapProvider` for named lookup.

```tsx
import {
  Map as NativeMap,
  MapProvider,
  Marker,
  useMap,
} from "one-map-react/maplibre-native";
import { Text, View } from "react-native";

const HarborStatus = () => {
  const { harbor } = useMap();
  return <Text>{harbor ? "Map attached" : "Waiting for map"}</Text>;
};

export const HarborScreen = () => (
  <MapProvider>
    <View style={{ flex: 1 }}>
      <HarborStatus />
      <NativeMap
        id="harbor"
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        initialViewState={{
          longitude: -122.34,
          latitude: 47.61,
          zoom: 11,
          bearing: 0,
          pitch: 0,
        }}
        style={{ flex: 1 }}
      >
        <Marker longitude={-122.34} latitude={47.61} />
      </NativeMap>
    </View>
  </MapProvider>
);
```

Inside a map, read `useMap().current`. A sibling reads `useMap().harbor` for a mounted map with `id="harbor"` in its provider. A map without an ID registers as `default`. Each provider requires unique IDs and reserves `current` for the enclosing map. Lookup yields `undefined` when the corresponding map is absent. Both forms expose the selected `NativeAdvancedMapRef`, including `getWrapperMap()`.

Native selected maps accept partial initial camera settings, desktop camera commands, and click fields such as `event.lngLat.lng` and `event.point.x`. Await native reads including `getCenter()`, `project()`, and `getBounds()`. Use `map.getSource(id)` to access a mounted GeoJSON source's cluster methods. Both promise and error-first callback calls are supported on native. [Library boundary](https://github.com/RobJacobson/one-map-react/blob/main/docs/architecture.md).

The MapLibre native `Layer` also accepts SDK-specific props, including `afterId`, `layerIndex`, and `style`.

## Advanced native APIs

Use `await map.getWrapperMap()` when an operation needs the mounted native wrapper. RNMapbox exposes `takeSnap` and MapLibre React Native exposes `createStaticMapImage`. Both native entries expose version-specific wrapper components and offline/location managers. An application owns permission requests, listener cleanup, offline pack identity and snapshot storage. For a raw map and camera, compose RNMapbox’s `WrapperCamera` inside `WrapperMapView`, or the MapLibre equivalent inside `WrapperMap`.

## Native patches and linking

Each release of one-map-react supports one exact version of each native wrapper. Pin the wrapper in your application's manifest and apply its matching patch from the installed one-map-react package. Applications that include both wrappers apply both patches. The RNMapbox patch keeps Android map events independent per view and separates generated module names when both wrappers are installed. The MapLibre patch releases cleared camera bounds and reports detached Fabric views to callers.

| Wrapper | Included combined repair |
| --- | --- |
| RNMapbox 10.3.19 | `patches/rnmapbox-10.3.19.patch` |
| MapLibre React Native 11.5.1 | `patches/maplibre-native-11.5.1.patch` |

For RNMapbox, copy the repair from the installed package into the application and register it with Bun.

```sh
mkdir -p patches
cp node_modules/one-map-react/patches/rnmapbox-10.3.19.patch patches/rnmapbox.patch
```

Merge this field into the application `package.json`:

```json
{
  "patchedDependencies": {
    "@rnmapbox/maps@10.3.19": "patches/rnmapbox.patch"
  }
}
```

Run `bun install --force`, commit the copied patch and lockfile, and verify a clean install with `bun install --frozen-lockfile`. For MapLibre React Native, use its dependency key and patch from the table. Rebuild native applications after applying or updating a patch.

Native applications require `react-native-teleport` 1.2.2 or newer in the supported 1.x range. Version 1.2.2 includes the [Android transition/reparenting repair](https://github.com/kirillzyusko/react-native-teleport/commit/9cebbb23c645c31113cb913cb1f73465d4c8ca96) and React Native 0.87 support; rebuild after upgrading. Native autolinking must include the selected wrapper and `react-native-teleport`. Install the iOS dependencies (`cd ios && bundle exec pod install` in a standard React Native application), then rebuild the iOS and Android apps. A JavaScript reload cannot install patched native files. RNMapbox requires New Architecture and Mapbox v11. Pin the native Mapbox Maps SDK to exactly **11.33.0** on both platforms. The npm wrapper's 10.x version is separate from the deprecated native SDK v10. Set the iOS Podfile variable before native dependency discovery:

```ruby
$RNMapboxMapsVersion = '= 11.33.0'
```

Set Android's root `android/build.gradle` inside `buildscript { ext { ... } }`:

```groovy
RNMapboxMapsVersion = '11.33.0'
```

Record the resolved SDK version in each application lockfile/build. Follow the selected wrapper's native setup for any SDK overrides.

## Current limitations

Web map reuse delegates to react-map-gl. Native reuseMaps={true}, external `gl`, and `resize()` reject; reuseMaps={false} is accepted. Native imperative `stop()` and some getters lack a wrapper path; their errors remain explicit. Native viewState is a camera target applied through ordinary Camera props when its values change. With target A, user movement to B stays at B while A remains unchanged, including a fresh equal-valued target object. A changed target C requests C; jumpTo with A explicitly requests A again. Removing viewState releases the target. Native onMove and camera readouts use observed movement; SDK ornaments retain selected renderer behavior. Native location following and an explicit viewState remain mutually exclusive owners. Web viewState continues to delegate controlled behavior to react-map-gl. The strict controlledCamera capability stays unavailable. Renderer acceptance for the changed native behavior remains unverified.

Native `fitBounds.maxZoom` remains owner-deferred and rejects every supplied value, including zero. MapLibre native terrain, globe projection, and elevation queries are unsupported by the pinned wrapper/SDK boundary. Cold-style-cache opening camera behavior on RNMapbox Android awaits verification on this wrapper version. MapLibre iOS applies `maxBounds` to user panning; imperative camera commands can bypass that constraint. Clearing bounds releases the panning limit.

The owner excludes physical-device testing and RNMapbox `invalidateAmbientCache()` and `setMaximumAmbientCacheSize()` from release requirements. These operations are not certified as implemented. Full VoiceOver and TalkBack audits are outside the release certification; facade-owned interaction accessibility remains part of its checks. Representative integration does not certify every upstream expression operator, host property, hardware sensor, or build setting.

The [library boundary](https://github.com/RobJacobson/one-map-react/blob/main/docs/architecture.md) describes what the library owns. [Testing](https://github.com/RobJacobson/one-map-react/blob/main/docs/testing.md) says which checks to run. The archive includes built output, this README, the manifest, the license, and native repairs.

MapLibre React Native 11.5.1 selects MapLibre Native 6.31.0 on iOS and 13.6.1 on Android. Its parser supports Mercator projection, without terrain, sky or global-state style roots. Explicit unsupported roots and silently ignored source/layer fields reject. Unsupported expression operators retain native parser errors; `format.vertical-align` and `number-format.unit` reject before dispatch. The selected style types also describe newer JS features, so their presence alone does not promise native rendering. Use legacy `Layer` style `rasterResampling` for native raster sampling and `iconAllowOverlap`/`textAllowOverlap` for basic symbol overlap. Complete URL styles remain wrapper-owned; their loading/errors use native callbacks.

RNMapbox exposes `LocationPuck.model`, structured `WrapperMapView.onMapLoadingError` payloads, label localization, and `setLanguage` and `normalizeLanguageTag` through the selected entry. Its camera accepts partial edge padding. The shared camera fills omitted edges with zero.

## License

[MIT](LICENSE).
