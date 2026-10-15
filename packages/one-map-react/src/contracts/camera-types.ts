import type {
  ClusterQueryMethods,
  FeatureQueryMethods,
  FeatureStateMethods,
} from "./query-types.js";

/**
 * Longitude and latitude, in degrees, as `[longitude, latitude]`.
 */
export type LngLat = readonly [number, number];

/**
 * A point in the map view, as `[x, y]`.
 *
 * Web values are CSS pixels. Native values are layout points. Adapters do
 * not apply a second pixel-density conversion.
 */
export type Point = readonly [number, number];

/**
 * Southwest then northeast corners.
 *
 * The order is `[[west, south], [east, north]]`. A west value greater than
 * east is a span across the antimeridian, so converters do not sort the
 * numbers.
 */
export type Bounds = readonly [LngLat, LngLat];

/**
 * Camera padding in logical map-view units.
 *
 * Missing sides become `0` when a converter builds a wrapper padding value.
 */
export interface Padding {
  /** Space above the camera center. */
  readonly top?: number;
  /** Space to the right of the camera center. */
  readonly right?: number;
  /** Space below the camera center. */
  readonly bottom?: number;
  /** Space to the left of the camera center. */
  readonly left?: number;
}

/**
 * Progress function for an eased camera command.
 *
 * @param progress - Input from 0 to 1.
 * @returns The eased progress.
 */
export type CameraEasing = (progress: number) => number;

/**
 * Camera center, zoom, and orientation used by the shared map.
 */
export interface ViewState {
  /** Longitude of the camera center, in degrees. */
  readonly longitude: number;
  /** Latitude of the camera center, in degrees. */
  readonly latitude: number;
  /** Zoom level of the camera. */
  readonly zoom: number;
  /** Bearing in degrees, clockwise from north. */
  readonly bearing: number;
  /** Pitch in degrees from top-down. */
  readonly pitch: number;
}

/**
 * Partial camera target shared by jump, ease, and flight commands.
 */
export interface CameraCommandOptions {
  /** Target center as `[longitude, latitude]`. */
  readonly center?: LngLat;
  /** Target zoom level. */
  readonly zoom?: number;
  /** Target bearing in degrees, clockwise from north. */
  readonly bearing?: number;
  /** Target pitch in degrees from top-down. */
  readonly pitch?: number;
  /** Target padding. Missing sides become zero at the conversion boundary. */
  readonly padding?: Padding;
  /**
   * Animation duration in milliseconds.
   *
   * Omitted duration leaves the selected wrapper's duration for that command.
   * `jumpTo` rejects a duration other than `0`.
   */
  readonly duration?: number;
  /**
   * Easing function.
   *
   * Web commands forward it. Native commands reject it. The command name
   * selects native movement instead.
   */
  readonly easing?: CameraEasing;
}

/**
 * Arguments for {@link MapRef.flyTo}.
 *
 * `center` stays required. `duration` is optional so an omitted duration can
 * use the wrapper default while `flyTo({ center, duration })` still works.
 */
export interface FlyToOptions extends CameraCommandOptions {
  /** Target center as `[longitude, latitude]`. */
  readonly center: LngLat;
}

/**
 * Arguments for {@link MapRef.fitBounds}.
 */
export interface FitBoundsOptions {
  /** Padding around the fitted bounds. */
  readonly padding?: Padding;
  /** Animation duration in milliseconds. */
  readonly duration?: number;
  /** Bearing to apply while fitting. */
  readonly bearing?: number;
  /** Pitch to apply while fitting. */
  readonly pitch?: number;
  /**
   * Easing function.
   *
   * Web forwards it. Native rejects it.
   */
  readonly easing?: CameraEasing;
  /**
   * Highest zoom the fit may use on web.
   *
   * Native adapters reject a supplied value because the pinned React
   * wrappers do not expose a fit-specific cap. Native cap coverage is pending.
   */
  readonly maxZoom?: number;
}

/**
 * Arguments for {@link MapRef.zoomTo}.
 */
export interface ZoomToOptions {
  /** Animation duration in milliseconds. `0` is a jump. */
  readonly duration?: number;
  /**
   * Easing function.
   *
   * Web forwards it. Native rejects it.
   */
  readonly easing?: CameraEasing;
}

/**
 * Imperative handle returned by {@link Map}.
 *
 * Command promises adopt the wrapper call. Fulfillment means the wrapper
 * accepted the call. It does not mean the animation finished or a frame
 * was painted. A missing camera or map ref rejects before the wrapper call.
 *
 * Query, cluster, and feature-state methods are defined by
 * {@link FeatureQueryMethods}, {@link ClusterQueryMethods}, and
 * {@link FeatureStateMethods}.
 */
export interface MapRef
  extends FeatureQueryMethods,
    ClusterQueryMethods,
    FeatureStateMethods {
  /**
   * Captures an attached rendered map. Rejects on detachment or deadline.
   * @param options - Explicit scope, output, and optional deadline.
   * @returns PNG output; requires captureEnabled on the Map.
   */
  capture(
    options: import("./capture-types.js").CaptureOptions
  ): Promise<import("./capture-types.js").MapCapture>;

  /**
   * Moves the camera without animation.
   *
   * @param options - Partial camera target. A duration other than `0`, or an
   * easing function, is rejected.
   * @returns A promise that adopts the wrapper call.
   * @throws When the camera or map ref is missing, MapLibre Native has not
   * reported style load, or `options` asks for animation.
   */
  jumpTo: (options: CameraCommandOptions) => Promise<void>;
  /**
   * Eases the camera to a partial target.
   *
   * @param options - Partial camera target and optional duration.
   * @returns A promise that adopts the wrapper call.
   * @throws When the camera or map ref is missing, MapLibre Native has not
   * reported style load, or a native caller passes `easing`.
   */
  easeTo: (options: CameraCommandOptions) => Promise<void>;
  /**
   * Requests a flight to `options.center`.
   *
   * @param options - Center, optional camera fields, and optional duration.
   * @returns A promise that adopts the wrapper call. RNMapbox resolves after
   * synchronous `setCamera` with `animationMode: "flyTo"`. MapLibre Native
   * awaits `setStop` after style load. Web resolves after `flyTo` returns
   * the map instance.
   * @throws When the camera or map ref is missing, MapLibre Native has not
   * reported style load, or a native caller passes `easing`.
   */
  flyTo: (options: FlyToOptions) => Promise<void>;
  /**
   * Frames the given bounds.
   *
   * @param bounds - Southwest then northeast corners.
   * @param options - Padding, duration, bearing, pitch, easing, and max zoom.
   * @returns A promise that adopts the wrapper call.
   * @throws When the bounds are not two coordinate pairs, the camera or map
   * ref is missing, MapLibre Native has not reported style load, or a native
   * caller passes `easing`.
   */
  fitBounds: (bounds: Bounds, options?: FitBoundsOptions) => Promise<void>;
  /**
   * Changes zoom.
   *
   * @param zoom - Target zoom level.
   * @param options - Duration and easing. Duration `0` is a jump.
   * @returns A promise that adopts the wrapper call.
   * @throws When the camera or map ref is missing, MapLibre Native has not
   * reported style load, or a native caller passes `easing`.
   */
  zoomTo: (zoom: number, options?: ZoomToOptions) => Promise<void>;
  /**
   * Cancels an in-progress camera animation when the wrapper has a cancel.
   *
   * @returns A promise that adopts the web `stop()` call.
   * @throws When the map ref is missing, or when the adapter is native.
   * Native wrappers have no camera-cancel method.
   */
  stop: () => Promise<void>;
  /**
   * Reads the camera center.
   *
   * @returns `[longitude, latitude]`.
   * @throws When the map ref is missing.
   */
  getCenter: () => Promise<LngLat>;
  /**
   * Reads the camera zoom.
   *
   * @returns The current zoom level.
   * @throws When the map ref is missing.
   */
  getZoom: () => Promise<number>;
  /**
   * Reads the camera bearing.
   *
   * @returns Bearing in degrees, clockwise from north.
   * @throws When the map ref is missing, or on mapbox-native, which has no
   * bearing getter.
   */
  getBearing: () => Promise<number>;
  /**
   * Reads the camera pitch.
   *
   * @returns Pitch in degrees from top-down.
   * @throws When the map ref is missing, or on mapbox-native, which has no
   * pitch getter.
   */
  getPitch: () => Promise<number>;
  /**
   * Reads the camera padding.
   *
   * @returns Padding with every side present.
   * @throws When the map ref is missing, or on a native adapter. Those
   * wrappers do not return padding.
   */
  getPadding: () => Promise<Required<Padding>>;
  /**
   * Reads the visible bounds.
   *
   * @returns Southwest then northeast corners.
   * @throws When the map ref is missing or the wrapper value has no corner
   * pair.
   */
  getBounds: () => Promise<Bounds>;
  /**
   * Reads the minimum zoom constraint.
   *
   * @returns The wrapper's minimum zoom.
   * @throws When the map ref is missing, or on a native adapter.
   */
  getMinZoom: () => Promise<number>;
  /**
   * Reads the maximum zoom constraint.
   *
   * @returns The wrapper's maximum zoom.
   * @throws When the map ref is missing, or on a native adapter.
   */
  getMaxZoom: () => Promise<number>;
  /**
   * Reads the panning limit.
   *
   * @returns Southwest then northeast corners, or `null` when the wrapper
   * has no limit.
   * @throws When the map ref is missing, or on a native adapter.
   */
  getMaxBounds: () => Promise<Bounds | null>;
  /**
   * Converts a coordinate to a point in the map view.
   *
   * @param lngLat - `[longitude, latitude]`.
   * @returns `[x, y]` in logical map-view units.
   * @throws When the map ref is missing.
   */
  project: (lngLat: LngLat) => Promise<Point>;
  /**
   * Converts a map-view point to a coordinate.
   *
   * @param point - `[x, y]` in logical map-view units.
   * @returns `[longitude, latitude]`.
   * @throws When the map ref is missing.
   */
  unproject: (point: Point) => Promise<LngLat>;
  /**
   * Asks a web map to measure its container.
   *
   * @returns A promise that fulfills when the wrapper accepts the call.
   * Fulfillment does not mean a frame was painted.
   * @throws When the web map ref is missing, or when the adapter is native.
   * Native maps take their size from the host style and have no resize method.
   */
  resize: () => Promise<void>;
}
