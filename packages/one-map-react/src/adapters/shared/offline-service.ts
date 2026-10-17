import type { Bounds } from "../../contracts/camera-types.js";
import type {
  OfflinePack,
  OfflinePackOptions,
  OfflinePackStatus,
  OfflineService,
} from "../../contracts/offline-types.js";
import { assertBounds, lngLatFromWrapper } from "./wrapper-values.js";

/** Minimal public wrapper pack boundary. */
export interface WrapperOfflinePack {
  readonly id?: string;
  readonly name?: string;
  readonly metadata: unknown;
  readonly bounds: unknown;
  status(): Promise<unknown>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}

/** Backend-local calls; the facade owns identity and observer fan-out only. */
export interface OfflineBackend {
  readonly kind: "mapbox" | "maplibre";
  readonly getPacks: () => Promise<readonly WrapperOfflinePack[]>;
  readonly create: (
    options: OfflinePackOptions,
    metadata: Record<string, unknown>,
    progress: (pack: WrapperOfflinePack, status: unknown) => void,
    error: (pack: WrapperOfflinePack, error: unknown) => void,
    releaseUnobserved: (id: string) => void
  ) => Promise<WrapperOfflinePack>;
  readonly observe: (
    id: string,
    progress: (pack: WrapperOfflinePack, status: unknown) => void,
    error: (pack: WrapperOfflinePack, error: unknown) => void
  ) => Promise<void>;
  readonly unobserve: (id: string) => void;
  readonly deletePack: (id: string) => Promise<void>;
  readonly invalidatePack: (id: string) => Promise<void>;
  readonly state: (value: unknown) => OfflinePackStatus["state"];
}

interface Subscriber {
  readonly progress: (status: OfflinePackStatus) => void;
  readonly error: (error: unknown) => void;
}

interface PackObserver {
  readonly pack: WrapperOfflinePack;
  readonly subscribers: Set<Subscriber>;
  /** Serializes asynchronous observer attachment and disposal for this pack. */
  operation: Promise<void>;
  /** Changes when an SDK progress event supersedes an in-flight status read. */
  progressRevision: number;
  attached: boolean;
  attachment?: object;
}

const identityKey = "oneMapReactOffline";

/**
 * Normalizes persistent pack identity and shares one wrapper observer per pack.
 *
 * @param backend - Selected public wrapper operations.
 * @returns Native download service, independent of map attachment.
 */
export const createOfflineService = (
  backend: OfflineBackend
): OfflineService => {
  const observers = new Map<string, PackObserver>();
  const creating = new Set<string>();
  const releaseUnobserved = (id: string): void => {
    if (!observers.has(id)) backend.unobserve(id);
  };
  const emit = (observer: PackObserver, raw: unknown): void => {
    const next = status(observer.pack, raw, backend);
    // eslint-disable-next-line unicorn/no-useless-spread -- Snapshot subscriptions before callbacks can add or remove listeners during delivery.
    for (const listener of [...observer.subscribers]) listener.progress(next);
  };
  const refresh = async (pack: WrapperOfflinePack): Promise<void> => {
    const id = backendId(pack, backend.kind);
    const observer = observers.get(id);
    if (!observer) return;
    const isCurrent = (): boolean => observers.get(id) === observer;
    observer.operation = observer.operation
      .catch(() => {})
      .then(async () => {
        if (!isCurrent()) return;
        if (!observer.subscribers.size) {
          backend.unobserve(id);
          return;
        }
        if (!observer.attached) {
          const attachment = {};
          observer.attachment = attachment;
          observer.attached = true;
          try {
            await backend.observe(
              id,
              (_pack, raw) => {
                if (
                  !isCurrent() ||
                  observer.attachment !== attachment ||
                  !observer.subscribers.size
                )
                  return;
                if (status(pack, raw, backend).state === "complete")
                  observer.attached = false;
                observer.progressRevision += 1;
                emit(observer, raw);
              },
              (_pack, failure) => {
                if (!isCurrent() || observer.attachment !== attachment) return;
                // eslint-disable-next-line unicorn/no-useless-spread -- Snapshot subscriptions before callbacks can add or remove listeners during delivery.
                for (const listener of [...observer.subscribers])
                  listener.error(failure);
              }
            );
          } catch (failure) {
            if (!isCurrent()) return;
            observer.attachment = undefined;
            observer.attached = false;
            backend.unobserve(id);
            throw failure;
          }
        }
        if (!isCurrent()) return;
        if (!observer.subscribers.size) {
          observer.attachment = undefined;
          observer.attached = false;
          backend.unobserve(id);
          return;
        }
        const progressRevision = observer.progressRevision;
        const raw = await pack.status();
        if (
          isCurrent() &&
          observer.subscribers.size &&
          observer.progressRevision === progressRevision
        ) {
          emit(observer, raw);
        }
      })
      .catch((failure) => {
        if (isCurrent()) throw failure;
      });
    await observer.operation;
  };
  const wrap = (pack: WrapperOfflinePack): OfflinePack => {
    const metadata = objectValue(pack.metadata);
    const facade = objectValue(metadata[identityKey]);
    return {
      id: identity(pack, backend.kind),
      backendId: backendId(pack, backend.kind),
      metadata: facade.version === 1 ? objectValue(metadata.user) : metadata,
      bounds: offlineBounds(pack.bounds, backend.kind),
      status: async () => status(pack, await pack.status(), backend),
      pause: () => pack.pause(),
      resume: async () => {
        await refresh(pack);
        await pack.resume();
        // Completion during preparation can make the wrapper retire its listener.
        // Reattach and read back progress after dispatch, including fast completion.
        await refresh(pack);
      },
    };
  };
  const packs = async (): Promise<readonly WrapperOfflinePack[]> => {
    const result = await backend.getPacks();
    const ids = result.map((pack) => identity(pack, backend.kind));
    if (new Set(ids).size !== ids.length)
      throw new Error(
        "Duplicate persisted offline identities require reconciliation."
      );
    return result;
  };
  const find = async (id: string): Promise<WrapperOfflinePack | undefined> =>
    (await packs()).find((pack) => identity(pack, backend.kind) === id);
  const requirePack = async (id: string): Promise<WrapperOfflinePack> => {
    const pack = await find(id);
    if (!pack) throw new Error("Offline pack was not found.");
    return pack;
  };
  return {
    createPack: async (options) => {
      validateOfflineOptions(options);
      if (creating.has(options.id))
        throw new Error("Offline identity is already being created.");
      creating.add(options.id);
      let creationStarted = false;
      let created: WrapperOfflinePack | undefined;
      try {
        if (await find(options.id))
          throw new Error("Offline identity already exists.");
        const metadata = {
          [identityKey]: { version: 1, id: options.id },
          user: options.metadata ?? {},
        };
        creationStarted = true;
        created = await backend.create(
          options,
          metadata,
          () => {},
          () => {},
          releaseUnobserved
        );
        return wrap(created);
      } catch (failure) {
        // Creation can succeed before post-create listener setup fails. Preserve
        // the persistent pack for lookup/recovery; never delete it implicitly.
        // A rejected duplicate never owned the existing pack's observer.
        if (creationStarted) {
          const persisted =
            created ?? (await find(options.id).catch(() => undefined));
          if (persisted) releaseUnobserved(backendId(persisted, backend.kind));
        }
        throw failure;
      } finally {
        creating.delete(options.id);
        if (created) releaseUnobserved(backendId(created, backend.kind));
      }
    },
    getPack: async (id) => {
      const pack = await find(id);
      return pack ? wrap(pack) : undefined;
    },
    getPacks: async () => (await packs()).map(wrap),
    deletePack: async (id) => {
      const pack = await requirePack(id);
      const nativeId = backendId(pack, backend.kind);
      const observer = observers.get(nativeId);
      if (observer) {
        await observer.operation.catch(() => {});
      }
      await backend.deletePack(nativeId);
      observers.get(nativeId)?.subscribers.clear();
      backend.unobserve(nativeId);
      observers.delete(nativeId);
    },
    invalidatePack: async (id) => {
      const pack = await requirePack(id);
      await refresh(pack);
      await backend.invalidatePack(backendId(pack, backend.kind));
      // Invalidation has the same completion race as resume.
      await refresh(pack);
    },
    subscribe: (id, onProgress, onError) => {
      let active = true;
      let observer: PackObserver | undefined;
      const subscriber: Subscriber = {
        progress: (value) => {
          if (active) onProgress(value);
        },
        error: (value) => {
          if (active) onError(value);
        },
      };
      void requirePack(id)
        .then(async (pack) => {
          if (!active) return;
          const nativeId = backendId(pack, backend.kind);
          observer = observers.get(nativeId);
          if (!observer) {
            observer = {
              pack,
              subscribers: new Set(),
              operation: Promise.resolve(),
              progressRevision: 0,
              attached: false,
            };
            observers.set(nativeId, observer);
          }
          observer.subscribers.add(subscriber);
          await refresh(pack);
        })
        .catch(subscriber.error);
      return () => {
        if (!active) return;
        active = false;
        if (!observer) return;
        observer.subscribers.delete(subscriber);
        if (!observer.subscribers.size) {
          observer.attachment = undefined;
          observer.attached = false;
        }
        if (observer.subscribers.size === 0) {
          const retired = observer;
          retired.operation = retired.operation
            .catch(() => {})
            .then(() => {
              const id = backendId(retired.pack, backend.kind);
              // Deletion can recreate this backend id before an old disposer runs.
              if (
                observers.get(id) === retired &&
                retired.subscribers.size === 0
              ) {
                observers.delete(id);
                backend.unobserve(id);
              }
            });
        }
      };
    },
  };
};

const status = (
  pack: WrapperOfflinePack,
  raw: unknown,
  backend: OfflineBackend
): OfflinePackStatus => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Offline status returned no result.");
  const value = objectValue(raw);
  const measurements = Object.fromEntries(
    [
      "percentage",
      "completedResourceCount",
      "completedResourceSize",
      "completedTileCount",
      "completedTileSize",
      "requiredResourceCount",
    ].flatMap((key) => {
      const measurement = value[key];
      return typeof measurement === "number" &&
        Number.isFinite(measurement) &&
        measurement >= 0 &&
        (key !== "percentage" || measurement <= 100)
        ? [[key, measurement]]
        : [];
    })
  );
  return {
    id: identity(pack, backend.kind),
    state: backend.state(value.state),
    ...measurements,
  };
};

const identity = (
  pack: WrapperOfflinePack,
  kind: OfflineBackend["kind"]
): string => {
  const metadata = objectValue(pack.metadata);
  const facade = objectValue(metadata[identityKey]);
  return facade.version === 1 && typeof facade.id === "string"
    ? facade.id
    : `backend:${backendId(pack, kind)}`;
};

const backendId = (
  pack: WrapperOfflinePack,
  kind: OfflineBackend["kind"]
): string => {
  const value = kind === "mapbox" ? pack.name : pack.id;
  if (!value) throw new Error("Offline pack has no backend identity.");
  return value;
};

/** Validates region/identity and rejects unserializable application metadata. */
export const validateOfflineOptions = (options: OfflinePackOptions): void => {
  if (!options.id?.trim() || options.id.startsWith("backend:"))
    throw new Error(
      "Offline identity must be nonempty and cannot use the backend: prefix."
    );
  if (!options.mapStyle?.trim())
    throw new Error("Offline creation requires a style URL.");
  const [southwest, northeast] = assertBounds(options.bounds);
  if (southwest[0] > northeast[0])
    throw new Error(
      "Antimeridian offline regions require a named backend API."
    );
  if (
    ![options.minZoom, options.maxZoom].every(Number.isFinite) ||
    options.minZoom < 0 ||
    options.maxZoom < options.minZoom
  )
    throw new Error("Offline zoom range is invalid.");
  validateJsonValue(options.metadata ?? {}, new Set());
};

const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const offlineBounds = (
  raw: unknown,
  backend: OfflineBackend["kind"]
): Bounds => {
  const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  const collection = objectValue(value);
  if (backend === "mapbox" && collection.type === "FeatureCollection") {
    // RNMapbox 10.3.7 creation returns its input GeoJSON; enumeration returns
    // flat bounds. Both use northeast then southwest; see tf08-offline.test.ts.
    const features = collection.features;
    if (!Array.isArray(features) || features.length !== 2)
      throw new Error("Offline pack returned invalid bounds.");
    const corners = features.map((feature: unknown) => {
      const point = objectValue(feature);
      const geometry = objectValue(point.geometry);
      if (point.type !== "Feature" || geometry.type !== "Point")
        throw new Error("Offline pack returned invalid point bounds.");
      return lngLatFromWrapper(geometry.coordinates);
    });
    return assertBounds([corners[1], corners[0]]);
  }
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  )
    throw new Error("Offline pack returned invalid bounds.");
  return assertBounds(
    backend === "mapbox"
      ? [
          [value[2], value[3]],
          [value[0], value[1]],
        ]
      : [
          [value[0], value[1]],
          [value[2], value[3]],
        ]
  );
};

/** Rejects values JSON would silently drop or coerce, and cycles. */
const validateJsonValue = (value: unknown, ancestors: Set<object>): void => {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (!value || typeof value !== "object" || ancestors.has(value))
    throw new Error("Offline metadata must contain acyclic JSON values.");
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new Error("Offline metadata must contain plain JSON objects.");
  if (Object.getOwnPropertySymbols(value).length)
    throw new Error("Offline metadata cannot contain symbol keys.");
  ancestors.add(value);
  if (Array.isArray(value) && value.includes(undefined))
    throw new Error("Offline metadata must contain acyclic JSON values.");
  for (const child of Object.values(value)) validateJsonValue(child, ancestors);
  ancestors.delete(value);
};
