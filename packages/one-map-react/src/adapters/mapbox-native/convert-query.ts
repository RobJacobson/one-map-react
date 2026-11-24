import type { Feature, Point as GeoJsonPoint } from "geojson";

import type {
  FeatureIdentifier,
  QueryRenderedFeaturesOptions,
  QuerySourceFeaturesOptions,
  ScreenBounds,
} from "../../contracts/query-types.js";
import {
  isScreenBounds,
  type NativeQueryTarget,
} from "../shared/native-values.js";
import { copyNativeStringArray } from "../shared/wrapper-values.js";

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
 * @param options - Layer ids and filter.
 * @returns The filter and layer id arguments for the wrapper call.
 */
export const toRnmapboxRenderedQueryArgs = (
  options?: QueryRenderedFeaturesOptions
): readonly [filter: unknown[], layers: string[]] => [
  options?.filter === undefined ? [] : [...options.filter],
  options?.layers === undefined ? [] : copyNativeStringArray(options.layers),
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
 * Converts a feature identifier into RNMapbox's positional arguments.
 *
 * @param identifier - Source, feature id, and optional vector source layer.
 * @returns Feature id, source id, and source layer id for the wrapper call.
 */
export const toRnmapboxFeatureArgs = (
  identifier: FeatureIdentifier
): readonly [
  featureId: string,
  sourceId: string,
  sourceLayerId: string | null,
] => [
  String(identifier.id),
  identifier.source,
  identifier.sourceLayer === undefined ? null : identifier.sourceLayer,
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

/**
 * Converts screen corners into RNMapbox's `[top, left, bottom, right]` rect.
 *
 * RNMapbox documents the rect as `[minY, minX, maxY, maxX]`, which is the
 * common top-left/bottom-right corner order with each corner flattened.
 *
 * @param bounds - Top-left then bottom-right corners.
 * @returns A mutable four-number rect for the wrapper call.
 */
const toRnmapboxRect = (bounds: ScreenBounds): number[] => [
  bounds[0][1],
  bounds[0][0],
  bounds[1][1],
  bounds[1][0],
];
