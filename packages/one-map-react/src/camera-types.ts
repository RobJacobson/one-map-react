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
 * Arguments for {@link MapRef.flyTo}.
 */
export interface FlyToOptions {
  /** Target center as `[longitude, latitude]`. */
  readonly center: readonly [number, number];
  /** Animation duration in milliseconds. */
  readonly duration: number;
}

/**
 * Imperative handle returned by {@link Map}.
 */
export interface MapRef {
  /**
   * Requests a flight to `options.center`.
   *
   * @param options - Center and duration for the flight.
   * @returns A promise that adopts the wrapper call's result. Fulfillment does
   * not mean the animation finished. RNMapbox resolves after synchronous
   * `setCamera`; MapLibre Native awaits `setStop` after style load; web
   * resolves after `flyTo` returns the map instance.
   * @throws When the camera or map ref is missing, or when MapLibre Native has
   * not yet reported that its style finished loading.
   */
  flyTo: (options: FlyToOptions) => Promise<void>;
}
