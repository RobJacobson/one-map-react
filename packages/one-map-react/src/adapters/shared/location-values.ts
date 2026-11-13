import type { GeolocationPosition } from "../../contracts/ui-types.js";
import { lngLatFromWrapper } from "./wrapper-values.js";

/** Validates a caller/provider position without inventing missing measurements. */
export const validatePosition = (
  position: GeolocationPosition
): GeolocationPosition => {
  const lngLat = lngLatFromWrapper(position.lngLat);
  if (Math.abs(lngLat[1]) > 90)
    throw new Error("Location latitude is out of range.");
  for (const name of [
    "accuracy",
    "timestamp",
    "altitudeAccuracy",
    "speed",
  ] as const) {
    const value = position[name];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`Location ${name} must be finite and nonnegative.`);
    }
  }
  for (const name of ["altitude", "course"] as const) {
    if (position[name] !== undefined && !Number.isFinite(position[name])) {
      throw new Error(`Location ${name} must be finite.`);
    }
  }
  return { ...position, lngLat };
};
