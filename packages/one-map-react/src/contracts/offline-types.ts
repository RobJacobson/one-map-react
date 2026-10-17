import type { Bounds } from "./camera-types.js";

/** Persistent bounded download inputs. */
export interface OfflinePackOptions {
  /** Unique application identity, persisted in wrapper metadata. */
  readonly id: string;
  /** Style URL whose resources are downloaded. */
  readonly mapStyle: string;
  /** Southwest/northeast corners; antimeridian regions currently reject. */
  readonly bounds: Bounds;
  /** Minimum downloaded zoom, inclusive. */
  readonly minZoom: number;
  /** Maximum downloaded zoom, at least minZoom. */
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
   * @returns Current status; failures reject.
   */
  status(): Promise<OfflinePackStatus>;
  /**
   * Pauses the persistent download.
   * @returns Native pause acknowledgement, not deletion.
   */
  pause(): Promise<void>;
  /**
   * Resumes the persistent download and any active facade observer.
   * @returns Native resume acknowledgement, not download completion.
   */
  resume(): Promise<void>;
}

/** Persistent pack operations supported by the selected native backend. */
export interface OfflineService {
  /**
   * Creates a discoverable pack, rejecting duplicate identities.
   * @param options - Download region and identity.
   * @returns Created handle; resolution does not mean download completion.
   */
  createPack(options: OfflinePackOptions): Promise<OfflinePack>;
  /**
   * Looks up a pack without converting storage failures to absence.
   * @param id - Persistent identity.
   * @returns Found handle or undefined.
   */
  getPack(id: string): Promise<OfflinePack | undefined>;
  /**
   * Lists persisted native regions.
   * @returns Pack handles, including explicitly identified imports.
   */
  getPacks(): Promise<readonly OfflinePack[]>;
  /**
   * Deletes a pack; does not promise removal of shared resources.
   * @param id - Persistent identity.
   * @returns Native deletion acknowledgement.
   */
  deletePack(id: string): Promise<void>;
  /**
   * Observes a pack without controlling its download lifetime.
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
   * @param id - Persistent identity.
   * @returns Native invalidation acknowledgement.
   */
  invalidatePack(id: string): Promise<void>;
}
