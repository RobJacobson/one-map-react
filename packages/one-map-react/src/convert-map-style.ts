import type { MapStyle } from "./style-types.js";

/**
 * Converts a shared `mapStyle` into RNMapbox `styleURL` or serialized
 * `styleJSON`.
 *
 * @param mapStyle - Style URL or document.
 * @returns Exactly one of `styleURL` or `styleJSON`.
 */
export const toRnmapboxStyleProps = (
  mapStyle: MapStyle
): { readonly styleURL: string } | { readonly styleJSON: string } => {
  if (typeof mapStyle === "string") {
    return { styleURL: mapStyle };
  }

  return { styleJSON: JSON.stringify(mapStyle) };
};
