import type { LngLat, Point, ViewState } from "./camera-types.js";

/**
 * Who initiated a camera movement, when the wrapper can say.
 *
 * `unknown` is used when the wrapper does not distinguish user movement from
 * programmatic movement. Adapters do not invent `programmatic`.
 */
export type MoveOrigin = "user" | "programmatic" | "unknown";

/**
 * Normalized camera-movement notification.
 *
 * `onMove` is a changing camera. `onMoveStart` is the start, when the wrapper
 * has one. `onMoveEnd` is the settled camera. None of these is map idleness.
 */
export interface MoveEvent {
  /** Camera fields observed for this movement. */
  readonly viewState: ViewState;
  /** Movement origin, or `unknown` when the wrapper does not establish it. */
  readonly origin: MoveOrigin;
}

/**
 * A press or pointer hit on the map.
 *
 * Mouse, wheel, touch, double-click, and context-menu callbacks on web use
 * this same shape. `features` is omitted when the wrapper did not include any.
 */
export interface ClickEvent {
  /** `[longitude, latitude]` of the hit. */
  readonly lngLat: LngLat;
  /** `[x, y]` in logical map-view units. */
  readonly point: Point;
  /** Features the wrapper included with the hit, when it included any. */
  readonly features?: readonly object[];
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

/** Source feature activation, with optional propagation to the map callback. */
export interface SourceClickEvent extends ClickEvent {
  /** Source whose features were activated. */
  readonly sourceId: string;
  /** Prevents the enclosing map's callback for this activation. */
  stopPropagation(): void;
}
