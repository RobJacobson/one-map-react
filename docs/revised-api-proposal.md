# Revised shared API and migration proposal

**Agreed design for the next incompatible release; migration in progress.** Keep rendering, camera commands, feature queries, cluster queries, and explicit feature-state operations shared. Applications own location acquisition, offline storage, snapshots, and screen controls. Native movement and feature-state retention follow the selected renderer. This proposal deliberately narrows compatibility; it does not claim full react-map-gl or native-wrapper parity.

This document owns the agreed destination and exact migration examples. The [requirements](requirements.md) define the next-release scope and retained ownership rules; the [coverage checklist](api-coverage.md) separates current implementation evidence from pending migration work. The current package retains its existing broader API; [the package manifest](../packages/one-map-react/package.json) owns its version. All four selected wrapper getters are implemented on the development branch. The working selected refs retain common operations and getWrapperMap; U06 removes their advanced method mirrors. U06 is merged as PR25 and U07 as PR26. U08 native camera target migration is merged as PR27. U09 feature-state lifetime migration is merged as PR28. U10 current-map capture migration is implemented and audited; applicable routine verification is recorded, and the PR is authorized under the unit workflow. Other migration changes remain pending. The [unit plan](revised-api-implementation-plan.md#work-order) owns review and authorization status. The earlier contract review at docs/contract-review.md in the [U01 captured working basis](../records/evidence/revised-api-u01-baseline.md) explains the mechanisms; its recommendation to retain all controls and native dragging belongs to the broader alternative. That research document is not part of this publication. This proposal does not claim renderer acceptance, a package version change, or a current release-gate change.

## Research basis and limits

The source review on 2026-10-21 used the working implementation captured by [U01](../records/evidence/revised-api-u01-baseline.md), react-map-gl 8.1.3, RNMapbox 10.3.8, and MapLibre React Native 11.5.0. That captured working basis used package 0.1.0-rc.11; it is distinct from this PR's main-branch publication base. Source observations and Before examples in this document refer to that basis; linked source files in this checkout may precede it. The captured exports were defined by the [root entry](../packages/one-map-react/src/index.ts), [Mapbox native entry](../packages/one-map-react/src/mapbox-native.tsx), [MapLibre native entry](../packages/one-map-react/src/maplibre-native.tsx), and selected web entries. Installed declarations and source own the version-specific call shapes below. Current online MapLibre documentation calls the independent image manager StaticMapManager; the inspected package exports StaticMapImageManager, which one-map-react currently aliases as WrapperStaticMapImageManager.

All examples marked **After** target the proposal and cannot be treated as runnable against the current release. Existing SDK operations remain subject to their installed version, native configuration, permissions, errors, and documented limitations. Setup omitted from an excerpt is identified before that excerpt. The original proposal review covered formatting/lint, local links, TypeScript/TSX syntax, installed SDK call signatures, selected options, and click-handler narrowing against its working basis. Fresh publication checks are recorded separately in the [U02 checkpoint](../records/evidence/revised-api-u02-contract.json). Selected web getWrapperMap has development-branch implementation and declaration checks in the [U03 evidence](../records/evidence/revised-api-u03-web-wrapper.json); RNMapbox access has [U04 routine evidence](../records/evidence/revised-api-u04-mapbox-wrapper.json); MapLibre native access has [U05 routine evidence](../records/evidence/revised-api-u05-maplibre-wrapper.json); other proposed surface changes require later checks. This review establishes the proposed interface and caller edits; implementation savings and renderer behavior require later verification.

## Agreed next-release public surface

Keep the common entry, four selected adapter entries, and the mapbox/maplibre platform aliases. Mixed web/native engine choices remain supported. Keep MapSetup selection and named-map access; do not introduce another provider or service abstraction.

The next-release common runtime exports will be exactly `MapSetup`, `Map`, `Source`, `Layer`, `Images`, `Marker`, `UserLocation`, and `useMap`. Retain their rendering, geometry, camera, feature-query, cluster-query, feature-state, image, marker, display-location, adapter, and setup types. UserLocation remains a display of supplied coordinates and starts no acquisition.

Remove common runtime exports `useMapServices`, `Popup`, `Control`, `NavigationControl`, `AttributionControl`, `ScaleControl`, `GeolocateControl`, and `FullscreenControl`. Remove their common control/popup types, all capture/offline/service types, LocationPermission, LocationOptions, LocationAbortSignal, LocationService, and SourceClickEvent. Keep GeolocationPosition and UserLocationProps because they describe display inputs. Keep MarkerRef.refresh for annotation snapshots.

The exact contract edits are:

- MapSetupProps contains only adapter and children. Remove locationProvider. Adapter contains backend, Map, Source, Layer, Images, and Marker; remove services and all popup/control fields. UserLocation continues composing Source and Layer without an adapter slot.
- MapProps retains current fields except captureEnabled. MapRef retains the current camera/projection/elevation, feature-query, cluster-query, and feature-state methods except capture. Existing backend restrictions remain explicit, including native stop, unavailable getters, custom easing, and fitBounds.maxZoom; this proposal does not implement those gaps.
- GeoJSON/vector Source props lose onClick, and selected Source aliases lose the associated hitbox additions. Feature clicks use Map.onClick and interactiveLayerIds. UserLocationProps loses onPress because display-only UserLocation currently forwards it through Source.onClick. Applications requiring location activation can render known source/layer IDs and use map clicks. Raw wrapper sources retain their own onPress/hitbox facilities.
- Marker retains coordinates, children, default pin, anchor, offset, renderMode, activation, refresh, and error handling. Common draggable/onDragStart/onDrag/onDragEnd remain web-only requests. Native selected Marker types permit draggable=false and exclude drag callbacks; common-entry requests for native dragging fail clearly rather than being ignored.
- Images retains URL/SDF entries and updates/removals within its mounted style. Automatic restoration or retry into a replacement style is excluded. The application remounts Images after the replacement style loads. Resource cleanup, errors, and suppression of obsolete loads remain required.
- Each selected Map ref adds one asynchronous getWrapperMap() operation. It returns the currently attached wrapper handle, or rejects when detached. Keep the existing WebMapRef and NativeAdvancedMapRef type names, but replace their hand-mirrored advanced methods with this operation. The common MapRef does not expose it.

The agreed selected getWrapperMap result types are react-map-gl MapRef on web, ComponentRef of RNMapbox MapView on Mapbox native, and ComponentRef of MapLibre Map on MapLibre native. Call the getter for each operation; returned handles are borrowed and retain upstream lifetime and timing. It does not wait for load, grant renderer ownership, or expose an independent Camera. Keep common camera commands and selected locationOptions for the existing map-owned camera.

Selected entries retain inexpensive explicit wrapper/component/type exports, including WrapperPopup and Wrapper controls on web, native annotation components, and native Wrapper managers. Remove selected aliases that currently wrap the deleted common Popup/Control implementations. Consumers use the existing Wrapper-prefixed web controls; there is no second facade control implementation. Keep typed selected Map options, hostProps, style inputs, and applicable advanced components.

## Rendering and queries stay shared

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| Separate source and layer components; camera/map/source refs supply queries. | Separate source and layer components; some queries use source refs. | Source and Layer plus map/source methods. | Keep shared Source, Layer, all currently implemented source/layer families, camera commands, rendered/source/cluster queries, and state operations. Convert names and result shapes. |
| Map/source presses have native semantics. | Source presses can bubble to Map with stopPropagation. | Map events can include features filtered by interactiveLayerIds. | Use one shared map feature-click path. Drop the extra Source.onClick propagation interface. |

Source data, paint, layout, filters, style inputs, and applicable advanced rendering retain their current update routes and explicit restrictions. Native wrapper ref registries remain where queries and cluster methods need them. Keep validation, SDK errors, argument capture, owned listener disposal, and attachment checks. Query failures remain failures; they do not become empty successful results. Results and timing follow the actual renderer, including loaded-tile source queries and dispatch acknowledgement versus rendered visibility.

**Unchanged shared scene.** This is used inside the same Map on all four adapters; the enclosing MapSetup selects the backend. The feature data and style URL are application assets passed by the caller.

```tsx
import { Layer, Map as OneMap, Source } from "one-map-react";
import type { GeoJsonFeatureCollection } from "one-map-react";

interface RouteMapProps {
  readonly data: GeoJsonFeatureCollection;
  readonly mapStyle: string;
}

const RouteMap = ({ data, mapStyle }: RouteMapProps) => (
  <OneMap
    id="main"
    mapStyle={mapStyle}
    initialViewState={{
      longitude: -122.4,
      latitude: 37.8,
      zoom: 12,
      bearing: 0,
      pitch: 0,
    }}
  >
    <Source id="routes" type="geojson" data={data}>
      <Layer
        id="routes-line"
        type="line"
        paint={{ "line-color": "#2679e8", "line-width": 4 }}
      />
    </Source>
  </OneMap>
);
```

**Before: source callback.** Imports, data, and selectRoute come from the enclosing screen.

```tsx
<Source id="routes" type="geojson" data={data} onClick={selectRoute}>
  <Layer id="routes-line" type="line" />
</Source>
```

**After: map callback.** The same screen imports ClickEvent from one-map-react and supplies data, mapStyle, and selectRouteId. The handler chooses a feature from the routes source; it does not assume every returned feature is a route.

```tsx
const handleMapClick = (event: ClickEvent): void => {
  const feature = event.features?.find(
    (candidate) => "source" in candidate && candidate.source === "routes"
  );

  if (!feature || !("id" in feature)) return;
  if (typeof feature.id === "string" || typeof feature.id === "number") {
    selectRouteId(feature.id);
  }
};

<OneMap
  mapStyle={mapStyle}
  initialViewState={initialCamera}
  interactiveLayerIds={["routes-line"]}
  onClick={handleMapClick}
>
  <Source id="routes" type="geojson" data={data}>
    <Layer id="routes-line" type="line" />
  </Source>
</OneMap>;
```

This removes source-level stopPropagation and custom native source hit regions from the shared interface. Applications needing them use raw wrapper sources with their actual SDK composition. A raw source is not automatically registered with the common native source registry; its source/cluster/state operations use its wrapper ref unless an explicit registration route exists. Retain feature ordering from the renderer and avoid implementing a new event propagation system in application examples.

## Camera and feature-state guarantees

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| Native camera props and imperative stops. | Native camera props and imperative commands. | Controlled viewState can reject movement proposals. | Keep viewState syntax; native values are targets applied when changed. No automatic rollback for an unchanged target. Web delegates controlled behavior. |
| State is held by the renderer and addressed through MapView. | State is held by source refs; removals can become visible on later frames. | State is held by the renderer. | Keep setFeatureState/getFeatureState/removeFeatureState; source and style replacement follow renderer retention. No automatic clearing, replay, or transaction promise. |

**Before and after syntax.** Existing code can retain this form, with initialCamera and onMove supplied by the screen:

```tsx
<OneMap
  mapStyle={mapStyle}
  initialViewState={initialCamera}
  viewState={cameraTarget}
  onMove={handleMove}
/>
```

The native behavioral change is explicit: target A followed by a user drag to B stays at B if handleMove leaves cameraTarget unchanged. A fresh cameraTarget object with the same values does not request a rollback; a changed target C requests a move to C. Explicit jumpTo can reapply A. Web can continue rejecting B. Reading scale/compass state must use observed native movement, not the old application target. Native locationOptions follow and an explicit viewState remain mutually exclusive owners.

**After, preferred portable navigation.** Use initialViewState for the opening camera and common commands for explicit navigation. Code inside a Map can obtain map from useMap; the following is an event-handler excerpt, with a target supplied by the application.

```ts
const goToTarget = async (): Promise<void> => {
  await map.flyTo({
    center: [target.longitude, target.latitude],
    zoom: target.zoom,
    bearing: target.bearing,
    pitch: target.pitch,
  });
};
```

An application that needs an explicit correction to the same native target can issue jumpTo with those fields. SDK bounds remain the first choice for supported geographic constraints. Arbitrary gesture vetoes and synchronization algorithms become application behavior. Removing viewState to release control remains supported; no compatibility mode or new camera controller is proposed.

**Before: implicit state reset.** The archived rc.11 contract promised that changing a Source key while retaining id=routes clears facade-written state.

```ts
await map.setFeatureState({ source: "routes", id: 7 }, { selected: true });
setSourceRevision((revision) => revision + 1);
```

**After: explicit state ownership.** To deselect within the same source, remove the state explicitly. Resolution acknowledges SDK dispatch; an immediate getFeatureState need not observe the rendered removal.

```ts
await map.removeFeatureState({ source: "routes", id: 7 }, "selected");
```

When replacing an entire dataset that needs a fresh identity, change the actual source/layer IDs as well as React keys. Query calls and interactiveLayerIds must use those new IDs. This avoids reusing the prior renderer state namespace, rather than depending on a React remount to clear it.

```tsx
const sourceId = `routes-${datasetRevision}`;
const layerId = `routes-line-${datasetRevision}`;

<Source key={sourceId} id={sourceId} type="geojson" data={data}>
  <Layer id={layerId} type="line" />
</Source>;
```

Applications preserving selection across style changes retain selected IDs in application state and reapply them when the relevant source is available. Map/style load is not a promise that every source tile or feature is ready. The library adds no replay queue, renderer-completion polling, or cancellation of calls already dispatched to the SDK. Keep source attachment and teardown guards for adapter-owned work.

## Markers, images, popups, and controls

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| MarkerView hosts live children; PointAnnotation has annotation dragging. | Marker hosts live children; ViewAnnotation has dragging and Android bitmap children. | Marker hosts DOM children and dragging. | Keep live shared markers and explicit annotation mode. Native shared markers cannot drag in either mode. Selected raw annotations retain SDK dragging. |
| Native image component supplies style images. | Native Images supplies style images. | Programmatic images use SDK registration. | Keep shared Images within one style lifetime, including updates/removals. App remounts after style replacement; automatic replay/retry is excluded. |
| Native ornaments and callouts use native presentation. | Native ornaments and callouts use native presentation. | Popup and controls have upstream React components. | Remove common Popup and control compositions. Keep web Wrapper components and native SDK ornaments/callouts. App screen layout owns native buttons and bubbles. |

**Before: draggable marker.** The screen supplies coordinate and handleDrag.

```tsx
<Marker
  longitude={coordinate[0]}
  latitude={coordinate[1]}
  draggable
  onDragEnd={handleDrag}
/>
```

**After on native.** Remove draggable and every drag callback. The screen updates coordinate from its chosen input, such as a map press, search result, or form. Programmatic coordinate updates remain shared.

```tsx
<Marker longitude={coordinate[0]} latitude={coordinate[1]} />
```

Web consumers can retain the original drag props. Put web-specific drag interaction in a web screen/module; do not pass those requests through shared native code. Existing PointAnnotation/ViewAnnotation exports remain available for native annotation dragging, with SDK coordinate ownership and callback behavior. This avoids retaining a shared native drag implementation under another option.

**After for images.** A screen with style switching records an application epoch when onStyleLoad fires and keys Images by that epoch. The surrounding screen imports useState from React and Images/Map from one-map-react. Other map children are omitted.

```tsx
const [styleEpoch, setStyleEpoch] = useState(0);

<OneMap
  mapStyle={mapStyle}
  initialViewState={initialCamera}
  onStyleLoad={() => setStyleEpoch((epoch) => epoch + 1)}
>
  <Images key={styleEpoch} images={icons} />
</OneMap>;
```

Images can await its initial usable style. A later style replacement invalidates outstanding image loads and ends that mounted instance's registration session; it cannot install an old result into the replacement style. The new keyed instance loads the requested entries again. Cleanup must not remove a replacement style's images. Updates and removals during a single session remain supported, so ordinary icon changes need no extra key. Application IDs should avoid sprite-name conflicts; collisions retain the wrapper's behavior. Renderer integration must verify initial load, update, replacement, failure, and unmount ordering before this narrower contract is shipped. Style sprites remain an alternative requiring no Images component.

**Before: common browser controls and popup.** These imports would no longer exist at the root.

```tsx
import { NavigationControl, Popup, ScaleControl } from "one-map-react";
```

**After on Mapbox web.** These exports already exist. MapLibre web uses the same Wrapper names from one-map-react/maplibre-web. Render them inside the selected web Map so the upstream React context exists. Follow the wrapper's own props, refs, callbacks, and creation/update rules; the old common Popup dismissal/refresh contracts do not apply.

```tsx
import {
  WrapperNavigationControl as NavigationControl,
  WrapperPopup as Popup,
  WrapperScaleControl as ScaleControl,
} from "one-map-react/mapbox-web";
```

**After on native: screen layout.** Controls become ordinary screen children beside the map. The enclosing MapSetup remains outside this excerpt. HomeButton is defined below and uses named map access; it retains the screen's original providers because application code places it there.

```tsx
import { Pressable, Text, View } from "react-native";
import { Map as OneMap, useMap } from "one-map-react";

interface HomeButtonProps {
  readonly onError: (error: unknown) => void;
}

const HomeButton = ({ onError }: HomeButtonProps) => {
  const map = useMap("main");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Return to harbor"
      disabled={!map}
      onPress={() => {
        void map?.flyTo({ center: [-122.4, 37.8], zoom: 12 }).catch(onError);
      }}
    >
      <Text>Harbor</Text>
    </Pressable>
  );
};

// Inside the application's native screen; data layers are omitted.
<View style={{ flex: 1 }}>
  <OneMap
    id="main"
    mapStyle={mapStyle}
    initialViewState={initialCamera}
    style={{ flex: 1 }}
  />
  <View style={{ position: "absolute", top: 12, right: 12 }}>
    <HomeButton onError={reportError} />
  </View>
</View>;
```

The application owns safe areas, stacking, overlap, pending UI, command ordering, and any inset needed to keep attribution visible. Enable native scale/compass/attribution using selected Map.options. RNMapbox uses scaleBarEnabled; MapLibre uses scaleBar. Their supported placement, units, and appearance remain native. Keep legal attribution and logo requirements; removing common AttributionControl does not authorize hiding them.

For a native popup, render an application-owned bubble as a Marker child, or use a selected SDK annotation plus Callout. Conditional rendering owns dismissal. The application implements close buttons, movement/click dismissal, width, accessibility, and focus behavior it needs. Native interactive marker children remain supported, so the existing live overlay and portal may remain. This proposal does not promise removal of react-native-teleport; SDK live-host replacement is a separate proof-gated optimization.

## App services leave MapSetup

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| WrapperLocationManager plus application permission integration. | WrapperLocationManager and its permission facilities. | Browser geolocation and upstream GeolocateControl. | Remove common acquisition, permission, freshness, foreground resume, provider scoping, and tracking APIs. App owns acquisition; UserLocation displays supplied data. |
| WrapperOfflineManager identifies packs by native name. | WrapperOfflineManager identifies packs by generated ID. | No equivalent common pack manager. | Use selected managers directly. Remove normalized identity, shared observers/status, and automatic observer recovery. |
| WrapperSnapshotManager and MapView.takeSnap. | WrapperStaticMapImageManager and Map.createStaticMapImage. | SDK canvas/wrapper facilities. | Remove common capture/staticMapImage. App owns output, scope, deadlines, files, and renderer readiness. |

These native Wrapper aliases already exist; applications can start migrating services while using the current library. Direct upstream package imports are also valid. Reading a shared MapSetup must no longer create service views or control location lifetime. An application may reuse its existing locationProvider implementation as an ordinary application service without introducing a replacement one-map-react provider.

### Setup and location

**Before.** The screen imports MapSetup and useMapServices from one-map-react.

```tsx
<MapSetup adapter={adapter} locationProvider={appLocationProvider}>
  <RouteMap data={data} mapStyle={mapStyle} />
</MapSetup>;

const { location } = useMapServices();
const position = await location.getCurrentPosition();
```

**After.** Keep appLocationProvider in an application module, acquire from it directly, and pass positions into rendering. These excerpts show the call-site change; their enclosing screen owns errors, permissions, acquisition cancellation, and subscription disposal.

```tsx
<MapSetup adapter={adapter}>
  <RouteMap data={data} mapStyle={mapStyle} />
</MapSetup>;

const position = await appLocationProvider.getCurrentPosition();

// Inside an attached Map; UserLocation is imported from one-map-react.
<UserLocation position={position} showAccuracyCircle />;
```

The old service types become application-owned types. Keep the supported GeolocationPosition shape at the rendering boundary; map supplied longitude/latitude to lngLat and normalize any optional measurements the application supplies. The inspected [location conversion](../packages/one-map-react/src/adapters/shared/location-values.ts) records native unit differences, including MapLibre iOS timestamps in seconds. Keeping timestamps in milliseconds and course distinct from compass heading is still necessary when the application supplies those fields.

For applications currently relying on default acquisition, the concrete native entry points are:

```ts
// Mapbox native application module.
import { WrapperLocationManager } from "one-map-react/mapbox-native";

// Attach only after the application's permission flow.
WrapperLocationManager.addListener(handleNativePosition);
// At the application's subscription cleanup boundary:
WrapperLocationManager.removeListener(handleNativePosition);
```

```ts
// MapLibre native application module.
import { WrapperLocationManager } from "one-map-react/maplibre-native";

WrapperLocationManager.addListener(handleNativePosition);
WrapperLocationManager.removeListener(handleNativePosition);
```

handleNativePosition is the application's callback with the selected SDK's actual payload. The two lines show attachment and its matching cleanup, not immediate sequential execution. Do not call removeAllListeners or globally stop a singleton to dispose one screen. RNMapbox iOS permission remains application-integrated; MapLibre has requestPermissions. A cached getCurrentPosition/getLastKnownLocation is not a replacement for the deleted freshness/deadline guarantee. On web, retain the upstream WrapperGeolocateControl or use navigator.geolocation; clear the application's watch on cleanup. Applications needing permission state, foreground-only updates, cancellation, deadlines, or continuous follow must own those policies or choose a location library that supplies them.

### Offline creation and existing packs

**Before.** offline comes from useMapServices().offline, and onProgress/onError belong to the application.

```ts
const pack = await offline.createPack({
  id: "harbor",
  mapStyle: styleUrl,
  bounds: [[-122.5, 37.7], [-122.3, 37.9]],
  minZoom: 10,
  maxZoom: 14,
});
const dispose = offline.subscribe("harbor", onProgress, onError);
```

**After on RNMapbox.** Callback parameters are the SDK's pack and status/error, rather than the old normalized status. createPack resolves without a pack; look it up by name.

```ts
import { WrapperOfflineManager } from "one-map-react/mapbox-native";

await WrapperOfflineManager.createPack(
  {
    name: "harbor",
    styleURL: styleUrl,
    bounds: [[-122.3, 37.9], [-122.5, 37.7]],
    minZoom: 10,
    maxZoom: 14,
    metadata: { regionId: "harbor" },
  },
  onNativeProgress,
  onNativeError
);
const pack = await WrapperOfflineManager.getPack("harbor");

// At the application observer's cleanup boundary:
WrapperOfflineManager.unsubscribe("harbor");
```

**After on MapLibre.** Store the generated pack.id in the application's index. The flat bounds are west/south/east/north.

```ts
import { WrapperOfflineManager } from "one-map-react/maplibre-native";

const pack = await WrapperOfflineManager.createPack(
  {
    mapStyle: styleUrl,
    bounds: [-122.5, 37.7, -122.3, 37.9],
    minZoom: 10,
    maxZoom: 14,
    metadata: { regionId: "harbor" },
  },
  onNativeProgress,
  onNativeError
);

// At the application observer's cleanup boundary:
WrapperOfflineManager.removeListener(pack.id);
```

Creation starts or dispatches downloads under the SDK contract; it does not mean all resources are available offline. The application owns the observer during asynchronous setup, errors, duplicate creation, refresh after resume/invalidation, and recovery of an already-persisted pack after failure. The existing [offline service](../packages/one-map-react/src/adapters/shared/offline-service.ts) and [regressions](../packages/one-map-react/test/tf08-offline.test.ts) identify those cases. Copy only policies the application needs; do not recreate the entire common manager as a mandatory migration shim.

Preserve existing databases and packs. Enumerate with the selected manager and build an application index from the old metadata envelope: `oneMapReactOffline.version === 1` identifies a facade-created pack, `oneMapReactOffline.id` is the previous application ID, and `user` contains application metadata. Keep the native RNMapbox name or MapLibre ID as the operation key. Existing imported packs used `backend:<native-id>` in the common API; retain an alias if the application stored that value. New packs may use application metadata such as regionId. Do not rename, delete, redownload, or migrate a database merely to change this JavaScript interface. Preserve the old metadata reader until those packs are deliberately retired.

### Capture and advanced ref access

**Before.** map is a common MapRef, created from a capture-enabled Map.

```ts
const image = await map.capture({ output: "file", scope: "backend" });
```

**After, working selected refs.** Import Map and NativeAdvancedMapRef from the selected native entry and hold its ref at the screen that owns capture. Shared Source/Layer children can remain unchanged. getWrapperMap is the only new access method; all four selected getters exist in the development-branch implementation. For example, the MapLibre screen uses these imports and ref inside its existing component:

```tsx
import { useRef } from "react";
import {
  Map as OneMap,
  type NativeAdvancedMapRef,
} from "one-map-react/maplibre-native";

const mapRef = useRef<NativeAdvancedMapRef>(null);

<OneMap
  ref={mapRef}
  mapStyle={mapStyle}
  initialViewState={initialCamera}
>
  {sharedLayers}
</OneMap>;
```

The application's capture handler checks mapRef.current before the following operation. RNMapbox uses the corresponding imports from one-map-react/mapbox-native.

```ts
// RNMapbox selected Map ref, after attachment and application readiness checks.
const wrapper = await mapRef.current.getWrapperMap();
const nativeOutput = await wrapper.takeSnap(true);
```

```ts
// MapLibre selected Map ref, after attachment and application readiness checks.
const wrapper = await mapRef.current.getWrapperMap();
const nativeOutput = await wrapper.createStaticMapImage({ output: "file" });
```

nativeOutput retains the installed SDK's string/path/URI contract; it is not a validated common MapImage. The application must check its ref, renderer readiness, output, and intended content inclusion and manage its own bounded wait or cancellation behavior. A timeout may stop waiting without cancelling native rendering. Add a screen-level error path and share/export handling appropriate to that output. Remove captureEnabled; do not infer that every native screenshot includes React overlays or that a returned file will persist indefinitely.

On web, a selected Mapbox Map can request `options={{ preserveDrawingBuffer: true }}`; MapLibre web uses `options={{ canvasContextAttributes: { preserveDrawingBuffer: true } }}`. After application readiness checks, obtain the wrapper with getWrapperMap, then call `wrapper.getMap().getCanvas().toDataURL("image/png")`. The application owns the buffer's performance cost, context compatibility, canvas errors, image validation, and screenshot scope. Browser DOM controls and popup children are separate from the renderer canvas. These examples establish an access route, not a successful capture under every context configuration.

**Independent images use existing managers.** These operation excerpts run in application service modules with errors handled by the caller. Browser equivalents require an application-selected service or a mounted map; the library supplies no independent browser snapshot service.

```ts
import { WrapperSnapshotManager } from "one-map-react/mapbox-native";

const nativeOutput = await WrapperSnapshotManager.takeSnap({
  styleURL: styleUrl,
  centerCoordinate: [-122.4, 37.8],
  zoomLevel: 12,
  width: 320,
  height: 180,
  writeToDisk: true,
});
```

```ts
import {
  WrapperStaticMapImageManager,
} from "one-map-react/maplibre-native";

const nativeOutput = await WrapperStaticMapImageManager.createImage({
  mapStyle: styleUrl,
  center: [-122.4, 37.8],
  zoom: 12,
  width: 320,
  height: 180,
  output: "file",
});
```

The application verifies physical output dimensions, density behavior, and native failure handling against its installed SDK. Keep current patches during the initial migration; delegation alone does not correct upstream bugs or establish that a patch can be removed.

Advanced selected ref calls change through the same access method. For example, a selected web ref's `map.getVersion()` becomes `(await map.getWrapperMap()).getMap().version`. A selected native ref's setSourceVisibility moves to `(await map.getWrapperMap()).setSourceVisibility(...)` with the original wrapper arguments. Existing web useWrapperMap also remains available inside the upstream map context. Stop duplicating individual debug, gesture, weather, media, plugin, and SDK property APIs on facade refs. Direct SDK access must respect resources owned by React props; do not mutate style/source/layer ownership behind their components.

## Migration and implementation sequence

The [detailed implementation plan](revised-api-implementation-plan.md) breaks this sequence into subagent-sized units, including the agreed UserLocation.onPress exclusion, and requires coordinator review and owner sign-off before each successor unit. U01 supplied the [frozen baseline and caller inventory](../records/evidence/revised-api-u01-baseline.md). U06 is merged as PR25 and U07 as PR26. U08 native camera target migration is merged as PR27. U09 feature-state lifetime migration is merged as PR28. U10 current-map capture migration is implemented and audited; applicable routine verification is recorded, and the PR is authorized under the unit workflow. U11 and later units remain undispatched. The plan itself authorizes no successor implementation or acceptance run.

1. **Freeze the contract change separately from the current candidate.** Reconcile requirements and the existing coverage checklist to distinguish the retained shared contract, selected pass-through facilities, and deliberately excluded common behavior. Keep historical acceptance and current candidate gates attached to their original artifacts. Use a breaking prerelease whose version the owner chooses later (0.2.0-rc.1 remains a proposal while the package is pre-1.0); do not publish it under the current candidate's version or claim full parity.
2. **Move application services first.** Convert maintained example consumers to selected manager imports or application services, remove MapSetup.locationProvider and useMapServices calls, and add read-only lookup of existing offline metadata. Verify imported and previously created packs remain discoverable without database changes. Introduce getWrapperMap and migrate capture/advanced calls before deleting their old routes in the development branch. No permanent dual implementation or compatibility flag is needed.
3. **Move UI and feature activation.** Change web control/popup imports to Wrapper aliases. Move native controls into screen layout, use selected ornaments, replace native Popup with an application bubble/callout, remove native drag props/callbacks, and move source activation to Map.onClick. Keep interactive live markers and their existing overlay until an SDK-host replacement passes the retained interaction contract.
4. **Relax the retained lifecycle contracts.** Remove native camera correction, feature-state automatic reset/ordering obligations, and automatic image restoration into replacement styles. Convert examples to initialViewState plus commands, explicit application state ownership, and Images keys after style load. Inspect callback-triggered replacement, failure, cancellation, and teardown while deleting the old coordination.
5. **Delete obsolete implementation and reconcile types.** Remove shared offline/location/capture services, service contexts/scoping, composed controls/popups, drag controller/gesture-lock plumbing, synthetic source propagation, state reset journals/queues, camera correction observers, and selected method mirrors. Update custom adapters to the smaller Adapter shape. Retain image ownership guards, query registries, native error propagation, callback cleanup, source/layer conversions, and display-only UserLocation. Remove orphan imports, exports, fixtures, package requirements, and scripts only after searching every caller.
6. **Run routine verification, then request scoped acceptance.** Check documentation/examples, types, relevant unit/mocked suites, build, packed common/selected entries, aliases, and mixed backend resolution. Compile old API misuse as negative type cases, and verify unsupported native drag requests fail when entering through common JavaScript. Required later renderer work covers retained rendering/queries/state, image style transitions, native targets/gestures, live marker children, screen controls/attribution, remount/teardown, and selected raw-ref access in affected environments. Name the completed artifact, commands, six affected environments or justified subset, and duration before requesting acceptance permission. Do not run acceptance during this documentation task.

Changing supported peers is a separate release decision. Prefer one verified native-wrapper release per engine to reduce compatibility work, but do not advertise the installed development versions as newly accepted baselines. The [support matrix](../records/support-matrix.json) continues owning versions and patches until a tested replacement is recorded.

Review each patch by behavior, not by filename or retired feature. Service-only sections become candidates for removal after an upstream fix or an explicit application-owned known limitation is documented. Preserve core camera corrections for SDK dispatch/reset, per-map event isolation, linking/codegen fixes, and feature-state/query error propagation while those behaviors remain required. Removing shared services does not make existing data-integrity or failure-reporting defects acceptable. No native binary-size or portal-dependency reduction is claimed by this proposal.

## Implementation ownership and completion gates

Later implementation units will reach [contracts and root exports](../packages/one-map-react/src/index.ts), [adapter/setup](../packages/one-map-react/src/facade/map-setup.tsx), all map/ref adapters, [Source and interactions](../packages/one-map-react/src/facade/use-map-interactions.ts), [native UI](../packages/one-map-react/src/adapters/shared/native-ui.tsx), [web UI](../packages/one-map-react/src/adapters/web/ui.tsx), [web images](../packages/one-map-react/src/adapters/web/images.tsx), service modules, native patches, maintained Vite/Expo consumers, selected peer probes, package documentation, and the existing coverage checklist. This document owns the agreed migration examples; implementation status lives only in the existing coverage checklist.

Retain regressions for all remaining user behavior. Replace expectations of automatic state clearing and camera rollback with the agreed next-release contracts. Keep tests for explicit removal, query/cluster conversion, detached refs, stale callbacks, failed SDK calls, and multiple maps. Image regressions must distinguish initial waiting, same-style updates, old-style invalidation, explicit remount, errors, and teardown. SDK manager examples establish native argument shapes; application service policy needs application tests. Accessibility and legal attribution remain required in migrated screens.

The migrated package can be called complete only for its explicitly revised scope after the applicable routine checks and approved renderer gates pass. Existing passing counts and historical renderer runs do not certify the proposed removals or new getWrapperMap operation. Selected getter availability is covered by routine checks only. The remaining migration, renderer acceptance, net code deletion, patch removability, and final peer support remain unverified.

## Primary references

- Current first-party [camera contract](../packages/one-map-react/src/contracts/camera-types.ts), [query/state contract](../packages/one-map-react/src/contracts/query-types.ts), [UI contract](../packages/one-map-react/src/contracts/ui-types.ts), [image contract](../packages/one-map-react/src/contracts/images-types.ts), [native services](../packages/one-map-react/src/adapters/mapbox-native/services.ts), and [MapLibre services](../packages/one-map-react/src/adapters/maplibre-native/services.ts) define the before examples and conversion boundaries.
- [react-map-gl Map and methods](https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/map), [useMap](https://visgl.github.io/react-map-gl/docs/api-reference/maplibre/use-map), and [useControl](https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/use-control) describe upstream web context and ownership.
- [MapLibre Map](https://maplibre.org/maplibre-react-native/docs/components/map/), [OfflineManager](https://maplibre.org/maplibre-react-native/docs/modules/offline-manager/), and [LocationManager](https://maplibre.org/maplibre-react-native/docs/modules/location-manager/) describe selected native facilities. Exact examples follow the installed versions named in the research basis, including the installed StaticMapImageManager export rather than assuming current documentation names.
- [Pinned upstream research](upstream-research.md) and the earlier contract review at docs/contract-review.md in the U01 captured working basis retain source comparisons and the native interaction limitations motivating the existing overlay.
