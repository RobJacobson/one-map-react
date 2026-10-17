import type { Bounds } from "./camera-types.js";

/** Persistent bounded download inputs. */
export interface OfflinePackOptions {
  /** Nonempty application identity, persisted in metadata; backend: is reserved. */
  readonly id: string;
  /** Style URL whose resources are downloaded. */
  readonly mapStyle: string;
  /** Southwest/northeast corners; antimeridian regions currently reject. */
  readonly bounds: Bounds;
  /** Finite nonnegative minimum downloaded zoom, inclusive. */
  readonly minZoom: number;
  /** Finite maximum downloaded zoom, at least minZoom. */
  readonly maxZoom: number;
  /** JSON-serializable application metadata, kept separate from identity. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Observed download state; unknown measurements remain absent. */
export interface OfflinePackStatus {
  /** Persistent application or explicitly imported backend identity. */
  readonly id: string;
  /** State observed from the SDK. */
  readonly state: "inactive" | "active" | "complete" | "invalid" | "unknown";
  /** Percent completed when available, in [0, 100]. */
  readonly percentage?: number;
  /** Number of resources successfully downloaded. */
  readonly completedResourceCount?: number;
  /** Bytes of completed resources. */
  readonly completedResourceSize?: number;
  /** Number of completed tiles. */
  readonly completedTileCount?: number;
  /** Bytes of completed tiles. */
  readonly completedTileSize?: number;
  /** Required resource count when established. */
  readonly requiredResourceCount?: number;
}

/** Persistent native download handle, independent of a mounted map. */
export interface OfflinePack {
  /** Application identity, or backend:<id> for an imported pack. */
  readonly id: string;
  /** Wrapper identity used for native operations. */
  readonly backendId: string;
  /** Decoded application metadata. */
  readonly metadata: Readonly<Record<string, unknown>>;
  /** Common geographic bounds. */
  readonly bounds: Bounds;
  /**
   * Reads the observed download state.
   *
   * @returns Current status.
   * @throws When the backend read fails or its status is malformed.
   */
  status(): Promise<OfflinePackStatus>;
  /**
   * Pauses the persistent download.
   *
   * @returns Native pause acknowledgement, not deletion.
   * @throws When the backend cannot pause the pack.
   */
  pause(): Promise<void>;
  /**
   * Resumes the persistent download and any active facade observer.
   *
   * @returns Native resume acknowledgement, not download completion.
   * @throws When resuming, observer attachment, or status readback fails.
   */
  resume(): Promise<void>;
}

/** Persistent pack operations supported by the selected native backend. */
export interface OfflineService {
  /**
   * Creates a discoverable pack, rejecting duplicate identities.
   *
   * @remarks
   * A rejected creation can leave a persisted pack when the native creation
   * succeeded before later setup failed. Use getPack(options.id) to recover
   * that handle before retrying; rejection does not imply rollback.
   *
   * @param options - Download region and identity.
   * @returns Created handle; resolution does not mean download completion.
   * @throws When options or metadata are invalid, the identity already exists
   * or is being created, persisted identities conflict, or backend creation,
   * setup, or returned-pack decoding fails.
   */
  createPack(options: OfflinePackOptions): Promise<OfflinePack>;
  /**
   * Looks up a pack without converting storage failures to absence.
   *
   * @param id - Persistent identity.
   * @returns Found handle or undefined.
   * @throws When storage reads fail, persisted identities conflict, or the
   * returned pack cannot be decoded.
   */
  getPack(id: string): Promise<OfflinePack | undefined>;
  /**
   * Lists persisted native regions.
   *
   * @returns Pack handles, including explicitly identified imports.
   * @throws When storage reads fail, persisted identities conflict, or a
   * returned pack cannot be decoded.
   */
  getPacks(): Promise<readonly OfflinePack[]>;
  /**
   * Deletes a pack; does not promise removal of shared resources.
   *
   * @param id - Persistent identity.
   * @returns Native deletion acknowledgement.
   * @throws When lookup fails, the pack is absent, or native deletion or
   * observer cleanup fails.
   */
  deletePack(id: string): Promise<void>;
  /**
   * Observes a pack without controlling its download lifetime.
   *
   * @remarks
   * Missing packs, lookup failures, observer setup failures, and SDK errors
   * reach onError. Disposal suppresses later progress/error delivery and does
   * not delete or pause the persistent download.
   *
   * @param id - Persistent identity.
   * @param onProgress - Observed status, including initial readback.
   * @param onError - Setup or SDK failure.
   * @returns Immediate idempotent disposal, including during setup.
   */
  subscribe(
    id: string,
    onProgress: (status: OfflinePackStatus) => void,
    onError: (error: unknown) => void
  ): () => void;
  /**
   * Revalidates resources and reattaches active observers.
   *
   * @param id - Persistent identity.
   * @returns Native invalidation acknowledgement.
   * @throws When lookup fails, the pack is absent, or invalidation, observer
   * attachment, or status readback fails.
   */
  invalidatePack(id: string): Promise<void>;
}
