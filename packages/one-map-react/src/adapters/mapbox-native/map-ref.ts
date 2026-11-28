import type { Camera, CameraStop, MapView } from "@rnmapbox/maps";
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
  toRnmapboxRect,
  toRnmapboxRenderedQueryArgs,
  toRnmapboxSourceQueryArgs,
} from "./convert-query.js";
import { createMapboxFeatureStateMethods } from "./feature-state-methods.js";
import type { GeoJsonSourceRegistry } from "./geojson-source-registry.js";
import {
  boundsFromRnmapboxVisible,
  normalizeElevation,
} from "./map-results.js";

/** Common map operations and access to the RNMapbox `MapView` wrapper. */
export type NativeAdvancedMapRef = NativeMapRefWithWrapper<
  ComponentRef<typeof MapView>
>;

/** The mounted RNMapbox camera and the follow setting it committed with. */
export interface RnmapboxCameraAttachment {
  /** Imperative wrapper camera handle. */
  readonly camera: ComponentRef<typeof Camera>;
  /** Whether the wrapper suppresses commands in favor of location follow. */
  readonly isFollowing: boolean;
}

/**
 * Builds the imperative map handle over RNMapbox camera and map refs.
 *
 * @param cameraRef - Committed RNMapbox camera attachment.
 * @param mapViewRef - Ref to the RNMapbox `MapView`.
 * @param geoJsonSources - Registry of mounted GeoJSON source refs.
 * @returns The selected native map ref.
 */
export const createMapboxMapRef = (
  cameraRef: { readonly current: RnmapboxCameraAttachment | null },
  mapViewRef: { readonly current: ComponentRef<typeof MapView> | null },
  geoJsonSources: GeoJsonSourceRegistry
): NativeAdvancedMapRef => {
  const getSource = createNativeClusterLookup(
    (id) => geoJsonSources.getGeoJsonOwner(id),
    toRnmapboxClusterFeature
  );
  const getMap = () => requireAttachedMap(mapViewRef.current);
  return {
    getSource: (id) => (mapViewRef.current ? getSource(id) : undefined),
    getWrapperMap: async () => getMap(),

    queryTerrainElevation: async (input, options) => {
      const coordinate = lngLatFromWrapper(input, RangeError);
      if (Math.abs(coordinate[1]) > 90) {
        throw new RangeError(
          "Terrain coordinates require finite longitude and latitude within -90 to 90 degrees."
        );
      }
      if (options?.exaggerated === false) {
        throw new Error(
          "queryTerrainElevation.exaggerated=false is unavailable on mapbox-native."
        );
      }
      return normalizeElevation(
        await getMap().queryTerrainElevation([...coordinate])
      );
    },
    jumpTo: async (options) => {
      rejectJumpTiming(options);
      const camera = requireCamera(cameraRef.current);

      await dispatchCameraStop(camera, toRnmapboxStop(options, "none"));
    },
    easeTo: async (options) => {
      const camera = requireCamera(cameraRef.current);

      await dispatchCameraStop(camera, toRnmapboxStop(options, "easeTo"));
    },
    flyTo: async (options) => {
      const camera = requireCamera(cameraRef.current);

      await dispatchCameraStop(camera, toRnmapboxStop(options, "flyTo"));
    },
    fitBounds: async (bounds, options) => {
      const camera = requireCamera(cameraRef.current);

      await dispatchCameraStop(
        camera,
        toRnmapboxFitBoundsStop(nativeBoundsInput(bounds), options)
      );
    },
    zoomTo: async (zoom, options) => {
      const camera = requireCamera(cameraRef.current);

      await dispatchCameraStop(camera, toRnmapboxZoomStop(zoom, options));
    },
    stop: rejectNativeStop,
    getCenter: async () =>
      nativeLngLat(lngLatFromWrapper(await getMap().getCenter())),
    getZoom: async () => finiteNumber(await getMap().getZoom(), "Map zoom"),
    getBearing: unavailableMapMethod("getBearing", "mapbox-native"),
    getPitch: unavailableMapMethod("getPitch", "mapbox-native"),
    getPadding: unavailableMapMethod("getPadding", "mapbox-native"),
    getBounds: async () =>
      nativeBounds(
        boundsFromRnmapboxVisible(await getMap().getVisibleBounds())
      ),
    getMinZoom: unavailableMapMethod("getMinZoom", "mapbox-native"),
    getMaxZoom: unavailableMapMethod("getMaxZoom", "mapbox-native"),
    getMaxBounds: unavailableMapMethod("getMaxBounds", "mapbox-native"),
    project: async (lngLat) =>
      nativePoint(
        pointFromWrapper(
          await getMap().getPointInView([...lngLatFromWrapper(lngLat)])
        )
      ),
    unproject: async (point) =>
      nativeLngLat(
        lngLatFromWrapper(
          await getMap().getCoordinateFromView(pointFromWrapper(point))
        )
      ),
    queryRenderedFeatures: createNativeRenderedQuery(
      getMap,
      (map, { target, options, layers }) => {
        const args = toRnmapboxRenderedQueryArgs(options, layers);
        if (target !== undefined && !isScreenBounds(target)) {
          return map.queryRenderedFeaturesAtPoint(target, ...args);
        }

        // RNMapbox uses an empty rectangle for the whole viewport.
        const rect = target === undefined ? [] : toRnmapboxRect(target);
        return map.queryRenderedFeaturesInRect(rect, ...args);
      }
    ),
    querySourceFeatures: async (sourceId, options) => {
      const map = getMap();
      const [filter, sourceLayerIds] = toRnmapboxSourceQueryArgs(options);

      return featuresFromWrapper(
        await map.querySourceFeatures(sourceId, filter, sourceLayerIds),
        "querySourceFeatures"
      );
    },
    ...createMapboxFeatureStateMethods(getMap),
    resize: rejectNativeResize,
  };
};

const requireCamera = (
  camera: RnmapboxCameraAttachment | null
): RnmapboxCameraAttachment => {
  if (!camera) {
    throw missingCameraError();
  }

  return camera;
};

const dispatchCameraStop = (
  { camera, isFollowing }: RnmapboxCameraAttachment,
  stop: CameraStop
) => {
  if (isFollowing) {
    throw new Error(
      "Camera commands are unavailable while followUserLocation is enabled."
    );
  }

  return camera.setCamera(stop);
};
