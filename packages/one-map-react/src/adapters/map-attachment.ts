import { type Ref, useImperativeHandle, useState } from "react";

/**
 * Attaches the same handle for the lifetime of a mounted native map.
 *
 * @param ref - Current consumer of the handle.
 * @param createHandle - Pure initializer whose methods read the live attachment.
 * @returns The adapter handle that owns events from this map.
 */
export const useNativeMapHandle = <Handle>(
  ref: Ref<Handle>,
  createHandle: () => Handle
): Handle => {
  const [handle] = useState(createHandle);
  useImperativeHandle(ref, () => handle, [handle]);
  return handle;
};

/**
 * Returns the attached map with its concrete type.
 *
 * @param map - The current map attachment.
 * @returns The attached map.
 * @throws Error when the map is detached.
 */
export const requireAttachedMap = <Map extends object>(
  map: Map | null
): Map => {
  if (!map) throw missingMapError();

  return map;
};

/** Creates the error reported by commands that require an attached map. */
export const missingMapError = (): Error => new Error("Map is not attached.");

/**
 * Creates the error for a camera command whose wrapper is unavailable.
 *
 * The camera ref is missing, or MapLibre React Native has yet to finish loading
 * the map. Before that load, `setStop` can resolve after the native map drops
 * the stop.
 *
 * @returns An error describing the missing camera.
 */
export const missingCameraError = (): Error =>
  new Error("Map camera is not attached.");
