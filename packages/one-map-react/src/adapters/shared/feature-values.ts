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
 * Validates a feature identifier and returns a fresh single-read snapshot.
 *
 * @param identifier - Source, feature id, and optional source layer.
 * @returns A shallow snapshot of the validated identifier fields.
 * @throws When the source or a supplied source layer is not a nonempty
 * string, or the feature id is not a string or number.
 */
export const assertFeatureIdentifier = (
  identifier: unknown
): FeatureIdentifier => {
  if (!isRecord(identifier) || Array.isArray(identifier)) {
    throw new Error(
      "A feature identifier must name a source with a nonempty string."
    );
  }

  const source = identifier.source;

  if (typeof source !== "string" || source.length === 0) {
    throw new Error(
      "A feature identifier must name a source with a nonempty string."
    );
  }

  const id = identifier.id;

  if (typeof id !== "string" && typeof id !== "number") {
    throw new Error("A feature identifier must carry a string or number id.");
  }

  const sourceLayer = identifier.sourceLayer;

  return sourceLayer === undefined
    ? { source, id }
    : { source, id, sourceLayer: requireSourceLayerName(sourceLayer) };
};

/**
 * Validates a supplied vector source layer name.
 *
 * @param sourceLayer - Layer name from a feature identifier or query.
 * @returns The exact layer name supplied by the caller.
 * @throws When the layer name is not a nonempty string.
 */
export const requireSourceLayerName = (sourceLayer: unknown): string => {
  if (typeof sourceLayer !== "string" || sourceLayer.length === 0) {
    throw new Error("sourceLayer must be a nonempty string.");
  }

  return sourceLayer;
};

/**
 * Validates and deep-copies feature state in a single pass before dispatch.
 *
 * The portable contract excludes `null`, `undefined`, and non-finite numbers
 * so every backend stores the same shape: MapLibre wrappers drop `null` keys
 * rather than storing them, and `undefined` never crosses a native bridge.
 * Each value is validated as it is copied, preventing second-read getter
 * bypasses while producing a mutable copy isolated from caller and SDK
 * mutations.
 *
 * @param state - State object to merge onto a feature.
 * @returns A validated mutable copy for the wrapper call.
 * @throws When `state` is not an object or any value is `null`, `undefined`,
 * a non-finite number, a sparse array hole, or a non-JSON primitive
 * (`bigint`, `function`, or `symbol`).
 */
export const copyValidatedFeatureState = (
  state: FeatureState
): Record<string, unknown> => {
  if (!isRecord(state) || Array.isArray(state)) {
    throw new Error("Feature state must be an object.");
  }

  return copyRecord(state);
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

  if (!isRecord(value) || Array.isArray(value)) {
    throw new Error("Feature state must be an object.");
  }

  return value as FeatureState;
};

const invalidStateError = (topKey: string): Error =>
  new Error(
    `Feature state key "${topKey}" must be JSON without null, undefined, or non-finite numbers.`
  );

const copyStateValue = (value: unknown, topKey: string): unknown => {
  if (typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw invalidStateError(topKey);
    }

    return value;
  }

  if (Array.isArray(value)) {
    const { length } = value;
    const copied: unknown[] = [];

    // Array methods skip holes, and Object.hasOwn blocks inherited indices.
    for (let index = 0; index < length; index += 1) {
      if (!Object.hasOwn(value, index)) {
        throw invalidStateError(topKey);
      }

      copied.push(copyStateValue(value[index], topKey));
    }

    return copied;
  }

  if (isRecord(value)) {
    return copyRecord(value, topKey);
  }

  throw invalidStateError(topKey);
};

const copyRecord = (
  record: Record<string, unknown>,
  topKey?: string
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      copyStateValue(value, topKey ?? key),
    ])
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
