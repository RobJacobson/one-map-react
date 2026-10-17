import type {
  FeatureIdentifier,
  QueryRenderedFeaturesOptions,
  QuerySourceFeaturesOptions,
} from "../../contracts/query-types.js";

/**
 * Converts common rendered-query options into wrapper parameters.
 *
 * @param options - Layer ids and filter.
 * @returns Parameters for the wrapper call, or `undefined` when empty.
 */
export const toWebRenderedQueryOptions = (
  options?: QueryRenderedFeaturesOptions
): object | undefined => {
  if (options === undefined) {
    return undefined;
  }

  return {
    ...(options.layers === undefined
      ? {}
      : { layers: options.layers.map((id) => id) }),
    ...(options.filter === undefined ? {} : { filter: options.filter }),
  };
};

/**
 * Converts common source-query options into wrapper parameters.
 *
 * @param options - Source layer and filter.
 * @returns Parameters for the wrapper call.
 */
export const toWebSourceQueryOptions = (
  options?: QuerySourceFeaturesOptions
): object | undefined => ({
  ...(options?.sourceLayer === undefined
    ? {}
    : { sourceLayer: options.sourceLayer }),
  ...(options?.filter === undefined ? {} : { filter: options.filter }),
});

/**
 * Converts a common feature identifier into the web target object.
 *
 * @remarks
 * The readonly identifier crosses into the renderer's mutable object type;
 * values are not modified.
 *
 * @param identifier - Source, feature id, and optional vector source layer.
 * @returns The `{ source, id, sourceLayer? }` target both renderers take.
 */
export const toWebFeatureTarget = (
  identifier: FeatureIdentifier
): Record<string, unknown> => ({
  source: identifier.source,
  id: identifier.id,
  ...(identifier.sourceLayer === undefined
    ? {}
    : { sourceLayer: identifier.sourceLayer }),
});
