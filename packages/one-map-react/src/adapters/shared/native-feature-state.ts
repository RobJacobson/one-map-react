import type { FeatureIdentifier } from "../../contracts/query-types.js";

interface SourceOwner {
  reset: boolean;
  failed: boolean;
  error?: unknown;
  flush?: Promise<void>;
  reported?: boolean;
}

interface SourceState {
  readonly journals: Map<string | undefined, Map<string, FeatureIdentifier>>;
  identifiers: Map<string, FeatureIdentifier>;
  pending: Promise<void>;
  owned: boolean;
  scope?: string;
  registration?: object;
  owner: SourceOwner;
}

/**
 * Resets facade-written native state when a source or style is replaced.
 *
 * Native wrappers can adopt a same-id source during rapid replacement. Keep
 * only written identifiers, and order replacement cleanup after pending writes
 * and before new state operations. Style changes also reset facade-written
 * targets in unowned style sources. State values remain owned by the renderer.
 * Empty detached records are forgotten after their queues settle; later calls
 * for those ids use the selected adapter's normal source validation.
 */
export class NativeFeatureState {
  private readonly sources = new Map<string, SourceState>();
  private readonly resets = new Set<SourceState>();

  /**
   * @param reset - Removes an identifier's whole state on the current source.
   */
  constructor(
    private readonly reset: (identifier: FeatureIdentifier) => Promise<void>
  ) {}

  /**
   * Starts an owned source lifetime without dispatching to an attaching view.
   * @param sourceId - Facade source id.
   * @param scope - Actual source family; returning families reset their prior written targets.
   * @returns Cleanup that cannot release a replacement lifetime.
   */
  register(sourceId: string, scope?: string): () => void {
    const source = this.source(sourceId);
    const registration = {};

    // Native source replacement can retain an inactive family's state. Keep
    // each written-target journal until that family returns, but never send its
    // reset arguments through a different family's source ref. The source queue
    // still waits for already dispatched writes before new cleanup or writes.
    if (source.scope !== scope) {
      const journal = this.journal(source, scope);
      if (source.scope === undefined) {
        // Raw style writes have no registered family. Preserve first adoption
        // cleanup by assigning those targets to the first known source family.
        for (const [key, target] of source.identifiers) {
          journal.set(key, target);
        }
        source.journals.delete(undefined);
      }
      source.identifiers = journal;
    }
    source.scope = scope;
    source.owned = true;
    source.registration = registration;
    this.resetOwner(source);

    return () => {
      // A style epoch invalidates operations but leaves this registration's
      // cleanup valid until a new source instance replaces it.
      if (source.registration === registration) {
        source.registration = undefined;
        this.resets.delete(source);
        this.reclaim(sourceId, source);
      }
    };
  }

  /**
   * Invalidates operations after a committed style change.
   *
   * Pending old writes settle before the next operation resets their targets.
   * New epochs also retry failed resets without detaching mounted sources.
   */
  resetStyle(): void {
    for (const source of this.sources.values()) {
      this.resetOwner(source);
    }
  }

  /**
   * Clears pending state after the renderer confirms source attachment.
   *
   * Each source uses its existing operation queue. Repeated frame callbacks
   * share the active flush, and failures cannot block another source's reset.
   * A superseded automatic flush is canceled without reporting an error;
   * current reset failures remain visible to explicit operations.
   *
   * @param reportError - Reports each current generation's reset failure once.
   * @returns Completion of all resets started or joined by this frame.
   */
  flush(reportError: (error: unknown) => void): Promise<void> {
    const pending: Promise<void>[] = [];

    // eslint-disable-next-line unicorn/no-useless-spread -- Error callbacks may replace a source or style during delivery.
    for (const source of [...this.resets]) {
      const owner = source.owner;

      if (owner.failed) {
        this.reportResetError(source, owner, owner.error, reportError);
        if (source.owner === owner) this.resets.delete(source);
        continue;
      }

      if (!owner.reset && !owner.flush) {
        this.resets.delete(source);
        continue;
      }

      if (!owner.flush) {
        const target = source.identifiers.values().next().value;
        if (!target) continue;

        owner.flush = this.run(target, async () => {})
          .catch((error) => {
            this.reportResetError(source, owner, error, reportError);
          })
          .finally(() => {
            if (source.owner === owner) this.resets.delete(source);
          });
      }

      pending.push(owner.flush);
    }

    return Promise.all(pending).then(() => undefined);
  }

  /**
   * Runs a state operation after any prior write and replacement reset.
   * @param identifier - Validated native feature-state target.
   * @param operation - Dispatch using the current wrapper handle.
   * @param change - Track a possibly partial write or forget a successful whole-state removal.
   * @returns The operation result; detachment and reset failures reject.
   */
  run<Result>(
    identifier: FeatureIdentifier,
    operation: () => Promise<Result>,
    change?: "write" | "remove"
  ): Promise<Result> {
    // Native bridge arguments are captured when the public call starts. Keep
    // cleanup bound to that same target while earlier operations are pending.
    const target = { ...identifier };
    const source = this.source(target.source);
    const owner = source.owner;
    const result = source.pending.then(async () => {
      this.assertOwner(target.source, source, owner);

      if (owner.failed) throw owner.error;

      if (owner.reset) {
        try {
          for (const writtenTarget of source.identifiers.values()) {
            this.assertOwner(target.source, source, owner);
            await this.reset(writtenTarget);
          }

          this.assertOwner(target.source, source, owner);
          source.identifiers.clear();
          owner.reset = false;
          if (!owner.flush) this.resets.delete(source);
        } catch (error) {
          owner.failed = true;
          owner.error = error;
          throw error;
        }
      }

      const key = JSON.stringify([
        String(target.id),
        target.sourceLayer ?? null,
      ]);
      if (change === "write") {
        source.identifiers.set(key, target);
      }

      const value = await operation();
      this.assertOwner(target.source, source, owner);
      if (change === "remove") source.identifiers.delete(key);
      return value;
    });

    // A rejected operation remains visible to its caller. The ordering tail
    // still settles so an unrelated failure cannot block replacement cleanup.
    source.pending = result.then(
      () => undefined,
      () => undefined
    );
    this.reclaim(target.source, source);

    return result;
  }

  /** Forgets empty retired lifetimes only after their latest queue settles. */
  private reclaim(sourceId: string, source: SourceState): void {
    if (source.registration) return;
    const pending = source.pending;
    void pending.then(() => {
      if (
        this.sources.get(sourceId) !== source ||
        source.pending !== pending ||
        source.registration ||
        source.owner.failed ||
        [...source.journals.values()].some((journal) => journal.size > 0)
      ) {
        return;
      }

      this.sources.delete(sourceId);
      this.resets.delete(source);
    });
  }

  /** Replaces a lifetime's reset work without scanning historical sources per frame. */
  private resetOwner(source: SourceState): void {
    source.owner = {
      reset: source.identifiers.size > 0,
      failed: false,
    };
    if (source.owner.reset && (!source.owned || source.registration))
      this.resets.add(source);
    else this.resets.delete(source);
  }

  private source(sourceId: string): SourceState {
    let source = this.sources.get(sourceId);

    if (!source) {
      const identifiers = new Map<string, FeatureIdentifier>();
      source = {
        journals: new Map([[undefined, identifiers]]),
        identifiers,
        pending: Promise.resolve(),
        owned: false,
        owner: { reset: false, failed: false },
      };
      this.sources.set(sourceId, source);
    }

    return source;
  }

  private journal(
    source: SourceState,
    scope: string | undefined
  ): Map<string, FeatureIdentifier> {
    let journal = source.journals.get(scope);
    if (!journal) {
      journal = new Map();
      source.journals.set(scope, journal);
    }
    return journal;
  }

  private assertOwner(
    sourceId: string,
    source: SourceState,
    owner: SourceOwner
  ): void {
    if (source.owned && !source.registration) {
      throw new Error(`Source "${sourceId}" is detached.`);
    }

    if (source.owner !== owner) {
      throw new Error(
        `Source "${sourceId}" changed during a feature-state operation.`
      );
    }
  }

  private reportResetError(
    source: SourceState,
    owner: SourceOwner,
    error: unknown,
    reportError: (error: unknown) => void
  ): void {
    if (
      source.owner !== owner ||
      (source.owned && !source.registration) ||
      owner.reported
    ) {
      return;
    }

    owner.reported = true;
    reportError(error);
  }
}
