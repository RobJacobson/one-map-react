import type { FeatureStateMethods } from "../../contracts/query-types.js";
import {
  assertFeatureIdentifier,
  assertFeatureState,
  featureStateFromWrapper,
  mutableFeatureState,
} from "../shared/feature-values.js";
import {
  toMaplibreFeatureId,
  toMaplibreVectorFeature,
} from "./convert-query.js";
import type { MaplibreSourceRegistry } from "./source-registry.js";

/** Validates and copies inputs before dispatch to the current source ref. */
export const createMaplibreFeatureStateMethods = (
  sources: MaplibreSourceRegistry,
  requireMap: () => unknown
): FeatureStateMethods => ({
  setFeatureState: async (identifier, state) => {
    const target = { ...assertFeatureIdentifier(identifier) };
    assertFeatureState(state);
    const mutableState = mutableFeatureState(state);

    requireMap();
    const source = sources.require(target.source);

    await (source.kind === "geojson"
      ? source.ref.setFeatureState(toMaplibreFeatureId(target), mutableState)
      : source.ref.setFeatureState(
          toMaplibreVectorFeature(target),
          mutableState
        ));
  },
  getFeatureState: async (identifier) => {
    const target = { ...assertFeatureIdentifier(identifier) };
    requireMap();
    const source = sources.require(target.source);

    return featureStateFromWrapper(
      await (source.kind === "geojson"
        ? source.ref.getFeatureState(toMaplibreFeatureId(target))
        : source.ref.getFeatureState(toMaplibreVectorFeature(target)))
    );
  },
  removeFeatureState: async (identifier, key) => {
    const target = { ...assertFeatureIdentifier(identifier) };
    requireMap();
    const source = sources.require(target.source);

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
});
