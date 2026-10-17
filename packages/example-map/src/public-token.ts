/**
 * Accepts only a public runtime token before it can enter a client bundle.
 *
 * @param value - Environment value; whitespace is ignored.
 * @returns Trimmed public token or an empty string when unset.
 * @throws When a supplied value is not a public Mapbox token.
 */
export const publicMapboxToken = (value: string | undefined): string => {
  const token = value?.trim() ?? "";
  if (token && !token.startsWith("pk."))
    throw new Error("Configure a public Mapbox token beginning with pk.");
  return token;
};
