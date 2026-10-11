import type { ViewState } from "./camera-types.js";
import type { MoveEvent, MoveOrigin } from "./event-types.js";

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
