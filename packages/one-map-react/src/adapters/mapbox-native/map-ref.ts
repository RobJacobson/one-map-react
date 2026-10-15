import type { Camera, MapView } from "@rnmapbox/maps";
import type { ComponentRef } from "react";

import type { LngLat, MapRef, Point } from "../../contracts/camera-types.js";
import type { FeatureIdentifier } from "../../contracts/query-types.js";
import {
  nativeResizeError,
  nativeStopError,
  unavailableMapMethodError,
} from "../native-map-options.js";
import {
  assertFeatureIdentifier,
  assertFeatureState,
  featureStateFromWrapper,
  featuresFromWrapper,
  mutableFeatureState,
} from "../shared/feature-values.js";
import { invokeWrapper } from "../shared/invoke-wrapper.js";
import { missingCameraError } from "../shared/missing-camera.js";
import {
  normalizeElevation,
  validateTerrainCoordinate,
} from "../shared/terrain-values.js";
import {
  boundsFromRnmapboxVisible,
  lngLatFromWrapper,
  pointFromWrapper,
  rejectJumpTiming,
} from "../shared/wrapper-values.js";
import {
  toRnmapboxFitBoundsStop,
  toRnmapboxFlyToStop,
  toRnmapboxStop,
  toRnmapboxZoomStop,
} from "./convert-camera.js";
import {
  toRnmapboxClusterFeature,
  toRnmapboxFeatureArgs,
  toRnmapboxQueryRect,
  toRnmapboxRenderedQueryArgs,
  toRnmapboxSourceQueryArgs,
  toRnmapboxStateKey,
} from "./convert-query.js";
import type { GeoJsonSourceRegistry } from "./geojson-source-registry.js";

/** Selected native operations retain the wrapper signatures. */
export type NativeAdvancedMapRef = MapRef &
  Pick<ComponentRef<typeof MapView>, "setSourceVisibility">;

/**
 * Builds the imperative map handle over RNMapbox camera and map refs.
 *
 * @param cameraRef - Ref to the RNMapbox `Camera` child.
 * @param mapViewRef - Ref to the RNMapbox `MapView`.
 * @param geoJsonSources - Registry of mounted GeoJSON source refs.
 * @returns The common map ref.
 */
export const createMapboxMapRef = (
  cameraRef: { readonly current: ComponentRef<typeof Camera> | null },
  mapViewRef: { readonly current: ComponentRef<typeof MapView> | null },
  geoJsonSources: GeoJsonSourceRegistry,
  capture?: MapRef["capture"]
): NativeAdvancedMapRef => ({
  setSourceVisibility: (
    ...args: Parameters<ComponentRef<typeof MapView>["setSourceVisibility"]>
  ) => requireMap(mapViewRef.current).setSourceVisibility(...args),

  queryTerrainElevation: async (coordinate) => {
    validateTerrainCoordinate(coordinate);
    return normalizeElevation(
      await requireMap(mapViewRef.current).queryTerrainElevation([
        ...coordinate,
      ])
    );
  },
  capture:
    capture ??
    (async () => {
      throw new Error("Capture is not enabled on this map.");
    }),
  jumpTo: async (options) => {
    rejectJumpTiming(options);
    const camera = requireCamera(cameraRef.current);

    await invokeWrapper(camera.setCamera(toRnmapboxStop(options, "none")));
  },
  easeTo: async (options) => {
    const camera = requireCamera(cameraRef.current);

    await invokeWrapper(camera.setCamera(toRnmapboxStop(options, "easeTo")));
  },
  flyTo: async (options) => {
    const camera = requireCamera(cameraRef.current);

    await invokeWrapper(camera.setCamera(toRnmapboxFlyToStop(options)));
  },
  fitBounds: async (bounds, options) => {
    const camera = requireCamera(cameraRef.current);

    await invokeWrapper(
      camera.setCamera(toRnmapboxFitBoundsStop(bounds, options))
    );
  },
  zoomTo: async (zoom, options) => {
    const camera = requireCamera(cameraRef.current);

    await invokeWrapper(camera.setCamera(toRnmapboxZoomStop(zoom, options)));
  },
  stop: async () => {
    throw nativeStopError();
  },
  getCenter: async () =>
    lngLatFromWrapper(await requireMap(mapViewRef.current).getCenter()),
  getZoom: async () =>
    finiteNumber(await requireMap(mapViewRef.current).getZoom()),
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
    boundsFromRnmapboxVisible(
      await requireMap(mapViewRef.current).getVisibleBounds()
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
    pointFromWrapper(
      await requireMap(mapViewRef.current).getPointInView(mutablePair(lngLat))
    ),
  unproject: async (point) =>
    lngLatFromWrapper(
      await requireMap(mapViewRef.current).getCoordinateFromView(
        mutablePair(point)
      )
    ),
  queryRenderedFeatures: async (target, options) => {
    const map = requireMap(mapViewRef.current);
    const [filter, layers] = toRnmapboxRenderedQueryArgs(options);
    const geometry = toRnmapboxQueryRect(target);

    const collection =
      geometry.kind === "point"
        ? await map.queryRenderedFeaturesAtPoint(geometry.point, filter, layers)
        : await map.queryRenderedFeaturesInRect(geometry.rect, filter, layers);

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
  getClusterExpansionZoom: async (sourceId, clusterId) => {
    const source = geoJsonSources.require(sourceId);
    const zoom = await source.getClusterExpansionZoom(
      toRnmapboxClusterFeature(clusterId)
    );

    return clusterZoom(zoom);
  },
  getClusterLeaves: async (sourceId, clusterId, limit, offset) => {
    const source = geoJsonSources.require(sourceId);

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
    const source = geoJsonSources.require(sourceId);

    return featuresFromWrapper(
      await source.getClusterChildren(toRnmapboxClusterFeature(clusterId)),
      "getClusterChildren"
    );
  },
  setFeatureState: async (identifier, state) => {
    const target = assertFeatureIdentifier(identifier);
    const [featureId, sourceId, sourceLayerId] = toRnmapboxFeatureArgs(target);
    assertFeatureState(state);
    const mutableState = mutableFeatureState(state);

    await geoJsonSources.featureState.run(
      target,
      async () => {
        const map = requireMap(mapViewRef.current);
        await invokeWrapper(
          map.setFeatureState(featureId, mutableState, sourceId, sourceLayerId)
        );
      },
      "write"
    );
  },
  getFeatureState: async (identifier) => {
    const target = assertFeatureIdentifier(identifier);
    const [featureId, sourceId, sourceLayerId] = toRnmapboxFeatureArgs(target);

    return geoJsonSources.featureState.run(target, async () => {
      const map = requireMap(mapViewRef.current);
      return featureStateFromWrapper(
        await map.getFeatureState(featureId, sourceId, sourceLayerId)
      );
    });
  },
  removeFeatureState: async (identifier, key) => {
    const target = assertFeatureIdentifier(identifier);
    const [featureId, sourceId, sourceLayerId] = toRnmapboxFeatureArgs(target);
    const stateKey = toRnmapboxStateKey(key);

    await geoJsonSources.featureState.run(
      target,
      async () => {
        const map = requireMap(mapViewRef.current);
        await invokeWrapper(
          map.removeFeatureState(featureId, stateKey, sourceId, sourceLayerId)
        );
      },
      key === undefined ? "remove" : undefined
    );
  },
  resize: async () => {
    throw nativeResizeError();
  },
});

/**
 * Removes the whole state of a previously written target after source remount.
 * @param mapViewRef - Current native map ref.
 * @param identifier - Validated native feature-state target.
 */
export const resetMapboxFeatureState = async (
  mapViewRef: { readonly current: ComponentRef<typeof MapView> | null },
  identifier: FeatureIdentifier
): Promise<void> => {
  const map = requireMap(mapViewRef.current);
  const [featureId, sourceId, sourceLayerId] =
    toRnmapboxFeatureArgs(identifier);
  await invokeWrapper(
    map.removeFeatureState(featureId, null, sourceId, sourceLayerId)
  );
};

/**
 * Reads a cluster expansion zoom from the wrapper.
 *
 * @param value - Wrapper zoom value.
 * @returns The zoom as a finite number.
 * @throws When the wrapper returned a non-finite value.
 */
const clusterZoom = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Cluster expansion zoom must be a finite number.");
  }

  return value;
};

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

const finiteNumber = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Map zoom must be a finite number.");
  }

  return value;
};

const mutablePair = (value: LngLat | Point): number[] => [value[0], value[1]];
