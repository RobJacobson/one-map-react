import type { Backend } from "../../contracts/adapter.js";
import type { MapRef } from "../../contracts/camera-types.js";
import type { FeatureIdentifier } from "../../contracts/query-types.js";
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
  assertBounds,
  boundsFromGeographic,
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
  toWebFlyToOptions,
  toWebZoomToOptions,
} from "./convert-camera.js";
import {
  toWebFeatureTarget,
  toWebQueryGeometry,
  toWebRenderedQueryOptions,
  toWebSourceQueryOptions,
} from "./convert-query.js";

export const createWebMapRef = (
  mapRef: {
    readonly current: WebMapHandle | null;
  },
  wrapper: WebWrapper<Extract<Backend, "mapbox-web" | "maplibre-web">>,
  capture?: MapRef["capture"]
): MapRef => ({
  capture:
    capture ??
    (async () => {
      throw new Error("Capture is not enabled on this map.");
    }),
  jumpTo: async (options) => {
    rejectJumpTiming(options);
    const map = requireWebMap(mapRef.current);

    await invokeWrapper(map.jumpTo(toWebCommandOptions(options)));
  },
  easeTo: async (options) => {
    const map = requireWebMap(mapRef.current);

    await invokeWrapper(map.easeTo(toWebCommandOptions(options)));
  },
  flyTo: async (options) => {
    const map = requireWebMap(mapRef.current);

    await invokeWrapper(map.flyTo(toWebFlyToOptions(options)));
  },
  fitBounds: async (bounds, options) => {
    const map = requireWebMap(mapRef.current);

    await invokeWrapper(
      map.fitBounds(assertBounds(bounds), toWebFitBoundsOptions(options))
    );
  },
  zoomTo: async (zoom, options) => {
    const map = requireWebMap(mapRef.current);

    await invokeWrapper(map.zoomTo(zoom, toWebZoomToOptions(options)));
  },
  stop: async () => {
    const map = requireWebMap(mapRef.current);

    await invokeWrapper(map.stop());
  },
  getCenter: async () => {
    const map = requireWebMap(mapRef.current);

    return lngLatFromWrapper(await map.getCenter());
  },
  getZoom: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getZoom(), "zoom");
  },
  getBearing: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getBearing(), "bearing");
  },
  getPitch: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getPitch(), "pitch");
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

    return finiteNumber(await map.getMinZoom(), "min zoom");
  },
  getMaxZoom: async () => {
    const map = requireWebMap(mapRef.current);

    return finiteNumber(await map.getMaxZoom(), "max zoom");
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

    await invokeWrapper(map.resize());
  },
  queryRenderedFeatures: async (target, options) => {
    const map = requireWebMap(mapRef.current);

    return featuresFromWrapper(
      runWebQuery(map, () => {
        for (const id of options?.layers ?? []) {
          if (map.getLayer(id) == null) {
            throw new Error(
              `Layer "${id}" is not present in the loaded style.`
            );
          }
        }

        return map.queryRenderedFeatures(
          toWebQueryGeometry(target),
          toWebRenderedQueryOptions(options)
        );
      }),
      "queryRenderedFeatures"
    );
  },
  querySourceFeatures: async (sourceId, options) => {
    const map = requireWebMap(mapRef.current);

    return featuresFromWrapper(
      runWebQuery(map, () => {
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
      "cluster expansion zoom"
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

    await invokeWrapper(
      map.setFeatureState(target, mutableFeatureState(state))
    );
  },
  getFeatureState: async (identifier) => {
    const map = requireWebMap(mapRef.current);
    const target = requireFeatureTarget(
      map,
      assertFeatureIdentifier(identifier)
    );

    const state = await map.getFeatureState(target);
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

    await invokeWrapper(map.removeFeatureState(target, key));
  },
});

/**
 * Captures synchronous renderer error events for one web query.
 *
 * Both pinned web renderers can emit an error and return an empty array.
 * The listener only spans the synchronous call, leaving later unrelated
 * errors and the existing map error callback with their normal lifetimes.
 *
 * @param map - Attached wrapper handle.
 * @param query - Query dispatch and target checks.
 * @returns The renderer result when no error was reported.
 * @throws The first reported error or a directly thrown query failure.
 */
const runWebQuery = (map: WebMapHandle, query: () => unknown): unknown => {
  const renderer = map.getMap();
  let failed = false;
  let queryError: unknown;
  const reportError = (event: WebErrorNotice): void => {
    if (!failed) {
      failed = true;
      queryError = event.error;
    }
  };

  renderer.on("error", reportError);

  try {
    const result = query();

    if (failed) {
      throw queryError ?? new Error("The renderer reported a query failure.");
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

const finiteNumber = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Map ${name} must be a finite number.`);
  }

  return value;
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
