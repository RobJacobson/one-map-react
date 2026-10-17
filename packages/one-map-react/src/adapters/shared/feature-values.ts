import type { Point } from "../../contracts/camera-types.js";
import type {
  FeatureIdentifier,
  FeatureState,
  ScreenBounds,
} from "../../contracts/query-types.js";
import type { GeoJsonFeature } from "../../contracts/source-types.js";

/**
 * A query target: a screen point, a screen rectangle, or the viewport.
 */
export type QueryTarget = Point | ScreenBounds | undefined;

/**
 * Copies logical screen coordinates for web and MapLibre Native queries.
 *
 * @param target - Point, screen bounds, or undefined for the viewport.
 * @returns Mutable coordinate arrays, preserving an omitted viewport target.
 */
export const toQueryGeometry = (target: QueryTarget): unknown => {
  if (target === undefined) {
    return undefined;
  }

  if (!isScreenBounds(target)) {
    return [target[0], target[1]];
  }

  return [
    [target[0][0], target[0][1]],
    [target[1][0], target[1][1]],
  ];
};

/**
 * Detects whether a query target is a screen rectangle.
 *
 * @param target - Query target from the common method.
 * @returns `true` when the target is a two-corner rectangle.
 */
export const isScreenBounds = (target: QueryTarget): target is ScreenBounds =>
  target !== undefined && Array.isArray(target[0]);

/**
 * Converts screen corners into RNMapbox's `[top, left, bottom, right]` rect.
 *
 * @remarks
 * RNMapbox documents the rect as `[minY, minX, maxY, maxX]`, which is the
 * common top-left/bottom-right corner order with each corner flattened.
 *
 * @param bounds - Top-left then bottom-right corners.
 * @returns A mutable four-number rect for the wrapper call.
 */
export const toRnmapboxRect = (bounds: ScreenBounds): number[] => [
  bounds[0][1],
  bounds[0][0],
  bounds[1][1],
  bounds[1][0],
];

/**
 * Normalizes a wrapper query result into a feature array.
 *
 * @remarks
 * Wrappers return a feature collection (native), a feature array (web),
 * or an Android string payload that is already JSON. An empty array is a
 * successful empty result; `undefined` or a malformed payload is a failure.
 *
 * @param value - Wrapper query result.
 * @param operation - Common method name for error messages.
 * @returns The features in backend order, duplicates preserved.
 * @throws When the result is absent or not a feature container.
 */
export const featuresFromWrapper = (
  value: unknown,
  operation: string
): readonly GeoJsonFeature[] => {
  if (value === undefined || value === null) {
    throw new Error(`${operation} returned no result.`);
  }

  if (Array.isArray(value)) {
    return value as readonly GeoJsonFeature[];
  }

  if (isRecord(value) && value.type === "FeatureCollection") {
    const features = value.features;

    if (!Array.isArray(features)) {
      throw new Error(
        `${operation} returned a feature collection without a feature array.`
      );
    }

    return features as readonly GeoJsonFeature[];
  }

  // RNMapbox Android passes the collection as a JSON string; iOS and the
  // source refs return the decoded object.
  if (typeof value === "string") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      throw new Error(
        `${operation} returned a result that is not valid JSON.`,
        { cause: error }
      );
    }
    return featuresFromWrapper(parsed, operation);
  }

  throw new Error(
    `${operation} returned a result that is not a feature container.`
  );
};

/**
 * Asserts a feature identifier and returns it unchanged.
 *
 * @param identifier - Source, feature id, and optional source layer.
 * @returns The same identifier.
 * @throws When the source is not a nonempty string or the feature id is
 * missing.
 */
export const assertFeatureIdentifier = (
  identifier: FeatureIdentifier
): FeatureIdentifier => {
  if (
    !isRecord(identifier) ||
    typeof identifier.source !== "string" ||
    identifier.source.length === 0
  ) {
    throw new Error(
      "A feature identifier must name a source with a nonempty string."
    );
  }

  const id = identifier.id;

  if (typeof id !== "string" && typeof id !== "number") {
    throw new Error("A feature identifier must carry a string or number id.");
  }

  return identifier;
};

/**
 * Validates feature state before dispatch.
 *
 * @remarks
 * The portable contract excludes `null`, `undefined`, and non-finite numbers
 * so every backend stores the same shape: MapLibre wrappers drop `null` keys
 * rather than storing them, and `undefined` never crosses a native bridge.
 *
 * @param state - State object to merge onto a feature.
 * @throws When a value is `null`, `undefined`, or a non-finite number,
 * directly or nested.
 */
export const assertFeatureState = (state: FeatureState): void => {
  for (const [key, value] of Object.entries(state)) {
    if (!isStateValue(value)) {
      throw new Error(
        `Feature state key "${key}" must be JSON without null, undefined, or non-finite numbers.`
      );
    }
  }
};

/**
 * Normalizes a wrapper feature-state read.
 *
 * @param value - Wrapper state object, or `null`/`undefined` when the
 * feature has no state.
 * @returns The state object; `{}` when the feature has no state.
 * @throws When the wrapper returned something other than an object or null.
 */
export const featureStateFromWrapper = (value: unknown): FeatureState => {
  if (value === null || value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    throw new Error("Feature state must be an object.");
  }

  return value as FeatureState;
};

/**
 * Wraps a mutable copy of feature state for the wrapper call.
 *
 * @remarks
 * Readonly facade values cross into the wrappers' mutable record types;
 * values are not modified. Nested values are copied before native queueing.
 *
 * @param state - Validated feature state.
 * @returns A mutable copy for the wrapper call.
 */
export const mutableFeatureState = (
  state: FeatureState
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(state).map(([key, value]) => [key, copyStateValue(value)])
  );

const copyStateValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(copyStateValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, copyStateValue(child)])
    );
  }
  return value;
};

const isStateValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "boolean" || typeof value === "string") {
    return true;
  }

  if (Array.isArray(value)) {
    // every() skips holes, which serialize as forbidden null array elements.
    for (const child of value) {
      if (!isStateValue(child)) return false;
    }
    return true;
  }

  if (isRecord(value)) {
    return Object.values(value).every(isStateValue);
  }

  return false;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
