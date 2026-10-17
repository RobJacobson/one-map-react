import type {
  Bounds,
  CameraCommandOptions,
  FitBoundsOptions,
  LngLat,
  ViewState,
} from "../../contracts/camera-types.js";
import {
  normalizePadding,
  rejectNativeEasing,
  toFlatBounds,
} from "../shared/wrapper-values.js";

/**
 * Converts initial or controlled camera fields into MapLibre Native props.
 *
 * @param viewState - Camera supplied by React.
 * @returns MapLibre center, zoom, bearing, and pitch.
 */
export const toMaplibreViewState = (viewState: ViewState) => ({
  center: [viewState.longitude, viewState.latitude] as LngLat,
  zoom: viewState.zoom,
  bearing: viewState.bearing,
  pitch: viewState.pitch,
});

/**
 * Converts a command into MapLibre Native camera fields.
 *
 * Named methods add their own easing. This object does not include an easing
 * function.
 *
 * @param options - Partial camera target.
 * @returns Center, zoom, bearing, pitch, padding, and duration that were set.
 * @throws When `easing` is a function.
 */
export const toMaplibreCommand = (options: CameraCommandOptions) => {
  rejectNativeEasing(options.easing);

  return {
    ...(options.center === undefined ? {} : { center: options.center }),
    ...(options.zoom === undefined ? {} : { zoom: options.zoom }),
    ...(options.bearing === undefined ? {} : { bearing: options.bearing }),
    ...(options.pitch === undefined ? {} : { pitch: options.pitch }),
    ...(options.padding === undefined
      ? {}
      : { padding: normalizePadding(options.padding) }),
    ...(options.duration === undefined ? {} : { duration: options.duration }),
  };
};

/**
 * Converts fit options into MapLibre Native `fitBounds` options.
 *
 * The wrapper's `fitBounds` selects flight when easing is omitted.
 *
 * @param options - Fit options.
 * @returns Padding, duration, bearing, and pitch that were set.
 * @throws When `easing` is a function or `maxZoom` is supplied.
 */
export const toMaplibreFitBoundsOptions = (options: FitBoundsOptions = {}) => {
  if (options.maxZoom !== undefined) {
    throw new Error(
      "fitBounds.maxZoom is unavailable through the pinned native camera wrapper."
    );
  }

  rejectNativeEasing(options.easing);

  return {
    ...(options.padding === undefined
      ? {}
      : { padding: normalizePadding(options.padding) }),
    ...(options.duration === undefined ? {} : { duration: options.duration }),
    ...(options.bearing === undefined ? {} : { bearing: options.bearing }),
    ...(options.pitch === undefined ? {} : { pitch: options.pitch }),
  };
};

/**
 * Copies the readonly corner pair into the mutable flat-bounds tuple the
 * MapLibre Native `Camera` props declare.
 *
 * @param bounds - Southwest then northeast corners.
 * @returns `[west, south, east, north]` as a mutable tuple.
 */
export const mutableFlatBounds = (
  bounds: Bounds
): [number, number, number, number] => {
  const [west, south, east, north] = toFlatBounds(bounds);

  return [west, south, east, north];
};
