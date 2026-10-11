import type { FlyToOptions, ViewState } from "./camera-types.js";

/**
 * Copies the portable camera fields for react-map-gl `initialViewState`.
 *
 * @param viewState - Shared camera fields.
 * @returns The same longitude, latitude, zoom, bearing, and pitch.
 */
export const toWebInitialViewState = (viewState: ViewState): ViewState => ({
  longitude: viewState.longitude,
  latitude: viewState.latitude,
  zoom: viewState.zoom,
  bearing: viewState.bearing,
  pitch: viewState.pitch,
});

/**
 * Converts shared camera fields into RNMapbox `Camera.defaultSettings`.
 *
 * @param viewState - Shared camera fields.
 * @returns RNMapbox center, zoom, heading, and pitch.
 */
export const toRnmapboxDefaultSettings = (viewState: ViewState) => ({
  centerCoordinate: [viewState.longitude, viewState.latitude],
  zoomLevel: viewState.zoom,
  heading: viewState.bearing,
  pitch: viewState.pitch,
});

/**
 * Converts shared camera fields into MapLibre Native `Camera.initialViewState`.
 *
 * @param viewState - Shared camera fields.
 * @returns MapLibre Native center, zoom, bearing, and pitch.
 */
export const toMaplibreInitialViewState = (viewState: ViewState) => ({
  center: [viewState.longitude, viewState.latitude] as [number, number],
  zoom: viewState.zoom,
  bearing: viewState.bearing,
  pitch: viewState.pitch,
});

/**
 * Converts a shared flight into MapLibre or Mapbox GL JS `flyTo` arguments.
 *
 * @param options - Shared center and duration.
 * @returns Wrapper `center` and `duration`.
 */
export const toWebFlyToOptions = (options: FlyToOptions) => ({
  center: options.center,
  duration: options.duration,
});

/**
 * Converts a shared flight into RNMapbox `setCamera` with an explicit fly mode.
 *
 * RNMapbox's `flyTo` helper omits `animationMode`, and Android then defaults
 * to ease. This object sets `animationMode: "flyTo"`.
 *
 * @param options - Shared center and duration.
 * @returns An RNMapbox camera stop.
 */
export const toRnmapboxFlyToStop = (options: FlyToOptions) => ({
  type: "CameraStop" as const,
  centerCoordinate: options.center,
  animationDuration: options.duration,
  animationMode: "flyTo" as const,
});

/**
 * Converts a shared flight into MapLibre Native `Camera.flyTo` arguments.
 *
 * @param options - Shared center and duration.
 * @returns MapLibre Native center and duration.
 */
export const toMaplibreFlyToOptions = (options: FlyToOptions) => ({
  center: options.center,
  duration: options.duration,
});
