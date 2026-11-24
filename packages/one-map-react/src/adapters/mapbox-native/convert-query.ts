import type { Feature, Point as GeoJsonPoint } from "geojson";

import type {
  QueryRenderedFeaturesOptions,
  QuerySourceFeaturesOptions,
} from "../../contracts/query-types.js";
import { toRnmapboxRect } from "../shared/feature-values.js";
import { isScreenBounds, type NativeQueryTarget } from "../shared/index.js";

/**
 * Selects the RNMapbox rendered-query call for a target.
 *
 * RNMapbox splits rendered queries by geometry: a point queries
 * `queryRenderedFeaturesAtPoint`, a rect queries
 * `queryRenderedFeaturesInRect` with `[top, left, bottom, right]`, and the
 * viewport passes the empty rect the wrapper documents for the whole
 * visible area.
 *
 * @param target - Point, screen bounds, or `undefined` for the viewport.
 * @returns The wrapper point or rectangle argument, including an empty viewport rect.
 */
export const toRnmapboxQueryRect = (
  target: NativeQueryTarget
):
  | { readonly kind: "point"; readonly point: number[] }
  | {
      readonly kind: "rect";
      readonly rect: number[];
    } => {
  if (target === undefined) {
    return { kind: "rect", rect: [] };
  }

  if (!isScreenBounds(target)) {
    return { kind: "point", point: target };
  }

  return { kind: "rect", rect: toRnmapboxRect(target) };
};

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
  options?.filter === undefined ? [] : [...options.filter],
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
): readonly [filter: unknown[], sourceLayerIds: string[]] => [
  options?.filter === undefined ? [] : [...options.filter],
  options?.sourceLayer === undefined ? [] : [options.sourceLayer],
];

/**
 * Wraps a numeric cluster id in the Point feature RNMapbox expects.
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
