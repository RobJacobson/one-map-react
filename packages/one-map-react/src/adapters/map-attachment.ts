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
