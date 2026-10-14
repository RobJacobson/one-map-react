import type { LocationOptions } from "../../contracts/location-types.js";
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

/** Converts known wrapper payloads; MapLibre iOS alone uses epoch seconds. */
export const positionFromWrapper = (
  value: unknown,
  backend: "mapbox" | "maplibre" | "browser",
  platform?: string
): GeolocationPosition => {
  if (!value || typeof value !== "object" || !("coords" in value)) {
    throw new Error("Location acquisition returned no position.");
  }
  const coords = value.coords;
  if (!coords || typeof coords !== "object")
    throw new Error("Invalid location coordinates.");
  const fields = coords as Record<string, unknown>;
  const optional = (name: string, nonnegative = true): number | undefined => {
    const measurement = fields[name];
    return typeof measurement === "number" &&
      Number.isFinite(measurement) &&
      (!nonnegative || measurement >= 0)
      ? measurement
      : undefined;
  };
  const timestamp =
    "timestamp" in value && typeof value.timestamp === "number"
      ? value.timestamp *
        (backend === "maplibre" && platform === "ios" ? 1000 : 1)
      : undefined;
  return validatePosition({
    lngLat: [fields.longitude as number, fields.latitude as number],
    timestamp,
    accuracy: optional("accuracy"),
    altitude: optional("altitude", false),
    altitudeAccuracy: optional("altitudeAccuracy"),
    speed: optional("speed"),
    course: optional(backend === "mapbox" ? "course" : "heading"),
  });
};

/** Applies finite freshness/deadline defaults at acquisition boundaries. */
export const locationOptions = (
  options?: LocationOptions
): Required<Pick<LocationOptions, "timeoutMs" | "maximumAgeMs">> => {
  const result = {
    timeoutMs: options?.timeoutMs ?? 15000,
    maximumAgeMs: options?.maximumAgeMs ?? 0,
  };
  for (const value of Object.values(result)) {
    if (!Number.isFinite(value) || value < 0)
      throw new Error("Location timing must be finite and nonnegative.");
  }
  return result;
};
