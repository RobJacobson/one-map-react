import type { GeolocationPosition } from "one-map-react";

/** Acquires one fix and releases only the request's subscription. */
export const acquireLocation = (
  subscribe: (
    success: (position: GeolocationPosition) => void,
    failure: (error: unknown) => void
  ) => () => void,
  signal?: AbortSignal,
  timeoutMs = 15000
): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      reject(new Error("Location timeout must be finite and nonnegative."));
      return;
    }
    let settled = false;
    let delivered = false;
    let release: (() => void) | undefined;
    const finish = (position?: GeolocationPosition, error?: unknown): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      try {
        release?.();
      } catch (cleanupError) {
        reject(cleanupError);
        return;
      }
      if (position) resolve(position);
      else reject(error);
    };
    const deliver = (position?: GeolocationPosition, error?: unknown): void => {
      if (delivered || settled) return;
      delivered = true;
      void Promise.resolve().then(() => finish(position, error));
    };
    const abort = (): void =>
      finish(undefined, new Error("Location cancelled."));
    const timer = setTimeout(
      () => finish(undefined, new Error("Location timed out.")),
      timeoutMs
    );
    signal?.addEventListener("abort", abort);
    if (signal?.aborted) {
      abort();
      return;
    }
    try {
      release = subscribe(
        (position) => deliver(position),
        (error) => deliver(undefined, error)
      );
      if (settled) release();
    } catch (error) {
      finish(undefined, error);
    }
  });

/** Converts measured coordinates while preserving display units. */
export const locationPosition = (
  value: unknown,
  backend: "browser" | "mapbox" | "maplibre",
  platform?: string
): GeolocationPosition => {
  if (!value || typeof value !== "object" || !("coords" in value))
    throw new Error("Location acquisition returned no position.");
  const coords = value.coords;
  if (!coords || typeof coords !== "object")
    throw new Error("Invalid location coordinates.");
  const fields = coords as Record<string, unknown>;
  const longitude = fields.longitude;
  const latitude = fields.latitude;
  if (
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90
  )
    throw new Error("Invalid location coordinates.");
  const optional = (name: string, nonnegative = true): number | undefined => {
    const measurement = fields[name];
    return typeof measurement === "number" &&
      Number.isFinite(measurement) &&
      (!nonnegative || measurement >= 0)
      ? measurement
      : undefined;
  };
  const timestamp = "timestamp" in value ? value.timestamp : undefined;
  if (
    timestamp !== undefined &&
    (typeof timestamp !== "number" ||
      !Number.isFinite(timestamp) ||
      timestamp < 0)
  )
    throw new Error("Invalid location timestamp.");
  const timestampMs =
    timestamp === undefined
      ? undefined
      : timestamp * (backend === "maplibre" && platform === "ios" ? 1000 : 1);
  if (timestampMs !== undefined && !Number.isFinite(timestampMs))
    throw new Error("Invalid location timestamp.");
  return {
    lngLat: [longitude, latitude],
    timestamp: timestampMs,
    accuracy: optional("accuracy"),
    altitude: optional("altitude", false),
    altitudeAccuracy: optional("altitudeAccuracy"),
    speed: optional("speed"),
    course: optional(backend === "mapbox" ? "course" : "heading"),
  };
};
