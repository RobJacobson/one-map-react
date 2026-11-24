import type { Bounds, LngLat, Point } from "../../contracts/camera-types.js";
import type {
  NativeBounds,
  NativeBoundsLike,
  NativeClickEvent,
  NativeLngLat,
  NativePoint,
  NativePointLike,
} from "../../contracts/native-types.js";
import type { QueryRenderedFeaturesOptions } from "../../contracts/query-types.js";
import { featuresFromWrapper } from "./feature-values.js";
import {
  boundsFromGeographic,
  copyNativeStringArray,
  lngLatFromWrapper,
  pointFromWrapper,
} from "./wrapper-values.js";

/** Adds desktop fields without changing legacy tuple enumeration or serialization. */
export const nativeLngLat = (coordinate: LngLat): NativeLngLat => {
  const [lng, lat] = coordinate;
  return Object.defineProperties([lng, lat], {
    lng: { value: lng },
    lat: { value: lat },
  }) as unknown as NativeLngLat;
};

export const nativePoint = (point: Point): NativePoint => {
  const [x, y] = point;
  return Object.defineProperties([x, y], {
    x: { value: x },
    y: { value: y },
  }) as unknown as NativePoint;
};

export const nativeBounds = (bounds: Bounds): NativeBounds => {
  const [[west, south], [east, north]] = bounds;
  return Object.defineProperties(
    [
      [west, south],
      [east, north],
    ],
    {
      getWest: { value: () => west },
      getSouth: { value: () => south },
      getEast: { value: () => east },
      getNorth: { value: () => north },
      getSouthWest: { value: () => nativeLngLat([west, south]) },
      getNorthEast: { value: () => nativeLngLat([east, north]) },
      getNorthWest: { value: () => nativeLngLat([west, north]) },
      getSouthEast: { value: () => nativeLngLat([east, south]) },
      getCenter: {
        value: () => nativeLngLat([(west + east) / 2, (south + north) / 2]),
      },
      toArray: {
        value: () => [
          [west, south],
          [east, north],
        ],
      },
    }
  ) as unknown as NativeBounds;
};

export const nativeBoundsInput = (bounds: NativeBoundsLike): Bounds =>
  Array.isArray(bounds) && bounds.length === 2
    ? [lngLatFromWrapper(bounds[0]), lngLatFromWrapper(bounds[1])]
    : boundsFromGeographic(bounds);

export const nativeClick = (
  lngLat: LngLat,
  point: Point,
  features?: readonly object[]
): NativeClickEvent => ({
  lngLat: nativeLngLat(lngLat),
  point: nativePoint(point),
  ...(features === undefined
    ? {}
    : { features: featuresFromWrapper(features, "Map press") }),
});

type RenderedTarget =
  | NativePointLike
  | readonly [NativePointLike, NativePointLike]
  | QueryRenderedFeaturesOptions;

type QueryPoint = ReturnType<typeof pointFromWrapper>;
type QueryBounds = [QueryPoint, QueryPoint];

/** A normalized screen point, screen rectangle, or omitted viewport target. */
export type NativeQueryTarget = QueryPoint | QueryBounds | undefined;

/**
 * Reads the rendered-query overload and validates its coordinates.
 *
 * @param target - A point, screen rectangle, options object, or omitted viewport.
 * @param options - Layer ids and filter for the geometry form.
 * @returns Fresh mutable coordinates in logical map-view units and query options.
 * @throws When the target has an invalid shape or coordinates lack a finite x or y value.
 */
export const nativeRenderedQuery = (
  target?: RenderedTarget,
  options?: QueryRenderedFeaturesOptions
): readonly [NativeQueryTarget, QueryRenderedFeaturesOptions | undefined] => {
  if (target === undefined) return [undefined, options];
  if (
    target === null ||
    (typeof target !== "object" && typeof target !== "function")
  ) {
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
  return [undefined, target as QueryRenderedFeaturesOptions];
};

/**
 * Snapshots the layer selection for the empty check and the wrapper call.
 *
 * @param options - Resolved rendered query options.
 * @returns Copied layer ids, `undefined` for all layers, or `null` for no layers.
 * @throws TypeError when the supplied layer selection is not an array.
 */
export const prepareNativeRenderedQueryLayers = (
  options: QueryRenderedFeaturesOptions | undefined
): string[] | null | undefined => {
  const layers = options?.layers;
  if (layers === undefined) return undefined;

  const selection = copyNativeStringArray(layers);
  // Both wrappers treat an empty layer list as all layers.
  return selection.length === 0 ? null : selection;
};

/**
 * Detects a two-corner rectangle in a normalized rendered query.
 *
 * @param target - Normalized point, screen rectangle, or omitted viewport.
 * @returns `true` when the target contains mutable screen corners.
 */
export const isScreenBounds = (
  target: NativeQueryTarget
): target is QueryBounds => target !== undefined && Array.isArray(target[0]);
