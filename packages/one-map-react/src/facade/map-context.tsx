import { createContext, type MutableRefObject, useContext } from "react";

import type { MapRef } from "../contracts/camera-types.js";

/** Map-local resources owned by the facade, released on logical unmount. */
export interface MapSession {
  readonly ref: MutableRefObject<MapRef | null>;
  readonly map: MapRef;
  readonly ready: boolean;
}

export const MapSessionContext = createContext<MapSession | null>(null);

/** Returns map-local context, failing explicitly outside a shared Map. */
export const useMapSession = (): MapSession => {
  const session = useContext(MapSessionContext);
  if (!session) throw new Error("This component must render inside Map.");
  return session;
};
