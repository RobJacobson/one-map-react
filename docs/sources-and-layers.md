# Sources and layers

**Working feature-click migration.** The [map-click migration](revised-api-proposal.md#rendering-and-queries-stay-shared) uses Map.onClick with interactiveLayerIds for source activation. Source.onClick, SourceClickEvent, synthetic source bubbling, selected facade native source hitbox additions and UserLocation.onPress are removed. Raw native Wrapper source onPress/hitbox facilities, source refs/queries/state, live markers/portals and supplied location geometry/accuracy remain. Native filtered clicks retain queries at the actual logical map point, observable errors and stale-map callback protection. The future native focused source stop/bubbling probe is retired; historical scenario IDs and outcomes remain attached to their recorded artifacts. Renderer/query/touch behavior, Metro and native builds/installations remain unverified.

**Current advanced source/layer routes:** See [advanced rendering](tf09-rendering.md) for selected canvas/video/custom and renderer-specific families. Both web engines passed canvas/video/custom output and teardown; all six environments passed hillshade. Other advanced families retain explicit runtime-unverified status.

**Preserved research.** Upstream comparisons and inventory references below remain useful at their recorded versions. Previous facade contracts, stage assignments, and implementation/acceptance claims are historical. Use the [thin-facade requirements](requirements.md) and [new stage plan](stage-plan.md) when implementing these APIs; full coverage remains required.

A source supplies map data. A layer selects and draws that data. Keeping them separate lets an application draw one route source with several styles or show the same point source as symbols and circles.

This reference covers component and property mappings, updates, queries, clustering, feature state, and images. It proposes a style-spec-shaped API while identifying operations that require more than renaming.

**Existing API:** The comparisons below describe the frozen current versions inspected on October 8, 2026. Source and declaration review establish wrapper fields and dispatch paths; they do not establish one-map-react adapter support or equivalent native rendering behavior.

**Agreed design:** Source/layer declarations, required stable component IDs, promise-based map methods, and portable feature-state values follow [the portable contract decision](decisions/0002-portable-contracts.md). Resource ownership, conversion, and runtime behavior remain assigned implementation work. Additional source/query/image interfaces below are proposed until their owning stages establish the contract and evidence.

**Implemented in TF02:** `Source` accepts `type: "geojson"`, a required `id`, and object `data`. `Layer` accepts `type: "line"` with `paint["line-color"]`, `paint["line-width"]`, and optional `layout["line-cap"]`. RNMapbox renders `ShapeSource` plus `LineLayer` with `shape` and camelCase `lineColor`, `lineWidth`, and `lineCap`. MapLibre Native renders `GeoJSONSource` plus `Layer`. Web forwards react-map-gl `Source` and `Layer`. The common `Layer` remains the direct child of the wrapper source: RNMapbox injects `sourceID`, and MapLibre Native and react-map-gl inject `source`; `Layer` forwards that injected prop. The six-environment smoke passed. Mapbox Android's opening camera matches pinned `@rnmapbox/maps` 10.3.7. See the [TF02 record](tf02-shared-map.md).

**Implemented in TF05:** The remaining portable source families (`vector`, `raster`, `raster-dem`, `image`) and the full eight-type layer set (`background`, `fill`, `line`, `circle`, `symbol`, `raster`, `heatmap`, `fill-extrusion`) are implemented with typed paint/layout keys, structural expression and filter passthrough, `beforeId` ordering, GeoJSON clustering configuration with capability gates, a common `Images` component, data updates, removed-key reset, immutable-option remount rejection, and style-replacement rebuild. Each adapter defines per-family converters colocated in the adapter module; they list every field mapping explicitly and return the wrapper component's own prop types, so a renamed wrapper field fails at compile time. Range and unknown-key checks are deferred to the selected map library. Raster DEM `encoding` and `attribution` throw on mapbox-native; DEM `scheme` throws on both native adapters. `raster-array`, `video`, and `canvas` sources are deferred to TF09. The six-environment smoke passed. See the [TF05 record](tf05-sources.md).

**Implemented in TF06:** Rendered and source queries, query filters, cluster queries, feature identifiers, and feature-state set/get/remove are promise-based `MapRef` methods on every adapter. Results are normalized (feature array, collection, or Android JSON string), preserve order and duplicates, and distinguish empty success from failure. Cluster dispatch goes through native source refs (a `ShapeSource` registry on mapbox-native; a GeoJSON-plus-vector registry on maplibre-native, where GeoJSON `getData` queries loaded source tiles on iOS and Android) and through the style source on web with each engine's report style normalized. See the [TF06 record](tf06-queries.md).

## Research basis

Inspected October 8, 2026: [RNMapbox 10.3.7][rn-index] at `0f50e8164c1aefe45de9ed9cde310f310076a310`; [MapLibre React Native 11.5.0][ml-index] at `059f46b2dc728fb6259af91b27a071bcda19a2ae`; react-map-gl 8.1.3's [Mapbox][web-mapbox-index] and [MapLibre][web-index] entries at `3df834290bdecf4f5c9b90d7c117d95af12c1f0a`; [Mapbox GL JS 3.32.0][sdk-mapbox-map] at release tag `v3.32.0`; and [MapLibre GL JS 6.13.0][sdk-maplibre-map] at `f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d`. [version-baseline.json](../records/version-baseline.json) records the package pins and provenance. The renderers' style specifications share established concepts and have different extensions; these comparisons make no overall parity claim.

Readable API references accompany the pinned implementation evidence: RNMapbox's [ShapeSource](https://rnmapbox.github.io/docs/components/ShapeSource) and [LineLayer](https://rnmapbox.github.io/docs/components/LineLayer); MapLibre React Native's [GeoJSONSource](https://maplibre.org/maplibre-react-native/docs/components/sources/geo-json-source/) and [Layer](https://maplibre.org/maplibre-react-native/docs/components/layer/); and react-map-gl's [Mapbox Source](https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/source), [MapLibre Source](https://visgl.github.io/react-map-gl/docs/api-reference/maplibre/source), [Mapbox Layer](https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/layer), and [MapLibre Layer](https://visgl.github.io/react-map-gl/docs/api-reference/maplibre/layer). These live documentation pages can move beyond the frozen releases; the pinned sources establish the comparisons here.

[The current review evidence](../records/evidence/sources-layers-current-review.json) records source hashes, all comparison rows, and declaration checks for the shared GeoJSON fixture, eight TSX excerpts, eight imperative excerpts, and four equivalent Mapbox web variations. The checks supply only explicitly omitted setup and use the frozen declarations with React 19.2.3, React Native 0.87.1, and TypeScript 7.0.2. The examples remain illustrative excerpts, not assembled applications or runtime conformance evidence. Resource updates, native query scope, cluster dispatch, feature-state conversion, and image behavior still require their assigned implementation stages.

## Source components

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`ShapeSource`][rn-shape] | [`GeoJSONSource`][ml-geojson] | [`Source type="geojson"`][web-source] | `Source type="geojson"`; choose native component. |
| [`VectorSource`][rn-vector] | [`VectorSource`][ml-vector] | [`Source type="vector"`][web-source] | `Source type="vector"`; choose the native component. |
| [`RasterSource`][rn-raster] | [`RasterSource`][ml-raster] | [`Source type="raster"`][web-source] | `Source type="raster"`; choose the native component. |
| [`RasterDemSource`][rn-dem] | [`RasterDEMSource`][ml-dem] | [`Source type="raster-dem"`][web-source] | `Source type="raster-dem"`; terrain rendering is a separate capability. |
| [`ImageSource`][rn-image-source] | [`ImageSource`][ml-image-source] | [`Source type="image"`][web-source] | `Source type="image"`; common URL and four geographic corners. |
| [`RasterArraySource`][rn-array] | [No corresponding source component][ml-index] | [Mapbox entry accepts `raster-array`; MapLibre entry does not declare it][web-mapbox-style-spec] | Backend-specific source capability. |
| [No canvas/video source component][rn-index] | [No canvas/video source component][ml-index] | [Both entries accept video; only the Mapbox entry declares canvas in `SourceProps`][web-mapbox-source] | Web capabilities; do not invent native source behavior. |

An exported style-spec type does not establish runtime support. MapLibre React Native exports video and terrain specification types without equivalent source or terrain JSX components. The MapLibre web entry exports `CanvasSourceSpecification`, but its [`SourceProps`][web-source] uses a `SourceSpecification` union that excludes canvas. MapLibre GL JS itself accepts canvas in [`addSource`][sdk-maplibre-map]. **Open question:** choose and verify the MapLibre web canvas transport in its owning stage; a wrapper declaration omission is not an SDK limitation.

## Source fields

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`id` declared required, with a `ShapeSource` JSX default][rn-shape] | [`id` optional][ml-geojson] | [`id` optional][web-source] | Agreed `Source.id` is required and stable; callers supply the resource identity. |
| [`shape` object or separate `url`][rn-shape] | [`data` object or URL][ml-geojson] | [`data` object or URL][web-source] | GeoJSON `data`; split for RNMapbox. |
| [`tileUrlTemplates`, `url`][rn-vector] | [`tiles`, `url`][ml-vector] | [Style-spec `tiles`, `url`][web-source] | `tiles`, `url`; preserve TileJSON versus tile-template distinction. |
| [`minZoomLevel`, `maxZoomLevel`][rn-vector] | [`minzoom`, `maxzoom`][ml-vector] | [Style-spec `minzoom`, `maxzoom`][web-source] | `minzoom`, `maxzoom`; rename RNMapbox's fields. |
| [`tms` boolean][rn-vector] | [`scheme`: xyz or tms][ml-vector] | [Style-spec `scheme`][web-source] | `scheme`; translate tms to a boolean where needed. |
| [`tileSize` on raster source][rn-raster] | [`tileSize` on raster source][ml-raster] | [Raster source `tileSize`][web-source] | `tileSize`; preserve the name and verify source-kind support. |
| [`RasterDemSource` has no encoding, attribution, or `tms`][rn-dem] | [`encoding` and `attribution` on `RasterDEMSource`; no `scheme`][ml-dem] | [Style-spec `encoding`, `attribution`, `scheme`][web-source] | `encoding` and `attribution` portable; both throw on mapbox-native. DEM `scheme` is portable on web and throws on both native adapters. |
| [`cluster`, `clusterRadius`][rn-shape] | [`cluster`, `clusterRadius`][ml-geojson] | [GeoJSON source clustering fields][web-source] | Same names; validate engine behavior independently. |
| [`clusterMaxZoomLevel`][rn-shape] | [`clusterMaxZoom`][ml-geojson] | [GeoJSON `clusterMaxZoom`][web-source] | `clusterMaxZoom`; rename RNMapbox's field. |
| [No declared `clusterMinPoints` prop][rn-shape] | [`clusterMinPoints`][ml-geojson] | [GeoJSON `clusterMinPoints`][web-source] | Capability-gated option; reject if selected adapter cannot honor it. |
| [`clusterProperties`, `buffer`, `tolerance`, `lineMetrics`][rn-shape] | [Corresponding fields][ml-geojson] | [Style-spec fields][web-source] | Preserve names; validate expressions and binding support. |
| [No declared `generateId` / `promoteId` source props][rn-shape] | [No declared `generateId` / `promoteId` GeoJSON props][ml-geojson] | [Both renderer specifications declare `generateId` / `promoteId`][web-mapbox-style-spec] | Capability-gated; explicit feature IDs are the portable baseline. |
| [`onPress`, width/height `hitbox`][rn-shape] | [`onPress`, padding-shaped `hitbox`][ml-geojson] | [Map events and `interactiveLayerIds`][web-events] | Map `onClick` plus selected layer IDs; source touch hitboxes are an extension. |
| [`existing` can reference a style-owned source][rn-shape] | [No corresponding declared prop][ml-geojson] | [Both `Source` entries reuse a matching style source and remove it on cleanup][web-source] | Explicit ownership rules; no implicit adoption of style-owned sources. |

RNMapbox's required `id` prop annotation differs from its JSX use: `ShapeSource`, `VectorSource`, `RasterSource`, and `RasterDemSource` supply a class `defaultProps.id`, so current React declarations allow omitting it in JSX. `ImageSource` has no such default. MapLibre native and both web wrappers generate IDs when omitted. The agreed one-map-react declarations require callers to supply a stable ID for resource ownership.

`url` on a vector or raster source normally identifies TileJSON, a JSON document containing tile metadata and URL templates, whereas `tiles` supplies those templates directly. RNMapbox's [raster][rn-raster] and [DEM][rn-dem] wrappers also accept a tile-template `url` for backward compatibility and translate it to `tileUrlTemplates`; the portable proposal keeps the TileJSON/template distinction explicit. A raster digital elevation model (DEM) supplies height data for terrain or hillshade. Both native image-source props declare a URL or numeric bundled asset handle; the portable URL proposal needs host asset resolution for the numeric form. Geographic image corners are ordered top-left, top-right, bottom-right, bottom-left, as specified by [RNMapbox][rn-image-source] and [MapLibre React Native][ml-image-source]. Keep those four image corners distinct from the two camera-bound corners.

## Layer fields

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`LineLayer`, `CircleLayer`, etc.][rn-index] | [`Layer type="…"`][ml-layer] | [`Layer type="…"`][web-layer] | Generic `Layer`; native Mapbox component registry selects implementation. |
| [`style` with camelCase keys][rn-line] | [`paint`/`layout` with style-spec keys][ml-layer] | [`paint`/`layout` with style-spec keys][web-layer] | Separate `paint` and `layout`; convert for RNMapbox. |
| [`sourceID`][rn-line] | [`source`][ml-layer] | [`source`][web-layer] | `source`; rename for RNMapbox, or infer from a parent `Source`. |
| [`sourceLayerID`][rn-line] | [`"source-layer"`][ml-layer] | [`"source-layer"`][web-layer] | `"source-layer"`; name the layer inside a vector tile. |
| [`filter`][rn-line] | [`filter`][ml-layer] | [`filter`][web-layer] | `filter`; validate supported expression syntax. |
| [`minZoomLevel`, `maxZoomLevel`][rn-line] | [`minzoom`, `maxzoom`][ml-layer] | [`minzoom`, `maxzoom`][web-layer] | `minzoom`, `maxzoom`; rename RNMapbox's fields. |
| [`belowLayerID`, `aboveLayerID`, `layerIndex`][rn-line] | [`beforeId`, `afterId`, `layerIndex`][ml-layer] | [`beforeId`][web-layer] | Core `beforeId`; optional ordering extensions require stable semantics. |
| [`id` required in ordinary layer props][rn-line] | [`id` optional][ml-layer] | [`id` optional][web-layer] | Agreed `Layer.id` is required and stable; callers supply the resource identity. |

**Proposed API:** The initial portable layer set should include background, fill, line, circle, symbol, raster, heatmap, and fill-extrusion, subject to property-level validation. Hillshade and newer layer types need individual support checks. MapLibre's generic layer type is not evidence that every engine supports every field in its imported specification.

The [agreed error policy](decisions/0002-portable-contracts.md#validation-and-failures) requires `UnsupportedFeatureError` for a substantiated unavailable contract, `InvalidMapOptionError` for malformed options, `MapNotReadyError` for required map/source readiness, and `MapBackendError` for an operational failure. Pending source/layer adapter work remains an implementation status; it does not establish an SDK limitation. Filters and interactions cannot silently degrade.

RNMapbox's inspected [`Style` component][rn-style] dispatches eight layer kinds and four source kinds: vector, raster, image, and GeoJSON. It merges paint/layout into camelCase style props and translates a selected set of source options. It omits DEM and raster-array sources from that dispatch and ignores top-level fields such as sprites and glyphs. This conversion code provides prior art, but does not fulfill the whole one-map-react adapter contract.

## Drawing the same route

Use this shared GeoJSON fixture in each example:

```ts
import type { FeatureCollection } from "geojson";

const routes: FeatureCollection = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    id: "route-1",
    properties: { name: "Seattle ferry route" },
    geometry: {
      type: "LineString",
      coordinates: [[-122.34, 47.61], [-122.51, 47.62]],
    },
  }],
};
```

RNMapbox nests a typed layer inside a shape source:

```tsx
import { ShapeSource, LineLayer } from "@rnmapbox/maps";

// Inside an initialized MapView; routes is defined above.
<ShapeSource id="routes" shape={routes}>
  <LineLayer
    id="route-line"
    style={{ lineColor: "#2563eb", lineWidth: 3, lineCap: "round" }}
  />
</ShapeSource>;
```

MapLibre React Native uses a typed source and generic layer:

```tsx
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

// Inside an initialized native Map.
<GeoJSONSource id="routes" data={routes}>
  <Layer
    id="route-line"
    type="line"
    paint={{ "line-color": "#2563eb", "line-width": 3 }}
    layout={{ "line-cap": "round" }}
  />
</GeoJSONSource>;
```

react-map-gl uses generic components for both:

```tsx
import { Source, Layer } from "react-map-gl/maplibre";

// Inside an initialized web Map.
<Source id="routes" type="geojson" data={routes}>
  <Layer
    id="route-line"
    type="line"
    paint={{ "line-color": "#2563eb", "line-width": 3 }}
    layout={{ "line-cap": "round" }}
  />
</Source>;
```

The TF02 one-map-react components keep that shape for this GeoJSON line:

```tsx
import { Source, Layer } from "one-map-react";

// Inside Map with a selected adapter. Layer stays the Source child
// so the wrapper can inject source or sourceID.
<Source id="routes" type="geojson" data={routes}>
  <Layer
    id="route-line"
    type="line"
    paint={{ "line-color": "#2563eb", "line-width": 3 }}
    layout={{ "line-cap": "round" }}
  />
</Source>;
```

The MapLibre native adapter must dispatch the source type and reconcile updates and removal. The Mapbox native adapter must also choose a layer component, partition recognized style fields, and translate their names. Both preserve caller-supplied source/layer IDs. Use a schema-backed conversion registry: blindly camel-casing arbitrary keys can accept unsupported properties or miss expression, image, color, and transition conversions.

## Expressions and dynamic updates

Filters choose features; paint and layout expressions calculate their appearance. Keep expression arrays structurally intact unless a binding requires a documented conversion. Backend support depends on operator, property, renderer version, and wrapper transport. A common type must not accept the union of all vendor features and imply universal support.

Stable source and layer IDs identify owned resources. Both web entries assert unchanged source/layer IDs and types during updates, while [MapLibre React Native freezes generated or supplied IDs][ml-frozen-id]. Changing an ID or resource type should require remounting under the proposed one-map-react lifecycle rule. Preserve caller-provided GeoJSON feature IDs independently of source/layer component IDs.

The inspected react-map-gl [Mapbox][web-mapbox-source] and [MapLibre][web-source] `Source` update code calls `setData` when it detects a changed supplied GeoJSON prop; it does not apply changed clustering options or rebuild the source. The adapter must classify options as mutable or requiring recreation. A proposed one-map-react rule is to recreate a source when an immutable creation option changes, preserving child layers and reporting failures. The exact recreation sequence needs validation on native.

Both web `Layer` implementations ([Mapbox][web-mapbox-layer], [MapLibre][web-layer]) pass `undefined` to the renderer setter for paint/layout properties removed from React props. Native adapters must provide equivalent reset behavior rather than apply only the keys in the new object. Validate that an omitted `line-opacity` returns to its style default after previously being set.

These illustrative update excerpts apply the same opacity override to `route-line`. `dimmed` is boolean React state supplied by the surrounding component; change it from true to false to remove the override. Map/source setup and state initialization are omitted.

```tsx
import { LineLayer } from "@rnmapbox/maps";

// Inside MapView; dimmed is component state, source "routes" exists.
<LineLayer
  id="route-line"
  sourceID="routes"
  style={{
    lineColor: "#2563eb", lineWidth: 3,
    ...(dimmed ? { lineOpacity: 0.4 } : {}),
  }}
/>;
```

```tsx
import { Layer } from "@maplibre/maplibre-react-native";

// Inside native Map; dimmed is component state, source "routes" exists.
<Layer
  id="route-line" type="line" source="routes"
  paint={{
    "line-color": "#2563eb", "line-width": 3,
    ...(dimmed ? { "line-opacity": 0.4 } : {}),
  }}
/>;
```

```tsx
import { Layer } from "react-map-gl/maplibre";

// Inside web Map; dimmed is component state, source "routes" exists.
<Layer
  id="route-line" type="line" source="routes"
  paint={{
    "line-color": "#2563eb", "line-width": 3,
    ...(dimmed ? { "line-opacity": 0.4 } : {}),
  }}
/>;
```

```tsx
import { Layer } from "one-map-react";

// Agreed declaration; adapter reset behavior remains to be verified.
// Inside Map; dimmed is component state, source "routes" exists.
<Layer
  id="route-line" type="line" source="routes"
  paint={{
    "line-color": "#2563eb", "line-width": 3,
    ...(dimmed ? { "line-opacity": 0.4 } : {}),
  }}
/>;
```

Matching declarations do not prove matching removal behavior. The RNMapbox adapter must translate the key and restore the default when it disappears; the MapLibre native adapter must verify its wrapper's update behavior. A renderer observation after the update must establish that the override is gone. Sending only the new object's keys can leave the old opacity in place.

**Agreed design:** Track owned resources in a registry, consistent with the [ownership decision](decisions/0001-baselines-and-ownership.md). **Open question:** Verify the rebuild sequence for owned sources, layers, and images after style readiness and remove layers before their source. Both web `Source` wrappers look up an existing source by ID and, during cleanup, remove every style layer referring to that source before removing it. The one-map-react ownership check must prevent an ID collision from adopting or deleting unrelated style resources. Style replacement and cleanup need renderer observations; this source review does not establish the adapter implementation.

## Querying rendered features

Rendered queries answer which features intersect a screen position in the current rendered map. Source queries answer a different question and may operate on loaded tiles. They are not a guarantee of retrieving an entire remote dataset.

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`queryRenderedFeaturesAtPoint(point, filter, layerIDs)`][rn-map] | [`queryRenderedFeatures(point, options)`][ml-map] | [Forwarded `queryRenderedFeatures`][web-ref] | `queryRenderedFeatures(point, options): Promise<readonly Feature[]>`; normalize async results. |
| [`queryRenderedFeaturesInRect` with top/left/bottom/right][rn-map] | [Screen-corner pair `PixelPointBounds`][ml-pixel-bounds] | [Screen-corner pair accepted by GL JS][web-ref] | Screen bounds `[[left, top], [right, bottom]]`; convert explicitly. |
| [Promise of `FeatureCollection`, possibly undefined][rn-map] | [Promise of `Feature[]`][ml-map] | [Synchronous `Feature[]`][web-ref] | Promise of `Feature[]`; malformed/absent native results reject. |
| [`querySourceFeatures(sourceId, filter, sourceLayerIDs)`][rn-map] | [`VectorSourceRef.querySourceFeatures`][ml-vector]; [GeoJSON `getData`][ml-geojson] | [Map source queries][web-ref] | Map-level loaded-tile source query; preserve hidden features, clipping, and duplicates. |
| [Expansion takes a string or feature; leaves/children take a number or feature][rn-shape] | [Cluster methods accept numeric cluster ID][ml-geojson] | [Mapbox callback methods][sdk-mapbox-geojson]; [MapLibre promises][sdk-maplibre-geojson] | Promise-based cluster methods identified by source and cluster ID; resolve native signature differences explicitly. |

These excerpts query the route layer at screen point `[240, 320]`. Refs refer to initialized maps; source setup is omitted.

```ts
// RNMapbox MapView ref.
const collection = await map.queryRenderedFeaturesAtPoint(
  [240, 320], [], ["route-line"],
);
if (!collection) throw new Error("Missing native query result");
const features = collection.features;
```

```ts
// MapLibre React Native MapRef.
const features = await map.queryRenderedFeatures(
  [240, 320], { layers: ["route-line"] },
);
```

```ts
// react-map-gl MapRef.
const features = map.queryRenderedFeatures(
  [240, 320], { layers: ["route-line"] },
);
```

```ts
// Agreed one-map-react declaration; adapter query behavior remains unfinished.
const features = await map.queryRenderedFeatures(
  [240, 320], { layers: ["route-line"] },
);
```

The one-map-react point is in logical map-view units, not longitude/latitude. Normalize results to GeoJSON features plus defined optional rendered metadata; do not expose SDK-bound classes. Preserve rejection for an unsupported filter or native query failure. An empty array means a successful query with no matches.

A source registry lets common map methods find native source refs. Inspection of pinned MapLibre React Native 11.5.0 shows that GeoJSON [`getData`][ml-geojson] calls Android `querySourceFeatures(filter)` and iOS `featuresMatchingPredicate:`. It queries loaded source tiles, including hidden features, with possible clipping and duplicates. TF06 retains this path and adds filter and far-away-feature assertions. The corrected TF06 scenario passed in all six environments on its recorded artifact; the later vector lifetime and keyed source-family scenario passed in all four native environments, including fresh iOS builds for both engines. See the [TF06 record](tf06-queries.md) for artifact hashes, scenario scope, and outcomes. These assertions establish the tested behavior rather than full equivalence of every query result across renderers.

For clustering, the proposed map methods are `getClusterExpansionZoom(sourceId, clusterId)`, `getClusterLeaves(sourceId, clusterId, limit, offset)`, and `getClusterChildren(sourceId, clusterId)`. Expansion returns a promise of a zoom number; the other methods return promises of feature arrays. Cluster IDs are generated by the source and can change after a data update.

RNMapbox's TypeScript signatures differ between expansion and the other methods. An adapter may need a cluster feature from a query rather than cast a numeric ID to a string and assume equivalence. RNMapbox documents collection results for leaves/children, but its TypeScript implementation describes the native payload as a string and parses it only on Android; the actual result shape needs platform verification before collection-to-array normalization. MapLibre React Native declares numeric IDs and promises of arrays. At the frozen renderer pins, [Mapbox GL JS 3.32.0][sdk-mapbox-geojson] takes callbacks and returns the source object, while [MapLibre GL JS 6.13.0][sdk-maplibre-geojson] returns promises directly. The web adapter must wrap Mapbox callbacks and preserve callback errors. **Open question:** verify native expansion dispatch, cluster IDs after data replacement, and leaves/children result shapes on both native platforms.

## Feature state

Feature state is runtime data associated with an identified feature, often used to style selection without replacing the source. It requires stable IDs; component IDs and cluster IDs are not substitutes for feature IDs.

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`setFeatureState(id, state, source, sourceLayer?)`][rn-map] | [`setFeatureState({id}, state)` on a source ref][ml-geojson] | [Map `setFeatureState({source, id, sourceLayer?}, state)`][web-ref] | Map method with web identifier object, returning a promise. |
| [`getFeatureState`: promise][rn-map] | [Promise; no state may yield null][ml-geojson] | [Synchronous state object][web-ref] | `getFeatureState`: promise; absent state normalizes to `{}`. |
| [`removeFeatureState(id, key, source, sourceLayer?)`][rn-map] | [Source ref removal; documented for the next rendered frame][ml-geojson] | [Map removal method][web-ref] | `removeFeatureState(identifier, key?)`; promise acknowledges dispatch. |

The same selection update uses different ref organization and argument order:

```ts
// RNMapbox MapView ref.
await map.setFeatureState("route-1", { selected: true }, "routes");
```

```ts
// MapLibre React Native GeoJSONSourceRef for routes.
await source.setFeatureState({ id: "route-1" }, { selected: true });
```

```ts
// react-map-gl MapRef.
map.setFeatureState(
  { source: "routes", id: "route-1" }, { selected: true },
);
```

```ts
// Agreed one-map-react declaration; adapter feature-state behavior remains unfinished.
await map.setFeatureState(
  { source: "routes", id: "route-1" }, { selected: true },
);
```

The adapter must convert identifiers and route MapLibre calls to registered source refs. The agreed portable feature-state contract uses stable string IDs and JSON values without null, undefined, or non-finite numbers. MapLibre React Native's [current source documentation][ml-geojson] states that null-valued object keys, including nested keys, are dropped while null array elements remain. This review establishes that documented upstream contract, not identical native conversion observations on both platforms. RNMapbox's native argument conversion also needs value validation. Use `removeFeatureState` to remove a key rather than treating null as deletion. Numeric ID normalization and richer values require an explicit tested extension.

MapLibre declares feature-state methods in the inspected [11.5.0 source][ml-geojson]. Its documented removals apply on the next rendered frame, so awaiting the call does not guarantee immediate read-after-removal consistency or a completed repaint. Define stronger guarantees separately if needed. The historical [portable-defaults decision](decisions/0001-baselines-and-ownership.md#accepted-portable-defaults) required reset after source recreation or style replacement. The next-release [renderer-owned lifetime contract](revised-api-proposal.md#camera-and-feature-state-guarantees) supersedes that requirement: explicit operations retain validation and errors, while applications clear or reapply desired state after source attachment and readiness. Same-ID remounts and style changes add no automatic reset, replay, queue, or transaction guarantee. U09 migration is implemented and audited; its [evidence record](../records/evidence/revised-api-u09-feature-state.json) separates routine verification from unverified renderer acceptance.

## Images and advanced rendering

| RNMapbox | MapLibre React Native | react-map-gl | Proposed one-map-react API |
| --- | --- | --- | --- |
| [`Images`, native assets, `Image` component][rn-images] | [`Images`, consolidated entries, missing-image event][ml-images] | [Map image methods and style-image events][web-ref] | `Images` convenience component; portable URL entries and explicit asset extensions. |
| [`Terrain`, `Light`, `Atmosphere`, weather components][rn-index] | [Map `light` prop][ml-map] and [exported terrain/sky specification types][ml-index] | [Mapbox][web-mapbox-props] / [MapLibre][web-props] terrain/light props and SDK methods | Capability-specific configuration; no blanket field-equivalence claim. |
| [`ModelLayer`, `Models`, `RasterParticleLayer`, `SkyLayer`][rn-index] | [Different generic style-spec surface][ml-layer] | [Generic layers with backend-specific types][web-layer] | Advanced layer/model capabilities, outside the initial common layer set. |

Image registration must wait for style readiness, handle asset resolution on each host, remove owned images, and re-register after style changes. Native bundled image handles are not browser URLs. A URL-based core can be portable while asset loading remains host-specific.

See [maps and camera](maps-and-camera.md) for readiness and coordinate contracts, [markers](markers-and-controls.md) for point-display choices, and [capabilities](capabilities-and-extensions.md) for requests outside the portable source/layer subset.

[ml-dem]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/sources/raster-dem-source/RasterDEMSource.tsx
[ml-geojson]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/sources/geojson-source/GeoJSONSource.tsx
[ml-image-source]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/sources/image-source/ImageSource.tsx
[ml-images]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/images/Images.tsx
[ml-index]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/index.ts
[ml-layer]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/layer/Layer.tsx
[ml-map]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/map/Map.tsx
[ml-pixel-bounds]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/types/PixelPointBounds.ts
[ml-raster]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/sources/raster-source/RasterSource.tsx
[ml-vector]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/components/sources/vector-source/VectorSource.tsx
[rn-array]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/RasterArraySource.tsx
[rn-dem]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/RasterDemSource.tsx
[rn-image-source]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/ImageSource.tsx
[rn-images]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/Images.tsx
[rn-index]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/Mapbox.native.ts
[rn-line]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/LineLayer.tsx
[rn-map]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/MapView.tsx
[rn-raster]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/RasterSource.tsx
[rn-shape]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/ShapeSource.tsx
[rn-style]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/Style.tsx
[rn-vector]: https://github.com/rnmapbox/maps/blob/0f50e8164c1aefe45de9ed9cde310f310076a310/src/components/VectorSource.tsx
[web-events]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/types/events.ts
[web-index]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/index.ts
[web-layer]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/layer.ts
[web-mapbox-source]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/components/source.ts
[web-props]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/maplibre/maplibre.ts
[web-ref]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/maplibre/create-ref.ts
[web-source]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/components/source.ts

[web-mapbox-index]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/index.ts
[web-mapbox-style-spec]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/types/style-spec.ts
[web-mapbox-layer]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/components/layer.ts
[web-mapbox-props]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-mapbox/src/mapbox/mapbox.ts
[web-maplibre-style-spec]: https://github.com/visgl/react-map-gl/blob/3df834290bdecf4f5c9b90d7c117d95af12c1f0a/modules/react-maplibre/src/types/style-spec.ts
[ml-frozen-id]: https://github.com/maplibre/maplibre-react-native/blob/059f46b2dc728fb6259af91b27a071bcda19a2ae/package/src/hooks/useFrozenId.ts
[sdk-mapbox-map]: https://github.com/mapbox/mapbox-gl-js/blob/v3.32.0/src/ui/map.ts
[sdk-maplibre-map]: https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/map.ts
[sdk-mapbox-geojson]: https://github.com/mapbox/mapbox-gl-js/blob/v3.32.0/src/source/geojson_source.ts
[sdk-maplibre-geojson]: https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts
