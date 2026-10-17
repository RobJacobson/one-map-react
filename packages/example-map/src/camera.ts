import type { Adapter, MapRef, ViewState } from "one-map-react";

/** Seattle starting view shared by both apps and all four adapters. */
export const initialCamera: ViewState = {
  longitude: -122.34,
  latitude: 47.61,
  zoom: 11,
  bearing: 0,
  pitch: 0,
};

/**
 * Reads the public camera, retaining observed orientation where getters are unavailable.
 *
 * @param map - Current map attachment.
 * @param backend - Selected adapter's backend.
 * @param observed - Latest normalized movement event.
 * @returns Camera snapshot suitable for another engine.
 */
export const readCamera = async (
  map: MapRef,
  backend: Adapter["backend"],
  observed: ViewState
): Promise<ViewState> => {
  const [center, zoom, bearing, pitch] = await Promise.all([
    map.getCenter(),
    map.getZoom(),
    backend === "mapbox-native" ? observed.bearing : map.getBearing(),
    backend === "mapbox-native" ? observed.pitch : map.getPitch(),
  ]);
  const camera = {
    longitude: center[0],
    latitude: center[1],
    zoom,
    bearing,
    pitch,
  };
  if (!Object.values(camera).every(Number.isFinite))
    throw new Error("The renderer returned an invalid camera.");
  return camera;
};

/**
 * Compares camera readback with wrap equivalence and native coordinate precision.
 *
 * @param actual - Renderer readback.
 * @param expected - Requested camera.
 * @returns Whether every camera field is within the example's handoff tolerance.
 */
export const cameraMatches = (
  actual: ViewState,
  expected: ViewState
): boolean =>
  circularDifference(actual.longitude, expected.longitude) < 0.00001 &&
  Math.abs(actual.latitude - expected.latitude) < 0.00001 &&
  Math.abs(actual.zoom - expected.zoom) < 0.001 &&
  circularDifference(actual.bearing, expected.bearing) < 0.01 &&
  Math.abs(actual.pitch - expected.pitch) < 0.01;

const circularDifference = (left: number, right: number): number =>
  Math.abs(((((left - right + 180) % 360) + 360) % 360) - 180);
