import type { MapStyle } from "../../contracts/style-types.js";
import type { GestureSettings } from "./gesture-settings.js";

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

/**
 * Merges two gesture settings objects. The second object wins for shared keys.
 *
 * @param base - Settings to use as a starting point.
 * @param overrides - Settings to apply over the base.
 * @returns The merged settings, or `undefined` when both inputs are absent.
 */
export const mergeGestureSettings = (
  base: GestureSettings | undefined,
  overrides: GestureSettings | undefined
): GestureSettings | undefined => {
  if (base === undefined && overrides === undefined) {
    return undefined;
  }

  return { ...base, ...overrides };
};
