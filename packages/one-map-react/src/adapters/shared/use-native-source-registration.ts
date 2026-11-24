import type { RefObject } from "react";
import { useLayoutEffect } from "react";

import type { NativeSourceRegistry } from "./native-source-registry.js";

/**
 * Registers the source for the lifetime of its ID in the current map.
 *
 * @param options - The map registry, source ID, wrapper ref, and stable ref mapper.
 */
export const useNativeSourceRegistration = <Ref, Source, GeoJsonRef>({
  registry,
  id,
  sourceRef,
  toRegistration,
}: {
  registry: NativeSourceRegistry<Source, GeoJsonRef> | null;
  id: string;
  sourceRef: RefObject<Ref | null>;
  toRegistration: (ref: Ref) => Source;
}): void => {
  useLayoutEffect(
    () =>
      registry?.register(id, () => {
        // The wrapper can refresh its imperative handle on a later render.
        const ref = sourceRef.current;
        return ref === null ? undefined : toRegistration(ref);
      }),
    [registry, id, sourceRef, toRegistration]
  );
};
