import {
  Layer as MapboxLayer,
  Map as MapboxMap,
  Source as MapboxSource,
} from "react-map-gl/mapbox";

import type { Adapter } from "./adapter.js";
import { createWebAdapter } from "./create-web-adapter.js";

/** Selects mapbox-web and supplies react-map-gl Mapbox components. */
export const adapter: Adapter & { readonly backend: "mapbox-web" } =
  createWebAdapter({
    backend: "mapbox-web",
    Map: MapboxMap,
    Source: MapboxSource,
    Layer: MapboxLayer,
  });
