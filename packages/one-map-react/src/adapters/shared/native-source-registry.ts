/** Tracks source registrations for one mounted native map. */
export class NativeSourceRegistry<Source, GeoJsonRef> {
  private readonly refs = new Map<
    string,
    {
      readonly read: () => Source | null | undefined;
      readonly requireGeoJson: () => GeoJsonRef;
    }
  >();

  /**
   * Creates a registry with the adapter's selection for GeoJSON refs.
   *
   * @param selectGeoJson - Returns the GeoJSON ref, if present.
   */
  constructor(
    private readonly selectGeoJson: (
      source: Source | null | undefined
    ) => GeoJsonRef | undefined
  ) {}

  /**
   * Registers a source whose wrapper ref may change while mounted.
   *
   * @param id - Facade source id.
   * @param read - Getter for the current registered source.
   * @returns Cleanup that only removes this registration.
   */
  register(id: string, read: () => Source | null | undefined): () => void {
    // A replacement can register the same getter and ref under this id.
    const owner = {
      read,
      requireGeoJson: (): GeoJsonRef => {
        const ref =
          this.refs.get(id) === owner ? this.selectGeoJson(read()) : undefined;
        if (ref !== undefined) return ref;
        throw new Error(`Source "${id}" is no longer mounted.`);
      },
    };
    this.refs.set(id, owner);

    return () => {
      if (this.refs.get(id) === owner) {
        this.refs.delete(id);
      }
    };
  }

  /**
   * Captures the mounted GeoJSON registration for a cached cluster handle.
   *
   * @param id - Facade source id.
   * @returns A stable getter for this registration, or undefined without a GeoJSON ref.
   * @remarks The getter reads the latest ref and throws if the registration is replaced
   * or no longer has a GeoJSON ref.
   */
  getGeoJsonOwner(id: string): (() => GeoJsonRef) | undefined {
    const owner = this.refs.get(id);
    if (!owner || this.selectGeoJson(owner.read()) === undefined) {
      return undefined;
    }

    return owner.requireGeoJson;
  }

  /**
   * Reads the current source registration.
   *
   * @param id - Facade source id.
   * @returns The attached source, if present.
   */
  get(id: string): Source | undefined {
    return this.refs.get(id)?.read() ?? undefined;
  }
}
