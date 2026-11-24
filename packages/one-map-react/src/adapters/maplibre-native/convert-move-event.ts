import type { MoveEvent } from "../../contracts/event-types.js";
import {
  originFromUserInteraction,
  viewStateFromLngLat,
} from "../shared/move-event.js";

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
