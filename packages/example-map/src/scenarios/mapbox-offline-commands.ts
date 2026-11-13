import { WrapperOfflineManager } from "one-map-react/mapbox-native";

import type { Tf08OfflineCommands } from "./native-tf08-screen.js";
import { findOfflinePack, readOfflinePackIndex } from "./offline-pack-index.js";

type NativePack = NonNullable<
  Awaited<ReturnType<typeof WrapperOfflineManager.getPack>>
>;

interface ScreenOfflineObserver {
  nativeId?: string;
  pending: boolean;
}

// The singleton SDK has one listener slot per pack; keep replacement screens
// out until an old create/setup finishes installing and releasing its listener.
let screenObserver: ScreenOfflineObserver | undefined;

/**
 * Owns this test screen's explicit SDK commands and single SDK observer.
 *
 * @returns Commands with raw SDK status and screen-lifetime disposal.
 */
export const createMapboxOfflineCommands = (): Tf08OfflineCommands => {
  let active = true;
  let busy = false;
  let owned: ScreenOfflineObserver | undefined;
  const progressEvents: unknown[] = [];
  const errors: unknown[] = [];
  const index = async () =>
    readOfflinePackIndex(
      (await WrapperOfflineManager.getPacks()).map((pack: NativePack) => ({
        nativeId: pack.name,
        metadata: pack.metadata,
      }))
    );
  const releaseObserver = (observer: ScreenOfflineObserver) => {
    if (screenObserver !== observer) return;
    if (observer.nativeId) WrapperOfflineManager.unsubscribe(observer.nativeId);
    if (!observer.pending) screenObserver = undefined;
    if (owned === observer) owned = undefined;
  };
  const release = () => {
    if (owned) releaseObserver(owned);
  };
  const claimObserver = (nativeId?: string): ScreenOfflineObserver => {
    if (screenObserver)
      throw new Error(
        "Another offline screen observer is active or pending; retry after it settles."
      );
    const observer = { nativeId, pending: true };
    screenObserver = observer;
    owned = observer;
    return observer;
  };

  return {
    dispose: () => {
      active = false;
      release();
    },
    command: async (action, value = {}) => {
      if (!active) throw new Error("Offline screen is detached.");
      if (busy) throw new Error("Offline command is already pending.");
      if (
        ![
          "offline-list",
          "offline-create",
          "offline-duplicate",
          "offline-status",
          "offline-subscribe",
          "offline-unsubscribe",
          "offline-delete",
          "offline-pause",
          "offline-resume",
          "offline-invalidate",
        ].includes(action)
      )
        throw new Error("Unknown offline action.");
      busy = true;

      try {
        const records = await index();
        if (!active) throw new Error("Offline screen is detached.");
        if (action === "offline-list") return records;
        const id = value.id;
        if (typeof id !== "string" || !id.trim())
          throw new Error("Offline command requires an identity.");
        const record = findOfflinePack(records, id);

        if (action === "offline-create" || action === "offline-duplicate") {
          if (record || records.some((entry) => entry.nativeId === id))
            throw new Error("Offline pack already exists.");
          if (id.startsWith("backend:"))
            throw new Error("Reserved offline identity.");
          const observer = claimObserver(id);
          const progress: Parameters<
            typeof WrapperOfflineManager.createPack
          >[1] = (pack: NativePack, status: unknown) => {
            observer.nativeId = pack.name;
            if (active && owned === observer) progressEvents.push(status);
          };
          const failure: NonNullable<
            Parameters<typeof WrapperOfflineManager.createPack>[2]
          > = (pack: NativePack, error: unknown) => {
            observer.nativeId = pack.name;
            if (active && owned === observer) errors.push(error);
          };
          const fixtureStyle = `http://127.0.0.1:8798/offline-style.json?id=${encodeURIComponent(id)}`;

          try {
            await WrapperOfflineManager.createPack(
              {
                name: id,
                styleURL: fixtureStyle,
                bounds: [
                  [10, 10],
                  [-10, -10],
                ],
                minZoom: 0,
                maxZoom: 1,
                metadata: { regionId: id, test: "tf08", fixtureStyle },
              },
              progress,
              failure
            );
            const pack = await WrapperOfflineManager.getPack(id);
            if (!pack)
              throw new Error("Created offline pack is not discoverable.");
            return (await index()).find(
              (record) => record.nativeId === pack.name
            );
          } finally {
            observer.pending = false;
            releaseObserver(observer);
          }
        }
        if (!record) throw new Error("Acceptance pack missing.");
        const pack = await WrapperOfflineManager.getPack(record.nativeId);
        if (!active) throw new Error("Offline screen is detached.");
        if (!pack) throw new Error("Acceptance pack missing.");

        if (action === "offline-unsubscribe") {
          release();
          return null;
        }
        if (action === "offline-subscribe") {
          const observer = claimObserver(record.nativeId);

          try {
            await WrapperOfflineManager.subscribe(
              record.nativeId,
              (_pack: NativePack, status: unknown) => {
                if (active && owned === observer) progressEvents.push(status);
              },
              (_pack: NativePack, error: unknown) => {
                if (active && owned === observer) errors.push(error);
              }
            );
          } catch (error) {
            observer.pending = false;
            releaseObserver(observer);
            throw error;
          }
          observer.pending = false;
          if (!active || owned !== observer) {
            releaseObserver(observer);
            throw new Error("Offline screen detached during subscription.");
          }
          return null;
        }
        if (action === "offline-delete") {
          if (owned?.nativeId === record.nativeId) release();
          await WrapperOfflineManager.deletePack(record.nativeId);
          return null;
        }
        if (action === "offline-pause") await pack.pause();
        else if (action === "offline-resume") await pack.resume();
        else if (action === "offline-invalidate")
          await WrapperOfflineManager.invalidatePack(record.nativeId);
        else if (action !== "offline-status")
          throw new Error("Unknown offline action.");

        return {
          pack: record,
          status: await pack.status(),
          progress: [...progressEvents],
          errors: errors.length,
          errorMessages: [...errors],
        };
      } finally {
        busy = false;
      }
    },
  };
};
