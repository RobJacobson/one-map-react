import { locationManager, snapshotManager } from "@rnmapbox/maps";

import type { MapServices } from "../../contracts/adapter.js";
import {
  normalizeStaticImage,
  validateStaticImage,
  withImageDeadline,
} from "../shared/image-output.js";
import { createNativeLocation } from "../shared/native-location.js";

/** RNMapbox public services; no sensor, download, or renderer starts on import. */
export const mapboxNativeServices: MapServices = {
  location: createNativeLocation(() => locationManager, "mapbox"),
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
