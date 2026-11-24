import type { MapView } from "@rnmapbox/maps";
import type { ComponentRef } from "react";

import type { FeatureStateMethods } from "../../contracts/query-types.js";
import {
  assertFeatureIdentifier,
  copyValidatedFeatureState,
  featureStateFromWrapper,
} from "../shared/feature-values.js";

/**
 * Validates and copies bridge arguments before dispatch to the attached map.
 *
 * @param getMap - Resolves the current map ref or throws when detached.
 * @returns Feature-state methods for this map.
 */
export const createMapboxFeatureStateMethods = (
  getMap: () => ComponentRef<typeof MapView>
): FeatureStateMethods => ({
  setFeatureState: async (identifier, state) => {
    const [featureId, sourceId, sourceLayerId] = toFeatureArgs(identifier);
    const mutableState = copyValidatedFeatureState(state);

    await getMap().setFeatureState(
      featureId,
      mutableState,
      sourceId,
      sourceLayerId
    );
  },
  getFeatureState: async (identifier) => {
    const [featureId, sourceId, sourceLayerId] = toFeatureArgs(identifier);

    return featureStateFromWrapper(
      await getMap().getFeatureState(featureId, sourceId, sourceLayerId)
    );
  },
  removeFeatureState: async (identifier, key) => {
    const [featureId, sourceId, sourceLayerId] = toFeatureArgs(identifier);

    await getMap().removeFeatureState(
      featureId,
      key ?? null,
      sourceId,
      sourceLayerId
    );
  },
});

const toFeatureArgs = (identifier: unknown) => {
  const { id, source, sourceLayer } = assertFeatureIdentifier(identifier);
  return [String(id), source, sourceLayer ?? null] as const;
};
