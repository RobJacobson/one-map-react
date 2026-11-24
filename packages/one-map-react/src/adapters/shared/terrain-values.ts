/** Preserves missing data and zero while rejecting malformed SDK results. */
export const normalizeElevation = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("Terrain elevation must be finite meters or null.");
  return value;
};
