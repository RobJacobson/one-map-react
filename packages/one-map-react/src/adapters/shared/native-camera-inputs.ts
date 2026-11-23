import type { LngLat, ViewState } from "../../contracts/camera-types.js";
import type {
  NativeCameraTarget,
  NativeFitBoundsOptions,
  NativeInitialViewState,
  NativeMapInputs,
} from "../../contracts/native-types.js";

/** Selects explicit viewState or the individual desktop camera props. */
export const nativeCameraTarget = ({
  viewState,
  longitude,
  latitude,
  zoom,
  bearing,
  pitch,
}: NativeMapInputs): NativeCameraTarget | undefined =>
  viewState ??
  (longitude !== undefined ||
  latitude !== undefined ||
  zoom !== undefined ||
  bearing !== undefined ||
  pitch !== undefined
    ? { longitude, latitude, zoom, bearing, pitch }
    : undefined);

export const nativeCameraCenter = ({
  longitude,
  latitude,
}: NativeCameraTarget): LngLat | undefined =>
  longitude !== undefined && latitude !== undefined
    ? [longitude, latitude]
    : undefined;

/** Desktop construction defaults apply once. Updates leave omitted camera fields alone. */
export const nativeInitialCamera = (
  initial: NativeCameraTarget = {}
): ViewState & Pick<NativeCameraTarget, "padding"> => ({
  longitude: initial.longitude ?? 0,
  latitude: initial.latitude ?? 0,
  zoom: initial.zoom ?? 0,
  bearing: initial.bearing ?? 0,
  pitch: initial.pitch ?? 0,
  padding: initial.padding,
});

/** Bounds replace the initial center and zoom. Fit padding overrides view padding. */
export const nativeInitialFit = (
  initial: NativeInitialViewState
): NativeFitBoundsOptions => {
  const options = initial.fitBoundsOptions;
  for (const key of ["minZoom", "offset"] as const) {
    if (options?.[key] !== undefined) {
      throw new Error(
        `initialViewState.fitBoundsOptions.${key} is unavailable through the pinned native camera wrapper.`
      );
    }
  }
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
