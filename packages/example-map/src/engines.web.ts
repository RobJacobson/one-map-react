import mapboxgl from "mapbox-gl";
import { Map as MapboxMap } from "react-map-gl/mapbox";
import { Map as MaplibreMap } from "react-map-gl/maplibre";

import type { ExampleMaps } from "./example-map.js";

/** Both browser engines, isolated from native dependencies. */
export const maps: ExampleMaps = { mapbox: MapboxMap, maplibre: MaplibreMap };

/** Configures the public token before a Mapbox map is mounted. */
export const configureMapbox = (token: string): void => {
  // The UMD entry's NodeNext declaration needs the same default-export narrowing as the renderer entry.
  const renderer =
    mapboxgl as unknown as (typeof import("mapbox-gl"))["default"];
  if (token) renderer.accessToken = token;
};
