import type {
  GeoJSONSource,
  VectorSource,
} from "@maplibre/maplibre-react-native";
import type { ComponentRef } from "react";
import { createContext, useContext } from "react";

/**
 * A registered MapLibre React Native source ref.
 *
 * GeoJSON refs carry cluster and feature-state methods plus `getData`;
 * vector refs carry `querySourceFeatures` and feature-state methods that
 * require a `sourceLayer`.
 */
export type MaplibreNativeSourceRef =
  | {
      readonly kind: "geojson";
      readonly ref: ComponentRef<typeof GeoJSONSource>;
    }
  | {
      readonly kind: "vector";
      readonly ref: ComponentRef<typeof VectorSource>;
    };

/**
 * Registry of mounted MapLibre React Native source refs, keyed by facade id.
 *
 * The map component owns this registry; each mounted GeoJSON or vector
 * source registers its ref so source-scoped map methods can dispatch
 * through it. A ref registered under an id that a newer source already
 * claimed does not unregister the newer entry. This only protects cleanup;
 * renderer support for duplicate source ids is not promised.
 */
export class MaplibreSourceRegistry {
  private readonly refs = new Map<
    string,
    { readonly read: () => MaplibreNativeSourceRef | undefined }
  >();

  /**
   * Records the source ref mounted under an id.
   *
   * @param id - Facade source id.
   * @param read - Getter for the current wrapper ref.
   * @returns Cleanup bound to this registration.
   */
  register(
    id: string,
    read: () => MaplibreNativeSourceRef | undefined
  ): () => void {
    const owner = { read };
    this.refs.set(id, owner);

    return () => {
      if (this.refs.get(id) === owner) {
        this.refs.delete(id);
      }
    };
  }

  /**
   * Reads the registered source entry for an id.
   *
   * @param id - Facade source id.
   * @returns The kind and wrapper ref of the mounted source.
   * @throws When no facade GeoJSON or vector source is mounted under the id.
   */
  require(id: string): MaplibreNativeSourceRef {
    const entry = this.refs.get(id)?.read();

    if (!entry) {
      throw new Error(
        `Source "${id}" is not a mounted GeoJSON or vector Source. Mount it through a Source to use source-scoped methods.`
      );
    }

    return entry;
  }

  /**
   * Reads the GeoJSON source ref for an id.
   *
   * @param id - Facade source id.
   * @returns The `GeoJSONSource` ref.
   * @throws When the id names no mounted GeoJSON source.
   */
  requireGeoJson(id: string): ComponentRef<typeof GeoJSONSource> {
    const entry = this.require(id);

    if (entry.kind !== "geojson") {
      throw new Error(
        `Source "${id}" is not a GeoJSON Source. Cluster methods need a mounted clustered GeoJSON source.`
      );
    }

    return entry.ref;
  }
}

/**
 * Context carrying the enclosing map's source registry.
 *
 * `null` means no map provides the registry; sources then skip
 * registration rather than failing the render.
 */
export const MaplibreSourceContext =
  createContext<MaplibreSourceRegistry | null>(null);

/**
 * Returns the enclosing map's source registry.
 *
 * @returns The registry, or `null` outside a maplibre-native Map.
 */
export const useMaplibreSourceRegistry = (): MaplibreSourceRegistry | null =>
  useContext(MaplibreSourceContext);
