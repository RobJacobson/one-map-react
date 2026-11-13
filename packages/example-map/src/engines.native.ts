import type { Adapter } from "one-map-react";

import type { Engine } from "./use-example-map.js";

/** Resolves only the selected adapter, avoiding unselected JS offline-module initialization. */
export const adapters: Readonly<Record<Engine, Adapter>> = {
  get mapbox() {
    return (
      require("one-map-react/mapbox-native") as typeof import("one-map-react/mapbox-native")
    ).adapter;
  },
  get maplibre() {
    return (
      require("one-map-react/maplibre-native") as typeof import("one-map-react/maplibre-native")
    ).adapter;
  },
};

/** Configures the public token before a Mapbox map is mounted. */
export const configureMapbox = (token: string): void => {
  if (token)
    (
      require("one-map-react/mapbox-native") as typeof import("one-map-react/mapbox-native")
    ).setAccessToken(token);
};
