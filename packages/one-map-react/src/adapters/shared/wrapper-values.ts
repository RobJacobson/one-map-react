import type {
  Bounds,
  CameraCommandOptions,
  CameraEasing,
  LngLat,
  Padding,
  Point,
} from "../../contracts/camera-types.js";

/**
 * Reads a finite numeric wrapper result without coercion.
 *
 * @param value - Wrapper result.
 * @param name - Description used in validation errors.
 * @returns The unchanged finite number.
 * @throws When the wrapper returned a non-finite or nonnumeric value.
 */
export const finiteNumber = (value: unknown, name: string): number => {
  if (!isFiniteNumber(value)) {
    throw new Error(`${name} must be a finite number.`);
  }

  return value;
};

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
