import type { FilterSpecification } from "@maplibre/maplibre-react-native";

import type { Point } from "../../contracts/camera-types.js";
import type { FilterExpression } from "../../contracts/layer-types.js";
import type {
  FeatureIdentifier,
  QueryRenderedFeaturesOptions,
  QuerySourceFeaturesOptions,
  ScreenBounds,
} from "../../contracts/query-types.js";
import { isScreenBounds } from "../shared/feature-values.js";

/**
 * Converts a query filter into MapLibre React Native's filter value.
 *
 * The wrapper forwards the filter to the native module without
 * interpretation. The facade's readonly expression is copied.
 *
 * @param filter - Filter expression, when the caller passed one.
 * @returns A mutable array for the wrapper call.
 */
export const toMaplibreFilter = (
  filter: FilterExpression | undefined
): FilterSpecification | undefined =>
  filter === undefined ? undefined : ([...filter] as FilterSpecification);

/**
 * Converts common rendered-query options into wrapper options.
 *
 * @param options - Layer ids and filter.
 * @returns Options for the wrapper call.
 */
export const toMaplibreRenderedQueryOptions = (
  options?: QueryRenderedFeaturesOptions
): Record<string, unknown> | undefined =>
  options === undefined
    ? undefined
    : {
        ...(options.layers === undefined
          ? {}
          : { layers: options.layers.map((id) => id) }),
        ...(options.filter === undefined
          ? {}
          : { filter: toMaplibreFilter(options.filter) }),
      };

/**
 * Converts a query target into the wrapper argument.
 *
 * A point stays `[x, y]`; a bounds pair becomes the wrapper's
 * `[[left, top], [right, bottom]]` corner pair; `undefined` omits the
 * argument so the wrapper queries the visible viewport.
 *
 * @param target - Point, screen bounds, or `undefined` for the viewport.
 * @returns The pixel point, pixel bounds, or `undefined`.
 */
export const toMaplibreQueryTarget = (
  target: Point | ScreenBounds | undefined
): unknown => {
  if (target === undefined) {
    return undefined;
  }

  if (!isScreenBounds(target)) {
    return [target[0], target[1]];
  }

  return [
    [target[0][0], target[0][1]],
    [target[1][0], target[1][1]],
  ];
};

/**
 * Converts common source-query options into wrapper `querySourceFeatures`
 * options.
 *
 * @param options - Source layer and filter.
 * @returns Options with the required `sourceLayer`.
 * @throws When `sourceLayer` is missing; the vector wrapper requires it.
 */
export const toMaplibreSourceQueryOptions = (
  options?: QuerySourceFeaturesOptions
): { sourceLayer: string; filter?: FilterSpecification } => {
  if (options?.sourceLayer === undefined) {
    throw new Error(
      "querySourceFeatures needs sourceLayer on maplibre-native. The pinned vector wrapper requires it."
    );
  }

  return {
    sourceLayer: options.sourceLayer,
    ...(options.filter === undefined
      ? {}
      : { filter: toMaplibreFilter(options.filter) }),
  };
};

/**
 * Converts a feature identifier into the GeoJSON ref feature argument.
 *
 * @param identifier - Source, feature id, and optional vector source layer.
 * @returns The `{ id }` argument the source refs take.
 */
export const toMaplibreFeatureId = (
  identifier: FeatureIdentifier
): { id: string | number } => ({ id: identifier.id });

/**
 * Converts a feature identifier into the vector ref feature argument.
 *
 * @param identifier - Source, feature id, and vector source layer.
 * @returns The `{ id, sourceLayer }` argument the vector ref takes.
 * @throws When `sourceLayer` is missing; the vector ref requires it.
 */
export const toMaplibreVectorFeature = (
  identifier: FeatureIdentifier
): { id: string | number; sourceLayer: string } => {
  if (identifier.sourceLayer === undefined) {
    throw new Error(
      "Feature-state methods need sourceLayer for vector sources on maplibre-native."
    );
  }

  return { id: identifier.id, sourceLayer: identifier.sourceLayer };
};
