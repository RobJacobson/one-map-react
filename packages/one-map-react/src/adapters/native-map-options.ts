/**
 * Rejects `resize()` because native size follows the host style.
 *
 * @returns A rejected promise.
 * @throws Error describing how the native map size is set.
 */
export const rejectNativeResize = async (): Promise<never> => {
  throw new Error(
    "resize() is not available on native maps. Size follows the host style."
  );
};

/**
 * Rejects `stop()` because the pinned native cameras have no cancel method.
 *
 * @returns A rejected promise.
 * @throws Error stating that native maps cannot cancel a camera command.
 */
export const rejectNativeStop = async (): Promise<never> => {
  throw new Error("stop() is not available on native maps.");
};

/**
 * Error for a getter the selected native wrapper does not expose.
 *
 * @param method - Common method name, without parentheses.
 * @param backend - Adapter backend name.
 * @returns An error naming the method and backend.
 */
export const unavailableMapMethodError = (
  method: string,
  backend: string
): Error => new Error(`${method}() is not available on ${backend}.`);
