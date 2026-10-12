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

/**
 * Builds the imperative map handle over MapLibre Native camera and map refs.
 *
 * @param cameraRef - Ref to the MapLibre Native `Camera` child.
 * @param mapRef - Ref to the MapLibre Native `Map`.
 * @param mapLoaded - Ref tracking `onDidFinishLoadingMap`, after which the
 * camera applies imperative stops.
 * @returns The common map ref.
 */
export const createMaplibreMapRef = (
  cameraRef: { readonly current: ComponentRef<typeof Camera> | null },
  mapRef: { readonly current: ComponentRef<typeof MaplibreMap> | null },
  mapLoaded: { readonly current: boolean }
): MapRef => ({
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
  resize: async () => {
    throw nativeResizeError();
  },
});

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
