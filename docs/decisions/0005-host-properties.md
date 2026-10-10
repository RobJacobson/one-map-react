# Typed host properties

**Historical decision.** This record describes the previous implementation. Preserve its upstream evidence and observed failures, but assess its design choices against the [thin-facade requirements](../requirements.md). Its instructions and acceptance results do not govern or certify the replacement.

**Agreed design:** `Map.hostProps` carries properties of the web or native view that hosts a map. Host callbacks retain their platform event types; normalized map events belong to `Map` callbacks. Each selected adapter entry now exports `createHostProps` to check host properties without importing DOM or React Native types into the common entry.

A host property controls the containing view, such as its accessibility label or focus callback. It does not configure the rendering SDK. Use `Map.style` for host dimensions, `Map.id` for the registered map session, and the separate [constructor configuration](0004-map-constructor-configuration.md) for implemented initial renderer settings.

## Research and verification basis

**Existing API:** inspected on October 8, 2026 against React and React DOM 19.2.3, React Native 0.87.1, React types 19.3.0, RNMapbox 10.3.7 at `0f50e8164c1aefe45de9ed9cde310f310076a310`, MapLibre React Native 11.5.0 at `059f46b2dc728fb6259af91b27a071bcda19a2ae`, and react-map-gl 8.1.3 at `3df834290bdecf4f5c9b90d7c117d95af12c1f0a`. The React Native package root selects generated declarations under the tested default conditions; its older handwritten declarations differ. The [generated host inventory audit](../../records/evidence/native-generated-host-inventory.json) records the resolved property and event types. This difference does not establish an SDK limitation.

**Implemented scope:** the factories, reserved-property checks, host forwarding, and updates described below exist. Both packed production web backends pass attribute update/removal and focus-callback checks. React Native component tests use mocked SDK components and verify adapter forwarding and callback replacement. Native accessibility and input behavior remain runtime acceptance work; see [host evidence](../../records/evidence/host-properties.json).

Native consumer checks use the pinned [React Native 0.87.1 TypeScript configuration](https://github.com/facebook/react-native/blob/v0.87.1/packages/typescript-config/tsconfig.json#L29-L38), which enables `strict` and `skipLibCheck` and selects JavaScript libraries without the browser DOM library. Checking every installed declaration with `skipLibCheck=false` reproduces three generated React Native declaration diagnostics in a React Native-only fixture as well as a one-map-react native-host fixture; [host evidence](../../records/evidence/host-properties.json) retains those failures. These are upstream type-checking defects, not SDK feature limitations. A compatible consumer check must be paired with a separate strict check of one-map-react's own published declarations; [selection evidence](../../records/evidence/selection.json) records whether those checks have run. Do not select legacy handwritten React Native declarations to hide errors or remove current host fields.

## Property ownership

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| Native view properties inherit React Native `ViewProps`; the wrapper forwards map props to the native child while its outer view owns layout. See [MapView render](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx#L1238-L1282). | Native view properties inherit React Native `ViewProps`; the wrapper forwards properties to the native map child, with an outer view that owns layout. See [Map render](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/map/Map.tsx#L662-L694). | The wrapper owns its container and exposes selected container props. Use an application `<div>` for additional DOM attributes and events. See the [Mapbox component](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/components/map.tsx) and [MapLibre component](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/map.tsx). | **Implemented:** `createHostProps` returns a record accepted by `Map.hostProps`. Native entries expose `NativeHostProps`; web entries expose `WebHostProps`. This supplies a typed path while preserving platform event payloads. |
| Native `id` and `nativeID` identify views; see [React Native view identifiers](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/Libraries/Components/View/ViewPropTypes.js). | The same [React Native view identifiers](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/Libraries/Components/View/ViewPropTypes.js) apply. Identifier behavior still depends on the native view host. | DOM `id` is declared by [React HTMLAttributes 19.3.0](https://registry.npmjs.org/@types/react/-/react-19.3.0.tgz). The [Mapbox](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/components/map.tsx) and [MapLibre](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/map.tsx) wrappers have their own map `id`, separate from the application container's `id`. | **Implemented:** `hostProps.id` identifies the host independently of `Map.id`. Native `id`/`nativeID` resolution follows React Native. one-map-react does not translate them into map registration IDs. Final packed native lookup acceptance remains in progress. |

one-map-react places web host properties on its owned `<div>` and both native adapters' properties on their owned outer `View`. Earlier MapLibre evidence forwarded them to the wrapper's native map child; the current owned-host composition gives both native adapters the same receiving-view boundary. Native host layout callbacks therefore describe the view receiving the callback; they are not normalized map events or evidence that the SDK has finished rendering.

The native helper accepts the selected React Native `ViewProps` except `children` and `style`; those remain owned by `Map`. The web helper accepts React `HTMLAttributes<HTMLDivElement>` except `children`, `style`, and `dangerouslySetInnerHTML`, plus typed `data-*` attributes. Runtime checks also reject `ref`, `key`, and one-map-react's reserved `data-one-map-react-id` marker on web. Native unknown or reserved keys fail with `InvalidMapOptionError` in the helper. This does not mean every accepted native attribute has been runtime verified on both platforms.

`Map.style` preserves the selected host's style values. Native maps accept recursive conditional style arrays, including `null`, `undefined`, `false`, and empty-string entries, through the SDK-free `HostStyle` type. These are [React Native StyleProp values](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/Libraries/StyleSheet/StyleSheetTypes.js#L1095-L1098); they retain the receiving `View`'s flattening behavior. An omitted native style fills its parent with `flex: 1`; an explicit falsy style remains explicit. Web maps require a CSS property object and reject native arrays or falsy sentinels with `InvalidMapOptionError`; an omitted web style fills its parent with 100% width and height.

Both native adapters retain the receiving host in the native hierarchy with `collapsable={false}` because resize and initial-style observation locate that owned view through React Native's registry. The [React Native optimization hint](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/Libraries/Components/View/ViewPropTypes.js#L454-L471) permits removal when `collapsable` is true; it does not require removal. This is an owned-host composition, not an SDK limitation. A supplied `true` remains accepted, but `Map` retains its required host. `collapsableChildren` remains forwarded and controls a separate optimization for child views. [Fabric view-retention conditions](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/ReactCommon/react/renderer/components/view/ViewShadowNode.cpp#L44-L85) explain why identifiers, event handlers, or a test ID can also retain views; one-map-react does not depend on callers supplying those attributes.

The helpers provide declaration checking and validate record shape and key ownership; they do not validate every attribute value at runtime. The web runtime validator rejects reserved keys without enforcing an exhaustive DOM attribute whitelist.

Factories copy and freeze the outer property record. They preserve callback identity and nested values; callers should treat nested values as immutable and supply a new property record when updating them. Host updates do not require a map remount. Removing an optional property follows the receiving host's semantics, with an owned Android accessibility correction. React Native 0.87.1 can leave its prior content description when an omitted label produces no remaining description fragments; see [BaseViewManager label/hint updates and content-description assembly](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/uimanager/BaseViewManager.java#L328-L452). one-map-react reconciles label/hint removal while preserving current accessibility state and value content. This behavior is source-backed and has provisional native observations; final artifact acceptance remains in progress. Renderer configuration has its own ownership and reset rules.

## Equivalent host examples

These examples place an empty Seattle map inside a host with an accessibility label and a focus callback. Every host is 320 by 240 logical screen units; web units are CSS pixels and native units are points or density-independent pixels. The native upstream examples use an explicit outer `View` so the application owns the demonstrated host callback. Configure the public Mapbox token during native application bootstrap before mounting the RNMapbox example. The web examples assume a bundler that loads CSS imports and supplies their type declarations.

RNMapbox:

```tsx
import { Camera, MapView } from "@rnmapbox/maps";
import { View } from "react-native";

// Public Mapbox token initialization before mounting is omitted.
export function SeattleMap() {
  return (
    <View
      id="seattle-host"
      style={{ width: 320, height: 240 }}
      accessible
      accessibilityLabel="Seattle map"
      onFocus={() => console.log("Map host focused")}
    >
      <MapView
        style={{ flex: 1 }}
        styleJSON='{"version":8,"sources":{},"layers":[]}'
      >
        <Camera defaultSettings={{
          centerCoordinate: [-122.34, 47.61], zoomLevel: 11,
        }} />
      </MapView>
    </View>
  );
}
```

MapLibre React Native:

```tsx
import { Camera, Map } from "@maplibre/maplibre-react-native";
import { View } from "react-native";

export function SeattleMap() {
  return (
    <View
      id="seattle-host"
      style={{ width: 320, height: 240 }}
      accessible
      accessibilityLabel="Seattle map"
      onFocus={() => console.log("Map host focused")}
    >
      <Map
        style={{ flex: 1 }}
        mapStyle={{ version: 8, sources: {}, layers: [] }}
      >
        <Camera initialViewState={{
          center: [-122.34, 47.61], zoom: 11,
        }} />
      </Map>
    </View>
  );
}
```

react-map-gl using MapLibre GL JS:

```tsx
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

export function SeattleMap() {
  return (
    <div
      id="seattle-host"
      style={{ width: 320, height: 240 }}
      aria-label="Seattle map"
      tabIndex={0}
      onFocus={() => console.log("Map host focused")}
    >
      <Map
        style={{ width: "100%", height: "100%" }}
        mapStyle={{ version: 8, sources: {}, layers: [] }}
        initialViewState={{
          longitude: -122.34, latitude: 47.61, zoom: 11,
        }}
      />
    </div>
  );
}
```

one-map-react using the implemented web helper:

```tsx
import { Map, OneMapProvider } from "one-map-react";
import { adapter, createHostProps } from "one-map-react/maplibre-web";
import "maplibre-gl/dist/maplibre-gl.css";

const hostProps = createHostProps({
  id: "seattle-host",
  "aria-label": "Seattle map",
  tabIndex: 0,
  onFocus: () => console.log("Map host focused"),
});

export function SeattleMap() {
  return (
    <OneMapProvider adapter={adapter}>
      <Map
        id="seattle"
        hostProps={hostProps}
        style={{ width: 320, height: 240 }}
        mapStyle={{ version: 8, sources: {}, layers: [] }}
        initialViewState={{
          longitude: -122.34, latitude: 47.61, zoom: 11,
        }}
      />
    </OneMapProvider>
  );
}
```

The web examples make the host keyboard-focusable with `tabIndex={0}`. Native `onFocus` depends on platform focus behavior, input hardware, and focusability; `accessible` is an accessibility attribute and does not promise the same keyboard interaction as web. The examples compare property ownership, not identical focus behavior. To use the native helper, import `createHostProps` from `one-map-react/mapbox-native` or `one-map-react/maplibre-native` and provide native attributes such as `accessibilityLabel`; DOM attributes do not become native attributes automatically.

## Verification scope

The [current packed selection checks](../../records/evidence/selection.json) pass in all six selected-peer configurations. Web checks include strict declarations; configurations containing React Native pair compatible strict application checks with a strict audit of one-map-react's own reachable published declarations. The three independently reproduced React Native declaration diagnostics remain recorded. These checks do not verify native view behavior, and S51 still requires checks against the final release artifact.

**Assigned work:** the [primary generated-host decisions](../../records/evidence/native-generated-host-decisions.json) add 294 entries to S04.generated-host, bringing the inventory to 12131 entries. Their applicable support cells require investigation, and the stage remains implemented-unverified. Ten historical fields belong to separately exported Apple TV declarations, outside these six browser/smartphone targets. Their original IDs and corrected provenance remain in the inventory; this scope decision does not establish an SDK limitation.

**Open question:** positive type checks establish usable property types, not accessibility behavior, native ID lookup, responder or pointer behavior, or device-specific event delivery. S04 keeps these runtime gates open, and S51 must repeat accepted scenarios against the final packed artifact.
