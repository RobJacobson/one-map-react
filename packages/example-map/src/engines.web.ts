import mapboxgl from "mapbox-gl";
import { adapter as mapbox } from "one-map-react/mapbox-web";
import { adapter as maplibre } from "one-map-react/maplibre-web";

/** Both browser engines, isolated from native dependencies. */
export const adapters = { mapbox, maplibre };

/** Configures the public token before a Mapbox map is mounted. */
export const configureMapbox = (token: string): void => {
  // The UMD entry's NodeNext declaration needs the same default-export narrowing as the adapter.
  const renderer =
    mapboxgl as unknown as (typeof import("mapbox-gl"))["default"];
  if (token) renderer.accessToken = token;
};
