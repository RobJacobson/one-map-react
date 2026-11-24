/**
 * Error thrown when a camera command has no call the wrapper will apply.
 *
 * The camera ref is missing, or MapLibre React Native has yet to finish loading
 * the map. Before that load, `setStop` can resolve after the native map drops
 * the stop.
 *
 * @returns An error describing the missing camera.
 */
export const missingCameraError = (): Error =>
  new Error("Map camera is not attached.");
