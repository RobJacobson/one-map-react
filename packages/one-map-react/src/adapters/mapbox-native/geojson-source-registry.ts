import type { ShapeSource } from "@rnmapbox/maps";
import type { ComponentRef } from "react";
import { createContext, useContext } from "react";

import type { FeatureIdentifier } from "../../contracts/query-types.js";
import { NativeFeatureState } from "../shared/native-feature-state.js";

/**
 * Registry of mounted RNMapbox GeoJSON source refs, keyed by facade id.
 *
 * @remarks
 * Cluster methods dispatch through the `ShapeSource` ref, so the map
 * component owns this registry and each mounted GeoJSON source registers
 * its ref. A ref registered under an id that a newer source already
 * claimed does not unregister the newer entry. This only protects cleanup;
 * renderer support for duplicate source ids is not promised.
 */
export class GeoJsonSourceRegistry {
  readonly featureState: NativeFeatureState;

  /**
   * Creates the map-owned source registry and its feature-state reset owner.
   *
   * @param reset - Whole-state removal through the current map wrapper.
   */
  constructor(reset: (identifier: FeatureIdentifier) => Promise<void>) {
    this.featureState = new NativeFeatureState(reset);
  }

  private readonly refs = new Map<
    string,
    { readonly ref: ComponentRef<typeof ShapeSource> | null }
  >();

  /**
   * Records the source ref mounted under an id.
   *
   * @param id - Facade source id.
   * @param ref - RNMapbox `ShapeSource` ref, or `null` while attaching.
   * @returns Cleanup bound to this registration.
   */
  register(
    id: string,
    ref: ComponentRef<typeof ShapeSource> | null
  ): () => void {
    const owner = { ref };
    const releaseState = this.featureState.register(id, "geojson");
    this.refs.set(id, owner);
    return () => {
      releaseState();
      if (this.refs.get(id) === owner) {
        this.refs.delete(id);
      }
    };
  }

  /**
   * Reads the source ref for an id.
   *
   * @param id - Facade source id.
   * @returns The registered `ShapeSource` ref.
   * @throws When no facade GeoJSON source is mounted under the id.
   */
  require(id: string): ComponentRef<typeof ShapeSource> {
    const ref = this.refs.get(id)?.ref;

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
 * @remarks
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
