import type {
  Bounds,
  CameraCommandOptions,
  CameraEasing,
  FitBoundsOptions,
  FlyToOptions,
  LngLat,
  Padding,
  Point,
  ViewState,
  ZoomToOptions,
} from "./camera-types.js";

/**
 * Copies the portable camera fields for react-map-gl `initialViewState`.
 *
 * @param viewState - Shared camera fields.
 * @returns The same longitude, latitude, zoom, bearing, and pitch.
 */
export const toWebInitialViewState = (viewState: ViewState): ViewState => ({
  longitude: viewState.longitude,
  latitude: viewState.latitude,
  zoom: viewState.zoom,
  bearing: viewState.bearing,
  pitch: viewState.pitch,
});

/**
 * Converts shared camera fields into RNMapbox `Camera.defaultSettings`.
 *
 * @param viewState - Shared camera fields.
 * @returns RNMapbox center, zoom, heading, and pitch.
 */
export const toRnmapboxDefaultSettings = (viewState: ViewState) => ({
  centerCoordinate: [viewState.longitude, viewState.latitude],
  zoomLevel: viewState.zoom,
  heading: viewState.bearing,
  pitch: viewState.pitch,
});

/**
 * Converts a controlled view into RNMapbox camera props.
 *
 * `animationMode` is `none` so the update does not use Android's default
 * ease or iOS's default flight. This writes the React camera onto the
 * wrapper. It does not by itself prove that an unaccepted gesture returns.
 *
 * @param viewState - Camera supplied by React.
 * @returns RNMapbox center, zoom, heading, pitch, and a non-animated update.
 */
export const toRnmapboxControlledCamera = (viewState: ViewState) => ({
  centerCoordinate: [viewState.longitude, viewState.latitude] as LngLat,
  zoomLevel: viewState.zoom,
  heading: viewState.bearing,
  pitch: viewState.pitch,
  animationDuration: 0,
  animationMode: "none" as const,
});

/**
 * Converts a controlled view into MapLibre Native camera props.
 *
 * These props are written beside `initialViewState`. Whether an unaccepted
 * gesture returns to them is unverified.
 *
 * @param viewState - Camera supplied by React.
 * @returns MapLibre center, zoom, bearing, and pitch.
 */
export const toMaplibreControlledCamera = (viewState: ViewState) => ({
  center: [viewState.longitude, viewState.latitude] as LngLat,
  zoom: viewState.zoom,
  bearing: viewState.bearing,
  pitch: viewState.pitch,
});

/**
 * Converts shared camera fields into MapLibre Native `Camera.initialViewState`.
 *
 * @param viewState - Shared camera fields.
 * @returns MapLibre Native center, zoom, bearing, and pitch.
 */
export const toMaplibreInitialViewState = (viewState: ViewState) => ({
  center: [viewState.longitude, viewState.latitude] as LngLat,
  zoom: viewState.zoom,
  bearing: viewState.bearing,
  pitch: viewState.pitch,
});

/**
 * Fills omitted padding sides with zero.
 *
 * @param padding - Partial padding, one number for every side, or omitted.
 * @returns Padding with `top`, `right`, `bottom`, and `left`.
 */
export const normalizePadding = (
  padding?: Padding | number
): Required<Padding> => {
  if (typeof padding === "number") {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }

  return {
    top: padding?.top ?? 0,
    right: padding?.right ?? 0,
    bottom: padding?.bottom ?? 0,
    left: padding?.left ?? 0,
  };
};

/**
 * Checks southwest-then-northeast bounds without sorting them.
 *
 * @param bounds - Candidate bounds.
 * @returns The same corner pair.
 * @throws When either corner is not a finite longitude and latitude.
 */
export const assertBounds = (bounds: Bounds): Bounds => {
  const southwest = bounds?.[0];
  const northeast = bounds?.[1];

  if (!isLngLat(southwest) || !isLngLat(northeast)) {
    throw new Error("Bounds must be [[west, south], [east, north]].");
  }

  return [southwest, northeast];
};

/**
 * Converts bounds to `[west, south, east, north]`.
 *
 * @param bounds - Southwest then northeast corners.
 * @returns A flat bounds tuple. West may be greater than east.
 * @throws When a corner is missing.
 */
export const toFlatBounds = (
  bounds: Bounds
): readonly [number, number, number, number] => {
  const [southwest, northeast] = assertBounds(bounds);

  return [southwest[0], southwest[1], northeast[0], northeast[1]];
};

/**
 * Converts bounds to RNMapbox `{ sw, ne }`.
 *
 * @param bounds - Southwest then northeast corners.
 * @returns Named corners in the same order.
 * @throws When a corner is missing.
 */
export const toRnmapboxCornerBounds = (bounds: Bounds) => {
  const [southwest, northeast] = assertBounds(bounds);

  return { sw: southwest, ne: northeast };
};

/**
 * Converts RNMapbox padding fields from a shared padding value.
 *
 * @param padding - Partial padding or one number for every side.
 * @returns `paddingTop`, `paddingRight`, `paddingBottom`, and `paddingLeft`.
 */
export const toRnmapboxPadding = (padding?: Padding | number) => {
  const sides = normalizePadding(padding);

  return {
    paddingTop: sides.top,
    paddingRight: sides.right,
    paddingBottom: sides.bottom,
    paddingLeft: sides.left,
  };
};

/**
 * Reads `[west, south, east, north]` as southwest then northeast.
 *
 * @param flat - Wrapper bounds in west, south, east, north order.
 * @returns Common bounds.
 * @throws When the tuple does not contain four finite numbers.
 */
export const boundsFromFlat = (flat: readonly number[]): Bounds => {
  const [west, south, east, north] = flat;

  if (
    !isFiniteNumber(west) ||
    !isFiniteNumber(south) ||
    !isFiniteNumber(east) ||
    !isFiniteNumber(north)
  ) {
    throw new Error("Flat bounds must be [west, south, east, north].");
  }

  return [
    [west, south],
    [east, north],
  ];
};

/**
 * Reads RNMapbox `getVisibleBounds()`.
 *
 * The pinned wrapper documents the pair as northeast, then southwest:
 * `[[rightLon, topLat], [leftLon, bottomLat]]`. This does not sort a
 * two-element array that lacks that documented order.
 *
 * @param corners - Northeast corner, then southwest corner.
 * @returns Common southwest-then-northeast bounds.
 * @throws When either corner is missing.
 */
export const boundsFromRnmapboxVisible = (
  corners: readonly (readonly number[])[]
): Bounds => {
  const northeast = corners[0];
  const southwest = corners[1];

  if (!isLngLat(northeast) || !isLngLat(southwest)) {
    throw new Error(
      "RNMapbox visible bounds must be a northeast corner and a southwest corner."
    );
  }

  return [southwest, northeast];
};

/**
 * Reads a web bounds object or a flat tuple.
 *
 * A two-element array is rejected. RNMapbox's northeast-then-southwest pair
 * uses {@link boundsFromRnmapboxVisible} instead of this function.
 *
 * @param value - `LngLatBounds` methods or `[west, south, east, north]`.
 * @returns Common bounds.
 * @throws When the value has neither four numbers nor corner methods.
 */
export const boundsFromGeographic = (value: unknown): Bounds => {
  if (isFlatBounds(value)) {
    return boundsFromFlat(value);
  }

  const fromMethods = boundsFromCornerMethods(value);

  if (fromMethods) {
    return fromMethods;
  }

  throw new Error(
    "Map bounds must be [west, south, east, north] or southwest and northeast methods."
  );
};

/**
 * Reads a center from a tuple or a wrapper longitude/latitude object.
 *
 * @param value - `[longitude, latitude]`, `{ lng, lat }`, or `{ lon, lat }`.
 * @returns A longitude/latitude tuple.
 * @throws When neither shape contains both numbers.
 */
export const lngLatFromWrapper = (value: unknown): LngLat => {
  if (isLngLat(value)) {
    return [value[0], value[1]];
  }

  if (isRecord(value)) {
    const longitude = finiteField(value, "lng") ?? finiteField(value, "lon");
    const latitude = finiteField(value, "lat");

    if (longitude !== undefined && latitude !== undefined) {
      return [longitude, latitude];
    }
  }

  throw new Error("A map coordinate must contain longitude and latitude.");
};

/**
 * Reads a view point from a tuple or `{ x, y }`.
 *
 * @param value - `[x, y]` or a point with `x` and `y`.
 * @returns An x/y tuple in logical map-view units.
 * @throws When both numbers are not present.
 */
export const pointFromWrapper = (value: unknown): Point => {
  if (isLngLat(value)) {
    return [value[0], value[1]];
  }

  if (isRecord(value)) {
    const x = finiteField(value, "x");
    const y = finiteField(value, "y");

    if (x !== undefined && y !== undefined) {
      return [x, y];
    }
  }

  throw new Error("A map point must contain x and y.");
};

/**
 * Reads padding fields and fills missing sides with zero.
 *
 * @param value - Wrapper padding object.
 * @returns Padding with every side present.
 * @throws When `value` is not an object.
 */
export const paddingFromWrapper = (value: unknown): Required<Padding> => {
  if (!isRecord(value)) {
    throw new Error("Map padding must be an object.");
  }

  return normalizePadding({
    top: finiteField(value, "top"),
    right: finiteField(value, "right"),
    bottom: finiteField(value, "bottom"),
    left: finiteField(value, "left"),
  });
};

/**
 * Rejects animation requests on `jumpTo`.
 *
 * @param options - Command options.
 * @throws When `easing` is set or `duration` is any number other than `0`.
 */
export const rejectJumpTiming = (options: CameraCommandOptions): void => {
  if (options.easing !== undefined) {
    throw new Error("jumpTo does not accept an easing function.");
  }

  if (options.duration !== undefined && options.duration !== 0) {
    throw new Error(
      "jumpTo does not accept a duration. Use easeTo or flyTo to animate."
    );
  }
};

/**
 * Rejects an easing function on a native command.
 *
 * @param easing - Easing function, when the caller passed one.
 * @throws When `easing` is set. Native movement comes from the command name.
 */
export const rejectNativeEasing = (easing: CameraEasing | undefined): void => {
  if (easing !== undefined) {
    throw new Error(
      "An easing function is not available on native maps. jumpTo, easeTo, and flyTo select the movement."
    );
  }
};

/**
 * Converts a shared flight into MapLibre or Mapbox GL JS `flyTo` arguments.
 *
 * @param options - Shared flight.
 * @returns Wrapper fields that were provided, plus `center`.
 */
export const toWebFlyToOptions = (options: FlyToOptions) =>
  webCommandOptions(options);

/**
 * Converts a shared ease or jump into GL JS command arguments.
 *
 * @param options - Partial camera target.
 * @returns Wrapper fields that were provided. Jump timing is not included.
 */
export const toWebCommandOptions = (options: CameraCommandOptions) =>
  webCommandOptions(options);

/**
 * Converts fit options into GL JS `fitBounds` options.
 *
 * @param options - Fit options. Omitted options produce an empty object.
 * @returns Duration, padding, bearing, pitch, easing, and max zoom that were set.
 */
export const toWebFitBoundsOptions = (options: FitBoundsOptions = {}) => ({
  ...(options.padding === undefined
    ? {}
    : { padding: normalizePadding(options.padding) }),
  ...(options.duration === undefined ? {} : { duration: options.duration }),
  ...(options.bearing === undefined ? {} : { bearing: options.bearing }),
  ...(options.pitch === undefined ? {} : { pitch: options.pitch }),
  ...(options.easing === undefined ? {} : { easing: options.easing }),
  ...(options.maxZoom === undefined ? {} : { maxZoom: options.maxZoom }),
});

/**
 * Converts zoom options into GL JS `zoomTo` options.
 *
 * @param options - Duration and easing.
 * @returns The fields that were provided.
 */
export const toWebZoomToOptions = (options: ZoomToOptions = {}) => ({
  ...(options.duration === undefined ? {} : { duration: options.duration }),
  ...(options.easing === undefined ? {} : { easing: options.easing }),
});

/**
 * Converts a shared flight into RNMapbox `setCamera` with an explicit fly mode.
 *
 * RNMapbox's `flyTo` helper omits `animationMode`, and Android then defaults
 * to ease. This object sets `animationMode: "flyTo"`.
 *
 * @param options - Shared flight.
 * @returns An RNMapbox camera stop.
 */
export const toRnmapboxFlyToStop = (options: FlyToOptions) =>
  toRnmapboxStop(options, "flyTo");

/**
 * Converts a camera command into an RNMapbox stop.
 *
 * @param options - Partial camera target.
 * @param animationMode - Explicit RNMapbox movement. `none` is a jump.
 * @returns An RNMapbox camera stop. An easing function is rejected.
 * @throws When `options.easing` is set.
 */
export const toRnmapboxStop = (
  options: CameraCommandOptions,
  animationMode: "flyTo" | "easeTo" | "none"
) => {
  rejectNativeEasing(options.easing);

  return {
    type: "CameraStop" as const,
    ...(options.center === undefined
      ? {}
      : { centerCoordinate: options.center }),
    ...(options.zoom === undefined ? {} : { zoomLevel: options.zoom }),
    ...(options.bearing === undefined ? {} : { heading: options.bearing }),
    ...(options.pitch === undefined ? {} : { pitch: options.pitch }),
    ...(options.padding === undefined
      ? {}
      : { padding: toRnmapboxPadding(options.padding) }),
    ...(options.duration === undefined
      ? {}
      : { animationDuration: options.duration }),
    animationMode,
  };
};

/**
 * Converts `fitBounds` into an RNMapbox ease stop.
 *
 * The wrapper's own `fitBounds` also eases. Building the stop here keeps
 * `animationMode` explicit.
 *
 * @param bounds - Southwest then northeast corners.
 * @param options - Padding, duration, bearing, and pitch.
 * @returns An RNMapbox camera stop with `animationMode: "easeTo"`.
 * @throws When the bounds are invalid or `easing` is set.
 */
export const toRnmapboxFitBoundsStop = (
  bounds: Bounds,
  options: FitBoundsOptions = {}
) => {
  rejectNativeEasing(options.easing);

  return {
    type: "CameraStop" as const,
    bounds: toRnmapboxCornerBounds(bounds),
    ...(options.padding === undefined
      ? {}
      : { padding: toRnmapboxPadding(options.padding) }),
    ...(options.bearing === undefined ? {} : { heading: options.bearing }),
    ...(options.pitch === undefined ? {} : { pitch: options.pitch }),
    ...(options.duration === undefined
      ? {}
      : { animationDuration: options.duration }),
    animationMode: "easeTo" as const,
  };
};

/**
 * Converts `zoomTo` into an RNMapbox stop.
 *
 * Duration `0` uses `animationMode: "none"`. Any other duration, including an
 * omitted duration, uses `easeTo`. The wrapper's `zoomTo` helper uses flight,
 * which is not this command.
 *
 * @param zoom - Target zoom.
 * @param options - Duration.
 * @returns An RNMapbox camera stop.
 * @throws When `easing` is set.
 */
export const toRnmapboxZoomStop = (
  zoom: number,
  options: ZoomToOptions = {}
) => {
  rejectNativeEasing(options.easing);

  return {
    type: "CameraStop" as const,
    zoomLevel: zoom,
    ...(options.duration === undefined
      ? {}
      : { animationDuration: options.duration }),
    animationMode:
      options.duration === 0 ? ("none" as const) : ("easeTo" as const),
  };
};

/**
 * Converts a shared flight into MapLibre Native `Camera.flyTo` arguments.
 *
 * @param options - Shared flight.
 * @returns MapLibre center, camera fields, and duration that were provided.
 * @throws When `easing` is a function. The wrapper's `flyTo` selects flight.
 */
export const toMaplibreFlyToOptions = (options: FlyToOptions) =>
  toMaplibreCommand(options);

/**
 * Converts a command into MapLibre Native camera fields.
 *
 * Named methods add their own easing. This object does not include an easing
 * function.
 *
 * @param options - Partial camera target.
 * @returns Center, zoom, bearing, pitch, padding, and duration that were set.
 * @throws When `easing` is a function.
 */
export const toMaplibreCommand = (options: CameraCommandOptions) => {
  rejectNativeEasing(options.easing);

  return {
    ...(options.center === undefined ? {} : { center: options.center }),
    ...(options.zoom === undefined ? {} : { zoom: options.zoom }),
    ...(options.bearing === undefined ? {} : { bearing: options.bearing }),
    ...(options.pitch === undefined ? {} : { pitch: options.pitch }),
    ...(options.padding === undefined
      ? {}
      : { padding: normalizePadding(options.padding) }),
    ...(options.duration === undefined ? {} : { duration: options.duration }),
  };
};

/**
 * Converts fit options into MapLibre Native `fitBounds` options.
 *
 * The wrapper's `fitBounds` selects flight when easing is omitted.
 *
 * @param options - Fit options.
 * @returns Padding, duration, bearing, pitch, and max zoom that were set.
 * @throws When `easing` is a function.
 */
export const toMaplibreFitBoundsOptions = (options: FitBoundsOptions = {}) => {
  rejectNativeEasing(options.easing);

  return {
    ...(options.padding === undefined
      ? {}
      : { padding: normalizePadding(options.padding) }),
    ...(options.duration === undefined ? {} : { duration: options.duration }),
    ...(options.bearing === undefined ? {} : { bearing: options.bearing }),
    ...(options.pitch === undefined ? {} : { pitch: options.pitch }),
    ...(options.maxZoom === undefined ? {} : { maxZoom: options.maxZoom }),
  };
};

const webCommandOptions = (options: CameraCommandOptions) => ({
  ...(options.center === undefined ? {} : { center: options.center }),
  ...(options.zoom === undefined ? {} : { zoom: options.zoom }),
  ...(options.bearing === undefined ? {} : { bearing: options.bearing }),
  ...(options.pitch === undefined ? {} : { pitch: options.pitch }),
  ...(options.padding === undefined
    ? {}
    : { padding: normalizePadding(options.padding) }),
  ...(options.duration === undefined ? {} : { duration: options.duration }),
  ...(options.easing === undefined ? {} : { easing: options.easing }),
});

const boundsFromCornerMethods = (value: unknown): Bounds | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const west = callNumber(value, "getWest");
  const south = callNumber(value, "getSouth");
  const east = callNumber(value, "getEast");
  const north = callNumber(value, "getNorth");

  if (
    west === undefined ||
    south === undefined ||
    east === undefined ||
    north === undefined
  ) {
    return undefined;
  }

  return [
    [west, south],
    [east, north],
  ];
};

const callNumber = (
  value: Record<string, unknown>,
  name: string
): number | undefined => {
  const method = value[name];

  if (typeof method !== "function") {
    return undefined;
  }

  const result: unknown = method.call(value);

  return isFiniteNumber(result) ? result : undefined;
};

const finiteField = (
  value: Record<string, unknown>,
  name: string
): number | undefined => {
  const field = value[name];

  return isFiniteNumber(field) ? field : undefined;
};

const isFlatBounds = (
  value: unknown
): value is readonly [number, number, number, number] =>
  Array.isArray(value) &&
  value.length === 4 &&
  value.every((item) => isFiniteNumber(item));

const isLngLat = (value: unknown): value is LngLat =>
  Array.isArray(value) &&
  value.length === 2 &&
  isFiniteNumber(value[0]) &&
  isFiniteNumber(value[1]);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
