import type { FeatureStateMethods } from "../../contracts/query-types.js";
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
  const requireSource = (sourceId: string) => {
    requireMap();
    return requireMaplibreSource(sources, sourceId);
  };

  return {
    setFeatureState: async (identifier, state) => {
      const target = assertFeatureIdentifier(identifier);
      const mutableState = copyValidatedFeatureState(state);
      const source = requireSource(target.source);

      await (source.kind === "geojson"
        ? source.ref.setFeatureState(toMaplibreFeatureId(target), mutableState)
        : source.ref.setFeatureState(
            toMaplibreVectorFeature(target),
            mutableState
          ));
    },
    getFeatureState: async (identifier) => {
      const target = assertFeatureIdentifier(identifier);
      const source = requireSource(target.source);

      return featureStateFromWrapper(
        await (source.kind === "geojson"
          ? source.ref.getFeatureState(toMaplibreFeatureId(target))
          : source.ref.getFeatureState(toMaplibreVectorFeature(target)))
      );
    },
    removeFeatureState: async (identifier, key) => {
      const target = assertFeatureIdentifier(identifier);
      const source = requireSource(target.source);

      await (source.kind === "geojson"
        ? source.ref.removeFeatureState(
            toMaplibreFeatureId(target),
            ...(key === undefined ? [] : [key])
          )
        : source.ref.removeFeatureState(
            toMaplibreVectorFeature(target),
            ...(key === undefined ? [] : [key])
          ));
    },
  };
};
