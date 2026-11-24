import type {
  Bounds,
  CameraCommandOptions,
  CameraEasing,
  LngLat,
  Padding,
} from "../../contracts/camera-types.js";
import type { ImageSourceCorners } from "../../contracts/source-types.js";

/** Logical dimensions measured by a React Native layout event. */
export interface NativeLayoutSize {
  /** Measured width in logical units. */
  readonly width: number;
  /** Measured height in logical units. */
  readonly height: number;
}

/**
 * Preserves layout state identity when the measured dimensions repeat.
 *
 * @param previous - Last measured size, if available.
 * @param width - Measured width in logical units.
 * @param height - Measured height in logical units.
 * @returns The previous size or the newly measured dimensions.
 */
export const updateLayoutSize = (
  previous: NativeLayoutSize | undefined,
  width: number,
  height: number
): NativeLayoutSize =>
  previous?.width === width && previous.height === height
    ? previous
    : { width, height };

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
 * Validates southwest-then-northeast bounds while preserving corner order.
 *
 * @param bounds - Candidate bounds.
 * @returns Fresh southwest and northeast coordinate tuples.
 * @throws When either corner is not a finite longitude and latitude.
 */
export const assertBounds = (bounds: Bounds): Bounds => {
  const southwestCorner = bounds?.[0];
  const northeastCorner = bounds?.[1];
  const southwest = readFinitePair(southwestCorner);
  const northeast = southwest && readFinitePair(northeastCorner);

  if (!southwest || !northeast) {
    throw new Error("Bounds must be [[west, south], [east, north]].");
  }

  return [southwest, northeast];
};

/**
 * Converts bounds to `[west, south, east, north]`.
 *
 * @param bounds - Southwest then northeast corners.
 * @returns A new mutable flat bounds tuple. West may be greater than east.
 * @throws When either corner is not a finite longitude and latitude.
 */
export const toFlatBounds = (
  bounds: Bounds
): [number, number, number, number] => {
  const [southwest, northeast] = assertBounds(bounds);

  return [southwest[0], southwest[1], northeast[0], northeast[1]];
};

/**
 * Reads `[west, south, east, north]` as southwest then northeast.
 *
 * @param flat - Wrapper bounds in west, south, east, north order.
 * @returns Common bounds.
 * @throws When the input is not a tuple of exactly four finite numbers.
 */
export const boundsFromFlat = (flat: unknown): Bounds => {
  const bounds = parseFlatBounds(flat);

  if (!bounds) {
    throw new Error("Flat bounds must be [west, south, east, north].");
  }

  return bounds;
};

/**
 * Reads a flat tuple or falls back to geographic bounds methods.
 *
 * @param value - `LngLatBounds` methods or `[west, south, east, north]`.
 * @returns Common bounds.
 * @throws When neither representation provides four finite coordinates.
 */
export const boundsFromGeographic = (value: unknown): Bounds => {
  const bounds = parseFlatBounds(value) ?? boundsFromCornerMethods(value);

  if (bounds) {
    return bounds;
  }

  throw new Error(
    "Map bounds must be [west, south, east, north] or southwest and northeast methods."
  );
};

/**
 * Reads a center from a tuple or a wrapper longitude/latitude object.
 *
 * @param value - `[longitude, latitude]`, `{ lng, lat }`, or `{ lon, lat }`.
 * @param InvalidCoordinateError - Error class for invalid coordinates. Defaults to `Error`.
 * @returns A longitude/latitude tuple.
 * @throws When neither shape contains both finite numbers.
 */
export const lngLatFromWrapper = (
  value: unknown,
  InvalidCoordinateError: new (message: string) => Error = Error
): LngLat => {
  const tuple = readFinitePair(value);
  if (tuple) return tuple;

  if (isRecord(value)) {
    const longitude = finiteField(value, "lng") ?? finiteField(value, "lon");
    const latitude = finiteField(value, "lat");

    if (longitude !== undefined && latitude !== undefined) {
      return [longitude, latitude];
    }
  }

  throw new InvalidCoordinateError(
    "A map coordinate must contain longitude and latitude."
  );
};

/**
 * Reads a view point from a tuple or `{ x, y }`.
 *
 * @param value - `[x, y]` or a point with `x` and `y`.
 * @param tupleX - First tuple element already read when resolving a query overload.
 * @returns A fresh mutable x/y tuple in logical map-view units.
 * @throws When both numbers are not present.
 */
export const pointFromWrapper = (
  value: unknown,
  tupleX?: number
): [x: number, y: number] => {
  const tuple = readFinitePair(value, tupleX);
  if (tuple) return tuple;

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
 * Rejects animation requests on `jumpTo`.
 *
 * @param options - Command options.
 * @throws When `easing` is set or `duration` is any number other than `0`.
 */
export const rejectJumpTiming = (
  options: Pick<CameraCommandOptions, "duration" | "easing">
): void => {
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
 * Copies a caller's list of strings into a mutable wrapper argument.
 *
 * @param values - Layer IDs or tile URL templates.
 * @returns A new array for the wrapper to own.
 * @throws TypeError when a JavaScript caller passes a non-array value.
 */
export const copyNativeStringArray = (values: readonly string[]): string[] => {
  if (!Array.isArray(values)) {
    throw new TypeError("Expected an array for the native wrapper.");
  }

  return values.slice();
};

/**
 * Copies the four image corners into mutable tuples for a native wrapper.
 *
 * @param corners - Top-left, top-right, bottom-right, and bottom-left corners.
 * @returns A new tuple containing four new coordinate pairs.
 */
export const copyNativeImageCorners = (
  corners: ImageSourceCorners
): [MutableCorner, MutableCorner, MutableCorner, MutableCorner] => [
  copyCorner(corners[0]),
  copyCorner(corners[1]),
  copyCorner(corners[2]),
  copyCorner(corners[3]),
];

/**
 * Copies tile templates supplied to a native source.
 *
 * @param tiles - Tile URL templates, if supplied.
 * @returns A new mutable template list, or undefined when absent.
 * @throws TypeError when a JavaScript caller passes a non-array value.
 */
export const copyOptionalNativeTiles = (
  tiles: readonly string[] | null | undefined
): string[] | undefined =>
  tiles == null ? undefined : copyNativeStringArray(tiles);

type MutableCorner = [number, number];

const copyCorner = (corner: LngLat): MutableCorner => [corner[0], corner[1]];

/**
 * Checks for non-null wrapper objects, including arrays with named properties.
 *
 * @param value - Value received from the wrapper.
 * @returns Whether the input is a non-null object.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Snapshots an array containing exactly two finite coordinates.
 *
 * @param value - Candidate coordinate pair.
 * @param firstCoordinate - First coordinate already read by a query overload.
 * @returns A fresh pair, or undefined for an invalid coordinate pair.
 */
export const readFinitePair = (
  value: unknown,
  firstCoordinate?: number
): [number, number] | undefined => {
  if (!Array.isArray(value) || value.length !== 2) return undefined;

  const first: unknown = firstCoordinate ?? value[0];
  if (!isFiniteNumber(first)) return undefined;

  const second: unknown = value[1];
  return isFiniteNumber(second) ? [first, second] : undefined;
};

const parseFlatBounds = (flat: unknown): Bounds | undefined => {
  if (!Array.isArray(flat) || flat.length !== 4) return undefined;

  const west: unknown = flat[0];
  const south: unknown = flat[1];
  const east: unknown = flat[2];
  const north: unknown = flat[3];

  if (
    !isFiniteNumber(west) ||
    !isFiniteNumber(south) ||
    !isFiniteNumber(east) ||
    !isFiniteNumber(north)
  ) {
    return undefined;
  }

  return [
    [west, south],
    [east, north],
  ];
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

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
