import type { NativeBackend } from "../contracts/backend.js";
import type {
  GeoJsonSourceProps,
  RasterDemSourceProps,
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
  backend: NativeBackend,
  reason: string
): void => {
  if (value !== undefined) {
    throw new Error(`${name} is not available on ${backend}. ${reason}`);
  }
};

/**
 * Rejects GeoJSON `generateId`, which neither pinned native wrapper declares.
 *
 * @param generateId - Portable GeoJSON `generateId` option.
 * @param backend - Native adapter the source will render through.
 * @throws When `generateId` was provided.
 */
export const rejectNativeGeoJsonGenerateId = (
  generateId: GeoJsonSourceProps["generateId"],
  backend: NativeBackend
): void => {
  rejectProvided(
    generateId,
    "generateId",
    backend,
    "The pinned native wrappers declare no generateId source prop."
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
  scheme: RasterDemSourceProps["scheme"],
  backend: NativeBackend
): void => {
  rejectProvided(
    scheme,
    "scheme",
    backend,
    "The pinned native DEM wrappers declare no scheme or tms prop."
  );
};
