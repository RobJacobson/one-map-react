import type { ShapeSource } from "@rnmapbox/maps";
import type { ComponentRef } from "react";
import { createContext, useContext } from "react";

/**
 * Registry of mounted RNMapbox GeoJSON source refs, keyed by facade id.
 *
 * Cluster methods dispatch through the `ShapeSource` ref, so the map
 * component owns this registry and each mounted GeoJSON source registers
 * its ref. A ref registered under an id that a newer source already
 * claimed does not unregister the newer entry. This only protects cleanup;
 * renderer support for duplicate source ids is not promised.
 */
export class GeoJsonSourceRegistry {
  private readonly refs = new Map<
    string,
    {
      readonly read: () => ComponentRef<typeof ShapeSource> | null;
      readonly requireGeoJson: () => ComponentRef<typeof ShapeSource>;
    }
  >();

  /**
   * Records the source ref mounted under an id.
   *
   * @param id - Facade source id.
   * @param read - Getter for the current RNMapbox `ShapeSource` ref.
   * @returns Cleanup bound to this registration.
   */
  register(
    id: string,
    read: () => ComponentRef<typeof ShapeSource> | null
  ): () => void {
    const owner = {
      read,
      requireGeoJson: () => {
        const source = this.refs.get(id) === owner ? read() : undefined;
        if (source) return source;
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

  /** Captures a mounted GeoJSON registration, including its identity across wrapper ref refreshes. */
  getGeoJsonOwner(
    id: string
  ): (() => ComponentRef<typeof ShapeSource>) | undefined {
    const owner = this.refs.get(id);
    if (!owner?.read()) return undefined;
    return owner.requireGeoJson;
  }

  /**
   * Reads the source ref for an id.
   *
   * @param id - Facade source id.
   * @returns The registered `ShapeSource` ref.
   * @throws When no facade GeoJSON source is mounted under the id.
   */
  require(id: string): ComponentRef<typeof ShapeSource> {
    const ref = this.refs.get(id)?.read();

    if (!ref) {
      throw new Error(
        `Source "${id}" is not a mounted GeoJSON Source. Cluster methods need a mounted clustered GeoJSON source.`
      );
    }

    return ref;
  }
}

/**
 * Context carrying the enclosing map's GeoJSON source registry.
 *
 * `null` means no map provides the registry; sources then skip
 * registration rather than failing the render.
 */
export const GeoJsonSourceContext = createContext<GeoJsonSourceRegistry | null>(
  null
);

/**
 * Returns the enclosing map's GeoJSON source registry.
 *
 * @returns The registry, or `null` outside a mapbox-native Map.
 */
export const useGeoJsonSourceRegistry = (): GeoJsonSourceRegistry | null =>
  useContext(GeoJsonSourceContext);
