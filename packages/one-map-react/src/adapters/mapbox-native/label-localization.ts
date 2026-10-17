import * as Rnmapbox from "@rnmapbox/maps";

/**
 * Rejects the SDK-v10-only wrapper prop when the installed wrapper cannot localize v11 labels.
 *
 * @param value - Supplied wrapper localizeLabels option, including an explicit false from JavaScript.
 * @throws When a supplied option would silently do nothing on RNMapbox 10.3.7.
 */
export const assertLabelLocalization = (value: unknown): void => {
  // RNMapbox 10.3.8 adds both v11 localizeLabels and public setLanguage.
  if (
    value !== undefined &&
    (!("setLanguage" in Rnmapbox) || typeof Rnmapbox.setLanguage !== "function")
  ) {
    throw new Error(
      "localizeLabels with Mapbox Maps SDK v11 requires @rnmapbox/maps 10.3.8 or newer."
    );
  }
};
