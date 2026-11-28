import type {
  Camera,
  Map as MaplibreMap,
} from "@maplibre/maplibre-react-native";
import type { ComponentRef } from "react";

import type { NativeMapRefWithWrapper } from "../../contracts/native-types.js";
import { missingCameraError, requireAttachedMap } from "../index.js";
import {
  rejectNativeResize,
  rejectNativeStop,
  unavailableMapMethod,
} from "../native-map-options.js";
import { featuresFromWrapper } from "../shared/feature-values.js";
import {
  createNativeRenderedQuery,
  isScreenBounds,
  nativeBounds,
  nativeBoundsInput,
  nativeLngLat,
  nativePoint,
} from "../shared/index.js";
import { createNativeClusterLookup } from "../shared/native-clusters.js";
import {
  boundsFromFlat,
  finiteNumber,
  lngLatFromWrapper,
  pointFromWrapper,
  rejectJumpTiming,
  rejectNativeEasing,
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
 * @param isMapLoaded - Whether the attached map has finished loading and the
 * camera can apply imperative stops.
 * @param sources - Registry of mounted GeoJSON and vector source refs.
 * @returns The selected native map ref.
 */
export const createMaplibreMapRef = (
  cameraRef: { readonly current: ComponentRef<typeof Camera> | null },
  mapRef: { readonly current: ComponentRef<typeof MaplibreMap> | null },
  isMapLoaded: (map: NativeAdvancedMapRef) => boolean,
  sources: MaplibreSourceRegistry
): NativeAdvancedMapRef => {
  const getSource = createNativeClusterLookup(
    (id) => sources.getGeoJsonOwner(id),
    (clusterId) => clusterId
  );
  const getMap = () => requireAttachedMap(mapRef.current);
  const getCamera = () => requireCamera(cameraRef.current, isMapLoaded(handle));
  const handle: NativeAdvancedMapRef = {
    getSource: (id) => (mapRef.current ? getSource(id) : undefined),
    getWrapperMap: async () => getMap(),

    queryTerrainElevation: async () => {
      throw new Error(
        "queryTerrainElevation is unsupported on MapLibre Native."
      );
    },
    jumpTo: async (options) => {
      rejectJumpTiming(options);
      const camera = getCamera();

      await camera.jumpTo(toMaplibreCommand(options));
    },
    easeTo: async (options) => {
      const camera = getCamera();

      await camera.easeTo(toMaplibreCommand(options));
    },
    flyTo: async (options) => {
      const camera = getCamera();

      await camera.flyTo(toMaplibreCommand(options));
    },
    fitBounds: async (bounds, options) => {
      const camera = getCamera();

      await camera.fitBounds(
        toFlatBounds(nativeBoundsInput(bounds)),
        toMaplibreFitBoundsOptions(options)
      );
    },
    zoomTo: async (zoom, options) => {
      const camera = getCamera();
      rejectNativeEasing(options?.easing);

      const duration = options?.duration;
      const animationOptions = duration === undefined ? {} : { duration };
      await camera.zoomTo(zoom, options ? animationOptions : undefined);
    },
    stop: rejectNativeStop,
    getCenter: async () =>
      nativeLngLat(lngLatFromWrapper(await getMap().getCenter())),
    getZoom: async () =>
      finiteNumber(await getMap().getZoom(), "Map camera value"),
    getBearing: async () =>
      finiteNumber(await getMap().getBearing(), "Map camera value"),
    getPitch: async () =>
      finiteNumber(await getMap().getPitch(), "Map camera value"),
    getPadding: unavailableMapMethod("getPadding", "maplibre-native"),
    getBounds: async () =>
      nativeBounds(boundsFromFlat(await getMap().getBounds())),
    getMinZoom: unavailableMapMethod("getMinZoom", "maplibre-native"),
    getMaxZoom: unavailableMapMethod("getMaxZoom", "maplibre-native"),
    getMaxBounds: unavailableMapMethod("getMaxBounds", "maplibre-native"),
    project: async (lngLat) =>
      nativePoint(
        pointFromWrapper(await getMap().project(lngLatFromWrapper(lngLat)))
      ),
    unproject: async (point) =>
      nativeLngLat(
        lngLatFromWrapper(await getMap().unproject(pointFromWrapper(point)))
      ),
    queryRenderedFeatures: createNativeRenderedQuery(
      getMap,
      (map, { target, options, layers }) => {
        const queryOptions = toMaplibreRenderedQueryOptions(options, layers);
        if (target === undefined) {
          return map.queryRenderedFeatures(queryOptions);
        }

        // Narrow each target separately for the wrapper's overloads.
        return isScreenBounds(target)
          ? map.queryRenderedFeatures(target, queryOptions)
          : map.queryRenderedFeatures(target, queryOptions);
      }
    ),
    querySourceFeatures: async (sourceId, options) => {
      getMap();
      const entry = requireMaplibreSource(sources, sourceId);

      // Both native getData implementations query loaded source tiles, including
      // hidden features. Results may be clipped or duplicated at tile boundaries.
      const result =
        entry.kind === "geojson"
          ? await entry.ref.getData(toMaplibreFilter(options?.filter))
          : await entry.ref.querySourceFeatures(
              toMaplibreSourceQueryOptions(options)
            );
      return featuresFromWrapper(result, "querySourceFeatures");
    },
    ...createMaplibreFeatureStateMethods(sources, getMap),
    resize: rejectNativeResize,
  };
  return handle;
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
