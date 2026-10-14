import type { LocationService } from "../../contracts/location-types.js";
import { createLocationService } from "../shared/create-location-service.js";
import { positionFromWrapper } from "../shared/location-values.js";

interface BrowserGeolocation {
  watchPosition(
    success: (position: unknown) => void,
    failure: (error: unknown) => void,
    options: object
  ): number;
  clearWatch(id: number): void;
}

/** Browser location is accessed only by explicit acquisition or permission requests. */
export const browserLocation: LocationService = createLocationService({
  subscribe: (success, failure) => {
    const geolocation = requireGeolocation();
    const id = geolocation.watchPosition(
      (value) => {
        let position: ReturnType<typeof positionFromWrapper>;
        try {
          position = positionFromWrapper(value, "browser");
        } catch (error) {
          failure(error);
          return;
        }
        success(position);
      },
      failure,
      { maximumAge: 0 }
    );
    return () => geolocation.clearWatch(id);
  },
  requestPermission: async () => {
    try {
      await browserLocation.getCurrentPosition();
      return { status: "granted", accuracy: "unknown" };
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 1
      ) {
        return { status: "denied", accuracy: "unknown" };
      }
      throw error;
    }
  },
});

const requireGeolocation = (): BrowserGeolocation => {
  const browser = globalThis as unknown as {
    navigator?: { geolocation?: BrowserGeolocation };
  };
  const geolocation = browser.navigator?.geolocation;
  if (!geolocation) throw new Error("Browser geolocation is unavailable.");
  return geolocation;
};
