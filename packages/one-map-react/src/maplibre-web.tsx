import {
  Layer as MaplibreLayer,
  Map as MaplibreMap,
  Source as MaplibreSource,
} from "react-map-gl/maplibre";

import type { Adapter } from "./adapter.js";
import { createWebAdapter } from "./create-web-adapter.js";

/** Selects maplibre-web and supplies react-map-gl MapLibre components. */
export const adapter: Adapter & { readonly backend: "maplibre-web" } =
  createWebAdapter({
    backend: "maplibre-web",
    Map: MaplibreMap,
    Source: MaplibreSource,
    Layer: MaplibreLayer,
  });
