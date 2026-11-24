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
export const toMaplibreViewState = (viewState: NativeCameraTarget) => {
  const center = nativeCameraCenter(viewState);
  return {
    ...(center ? { center } : {}),
    zoom: viewState.zoom,
    bearing: viewState.bearing,
    pitch: viewState.pitch,
    ...(viewState.padding === undefined
      ? {}
      : { padding: normalizePadding(viewState.padding) }),
  };
};

export const toMaplibreInitialViewState = (
  viewState: NativeInitialViewState = {}
) => {
  if (viewState.bounds !== undefined) {
    const fit = toMaplibreFitBoundsOptions(nativeInitialFit(viewState));
    return {
      bounds: toFlatBounds(nativeBoundsInput(viewState.bounds)),
      ...fit,
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
export const toMaplibreCommand = (options: NativeCameraCommand) => {
  rejectNativeEasing(options.easing);

  const center =
    options.center === undefined
      ? undefined
      : lngLatFromWrapper(options.center);
  return {
    ...(center === undefined ? {} : { center }),
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
export const toMaplibreFitBoundsOptions = (
  options: NativeFitBoundsOptions = {}
) => {
  rejectNativeFitBoundsMaxZoom(options.maxZoom);
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
