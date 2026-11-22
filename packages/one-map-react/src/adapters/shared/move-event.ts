import type { ViewState } from "../../contracts/camera-types.js";
import type { MoveOrigin } from "../../contracts/event-types.js";

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
