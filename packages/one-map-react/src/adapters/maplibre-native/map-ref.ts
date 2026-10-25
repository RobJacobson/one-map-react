import type {
  Camera,
  Map as MaplibreMap,
} from "@maplibre/maplibre-react-native";
import type { ComponentRef } from "react";

import type { MapRef } from "../../contracts/camera-types.js";
import {
  nativeResizeError,
  nativeStopError,
  unavailableMapMethodError,
} from "../native-map-options.js";
import {
  featuresFromWrapper,
  toQueryGeometry,
} from "../shared/feature-values.js";
import { missingCameraError } from "../shared/missing-camera.js";
import {
  boundsFromFlat,
  finiteNumber,
  lngLatFromWrapper,
  pointFromWrapper,
  rejectJumpTiming,
} from "../shared/wrapper-values.js";
import {
  mutableFlatBounds,
  toMaplibreCommand,
  toMaplibreFitBoundsOptions,
} from "./convert-camera.js";
import {
  toMaplibreFilter,
  toMaplibreRenderedQueryOptions,
  toMaplibreSourceQueryOptions,
} from "./convert-query.js";
import { createMaplibreFeatureStateMethods } from "./feature-state-methods.js";
import type { MaplibreSourceRegistry } from "./source-registry.js";

/** Common map operations and access to the selected native wrapper. */
export type NativeAdvancedMapRef = MapRef & {
  /**
   * Borrows the currently attached MapLibre Native Map wrapper.
   *
   * @returns The current wrapper handle, without waiting for map load.
   * @remarks Call again for each operation. Handles retain the wrapper's
   * lifetime and ownership; facade detachment does not invalidate them or
   * expose the separate Camera.
   * @throws Rejects when the Map is not attached.
   */
  readonly getWrapperMap: () => Promise<ComponentRef<typeof MaplibreMap>>;
};

/**
 * Builds the imperative map handle over MapLibre Native camera and map refs.
 *
 * @param cameraRef - Ref to the MapLibre Native `Camera` child.
 * @param mapRef - Ref to the MapLibre Native `Map`.
 * @param mapLoaded - Ref tracking `onDidFinishLoadingMap`, after which the
 * camera applies imperative stops.
 * @param sources - Registry of mounted GeoJSON and vector source refs.
 * @param capture - Existing map-capture operation.
 * @returns The selected native map ref.
 */
export const createMaplibreMapRef = (
  cameraRef: { readonly current: ComponentRef<typeof Camera> | null },
  mapRef: { readonly current: ComponentRef<typeof MaplibreMap> | null },
  mapLoaded: { readonly current: boolean },
  sources: MaplibreSourceRegistry,
  capture?: MapRef["capture"]
): NativeAdvancedMapRef => ({
  getWrapperMap: async () => requireMap(mapRef.current),

  queryTerrainElevation: async () => {
    throw new Error("queryTerrainElevation is unsupported on MapLibre Native.");
  },
  capture:
    capture ??
    (async () => {
      throw new Error("Capture is not enabled on this map.");
    }),
  jumpTo: async (options) => {
    rejectJumpTiming(options);
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await camera.jumpTo(toMaplibreCommand(options));
  },
  easeTo: async (options) => {
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await camera.easeTo(toMaplibreCommand(options));
  },
  flyTo: async (options) => {
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await camera.flyTo(toMaplibreCommand(options));
  },
  fitBounds: async (bounds, options) => {
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await camera.fitBounds(
      mutableFlatBounds(bounds),
      toMaplibreFitBoundsOptions(options)
    );
  },
  zoomTo: async (zoom, options) => {
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await camera.zoomTo(zoom, options ? toMaplibreCommand(options) : undefined);
  },
  stop: async () => {
    throw nativeStopError();
  },
  getCenter: async () =>
    lngLatFromWrapper(await requireMap(mapRef.current).getCenter()),
  getZoom: async () =>
    finiteNumber(
      await requireMap(mapRef.current).getZoom(),
      "Map camera value"
    ),
  getBearing: async () =>
    finiteNumber(
      await requireMap(mapRef.current).getBearing(),
      "Map camera value"
    ),
  getPitch: async () =>
    finiteNumber(
      await requireMap(mapRef.current).getPitch(),
      "Map camera value"
    ),
  getPadding: async () => {
    throw unavailableMapMethodError("getPadding", "maplibre-native");
  },
  getBounds: async () =>
    boundsFromFlat(await requireMap(mapRef.current).getBounds()),
  getMinZoom: async () => {
    throw unavailableMapMethodError("getMinZoom", "maplibre-native");
  },
  getMaxZoom: async () => {
    throw unavailableMapMethodError("getMaxZoom", "maplibre-native");
  },
  getMaxBounds: async () => {
    throw unavailableMapMethodError("getMaxBounds", "maplibre-native");
  },
  project: async (lngLat) =>
    pointFromWrapper(
      await requireMap(mapRef.current).project([lngLat[0], lngLat[1]])
    ),
  unproject: async (point) =>
    lngLatFromWrapper(
      await requireMap(mapRef.current).unproject([point[0], point[1]])
    ),
  queryRenderedFeatures: async (target, options) => {
    const map = requireMap(mapRef.current);
    const queryTarget = toQueryGeometry(target);
    const queryOptions = toMaplibreRenderedQueryOptions(options);

    const features =
      queryTarget === undefined
        ? await map.queryRenderedFeatures(
            queryOptions as { filter?: unknown } | undefined
          )
        : await map.queryRenderedFeatures(queryTarget, queryOptions);

    return featuresFromWrapper(features, "queryRenderedFeatures");
  },
  querySourceFeatures: async (sourceId, options) => {
    const entry = sources.require(sourceId);

    if (entry.kind === "geojson") {
      // Both native getData implementations query loaded source tiles, including
      // hidden features. Results may be clipped or duplicated at tile boundaries.
      const collection = await entry.ref.getData(
        toMaplibreFilter(options?.filter) as never
      );

      return featuresFromWrapper(collection, "querySourceFeatures");
    }

    return featuresFromWrapper(
      await entry.ref.querySourceFeatures(
        toMaplibreSourceQueryOptions(options)
      ),
      "querySourceFeatures"
    );
  },
  getClusterExpansionZoom: async (sourceId, clusterId) => {
    const source = sources.requireGeoJson(sourceId);
    const zoom = await source.getClusterExpansionZoom(clusterId);

    return finiteNumber(zoom, "Cluster expansion zoom");
  },
  getClusterLeaves: async (sourceId, clusterId, limit, offset) => {
    const source = sources.requireGeoJson(sourceId);

    return featuresFromWrapper(
      await source.getClusterLeaves(clusterId, limit, offset),
      "getClusterLeaves"
    );
  },
  getClusterChildren: async (sourceId, clusterId) => {
    const source = sources.requireGeoJson(sourceId);

    return featuresFromWrapper(
      await source.getClusterChildren(clusterId),
      "getClusterChildren"
    );
  },
  ...createMaplibreFeatureStateMethods(sources),
  resize: async () => {
    throw nativeResizeError();
  },
});

const requireCamera = (
  camera: ComponentRef<typeof Camera> | null,
  mapLoaded: boolean
): NonNullable<ComponentRef<typeof Camera>> => {
  if (!camera || !mapLoaded) {
    throw missingCameraError();
  }

  return camera;
};

const requireMap = (
  map: ComponentRef<typeof MaplibreMap> | null
): NonNullable<ComponentRef<typeof MaplibreMap>> => {
  if (!map) {
    throw missingCameraError();
  }

  return map;
};
