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
