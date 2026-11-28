import type { LngLat, ViewState } from "../../contracts/camera-types.js";
import type {
  NativeCameraTarget,
  NativeFitBoundsOptions,
  NativeInitialViewState,
  NativeMapInputs,
} from "../../contracts/native-types.js";
import { nativeBoundsInput } from "./native-values.js";
import { finiteNumber, normalizePadding } from "./wrapper-values.js";

/**
 * Snapshots explicit viewState or selects the individual desktop camera props.
 *
 * @param inputs - The native map camera props.
 * @returns The selected target, if supplied.
 */
export const nativeCameraTarget = ({
  viewState,
  longitude,
  latitude,
  zoom,
  bearing,
  pitch,
}: NativeMapInputs): NativeCameraTarget | undefined => {
  if (viewState) {
    return snapshotCameraTarget(viewState);
  }

  if (
    longitude === undefined &&
    latitude === undefined &&
    zoom === undefined &&
    bearing === undefined &&
    pitch === undefined
  ) {
    return undefined;
  }
  return { longitude, latitude, zoom, bearing, pitch };
};

/**
 * Captures the initial camera settings for the lifetime of the map.
 *
 * @param initial - Explicit initial settings or the first camera target.
 * @returns The captured settings, if supplied.
 * @throws When bounds are invalid or the initial fit uses an unsupported offset or minimum zoom.
 */
export const snapshotNativeInitialCamera = (
  initial: NativeInitialViewState | undefined
): NativeInitialViewState | undefined => {
  if (initial === undefined) return undefined;

  const target = snapshotCameraTarget(initial);
  const bounds = initial.bounds;
  if (bounds === undefined) return target;

  return {
    ...target,
    bounds: nativeBoundsInput(bounds),
    fitBoundsOptions: snapshotInitialFitOptions(initial.fitBoundsOptions),
  };
};

/**
 * Converts supplied camera coordinates to a center.
 *
 * @param target - Requested camera fields.
 * @param fallback - Observed center used for a missing axis.
 * @returns A complete center if requested and available.
 * @throws When a supplied coordinate is non-finite.
 */
export const nativeCameraCenter = (
  target: NativeCameraTarget,
  fallback?: Pick<ViewState, "longitude" | "latitude">
): LngLat | undefined => {
  const { longitude, latitude } = target;
  if (longitude === undefined && latitude === undefined) {
    return undefined;
  }

  const lng = cameraCoordinate(longitude, "longitude", fallback?.longitude);
  const lat = cameraCoordinate(latitude, "latitude", fallback?.latitude);
  return lng === undefined || lat === undefined ? undefined : [lng, lat];
};

/**
 * Fills the one-time desktop construction defaults.
 *
 * @param initial - Requested initial camera fields.
 * @returns The initial camera with zero defaults for omitted fields.
 * @throws When a supplied coordinate is non-finite.
 */
export const nativeInitialCamera = (
  initial: NativeCameraTarget = {}
): ViewState & Pick<NativeCameraTarget, "padding"> => ({
  longitude: cameraCoordinate(initial.longitude, "longitude", 0),
  latitude: cameraCoordinate(initial.latitude, "latitude", 0),
  zoom: initial.zoom ?? 0,
  bearing: initial.bearing ?? 0,
  pitch: initial.pitch ?? 0,
  padding: initial.padding,
});

/**
 * Resolves an initial bounds fit. Bounds replace the center and zoom.
 *
 * @param initial - Requested initial camera fields and fit options.
 * @returns Fit options with fit padding taking precedence over view padding.
 * @throws When coordinates are invalid or the fit uses an unsupported offset or minimum zoom.
 */
export const nativeInitialFit = (
  initial: NativeInitialViewState
): NativeFitBoundsOptions => {
  nativeCameraCenter(initial);
  const options = initial.fitBoundsOptions;
  rejectUnsupportedInitialFitOptions(options);
  return {
    padding: options?.padding ?? initial.padding,
    maxZoom: options?.maxZoom,
    bearing: initial.bearing,
    pitch: initial.pitch,
  };
};

/**
 * Rejects a fit zoom cap, which neither pinned native camera wrapper accepts.
 *
 * @param maxZoom - Requested fit zoom cap, including zero.
 * @throws When `maxZoom` is supplied.
 */
export const rejectNativeFitBoundsMaxZoom = (
  maxZoom: NativeFitBoundsOptions["maxZoom"]
): void => {
  if (maxZoom !== undefined) {
    throw new Error(
      "fitBounds.maxZoom is unavailable through the pinned native camera wrapper."
    );
  }
};

const snapshotInitialFitOptions = (
  options: NativeInitialViewState["fitBoundsOptions"]
): NativeInitialViewState["fitBoundsOptions"] => {
  if (options == null) return undefined;

  rejectUnsupportedInitialFitOptions(options);
  const { maxZoom, padding } = options;
  return {
    maxZoom,
    padding: padding == null ? undefined : normalizePadding(padding),
  };
};

const rejectUnsupportedInitialFitOptions = (
  options: NativeInitialViewState["fitBoundsOptions"]
): void => {
  for (const key of ["minZoom", "offset"] as const) {
    if (options?.[key] !== undefined) {
      throw new Error(
        `initialViewState.fitBoundsOptions.${key} is unavailable through the pinned native camera wrapper.`
      );
    }
  }
};

const snapshotCameraTarget = ({
  longitude,
  latitude,
  zoom,
  bearing,
  pitch,
  padding,
}: NativeCameraTarget): NativeCameraTarget => ({
  longitude,
  latitude,
  zoom,
  bearing,
  pitch,
  padding: padding === undefined ? undefined : normalizePadding(padding),
});

const cameraCoordinate = <Fallback extends number | undefined>(
  value: number | undefined,
  name: "longitude" | "latitude",
  fallback: Fallback
): number | Fallback =>
  value === undefined ? fallback : finiteNumber(value, name);
