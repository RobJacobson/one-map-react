import { createContext, type MutableRefObject, useContext } from "react";

import type { MapRef } from "../contracts/camera-types.js";
import type { ClickEvent, MoveEvent } from "../contracts/event-types.js";

/** Map-local resources owned by the facade, released on logical unmount. */
export interface MapSession {
  readonly ref: MutableRefObject<MapRef | null>;
  readonly map: MapRef;
  readonly ready: boolean;
  /** An authoritative common viewState was supplied. */
  readonly cameraControlled?: boolean;
  readonly minZoom?: number;
  readonly maxZoom?: number;
  subscribe(
    event: "click" | "move",
    listener: (event: ClickEvent | MoveEvent) => void
  ): () => void;
}

export const MapSessionContext = createContext<MapSession | null>(null);

/** Returns map-local context, failing explicitly outside a shared Map. */
export const useMapSession = (): MapSession => {
  const session = useContext(MapSessionContext);
  if (!session) throw new Error("This component must render inside Map.");
  return session;
};

/** Optional context for adapters mounted directly by integration tests. */
export const useOptionalMapSession = (): MapSession | null =>
  useContext(MapSessionContext);
