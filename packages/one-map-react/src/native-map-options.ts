import type { ExternalDrawingContext } from "./map-types.js";

/**
 * Rejects map options the native wrappers do not implement.
 *
 * @param reuseMaps - Common reuse flag. `true` is rejected.
 * @param gl - Web drawing context. A provided value is rejected.
 * @throws When `reuseMaps` is true or `gl` is provided.
 */
export const assertNativeMapOptions = (
  reuseMaps: boolean | undefined,
  gl: ExternalDrawingContext | undefined
): void => {
  if (reuseMaps === true) {
    throw nativeReuseError();
  }

  if (gl !== undefined) {
    throw nativeDrawingContextError();
  }
};

const nativeReuseError = (): Error =>
  new Error(
    "reuseMaps is not available on native maps. Remounting creates a new map."
  );

const nativeDrawingContextError = (): Error =>
  new Error("gl is a web drawing context and is not available on native maps.");

/**
 * Error for `resize()` on a native map.
 *
 * @returns An error stating that native size follows the host style.
 */
export const nativeResizeError = (): Error =>
  new Error(
    "resize() is not available on native maps. Size follows the host style."
  );
