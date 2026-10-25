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

/** Validates and copies bridge arguments before dispatch to the attached map. */
export const createMapboxFeatureStateMethods = (
  getMap: () => ComponentRef<typeof MapView>
): FeatureStateMethods => ({
  setFeatureState: async (identifier, state) => {
    const target = assertFeatureIdentifier(identifier);
    const [featureId, sourceId, sourceLayerId] = toRnmapboxFeatureArgs(target);
    assertFeatureState(state);
    const mutableState = mutableFeatureState(state);

    await getMap().setFeatureState(
      featureId,
      mutableState,
      sourceId,
      sourceLayerId
    );
  },
  getFeatureState: async (identifier) => {
    const target = assertFeatureIdentifier(identifier);
    const [featureId, sourceId, sourceLayerId] = toRnmapboxFeatureArgs(target);

    return featureStateFromWrapper(
      await getMap().getFeatureState(featureId, sourceId, sourceLayerId)
    );
  },
  removeFeatureState: async (identifier, key) => {
    const target = assertFeatureIdentifier(identifier);
    const [featureId, sourceId, sourceLayerId] = toRnmapboxFeatureArgs(target);
    const stateKey = toRnmapboxStateKey(key);

    await getMap().removeFeatureState(
      featureId,
      stateKey,
      sourceId,
      sourceLayerId
    );
  },
});
