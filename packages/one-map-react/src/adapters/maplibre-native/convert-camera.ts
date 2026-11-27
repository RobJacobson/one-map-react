import type {
  CameraAnimationOptions,
  CameraBoundsOptions,
  CameraCenterOptions,
  CameraOptions,
  InitialViewState,
} from "@maplibre/maplibre-react-native";

import type {
  NativeCameraCommand,
  NativeCameraTarget,
  NativeFitBoundsOptions,
  NativeInitialViewState,
} from "../../contracts/native-types.js";
import {
  nativeCameraCenter,
  nativeInitialCamera,
  nativeInitialFit,
  rejectNativeFitBoundsMaxZoom,
} from "../shared/native-camera-inputs.js";
import { nativeBoundsInput } from "../shared/native-values.js";
import {
  lngLatFromWrapper,
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
export const toMaplibreViewState = (
  viewState: NativeCameraTarget
): Exclude<InitialViewState, CameraBoundsOptions> => {
  const center = nativeCameraCenter(viewState);
  return {
    ...(center ? { center } : {}),
    zoom: viewState.zoom,
    bearing: toMaplibreDeclarativeBearing(viewState.bearing),
    pitch: viewState.pitch,
    ...(viewState.padding === undefined
      ? {}
      : { padding: normalizePadding(viewState.padding) }),
  };
};

/**
 * Converts the initial camera into a bounds fit or a centered view.
 *
 * @param viewState - Initial camera supplied by React.
 * @returns MapLibre initial camera props.
 * @throws When the coordinates are invalid or the fit options are unsupported.
 */
export const toMaplibreInitialViewState = (
  viewState: NativeInitialViewState = {}
): InitialViewState => {
  if (viewState.bounds !== undefined) {
    const fit = nativeInitialFit(viewState);
    const options = toMaplibreFitBoundsOptions({
      ...fit,
      bearing: toMaplibreDeclarativeBearing(fit.bearing),
    });
    return {
      bounds: toFlatBounds(nativeBoundsInput(viewState.bounds)),
      ...options,
    };
  }
  return toMaplibreViewState(nativeInitialCamera(viewState));
};

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
export const toMaplibreCommand = (
  options: NativeCameraCommand
): MaplibreMovementOptions &
  Pick<CameraOptions, "zoom"> &
  Partial<CameraCenterOptions> => {
  rejectNativeEasing(options.easing);

  const center =
    options.center === undefined
      ? undefined
      : lngLatFromWrapper(options.center);
  return {
    ...(center === undefined ? {} : { center }),
    ...(options.zoom === undefined ? {} : { zoom: options.zoom }),
    ...toMaplibreMovementOptions(options),
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
export const toMaplibreFitBoundsOptions = (
  options: NativeFitBoundsOptions = {}
): MaplibreMovementOptions => {
  rejectNativeFitBoundsMaxZoom(options.maxZoom);
  rejectNativeEasing(options.easing);

  return toMaplibreMovementOptions(options);
};

type MaplibreMovementOptions = Pick<
  CameraOptions & CameraAnimationOptions,
  "bearing" | "pitch" | "padding" | "duration"
>;

// The pinned iOS component treats -1 as omitted in initialViewState and stop.
const toMaplibreDeclarativeBearing = (bearing: number | undefined) =>
  bearing === -1 ? 359 : bearing;

const toMaplibreMovementOptions = (
  options: Pick<
    NativeFitBoundsOptions,
    "bearing" | "pitch" | "padding" | "duration"
  >
) => ({
  ...(options.bearing === undefined ? {} : { bearing: options.bearing }),
  ...(options.pitch === undefined ? {} : { pitch: options.pitch }),
  ...(options.padding === undefined
    ? {}
    : { padding: normalizePadding(options.padding) }),
  ...(options.duration === undefined ? {} : { duration: options.duration }),
});
