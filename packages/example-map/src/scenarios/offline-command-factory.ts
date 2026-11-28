import type { Tf08OfflineCommands } from "./native-tf08-screen.js";
import {
  findOfflinePack,
  type OfflinePackRecord,
  readOfflinePackIndex,
} from "./offline-pack-index.js";

interface OfflinePack {
  readonly metadata: unknown;
  status(): Promise<unknown>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}

interface ScreenObserver {
  nativeId?: string;
  pending: boolean;
}

type PackEvent<Pack> = (pack: Pack, value: unknown) => void;
type ReadIndex = () => Promise<readonly OfflinePackRecord[]>;

interface OfflineCommandBackend<Pack extends OfflinePack> {
  readonly manager: {
    getPacks(): Promise<Pack[]>;
    getPack(nativeId: string): Promise<Pack | undefined>;
    deletePack(nativeId: string): Promise<void>;
    invalidatePack(nativeId: string): Promise<void>;
  };
  readonly getNativeId: (pack: Pack) => string;
  readonly preflightCreate?: (
    id: string,
    records: readonly OfflinePackRecord[]
  ) => string;
  create(request: {
    readonly id: string;
    readonly fixture: ReturnType<typeof buildFixture>;
    readonly observer: Pick<ScreenObserver, "nativeId">;
    readonly readIndex: ReadIndex;
    readonly progress: PackEvent<Pack>;
    readonly failure: PackEvent<Pack>;
  }): Promise<string>;
  readonly subscribe: (
    nativeId: string,
    progress: PackEvent<Pack>,
    failure: PackEvent<Pack>
  ) => Promise<void>;
  readonly unsubscribe: (nativeId: string) => void;
}

/**
 * Builds the TF08 command factory for one backend's singleton SDK manager.
 *
 * @param backend - Selected SDK methods and its creation policy.
 * @returns A factory that owns separate commands and event history per screen.
 */
export const createOfflineCommandFactory = <Pack extends OfflinePack>(
  backend: OfflineCommandBackend<Pack>
): (() => Tf08OfflineCommands) => {
  // Keep the slot until pending SDK setup finishes, even if its screen detaches.
  let currentObserver: ScreenObserver | undefined;
  const toPersistedPack = (pack: Pack) => ({
    nativeId: backend.getNativeId(pack),
    metadata: pack.metadata,
  });
  const readIndex: ReadIndex = async () =>
    readOfflinePackIndex(
      (await backend.manager.getPacks()).map(toPersistedPack)
    );

  return () => {
    let active = true;
    let busy = false;
    let owned: ScreenObserver | undefined;
    const progressEvents: unknown[] = [];
    const errors: unknown[] = [];

    const dispose = () => {
      active = false;
      release();
    };
    const command: Tf08OfflineCommands["command"] = async (
      action,
      value = {}
    ) => {
      ensureActive();
      if (busy) throw new Error("Offline command is already pending.");
      if (!isOfflineAction(action)) throw new Error("Unknown offline action.");

      busy = true;
      try {
        const records = await readIndex();
        ensureActive();
        if (action === "offline-list") return records;
        const { id } = value;
        if (typeof id !== "string" || !id.trim()) {
          throw new Error("Offline command requires an identity.");
        }
        const record = findOfflinePack(records, id);

        if (action === "offline-create" || action === "offline-duplicate") {
          if (record) throw new Error("Offline pack already exists.");
          return await create(id, records);
        }
        if (!record) throw new Error("Acceptance pack missing.");
        const pack = await backend.manager.getPack(record.nativeId);
        ensureActive();
        if (!pack) throw new Error("Acceptance pack missing.");

        switch (action) {
          case "offline-unsubscribe":
            release();
            return null;
          case "offline-subscribe":
            await subscribe(record.nativeId);
            return null;
          case "offline-delete":
            if (owned?.nativeId === record.nativeId) release();
            await backend.manager.deletePack(record.nativeId);
            return null;
          case "offline-pause":
            await pack.pause();
            break;
          case "offline-resume":
            await pack.resume();
            break;
          case "offline-invalidate":
            await backend.manager.invalidatePack(record.nativeId);
            break;
          case "offline-status":
            break;
          default:
            throw new Error(
              `Unhandled offline action: ${action satisfies never}`
            );
        }

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
    };
    const create = async (
      id: string,
      records: readonly OfflinePackRecord[]
    ) => {
      const nativeId = backend.preflightCreate?.(id, records);
      if (id.startsWith("backend:")) {
        throw new Error("Reserved offline identity.");
      }
      const observer = claimObserver();

      try {
        const fixture = buildFixture(id);
        observer.nativeId = nativeId;
        const createdId = await backend.create({
          id,
          fixture,
          observer,
          readIndex,
          progress: collectEvent(observer, progressEvents, true),
          failure: collectEvent(observer, errors, true),
        });
        return (await readIndex()).find(
          (record) => record.nativeId === createdId
        );
      } finally {
        observer.pending = false;
        release(observer);
      }
    };
    const subscribe = async (nativeId: string) => {
      const observer = claimObserver(nativeId);
      let listening = false;
      try {
        await backend.subscribe(
          nativeId,
          collectEvent(observer, progressEvents),
          collectEvent(observer, errors)
        );
        if (!active || owned !== observer) {
          throw new Error("Offline screen detached during subscription.");
        }
        listening = true;
      } finally {
        observer.pending = false;
        if (!listening) release(observer);
      }
    };
    const ensureActive = () => {
      if (!active) throw new Error("Offline screen is detached.");
    };
    const claimObserver = (nativeId?: string): ScreenObserver => {
      if (currentObserver) {
        throw new Error(
          "Another offline screen observer is active or pending; retry after it settles."
        );
      }
      const observer = { nativeId, pending: true };
      currentObserver = observer;
      owned = observer;
      return observer;
    };
    const release = (observer = owned) => {
      if (!observer || currentObserver !== observer) return;
      if (observer.nativeId) backend.unsubscribe(observer.nativeId);
      if (!observer.pending) currentObserver = undefined;
      if (owned === observer) owned = undefined;
    };
    const collectEvent =
      (
        observer: ScreenObserver,
        events: unknown[],
        tracksNativeId = false
      ): PackEvent<Pack> =>
      (pack, value) => {
        if (tracksNativeId) observer.nativeId = backend.getNativeId(pack);
        if (active && owned === observer) events.push(value);
      };

    return { command, dispose };
  };
};

const buildFixture = (id: string) => ({
  minZoom: 0,
  maxZoom: 1,
  metadata: {
    regionId: id,
    test: "tf08",
    fixtureStyle: `http://127.0.0.1:8798/offline-style.json?id=${encodeURIComponent(id)}`,
  },
});

const offlineActions = [
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
] as const;

type OfflineAction = (typeof offlineActions)[number];

const isOfflineAction = (action: string): action is OfflineAction =>
  offlineActions.some((knownAction) => action === knownAction);
