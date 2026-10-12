import type {
  ComponentType,
  ForwardRefExoticComponent,
  RefAttributes,
} from "react";

import type { MapRef } from "./camera-types.js";
import type { ImagesProps } from "./images-types.js";
import type { LayerProps } from "./layer-types.js";
import type { MapProps } from "./map-types.js";
import type { SourceProps } from "./source-types.js";

/** Explicit engine and host selection; native covers both iOS and Android. */
export type Backend =
  | "mapbox-web"
  | "maplibre-web"
  | "mapbox-native"
  | "maplibre-native";

/**
 * Backend selection and the map components that implement it.
 *
 * Application setup passes this value to {@link MapSetup}. Shared map code
 * reads it from context and does not import a wrapper.
 */
export interface Adapter {
  /** Backend chosen by application setup, independently of installed packages. */
  readonly backend: Backend;
  /** Map container, camera, commands, and movement events. */
  readonly Map: ForwardRefExoticComponent<MapProps & RefAttributes<MapRef>>;
  /** Source that nests child layers. */
  readonly Source: ComponentType<SourceProps>;
  /** Layer that forwards a parent-injected source id. */
  readonly Layer: ComponentType<LayerProps>;
  /** Style images registered on the enclosing map. */
  readonly Images: ComponentType<ImagesProps>;
}
