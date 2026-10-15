import { AppState, PermissionsAndroid, Platform } from "react-native";

import type {
  LocationPermission,
  LocationService,
} from "../../contracts/location-types.js";
import { createLocationService } from "./create-location-service.js";
import { positionFromWrapper } from "./location-values.js";

interface NativeLocationManager {
  addListener(listener: (position: never) => void): void;
  removeListener(listener: (position: never) => void): void;
}

/**
 * Adapts the wrappers' singleton subscriptions without globally stopping sensors.
 * @param manager - Selected public manager, read lazily for peer isolation.
 * @param backend - Payload conversion owner.
 * @param requestIos - Public iOS permission request, absent on RNMapbox.
 * @returns Explicit foreground service; backgrounding disposes only its listener.
 */
export const createNativeLocation = (
  manager: () => NativeLocationManager,
  backend: "mapbox" | "maplibre",
  requestIos?: () => Promise<boolean>
): LocationService =>
  createLocationService({
    requestPermission: async (): Promise<LocationPermission> => {
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
          "RNMapbox iOS has no public permission request API. Supply MapSetup.locationProvider with your application permission integration."
        );
      return {
        status: (await requestIos()) ? "granted" : "denied",
        accuracy: "unknown",
      };
    },
    subscribe: (success, failure, interrupted) => {
      const selected = manager();
      let listening = false;
      let active = true;
      const listener = (value: unknown): void => {
        if (!active || !listening) return;
        // RNMapbox 10.3.7 iOS emits compass updates before its first fix.
        // Keep waiting under the existing deadline; see tf08-location.native.test.tsx.
        if (
          backend === "mapbox" &&
          Platform.OS === "ios" &&
          isHeadingOnlyUpdate(value)
        ) {
          return;
        }

        let position: ReturnType<typeof positionFromWrapper>;
        try {
          position = positionFromWrapper(value, backend, Platform.OS);
        } catch (error) {
          failure(error);
          return;
        }
        success(position);
      };
      const attach = (): void => {
        if (!active || listening) return;
        listening = true;
        selected.addListener(listener);
      };
      const detach = (): void => {
        if (!listening) return;
        listening = false;
        selected.removeListener(listener);
      };
      const appState = AppState.addEventListener("change", (state) => {
        try {
          if (state === "active") attach();
          else {
            detach();
            interrupted();
          }
        } catch (error) {
          failure(error);
        }
      });
      try {
        if (
          AppState.currentState === null ||
          AppState.currentState === "active"
        )
          attach();
      } catch (error) {
        active = false;
        detach();
        appState.remove();
        throw error;
      }
      return () => {
        active = false;
        detach();
        appState.remove();
      };
    },
  });

/** Recognizes the pinned RNMapbox compass payload without accepting malformed fixes. */
const isHeadingOnlyUpdate = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || !("coords" in value)) return false;

  const coords = value.coords;
  return (
    coords !== null &&
    typeof coords === "object" &&
    "heading" in coords &&
    typeof coords.heading === "number" &&
    Number.isFinite(coords.heading) &&
    !("longitude" in coords) &&
    !("latitude" in coords)
  );
};
