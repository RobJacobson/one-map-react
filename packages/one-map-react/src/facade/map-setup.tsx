import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type { Adapter, MapServices } from "../contracts/adapter.js";
import type { MapRef } from "../contracts/camera-types.js";
import type { LocationService } from "../contracts/location-types.js";

const ServicesContext = createContext<MapServices | null>(null);
const LocationOverrideContext = createContext<LocationService | undefined>(
  undefined
);

interface MapRegistry {
  register(id: string, map: MapRef): () => void;
  get(id: string): MapRef | undefined;
  subscribe(listener: () => void): () => void;
}

const AdapterContext = createContext<Adapter | null>(null);
const MapRegistryContext = createContext<MapRegistry | null>(null);

/** Props for the selected backend and its map tree. */
export interface MapSetupProps {
  /** Adapter imported from the selected backend entry; changing it requires a new setup key. */
  readonly adapter: Adapter;
  /** Explicit app permission/acquisition provider; changing it requires a new setup key. */
  readonly locationProvider?: LocationService;
  /** Shared map components and their surrounding application tree. */
  readonly children?: ReactNode;
}

/** Provides backend selection and a provider-local named map registry. */
export const MapSetup = ({
  adapter,
  locationProvider,
  children,
}: MapSetupProps) => {
  const [registry] = useState(createRegistry);
  const [initialAdapter] = useState(() => adapter);
  const [initialProvider] = useState(() => locationProvider);
  if (initialAdapter !== adapter)
    throw new Error("MapSetup adapter changed. Remount with a new key.");
  if (initialProvider !== locationProvider)
    throw new Error(
      "MapSetup locationProvider changed. Remount with a new key."
    );
  const scoped = useMemo(
    () => scopeServices(adapter.services, locationProvider),
    [adapter.services, locationProvider]
  );
  useLayoutEffect(() => () => scoped.dispose(), [scoped]);
  return (
    <AdapterContext.Provider value={adapter}>
      <ServicesContext.Provider value={scoped.services}>
        <LocationOverrideContext.Provider value={locationProvider}>
          <MapRegistryContext.Provider value={registry}>
            {children}
          </MapRegistryContext.Provider>
        </LocationOverrideContext.Provider>
      </ServicesContext.Provider>
    </AdapterContext.Provider>
  );
};

/** Returns the selected adapter, or fails when setup is missing. */
export const useSelectedAdapter = (): Adapter => {
  const adapter = useContext(AdapterContext);
  if (!adapter)
    throw new Error(
      "Map components must render inside MapSetup with a selected adapter."
    );
  return adapter;
};

/** Internal registry accessor; registration occurs during map attachment. */
export const useMapRegistry = (): MapRegistry => {
  const registry = useContext(MapRegistryContext);
  if (!registry) throw new Error("useMap requires MapSetup.");
  return registry;
};

/** Reads a named map and rerenders after its attachment changes. */
export const useNamedMap = (id: string | undefined): MapRef | undefined => {
  const registry = useMapRegistry();
  return useSyncExternalStore(
    registry.subscribe,
    () => (id === undefined ? undefined : registry.get(id)),
    () => undefined
  );
};

/** Optional scoped services for directly mounted adapter tests. */
export const useOptionalSetupServices = (): MapServices | null =>
  useContext(ServicesContext);

/** Reads scoped services; no attached Map is required. */
export const useSetupServices = (): MapServices => {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("useMapServices requires MapSetup.");
  return services;
};

/** Explicit setup override, preserving default browser SDK delegation. */
export const useLocationOverride = (): LocationService | undefined =>
  useContext(LocationOverrideContext);

/** Setup owns only subscriptions made through its facade service view. */
const scopeServices = (services: MapServices, override?: LocationService) => {
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

const createRegistry = (): MapRegistry => {
  const maps = new globalThis.Map<string, MapRef>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    get: (id) => maps.get(id),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    register: (id, map) => {
      if (maps.has(id))
        throw new Error(
          `Map id "${id}" is already registered in this MapSetup.`
        );
      maps.set(id, map);
      notify();
      return () => {
        if (maps.get(id) === map) {
          maps.delete(id);
          notify();
        }
      };
    },
  };
};
