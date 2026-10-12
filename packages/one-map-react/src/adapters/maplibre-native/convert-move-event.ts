import type { LngLat, Point } from "../../contracts/camera-types.js";
import type { ClickEvent, MoveEvent } from "../../contracts/event-types.js";
import {
  clickEvent,
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
