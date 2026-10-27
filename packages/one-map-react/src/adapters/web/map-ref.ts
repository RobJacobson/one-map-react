import type { Backend } from "../../contracts/adapter.js";
import type { MapRef } from "../../contracts/camera-types.js";
import type { FeatureIdentifier } from "../../contracts/query-types.js";
import {
  assertFeatureIdentifier,
  assertFeatureState,
  featureStateFromWrapper,
  featuresFromWrapper,
  mutableFeatureState,
  toQueryGeometry,
} from "../shared/feature-values.js";
import { missingCameraError } from "../shared/missing-camera.js";
import {
  normalizeElevation,
  validateTerrainCoordinate,
} from "../shared/terrain-values.js";
import {
  assertBounds,
  boundsFromGeographic,
  finiteNumber,
  lngLatFromWrapper,
  paddingFromWrapper,
  pointFromWrapper,
  rejectJumpTiming,
} from "../shared/wrapper-values.js";
import type {
  WebClusterSource,
  WebErrorNotice,
  WebMapHandle,
  WebWrapper,
} from "./contracts.js";
import {
  toWebCommandOptions,
  toWebFitBoundsOptions,
  toWebZoomToOptions,
} from "./convert-camera.js";
import {
  toWebFeatureTarget,
  toWebRenderedQueryOptions,
  toWebSourceQueryOptions,
} from "./convert-query.js";

export const createWebMapRef = (
  mapRef: {
    readonly current: WebMapHandle | null;
  },
  wrapper: WebWrapper<Extract<Backend, "mapbox-web" | "maplibre-web">>
): MapRef & { readonly getWrapperMap: () => Promise<WebMapHandle> } => ({
  getWrapperMap: async () => requireWebMap(mapRef.current),
  queryTerrainElevation: async (coordinate) => {
    validateTerrainCoordinate(coordinate);
    const map = requireWebMap(mapRef.current);
    if (!map.queryTerrainElevation)
      throw new Error("queryTerrainElevation is unsupported by this renderer.");
    return normalizeElevation(
      runWebOperation(map, () =>
        map.queryTerrainElevation?.(coordinate, { exaggerated: true })
      )
    );
  },
  jumpTo: async (options) => {
    rejectJumpTiming(options);
    const map = requireWebMap(mapRef.current);

    await map.jumpTo(toWebCommandOptions(options));
  },
  easeTo: async (options) => {
    const map = requireWebMap(mapRef.current);

    await map.easeTo(toWebCommandOptions(options));
  },
  flyTo: async (options) => {
    const map = requireWebMap(mapRef.current);

    await map.flyTo(toWebCommandOptions(options));
  },
  fitBounds: async (bounds, options) => {
    const map = requireWebMap(mapRef.current);

    await map.fitBounds(assertBounds(bounds), toWebFitBoundsOptions(options));
  },
  zoomTo: async (zoom, options) => {
    const map = requireWebMap(mapRef.current);

    await map.zoomTo(zoom, toWebZoomToOptions(options));
  },
  stop: async () => {
    const map = requireWebMap(mapRef.current);

    await map.stop();
  },
  getCenter: async () => {
    const map = requireWebMap(mapRef.current);

    return lngLatFromWrapper(await map.getCenter());
  },
  getZoom: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getZoom(), "Map zoom");
  },
  getBearing: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getBearing(), "Map bearing");
  },
  getPitch: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getPitch(), "Map pitch");
  },
  getPadding: async () => {
    const map = requireWebMap(mapRef.current);

    return paddingFromWrapper(await map.getPadding());
  },
  getBounds: async () => {
    const map = requireWebMap(mapRef.current);

    return boundsFromGeographic(await map.getBounds());
  },
  getMinZoom: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getMinZoom(), "Map min zoom");
  },
  getMaxZoom: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getMaxZoom(), "Map max zoom");
  },
  getMaxBounds: async () => {
    const map = requireWebMap(mapRef.current);
    const value = await map.getMaxBounds();

    if (value == null) {
      return null;
    }

    return boundsFromGeographic(value);
  },
  project: async (lngLat) => {
    const map = requireWebMap(mapRef.current);

    return pointFromWrapper(await map.project(lngLat));
  },
  unproject: async (point) => {
    const map = requireWebMap(mapRef.current);

    return lngLatFromWrapper(await map.unproject(point));
  },
  resize: async () => {
    const map = mapRef.current;

    if (!map) {
      throw missingMapError();
    }

    await map.resize();
  },
  queryRenderedFeatures: async (target, options) => {
    const map = requireWebMap(mapRef.current);

    return featuresFromWrapper(
      runWebOperation(map, () => {
        for (const id of options?.layers ?? []) {
          if (map.getLayer(id) == null) {
            throw new Error(
              `Layer "${id}" is not present in the loaded style.`
            );
          }
        }

        return map.queryRenderedFeatures(
          toQueryGeometry(target),
          toWebRenderedQueryOptions(options)
        );
      }),
      "queryRenderedFeatures"
    );
  },
  querySourceFeatures: async (sourceId, options) => {
    const map = requireWebMap(mapRef.current);

    return featuresFromWrapper(
      runWebOperation(map, () => {
        const source = map.getSource(sourceId);

        if (source == null) {
          throw new Error(
            `Source "${sourceId}" is not present in the loaded style.`
          );
        }

        const type =
          typeof source === "object" && "type" in source
            ? source.type
            : undefined;

        if (type !== "geojson" && type !== "vector") {
          throw new Error("Source queries require a GeoJSON or vector source.");
        }

        if (
          type === "vector" &&
          (typeof options?.sourceLayer !== "string" ||
            options.sourceLayer.trim() === "")
        ) {
          throw new Error(
            "Vector source queries require a nonempty sourceLayer."
          );
        }

        return map.querySourceFeatures(
          sourceId,
          toWebSourceQueryOptions(options)
        );
      }),
      "querySourceFeatures"
    );
  },
  getClusterExpansionZoom: async (sourceId, clusterId) => {
    const source = requireClusterSource(
      requireWebMap(mapRef.current),
      sourceId
    );

    return finiteNumber(
      await wrapper.callWebCluster(source, "getClusterExpansionZoom", [
        clusterId,
      ]),
      "Map cluster expansion zoom"
    );
  },
  getClusterLeaves: async (sourceId, clusterId, limit, offset) => {
    const source = requireClusterSource(
      requireWebMap(mapRef.current),
      sourceId
    );

    return featuresFromWrapper(
      await wrapper.callWebCluster(source, "getClusterLeaves", [
        clusterId,
        limit,
        offset,
      ]),
      "getClusterLeaves"
    );
  },
  getClusterChildren: async (sourceId, clusterId) => {
    const source = requireClusterSource(
      requireWebMap(mapRef.current),
      sourceId
    );

    return featuresFromWrapper(
      await wrapper.callWebCluster(source, "getClusterChildren", [clusterId]),
      "getClusterChildren"
    );
  },
  setFeatureState: async (identifier, state) => {
    const map = requireWebMap(mapRef.current);
    assertFeatureState(state);
    const target = requireFeatureTarget(
      map,
      assertFeatureIdentifier(identifier)
    );

    await runWebOperation(map, () =>
      map.setFeatureState(target, mutableFeatureState(state))
    );
  },
  getFeatureState: async (identifier) => {
    const map = requireWebMap(mapRef.current);
    const target = requireFeatureTarget(
      map,
      assertFeatureIdentifier(identifier)
    );

    const state = await runWebOperation(map, () => map.getFeatureState(target));
    if (state == null) {
      throw new Error("getFeatureState returned no result.");
    }
    return featureStateFromWrapper(state);
  },
  removeFeatureState: async (identifier, key) => {
    const map = requireWebMap(mapRef.current);
    const target = requireFeatureTarget(
      map,
      assertFeatureIdentifier(identifier)
    );

    await runWebOperation(map, () => map.removeFeatureState(target, key));
  },
});

/**
 * Captures synchronous renderer error events for one web operation.
 *
 * Both pinned web renderers can emit errors instead of throwing.
 * The listener only spans the synchronous call, leaving later unrelated
 * errors and the existing map error callback with their normal lifetimes.
 *
 * @param map - Attached wrapper handle.
 * @param operation - Renderer dispatch and target checks.
 * @returns The renderer result when no error was reported.
 * @throws The first reported error or a directly thrown failure.
 */
const runWebOperation = (
  map: WebMapHandle,
  operation: () => unknown
): unknown => {
  const renderer = map.getMap();
  let failed = false;
  let operationError: unknown;
  const reportError = (event: WebErrorNotice): void => {
    if (!failed) {
      failed = true;
      operationError = event.error;
    }
  };

  renderer.on("error", reportError);

  try {
    const result = operation();

    if (failed) {
      throw (
        operationError ??
        new Error("The renderer reported an operation failure.")
      );
    }

    return result;
  } finally {
    renderer.off("error", reportError);
  }
};

const requireWebMap = (map: WebMapHandle | null): WebMapHandle => {
  if (!map) {
    throw missingCameraError();
  }

  return map;
};

/**
 * Reads the GeoJSON source a cluster method needs.
 *
 * @param map - Attached web map handle.
 * @param sourceId - Facade id of the clustered GeoJSON source.
 * @returns The renderer source with cluster methods.
 * @throws When the style has no source with that id.
 */
const requireClusterSource = (
  map: WebMapHandle,
  sourceId: string
): WebClusterSource => {
  const source = map.getSource(sourceId);

  if (!source) {
    throw new Error(
      `Source "${sourceId}" is not present in the loaded style. Mount it through a Source to query its clusters.`
    );
  }

  return source as WebClusterSource;
};

/**
 * Error thrown when `resize()` has no web map to measure.
 *
 * @returns An error describing the missing map.
 */
const missingMapError = (): Error => new Error("Map is not attached.");

/**
 * Checks a loaded source before feature-state dispatch.
 * @param map - Attached wrapper handle.
 * @param identifier - Validated feature identifier.
 * @returns A wrapper target for a supported source family.
 * @throws When the source is missing, unsupported, or needs a source layer.
 */
const requireFeatureTarget = (
  map: WebMapHandle,
  identifier: FeatureIdentifier
): ReturnType<typeof toWebFeatureTarget> => {
  const source = map.getSource(identifier.source);

  if (source == null) {
    throw new Error(
      `Source "${identifier.source}" is not present in the loaded style.`
    );
  }

  const type =
    typeof source === "object" && "type" in source ? source.type : undefined;
  if (type !== "geojson" && type !== "vector") {
    throw new Error("Feature state requires a GeoJSON or vector source.");
  }
  if (
    type === "vector" &&
    (typeof identifier.sourceLayer !== "string" ||
      identifier.sourceLayer.trim() === "")
  ) {
    throw new Error("Vector feature state requires a nonempty sourceLayer.");
  }

  return toWebFeatureTarget(identifier);
};
