import type {
  FeatureIdentifier,
  FeatureStateMethods,
} from "../../contracts/query-types.js";
import {
  assertFeatureIdentifier,
  copyValidatedFeatureState,
  featureStateFromWrapper,
} from "../shared/feature-values.js";
import {
  toMaplibreFeatureId,
  toMaplibreVectorFeature,
} from "./convert-query.js";
import {
  type MaplibreSourceRegistry,
  requireMaplibreSource,
} from "./source-registry.js";

type FeatureStateArgs = {
  setFeatureState: [state: ReturnType<typeof copyValidatedFeatureState>];
  getFeatureState: [];
  removeFeatureState: [key?: string];
};

type SourceFeatureStateMethods<Feature> = {
  [Method in keyof FeatureStateArgs]: (
    feature: Feature,
    ...args: FeatureStateArgs[Method]
  ) => Promise<unknown>;
};

/**
 * Validates and copies inputs before dispatch to the current source ref.
 *
 * @param sources - Registry owned by the map.
 * @param requireMap - Guard that throws when the map is detached.
 * @returns Feature-state methods for this map.
 */
export const createMaplibreFeatureStateMethods = (
  sources: MaplibreSourceRegistry,
  requireMap: () => unknown
): FeatureStateMethods => {
  const invokeFeatureState = <Method extends keyof FeatureStateArgs>(
    method: Method,
    target: FeatureIdentifier,
    ...args: FeatureStateArgs[Method]
  ): Promise<unknown> => {
    requireMap();
    const source = requireMaplibreSource(sources, target.source);

    if (source.kind === "geojson") {
      const ref: SourceFeatureStateMethods<
        ReturnType<typeof toMaplibreFeatureId>
      > = source.ref;
      return ref[method](toMaplibreFeatureId(target), ...args);
    }

    const ref: SourceFeatureStateMethods<
      ReturnType<typeof toMaplibreVectorFeature>
    > = source.ref;
    return ref[method](toMaplibreVectorFeature(target), ...args);
  };

  return {
    setFeatureState: async (identifier, state) => {
      const target = assertFeatureIdentifier(identifier);
      const mutableState = copyValidatedFeatureState(state);

      await invokeFeatureState("setFeatureState", target, mutableState);
    },
    getFeatureState: async (identifier) =>
      featureStateFromWrapper(
        await invokeFeatureState(
          "getFeatureState",
          assertFeatureIdentifier(identifier)
        )
      ),
    removeFeatureState: async (identifier, key) => {
      await invokeFeatureState(
        "removeFeatureState",
        assertFeatureIdentifier(identifier),
        ...(key === undefined ? [] : [key])
      );
    },
  };
};
