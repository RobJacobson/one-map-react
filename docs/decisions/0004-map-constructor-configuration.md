# Initial map configuration

**Historical decision.** This record describes the previous implementation. Preserve its upstream evidence and observed failures, but assess its design choices against the [thin-facade requirements](../requirements.md). Its instructions and acceptance results do not govern or certify the replacement.

**Agreed design:** A selected web entry exports `createMapConfiguration(options)`. Its result is accepted by `Map.configuration`. The factory and constructor forwarding are implemented. Selected typed `getMapSettings(mapRef)` controllers and provider-owned reuse are also implemented. The expanded packed browser checks observe each ordinary constructor option, mutable settings and resets, non-shared external context ownership, and cleanup on both renderers. Native error delivery and final-artifact acceptance remain in progress; these browser observations do not complete S04.

## Research basis

Inspected on 2026-10-08 against RNMapbox 10.3.7, MapLibre React Native 11.5.0, react-map-gl 8.1.3, Mapbox GL JS 3.32.0, and MapLibre GL JS 6.13.0. Exact source revisions and compatible React hosts are in [the baseline](../../records/version-baseline.json). The [coverage inventory](https://github.com/RobJacobson/one-map-react/blob/cb12433fd9f1a68ef8a8fcf5eaf65e34a0c69e39/records/api-coverage.json) assigns each upstream field and operation independently of this decision.

## Constructor ownership

The rendering SDK creates its canvas, interaction handlers, and resource caches when the wrapper mounts. Some options affect that creation and have no equivalent update operation. one-map-react validates and copies explicit constructor options before mounting the wrapper. It preserves omitted values so the pinned SDK supplies its defaults. Changing a constructor option requires remounting `Map`; passing an equivalent configuration object is allowed.

`initialViewState` has a separate initialization contract: later valid values are ignored while the map remains mounted. `style` and `hostProps` can update the host's layout and presentation. A changed `mapStyle` currently reports pending S09 work; style replacement and resource recovery are not implemented by this constructor facility.

The returned `BackendMapConfiguration` has a backend discriminator and an opaque identity. The common entry exposes its type without importing a renderer, DOM class, or native SDK. A configuration made for another backend, a forged object, an unknown option, or an invalid value raises `InvalidMapOptionError` before wrapper creation. This is argument validation, not an unsupported-feature decision.

Importing the factory from `one-map-react/mapbox-web` or `one-map-react/maplibre-web` evaluates that selected browser SDK and wrapper entry. Type isolation in the common entry does not remove the selected runtime dependency. `one-map-react/mapbox-native` also exports `createMapConfiguration` for the mutable attribution-button tint contract described below. A web configuration cannot configure a native map.

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`MapView` props](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx) configure a native view; they do not expose a WebGL canvas constructor. | [`Map` props](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/map/Map.tsx) configure a native view. | The [Mapbox wrapper](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/mapbox/mapbox.ts) and [MapLibre wrapper](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/maplibre/maplibre.ts) pass construction options to their selected SDK. | **Implemented:** `Map.configuration` accepts a selected web factory result. Explicit validation and immutable ownership adapt web constructor behavior. Native Mapbox tint has its own mutable update/reset contract. |
| [`MapView.styleJSON` and `styleURL`](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx) select the initial style; [`Camera.defaultSettings`](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/Camera.tsx) selects the initial camera. | [`Map.mapStyle`](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/map/Map.tsx) selects the initial style; [`Camera.initialViewState`](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/camera/Camera.tsx) selects the initial camera. | Both entries use `mapStyle` and `initialViewState`; the [Mapbox](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/mapbox/mapbox.ts) and [MapLibre](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/maplibre/maplibre.ts) implementations construct the initial map. | **Implemented lifecycle slice:** `mapStyle` and `initialViewState` stay common props. Style serialization and camera field conversion belong to the adapter; changing styles remains S09 work. |

Both web factories accept `clickTolerance`, `fadeDuration`, `interactive`, `maxTileCacheSize`, `refreshExpiredTiles`, `trackResize`, `renderWorldCopies`, `reuseMaps`, and a transferred external `gl` context. The MapLibre factory also accepts `validateStyle` and the SDK's `null` cache-size sentinel. The Mapbox factory additionally accepts `antialias`, `contextCreateOptions`, `emissiveColorPrecision`, `minTileCacheSize`, `placementAlgorithm`, `precompilePrograms`, `preserveDrawingBuffer`, `respectPrefersReducedMotion`, `tessellationStep`, `testMode`, `language`, `worldview`, and `scaleFactor`. Selected declarations name those options explicitly; an arbitrary SDK options object is not accepted.

one-map-react's host resize observer remains responsible for keeping the canvas sized to its container. Setting the wrapper's initial `trackResize=false` does not disable that container ownership. The packed scenario observes this distinction by resizing the host with that option disabled.

## Equivalent initial maps

These examples create the same empty style and initial camera at 320 by 240 logical screen units. A source supplies data to a map; this empty style has no sources and draws no data layers. Camera state here supplies center and zoom only. The web examples explicitly choose the three-pixel click tolerance declared by the [Mapbox defaults](https://github.com/mapbox/mapbox-gl-js/blob/v3.32.0/src/ui/map.ts#L262) and [MapLibre defaults](https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/map.ts#L544); the native wrappers have their own interaction configuration. This comparison establishes creation syntax and ownership, not equivalent gesture thresholds across platforms. Upstream examples use the versions in the research basis.

RNMapbox:

```tsx
import { Camera, MapView } from "@rnmapbox/maps";

// Configure the public runtime token before mounting the native map.
const style = { version: 8, sources: {}, layers: [] };

export function Example() {
  return (
    <MapView
      style={{ width: 320, height: 240 }}
      styleJSON={JSON.stringify(style)}
    >
      <Camera
        defaultSettings={{
          centerCoordinate: [-122.33, 47.6],
          zoomLevel: 11,
        }}
      />
    </MapView>
  );
}
```

MapLibre React Native:

```tsx
import { Camera, Map } from "@maplibre/maplibre-react-native";

const style = { version: 8 as const, sources: {}, layers: [] };

export function Example() {
  return (
    <Map mapStyle={style} style={{ width: 320, height: 240 }}>
      <Camera initialViewState={{ center: [-122.33, 47.6], zoom: 11 }} />
    </Map>
  );
}
```

react-map-gl, Mapbox entry:

```tsx
import { Map } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

// Supply this binding from the application's environment configuration.
declare const MAPBOX_PUBLIC_TOKEN: string;
const style = { version: 8 as const, sources: {}, layers: [] };

export function Example() {
  return (
    <Map
      mapboxAccessToken={MAPBOX_PUBLIC_TOKEN}
      mapStyle={style}
      initialViewState={{ longitude: -122.33, latitude: 47.6, zoom: 11 }}
      style={{ width: 320, height: 240 }}
      clickTolerance={3}
    />
  );
}
```

one-map-react, implemented web constructor contract:

```tsx
import { Map, OneMapProvider } from "one-map-react";
import {
  createMapboxWebAdapter,
  createMapConfiguration,
} from "one-map-react/mapbox-web";
import "mapbox-gl/dist/mapbox-gl.css";

// Supply this binding from the application's environment configuration.
declare const MAPBOX_PUBLIC_TOKEN: string;
const adapter = createMapboxWebAdapter({ accessToken: MAPBOX_PUBLIC_TOKEN });
const configuration = createMapConfiguration({ clickTolerance: 3 });
const style = { version: 8 as const, sources: {}, layers: [] };

export function Example() {
  return (
    <OneMapProvider adapter={adapter}>
      <Map
        id="example"
        configuration={configuration}
        mapStyle={style}
        initialViewState={{ longitude: -122.33, latitude: 47.6, zoom: 11 }}
        style={{ width: 320, height: 240 }}
      />
    </OneMapProvider>
  );
}
```

For MapLibre web, import `adapter` and `createMapConfiguration` from `one-map-react/maplibre-web`, and load the MapLibre GL JS stylesheet. The [selection decision](0003-adapter-selection.md) covers selected dependencies and Metro web worker setup. These examples contain no children; applications using overlays still need DOM children on web and native children on iOS and Android.

## Selected settings and rendering ownership

**Agreed design, implemented:** Both selected web entries export `getMapSettings(mapRef)`, with promise-based `loaded()`, `isStyleLoaded()`, `getRenderWorldCopies()`, and `setRenderWorldCopies(boolean | undefined)`. Mapbox web additionally exposes language, worldview, and scale-factor getters and setters. Language accepts a string, a readonly string array, or `undefined`; input and output arrays are copied. Worldview accepts an uppercase two-letter country code, `null`, or `undefined`. Scale factor requires a finite positive number. Removing world-copy configuration resets the SDK default of `true`; removing language/worldview restores the SDK default, and scale resets explicitly to `1`. The controller validates arguments and selected-backend identity before dispatch, rejects before map readiness and after teardown, and rejects an in-flight result if its map attachment changed. These operations describe stored SDK settings; label content and worldview-dependent source rendering retain their separate data/layer responsibilities.

Initial web configuration remains immutable. A named settings controller updates the current renderer without changing the initial snapshot. With `reuseMaps: true`, one-map-react retains at most one dormant mounted wrapper in the owning provider, in addition to active maps. A compatible logical remount adopts that renderer, restores its initial camera and named settings, and binds new children and callbacks. Unfinished or incompatible renderers are evicted. Logical unmount invalidates the facade immediately; eviction and provider teardown call the SDK's normal removal path. Upstream global reuse stays disabled, so separate providers cannot adopt each other's maps.

`gl` accepts a live WebGL2 context backed by an HTML canvas and transfers its ownership. one-map-react sizes that canvas in device pixels and restores the caller's canvas context method after SDK construction, including constructor failure. Simultaneous maps cannot share the context. A retained compatible pool entry can adopt it; an evicted or retiring renderer cannot release it for a competing map before SDK removal. Disposal may lose the transferred context, so a new map then needs a new context. [S04 acceptance](0006-s04-acceptance.md) records the mechanism and exact runtime scope.

## Native tint and remaining setup

**Agreed design, implemented; runtime acceptance in progress:** Native Mapbox configuration accepts either `tintColor: string` or `tintColorRGBA: readonly [red, green, blue, alpha]`. The four numeric channels are explicitly normalized to `[0,1]` and rounded to native eight-bit color channels; this named option avoids guessing units for the wrapper's undocumented `number[]` transport. The options are mutually exclusive. Updating configuration changes the attribution button's UI accent; removing it restores the captured initial SDK color. The owned bridge composes UIKit/Mapbox ornament updates on iOS and the SDK attribution plugin on Android. This mutable native presentation contract differs from immutable web constructor configuration.

**Existing API:** MapLibre GL JS 6.13.0's [`reduceMotion` constructor path](https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/map.ts#L798-L800) changes a shared browser module value. Its one-map-react facility therefore needs module ownership and conflict/reset behavior across maps; it is assigned to S48d.reduced-motion. The per-map factory rejects this key until that facility is implemented.

**Existing API:** The wrapper tint field alone does not implement the owned tint contract. Label localization retains its existing S48d.label-localization owner. RNMapbox's pinned [Android tint setter](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/android/src/main/java/com/rnmapbox/rnmbx/components/mapview/RNMBXMapViewManager.kt#L375-L379) has no implementation, while [iOS localization](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/ios/RNMBX/RNMBXMapView.swift#L571-L590) schedules a style mutation. Those wrapper mechanisms do not establish a renderer limitation or complete the separately assigned localization contract.

The [assignment review](../../records/evidence/s04-assignment-review.json) records stage corrections without reducing coverage. [Browser evidence](../../records/evidence/web-lifecycle.json) records exact packed artifacts, selected peers, observed behavior, failures, and reruns. The archived implementation-status document remains the source of stage acceptance.
