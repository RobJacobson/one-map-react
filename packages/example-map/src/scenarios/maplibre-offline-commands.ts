import { WrapperOfflineManager } from "one-map-react/maplibre-native";

import type { Tf08OfflineCommands } from "./native-tf08-screen.js";
import { createOfflineCommandFactory } from "./offline-command-factory.js";
import { findOfflinePack } from "./offline-pack-index.js";

/**
 * Owns this test screen's explicit MapLibre React Native commands and observer.
 *
 * @returns Commands with raw SDK status and screen-lifetime disposal.
 */
export const createMaplibreOfflineCommands: () => Tf08OfflineCommands =
  createOfflineCommandFactory({
    manager: WrapperOfflineManager,
    getNativeId: (pack) => pack.id,
    create: async ({ id, fixture, observer, readIndex, progress, failure }) => {
      try {
        const pack = await WrapperOfflineManager.createPack(
          {
            mapStyle: fixture.metadata.fixtureStyle,
            bounds: [-10, -10, 10, 10],
            ...fixture,
          },
          progress,
          failure
        );
        observer.nativeId = pack.id;
        return pack.id;
      } catch (error) {
        // A failed observer setup can leave a persisted pack with a generated ID.
        if (!observer.nativeId) {
          try {
            const persisted = findOfflinePack(await readIndex(), id);
            if (persisted) observer.nativeId = persisted.nativeId;
          } catch (recoveryError) {
            throw new AggregateError(
              [error, recoveryError],
              "Offline creation and persisted pack discovery failed."
            );
          }
        }
        throw error;
      }
    },
    subscribe: (id, progress, failure) =>
      WrapperOfflineManager.addListener(id, progress, failure),
    unsubscribe: (id) => WrapperOfflineManager.removeListener(id),
  });
