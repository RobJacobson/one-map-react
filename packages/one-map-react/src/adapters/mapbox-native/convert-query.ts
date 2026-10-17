import type { Feature, Point as GeoJsonPoint } from "geojson";

import type { Point } from "../../contracts/camera-types.js";
import type {
  FeatureIdentifier,
  QueryRenderedFeaturesOptions,
  QuerySourceFeaturesOptions,
  ScreenBounds,
} from "../../contracts/query-types.js";
import { isScreenBounds, toRnmapboxRect } from "../shared/feature-values.js";

/**
 * Selects the RNMapbox rendered-query call for a target.
 *
 * @remarks
 * RNMapbox splits rendered queries by geometry: a point queries
 * `queryRenderedFeaturesAtPoint`, a rect queries
 * `queryRenderedFeaturesInRect` with `[top, left, bottom, right]`, and the
 * viewport passes the empty rect the wrapper documents for the whole
 * visible area.
 *
 * @param target - Point, screen bounds, or `undefined` for the viewport.
 * @returns The wrapper geometry, `null` for a point call, or the rect.
 */
export const toRnmapboxQueryRect = (
  target: Point | ScreenBounds | undefined
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
    return { kind: "point", point: [target[0], target[1]] };
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
  options?.layers === undefined ? [] : options.layers.map((id) => id),
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
 * Reads the state key argument for RNMapbox `removeFeatureState`.
 *
 * @remarks
 * The wrapper takes `null` to remove the whole state.
 *
 * @param key - State key to remove, when the caller passed one.
 * @returns The key, or `null` for the whole state.
 */
export const toRnmapboxStateKey = (key: string | undefined): string | null =>
  key === undefined ? null : key;

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
