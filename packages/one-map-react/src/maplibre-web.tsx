import type { ComponentType } from "react";
import {
  Layer as MaplibreLayer,
  Map as MaplibreMap,
  type MapRef as MaplibreMapRef,
  Source as MaplibreSource,
  useMap,
} from "react-map-gl/maplibre";

import {
  createWebAdapter,
  type WebForwardedProps,
} from "./adapters/web/create-adapter.js";
import type { Adapter } from "./contracts/adapter.js";

type MaplibreMapInstance = ReturnType<MaplibreMapRef["getMap"]>;

// The react-map-gl components accept the full style-spec surface; the facade
// converts props before they reach this boundary.
/** Selects maplibre-web and supplies react-map-gl MapLibre components. */
export const adapter: Adapter & { readonly backend: "maplibre-web" } =
  createWebAdapter({
    backend: "maplibre-web",
    Map: MaplibreMap,
    Source: MaplibreSource as ComponentType<WebForwardedProps>,
    Layer: MaplibreLayer as ComponentType<WebForwardedProps>,
    useMap,
    // MapLibre GL resolves image loads with a { data } response; the shared
    // web surface omits the loader so each entry normalizes its own.
    loadWebImage: (map, url) =>
      (map as MaplibreMapInstance)
        .loadImage(url)
        .then((response) => response.data),
  });
