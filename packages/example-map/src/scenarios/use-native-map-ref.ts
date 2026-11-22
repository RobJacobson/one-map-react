import type { MapRef } from "one-map-react";
import { type RefCallback, type RefObject, useCallback, useRef } from "react";

/**
 * Stores either selected native map handle for a shared scene.
 *
 * @returns The attached handle and its stable callback ref.
 */
export const useNativeMapRef = (): readonly [
  RefObject<MapRef | null>,
  RefCallback<MapRef>,
] => {
  const mapRef = useRef<MapRef>(null);
  const attachMap = useCallback((map: MapRef | null) => {
    mapRef.current = map;
  }, []);
  return [mapRef, attachMap];
};
