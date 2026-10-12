import type { ClickEvent, MoveEvent } from "../../contracts/event-types.js";
import {
  clickEvent,
  originFromUserInteraction,
  viewStateFromLngLat,
} from "../shared/move-event.js";

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

  return {
    viewState: viewStateFromLngLat(longitude, latitude, zoom, heading, pitch),
    origin: originFromUserInteraction(isGestureActive),
  };
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
}): ClickEvent => {
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

  return clickEvent([longitude, latitude], [x, y]);
};
