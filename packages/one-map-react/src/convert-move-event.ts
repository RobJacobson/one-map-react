import type { LngLat, Point, ViewState } from "./camera-types.js";
import { lngLatFromWrapper, pointFromWrapper } from "./convert-camera.js";
import type { ClickEvent, MoveEvent, MoveOrigin } from "./event-types.js";

/**
 * Maps a wrapper user-interaction flag to a portable origin.
 *
 * @param isUserInteraction - Whether the wrapper reported a user gesture.
 * @returns `user` when the flag is true; otherwise `unknown`.
 */
export const originFromUserInteraction = (
  isUserInteraction: boolean
): MoveOrigin => (isUserInteraction ? "user" : "unknown");

/**
 * Builds a portable view state from a longitude/latitude pair.
 *
 * @param longitude - Camera longitude.
 * @param latitude - Camera latitude.
 * @param zoom - Camera zoom.
 * @param bearing - Camera bearing.
 * @param pitch - Camera pitch.
 * @returns Shared camera fields.
 */
export const viewStateFromLngLat = (
  longitude: number,
  latitude: number,
  zoom: number,
  bearing: number,
  pitch: number
): ViewState => ({
  longitude,
  latitude,
  zoom,
  bearing,
  pitch,
});

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
 * Builds a move event from MapLibre Native `onRegionIsChanging` or
 * `onRegionDidChange`.
 *
 * @param center - `[longitude, latitude]`.
 * @param zoom - Native zoom.
 * @param bearing - Native bearing.
 * @param pitch - Native pitch.
 * @param userInteraction - Native `userInteraction` flag.
 * @returns Normalized move event.
 */
export const moveEventFromMaplibreNative = (
  center: readonly [number, number],
  zoom: number,
  bearing: number,
  pitch: number,
  userInteraction: boolean
): MoveEvent => ({
  viewState: viewStateFromLngLat(center[0], center[1], zoom, bearing, pitch),
  origin: originFromUserInteraction(userInteraction),
});

/**
 * Builds a move event from react-map-gl `onMove`.
 *
 * @param viewState - Wrapper view state.
 * @param originalEvent - Present for many user gestures; omitted otherwise.
 * @returns Normalized move event.
 */
export const moveEventFromWeb = (
  viewState: ViewState,
  originalEvent: unknown
): MoveEvent => ({
  viewState: viewStateFromLngLat(
    viewState.longitude,
    viewState.latitude,
    viewState.zoom,
    viewState.bearing,
    viewState.pitch
  ),
  origin: originFromUserInteraction(originalEvent !== undefined),
});

/**
 * Builds a click from a web pointer or wheel event.
 *
 * @param event - Wrapper event with `lngLat`, `point`, and optional features.
 * @returns Longitude, latitude, view point, and features when present.
 * @throws When the coordinate or point cannot be read.
 */
export const clickEventFromWeb = (event: {
  readonly lngLat?: unknown;
  readonly point?: unknown;
  readonly features?: readonly object[];
}): ClickEvent =>
  clickEvent(
    lngLatFromWrapper(event.lngLat),
    pointFromWrapper(event.point),
    event.features
  );

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

/**
 * Builds a click from MapLibre Native `onPress` or `onLongPress`.
 *
 * @param lngLat - `nativeEvent.lngLat`.
 * @param point - `nativeEvent.point`.
 * @param features - Features included when the press bubbled from a source.
 * @returns Longitude, latitude, view point, and features when present.
 */
export const clickEventFromMaplibreNative = (
  lngLat: LngLat,
  point: Point,
  features?: readonly object[]
): ClickEvent => clickEvent(lngLat, point, features);

const clickEvent = (
  lngLat: LngLat,
  point: Point,
  features?: readonly object[]
): ClickEvent => ({
  lngLat,
  point,
  ...(features === undefined ? {} : { features }),
});
