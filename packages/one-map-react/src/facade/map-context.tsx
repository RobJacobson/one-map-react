import {
  type ComponentType,
  createContext,
  type RefAttributes,
  type RefObject,
  useContext,
} from "react";

import type { NativeBackend } from "../contracts/backend.js";
import type { MapRef } from "../contracts/camera-types.js";
import type { ImagesProps } from "../contracts/images-types.js";
import type { LayerProps } from "../contracts/layer-types.js";
import type { SourceProps } from "../contracts/source-types.js";
import type { Anchor, MarkerProps, MarkerRef } from "../contracts/ui-types.js";

/** Renderer components bound by one native entry. */
export interface NativeComponents {
  /** Native renderer used by these components. */
  readonly backend: NativeBackend;
  /** Source that nests child layers. */
  readonly Source: ComponentType<SourceProps>;
  /** Layer that receives a source ID from its parent. */
  readonly Layer: ComponentType<LayerProps>;
  /** Images registered with the mounted map. */
  readonly Images: ComponentType<ImagesProps>;
  /** Live view or annotation anchored to a coordinate. */
  readonly Marker: ComponentType<
    Omit<MarkerProps, "anchor"> & {
      readonly anchor: Anchor;
    } & RefAttributes<MarkerRef>
  >;
}

/** Resources owned by a mounted native map. */
export interface MapSession {
  readonly ref: RefObject<MapRef | null>;
  readonly map: MapRef;
  readonly ready: boolean;
  /** Components belonging to this map. */
  readonly components: NativeComponents;
}

export const MapSessionContext = createContext<MapSession | null>(null);

/**
 * Reads resources belonging to the nearest native map.
 *
 * @param component - Component name for a render without an enclosing map.
 * @returns The mounted map session.
 * @throws When the component renders outside Map.
 */
export const useMapSession = (component = "This component"): MapSession => {
  const session = useContext(MapSessionContext);
  if (!session) throw new Error(`${component} must render inside Map.`);
  return session;
};
