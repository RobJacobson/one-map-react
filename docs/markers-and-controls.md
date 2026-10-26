# Markers and controls

**Working geolocation UI migration.** Common GeolocateControl, its props, adapter field and selected facade aliases, and the common follow controller are removed. Web applications use raw selected WrapperGeolocateControl with upstream props and lifetime; MapSetup.locationProvider does not intercept that control. Native applications use an ordinary screen button and their chosen location integration, with application-owned request cleanup and errors. Supplied UserLocation geometry and accuracy display, GeolocationPosition, raw SDK pucks and selected follow options remain. Native viewState and locationOptions follow retain mutually exclusive camera ownership. Common Control remains until U17; location services, useMapServices, MapServices, MapSetup.locationProvider and acquisition types/factories remain until U18; Source.onClick and UserLocation.onPress remain until U19. See [location migration guidance](revised-api-proposal.md#setup-and-location) and [U16 status](revised-api-implementation-plan.md#u16-remove-common-geolocation-control-and-follow-controller). Historical acquisition/follow acceptance below retains its recorded artifact scope. Changed browser geolocation, native button behavior, sensors, Metro and native builds/installations remain unverified.

**Working scale and attribution migration.** Common ScaleControl and AttributionControl, their props, adapter fields and selected facade aliases are removed. Web applications use raw WrapperScaleControl and WrapperAttributionControl. Native applications use selected SDK ornament options; SDK defaults and explicit positions remain, with no common width or units policy. Legal attribution and logos remain required. Common Control, native compass options, live-marker hosts/portals and the RNMapbox scale-position/resize workaround remain. See [ornament migration guidance](revised-api-proposal.md#markers-images-popups-and-controls) and [U15 status](revised-api-implementation-plan.md#u15-delegate-scale-and-attribution-ornaments). Historical control contracts and acceptance below retain their recorded artifacts; migrated ornaments remain unverified in renderers.

**Working navigation and fullscreen migration.** Common NavigationControl and FullscreenControl composition, props, adapter fields and selected facade aliases are removed. Web applications use raw selected WrapperNavigationControl and WrapperFullscreenControl; native applications own camera buttons in screen UI. Camera methods/getters and native SDK compass options remain. The [control migration contract](revised-api-proposal.md#markers-images-popups-and-controls) describes ownership; [U14 status](revised-api-implementation-plan.md#u14-remove-common-navigation-and-fullscreen-controls) owns verification gates. Historical control contracts and acceptance below keep their recorded artifact scope; renderer interaction and native screen button touches remain unverified.

**Working popup migration.** Common Popup composition is removed, following the [popup migration contract](revised-api-proposal.md#markers-images-popups-and-controls), in favor of direct web WrapperPopup and application-owned native Marker children or selected annotations/Callout. Common automatic dismissal, focus and maxWidth guarantees are excluded. The [U13 status](revised-api-implementation-plan.md#u13-remove-common-popup-composition) owns implementation and verification gates. Popup contracts, scenarios and acceptance results below retain their historical artifact scope; they do not verify migrated native bubble touches or provider/state retention.

**Working next-release marker contract.** Common native Marker dragging is excluded in both live and annotation modes: selected native Marker types permit draggable=false and omit onDragStart/onDrag/onDragEnd; native common-entry JavaScript requests with draggable=true or any drag callback fail clearly. Web Marker dragging and selected raw PointAnnotation/ViewAnnotation dragging remain available. Live native markers retain activation, child buttons and scrolling, providers, offsets, refresh, coordinate updates, and cleanup. The [U07 evidence](../records/evidence/revised-api-u07-native-markers.json) records the completed audit and routine verification; new native touch acceptance remains unverified.

**TF07 implementation checkpoint.** Common UI components and map access are implemented; the authorized R16 renderer acceptance passed across all six environments for the recorded exercised scope. Full VoiceOver and TalkBack audits remain outside that checkpoint. The upstream comparisons below retain their recorded research versions. The [TF07 record](tf07-ui.md) describes that frozen checkpoint's contracts, mapping, and runtime evidence. The broader marker drag contract and proposal examples below are historical comparisons, not the working next-release native contract.

Markers place content at a geographic position. Their appearance can be similar across platforms while their child content, dragging, selection, and event behavior differ. Controls and popups also depend on the host user interface.

**Existing API:** The comparisons below were revalidated against the frozen releases in the research basis. They describe upstream declarations and inspected implementation paths; they do not establish one-map-react marker/control support or equivalent interaction across platforms.

**Agreed design:** Markers use live interactive children by default; annotation mode requires an explicit request. Popup unmount is teardown and does not emit a user dismissal. `onClose` reports a requested dismissal so application state can remove the popup. These recorded contracts belong to the broader TF07 API; see [the baseline record](decisions/0001-baselines-and-ownership.md#accepted-portable-defaults).

**Recorded TF07 API:** `Marker`, `Popup`, `Control`, `NavigationControl`, `AttributionControl`, `ScaleControl`, `GeolocateControl`, `FullscreenControl`, and `useMap` are common exports. `MapSetup` owns backend selection and named-map registration. Selected entries expose typed `hostProps` on map, marker, popup, and custom-control hosts; wrapper-specific map/UI facilities use typed `options` or named wrapper exports. RNMapbox exposes `PointAnnotationManager` and `getAnnotationsLayerID`; MapLibre web exposes `WrapperTerrainControl`, `WrapperGlobeControl`, and `WrapperLogoControl`. Native annotation, callout, and animated layer annotation facilities retain their selected wrapper types. These implementation claims do not certify native gesture behavior before acceptance.

**Recorded TF07 marker behavior:** `Marker` defaults to live children, with a blue 24 × 32 logical-unit pin when children are absent. `renderMode="annotation"` explicitly selects native bitmap annotations on Android. Native live dragging activates after a 500 ms long press on noninteractive content; nested child controls retain their responders. `onDragStart`, `onDrag`, and `onDragEnd` propose `event.lngLat` coordinates; longitude and latitude props remain authoritative. `MarkerRef.refresh()` updates annotation snapshots and resolves without work for live views and web. Marker identity, anchor, and render mode require a new React key to change. Clearing offset sends `[0, 0]`.

`Popup` follows mutable position, anchor, offset, width, children, and callbacks. Dismissal and focus options are creation inputs. Native popups compose live anchored content and an accessible close button; unmount never calls `onClose`. `Control` positions host content in a corner, and standard native controls use the common camera methods. TF08 adds default native acquisition, streaming provider overrides, explicit permission services, location display, and following; one-shot `getCurrentPosition` injection remains supported. Web without an explicit provider retains SDK delegation. See [the TF08 record](tf08-location-offline-capture.md) for implemented behavior and pending acceptance. Browser fullscreen keeps browser semantics and native requests fail explicitly. Native popups reject an explicit `focusAfterOpen`; native attribution uses the platform icon and rejects `compact={false}` instead of ignoring expanded presentation.

GeoJSON and vector `Source.onClick` callbacks receive source feature hits and `stopPropagation()`. Map clicks include rendered features from `interactiveLayerIds`; failed queries report `onError`, and pending queries are discarded on unmount. Source callbacks and selected native hitboxes are mutable. Web source activation selects the topmost registered source independently from map `interactiveLayerIds`. Pending hits cannot activate a keyed replacement source; callback updates on the same source remain current. `Map.id` is a creation input. `useMap()` returns an enclosing common ref and `useMap(id)` resolves a named map in the same `MapSetup`, following the [map-access lifecycle](tf07-ui.md#common-behavior). Commands still reject when the underlying map is not attached or ready.

## Research basis

Inspected October 8, 2026: [RNMapbox 10.3.7][rn-index] at `0f50e8164c1aefe45de9ed9cde310f310076a310`; [MapLibre React Native 11.5.0][ml-index] at `059f46b2dc728fb6259af91b27a071bcda19a2ae`; react-map-gl 8.1.3 at `3df834290bdecf4f5c9b90d7c117d95af12c1f0a`, through both [Mapbox][web-mapbox-index] and [MapLibre][web-index] entry points. The shared web comparisons were checked in both [Marker implementations][web-mapbox-marker], both [Popup implementations][web-mapbox-popup], and both control entry points. The web rendering SDKs are [Mapbox GL JS 3.32.0][mb-sdk-marker] at release tag `v3.32.0` and [MapLibre GL JS 6.13.0][ml-sdk-marker] at `f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d`. Mapbox source uses its reachable release tag because the npm metadata `gitHead` is unavailable from the public source URL; the retrieved body matches the researched release. Native SDK pins follow the wrappers: Mapbox 11.23.1 on iOS/Android, MapLibre 6.31.0 on iOS and 13.6.1 OpenGL on Android. [version-baseline.json](../records/version-baseline.json) records the frozen package metadata; [the inventory](api-coverage.md) records the broader field/method scope.

The tables cover marker rendering, interaction, annotations, popup composition, controls, and map access. The rendering SDK draws the map, the React wrapper attaches host UI and translates its own props, and the one-map-react adapter would normalize the common contract. A source supplies data to the renderer; a layer defines how it draws that data. Renderer-managed point layers therefore have different placement and interaction responsibilities from React view markers.

The upstream TSX excerpts below are declaration-checked with TypeScript 7.0.2, React 19.2.3 and React Native 0.87.1 where relevant, including matching Mapbox-web variations of the MapLibre-web examples. Map setup, native build configuration, credentials, and the selected web SDK stylesheet are omitted explicitly. The historical proposal examples below remain research excerpts; the current TF07 scene is declaration-checked against the implemented exports. [The current review evidence](../records/evidence/markers-controls-current-review.json) records source checks, declaration runs, failures/reruns, and remaining behavioral investigations. Readable guides for [web markers][web-marker-docs], [web popups][web-popup-docs] and [custom web controls][web-control-docs] accompany the pinned implementation links. Readable upstream documentation can evolve; pinned sources identify the versions compared here.

## Point content components

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`MarkerView`: interactive native children][rn-marker] | [`Marker`: interactive native children][ml-marker] | [`Marker`: DOM children][web-marker] | Agreed live-child default; proposed `Marker renderMode="view"` adapts host interaction. |
| [`PointAnnotation`: draggable; Android bitmap children][rn-annotation] | [`ViewAnnotation`: draggable; Android bitmap children][ml-annotation] | [`Marker` dragging and DOM content][web-marker] | Agreed explicit annotation mode; proposed `Marker renderMode="annotation"` adapts static children and drag events. |
| [`Annotation`: convenience point source/layers][rn-annotation-layer] | [`LayerAnnotation`: convenience point source/layers][ml-layer-annotation] | [`Source` plus `Layer`][web-source] | Compose `Source` and `Layer`; translate helper animation and source-press behavior explicitly. |
| [`Callout` attached to annotation][rn-callout] | [`Callout` attached to annotation][ml-callout] | [`Popup` at an independent position][web-popup] | Capability-gated standalone `Popup`; native attachment is not a direct equivalent. |

MapLibre React Native documents `ViewAnnotation` as bitmap content on Android and directs interactive content to `Marker`; on iOS, `Marker` itself delegates to `ViewAnnotation`. RNMapbox directs interactive children to `MarkerView`. These component names alone do not establish whether a nested button, scroll view, or drag gesture works identically. See the [MapLibre annotation documentation][ml-annotation-docs], the [pinned marker branches][ml-marker], and the Android bitmap conversion paths in [RNMapbox][rn-native-annotation] and [MapLibre React Native][ml-native-annotation].

For many static points, draw symbols or circles through a source and layer. This uses the renderer's placement and drawing rather than a native view or browser element per point. Do not silently replace live view children with a symbol for performance; that changes the interaction contract. The native `Annotation`/`LayerAnnotation` helpers also accept coordinate animation options and source-press callbacks, so replacing a helper with source/layer composition must preserve those requests; a static point alone does not satisfy the animated helper contract. The common source/layer examples are in [sources and layers](sources-and-layers.md).

## Marker properties

Position and update handling

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`coordinate: [lng, lat]`][rn-marker] | [`lngLat: [lng, lat]`][ml-marker] | [`longitude`, `latitude`][web-marker] | `longitude`, `latitude`; convert to native tuples. |
| [`anchor: {x, y}` in normalized view coordinates][rn-marker] | [Named `anchor`][ml-marker] | [Named `anchor`][web-marker] | Named anchor; translate to normalized native coordinates. |
| [No declared MarkerView offset prop][rn-marker] | [`offset: [x, y]`][ml-marker] | [`offset` accepts point-like values][web-marker] | `offset: [x, y]`; RNMapbox emulation requires anchor/hit-region validation. |
| [Anchor/coordinate changes flow to native props][rn-marker] | [Anchor/offset/coordinate changes flow to native props][ml-marker] | [Anchor is construction-only; coordinates/rotation/dragging are updated by setters][web-marker] | Implement the proposed update contract explicitly; changing an anchor may require wrapper remount or verified SDK adaptation. |

Selection and interaction

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`isSelected` on MarkerView][rn-marker]; [`selected` on PointAnnotation][rn-annotation] | [`selected` on Marker is iOS-only][ml-marker]; [ViewAnnotation also exposes `selected`][ml-annotation] | [Popup association; no matching general selected prop][web-marker] | Selection belongs to application state; annotation selection is an extension. |
| [MarkerView child presses; no dedicated `onPress`][rn-marker] | [`onPress`: native event][ml-marker] | [`onClick`: browser marker event][web-marker] | `onClick` normalized by adapter, without exposing required raw events. |
| [MarkerView has no `draggable`; PointAnnotation does][rn-annotation] | [Marker has no `draggable`; ViewAnnotation does][ml-annotation] | [`draggable`, drag callbacks][web-marker] | `draggable` depends on render mode and capability. |
| [`stopGesturePropagation`: Android child gesture containment; default false][rn-marker] | [No corresponding declared Marker option][ml-marker] | [DOM child/browser propagation and SDK drag handling][web-marker] | Preserve child interaction; native gesture containment needs a named mapping and physical-touch evidence. |

Child content and presentation

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`style` and `pointerEvents` forwarded by MarkerView][rn-marker] | [Marker extends and forwards native `ViewProps`][ml-marker] | [CSS `style`, class and DOM options][web-marker] | Host-specific styling; common geometry does not imply shared child UI. |
| [`allowOverlap`, `allowOverlapWithPuck`][rn-marker] | [No corresponding declared Marker props][ml-marker] | [DOM marker behavior, separate from symbol collisions][web-marker] | Explicit collision capability; no silent emulation claim. |
| [No matching live-marker rotation props][rn-marker] | [No matching declared Marker rotation props][ml-marker] | [`rotation`, rotation/pitch alignment; SDK-specific options][web-marker] | Named capability/extension options; investigate adaptation before substantiating unsupported behavior. |
| [Native child element required][rn-marker] | [Native child element required][ml-marker] | [Children optional; default SDK marker][web-marker] | Proposed optional children with a one-map-react-owned default marker; implemented blue 24 × 32 logical-unit pin. |

For named anchors, center maps to `{x: 0.5, y: 0.5}`, bottom to `{x: 0.5, y: 1}`, and top-left to `{x: 0, y: 0}`. The proposed offset is a screen translation in logical host units: CSS pixels on web and React Native points on native. MapLibre React Native scales Android offsets by display density in its [native marker implementation][ml-native-marker]. RNMapbox exposes no MarkerView offset prop, so its adapter would need composition and measurement. Validate geographic anchoring and the region that receives touches at multiple densities rather than changing longitude/latitude to simulate an offset.

RNMapbox declares `allowOverlap=false` and `allowOverlapWithPuck=false`; its documentation describes hiding colliding view markers. [Its MarkerView source][rn-marker] also defaults `isSelected=false` and `stopGesturePropagation=false`. MapLibre React Native declares neither overlap option, and web DOM markers are separate from symbol-layer collision handling. **Runtime check pending:** Verify the delegated marker collision defaults and shared blue pin appearance; wrapper omissions do not establish rendering SDK limitations.

## Interactive marker examples

These examples place a clickable ferry label at `[-122.34, 47.61]`, anchored at its bottom. Map setup is omitted; mount each excerpt under its wrapper map. The native examples use native child elements and the web example uses a DOM button.

RNMapbox receives a pressable child:

```tsx
import { MarkerView } from "@rnmapbox/maps";
import { Pressable, Text } from "react-native";

<MarkerView coordinate={[-122.34, 47.61]} anchor={{ x: 0.5, y: 1 }}>
  <Pressable onPress={() => console.log("ferry-1")}>
    <Text>Ferry</Text>
  </Pressable>
</MarkerView>;
```

MapLibre provides a marker press callback:

```tsx
import { Marker } from "@maplibre/maplibre-react-native";
import { Text } from "react-native";

<Marker
  id="ferry-1"
  lngLat={[-122.34, 47.61]}
  anchor="bottom"
  onPress={() => console.log("ferry-1")}
>
  <Text>Ferry</Text>
</Marker>;
```

react-map-gl uses DOM content:

```tsx
import { Marker } from "react-map-gl/maplibre";

<Marker longitude={-122.34} latitude={47.61} anchor="bottom">
  <button onClick={() => console.log("ferry-1")}>Ferry</button>
</Marker>;
```

The proposed one-map-react API normalizes marker configuration. This excerpt supplies native content; a web application supplies a DOM child such as `<span>Ferry</span>` instead. Sharing React Native content on web requires the application to configure React Native Web; one-map-react does not supply that renderer:

```tsx
import { Marker } from "one-map-react";
import { Text } from "react-native";

// Proposed API; backend setup omitted.
<Marker
  id="ferry-1"
  longitude={-122.34}
  latitude={47.61}
  anchor="bottom"
  onClick={() => console.log("ferry-1")}
>
  <Text>Ferry</Text>
</Marker>;
```

The RNMapbox adapter would supply press handling around or within the native child because MarkerView has no dedicated marker press callback. MapLibre React Native supplies `onPress`, whose native event includes a marker ID and coordinate/point data; react-map-gl supplies a browser `onClick` with an SDK target and `originalEvent`. The common callback would expose one-map-react-owned values without requiring raw SDK events. Nested child presses must remain distinct from marker activation. **Open question:** Validate callback bubbling, map-click suppression, nested pressables/scrollables, keyboard interaction, and accessibility on the actual hosts before certifying the normalized click contract.

## Dragging and render modes

The comparisons and examples in this section preserve the broader historical proposal. For the next-release native contract, remove draggable and every drag callback from common Marker in either mode. Programmatic coordinate updates and annotation refresh remain shared; selected raw native annotations retain their SDK drag behavior. Web examples retain their drag props.

**Agreed design:** The default view mode preserves live child content. Annotation mode requires an explicit request and permits static native bitmap children. **Proposed API:** `renderMode="view"` and `renderMode="annotation"` spell those modes. Buttons inside annotation content have no portable interactive-child guarantee.

Two capabilities distinguish the behavior: `markerDragging` covers the default live-view marker contract; `annotationDragging` covers the explicit annotation mode. Native wrappers have annotation dragging but do not expose a corresponding live-marker draggable prop in the inspected APIs. A pending adapter must report pending implementation. A substantiated unavailable live-drag contract would produce `UnsupportedFeatureError`; absence of a wrapper prop alone cannot justify that decision. The native gesture-composition investigation remains assigned to S13b.

These excerpts keep the same ferry position in React state and update it after a drag. Map setup and label styling are omitted. A surrounding function component supplies the scope for each `useState` call.

```tsx
import { useState } from "react";
import { PointAnnotation } from "@rnmapbox/maps";
import { Text } from "react-native";

const [position, setPosition] = useState<[number, number]>([-122.34, 47.61]);

<PointAnnotation
  id="ferry-1" coordinate={position} draggable
  onDragEnd={(event) => setPosition([
    event.geometry.coordinates[0], event.geometry.coordinates[1],
  ])}
>
  <Text>Ferry</Text>
</PointAnnotation>;
```

```tsx
import { useState } from "react";
import { ViewAnnotation } from "@maplibre/maplibre-react-native";
import { Text } from "react-native";

const [position, setPosition] = useState<[number, number]>([-122.34, 47.61]);

<ViewAnnotation
  id="ferry-1" lngLat={position} draggable
  onDragEnd={(event) => setPosition(event.nativeEvent.lngLat)}
>
  <Text>Ferry</Text>
</ViewAnnotation>;
```

```tsx
import { useState } from "react";
import { Marker } from "react-map-gl/maplibre";

const [position, setPosition] = useState<[number, number]>([-122.34, 47.61]);

<Marker
  longitude={position[0]} latitude={position[1]} draggable
  onDragEnd={(event) => setPosition([
    event.lngLat.lng, event.lngLat.lat,
  ])}
>
  <span>Ferry</span>
</Marker>;
```

```tsx
import { useState } from "react";
import { Marker } from "one-map-react";
import { Text } from "react-native";

const [position, setPosition] = useState<[number, number]>([-122.34, 47.61]);

// Proposed API; annotation mode accepts static-content differences.
<Marker
  id="ferry-1"
  longitude={position[0]} latitude={position[1]}
  renderMode="annotation" draggable
  onDragEnd={(event) => setPosition(event.lngLat)}
>
  <Text>Ferry</Text>
</Marker>;
```

The annotation adapter selects `PointAnnotation` or `ViewAnnotation`, normalizes drag payloads to a tuple, and manages refreshed bitmap content when required. Web annotation mode can use a DOM marker with the narrower static-content contract. The callbacks expose different values: RNMapbox supplies a decoded GeoJSON point feature, MapLibre React Native supplies `event.nativeEvent.lngLat`, and react-map-gl attaches an SDK `LngLat` object. The one-map-react adapter would validate and copy two finite coordinates into its own tuple; coordinate props remain authoritative after application state accepts the proposal. Android annotations expose `refresh()` for child snapshots after an image loads. **Open question:** Validate image refresh, drag interruption, coordinate rejection/update timing, selection, and cleanup, including native live-child dragging as a separate contract.

## Popups and callouts

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`Callout` under PointAnnotation][rn-callout] | [`Callout` under ViewAnnotation][ml-callout] | [`Popup` independently mounted][web-popup] | Standalone `Popup` capability; common longitude/latitude and children. |
| [Annotation selection and required iOS title][rn-annotation] | [Annotation selection and required iOS title][ml-annotation] | [Popup open/close callbacks and DOM options][web-popup] | React mount controls visibility; `onClose` reports a requested dismissal. |
| [`style` on animated wrapper, `containerStyle`, `textStyle` and bubble/tip styles][rn-callout] | [`style` on native container, `animatedStyle`, `titleStyle` and bubble/tip styles][ml-callout] | [CSS style/class, anchor, offset and SDK popup options][web-popup] | Convert named styling fields explicitly; native overlay/attachment work remains open. |
| [No standalone Callout `onClose` prop; annotation selection callbacks][rn-annotation] | [No standalone Callout `onClose` prop; `onSelect`/`onDeselect`][ml-annotation] | [Close listener detached before unmount removes the popup][web-popup] | Agreed requested-dismissal callback and teardown distinction; native composition must implement it. |
| [Annotation title/selection and native Callout props][rn-annotation] | [Annotation title/selection and native Callout props][ml-annotation] | [SDK close-button/click/focus options are read during construction; wrapper updates a narrower field set][web-popup] | Define constructor/update/reset semantics; native dismissal and focus require explicit composition. |

These excerpts show `Ferry details` at the same location. Native callouts attach to selected annotations with the title required by their iOS contract. The web popup has its own position and can be mounted without a marker:

```tsx
import { PointAnnotation, Callout } from "@rnmapbox/maps";
import { Text } from "react-native";

<PointAnnotation
  id="ferry-1" coordinate={[-122.34, 47.61]}
  title="Ferry" selected
>
  <Text>Ferry</Text>
  <Callout title="Ferry details" />
</PointAnnotation>;
```

```tsx
import { ViewAnnotation, Callout } from "@maplibre/maplibre-react-native";
import { Text } from "react-native";

<ViewAnnotation
  id="ferry-1" lngLat={[-122.34, 47.61]}
  title="Ferry" selected
>
  <Text>Ferry</Text>
  <Callout title="Ferry details" />
</ViewAnnotation>;
```

```tsx
import { useState } from "react";
import { Popup } from "react-map-gl/maplibre";

const [open, setOpen] = useState(true);

open && (
  <Popup
    longitude={-122.34}
    latitude={47.61}
    onClose={() => setOpen(false)}
  >
    <span>Ferry details</span>
  </Popup>
);
```

```tsx
import { useState } from "react";
import { Popup } from "one-map-react";
import { Text } from "react-native";

const [open, setOpen] = useState(true);

// Proposed API; requires standalonePopup capability.
open && (
  <Popup
    longitude={-122.34}
    latitude={47.61}
    onClose={() => setOpen(false)}
  >
    <Text>Ferry details</Text>
  </Popup>
);
```

**Proposed API:** A native standalone popup could use a positioned overlay or an adapter-owned anchor annotation. Either mechanism must handle camera movement, measurement, dismissal, offscreen positions, and child interaction. Async projection can introduce lag; an attached callout can introduce selection constraints. Do not advertise `standalonePopup` until the supported contract works.

**Agreed design:** Application state controls mounting, and `onClose` requests dismissal rather than authorizing an adapter to change React state. Unmounting is teardown and must not emit `onClose`.

**Existing API:** react-map-gl detaches its close listener before removal on unmount in both pinned web implementations; this provides implementation evidence for its cleanup path, while equivalent native behavior still requires a prototype.

**Open question:** Specify and verify native close-button/map-click handling, repeated dismissals, StrictMode cleanup, and any focus/selection effects. An attached native callout is not a verified standalone popup fallback.

The [pinned Mapbox popup wrapper][web-mapbox-popup] assigns `popup.options.anchor` when a truthy changed offset is supplied; its anchor/max-width branch only calls `setMaxWidth`. The [MapLibre branch][web-popup] assigns the anchor in the anchor/max-width branch instead. Both wrappers update position, style and class names, but forward close-button, close-on-click, close-on-move and focus-after-open options at construction. Both selected [Mapbox][mb-sdk-popup] and [MapLibre][ml-sdk-popup] SDKs default the close button, close-on-click and focus-after-open to true. **Open question:** Implement and verify the proposed popup update/reset contract across those branches, including changing only an anchor, clearing an offset, and toggling dismissal options; matching props do not establish matching updates.

## Controls and map access

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`attributionEnabled`, `logoEnabled`, `compassEnabled`, `scaleBarEnabled` map props][rn-map] | [`attribution`, `logo`, `compass`, `scaleBar` map props][ml-map] | [`AttributionControl`, `NavigationControl`, `ScaleControl` child components][web-index] | Normalize common ornament intent; richer controls are separate components. |
| [No standard navigation/fullscreen React controls][rn-index] | [No standard navigation/fullscreen React controls][ml-index] | [`NavigationControl`, `FullscreenControl`][web-index] | Navigation UI may be one-map-react-owned; browser fullscreen is a capability. |
| [No GL JS `IControl` host][rn-index] | [No GL JS `IControl` host][ml-index] | [`useControl`][web-control] | Web-control extension; native controls require host-appropriate UI. |
| [Native refs and application context][rn-index] | [Native refs and application context][ml-index] | [`MapProvider`; `useMap()` returns a collection plus `current`][web-use-map] | Implemented `MapSetup` selects an adapter and owns the registry; `useMap` exposes common refs. |
| [No Terrain/Globe/Logo control-component exports][rn-index] | [No Terrain/Globe/Logo control-component exports][ml-index] | [MapLibre exports Terrain/Globe/Logo controls][web-index]; [Mapbox entry omits them][web-mapbox-index] | Named backend capability/control paths; missing wrapper controls do not establish unavailable SDK rendering. |
| [Corner/margin ornament positions; scale-bar units declared][rn-map] | [Corner/margin positions; Android scale bar restricted to top-left][ml-map] | [Control corner strings; ScaleControl `unit`/`maxWidth` updates][web-scale] | Validate placement/unit combinations; unsupported placement cannot silently become another corner. |
| [No corresponding wrapper control update lifecycle][rn-index] | [No corresponding wrapper control update lifecycle][ml-index] | [`useControl` creates/adds/removes once; NavigationControl options are construction-only][web-navigation] | A typed web-control extension must define updates, remount boundaries, ownership and cleanup. |

The implemented `MapSetup` selects an adapter and owns a map registry. `useMap()` resolves the enclosing map; `useMap(id)` resolves a named map in that provider. react-map-gl's `MapProvider` groups wrapper map instances, and `useMap()` returns an ID-indexed collection with a `current` entry; it is not the common hook's singular-ref signature. Named lookup returns `undefined` while the map is absent, but access outside the required context still throws. A ref that exists before renderer readiness still rejects commands with a readiness error. The [map-access lifecycle](tf07-ui.md#common-behavior) describes the current contract.

**Proposed API:** Use common corner positions such as `top-right` for simple controls; native ornament adapters would convert a corner and margin into native position objects. MapLibre React Native declares that Android scale bars support only the top-left corner, so a requested bottom/right placement needs a validated composition or an explicit unsupported decision. Navigation UI may compose the common camera handle with native buttons; browser fullscreen requires browser facilities. The native wrappers do not declare a GL JS `IControl` host. [Mapbox][mb-sdk-control] and [MapLibre][ml-sdk-control] define controls around DOM elements, so a native adapter needs native UI composition rather than attaching those browser instances. **Open question:** Verify control target-map ownership, command readiness, changing options/position, subscription cleanup and attribution presentation. Required attribution cannot be hidden as an unsupported-feature fallback.

### Custom zoom buttons and map ownership

These excerpts create a button that requests zoom 13. The native wrappers use a camera ref; react-map-gl uses a map ref. Map setup is omitted: attach each shown native camera inside its map, attach the web ref to `<Map ref={mapRef}>`, and place the button in the application's native or DOM UI. All maps use ID `ferry-map` where the wrapper supports map IDs and initialize at `[-122.34, 47.61]` with zoom 11, using the setup patterns in [maps and camera](maps-and-camera.md#initial-camera-examples). A surrounding function component supplies hook scope. Disable controls until the map is ready and handle operational failures in application code.

RNMapbox keeps its [camera child][rn-camera] separate from the button:

```tsx
import { useRef, type ComponentRef } from "react";
import { Camera } from "@rnmapbox/maps";
import { Button } from "react-native";

const cameraRef = useRef<ComponentRef<typeof Camera>>(null);

// Mount this camera inside the omitted MapView.
<Camera ref={cameraRef} />;

// Place this button in the application's overlay UI after map readiness.
<Button
  title="Zoom to 13"
  onPress={() => cameraRef.current?.zoomTo(13, 0)}
/>;
```

MapLibre React Native exposes its own [camera-ref type][ml-camera]:

```tsx
import { useRef } from "react";
import { Camera, type CameraRef } from "@maplibre/maplibre-react-native";
import { Button } from "react-native";

const cameraRef = useRef<CameraRef>(null);

// Mount this camera inside the omitted Map.
<Camera ref={cameraRef} />;

// Place this button in the application's overlay UI after map readiness.
<Button
  title="Zoom to 13"
  onPress={() => cameraRef.current?.zoomTo(13, { duration: 0 })}
/>;
```

react-map-gl exposes the selected web SDK operation through its map ref:

```tsx
import { useRef } from "react";
import { type MapRef } from "react-map-gl/maplibre";

const mapRef = useRef<MapRef>(null);

// Attach mapRef to the omitted Map before enabling this button.
<button onClick={() => mapRef.current?.zoomTo(13, { duration: 0 })}>
  Zoom to 13
</button>;
```

one-map-react already declares `useMap(id)` and the promise-returning camera handle. Camera-command adapters are implemented in TF04; this declaration-checked example does not establish that the command currently succeeds on the selected backend:

```tsx
import { useMap } from "one-map-react";
import { Button } from "react-native";

// Inside a React component under the same MapSetup as Map id="ferry-map".
const map = useMap("ferry-map");

<Button
  title="Zoom to 13"
  disabled={!map}
  onPress={() => {
    void map?.zoomTo(13, { duration: 0 }).catch(console.error);
  }}
/>;
```

A web application can invoke the same common handle from a DOM button. The common promise acknowledges validation/dispatch rather than camera settling. A future one-map-react navigation component would own readiness, subscriptions and explicit error reporting; the button excerpts do not implement that component. react-map-gl's `useControl` creates a DOM-owning SDK control inside the selected map context and removes it during cleanup; native controls instead compose host UI with the camera handle. Changes to custom control options need explicit update handling because `useControl` does not recreate the control on every render.

Location controls and native pucks are covered in [capabilities and extensions](capabilities-and-extensions.md). Marker coordinates, async projection, and map events follow [maps and camera](maps-and-camera.md). Renderer-managed point styling follows [sources and layers](sources-and-layers.md).

[ml-annotation]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/annotations/view-annotation/ViewAnnotation.tsx
[ml-annotation-docs]: https://maplibre.org/maplibre-react-native/docs/components/annotations/view-annotation/
[ml-callout]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/annotations/callout/Callout.tsx
[ml-index]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/index.ts
[ml-layer-annotation]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/annotations/LayerAnnotation.tsx
[ml-map]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/map/Map.tsx
[ml-marker]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/annotations/marker/Marker.tsx
[rn-annotation]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/PointAnnotation.tsx
[rn-annotation-layer]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/Annotation.tsx
[rn-callout]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/Callout.tsx
[rn-index]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/Mapbox.native.ts
[rn-map]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx
[rn-marker]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MarkerView.tsx
[web-control]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/use-control.ts
[web-index]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/index.ts
[web-marker]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/marker.ts
[web-popup]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/popup.ts
[web-source]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/source.ts
[web-use-map]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/use-map.tsx

[ml-native-marker]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/android/src/main/java/org/maplibre/reactnative/components/annotations/markerview/MLRNMarkerView.kt
[mb-sdk-marker]: https://github.com/mapbox/mapbox-gl-js/blob/v3.32.0/src/ui/marker.ts
[ml-sdk-marker]: https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts
[web-mapbox-index]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/index.ts
[web-navigation]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/navigation-control.ts
[web-scale]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/scale-control.ts

[web-mapbox-marker]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/components/marker.ts
[web-mapbox-popup]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/components/popup.ts
[mb-sdk-popup]: https://github.com/mapbox/mapbox-gl-js/blob/v3.32.0/src/ui/popup.ts
[ml-sdk-popup]: https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts

[rn-native-annotation]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/android/src/main/java/com/rnmapbox/rnmbx/components/annotation/RNMBXPointAnnotation.kt
[ml-native-annotation]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/android/src/main/java/org/maplibre/reactnative/components/annotations/pointannotation/MLRNPointAnnotation.kt
[rn-camera]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/Camera.tsx
[ml-camera]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/camera/Camera.tsx
[mb-sdk-control]: https://github.com/mapbox/mapbox-gl-js/blob/v3.32.0/src/ui/map.ts
[ml-sdk-control]: https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/control.ts

[web-marker-docs]: https://visgl.github.io/react-map-gl/docs/api-reference/maplibre/marker
[web-popup-docs]: https://visgl.github.io/react-map-gl/docs/api-reference/maplibre/popup
[web-control-docs]: https://visgl.github.io/react-map-gl/docs/api-reference/maplibre/use-control
