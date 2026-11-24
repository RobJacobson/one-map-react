import type { ViewState } from "../../contracts/camera-types.js";
import type { MoveEvent, MoveOrigin } from "../../contracts/event-types.js";
import type { MapProps } from "../../contracts/map-types.js";

/**
 * Reports a settled camera and supplies the initial move if necessary.
 *
 * @param sawMove - Per-map flag set by the first change or settle.
 * @param event - Converted event for the settled camera.
 * @param report - Callbacks guarded by the adapter's mounted lifetime.
 */
export const reportSettledMove = (
  sawMove: { current: boolean },
  event: MoveEvent,
  report: Required<Pick<MapProps, "onMove" | "onMoveEnd">>
): void => {
  if (!sawMove.current) {
    sawMove.current = true;
    report.onMove(event);
  }

  report.onMoveEnd(event);
};

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
