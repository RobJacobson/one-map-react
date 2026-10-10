# S04 lifecycle acceptance

**Historical decision.** This record describes the previous implementation. Preserve its upstream evidence and observed failures, but assess its design choices against the [thin-facade requirements](../requirements.md). Its instructions and acceptance results do not govern or certify the replacement.

**Agreed design:** S04 implements selected map creation, receiving-host ownership, initial configuration, load and readiness, resize, and teardown. Its S04.generated-host child provides the current inherited native host paths. Historical S04 acceptance covers packed package `f61cdf66806c435653dd56939adf8b389a9f5b892e3d30226d8e3e802f9a1ba8`. The [cleanup evidence](../../records/evidence/s04-style-cleanup.json) records historical renewed six-cell acceptance for the style-cleanup artifact `7a5057f07f3c333d9d03bb62b91e7b19e28b72cf93d1201522c2c9a35092e1c2`; the historical acceptance remains recorded below. S05 remains planned.

**Retired audit revision, implemented-unverified at the time:** the [2026-10-10 audit revision](../../records/evidence/coding-style-audit-2026-10-10.json) changes subscription-failure cleanup, native readiness error classification, configuration responsibility boundaries, and coding-style compliance. Historical acceptance below applies only to its recorded artifacts. Browser, mixed Metro transport, and native acceptance for this revision await explicit permission; see the archived implementation-status document.

Inspected on October 8, 2026 against the [frozen baseline](../../records/version-baseline.json): React and React DOM 19.2.3, React Native 0.87.1, RNMapbox 10.3.7, MapLibre React Native 11.5.0, react-map-gl 8.1.3, Mapbox GL JS 3.32.0, and MapLibre GL JS 6.13.0. The [generated host inventory](../../records/evidence/native-generated-host-inventory.json) records the resolved property and event types. A runtime cell counts for the current `bun run pack` file only.

## Contract and ownership

`Map.id` identifies the logical map in one-map-react's registry. Host `id`, `nativeID`, and `testID` identify the receiving DOM or native view separately. A ready map has an attached lifetime, successful SDK/style load, completed initial camera setup, and positive native layout. Receiving-host layout alone does not establish SDK load. Failed loading keeps commands unavailable; retained references reject after detachment, including operations whose acknowledgements arrive from an older attachment.

Initial camera and selected constructor configuration are immutable snapshots. Changes to initial camera props leave the mounted camera unchanged. Changed constructor configuration rejects rather than silently rebuilding or ignoring the change. The selected [configuration contract](0004-map-constructor-configuration.md) and typed settings controllers distinguish initial values from mutable operations and their reset defaults. Initial style root metadata accepts acyclic plain `JSONValue`, including objects, arrays, null, strings, finite numbers and booleans. A usable initial style envelope does not complete separately assigned source, layer, style replacement, or controlled-camera operations.

The native lifecycle bridge resolves the receiving host and its selected SDK child on the UI thread. Mapbox Android uses public [`MapView.onSizeChanged`](https://github.com/mapbox/mapbox-maps-android/blob/v11.23.1/maps-sdk/src/main/java/com/mapbox/maps/MapView.kt#L196); MapLibre Android invokes the exact pinned protected [size hook](https://github.com/maplibre/maplibre-native/blob/android-v13.6.1/platform/android/MapLibreAndroid/src/main/java/org/maplibre/android/maps/MapView.java) reflectively. Mapbox iOS temporarily applies immediate [resizing animation](https://github.com/mapbox/mapbox-maps-ios/blob/v11.23.1/Sources/MapboxMaps/Foundation/MapView.swift#L625), while MapLibre iOS requests [`MLNMapView.layoutSubviews`](https://github.com/maplibre/maplibre-native/blob/ios-v6.31.0/platform/ios/src/MLNMapView.mm#L1236). These paths acknowledge actual SDK dispatch and reject unavailable layout. The [resize investigation](../../records/evidence/native-resize-investigation.json) records the source and published SDK inspection. Consumer-only viewport corruption and renderer readback establish resize behavior independently of changed bounds; those probes remain outside the common API and published package.

## Receiving-host scope

**Existing API:** React Native's root [`ViewProps`](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/Libraries/Components/View/ViewPropTypes.js#L565-L577) combines Android and iOS declarations. The selected native helper preserves that type boundary. Host callbacks keep receiving-view event payloads; normalized map events have their own common callbacks.

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`MapView` render](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx#L1238-L1282) separates the native map child and wrapper layout view. | [`Map` render](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/map/Map.tsx#L662-L694) forwards native props to its map child and owns a layout view. | [Mapbox](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/components/map.tsx) and [MapLibre](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/map.tsx) own browser containers. | **Implemented:** selected `createHostProps` provides typed attributes and callbacks. Both native adapters receive them on one-map-react's outer `View`; web receives them on its owned `div`. `children` and `style` stay owned by `Map`. |
| Shared [native platform groups](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/Libraries/Components/View/ViewPropTypes.js#L283-L448) retain Android or iOS effects. | The same inherited platform groups retain native host semantics. | [React HTML declarations](https://registry.npmjs.org/@types/react/-/react-19.3.0.tgz) and CSS properties retain browser semantics. | **Acceptance scope:** preserve selected typing and forwarding, including native OS-specific or browser vendor behavior. A forwarded property does not promise an equivalent effect on another host. |
| [`width`, `height`, `isReady` state](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx#L539-L558) describes wrapper layout. | [Outer layout](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/map/Map.tsx#L684-L694) has no equivalent public wrapper-state snapshot. | Container bounds and renderer load have separate meanings. | **Implemented:** selected RNMapbox `getMapLayout(mapRef)` returns copied `{ width, height, layoutReady }` before SDK readiness, preserving lifetime checks. Other adapters expose host layout through callbacks and common readiness. |

Both native adapters force `collapsable={false}` to retain the registry anchor required by the bridge. React Native [permits removal when true](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/Libraries/Components/View/ViewPropTypes.js#L454-L471); it does not require removal. [Fabric retention conditions](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/ReactCommon/react/renderer/components/view/ViewShadowNode.cpp#L44-L85) also depend on identifiers, events and drawing. Accepting `true` while retaining the required host is documented composition of an optimization hint. `collapsableChildren` remains forwarded independently. Final native fixtures include an empty-identity receiving host and public resize so retention does not depend on a default test identifier.

The [host property decision](0005-host-properties.md) defines reserved names, callback types and native consumer declaration checks. Its transparent selected-host contract preserves platform-native absence of effect. It does not promise Android drawables or iOS rasterization as portable map operations. Strict unsupported-feature handling still applies to unavailable promised map functionality. Coverage must state whether a result certifies declaration reachability, the forwarding mechanism, or a named native effect. Representative identity, attribute, event, style and layout observations verify the mechanism. They do not certify every CSS vendor effect, GPU optimization, screen-reader action, TV behavior, hardware focus, mouse or pen input.

Native host method types are also reachable through a callback's `event.currentTarget`. The [generated event union](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/Libraries/Types/CoreEventTypes.js) permits a numeric target or `HostInstance`; callers must narrow that value and capture the host during dispatch. Fabric [sets and then clears the callback target](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js#L730-L738). The captured receiving host inherits React Native methods with their feature-flag, platform and lifetime semantics. The pinned [Fabric public-instance factory](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactFabricPublicInstance.js#L37-L49) constructs `ReactNativeElement`; its [compatibility methods](https://github.com/facebook/react-native/blob/v0.87.1/packages/react-native/src/private/webapis/dom/nodes/ReactNativeElement.js#L150-L275) require the imperative-focus flag for non-text focus, may omit native measurement dispatch after detachment, and require a native element ancestor for `measureLayout`. A narrowed declaration example passes against the published declarations; this establishes usable typing without certifying individual method execution or exposing an SDK class through the common API.

The [generated host inventory](../../records/evidence/native-generated-host-inventory.json) supplies an exact field-name-to-OS map from pinned declarations and platform source. Android drawable, texture, focus and accessibility fields and iOS rasterization/accessibility fields retain their named functional applicability; opposite-OS typing remains reachable. `focusable` has an iOS Fabric setter only under `TARGET_OS_TV`, outside the smartphone targets. `onClick` appears independently in cross-platform pointer declarations, so Android grouping alone cannot narrow it. Other fields require their own source evidence. The ten separately exported Apple TV-only historical host IDs remain recorded with no six-target applicability; they are not SDK limitations.

RNMapbox's nullable layout flag becomes true on [any wrapper layout](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx#L1165-L1170), including zero size. Its `region` and `isUserInteraction` fields are cached [legacy event state](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx#L1046-L1066); default debounce and zero-debounce delivery have different state-write behavior. Those two responsibilities remain pending under S06a.legacy-event-delivery. Raw SDK handles cannot substitute for an owned typed snapshot.

## Observing layout and load

These four examples observe the same tile-free initial style inside a 320 by 240 host. The Observe button records receiving-host dimensions separately from SDK load. RNMapbox additionally exposes its cached wrapper layout flag; one-map-react preserves that flag through the selected `getMapLayout` extension. A host layout event alone establishes no SDK load. These examples include required imports and setup boundaries, are checked against the frozen declarations, and have no execution claim.

### RNMapbox

The application supplies a public token and calls `configureMaps(publicToken)` before mounting. The example reads the [public wrapper state](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx#L539-L558), then records the [SDK load callback](https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx#L376-L391) independently.

```tsx
import { MapView, setAccessToken } from "@rnmapbox/maps";
import { useRef, useState } from "react";
import { Button, Text, View } from "react-native";

export const configureMaps = (publicToken: string) =>
  setAccessToken(publicToken);
const style = { version: 8, sources: {}, layers: [] };

export function RNMapboxLayout() {
  const map = useRef<MapView>(null);
  const loaded = useRef(false);
  const [observation, setObservation] = useState("");
  const observe = () => {
    const state = map.current?.state;
    setObservation(JSON.stringify({
      width: state?.width,
      height: state?.height,
      layoutReady: state?.isReady,
      loaded: loaded.current,
    }));
  };
  return (
    <View>
      <MapView
        ref={map}
        style={{ width: 320, height: 240 }}
        styleJSON={JSON.stringify(style)}
        onDidFinishLoadingMap={() => { loaded.current = true; }}
      />
      <Button title="Observe" onPress={observe} />
      <Text>{observation}</Text>
    </View>
  );
}
```

### MapLibre React Native

This example observes its own receiving `View`, because the [wrapper's outer layout callback](https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/map/Map.tsx#L684-L694) initializes its native child and does not provide RNMapbox's public state snapshot. The forwarded SDK load callback records loading separately. The embedded style requires no external tile service.

```tsx
import { Map as NativeMap } from "@maplibre/maplibre-react-native";
import { useRef, useState } from "react";
import { Button, Text, View } from "react-native";

const style = { version: 8 as const, sources: {}, layers: [] };

export function MapLibreLayout() {
  const size = useRef({ width: 0, height: 0 });
  const loaded = useRef(false);
  const [observation, setObservation] = useState("");
  return (
    <View>
      <View
        style={{ width: 320, height: 240 }}
        onLayout={({ nativeEvent }) => {
          const { width, height } = nativeEvent.layout;
          size.current = { width, height };
        }}
      >
        <NativeMap
          style={{ flex: 1 }}
          mapStyle={style}
          onDidFinishLoadingMap={() => { loaded.current = true; }}
        />
      </View>
      <Button
        title="Observe"
        onPress={() => setObservation(JSON.stringify({
          ...size.current, loaded: loaded.current,
        }))}
      />
      <Text>{observation}</Text>
    </View>
  );
}
```

### react-map-gl

This web example uses the Mapbox entry and an application-supplied public token. The Vite setup supplies CSS import declarations; import the Mapbox GL JS stylesheet at application setup. A receiving DOM element supplies layout bounds; the wrapper's [public ref](https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/mapbox/create-ref.ts) supplies the SDK `loaded()` readback. MapLibre uses its explicit entry and stylesheet and requires no Mapbox token for the embedded style.

```tsx
/// <reference types="vite/client" />
import { useRef, useState } from "react";
import Map, { type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const style = { version: 8 as const, sources: {}, layers: [] };

export function WebLayout({ publicToken }: { publicToken: string }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapRef>(null);
  const [observation, setObservation] = useState("");
  const observe = () => {
    const bounds = host.current?.getBoundingClientRect();
    setObservation(JSON.stringify({
      width: bounds?.width,
      height: bounds?.height,
      loaded: map.current?.loaded(),
    }));
  };
  return (
    <>
      <div ref={host} style={{ width: 320, height: 240 }}>
        <Map ref={map} mapboxAccessToken={publicToken} mapStyle={style} />
      </div>
      <button type="button" onClick={observe}>Observe</button>
      <output>{observation}</output>
    </>
  );
}
```

### one-map-react

**Implemented path, runtime acceptance pending:** this native Mapbox example creates a stable selected adapter during application setup. `getMapLayout` reads the wrapper's measured dimensions and nullable layout flag. `MapRef.ready` describes the common loaded, initialized, positive-layout command gate. The layout extension is specific to the RNMapbox wrapper; other selected backends observe host layout through typed `createHostProps` and common readiness rather than claiming the same wrapper state.

```tsx
import { useRef, useState } from "react";
import { Button, Text, View } from "react-native";
import { Map, OneMapProvider, type MapRef } from "one-map-react";
import {
  createMapboxNativeAdapter,
  getMapLayout,
} from "one-map-react/mapbox-native";

const style = { version: 8 as const, sources: {}, layers: [] };
export const configureMaps = (publicToken: string) =>
  createMapboxNativeAdapter({ accessToken: publicToken });

type Adapter = ReturnType<typeof configureMaps>;
export function OneMapLayout({ adapter }: { adapter: Adapter }) {
  const map = useRef<MapRef>(null);
  const [observation, setObservation] = useState("");
  const observe = async () => {
    if (!map.current) return;
    try {
      const layout = await getMapLayout(map.current);
      setObservation(JSON.stringify({ ...layout, ready: map.current.ready }));
    } catch (error) {
      setObservation(error instanceof Error ? error.name : "Observation failed");
    }
  };
  return (
    <OneMapProvider adapter={adapter}>
      <View>
        <Map
          id="layout-map"
          ref={map}
          style={{ width: 320, height: 240 }}
          mapStyle={style}
        />
        <Button title="Observe" onPress={observe} />
        <Text>{observation}</Text>
      </View>
    </OneMapProvider>
  );
}
```

Each native example observes logical layout units; the browser records CSS pixels. RNMapbox's `layoutReady` can remain true at zero size, while common readiness requires a positive-sized host and successful initialization. The embedded empty style isolates lifecycle observation; these examples do not verify cross-backend feature rendering or style translation.

## Web ownership and settings

one-map-react disables the upstream global reuse pool and owns mounted wrapper subtrees in `OneMapProvider`, with at most one dormant renderer in addition to active maps. Logical unmount detaches the session, callbacks and children immediately. Compatible configuration, style, camera and external-context fingerprints permit adoption; otherwise a new renderer is created. Adoption resets the initial camera and mutable defaults. Unfinished loading entries are destroyed. Eviction and provider teardown unmount wrappers through their SDK removal path.

An external WebGL2 context transfers to one map lifetime or a compatible provider-owned reuse entry. The constructor transports it only to the selected SDK canvas and restores the caller's canvas method in `finally`, including construction failure. Unconsumed reservations release during pre-construction cleanup; consumed contexts stay reserved while retiring and are disposed by SDK removal. A stale constructor cannot consume or dispose a newer reservation. The browser lifecycle run verifies actual context identity, route pixels, sizing, isolation, retirement, constructor failure, teardown and development Strict Mode replay. An earlier replay failure was corrected in the owned renderer pool.

Selected `getMapSettings(mapRef)` controllers preserve backend and lifetime checks. Web readiness/style checks guard mutation, reset spellings follow the selected SDK, and language arrays are copied. The Mapbox native initializer observes the selected initial style before dispatch, isolates watch IDs and lifetime/style completion, and disposes SDK subscriptions. Its iOS load gate requires the successful request and unchanged current style fingerprint, then either a current-request map-loaded event or a fully rendered frame begun after that completion. The pinned SDK [render-frame contract](https://github.com/mapbox/mapbox-maps-ios/blob/v11.23.1/Sources/MapboxMaps/Foundation/MapboxMap.swift#L1500-L1511) distinguishes all-required-data frames from partial rendering. A post-completion repaint requests fresh evidence; cached placeholder frames cannot establish readiness. MapLibre iOS waits for its pitched initial camera acknowledgement with generation/ref checks; only the SDK acknowledgement is caught, so application callback exceptions retain their delivery semantics.

## Acceptance

`bun run pack` produces the package under test. The archived implementation-status document lists the six runtime cells and the hash each one last passed. A cell whose hash is not the current file is unverified. The install check compares the unpacked files with the tarball just installed. That comparison stays in the run report.

Current inventory ownership is 2215 S04 rows plus 294 S04.generated-host rows. All IDs remain recorded. Seven responsibilities align with existing owners: two cached legacy-state fields under S06a.legacy-event-delivery, three localization shapes under S48d.label-localization, layer `appearance.name` under S08, and configuration `option.metadata` under S45. These moves do not accept their feature work. Seventeen initial-root style envelope records stay in S04; aggregate records retain the pending responsibilities of their separately assigned children. The census measures assignments and cannot establish runtime compatibility.

**Historical acceptance:** each native report for `f61cdf66806c435653dd56939adf8b389a9f5b892e3d30226d8e3e802f9a1ba8` verified the packed file, installed executable and bundle identity, selected SDK isolation, receiving-host updates and removal, positive and zero layout, initial camera, public resize, loading failure and recovery, retained-reference rejection, and teardown. Host forwarding and declaration reachability do not become individual vendor or hardware effect guarantees. Completing this stage does not accept later feature stages or the full S50/S51 conformance and publication work. The Mapbox iOS initializer uses the supported `.always` reload policy for JSON and URI and accepts a fully rendered frame begun after successful requested-style completion. Native declaration checks use the official React Native TypeScript configuration and audit one-map-react's published declaration bodies. MapLibre's navigation field is controlled, and its Maestro helper erases the field before typing, because Android input appends to text that an imperative clear has not yet replaced.

**Historical style cleanup acceptance:** public documentation is retained in generated declarations; named backend state contracts and focused lifecycle/settings helpers preserve the existing transitions and SDK call ordering. Full validation passed 133 tests plus package and adapter-selection checks. Both browser lifecycle suites, both mixed Metro transports, and fresh Release builds and canonical native S04 flows passed for the final artifact above. Native evidence covers the iOS simulator and Android emulator. The cleanup ledger retains intermediate runs and failures, verifies installed publication and binary identities, and records restoration of the temporary Android input settings. Later feature stages remain planned.

**Historical main-first ordering acceptance:** entry points precede helpers across package code, handwritten native bridges and first-party examples. The [ordering evidence](../../records/evidence/main-first-ordering.json) records the baseline comparison and initialization exceptions. Full validation passed 136 tests, both browser lifecycle suites and both mixed Metro transports passed, and all four fresh Release native builds and full canonical flows passed for `9ac0cd2754d3f9a17f52105ee72e48bb9d101f7f257e1752f2e70408648d785c`. That artifact renewed S04 acceptance for the prior coding-style audit fixes and the declaration reordering. Public APIs, function bodies, initialization and subscription order remain unchanged. Historical acceptance above remains recorded; later stages remain planned.
