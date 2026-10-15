import type { LngLat } from "../../contracts/camera-types.js";

/** Validates the geographic input before dispatching an elevation query. */
export const validateTerrainCoordinate = (coordinate: LngLat): void => {
  if (
    !Array.isArray(coordinate) ||
    coordinate.length !== 2 ||
    !Number.isFinite(coordinate[0]) ||
    !Number.isFinite(coordinate[1]) ||
    Math.abs(coordinate[1]) > 90
  ) {
    throw new RangeError(
      "Terrain coordinates require finite longitude and latitude within -90 to 90 degrees."
    );
  }
};

/** Preserves missing data and zero while rejecting malformed SDK results. */
export const normalizeElevation = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("Terrain elevation must be finite meters or null.");
  return value;
};
