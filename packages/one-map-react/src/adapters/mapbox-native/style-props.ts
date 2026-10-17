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
 * Merges a context-supplied gesture settings object over the double-tap
 * entries derived from common gesture flags.
 *
 * @param extra - Settings from {@link MapboxGestureSettings}.
 * @param doubleTap - Double-tap entries derived from `doubleTapZoom`.
 * @returns The merged settings, or `undefined` when neither was provided.
 */
export const mergeGestureSettings = (
  extra: GestureSettings | undefined,
  doubleTap: GestureSettings | undefined
): GestureSettings | undefined => {
  if (extra === undefined && doubleTap === undefined) {
    return undefined;
  }

  return { ...extra, ...doubleTap };
};
