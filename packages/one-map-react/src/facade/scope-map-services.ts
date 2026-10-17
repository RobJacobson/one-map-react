import type { MapServices } from "../contracts/adapter.js";
import type { LocationService } from "../contracts/location-types.js";

/** Setup owns only subscriptions made through its facade service view. */
export const scopeMapServices = (
  services: MapServices,
  override?: LocationService
): { readonly services: MapServices; readonly dispose: () => void } => {
  const provider = override ?? services.location;
  const subscriptions = new Set<() => void>();
  const pending = new Set<(error: Error) => void>();
  let generation = 0;
  const watchPosition: LocationService["watchPosition"] = (
    position,
    error,
    options
  ) => {
    const started = generation;
    let disposed = false;
    let release: (() => void) | undefined;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      subscriptions.delete(dispose);
      release?.();
    };
    // A provider may synchronously deliver a fix whose callback tears down setup.
    subscriptions.add(dispose);
    try {
      release = provider.watchPosition(
        (value) => {
          if (!disposed && started === generation) position(value);
        },
        (failure) => {
          if (!disposed && started === generation) error(failure);
        },
        options
      );
      if (disposed) release();
    } catch (failure) {
      dispose();
      throw failure;
    }
    return dispose;
  };
  return {
    services: {
      ...services,
      location: {
        requestPermission: () => provider.requestPermission(),
        watchPosition,
        getCurrentPosition: (options) =>
          new Promise((resolve, reject) => {
            const controller = new AbortController();
            const cancel = (): void =>
              retire(new Error("Location acquisition cancelled."));
            const finish = (): void => {
              pending.delete(retire);
              options?.signal?.removeEventListener("abort", cancel);
            };
            const retire = (error: Error): void => {
              controller.abort();
              finish();
              reject(error);
            };
            pending.add(retire);
            options?.signal?.addEventListener("abort", cancel);
            if (options?.signal?.aborted) cancel();
            void Promise.resolve()
              .then(() => {
                if (controller.signal.aborted)
                  throw new Error("Location acquisition cancelled.");
                return provider.getCurrentPosition({
                  ...options,
                  signal: controller.signal,
                });
              })
              .then(
                (position) => {
                  if (!controller.signal.aborted) resolve(position);
                  else reject(new Error("Location acquisition cancelled."));
                  finish();
                },
                (error) => {
                  finish();
                  reject(error);
                }
              );
          }),
      } satisfies LocationService,
    },
    dispose: () => {
      generation += 1;
      for (const reject of pending)
        reject(new Error("MapSetup detached during location acquisition."));
      pending.clear();
      // eslint-disable-next-line unicorn/no-useless-spread -- Snapshot subscriptions before callbacks can add or remove listeners during delivery.
      for (const release of [...subscriptions]) release();
    },
  };
};
