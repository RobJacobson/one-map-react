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
