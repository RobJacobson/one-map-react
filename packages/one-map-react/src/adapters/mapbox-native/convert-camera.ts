import type {
  Bounds,
  CameraCommandOptions,
  FitBoundsOptions,
  FlyToOptions,
  LngLat,
  ViewState,
  ZoomToOptions,
} from "../../contracts/camera-types.js";
import {
  assertBounds,
  normalizePadding,
  rejectNativeEasing,
} from "../shared/wrapper-values.js";

/**
 * Converts shared camera fields into RNMapbox `Camera.defaultSettings`.
 *
 * @param viewState - Shared camera fields.
 * @returns RNMapbox center, zoom, heading, and pitch.
 */
export const toRnmapboxDefaultSettings = (viewState: ViewState) => ({
  centerCoordinate: [viewState.longitude, viewState.latitude],
  zoomLevel: viewState.zoom,
  heading: viewState.bearing,
  pitch: viewState.pitch,
});

/**
 * Converts a controlled view into RNMapbox camera props.
 *
 * `animationMode` is `none` so the update does not use Android's default
 * ease or iOS's default flight. This writes the React camera onto the
 * wrapper. It does not by itself prove that an unaccepted gesture returns.
 *
 * @param viewState - Camera supplied by React.
 * @returns RNMapbox center, zoom, heading, pitch, and a non-animated update.
 */
export const toRnmapboxControlledCamera = (viewState: ViewState) => ({
  centerCoordinate: [viewState.longitude, viewState.latitude] as LngLat,
  zoomLevel: viewState.zoom,
  heading: viewState.bearing,
  pitch: viewState.pitch,
  animationDuration: 0,
  animationMode: "none" as const,
});

/**
 * Converts bounds to RNMapbox `{ sw, ne }`.
 *
 * @param bounds - Southwest then northeast corners.
 * @returns Named corners in the same order.
 * @throws When a corner is missing.
 */
export const toRnmapboxCornerBounds = (bounds: Bounds) => {
  const [southwest, northeast] = assertBounds(bounds);

  return { sw: southwest, ne: northeast };
};

/**
 * Converts RNMapbox padding fields from a shared padding value.
 *
 * @param padding - Partial padding or one number for every side.
 * @returns `paddingTop`, `paddingRight`, `paddingBottom`, and `paddingLeft`.
 */
export const toRnmapboxPadding = (padding?: PaddingOrNumber) => {
  const sides = normalizePadding(padding);

  return {
    paddingTop: sides.top,
    paddingRight: sides.right,
    paddingBottom: sides.bottom,
    paddingLeft: sides.left,
  };
};

/**
 * Converts a shared flight into RNMapbox `setCamera` with an explicit fly mode.
 *
 * RNMapbox's `flyTo` helper omits `animationMode`, and Android then defaults
 * to ease. This object sets `animationMode: "flyTo"`.
 *
 * @param options - Shared flight.
 * @returns An RNMapbox camera stop.
 */
export const toRnmapboxFlyToStop = (options: FlyToOptions) =>
  toRnmapboxStop(options, "flyTo");

/**
 * Converts a camera command into an RNMapbox stop.
 *
 * @param options - Partial camera target.
 * @param animationMode - Explicit RNMapbox movement. `none` is a jump.
 * @returns An RNMapbox camera stop. An easing function is rejected.
 * @throws When `options.easing` is set.
 */
export const toRnmapboxStop = (
  options: CameraCommandOptions,
  animationMode: "flyTo" | "easeTo" | "none"
) => {
  rejectNativeEasing(options.easing);

  return {
    type: "CameraStop" as const,
    ...(options.center === undefined
      ? {}
      : { centerCoordinate: options.center }),
    ...(options.zoom === undefined ? {} : { zoomLevel: options.zoom }),
    ...(options.bearing === undefined ? {} : { heading: options.bearing }),
    ...(options.pitch === undefined ? {} : { pitch: options.pitch }),
    ...(options.padding === undefined
      ? {}
      : { padding: toRnmapboxPadding(options.padding) }),
    ...(options.duration === undefined
      ? {}
      : { animationDuration: options.duration }),
    animationMode,
  };
};

/**
 * Converts `fitBounds` into an RNMapbox ease stop.
 *
 * The wrapper's own `fitBounds` also eases. Building the stop here keeps
 * `animationMode` explicit.
 *
 * @param bounds - Southwest then northeast corners.
 * @param options - Padding, duration, bearing, and pitch.
 * @returns An RNMapbox camera stop with `animationMode: "easeTo"`.
 * @throws When the bounds are invalid or `easing` is set.
 */
export const toRnmapboxFitBoundsStop = (
  bounds: Bounds,
  options: FitBoundsOptions = {}
) => {
  rejectNativeEasing(options.easing);

  return {
    type: "CameraStop" as const,
    bounds: toRnmapboxCornerBounds(bounds),
    ...(options.padding === undefined
      ? {}
      : { padding: toRnmapboxPadding(options.padding) }),
    ...(options.bearing === undefined ? {} : { heading: options.bearing }),
    ...(options.pitch === undefined ? {} : { pitch: options.pitch }),
    ...(options.duration === undefined
      ? {}
      : { animationDuration: options.duration }),
    animationMode: "easeTo" as const,
  };
};

/**
 * Converts `zoomTo` into an RNMapbox stop.
 *
 * Duration `0` uses `animationMode: "none"`. Any other duration, including an
 * omitted duration, uses `easeTo`. The wrapper's `zoomTo` helper uses flight,
 * which is not this command.
 *
 * @param zoom - Target zoom.
 * @param options - Duration.
 * @returns An RNMapbox camera stop.
 * @throws When `easing` is set.
 */
export const toRnmapboxZoomStop = (
  zoom: number,
  options: ZoomToOptions = {}
) => {
  rejectNativeEasing(options.easing);

  return {
    type: "CameraStop" as const,
    zoomLevel: zoom,
    ...(options.duration === undefined
      ? {}
      : { animationDuration: options.duration }),
    animationMode:
      options.duration === 0 ? ("none" as const) : ("easeTo" as const),
  };
};

type PaddingOrNumber = Parameters<typeof normalizePadding>[0];
