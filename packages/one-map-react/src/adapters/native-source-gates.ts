import type {
  GeoJsonSourceProps,
  SourceProps,
} from "../contracts/source-types.js";

/**
 * Throws when a native wrapper cannot honor a portable source option.
 *
 * @param value - Portable option value from the current render.
 * @param name - Portable option name used in the error message.
 * @param backend - Native adapter the source will render through.
 * @param reason - Why the pinned wrapper cannot honor the option.
 * @throws When the option was provided.
 */
export const rejectProvided = (
  value: unknown,
  name: string,
  backend: string,
  reason: string
): void => {
  if (value !== undefined) {
    throw new Error(`${name} is not available on ${backend}. ${reason}`);
  }
};

/**
 * Rejects GeoJSON options the pinned native wrappers cannot honor.
 *
 * @param props - GeoJSON source props from the current render.
 * @param backend - Native adapter the source will render through.
 * @throws When `generateId` or `promoteId` was provided.
 */
export const rejectNativeGeoJsonOptions = (
  props: GeoJsonSourceProps,
  backend: "mapbox-native" | "maplibre-native"
): void => {
  rejectProvided(
    props.generateId,
    "generateId",
    backend,
    "The pinned native wrappers declare no generateId source prop."
  );
  rejectProvided(
    props.promoteId,
    "promoteId",
    backend,
    "The pinned native wrappers declare no promoteId source prop."
  );
};

/**
 * Rejects a raster-dem tile scheme the pinned native wrappers cannot honor.
 *
 * @param scheme - Portable tile coordinate scheme.
 * @param backend - Native adapter the source will render through.
 * @throws When a scheme was provided.
 */
export const rejectRasterDemScheme = (
  scheme: Extract<SourceProps, { type: "raster-dem" }>["scheme"],
  backend: "mapbox-native" | "maplibre-native"
): void => {
  rejectProvided(
    scheme,
    "scheme",
    backend,
    "The pinned native DEM wrappers declare no scheme or tms prop."
  );
};
