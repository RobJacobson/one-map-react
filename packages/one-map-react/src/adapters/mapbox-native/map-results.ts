import type { Bounds } from "../../contracts/camera-types.js";
import { readFinitePair } from "../shared/index.js";

/**
 * Reads RNMapbox `getVisibleBounds()`.
 *
 * The pinned wrapper returns `[[rightLon, topLat], [leftLon, bottomLat]]`.
 * Conversion uses that order, including for bounds crossing the antimeridian.
 *
 * @param corners - Northeast corner, then southwest corner.
 * @returns Fresh southwest and northeast coordinate tuples.
 * @throws When either corner is not a finite longitude and latitude.
 */
export const boundsFromRnmapboxVisible = (
  corners: readonly (readonly number[])[]
): Bounds => {
  const northeastCorner = corners[0];
  const southwestCorner = corners[1];
  const northeast = readFinitePair(northeastCorner);
  const southwest = northeast && readFinitePair(southwestCorner);

  if (!northeast || !southwest) {
    throw new Error(
      "RNMapbox visible bounds must be a northeast corner and a southwest corner."
    );
  }

  return [southwest, northeast];
};

/**
 * Preserves missing terrain data and zero elevation.
 *
 * @param value - Elevation in meters reported by RNMapbox.
 * @returns Finite meters, or null when RNMapbox has no terrain data.
 * @throws When the result is nonnumeric or non-finite.
 */
export const normalizeElevation = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Terrain elevation must be finite meters or null.");
  }
  return value;
};
