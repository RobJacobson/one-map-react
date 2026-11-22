import type { MapRef } from "../contracts/camera-types.js";

/** Registers mounted handles and publishes a new snapshot on attachment changes. */
export interface MapRegistry<Handle extends MapRef> {
  /** Registers a handle by ID or by the default name and returns cleanup. */
  register(id: string | undefined, map: Handle): () => void;
  /** Reads the current attachment snapshot. */
  getSnapshot(): ReadonlyMap<string, Handle>;
  /** Subscribes to attachment changes and returns the unsubscribe callback. */
  subscribe(listener: () => void): () => void;
}

/**
 * Creates independent storage for one mounted provider.
 *
 * @returns Registry that keeps its snapshot stable until a map attaches or detaches.
 */
export const createMapRegistry = <
  Handle extends MapRef,
>(): MapRegistry<Handle> => {
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
    register: (requestedId, map) => {
      const id = requestedId ?? "default";
      if (maps.has(id))
        throw new Error(
          `Map id "${id}" is already registered in this MapProvider.`
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
