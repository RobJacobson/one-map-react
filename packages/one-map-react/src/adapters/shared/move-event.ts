import type { MoveEvent } from "../../contracts/event-types.js";

/** Native viewport corners in west, south, east, north order. */
export type NativeViewportBounds = readonly [number, number, number, number];

/** Adapter callbacks that retain viewport bounds alongside the public event. */
export type NativeMoveCallbacks = {
  readonly onMove: (event: MoveEvent, bounds?: NativeViewportBounds) => void;
  readonly onMoveEnd: (event: MoveEvent, bounds?: NativeViewportBounds) => void;
};

/**
 * Reports a settled camera and supplies the initial move if necessary.
 *
 * @param sawMove - Per-map flag set by the first change or settle.
 * @param event - Converted event for the settled camera.
 * @param report - Callbacks guarded by the adapter's mounted lifetime.
 * @param bounds - Visible native viewport when supplied by the wrapper.
 */
export const reportSettledMove = (
  sawMove: { current: boolean },
  event: MoveEvent,
  report: NativeMoveCallbacks,
  bounds?: NativeViewportBounds
): void => {
  if (!sawMove.current) {
    sawMove.current = true;
    report.onMove(event, bounds);
  }

  report.onMoveEnd(event, bounds);
};

/**
 * Builds a portable move event from the wrapper's camera and gesture fields.
 *
 * @param longitude - Camera longitude.
 * @param latitude - Camera latitude.
 * @param zoom - Camera zoom.
 * @param bearing - Camera bearing.
 * @param pitch - Camera pitch.
 * @param isUserInteraction - Whether the wrapper reported a user gesture.
 * @returns Observed camera fields and movement origin.
 */
export const moveEventFromNative = (
  longitude: number,
  latitude: number,
  zoom: number,
  bearing: number,
  pitch: number,
  isUserInteraction: boolean
): MoveEvent => ({
  viewState: { longitude, latitude, zoom, bearing, pitch },
  origin: isUserInteraction ? "user" : "unknown",
});
