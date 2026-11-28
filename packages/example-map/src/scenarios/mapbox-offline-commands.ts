import { WrapperOfflineManager } from "one-map-react/mapbox-native";

import type { Tf08OfflineCommands } from "./native-tf08-screen.js";
import { createOfflineCommandFactory } from "./offline-command-factory.js";

type NativePack = NonNullable<
  Awaited<ReturnType<typeof WrapperOfflineManager.getPack>>
>;

/**
 * Owns this test screen's explicit RNMapbox commands and single SDK observer.
 *
 * @returns Commands with raw SDK status and screen-lifetime disposal.
 */
export const createMapboxOfflineCommands: () => Tf08OfflineCommands =
  createOfflineCommandFactory<NativePack>({
    manager: WrapperOfflineManager,
    getNativeId: (pack) => pack.name,
    preflightCreate: (id, records) => {
      if (records.some((record) => record.nativeId === id)) {
        throw new Error("Offline pack already exists.");
      }
      return id;
    },
    create: async ({ id, fixture, progress, failure }) => {
      await WrapperOfflineManager.createPack(
        {
          name: id,
          styleURL: fixture.metadata.fixtureStyle,
          bounds: [
            [10, 10],
            [-10, -10],
          ],
          ...fixture,
        },
        progress,
        failure
      );
      const pack = await WrapperOfflineManager.getPack(id);
      if (!pack) throw new Error("Created offline pack is not discoverable.");
      return pack.name;
    },
    subscribe: (id, progress, failure) =>
      WrapperOfflineManager.subscribe(id, progress, failure),
    unsubscribe: (id) => WrapperOfflineManager.unsubscribe(id),
  });
