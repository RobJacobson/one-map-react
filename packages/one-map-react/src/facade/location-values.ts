import { lngLatFromWrapper } from "../adapters/shared/index.js";
import type { GeolocationPosition } from "../contracts/ui-types.js";

/**
 * Snapshots a supplied location, preserving its available measurements.
 *
 * @param position - Location from the application or its provider.
 * @returns The validated coordinate and measurements.
 * @throws When the coordinate or a supplied measurement is invalid.
 */
export const validatePosition = (
  position: GeolocationPosition
): GeolocationPosition => {
  const lngLat = lngLatFromWrapper(position.lngLat);
  if (Math.abs(lngLat[1]) > 90) {
    throw new Error("Location latitude is out of range.");
  }

  const snapshot: {
    -readonly [Name in keyof GeolocationPosition]: GeolocationPosition[Name];
  } = { lngLat };
  for (const name of [
    "accuracy",
    "timestamp",
    "altitudeAccuracy",
    "speed",
  ] as const) {
    const value = position[name];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Location ${name} must be finite and nonnegative.`);
    }
    snapshot[name] = value;
  }
  for (const name of ["altitude", "course"] as const) {
    const value = position[name];
    if (value === undefined) continue;
    if (!Number.isFinite(value)) {
      throw new Error(`Location ${name} must be finite.`);
    }
    snapshot[name] = value;
  }

  return snapshot;
};
