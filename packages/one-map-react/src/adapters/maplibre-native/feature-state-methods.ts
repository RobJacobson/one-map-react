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
  const getAttachedSource = (id: string) => {
    requireMap();
    return requireMaplibreSource(sources, id);
  };

  return {
    setFeatureState: async (identifier, state) => {
      const target = assertFeatureIdentifier(identifier);
      const mutableState = copyValidatedFeatureState(state);
      const { kind, ref } = getAttachedSource(target.source);

      await (kind === "geojson"
        ? ref.setFeatureState({ id: target.id }, mutableState)
        : ref.setFeatureState(toVectorFeature(target), mutableState));
    },
    getFeatureState: async (identifier) => {
      const target = assertFeatureIdentifier(identifier);
      const { kind, ref } = getAttachedSource(target.source);
      const state = await (kind === "geojson"
        ? ref.getFeatureState({ id: target.id })
        : ref.getFeatureState(toVectorFeature(target)));

      return featureStateFromWrapper(state);
    },
    removeFeatureState: async (identifier, key) => {
      const target = assertFeatureIdentifier(identifier);
      const { kind, ref } = getAttachedSource(target.source);
      const keyArgs: [key?: string] = key === undefined ? [] : [key];

      await (kind === "geojson"
        ? ref.removeFeatureState({ id: target.id }, ...keyArgs)
        : ref.removeFeatureState(toVectorFeature(target), ...keyArgs));
    },
  };
};

const toVectorFeature = ({ id, sourceLayer }: FeatureIdentifier) => {
  if (sourceLayer === undefined) {
    throw new Error(
      "Feature-state methods need sourceLayer for vector sources on maplibre-native."
    );
  }

  return { id, sourceLayer };
};
