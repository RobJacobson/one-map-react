import type {
  LocationOptions,
  LocationService,
} from "../../contracts/location-types.js";
import type { GeolocationPosition } from "../../contracts/ui-types.js";
import { locationOptions, validatePosition } from "./location-values.js";

/** Internal acquisition boundary; subscribe may report a cached fix synchronously. */
export interface LocationUpdates {
  readonly subscribe: (
    position: (position: GeolocationPosition) => void,
    error: (error: unknown) => void,
    interrupted: () => void
  ) => () => void;
  readonly requestPermission: LocationService["requestPermission"];
}

/**
 * Adds bounded initial acquisition and stale-callback suppression to public providers.
 * @param updates - Backend subscriptions and explicit permission operation.
 * @returns A foreground service with individually disposable subscriptions.
 */
export const createLocationService = (
  updates: LocationUpdates
): LocationService => {
  const watchPosition = (
    onPosition: (position: GeolocationPosition) => void,
    onError: (error: unknown) => void,
    options?: LocationOptions,
    once = false
  ) => {
    const { timeoutMs, maximumAgeMs } = locationOptions(options);
    const started = Date.now();
    let active = true;
    let release: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const dispose = (): void => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      options?.signal?.removeEventListener("abort", abort);
      release?.();
    };
    const fail = (error: unknown): void => {
      if (!active) return;
      dispose();
      onError(error);
    };
    const abort = (): void =>
      fail(new Error("Location acquisition cancelled."));
    if (options?.signal?.aborted) {
      abort();
      return dispose;
    }
    options?.signal?.addEventListener("abort", abort);
    timer = setTimeout(
      () => fail(new Error("Location acquisition timed out.")),
      timeoutMs
    );
    try {
      release = updates.subscribe(
        (value) => {
          if (!active) return;
          let position: GeolocationPosition;
          try {
            position = validatePosition(value);
          } catch (error) {
            fail(error);
            return;
          }
          // A timestamp-less cached fix cannot establish freshness. Providers must
          // supply a measured timestamp for the common fresh-position contract.
          if (
            position.timestamp === undefined ||
            position.timestamp < started - maximumAgeMs
          )
            return;
          clearTimeout(timer);
          onPosition(position);
        },
        fail,
        () => {
          if (once)
            fail(new Error("Foreground location acquisition interrupted."));
        }
      );
      if (!active) release();
    } catch (error) {
      fail(error);
    }
    return dispose;
  };
  return {
    requestPermission: updates.requestPermission,
    watchPosition,
    getCurrentPosition: (options?: LocationOptions) =>
      new Promise((resolve, reject) => {
        let complete = false;
        let release: (() => void) | undefined;
        const finish = (position: GeolocationPosition): void => {
          complete = true;
          release?.();
          resolve(position);
        };
        release = watchPosition(finish, reject, options, true);
        if (complete) release();
      }),
  };
};
