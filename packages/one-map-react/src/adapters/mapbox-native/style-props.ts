import type { MapStyle } from "../../contracts/style-types.js";

/**
 * Converts a shared `mapStyle` into RNMapbox `styleURL` or serialized
 * `styleJSON`.
 *
 * @param mapStyle - Style URL or document.
 * @returns One defined style field, explicitly clearing the alternative.
 */
export const toRnmapboxStyleProps = (
  mapStyle: MapStyle
): { readonly styleURL?: string; readonly styleJSON?: string } => {
  if (typeof mapStyle === "string") {
    return { styleURL: mapStyle, styleJSON: undefined };
  }

  return { styleURL: undefined, styleJSON: JSON.stringify(mapStyle) };
};
