import type { ViewState } from "../../contracts/camera-types.js";
import type { ClickEvent, MoveEvent } from "../../contracts/event-types.js";
import {
  clickEvent,
  originFromUserInteraction,
  viewStateFromLngLat,
} from "../shared/move-event.js";
import {
  lngLatFromWrapper,
  pointFromWrapper,
} from "../shared/wrapper-values.js";

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
