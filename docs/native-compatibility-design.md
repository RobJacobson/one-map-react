# Native compatibility with react-map-gl

The next breaking release should let a React application run the same map screen with stock react-map-gl on web and with RNMapbox or MapLibre React Native on native. The application chooses a backend in its platform imports. one-map-react translates the native calls. The browser gets its components, events, refs, and types directly from react-map-gl.

The checkout implements all four stages. Each native entry binds its renderer and owns named lookup through its optional `MapProvider`. The package root exports shared types. Browser convenience paths forward react-map-gl, and stock web apps can omit one-map-react entirely. The [package guide](../packages/one-map-react/README.md) covers the breaking imports and event, ref and source changes. The [coverage checklist](api-coverage.md#native-compatibility-verification) lists routine proofs. Renderer acceptance remains open in the [current handoff](revised-api-acceptance-plan.md#current-handoff).

## Why change the boundary?

FerryJoy needed to draw changing vessel positions and labels on a map. A source supplies the features, a layer describes how to draw them, and the camera controls the visible region. Its small platform components let the map screen describe these once. For example, FerryJoy's web line layer maps the native spelling `lineWidthTransition` to the style property `line-width-transition`. A public library should let callers write the desktop spelling in their screen and translate it where a native wrapper requires it.

Three findings from the November 21, 2026 [source audit baseline](https://github.com/RobJacobson/one-map-react/tree/610fe5680ced2a224c1cc1d03167d9dd900c2731) determine the design.

- The shared paint declarations omit all three transitions used by the vessel display (`line-width-transition`, `circle-radius-transition`, and `circle-stroke-width-transition`). Inline layer props fail type checking, even though the RNMapbox adapter already converts style property names mechanically and the MapLibre adapter passes paint and layout through. Maintaining a third style vocabulary can reduce coverage. [Shared layer declarations](../packages/one-map-react/src/contracts/layer-types.ts), [RNMapbox layer](../packages/one-map-react/src/adapters/mapbox-native/layers.tsx), and [MapLibre layer](../packages/one-map-react/src/adapters/maplibre-native/layers.tsx).
- The web adapter feeds wheel events through a click converter that requires geographic and screen coordinates. The pinned wheel events carry the original DOM event and lack those fields. For filtered clicks, react-map-gl supplies hit features. The facade queries the map again and applies its own missing-layer behavior. Direct web imports remove both translations. [Web event bindings](https://github.com/RobJacobson/one-map-react/blob/618cf7c5bcb2a72d7d256c9aaebd0b894eadf986/packages/one-map-react/src/adapters/web/map.tsx), [click handler](../packages/one-map-react/src/facade/use-map-interactions.ts), [Mapbox wheel event](https://github.com/mapbox/mapbox-gl-js/blob/v3.32.0/src/ui/events.ts), and [MapLibre wheel event](https://github.com/maplibre/maplibre-gl-js/blob/v6.13.0/src/ui/events.ts).
- A selected native `Map` export gives the ref a backend-specific type, but `MapSetup` chooses the runtime backend. Consumers must keep these two choices in sync. The enclosing map also owns useful resources, including its ready signal and attached ref. Backend selection can move to imports while those resources stay with the mounted map. [Selected Mapbox entry](../packages/one-map-react/src/mapbox-native.tsx), [facade map](../packages/one-map-react/src/facade/map.tsx), and [map session](../packages/one-map-react/src/facade/map-context.tsx).

## Target package and consumer

A platform module gives the application one import for shared JSX. This proposed mixed pair uses MapLibre GL JS in the browser and RNMapbox on native. An application can switch either backend independently. Each shell owns its credentials and host layout. The web shell also owns the renderer CSS.

```ts
// maps.web.ts
export { Map, Layer, Marker, Source, useMap } from "react-map-gl/maplibre";
```

```ts
// maps.native.ts
export { Map, Layer, Marker, Source, useMap } from "one-map-react/mapbox-native";
```

```tsx
// VesselMap.tsx, shared by both shells
import { Map as VesselMapView, Marker } from "./maps";

export function VesselMap() {
  return (
    <VesselMapView
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
      initialViewState={{ longitude: -122.45, latitude: 47.61, zoom: 10 }}
    >
      <Marker longitude={-122.45} latitude={47.61} />
    </VesselMapView>
  );
}
```

Each native entry binds its own map, source, layer, marker, and hook. The [package guide](../packages/one-map-react/README.md) describes enclosing and named native map access. Applications that use backend-specific operations borrow a typed native wrapper handle or import the SDK directly. Helpers with no desktop component equivalent, such as declarative image registration and supplied-location display, belong behind explicit extension imports. A browser app using ordinary react-map-gl should have no dependency on one-map-react. [Upstream map usage](https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/map) and [hook contract](https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/use-map).

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| Camera child takes `centerCoordinate`, `zoomLevel`, and `heading`. | Camera child takes `center`, `zoom`, and `bearing`. | Map accepts a partial `initialViewState`. | Accept desktop camera inputs and convert on native. Distinguish initial defaults, changed targets, and observed movement. |
| Layer-specific components take camel-case style fields. | Layer accepts style-spec paint and layout. | Layer selects its family with `type` and accepts style-spec keys. | Keep the discriminated layer families and expression values. Translate RNMapbox component and field names. |
| Cluster queries use a mounted shape source and a cluster feature. | Cluster queries use a mounted GeoJSON source and a cluster ID. | Source methods differ by renderer. The pinned Mapbox entry uses callbacks and MapLibre returns promises. | Expose cluster access at the source. Support both desktop call forms on native. Keep native source ownership local to the map. |

The comparison follows the [RNMapbox camera converter](../packages/one-map-react/src/adapters/mapbox-native/convert-camera.ts), [MapLibre camera converter](../packages/one-map-react/src/adapters/maplibre-native/convert-camera.ts), and [source and layer reference](sources-and-layers.md), including the [Mapbox web cluster binding](../packages/one-map-react/src/mapbox-web.tsx) and [MapLibre web cluster binding](../packages/one-map-react/src/maplibre-web.tsx). A desktop map can return a zoom synchronously while the native bridge returns a promise. Portable callers can write `await map.getZoom()` for both. Code that requires synchronous reads or chains renderer commands needs migration. A native camera can move away from an unchanged declarative target after a gesture. Document that limit for screens that rely on desktop controlled-camera feedback. [Camera contract](../packages/one-map-react/src/contracts/map-types.ts).

## Stage 1. Establish the desktop reference

Add one vessel-map screen alongside the [existing shared example](../packages/example-map/src/example-map.tsx). Use a small local style and GeoJSON fixture so correctness checks have no tile-service dependency. Render the three paint transitions, a marker with an interactive child, and a button that calls `flyTo`. Exercise `interactiveLayerIds`, read the first hit in `onClick`, and read the moved camera in `onMove`. Put platform-specific presentation in the app shell. Keep the screen's map imports behind the platform imports above.

Compile that same source separately against the pinned Mapbox and MapLibre react-map-gl entries. Let each entry infer props, events, and refs. A permissive test alias or type assertion would hide the discrepancies this fixture exists to find. Update the [migration contract](revised-api-proposal.md) and [coverage checklist](api-coverage.md) for this release. Record component and method placement, argument and return shapes, update behavior, backend exceptions, and where each behavior will be checked. Carry forward the full rendering and query inventory, including workflows outside the example.

**Exit evidence.** Both desktop compilation jobs pass with direct upstream imports. The checked-in fixture includes the transition properties, and the contract identifies native differences for each retained workflow. Existing consumers can still build while the native entries are developed.

## Stage 2. Bind each native entry to its renderer

Use the [RNMapbox components](../packages/one-map-react/src/adapters/mapbox-native/index.ts) and [MapLibre native components](../packages/one-map-react/src/adapters/maplibre-native/index.ts) already present. Give each entry a concrete map implementation and matching descendants. Move ref attachment, readiness, press-query delivery, and cleanup into the mounted native map before retiring runtime adapter lookup. Keep the source-ref registry per map. Cleanup for an old source must preserve a replacement registered under the same ID. Suppress late click delivery from a detached map. Once a command has reached the SDK, its completion follows SDK ordering.

Make ordinary enclosing-map access work without application setup. Register named maps only within the optional provider. Keep the live marker overlay wired to its map's camera, layout, and ready state. Review each native entry's emitted declarations and imports as well as its JavaScript. A consumer installing RNMapbox must be able to import and type-check its entry with MapLibre and browser renderer peers absent, and vice versa. [Live marker ownership](../packages/one-map-react/src/adapters/shared/native-marker-overlay.tsx) and [packed-peer checks](../scripts/test-peers.mjs).

**Exit evidence.** Component tests mount each entry directly, attach and detach a ref, resolve enclosing and named maps, and replace a source while a query is pending. Two isolated packed consumers load the correct entry and declarations with only the relevant peers installed.

## Stage 3. Complete the native mappings by workflow

- **Rendering and style updates.** Cover GeoJSON, vector, raster, raster DEM, and image sources. Carry forward background, fill, line, circle, symbol, raster, heatmap, fill extrusion, and hillshade layers. Derive paint and layout declarations from a versioned style specification and keep proven native exceptions local. Preserve update and removal semantics for data, paint, layout, filters, ordering, and registered images across source and style replacement. A type declaration alone cannot establish that a native renderer draws a property.
- **Camera, gestures, and markers.** Translate initial state, camera targets, bounds, padding, commands, movement events, and supported gestures. Preserve default and custom markers, anchors, offsets, and interactive children. Retain the native portal and version-specific patches during the refactor. Historical iOS testing found cancelled child presses inside geographic marker hosts. Any replacement needs independent evidence for press delivery, scrolling, placement, context propagation, and teardown. [Package guide](../packages/one-map-react/README.md#native-patches-and-linking).
- **Events, queries, and feature state.** Match the portable desktop fields, including `event.viewState`, `event.lngLat.lng`, and `event.point.x`. Query the native map at the press point when the caller requests feature hits. Cover projection and unprojection, rendered and source queries, cluster operations, and explicit feature-state reads and writes. Specify bridge failures, detached handles, and the difference between an empty result and a failed query. Keep feature-state lifetime tied to the renderer. Expose terrain, elevation, and projection support per backend. [Query contracts](../packages/one-map-react/src/contracts/query-types.ts) and [existing support boundaries](api-coverage.md#exceptions-and-open-gates).

**Exit evidence.** The reference screen compiles independently against all four entries with one shared set of map calls. Focused native tests cover coordinate and bounds conversions, paint removal, source replacement, cluster dispatch, late query completion, and marker cleanup. Record which interaction and rendering claims still require a device or browser.

## Stage 4. Migrate consumers and retire the web facade

Switch the maintained web and Expo examples to their platform imports. Exercise mixed engine choices through the existing [package selection checks](../scripts/test-package.mjs). If the platform-aware convenience paths remain, make their browser branches re-export the corresponding upstream entry, including its types and default export. Verify that native resolution loads only the chosen SDK and that browser resolution reaches stock react-map-gl. Remove the custom web map, ref, and event adapters after migrating their callers. Review tests by the behavior they protect. Keep regressions for native conversions and delete assertions specific to retired web normalization.

Publish a migration guide with the breaking release. Show how to replace `MapSetup`, resolve a named map through `useMap()`, read event coordinates, await native reads, and access a cluster source. Specify the disposition of the root and legacy entry paths and give replacements for image helpers, supplied location, and SDK aliases. Existing users who rely on one-map's web click errors, normalized tuples, or promise-based facade refs need explicit examples. Keep the previous release available to consumers during migration.

**Exit evidence.** Build and type-check the examples and isolated applications from the packed candidate. Check that a web-only consumer can use the reference screen with stock react-map-gl and zero one-map imports. Verify that the published file list and declarations reflect the new exports. Record outstanding runtime claims and request approval for affected renderer acceptance under the [testing policy](testing-policy.md#acceptance-timing-and-user-permission). Release readiness depends on the evidence for that candidate.
