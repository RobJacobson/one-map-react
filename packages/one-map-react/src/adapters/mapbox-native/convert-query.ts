import type { Feature, Point as GeoJsonPoint } from "geojson";

import type { FilterExpression } from "../../contracts/layer-types.js";
import type {
  QueryRenderedFeaturesOptions,
  QuerySourceFeaturesOptions,
  ScreenBounds,
} from "../../contracts/query-types.js";

/**
 * Reads the query options the RNMapbox rendered-query calls share.
 *
 * @param options - Resolved query options supplying the filter.
 * @param layers - Copied layer selection for the query.
 * @returns The filter and layer id arguments for the wrapper call.
 */
export const toRnmapboxRenderedQueryArgs = (
  options: Pick<QueryRenderedFeaturesOptions, "filter"> | undefined,
  layers: string[] | undefined
): readonly [filter: unknown[], layers: string[]] => [
  copyFilter(options?.filter),
  layers ?? [],
];

/**
 * Reads the source-layer list for RNMapbox `querySourceFeatures`.
 *
 * @param options - Source layer and filter.
 * @returns The filter and source-layer id arguments for the wrapper call.
 */
export const toRnmapboxSourceQueryArgs = (
  options?: QuerySourceFeaturesOptions
): readonly [filter: unknown[], sourceLayerIds: string[]] => {
  const filter = copyFilter(options?.filter);
  const sourceLayer = options?.sourceLayer;
  return [filter, sourceLayer === undefined ? [] : [sourceLayer]];
};

/**
 * Wraps a numeric cluster id in the Point feature RNMapbox expects.
 *
 * @param clusterId - Renderer cluster id.
 * @returns A cluster feature for the three ShapeSource cluster methods.
 */
export const toRnmapboxClusterFeature = (
  clusterId: number
): Feature<GeoJsonPoint> => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [0, 0] },
  properties: { cluster: true, cluster_id: clusterId },
});

/**
 * Converts screen corners into RNMapbox's `[top, left, bottom, right]` rect.
 *
 * RNMapbox documents the rect as `[minY, minX, maxY, maxX]`, which is the
 * common top-left/bottom-right corner order with each corner flattened.
 *
 * @param bounds - Top-left then bottom-right corners.
 * @returns A mutable four-number rect for the wrapper call.
 */
export const toRnmapboxRect = (bounds: ScreenBounds): number[] => [
  bounds[0][1],
  bounds[0][0],
  bounds[1][1],
  bounds[1][0],
];

const copyFilter = (filter: FilterExpression | undefined) =>
  filter === undefined ? [] : [...filter];
