import type {
  ComponentType,
  ForwardRefExoticComponent,
  RefAttributes,
} from "react";

import type { MapRef } from "./camera-types.js";
import type { StaticMapImageService } from "./capture-types.js";
import type { ImagesProps } from "./images-types.js";
import type { LayerProps } from "./layer-types.js";
import type { LocationService } from "./location-types.js";
import type { MapProps } from "./map-types.js";
import type { OfflineService } from "./offline-types.js";
import type { SourceProps } from "./source-types.js";
import type {
  AttributionControlProps,
  ControlProps,
  FullscreenControlProps,
  GeolocateControlProps,
  MarkerProps,
  MarkerRef,
  NavigationControlProps,
  PopupProps,
  ScaleControlProps,
} from "./ui-types.js";

/** App-level services independent of map attachment. */
export interface MapServices {
  /** Explicit foreground acquisition. */
  readonly location: LocationService;
  /** Native persistent download manager when implemented. */
  readonly offline?: OfflineService;
  /** Independent native snapshotter when implemented. */
  readonly staticMapImage?: StaticMapImageService;
}

/** Explicit engine and host selection; native covers both iOS and Android. */
export type Backend =
  | "mapbox-web"
  | "maplibre-web"
  | "mapbox-native"
  | "maplibre-native";

/**
 * Backend selection and the map components that implement it.
 *
 * @remarks
 * Application setup passes this value to {@link MapSetup}. Shared map code
 * reads it from context and does not import a wrapper.
 */
export interface Adapter {
  /** Backend chosen by application setup, independently of installed packages. */
  readonly backend: Backend;
  /** Device and storage services; reading this record starts no work. */
  readonly services: MapServices;
  /** Map container, camera, commands, and movement events. */
  readonly Map: ForwardRefExoticComponent<MapProps & RefAttributes<MapRef>>;
  /** Source that nests child layers. */
  readonly Source: ComponentType<SourceProps>;
  /** Layer that forwards a parent-injected source id. */
  readonly Layer: ComponentType<LayerProps>;
  /** Style images registered on the enclosing map. */
  readonly Images: ComponentType<ImagesProps>;
  /** Geographically anchored live view or explicit annotation. */
  readonly Marker: ForwardRefExoticComponent<
    MarkerProps & RefAttributes<MarkerRef>
  >;
  /** Mounted popup with application-owned dismissal. */
  readonly Popup: ComponentType<PopupProps>;
  /** Application UI in a map corner. */
  readonly Control: ComponentType<ControlProps>;
  /** Camera buttons and compass. */
  readonly NavigationControl: ComponentType<NavigationControlProps>;
  /** Renderer attribution. */
  readonly AttributionControl: ComponentType<AttributionControlProps>;
  /** Ground distance scale. */
  readonly ScaleControl: ComponentType<ScaleControlProps>;
  /** Location acquisition and camera centering. */
  readonly GeolocateControl: ComponentType<GeolocateControlProps>;
  /** Browser fullscreen UI. */
  readonly FullscreenControl: ComponentType<FullscreenControlProps>;
}
