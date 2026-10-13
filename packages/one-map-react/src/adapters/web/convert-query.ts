import type { Point } from "../../contracts/camera-types.js";
import type {
  FeatureIdentifier,
  QueryRenderedFeaturesOptions,
  QuerySourceFeaturesOptions,
  ScreenBounds,
} from "../../contracts/query-types.js";
import { isScreenBounds } from "../shared/feature-values.js";

/**
 * Converts a common query target into a react-map-gl geometry argument.
 *
 * `undefined` stays `undefined`: both web renderers substitute the visible
 * viewport when no geometry is passed. A point stays `[x, y]`; a bounds
 * pair is copied into the mutable corner pair the renderers accept.
 *
 * @param target - Point, screen bounds, or `undefined` for the viewport.
 * @returns The geometry argument for the wrapper call.
 * @throws When a corner is missing.
 */
export const toWebQueryGeometry = (
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
