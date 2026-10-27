import type { GeolocationPosition } from "one-map-react";
import { PermissionsAndroid, Platform } from "react-native";

import { acquireLocation, locationPosition } from "./location-acquisition.js";

/** Requests app permission using only the selected platform's public API. */
export const requestNativeLocationPermission = async (
  requestIos?: () => Promise<boolean>
): Promise<{ status: string; accuracy: string; blocked?: boolean }> => {
  if (Platform.OS === "android") {
    const permissions = PermissionsAndroid.PERMISSIONS;
    const result = await PermissionsAndroid.requestMultiple([
      permissions.ACCESS_FINE_LOCATION,
      permissions.ACCESS_COARSE_LOCATION,
    ]);
    const fine =
      result[permissions.ACCESS_FINE_LOCATION] ===
      PermissionsAndroid.RESULTS.GRANTED;
    const coarse =
      result[permissions.ACCESS_COARSE_LOCATION] ===
      PermissionsAndroid.RESULTS.GRANTED;
    return {
      status: fine || coarse ? "granted" : "denied",
      accuracy: fine ? "precise" : coarse ? "approximate" : "unknown",
      blocked:
        !fine &&
        !coarse &&
        Object.values(result).includes(
          PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ),
    };
  }
  if (!requestIos)
    throw new Error(
      "RNMapbox iOS has no public permission request API. Use the application's permission integration."
    );
  return {
    status: (await requestIos()) ? "granted" : "denied",
    accuracy: "unknown",
  };
};

/** Reads one selected SDK fix without stopping another owner's listeners. */
export const acquireNativeLocation = <Position>(
  manager: {
    addListener(listener: (position: Position) => void): void;
    removeListener(listener: (position: Position) => void): void;
  },
  backend: "mapbox" | "maplibre",
  signal?: AbortSignal,
  timeoutMs?: number
): Promise<GeolocationPosition> =>
  acquireLocation(
    (success, failure) => {
      const listener = (value: Position): void => {
        // RNMapbox iOS may send a compass event before its first position fix.
        if (
          backend === "mapbox" &&
          Platform.OS === "ios" &&
          isHeadingOnly(value)
        )
          return;
        try {
          success(locationPosition(value, backend, Platform.OS));
        } catch (error) {
          failure(error);
        }
      };
      try {
        manager.addListener(listener);
      } catch (error) {
        manager.removeListener(listener);
        throw error;
      }
      return () => manager.removeListener(listener);
    },
    signal,
    timeoutMs
  );

const isHeadingOnly = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || !("coords" in value)) return false;
  const coords = value.coords;
  return (
    !!coords &&
    typeof coords === "object" &&
    "heading" in coords &&
    typeof coords.heading === "number" &&
    Number.isFinite(coords.heading) &&
    !("longitude" in coords) &&
    !("latitude" in coords)
  );
};
