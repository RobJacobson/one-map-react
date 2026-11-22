import {
  createContext,
  type ReactNode,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";

import type { Adapter } from "../contracts/adapter.js";
import type { MapRef } from "../contracts/camera-types.js";
/** Registers mounted handles and publishes a new snapshot on attachment changes. */
export interface MapRegistry<Handle extends MapRef> {
  /** Registers one handle and returns its matching cleanup. */
  register(id: string, map: Handle): () => void;
  /** Reads the current attachment snapshot. */
  getSnapshot(): ReadonlyMap<string, Handle>;
  /** Subscribes to attachment changes and returns the unsubscribe callback. */
  subscribe(listener: () => void): () => void;
}

/** Adapter for the legacy facade and root components nested in a bound map. */
export const AdapterContext = createContext<Adapter | null>(null);
const MapRegistryContext = createContext<MapRegistry<MapRef> | null>(null);

/** Props for the selected backend and its map tree. */
export interface MapSetupProps {
  /** Adapter imported from the selected backend entry; changing it requires a new setup key. */
  readonly adapter: Adapter;
  /** Shared map components and their surrounding application tree. */
  readonly children?: ReactNode;
}

/**
 * Provides native backend selection and a provider-local named map registry.
 *
 * @deprecated Import Map from the selected native entry and use MapProvider
 * for optional named lookup.
 */
export const MapSetup = ({ adapter, children }: MapSetupProps) => {
  if (
    adapter.backend !== "mapbox-native" &&
    adapter.backend !== "maplibre-native"
  )
    throw new Error("MapSetup requires a native adapter.");
  const [registry] = useState(() => createMapRegistry<MapRef>("MapSetup"));
  const [initialAdapter] = useState(() => adapter);
  if (initialAdapter !== adapter)
    throw new Error("MapSetup adapter changed. Remount with a new key.");
  return (
    <AdapterContext.Provider value={adapter}>
      <MapRegistryContext.Provider value={registry}>
        {children}
      </MapRegistryContext.Provider>
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

/**
 * Reads the legacy setup's registry when one is present.
 *
 * @returns Registry owned by the nearest MapSetup, or null.
 */
export const useMapRegistry = (): MapRegistry<MapRef> | null =>
  useContext(MapRegistryContext);

/** Reads a named map and rerenders after its attachment changes. */
export const useNamedMap = (id: string | undefined): MapRef | undefined => {
  const registry = useContext(MapRegistryContext);
  const named = useSyncExternalStore(
    registry?.subscribe ?? noMapSubscription,
    () => (id === undefined ? undefined : registry?.getSnapshot().get(id)),
    () => undefined
  );
  if (id !== undefined && !registry)
    throw new Error("useMap requires MapSetup.");
  return named;
};

/**
 * Creates independent storage for one mounted provider.
 *
 * @param provider - Public component name for duplicate-ID errors.
 * @returns Registry that keeps its snapshot stable until a map attaches or detaches.
 */
export const createMapRegistry = <Handle extends MapRef>(
  provider: "MapSetup" | "MapProvider"
): MapRegistry<Handle> => {
  let maps = new globalThis.Map<string, Handle>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => maps,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    register: (id, map) => {
      if (maps.has(id))
        throw new Error(
          `Map id "${id}" is already registered in this ${provider}.`
        );
      maps = new globalThis.Map(maps).set(id, map);
      notify();
      return () => {
        if (maps.get(id) === map) {
          maps = new globalThis.Map(maps);
          maps.delete(id);
          notify();
        }
      };
    },
  };
};

/**
 * Supplies the external-store unsubscribe protocol outside a provider.
 *
 * @returns Inert unsubscribe callback.
 */
export const noMapSubscription = (): (() => void) => () => undefined;
