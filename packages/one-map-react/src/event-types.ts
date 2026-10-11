import type { ViewState } from "./camera-types.js";

/**
 * Who initiated a camera movement, when the wrapper can say.
 *
 * `unknown` is used when the wrapper does not distinguish user movement from
 * programmatic movement.
 */
export type MoveOrigin = "user" | "programmatic" | "unknown";

/**
 * Normalized camera-movement notification from {@link Map} `onMove`.
 */
export interface MoveEvent {
  /** Camera fields observed for this movement. */
  readonly viewState: ViewState;
  /** Movement origin, or `unknown` when the wrapper does not establish it. */
  readonly origin: MoveOrigin;
}

/**
 * Failure reported by the map wrapper.
 *
 * Web adapters copy the wrapper's `error` value. Mapbox native copies the
 * error string when iOS `onMapLoadingError` includes one. Android's pinned
 * `@rnmapbox/maps` 10.3.7 does not deliver that callback. MapLibre native
 * omits `error` because that wrapper drops the message before JavaScript.
 */
export interface MapErrorEvent {
  /** Wrapper or renderer error, when the callback includes one. */
  readonly error?: unknown;
}
