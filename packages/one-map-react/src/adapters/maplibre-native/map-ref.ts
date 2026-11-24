import type {
  Camera,
  Map as MaplibreMap,
} from "@maplibre/maplibre-react-native";
import type { ComponentRef } from "react";

import type { NativeMapRefWithWrapper } from "../../contracts/native-types.js";
import {
  rejectNativeResize,
  rejectNativeStop,
  unavailableMapMethodError,
} from "../native-map-options.js";
import { featuresFromWrapper } from "../shared/feature-values.js";
import { missingCameraError } from "../shared/missing-camera.js";
import { createNativeClusterLookup } from "../shared/native-clusters.js";
import {
  isScreenBounds,
  nativeBounds,
  nativeBoundsInput,
  nativeLngLat,
  nativePoint,
  nativeRenderedQuery,
} from "../shared/native-values.js";
import {
  boundsFromFlat,
  finiteNumber,
  lngLatFromWrapper,
  pointFromWrapper,
  rejectJumpTiming,
  toFlatBounds,
} from "../shared/wrapper-values.js";
import {
  toMaplibreCommand,
  toMaplibreFitBoundsOptions,
} from "./convert-camera.js";
import {
  toMaplibreFilter,
  toMaplibreRenderedQueryOptions,
  toMaplibreSourceQueryOptions,
} from "./convert-query.js";
import { createMaplibreFeatureStateMethods } from "./feature-state-methods.js";
import {
  type MaplibreSourceRegistry,
  requireMaplibreSource,
} from "./source-registry.js";

/** Common map operations and access to the MapLibre React Native `Map` wrapper. */
export type NativeAdvancedMapRef = NativeMapRefWithWrapper<
  ComponentRef<typeof MaplibreMap>
>;

/**
 * Builds the imperative map handle over MapLibre Native camera and map refs.
 *
 * @param cameraRef - Ref to the MapLibre Native `Camera` child.
 * @param mapRef - Ref to the MapLibre Native `Map`.
 * @param mapLoaded - Ref tracking `onDidFinishLoadingMap`, after which the
 * camera applies imperative stops.
 * @param sources - Registry of mounted GeoJSON and vector source refs.
 * @returns The selected native map ref.
 */
export const createMaplibreMapRef = (
  cameraRef: { readonly current: ComponentRef<typeof Camera> | null },
  mapRef: { readonly current: ComponentRef<typeof MaplibreMap> | null },
  mapLoaded: { readonly current: boolean },
  sources: MaplibreSourceRegistry
): NativeAdvancedMapRef => {
  const getSource = createNativeClusterLookup(
    (id) => sources.getGeoJsonOwner(id),
    (clusterId) => clusterId
  );
  return {
    getSource: (id) => (mapRef.current ? getSource(id) : undefined),
    getWrapperMap: async () => requireMap(mapRef.current),

    queryTerrainElevation: async () => {
      throw new Error(
        "queryTerrainElevation is unsupported on MapLibre Native."
      );
    },
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
        toFlatBounds(nativeBoundsInput(bounds)),
        toMaplibreFitBoundsOptions(options)
      );
    },
    zoomTo: async (zoom, options) => {
      const camera = requireCamera(cameraRef.current, mapLoaded.current);

      await camera.zoomTo(
        zoom,
        options ? toMaplibreCommand(options) : undefined
      );
    },
    stop: rejectNativeStop,
    getCenter: async () =>
      nativeLngLat(
        lngLatFromWrapper(await requireMap(mapRef.current).getCenter())
      ),
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
      nativeBounds(
        boundsFromFlat(await requireMap(mapRef.current).getBounds())
      ),
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
      nativePoint(
        pointFromWrapper(
          await requireMap(mapRef.current).project(lngLatFromWrapper(lngLat))
        )
      ),
    unproject: async (point) =>
      nativeLngLat(
        lngLatFromWrapper(
          await requireMap(mapRef.current).unproject(pointFromWrapper(point))
        )
      ),
    queryRenderedFeatures: async (input, queryOptionsInput) => {
      const [target, options] = nativeRenderedQuery(input, queryOptionsInput);
      const map = requireMap(mapRef.current);
      // Preserve an explicit empty layer selection before the SDK defaults to all layers.
      if (options?.layers?.length === 0) return [];

      const queryOptions = toMaplibreRenderedQueryOptions(options);
      // Narrow each target separately for the wrapper's overloads.
      let features;
      if (target === undefined) {
        features = await map.queryRenderedFeatures(queryOptions);
      } else if (isScreenBounds(target)) {
        features = await map.queryRenderedFeatures(target, queryOptions);
      } else {
        features = await map.queryRenderedFeatures(target, queryOptions);
      }

      return featuresFromWrapper(features, "queryRenderedFeatures");
    },
    querySourceFeatures: async (sourceId, options) => {
      requireMap(mapRef.current);
      const entry = requireMaplibreSource(sources, sourceId);

      if (entry.kind === "geojson") {
        // Both native getData implementations query loaded source tiles, including
        // hidden features. Results may be clipped or duplicated at tile boundaries.
        const collection = await entry.ref.getData(
          toMaplibreFilter(options?.filter)
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
    ...createMaplibreFeatureStateMethods(sources, () =>
      requireMap(mapRef.current)
    ),
    resize: rejectNativeResize,
  };
};

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
