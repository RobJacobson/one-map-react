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

/** Captures validated state inputs before queueing; resolves source refs at dispatch. */
export const createMaplibreFeatureStateMethods = (
  sources: MaplibreSourceRegistry
): FeatureStateMethods => ({
  setFeatureState: async (identifier, state) => {
    const target = { ...assertFeatureIdentifier(identifier) };
    assertFeatureState(state);
    const mutableState = mutableFeatureState(state);
    if (sources.require(target.source).kind === "vector")
      toMaplibreVectorFeature(target);

    await sources.featureState.run(
      target,
      async () => {
        const source = sources.require(target.source);

        await (source.kind === "geojson"
          ? source.ref.setFeatureState(
              toMaplibreFeatureId(target),
              mutableState
            )
          : source.ref.setFeatureState(
              toMaplibreVectorFeature(target),
              mutableState
            ));
      },
      "write"
    );
  },
  getFeatureState: async (identifier) => {
    const target = { ...assertFeatureIdentifier(identifier) };
    if (sources.require(target.source).kind === "vector")
      toMaplibreVectorFeature(target);

    return sources.featureState.run(target, async () => {
      const source = sources.require(target.source);

      return featureStateFromWrapper(
        await (source.kind === "geojson"
          ? source.ref.getFeatureState(toMaplibreFeatureId(target))
          : source.ref.getFeatureState(toMaplibreVectorFeature(target)))
      );
    });
  },
  removeFeatureState: async (identifier, key) => {
    const target = { ...assertFeatureIdentifier(identifier) };
    if (sources.require(target.source).kind === "vector")
      toMaplibreVectorFeature(target);

    await sources.featureState.run(
      target,
      async () => {
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
      key === undefined ? "remove" : undefined
    );
  },
});
