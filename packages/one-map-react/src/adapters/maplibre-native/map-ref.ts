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
  assertFeatureIdentifier,
  assertFeatureState,
  featureStateFromWrapper,
  featuresFromWrapper,
  mutableFeatureState,
} from "../shared/feature-values.js";
import { invokeWrapper } from "../shared/invoke-wrapper.js";
import { missingCameraError } from "../shared/missing-camera.js";
import {
  boundsFromFlat,
  lngLatFromWrapper,
  pointFromWrapper,
  rejectJumpTiming,
} from "../shared/wrapper-values.js";
import {
  mutableFlatBounds,
  toMaplibreCommand,
  toMaplibreFitBoundsOptions,
  toMaplibreFlyToOptions,
} from "./convert-camera.js";
import {
  toMaplibreFeatureId,
  toMaplibreFilter,
  toMaplibreQueryTarget,
  toMaplibreRenderedQueryOptions,
  toMaplibreSourceQueryOptions,
  toMaplibreVectorFeature,
} from "./convert-query.js";
import type { MaplibreSourceRegistry } from "./source-registry.js";

/**
 * Builds the imperative map handle over MapLibre Native camera and map refs.
 *
 * @param cameraRef - Ref to the MapLibre Native `Camera` child.
 * @param mapRef - Ref to the MapLibre Native `Map`.
 * @param mapLoaded - Ref tracking `onDidFinishLoadingMap`, after which the
 * camera applies imperative stops.
 * @param sources - Registry of mounted GeoJSON and vector source refs.
 * @returns The common map ref.
 */
export const createMaplibreMapRef = (
  cameraRef: { readonly current: ComponentRef<typeof Camera> | null },
  mapRef: { readonly current: ComponentRef<typeof MaplibreMap> | null },
  mapLoaded: { readonly current: boolean },
  sources: MaplibreSourceRegistry,
  capture?: MapRef["capture"]
): MapRef => ({
  capture:
    capture ??
    (async () => {
      throw new Error("Capture is not enabled on this map.");
    }),
  jumpTo: async (options) => {
    rejectJumpTiming(options);
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await invokeWrapper(camera.jumpTo(toMaplibreCommand(options)));
  },
  easeTo: async (options) => {
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await invokeWrapper(camera.easeTo(toMaplibreCommand(options)));
  },
  flyTo: async (options) => {
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await invokeWrapper(camera.flyTo(toMaplibreFlyToOptions(options)));
  },
  fitBounds: async (bounds, options) => {
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await invokeWrapper(
      camera.fitBounds(
        mutableFlatBounds(bounds),
        toMaplibreFitBoundsOptions(options)
      )
    );
  },
  zoomTo: async (zoom, options) => {
    const camera = requireCamera(cameraRef.current, mapLoaded.current);

    await invokeWrapper(
      camera.zoomTo(zoom, options ? toMaplibreCommand(options) : undefined)
    );
  },
  stop: async () => {
    throw nativeStopError();
  },
  getCenter: async () =>
    lngLatFromWrapper(await requireMap(mapRef.current).getCenter()),
  getZoom: async () => finiteNumber(await requireMap(mapRef.current).getZoom()),
  getBearing: async () =>
    finiteNumber(await requireMap(mapRef.current).getBearing()),
  getPitch: async () =>
    finiteNumber(await requireMap(mapRef.current).getPitch()),
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
    const queryTarget = toMaplibreQueryTarget(target);
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

    return clusterZoom(zoom);
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
  setFeatureState: async (identifier, state) => {
    const target = { ...assertFeatureIdentifier(identifier) };
    assertFeatureState(state);
    const mutableState = mutableFeatureState(state);
    if (sources.require(target.source).kind === "vector")
      toMaplibreVectorFeature(target);

    await sources.featureState.run(
      target,
      async () => {
        const source = sources.require(target.source);

        await invokeWrapper(
          source.kind === "geojson"
            ? source.ref.setFeatureState(
                toMaplibreFeatureId(target),
                mutableState
              )
            : source.ref.setFeatureState(
                toMaplibreVectorFeature(target),
                mutableState
              )
        );
      },
      "write"
    );
  },
  getFeatureState: async (identifier) => {
    const target = { ...assertFeatureIdentifier(identifier) };
    if (sources.require(target.source).kind === "vector")
      toMaplibreVectorFeature(target);

    return sources.featureState.run(target, async () => {
      const source = sources.require(target.source);

      return featureStateFromWrapper(
        await (source.kind === "geojson"
          ? source.ref.getFeatureState(toMaplibreFeatureId(target))
          : source.ref.getFeatureState(toMaplibreVectorFeature(target)))
      );
    });
  },
  removeFeatureState: async (identifier, key) => {
    const target = { ...assertFeatureIdentifier(identifier) };
    if (sources.require(target.source).kind === "vector")
      toMaplibreVectorFeature(target);

    await sources.featureState.run(
      target,
      async () => {
        const source = sources.require(target.source);

        await invokeWrapper(
          source.kind === "geojson"
            ? source.ref.removeFeatureState(
                toMaplibreFeatureId(target),
                ...(key === undefined ? [] : [key])
              )
            : source.ref.removeFeatureState(
                toMaplibreVectorFeature(target),
                ...(key === undefined ? [] : [key])
              )
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

const finiteNumber = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Map camera value must be a finite number.");
  }

  return value;
};
