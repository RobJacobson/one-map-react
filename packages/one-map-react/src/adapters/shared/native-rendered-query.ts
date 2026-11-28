import type { NativeMapRef } from "../../contracts/native-types.js";
import type { QueryRenderedFeaturesOptions } from "../../contracts/query-types.js";
import { featuresFromWrapper } from "./feature-values.js";
import { copyNativeStringArray, pointFromWrapper } from "./wrapper-values.js";

type RenderedQuery = NativeMapRef["queryRenderedFeatures"];
type QueryPoint = ReturnType<typeof pointFromWrapper>;
type QueryBounds = [QueryPoint, QueryPoint];
type RenderedQueryTarget = QueryPoint | QueryBounds | undefined;

/**
 * Creates a rendered query that validates its target, checks attachment, and
 * normalizes the selected backend's result.
 *
 * @param getMap - Resolves the current wrapper or throws on a detached map.
 * @param dispatch - Converts and runs the selected wrapper query.
 * @returns The native rendered-query method, which dispatches before yielding.
 */
export const createNativeRenderedQuery =
  <Map>(
    getMap: () => Map,
    dispatch: (
      map: Map,
      query: {
        target: RenderedQueryTarget;
        options: QueryRenderedFeaturesOptions | undefined;
        layers: string[] | undefined;
      }
    ) => Promise<unknown>
  ): RenderedQuery =>
  async (input, queryOptions) => {
    const [target, options] = nativeRenderedQuery(input, queryOptions);
    const map = getMap();
    const requestedLayers = options?.layers;
    let layers: string[] | undefined;
    if (requestedLayers !== undefined) {
      layers = copyNativeStringArray(requestedLayers);
      // Both wrappers treat an empty layer list as all layers.
      if (layers.length === 0) return [];
    }

    return featuresFromWrapper(
      await dispatch(map, { target, options, layers }),
      "queryRenderedFeatures"
    );
  };

/**
 * Reads the rendered-query overload and validates its coordinates.
 *
 * @param target - A point, screen rectangle, options object, or omitted viewport.
 * @param options - Layer ids and filter for the geometry form.
 * @returns Fresh mutable coordinates in logical map-view units and query options.
 * @throws When the target has an invalid shape or coordinates lack a finite x or y value.
 */
export const nativeRenderedQuery = (
  target?: Parameters<RenderedQuery>[0],
  options?: QueryRenderedFeaturesOptions
): readonly [RenderedQueryTarget, QueryRenderedFeaturesOptions | undefined] => {
  if (target === undefined) return [undefined, options];
  if (target === null || typeof target !== "object") {
    throw new TypeError(
      "A rendered query target must be a point, rectangle, or options object."
    );
  }
  if ("x" in target) return [pointFromWrapper(target), options];
  if (Array.isArray(target)) {
    const { length } = target;
    const first: unknown = target[0];
    if (typeof first === "number") {
      return [pointFromWrapper(target, first), options];
    }
    if (length !== 2) {
      throw new TypeError(
        "A rendered query rectangle must contain exactly two corners."
      );
    }
    return [[pointFromWrapper(first), pointFromWrapper(target[1])], options];
  }
  if ("y" in target) return [pointFromWrapper(target), options];
  return [undefined, target as QueryRenderedFeaturesOptions];
};

/**
 * Detects a two-corner rectangle in a normalized rendered query.
 *
 * @param target - Normalized point, screen rectangle, or omitted viewport.
 * @returns `true` when the target contains mutable screen corners.
 */
export const isScreenBounds = (
  target: RenderedQueryTarget
): target is QueryBounds => target !== undefined && Array.isArray(target[0]);
