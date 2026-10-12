import type { Camera, MapView } from "@rnmapbox/maps";
import type { ComponentRef } from "react";

import type { LngLat, MapRef, Point } from "../../contracts/camera-types.js";
import {
  nativeResizeError,
  nativeStopError,
  unavailableMapMethodError,
} from "../native-map-options.js";
import { invokeWrapper } from "../shared/invoke-wrapper.js";
import { missingCameraError } from "../shared/missing-camera.js";
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

/**
 * Builds the imperative map handle over RNMapbox camera and map refs.
 *
 * @param cameraRef - Ref to the RNMapbox `Camera` child.
 * @param mapViewRef - Ref to the RNMapbox `MapView`.
 * @returns The common map ref.
 */
export const createMapboxMapRef = (
  cameraRef: { readonly current: ComponentRef<typeof Camera> | null },
  mapViewRef: { readonly current: ComponentRef<typeof MapView> | null }
): MapRef => ({
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
  resize: async () => {
    throw nativeResizeError();
  },
});

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
