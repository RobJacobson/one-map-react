import type {
  CameraCommandOptions,
  FitBoundsOptions,
  FlyToOptions,
  ViewState,
  ZoomToOptions,
} from "../../contracts/camera-types.js";
import { normalizePadding } from "../shared/wrapper-values.js";

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
 * Converts a shared flight into MapLibre or Mapbox GL JS `flyTo` arguments.
 *
 * @param options - Shared flight.
 * @returns Wrapper fields that were provided, plus `center`.
 */
export const toWebFlyToOptions = (options: FlyToOptions) =>
  webCommandOptions(options);

/**
 * Converts a shared ease or jump into GL JS command arguments.
 *
 * @param options - Partial camera target.
 * @returns Wrapper fields that were provided. Jump timing is not included.
 */
export const toWebCommandOptions = (options: CameraCommandOptions) =>
  webCommandOptions(options);

/**
 * Converts fit options into GL JS `fitBounds` options.
 *
 * @param options - Fit options. Omitted options produce an empty object.
 * @returns Duration, padding, bearing, pitch, easing, and max zoom that were set.
 */
export const toWebFitBoundsOptions = (options: FitBoundsOptions = {}) => ({
  ...(options.padding === undefined
    ? {}
    : { padding: normalizePadding(options.padding) }),
  ...(options.duration === undefined ? {} : { duration: options.duration }),
  ...(options.bearing === undefined ? {} : { bearing: options.bearing }),
  ...(options.pitch === undefined ? {} : { pitch: options.pitch }),
  ...(options.easing === undefined ? {} : { easing: options.easing }),
  ...(options.maxZoom === undefined ? {} : { maxZoom: options.maxZoom }),
});

/**
 * Converts zoom options into GL JS `zoomTo` options.
 *
 * @param options - Duration and easing.
 * @returns The fields that were provided.
 */
export const toWebZoomToOptions = (options: ZoomToOptions = {}) => ({
  ...(options.duration === undefined ? {} : { duration: options.duration }),
  ...(options.easing === undefined ? {} : { easing: options.easing }),
});

const webCommandOptions = (options: CameraCommandOptions) => ({
  ...(options.center === undefined ? {} : { center: options.center }),
  ...(options.zoom === undefined ? {} : { zoom: options.zoom }),
  ...(options.bearing === undefined ? {} : { bearing: options.bearing }),
  ...(options.pitch === undefined ? {} : { pitch: options.pitch }),
  ...(options.padding === undefined
    ? {}
    : { padding: normalizePadding(options.padding) }),
  ...(options.duration === undefined ? {} : { duration: options.duration }),
  ...(options.easing === undefined ? {} : { easing: options.easing }),
});
