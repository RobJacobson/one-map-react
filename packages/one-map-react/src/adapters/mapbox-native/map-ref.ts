import type { Camera, MapView, ShapeSource } from "@rnmapbox/maps";
import type { ComponentRef } from "react";

import type { NativeMapRef } from "../../contracts/native-types.js";
import type { ClusterQueryMethods } from "../../contracts/query-types.js";
import {
  nativeResizeError,
  nativeStopError,
  unavailableMapMethodError,
} from "../native-map-options.js";
import { featuresFromWrapper } from "../shared/feature-values.js";
import { missingCameraError } from "../shared/missing-camera.js";
import { createNativeClusterLookup } from "../shared/native-clusters.js";
import {
  nativeBounds,
  nativeBoundsInput,
  nativeLngLat,
  nativePoint,
  nativeRenderedQuery,
} from "../shared/native-values.js";
import {
  normalizeElevation,
  validateTerrainCoordinate,
} from "../shared/terrain-values.js";
import {
  boundsFromRnmapboxVisible,
  finiteNumber,
  lngLatFromWrapper,
  pointFromWrapper,
  rejectJumpTiming,
} from "../shared/wrapper-values.js";
import {
  toRnmapboxFitBoundsStop,
  toRnmapboxStop,
  toRnmapboxZoomStop,
} from "./convert-camera.js";
import {
  toRnmapboxClusterFeature,
  toRnmapboxQueryRect,
  toRnmapboxRenderedQueryArgs,
  toRnmapboxSourceQueryArgs,
} from "./convert-query.js";
import { createMapboxFeatureStateMethods } from "./feature-state-methods.js";
import type { GeoJsonSourceRegistry } from "./geojson-source-registry.js";

/** Common map operations and access to the selected native wrapper. */
export type NativeAdvancedMapRef = NativeMapRef & {
  /**
   * Borrows the currently attached RNMapbox MapView wrapper.
   *
   * @returns The current wrapper handle, without waiting for map load.
   * @remarks Call again for each operation. Handles retain the wrapper's
   * lifetime and ownership; facade detachment does not invalidate them or
   * expose the separate Camera.
   * @throws Rejects when the MapView is not attached.
   */
  readonly getWrapperMap: () => Promise<ComponentRef<typeof MapView>>;
};

/**
 * Builds the imperative map handle over RNMapbox camera and map refs.
 *
 * @param cameraRef - Ref to the RNMapbox `Camera` child.
 * @param mapViewRef - Ref to the RNMapbox `MapView`.
 * @param geoJsonSources - Registry of mounted GeoJSON source refs.
 * @returns The selected native map ref.
 */
export const createMapboxMapRef = (
  cameraRef: { readonly current: ComponentRef<typeof Camera> | null },
  mapViewRef: { readonly current: ComponentRef<typeof MapView> | null },
  geoJsonSources: GeoJsonSourceRegistry
): NativeAdvancedMapRef => {
  const getSource = createNativeClusterLookup(
    (id) => geoJsonSources.getGeoJsonOwner(id),
    createClusterMethods
  );
  return {
    getSource: (id) => (mapViewRef.current ? getSource(id) : undefined),
    getWrapperMap: async () => requireMap(mapViewRef.current),

    queryTerrainElevation: async (input, options) => {
      const coordinate = lngLatFromWrapper(input);
      validateTerrainCoordinate(coordinate);
      if (options?.exaggerated === false) {
        throw new Error(
          "queryTerrainElevation.exaggerated=false is unavailable on mapbox-native."
        );
      }
      return normalizeElevation(
        await requireMap(mapViewRef.current).queryTerrainElevation([
          ...coordinate,
        ])
      );
    },
    jumpTo: async (options) => {
      rejectJumpTiming(options);
      const camera = requireCamera(cameraRef.current);

      await camera.setCamera(toRnmapboxStop(options, "none"));
    },
    easeTo: async (options) => {
      const camera = requireCamera(cameraRef.current);

      await camera.setCamera(toRnmapboxStop(options, "easeTo"));
    },
    flyTo: async (options) => {
      const camera = requireCamera(cameraRef.current);

      await camera.setCamera(toRnmapboxStop(options, "flyTo"));
    },
    fitBounds: async (bounds, options) => {
      const camera = requireCamera(cameraRef.current);

      await camera.setCamera(
        toRnmapboxFitBoundsStop(nativeBoundsInput(bounds), options)
      );
    },
    zoomTo: async (zoom, options) => {
      const camera = requireCamera(cameraRef.current);

      await camera.setCamera(toRnmapboxZoomStop(zoom, options));
    },
    stop: async () => {
      throw nativeStopError();
    },
    getCenter: async () =>
      nativeLngLat(
        lngLatFromWrapper(await requireMap(mapViewRef.current).getCenter())
      ),
    getZoom: async () =>
      finiteNumber(await requireMap(mapViewRef.current).getZoom(), "Map zoom"),
    getBearing: async () => {
      throw unavailableMapMethodError("getBearing", "mapbox-native");
    },
    getPitch: async () => {
      throw unavailableMapMethodError("getPitch", "mapbox-native");
    },
    getPadding: async () => {
      throw unavailableMapMethodError("getPadding", "mapbox-native");
    },
    getBounds: async () =>
      nativeBounds(
        boundsFromRnmapboxVisible(
          await requireMap(mapViewRef.current).getVisibleBounds()
        )
      ),
    getMinZoom: async () => {
      throw unavailableMapMethodError("getMinZoom", "mapbox-native");
    },
    getMaxZoom: async () => {
      throw unavailableMapMethodError("getMaxZoom", "mapbox-native");
    },
    getMaxBounds: async () => {
      throw unavailableMapMethodError("getMaxBounds", "mapbox-native");
    },
    project: async (lngLat) =>
      nativePoint(
        pointFromWrapper(
          await requireMap(mapViewRef.current).getPointInView([
            ...lngLatFromWrapper(lngLat),
          ])
        )
      ),
    unproject: async (point) =>
      nativeLngLat(
        lngLatFromWrapper(
          await requireMap(mapViewRef.current).getCoordinateFromView([
            ...pointFromWrapper(point),
          ])
        )
      ),
    queryRenderedFeatures: async (input, queryOptionsInput) => {
      const [target, options] = nativeRenderedQuery(input, queryOptionsInput);
      const map = requireMap(mapViewRef.current);
      // Preserve an explicit empty layer selection before the SDK defaults to all layers.
      if (options?.layers?.length === 0) return [];
      const [filter, layers] = toRnmapboxRenderedQueryArgs(options);
      const geometry = toRnmapboxQueryRect(target);

      const collection =
        geometry.kind === "point"
          ? await map.queryRenderedFeaturesAtPoint(
              geometry.point,
              filter,
              layers
            )
          : await map.queryRenderedFeaturesInRect(
              geometry.rect,
              filter,
              layers
            );

      return featuresFromWrapper(collection, "queryRenderedFeatures");
    },
    querySourceFeatures: async (sourceId, options) => {
      const map = requireMap(mapViewRef.current);
      const [filter, sourceLayerIds] = toRnmapboxSourceQueryArgs(options);

      return featuresFromWrapper(
        await map.querySourceFeatures(sourceId, filter, sourceLayerIds),
        "querySourceFeatures"
      );
    },
    ...createClusterMethods((id) => geoJsonSources.require(id)),
    ...createMapboxFeatureStateMethods(() => requireMap(mapViewRef.current)),
    resize: async () => {
      throw nativeResizeError();
    },
  };
};

const createClusterMethods = (
  read: (id: string) => ComponentRef<typeof ShapeSource>
): ClusterQueryMethods => ({
  getClusterExpansionZoom: async (sourceId, clusterId) => {
    const source = read(sourceId);
    const zoom = await source.getClusterExpansionZoom(
      toRnmapboxClusterFeature(clusterId)
    );

    return finiteNumber(zoom, "Cluster expansion zoom");
  },
  getClusterLeaves: async (sourceId, clusterId, limit, offset) => {
    const source = read(sourceId);

    return featuresFromWrapper(
      await source.getClusterLeaves(
        toRnmapboxClusterFeature(clusterId),
        limit,
        offset
      ),
      "getClusterLeaves"
    );
  },
  getClusterChildren: async (sourceId, clusterId) => {
    const source = read(sourceId);

    return featuresFromWrapper(
      await source.getClusterChildren(toRnmapboxClusterFeature(clusterId)),
      "getClusterChildren"
    );
  },
});

const requireCamera = (
  camera: ComponentRef<typeof Camera> | null
): NonNullable<ComponentRef<typeof Camera>> => {
  if (!camera) {
    throw missingCameraError();
  }

  return camera;
};

const requireMap = (
  map: ComponentRef<typeof MapView> | null
): NonNullable<ComponentRef<typeof MapView>> => {
  if (!map) {
    throw missingCameraError();
  }

  return map;
};
