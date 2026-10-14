import { createContext, type MutableRefObject, useContext } from "react";

import type { MapRef, ViewState } from "../contracts/camera-types.js";
import type {
  ClickEvent,
  MoveEvent,
  SourceClickEvent,
} from "../contracts/event-types.js";
import type { ControlPosition } from "../contracts/ui-types.js";

/** Native renderer ornaments requested by mounted controls. */
export type OrnamentName = "attribution" | "compass" | "scale" | "logo";

/** Map-local resources owned by the facade, released on logical unmount. */
export interface MapSession {
  readonly ref: MutableRefObject<MapRef | null>;
  readonly map: MapRef;
  readonly ready: boolean;
  /** An authoritative common viewState was supplied. */
  readonly cameraControlled?: boolean;
  /** Selected native camera is already following device location. */
  readonly nativeLocationFollowing?: boolean;
  readonly viewState: ViewState | null;
  readonly minZoom?: number;
  readonly maxZoom?: number;
  readonly gestureLocked: boolean;
  /** Unique native portal host for this map's controls. */
  readonly overlayHostName: string;
  readonly ornaments: Partial<
    Record<OrnamentName, Readonly<Record<string, unknown>>>
  >;
  subscribe(
    event: "click" | "move",
    listener: (event: ClickEvent | MoveEvent) => void
  ): () => void;
  emit(event: "click" | "move", payload: ClickEvent | MoveEvent): void;
  requestGestureLock(locked: boolean): void;
  /** Measured native viewport used to reproject live overlays after layout. */
  readonly nativeLayout?: { readonly width: number; readonly height: number };
  setNativeLayout(width: number, height: number): void;
  setOrnament(
    name: OrnamentName,
    options: Readonly<Record<string, unknown>> | null
  ): void;
  setOverlay(
    id: string,
    position: ControlPosition | null,
    height?: number
  ): void;
  registerSource(
    id: string,
    callback: (event: SourceClickEvent) => void,
    attachment: object
  ): () => void;
  dispatchSource(id: string, event: ClickEvent): void;
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

/** Native control placement; children stay in their original React ancestry. */
export interface NativeOverlay {
  readonly id: string;
  readonly position: ControlPosition;
  readonly height: number;
}
export const NativeOverlayContext = createContext<readonly NativeOverlay[]>([]);
