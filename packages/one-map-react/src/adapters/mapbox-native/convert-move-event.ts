import type { MoveEvent } from "../../contracts/event-types.js";
import type { NativeClickEvent } from "../../contracts/native-types.js";
import { moveEventFromNative } from "../shared/index.js";
import { nativeClick } from "../shared/native-values.js";

/**
 * Builds a move event from RNMapbox `onCameraChanged` fields.
 *
 * @param center - `[longitude, latitude]` from `properties.center`.
 * @param zoom - `properties.zoom`.
 * @param heading - `properties.heading`.
 * @param pitch - `properties.pitch`.
 * @param isGestureActive - `gestures.isGestureActive`.
 * @returns Normalized move event.
 * @throws When `center` has no longitude or latitude.
 */
export const moveEventFromRnmapbox = (
  center: readonly number[],
  zoom: number,
  heading: number,
  pitch: number,
  isGestureActive: boolean
): MoveEvent => {
  const longitude = center[0];
  const latitude = center[1];

  if (longitude === undefined || latitude === undefined) {
    throw new Error("RNMapbox camera center is missing longitude or latitude.");
  }

  return moveEventFromNative(
    longitude,
    latitude,
    zoom,
    heading,
    pitch,
    isGestureActive
  );
};

/**
 * Builds a click from an RNMapbox press feature.
 *
 * The payload is a GeoJSON point. Screen position is `screenPointX` and
 * `screenPointY` on `properties`. The feature itself is not copied into
 * `features`.
 *
 * @param feature - Pressed point feature.
 * @returns Longitude, latitude, and the screen point.
 * @throws When the geometry or screen point is missing.
 */
export const clickEventFromRnmapbox = (feature: {
  readonly geometry?: { readonly coordinates?: readonly number[] };
  readonly properties?: {
    readonly screenPointX?: number;
    readonly screenPointY?: number;
  };
}): NativeClickEvent => {
  const coordinates = feature.geometry?.coordinates;
  const longitude = coordinates?.[0];
  const latitude = coordinates?.[1];
  const x = feature.properties?.screenPointX;
  const y = feature.properties?.screenPointY;

  if (
    longitude === undefined ||
    latitude === undefined ||
    x === undefined ||
    y === undefined
  ) {
    throw new Error(
      "RNMapbox press event is missing a coordinate or screen point."
    );
  }

  return nativeClick([longitude, latitude], [x, y]);
};
