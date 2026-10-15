import {
  locationManager,
  offlineManager,
  snapshotManager,
} from "@rnmapbox/maps";

import type { MapServices } from "../../contracts/adapter.js";
import {
  normalizeStaticImage,
  validateStaticImage,
  withImageDeadline,
} from "../shared/image-output.js";
import { createNativeLocation } from "../shared/native-location.js";
import { createOfflineService } from "../shared/offline-service.js";

/** RNMapbox public services; no sensor, download, or renderer starts on import. */
export const mapboxNativeServices: MapServices = {
  location: createNativeLocation(() => locationManager, "mapbox"),
  offline: createOfflineService({
    kind: "mapbox",
    getPacks: () => offlineManager.getPacks(),
    create: async (options, metadata, progress, error) => {
      try {
        await offlineManager.createPack(
          {
            name: options.id,
            styleURL: options.mapStyle,
            bounds: [[...options.bounds[1]], [...options.bounds[0]]],
            minZoom: options.minZoom,
            maxZoom: options.maxZoom,
            metadata,
          },
          progress,
          error
        );
        const pack = await offlineManager.getPack(options.id);
        if (!pack)
          throw new Error("RNMapbox created no discoverable offline pack.");
        return pack;
      } catch (failure) {
        offlineManager.unsubscribe(options.id);
        throw failure;
      }
    },
    observe: (id, progress, error) =>
      offlineManager.subscribe(id, progress, error),
    unobserve: (id) => offlineManager.unsubscribe(id),
    deletePack: (id) => offlineManager.deletePack(id),
    invalidatePack: (id) => offlineManager.invalidatePack(id),
    // Both v11 native implementations emit string states, despite the pack
    // declaration's stale numeric state. Legacy facilities remain named exports.
    state: (value) =>
      value === "inactive" ||
      value === "active" ||
      value === "complete" ||
      value === "invalid"
        ? value
        : "unknown",
  }),
  staticMapImage: {
    create: async (options) => {
      validateStaticImage(options);
      const camera = options.bounds
        ? { bounds: options.bounds.map((corner) => [...corner]) }
        : {
            centerCoordinate: [...options.center],
            zoomLevel: options.zoom,
            heading: options.bearing ?? 0,
            pitch: options.pitch ?? 0,
          };
      const result = await withImageDeadline(
        snapshotManager.takeSnap({
          ...camera,
          styleURL: options.mapStyle,
          width: options.width,
          height: options.height,
          writeToDisk: options.output === "file",
        }),
        options.timeoutMs
      );
      return normalizeStaticImage(result, options);
    },
  },
};
