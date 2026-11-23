import { type RefCallback, type RefObject, useCallback, useRef } from "react";

import type { NativeSceneMap } from "./scene-components.js";

/**
 * Stores either selected native map handle for a shared scene.
 *
 * @returns The attached handle and its stable callback ref.
 */
export const useNativeMapRef = (): readonly [
  RefObject<NativeSceneMap | null>,
  RefCallback<NativeSceneMap>,
] => {
  const mapRef = useRef<NativeSceneMap>(null);
  const attachMap = useCallback((map: NativeSceneMap | null) => {
    mapRef.current = map;
  }, []);
  return [mapRef, attachMap];
};
