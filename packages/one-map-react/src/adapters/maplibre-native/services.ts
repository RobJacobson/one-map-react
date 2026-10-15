import {
  LocationManager,
  OfflineManager,
  StaticMapImageManager,
} from "@maplibre/maplibre-react-native";

import type { MapServices } from "../../contracts/adapter.js";
import {
  normalizeStaticImage,
  validateStaticImage,
  withImageDeadline,
} from "../shared/image-output.js";
import { createNativeLocation } from "../shared/native-location.js";
import { createOfflineService } from "../shared/offline-service.js";
import { toFlatBounds } from "../shared/wrapper-values.js";

/** MapLibre public services, accessed only by explicit operations. */
export const maplibreNativeServices: MapServices = {
  location: createNativeLocation(
    () => LocationManager,
    "maplibre",
    () => LocationManager.requestPermissions()
  ),
  offline: createOfflineService({
    kind: "maplibre",
    getPacks: () => OfflineManager.getPacks(),
    create: (options, metadata, progress, error) =>
      OfflineManager.createPack(
        {
          mapStyle: options.mapStyle,
          bounds: [...toFlatBounds(options.bounds)],
          minZoom: options.minZoom,
          maxZoom: options.maxZoom,
          metadata,
        },
        progress,
        error
      ),
    observe: (id, progress, error) =>
      OfflineManager.addListener(id, progress, error),
    unobserve: (id) => OfflineManager.removeListener(id),
    deletePack: (id) => OfflineManager.deletePack(id),
    invalidatePack: (id) => OfflineManager.invalidatePack(id),
    state: (value) =>
      value === "inactive" || value === "active" || value === "complete"
        ? value
        : "unknown",
  }),
  staticMapImage: {
    create: async (options) => {
      validateStaticImage(options);
      const camera = options.bounds
        ? {
            bounds: [...toFlatBounds(options.bounds)] as [
              number,
              number,
              number,
              number,
            ],
          }
        : {
            center: [...options.center] as [number, number],
            zoom: options.zoom,
            bearing: options.bearing,
            pitch: options.pitch,
          };
      const result = await withImageDeadline(
        StaticMapImageManager.createImage({
          ...camera,
          mapStyle: options.mapStyle,
          width: options.width,
          height: options.height,
          output: options.output === "file" ? "file" : "base64",
        }),
        options.timeoutMs
      );
      return normalizeStaticImage(result, options);
    },
  },
};
