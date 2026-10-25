# one-map-react

one-map-react supplies shared React map components over react-map-gl, RNMapbox, and MapLibre React Native. Application setup selects an adapter; shared map components import the common entry. The package is ESM and includes TypeScript declarations.

This release candidate is under verification. Expanded peer ranges are declared, while the release inventory and renderer acceptance gates remain open. The candidate currently targets the exact minimum peers listed below. Endpoint checks also cover React/DOM 19.3.1 on web, Mapbox GL JS 3.33.0, MapLibre GL JS 6.14.0, RNMapbox 10.3.8, and Teleport 1.2.2. Native React/DOM remain 19.2.3 with React Native 0.87.1. The configured minimum release age remains enabled. These are routine consumer checks; release renderer certification is pending. The source checkout records detailed compatibility evidence in `records/support-matrix.json`.

The next incompatible release has an agreed narrower [scope and migration contract](../../docs/revised-api-proposal.md), with migration in progress. Its After examples target that future release. This README describes the existing API. The four development-branch selected refs add asynchronous getWrapperMap returning the attached react-map-gl MapRef, RNMapbox MapView, or MapLibre Native Map wrapper; each call looks up the current borrowed handle without waiting for load and rejects when detached. Advanced-method removals remain pending. See the [unit status](../../docs/revised-api-implementation-plan.md#work-order) for review and verification gates. Current peers, required patches, installation instructions, and release verification limits remain applicable to this candidate.

## Install one backend

Install this candidate from its local archive until it is published:

```sh
bun add /absolute/path/one-map-react-0.1.0-rc.2.tgz
```

Add only the peers for the selected adapter. These commands use the minimum host tuple; use the endpoint tuple above only within the stated verification scope.

| Adapter entry | Application-owned peers |
| --- | --- |
| `one-map-react/mapbox-web` | `bun add react@19.2.3 react-dom@19.2.3 react-map-gl@8.1.3 mapbox-gl@3.32.0` |
| `one-map-react/maplibre-web` | `bun add react@19.2.3 react-dom@19.2.3 react-map-gl@8.1.3 maplibre-gl@6.13.0` |
| `one-map-react/mapbox-native` | `bun add react@19.2.3 react-dom@19.2.3 react-native@0.87.1 @rnmapbox/maps@10.3.7 react-native-teleport@1.2.1` |
| `one-map-react/maplibre-native` | `bun add react@19.2.3 react-dom@19.2.3 react-native@0.87.1 @maplibre/maplibre-react-native@11.5.0 react-native-teleport@1.2.1 @types/geojson@7946.0.16` |

React is required. Other host, wrapper, SDK, and portal peers are optional so a common-entry consumer does not install a map engine. Native portals require React DOM as a transitive declaration/runtime dependency; its presence does not mean a web map engine is bundled. React Native 0.87.1 embeds React 19.2.3; keep that exact native React tuple even though its npm peer declaration permits newer React releases.

Web entry files also import their selected SDK stylesheet:

```tsx
// MapLibre web setup. Mapbox uses mapbox-gl/dist/mapbox-gl.css instead.
import "maplibre-gl/dist/maplibre-gl.css";
```

Mapbox applications set their public access token before mounting maps. Web applications set `mapboxgl.accessToken` on their application-owned `mapbox-gl` import. Native applications call the selected entry's `setAccessToken(token)`. Token names and storage belong to the application; never embed a secret download token.

## Shared map

This component runs on either host. Web supplies a sized container; native can replace the style with `{ flex: 1 }`.

```tsx
import { Layer, Map as OneMap, Source } from "one-map-react";

export const SharedMap = () => (
  <OneMap
    style={{ width: 600, height: 400 }}
    mapStyle={{ version: 8, sources: {}, layers: [] }}
    initialViewState={{
      longitude: -122.34,
      latitude: 47.61,
      zoom: 11,
      bearing: 0,
      pitch: 0,
    }}
  >
    <Source
      id="route"
      type="geojson"
      data={{
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [[-122.36, 47.60], [-122.32, 47.64]],
        },
      }}
    >
      <Layer
        id="route-line"
        type="line"
        paint={{ "line-color": "#2563eb", "line-width": 3 }}
      />
    </Source>
  </OneMap>
);
```

Setup wraps that component once:

```tsx
import { MapSetup } from "one-map-react";
import { adapter } from "one-map-react/maplibre-web";
import { SharedMap } from "./shared-map.js";

export const App = () => (
  <MapSetup adapter={adapter}>
    <SharedMap />
  </MapSetup>
);
```

For mixed engines, keep this setup import in platform files. A `setup.ts` can select `mapbox-web`, while `setup.native.ts` selects `maplibre-native`; reverse those choices for the other combination. The shared component remains unchanged. The `mapbox` and `maplibre` aliases select web under `browser`, native under `react-native`, and web by default. Browser takes precedence when both conditions are active. Explicit adapter paths avoid relying on tool-specific conditions. Changing the `MapSetup` adapter or location provider requires a new React key to reset the map tree and its pending work.

`MapRef` camera, query, cluster, and feature-state methods return promises. A camera command resolves when its wrapper accepts dispatch, before an animation necessarily finishes. Queries propagate failures; empty successful results remain distinct. `useMap()` reads the enclosing map; `Map.id` and `useMap(id)` provide setup-local named maps. Named lookup returns `undefined` before attachment and after removal, and updates when the map attaches. See [camera and events](https://github.com/RobJacobson/one-map-react/blob/main/docs/tf04-camera.md) and [queries](https://github.com/RobJacobson/one-map-react/blob/main/docs/tf06-queries.md).

UI creation options compare their effective defaults. For example, changing a control's omitted `position` to its existing default does not require remounting. Genuine creation changes still require a new React key. Backend-specific defaults and unsupported requests retain their selected implementation's behavior.

The published JavaScript includes React Compiler optimizations targeting React 19. Applications do not need to enable a compiler or install a compiler runtime package. Callback teardown, immutable creation rules, and resource ownership remain explicit library behavior.

## Selected extensions

Selected `Map` components add typed `options` and `hostProps`; common props take precedence. Selected web `Source` and `Layer` accept their complete SDK style families. SDK-specific props and expression types stay outside portable declarations.

```tsx
import { Map as SelectedMap } from "one-map-react/maplibre-web";

export const WebMap = () => (
  <SelectedMap
    mapStyle={{ version: 8, sources: {}, layers: [] }}
    initialViewState={{ longitude: 0, latitude: 0, zoom: 0, bearing: 0, pitch: 0 }}
    style={{ width: 600, height: 400 }}
    options={{ maxCanvasSize: [4096, 4096] }}
    hostProps={{ "aria-label": "Route map" }}
  />
);
```

Render this inside `MapSetup` with the matching adapter. Selected `WebMapRef` adds synchronous SDK readbacks, dynamic `on`/`off`/`once` subscriptions, control methods, and named advanced operations. Retained `WebMapRef` calls throw synchronously after detachment. Returned source/handler objects are borrowed SDK resources with upstream lifetime; retaining those objects does not add a facade detachment guard. `getGestureHandler(name)` supplies typed handler controls and actual state readbacks. Applications remove their dynamic subscriptions and controls before map teardown. Avoid changing the same resource through both imperative control methods and React `Control` composition.

For complete native wrapper-specific composition, use the named wrapper exports together:

```tsx
import { WrapperMapView, WrapperCamera, WrapperShapeSource } from "one-map-react/mapbox-native";

export const NativeWrapperMap = () => (
  <WrapperMapView
    style={{ flex: 1 }}
    styleJSON={JSON.stringify({ version: 8, sources: {}, layers: [] })}
  >
    <WrapperCamera centerCoordinate={[0, 0]} zoomLevel={0} />
    <WrapperShapeSource id="selected" shape={{ type: "FeatureCollection", features: [] }} />
  </WrapperMapView>
);
```

This composition uses wrapper props and refs directly and does not create the facade's map registry. Keep `WrapperCamera` inside its `WrapperMapView` (MapLibre uses `WrapperMap`). The shared `Map` already owns its camera. RNMapbox 10.3.8 adds selected `setLanguage` and `normalizeLanguageTag`; calling either with 10.3.7 reports that the operation requires the newer wrapper. Language tags pass unchanged to `setLanguage`.

See [advanced rendering](https://github.com/RobJacobson/one-map-react/blob/main/docs/tf09-rendering.md) and [UI](https://github.com/RobJacobson/one-map-react/blob/main/docs/tf07-ui.md) for supported compositions and observed differences.

## Native patches and linking

Apply the repair for the exact installed native wrapper. Patches ship inside this package and belong in the application's dependency installation.

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

Native autolinking must include the selected wrapper and `react-native-teleport`. Install the iOS dependencies (`cd ios && bundle exec pod install` in a standard React Native application), then rebuild the iOS and Android apps. A JavaScript reload cannot install patched native files. RNMapbox requires New Architecture and Mapbox v11. Pin the native Mapbox Maps SDK to exactly **11.23.1** on both platforms. The npm wrapper's 10.x version is separate from the deprecated native SDK v10. Set the iOS Podfile variable before native dependency discovery:

```ruby
$RNMapboxMapsVersion = '= 11.23.1'
```

Set Android's root `android/build.gradle` inside `buildscript { ext { ... } }`:

```groovy
RNMapboxMapsVersion = '11.23.1'
```

Record the resolved SDK version in each application lockfile/build. Follow the selected wrapper's native setup for any SDK overrides.

## Location, offline storage, and capture

`useMapServices()` exposes explicit location acquisition and, on native, persistent offline packs and independent images. Reading services starts no acquisition. Dispose each location subscription when its consumer unmounts. `UserLocation` draws a supplied position; selected pucks and location options retain provider-driven tracking.

Browser acquisition needs a secure context and permission from the user. Native applications declare location usage descriptions in `Info.plist`, add the relevant Android foreground location permissions, and request permission before acquisition. RNMapbox iOS explicit permission requests need the application's `MapSetup.locationProvider`; the wrapper does not supply that request path. Background permission and physical sensor behavior are outside the recorded certification.

Offline packs persist in application storage. Handle download errors/cancellation and avoid destructive cache operations against user data. Independent native images take their own style, camera, dimensions, and resources; they do not inherit mounted map children. Browser offline and independent native-style snapshot services are absent.

Current-map capture requires immutable `captureEnabled` at construction and an explicit call such as `map.capture({ output: "data-url", scope: "backend" })`. Web capture preserves the drawing buffer and excludes DOM markers, popups, and controls. Native backend scope follows the wrapper's SDK/view capture; iOS hierarchy capture rejects strict renderer scope. Native file output is temporary. See [services and capture](https://github.com/RobJacobson/one-map-react/blob/main/docs/tf08-location-offline-capture.md) for dimensions, permissions, and inclusion boundaries.

## Current limitations

Web map reuse delegates to react-map-gl. Native `reuseMaps`, external `gl`, and `resize()` reject. Native imperative `stop()` and some getters lack a wrapper path; their errors remain explicit. Native `viewState` writes camera props and reconciles rejected movement after application callbacks commit. SDK constraints can clamp a correction; the adapter avoids correction loops and retries on a fresh gesture, common camera command, or React target. This behavior has focused mocked coverage; native renderer acceptance remains unverified and `controlledCamera` stays unavailable.

Native `fitBounds.maxZoom` remains owner-deferred and rejects every supplied value, including zero. MapLibre native terrain, globe projection, and elevation queries are unsupported by the pinned wrapper/SDK boundary. RNMapbox Android's opening camera retains its documented cold-style-cache behavior.

The owner excludes physical-device testing and RNMapbox `invalidateAmbientCache()` and `setMaximumAmbientCacheSize()` from release requirements. These operations are not certified as implemented. Full VoiceOver and TalkBack audits are outside the release certification; facade-owned interaction accessibility remains part of its checks. Representative integration does not certify every upstream expression operator, host property, hardware sensor, or build setting.

The [requirements](https://github.com/RobJacobson/one-map-react/blob/main/docs/requirements.md), [stage plan](https://github.com/RobJacobson/one-map-react/blob/main/docs/stage-plan.md), and [testing policy](https://github.com/RobJacobson/one-map-react/blob/main/docs/testing-policy.md) describe release scope and evidence. The archive includes built output, this README, the manifest, the license, and native repairs.

## License

[MIT](LICENSE).

MapLibre Native 11.5.0 uses native SDK iOS6.31.0 and Android13.6.1. Its parser supports Mercator projection, without terrain, sky or global-state style roots. Explicit unsupported roots and silently ignored source/layer fields reject. Unsupported expression operators retain native parser errors; `format.vertical-align` and `number-format.unit` reject before dispatch. The selected style types also describe newer JS features, so their presence alone does not promise native rendering. Use legacy `Layer` style `rasterResampling` for native raster sampling and `iconAllowOverlap`/`textAllowOverlap` for basic symbol overlap. Complete URL styles remain wrapper-owned; their loading/errors use native callbacks.

RNMapbox 10.3.8 adds `LocationPuck.model`, structured `WrapperMapView.onMapLoadingError` payloads and optional edges in `WrapperCamera` stop padding; these selected signatures follow the installed peer. Common padding still fills omitted edges with zero. `localizeLabels` explicitly rejects on 10.3.7 with native SDK 11 and delegates on 10.3.8. `setLanguage`/`normalizeLanguageTag` also require 10.3.8 and reject clearly on 10.3.7.
