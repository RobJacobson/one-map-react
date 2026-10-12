/**
 * Error thrown when a camera command has no call the wrapper will apply.
 *
 * The camera or map ref is missing, or MapLibre Native has not reported style
 * load. Before that load, `setStop` can resolve after the native map drops the
 * stop.
 *
 * @returns An error describing the missing camera.
 */
export const missingCameraError = (): Error =>
  new Error("Map camera is not attached.");
