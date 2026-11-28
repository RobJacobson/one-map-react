import type { Bounds, LngLat, Point } from "../../contracts/camera-types.js";
import type {
  NativeBounds,
  NativeBoundsLike,
  NativeClickEvent,
  NativeLngLat,
  NativePoint,
} from "../../contracts/native-types.js";
import { featuresFromWrapper } from "./feature-values.js";
import {
  boundsFromGeographic,
  lngLatFromWrapper,
  type NativeBoundsSnapshot,
} from "./wrapper-values.js";

/**
 * Adds named longitude and latitude fields to a coordinate tuple.
 *
 * @param coordinate - Longitude and latitude in degrees.
 * @returns A fresh tuple with non-enumerable `lng` and `lat` fields.
 */
export const nativeLngLat = (coordinate: LngLat): NativeLngLat =>
  nativePair(coordinate, "lng", "lat");

/**
 * Adds named axes to a map-view point tuple.
 *
 * @param point - X and Y in native layout points.
 * @returns A fresh tuple with non-enumerable `x` and `y` fields.
 */
export const nativePoint = (point: Point): NativePoint =>
  nativePair(point, "x", "y");

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

/**
 * Validates and snapshots native camera bounds without sorting the corners.
 *
 * @param bounds - A pair of corners, flat bounds, or geographic bounds methods.
 * @returns Owned southwest and northeast tuples of finite coordinates.
 * @throws When the input does not provide four finite coordinates.
 */
export const nativeBoundsInput = (
  bounds: NativeBoundsLike
): NativeBoundsSnapshot =>
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

const nativePair = <Field extends string>(
  [first, second]: readonly [number, number],
  firstField: Field,
  secondField: Field
) => {
  const pair: readonly [number, number] = [first, second];

  // defineProperties adds the fields at runtime but keeps the input type.
  return Object.defineProperties(pair, {
    [firstField]: { value: first },
    [secondField]: { value: second },
  }) as typeof pair & Readonly<Record<Field, number>>;
};
