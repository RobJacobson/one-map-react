import type { Bounds, LngLat, Point } from "../../contracts/camera-types.js";
import type {
  NativeBounds,
  NativeBoundsLike,
  NativeClickEvent,
  NativeLngLat,
  NativePoint,
  NativePointLike,
} from "../../contracts/native-types.js";
import type {
  QueryRenderedFeaturesOptions,
  ScreenBounds,
} from "../../contracts/query-types.js";
import { featuresFromWrapper } from "./feature-values.js";
import {
  boundsFromGeographic,
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

export const nativeRenderedQuery = (
  target?: RenderedTarget,
  options?: QueryRenderedFeaturesOptions
): readonly [
  Point | ScreenBounds | undefined,
  QueryRenderedFeaturesOptions | undefined,
] => {
  if (target === undefined) return [undefined, options];
  if ("x" in target) return [pointFromWrapper(target), options];
  if (Array.isArray(target)) {
    if (typeof target[0] === "number")
      return [pointFromWrapper(target), options];
    return [
      [pointFromWrapper(target[0]), pointFromWrapper(target[1])],
      options,
    ];
  }
  return [undefined, target as QueryRenderedFeaturesOptions];
};
