import {
  createContext,
  type ReactNode,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";

import type { Adapter } from "../contracts/adapter.js";
import type { MapRef } from "../contracts/camera-types.js";
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
  /** Shared map components and their surrounding application tree. */
  readonly children?: ReactNode;
}

/** Provides backend selection and a provider-local named map registry. */
export const MapSetup = ({ adapter, children }: MapSetupProps) => {
  const [registry] = useState(createRegistry);
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
