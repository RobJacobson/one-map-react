import type { FilterSpecification } from "@maplibre/maplibre-react-native";

import type { FilterExpression } from "../../contracts/layer-types.js";
import type {
  QueryRenderedFeaturesOptions,
  QuerySourceFeaturesOptions,
} from "../../contracts/query-types.js";
import { requireSourceLayerName } from "../shared/feature-values.js";

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
 * @param options - Resolved query options supplying the filter.
 * @param layers - Copied layer selection for the query.
 * @returns Options for the wrapper call.
 */
export const toMaplibreRenderedQueryOptions = (
  options: Pick<QueryRenderedFeaturesOptions, "filter"> | undefined,
  layers: string[] | undefined
): { layers?: string[]; filter?: FilterSpecification } | undefined => {
  if (options === undefined) return undefined;

  return {
    ...(layers === undefined ? {} : { layers }),
    ...filterOption(options.filter),
  };
};

/**
 * Converts common source-query options into wrapper `querySourceFeatures`
 * options.
 *
 * @param options - Source layer and filter.
 * @returns Options with the required `sourceLayer`.
 * @throws When `sourceLayer` is missing or is not a nonempty string.
 */
export const toMaplibreSourceQueryOptions = (
  options?: QuerySourceFeaturesOptions
): { sourceLayer: string; filter?: FilterSpecification } => {
  const sourceLayer = options?.sourceLayer;
  if (sourceLayer === undefined) {
    throw new Error(
      "querySourceFeatures needs sourceLayer on maplibre-native. The pinned vector wrapper requires it."
    );
  }

  return {
    sourceLayer: requireSourceLayerName(sourceLayer),
    ...filterOption(options?.filter),
  };
};

const filterOption = (filter: FilterExpression | undefined) =>
  filter === undefined ? {} : { filter: toMaplibreFilter(filter) };
