import type {
  ExternalDrawingContext,
  MapProps,
} from "../contracts/map-types.js";

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

/**
 * Error for `stop()` on a native map.
 *
 * The pinned native cameras have no cancel method. The facade does not
 * invent one by sending another camera update.
 *
 * @returns An error stating that native maps cannot cancel a camera command.
 */
export const nativeStopError = (): Error =>
  new Error("stop() is not available on native maps.");

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

const nativeRejectedNames = [
  "scrollZoom",
  "doubleClickZoom",
  "dragRotate",
  "boxZoom",
  "keyboard",
  "cooperativeGestures",
  "clickTolerance",
  "hash",
  "onDblClick",
  "onContextMenu",
  "onMouseDown",
  "onMouseUp",
  "onMouseMove",
  "onMouseEnter",
  "onMouseLeave",
  "onMouseOver",
  "onMouseOut",
  "onWheel",
  "onDrag",
  "onDragStart",
  "onDragEnd",
  "onTouchStart",
  "onTouchMove",
  "onTouchEnd",
  "onTouchCancel",
] as const;

/**
 * Rejects desktop interaction options and pointer callbacks.
 *
 * Undefined means the caller did not request the option. `false` is still a
 * request and is rejected.
 *
 * @param props - Map props that may include web-only fields.
 * @throws When any listed field is set.
 */
export const assertNativeDesktopOptions = (props: MapProps): void => {
  for (const name of nativeRejectedNames) {
    if (props[name] !== undefined) {
      throw nativeDesktopOptionError(name);
    }
  }
};

const nativeDesktopOptionError = (name: string): Error =>
  new Error(`${name} is not available on native maps.`);
