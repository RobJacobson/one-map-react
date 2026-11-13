import type { MapRef, ViewState } from "one-map-react";

/** Shared test pose; the terrain scene separately starts with pitch 35. */
export const nativeControlledCamera = {
  longitude: 0,
  latitude: 0,
  zoom: 2,
  bearing: 0,
  pitch: 0,
};

/** RNMapbox exposes orientation in native camera events, without ref getters. */
export const readNativeOrientation = async (
  backend: string,
  map: Pick<MapRef, "getBearing" | "getPitch">,
  observed: ViewState | undefined
): Promise<{
  bearing: number;
  pitch: number;
  orientationSource: string;
}> => {
  if (backend === "mapbox-native") {
    if (
      !observed ||
      !Number.isFinite(observed.bearing) ||
      !Number.isFinite(observed.pitch)
    )
      throw new Error(
        "A native camera event is required for Mapbox orientation."
      );
    return {
      bearing: observed.bearing,
      pitch: observed.pitch,
      orientationSource: "native-camera-event",
    };
  }
  return {
    bearing: await map.getBearing(),
    pitch: await map.getPitch(),
    orientationSource: "native-camera-getters",
  };
};
