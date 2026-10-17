import type { MapView } from "@rnmapbox/maps";
import type { ComponentRef } from "react";

import type { FeatureStateMethods } from "../../contracts/query-types.js";
import {
  assertFeatureIdentifier,
  assertFeatureState,
  featureStateFromWrapper,
  mutableFeatureState,
} from "../shared/feature-values.js";
import { toRnmapboxFeatureArgs, toRnmapboxStateKey } from "./convert-query.js";
import type { GeoJsonSourceRegistry } from "./geojson-source-registry.js";

/** Captures bridge arguments before queueing; reads the attached map at dispatch. */
export const createMapboxFeatureStateMethods = (
  getMap: () => ComponentRef<typeof MapView>,
  geoJsonSources: GeoJsonSourceRegistry
): FeatureStateMethods => ({
  setFeatureState: async (identifier, state) => {
    const target = assertFeatureIdentifier(identifier);
    const [featureId, sourceId, sourceLayerId] = toRnmapboxFeatureArgs(target);
    assertFeatureState(state);
    const mutableState = mutableFeatureState(state);

    await geoJsonSources.featureState.run(
      target,
      async () => {
        const map = getMap();
        await map.setFeatureState(
          featureId,
          mutableState,
          sourceId,
          sourceLayerId
        );
      },
      "write"
    );
  },
  getFeatureState: async (identifier) => {
    const target = assertFeatureIdentifier(identifier);
    const [featureId, sourceId, sourceLayerId] = toRnmapboxFeatureArgs(target);

    return geoJsonSources.featureState.run(target, async () => {
      const map = getMap();
      return featureStateFromWrapper(
        await map.getFeatureState(featureId, sourceId, sourceLayerId)
      );
    });
  },
  removeFeatureState: async (identifier, key) => {
    const target = assertFeatureIdentifier(identifier);
    const [featureId, sourceId, sourceLayerId] = toRnmapboxFeatureArgs(target);
    const stateKey = toRnmapboxStateKey(key);

    await geoJsonSources.featureState.run(
      target,
      async () => {
        const map = getMap();
        await map.removeFeatureState(
          featureId,
          stateKey,
          sourceId,
          sourceLayerId
        );
      },
      key === undefined ? "remove" : undefined
    );
  },
});
