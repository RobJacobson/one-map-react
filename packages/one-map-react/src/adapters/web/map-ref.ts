import type { MapRef } from "../../contracts/camera-types.js";
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
import type { WebMapHandle } from "./contracts.js";
import {
  toWebCommandOptions,
  toWebFitBoundsOptions,
  toWebFlyToOptions,
  toWebZoomToOptions,
} from "./convert-camera.js";

export const createWebMapRef = (mapRef: {
  readonly current: WebMapHandle | null;
}): MapRef => ({
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
});

const requireWebMap = (map: WebMapHandle | null): WebMapHandle => {
  if (!map) {
    throw missingCameraError();
  }

  return map;
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
