# one-map-react

Use the same map screen with stock react-map-gl on web and a native map on iOS or Android. one-map-react translates desktop camera, source, layer, marker and query calls to RNMapbox or MapLibre React Native. Choose the renderer in a platform file. The browser can run without installing one-map-react.

## Install one backend

A stock browser app installs React, React DOM, react-map-gl and its chosen GL JS engine. Import the matching stylesheet from `mapbox-gl/dist/mapbox-gl.css` or `maplibre-gl/dist/maplibre-gl.css`. Pass a public Mapbox token in `mapboxAccessToken` when your style requires one.

For native development, install the candidate archive and the peers for one engine. These are the package-check versions. Each application owns its React Native host version and SDK configuration.

```sh
bun add /absolute/path/one-map-react-VERSION.tgz
bun add react@19.2.3 react-dom@19.2.3 react-native@0.87.1 react-native-teleport@1.2.2
# Choose one
bun add @rnmapbox/maps@10.3.7
bun add @maplibre/maplibre-react-native@11.5.0 @types/geojson@7946.0.16
```

Apply the [version-specific native repair](#native-patches-and-linking) and rebuild the app. RNMapbox applications call the native entry's `setAccessToken` with their public token. Native live markers use react-native-teleport to keep interactive children in the React tree.

## Migration from the four-backend facade

This is a breaking change in the development checkout. Keep your previous archive or pinned release while migrating, and use a distinct version when publishing the new API.

Replace the old web `MapSetup` and its adapter with a platform import. The example below selects MapLibre GL JS and RNMapbox independently. Swap either import to choose the other engine on that platform.

```ts
// maps.web.ts
export { Map, Layer, Marker, Source, MapProvider, useMap } from "react-map-gl/maplibre";
```

```ts
// maps.native.ts
export { Map, Layer, Marker, Source, MapProvider, useMap } from "one-map-react/mapbox-native";
```

Import from `./maps` in your screen and mount `<Map>` directly. TypeScript platform files can also re-export `MapRef`, `MapProps`, `SourceProps`, `LayerProps`, and `MarkerProps` with the same names on each platform. Each type describes the selected implementation. Use the same selection for its descendants and hook. The [vessel example](https://github.com/RobJacobson/one-map-react/tree/main/packages/example-map/reference) shares its source, layers, click handling and camera call across all four choices. The host supplies marker controls and a sized map container.

| Previous usage | Replacement |
| --- | --- |
| Root components and `MapSetup` on web | Stock `react-map-gl/mapbox` or `react-map-gl/maplibre`. The optional `one-map-react/mapbox-web` and `/maplibre-web` paths forward all upstream exports, including the default and types. |
| A single engine across platforms | Import `one-map-react/mapbox` or `one-map-react/maplibre`. Browser and default resolve upstream. The React Native condition resolves the bound native shim. Browser wins when both conditions are active. |
| Root components and `MapSetup` on native | Import from the bound native entry. During migration, the root and `one-map-react/legacy` expose the same deprecated, native-only setup and hook. |
| `WrapperPopup`, `WrapperMarker`, `useWrapperMap`, other browser aliases | Use upstream names such as `Popup`, `Marker`, and `useMap`. Import SDK classes and functions directly from the chosen GL JS package. |
| Web `options`, `hostProps`, and `getWrapperMap()` | Pass the supported upstream props directly to `Map`. Put DOM attributes on its parent. The ref is already a react-map-gl `MapRef`. Use its `getMap()` to borrow the GL JS instance. |
| `Images` and `UserLocation` | Import from `one-map-react/native-extensions` within a native map. On web, manage style images through the chosen SDK's load/add/update/remove APIs and reinstall owned images when replacing the style. Draw supplied location with a marker or a GeoJSON source and circle layers. The application owns acquisition and permissions. |

**Clicks and queries.** Pass layer IDs to `interactiveLayerIds` and read upstream results in `onClick`. A browser event already carries the hit features. Replace tuple destructuring with `event.lngLat.lng`, `event.lngLat.lat`, `event.point.x`, and `event.point.y`. Wheel events expose the upstream wheel event. Applications which previously relied on facade errors for unavailable layers can check `map.getLayer(id)` and issue an explicit renderer query when they need that diagnostic.

```tsx
<Map interactiveLayerIds={["vessels"]} onClick={event => {
  selectVessel(event.features?.[0]?.id, event.lngLat.lng, event.lngLat.lat);
}} />
```

**Camera reads.** Web reads such as `map.getZoom()` are synchronous. Replace `map.getZoom().then(...)` in shared handlers with `const zoom = await map.getZoom()`. Native reads cross the bridge. Use `const center = await map.getCenter()` and read `center.lng` and `center.lat`. Pass an options object to commands, for example `map.flyTo({ center: [-122.45, 47.61], zoom: 12 })`.

**Clusters.** Retrieve the mounted source by ID. Narrow the stock web source to the selected SDK's `GeoJSONSource` (for example, `map.getSource<GeoJSONSource>("vessels")` on Mapbox). With the pinned Mapbox GL JS use `source?.getClusterExpansionZoom(id, callback)`. With MapLibre GL JS use `await source?.getClusterExpansionZoom(id)`. Native source handles accept either form. Check for a missing source after replacement or teardown.

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

Native selected maps accept partial initial camera settings, desktop camera commands, and click fields such as `event.lngLat.lng` and `event.point.x`. Await native reads including `getCenter()`, `project()`, and `getBounds()`. Use `map.getSource(id)` to access a mounted GeoJSON source's cluster methods. Both promise and error-first callback calls are supported on native. [Native compatibility contract](https://github.com/RobJacobson/one-map-react/blob/main/docs/revised-api-proposal.md#native-compatibility-contract).

Existing root components inside a selected native map follow that map's adapter. With `MapSetup` alone, explicit IDs remain available to the root hook. When a selected `MapProvider` encloses the map, it owns named lookup through the selected hook. The MapLibre native `Layer` also accepts SDK-specific props, including `afterId`, `layerIndex`, and legacy `style`.

## Advanced native APIs

Use `await map.getWrapperMap()` when an operation needs the mounted native wrapper. RNMapbox exposes `takeSnap` and MapLibre React Native exposes `createStaticMapImage`. Both native entries expose version-specific wrapper components and offline/location managers. An application owns permission requests, listener cleanup, offline pack identity and snapshot storage. For a raw map and camera, compose RNMapbox’s `WrapperCamera` inside `WrapperMapView`, or the MapLibre equivalent inside `WrapperMap`.

## Native patches and linking

Apply the repair for the exact installed native wrapper. Patches ship inside this package and belong in the application's dependency installation. The RNMapbox repairs preserve SDK feature-state errors, guard removeFeatureState against an absent or changed source family, and correct iOS light-color conversion. The MapLibre repair reports absent Fabric views as attachment errors; explicit native source operations retain dispatch error reporting. Rebuild the native application after updating these patches.

| Wrapper | Included combined repair |
| --- | --- |
| RNMapbox 10.3.7 | `patches/rnmapbox-10.3.7-tf08.patch` |
| RNMapbox 10.3.8 | `patches/rnmapbox-10.3.8.patch` |
| MapLibre native 11.5.0 | `patches/maplibre-native-11.5.0-tf08.patch` |

For RNMapbox 10.3.7, copy the installed package's repair into the application and register it with Bun:

```sh
mkdir -p patches
cp node_modules/one-map-react/patches/rnmapbox-10.3.7-tf08.patch patches/rnmapbox.patch
```

Merge this field into the application `package.json`:

```json
{
  "patchedDependencies": {
    "@rnmapbox/maps@10.3.7": "patches/rnmapbox.patch"
  }
}
```

Run `bun install --force` to establish the patched lockfile, then verify a clean application install with `bun install --frozen-lockfile`. For another wrapper/version, change both the dependency key and copied repair. The combined RNMapbox repair includes the older per-view-event fix; apply one combined repair per version. Unknown later native wrapper versions need a patch audit before use.

The versioned repairs also release camera bounds when `maxBounds` is cleared. RNMapbox 10.3.7 requires an explicit unrestricted SDK bound on both platforms and forwarding of the cleared Fabric prop on iOS; 10.3.8 already supplies those resets. MapLibre 11.5.0 requires clearing the retained iOS delegate constraint and Android SDK target bounds. Rebuild native applications after applying these repairs.

Native applications require `react-native-teleport` 1.2.2 or newer in the supported 1.x range. Version 1.2.2 includes the [Android transition/reparenting repair](https://github.com/kirillzyusko/react-native-teleport/commit/9cebbb23c645c31113cb913cb1f73465d4c8ca96) and React Native 0.87 support; rebuild after upgrading. Native autolinking must include the selected wrapper and `react-native-teleport`. Install the iOS dependencies (`cd ios && bundle exec pod install` in a standard React Native application), then rebuild the iOS and Android apps. A JavaScript reload cannot install patched native files. RNMapbox requires New Architecture and Mapbox v11. Pin the native Mapbox Maps SDK to exactly **11.23.1** on both platforms. The npm wrapper's 10.x version is separate from the deprecated native SDK v10. Set the iOS Podfile variable before native dependency discovery:

```ruby
$RNMapboxMapsVersion = '= 11.23.1'
```

Set Android's root `android/build.gradle` inside `buildscript { ext { ... } }`:

```groovy
RNMapboxMapsVersion = '11.23.1'
```

Record the resolved SDK version in each application lockfile/build. Follow the selected wrapper's native setup for any SDK overrides.

## Current limitations

Web map reuse delegates to react-map-gl. Native reuseMaps={true}, external `gl`, and `resize()` reject; reuseMaps={false} is accepted. Native imperative `stop()` and some getters lack a wrapper path; their errors remain explicit. Native viewState is a camera target applied through ordinary Camera props when its values change. With target A, user movement to B stays at B while A remains unchanged, including a fresh equal-valued target object. A changed target C requests C; jumpTo with A explicitly requests A again. Removing viewState releases the target. Native onMove and camera readouts use observed movement; SDK ornaments retain selected renderer behavior. Native location following and an explicit viewState remain mutually exclusive owners. Web viewState continues to delegate controlled behavior to react-map-gl. The strict controlledCamera capability stays unavailable. Renderer acceptance for the changed native behavior remains unverified.

Native `fitBounds.maxZoom` remains owner-deferred and rejects every supplied value, including zero. MapLibre native terrain, globe projection, and elevation queries are unsupported by the pinned wrapper/SDK boundary. RNMapbox Android's opening camera retains its documented cold-style-cache behavior. MapLibre iOS applies `maxBounds` to user panning; imperative camera commands can bypass that constraint. Clearing bounds releases the panning limit.

The owner excludes physical-device testing and RNMapbox `invalidateAmbientCache()` and `setMaximumAmbientCacheSize()` from release requirements. These operations are not certified as implemented. Full VoiceOver and TalkBack audits are outside the release certification; facade-owned interaction accessibility remains part of its checks. Representative integration does not certify every upstream expression operator, host property, hardware sensor, or build setting.

The [requirements](https://github.com/RobJacobson/one-map-react/blob/main/docs/requirements.md), [stage plan](https://github.com/RobJacobson/one-map-react/blob/main/docs/stage-plan.md), and [testing policy](https://github.com/RobJacobson/one-map-react/blob/main/docs/testing-policy.md) describe release scope and evidence. The archive includes built output, this README, the manifest, the license, and native repairs.

MapLibre Native 11.5.0 uses native SDK iOS6.31.0 and Android13.6.1. Its parser supports Mercator projection, without terrain, sky or global-state style roots. Explicit unsupported roots and silently ignored source/layer fields reject. Unsupported expression operators retain native parser errors; `format.vertical-align` and `number-format.unit` reject before dispatch. The selected style types also describe newer JS features, so their presence alone does not promise native rendering. Use legacy `Layer` style `rasterResampling` for native raster sampling and `iconAllowOverlap`/`textAllowOverlap` for basic symbol overlap. Complete URL styles remain wrapper-owned; their loading/errors use native callbacks.

RNMapbox 10.3.8 adds `LocationPuck.model`, structured `WrapperMapView.onMapLoadingError` payloads and optional edges in `WrapperCamera` stop padding; these selected signatures follow the installed peer. Common padding still fills omitted edges with zero. `localizeLabels` explicitly rejects on 10.3.7 with native SDK 11 and delegates on 10.3.8. `setLanguage`/`normalizeLanguageTag` also require 10.3.8 and reject clearly on 10.3.7.

## License

[MIT](LICENSE).
