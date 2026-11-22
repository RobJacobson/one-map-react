import type { ExampleMaps } from "./example-map.js";

/** Resolves only the selected map, avoiding unselected SDK initialization. */
export const maps: ExampleMaps = {
  get mapbox() {
    return mapboxEntry().Map;
  },
  get maplibre() {
    return (
      require("one-map-react/maplibre-native") as typeof import("one-map-react/maplibre-native")
    ).Map;
  },
};

/**
 * Configures the public token before mounting a selected Mapbox map.
 *
 * @param token - Validated public Mapbox token.
 * @returns Completion of the native token setter when supplied.
 */
export const configureMapbox = async (token: string): Promise<void> => {
  if (token) await mapboxEntry().setAccessToken(token);
};

const mapboxEntry = (): typeof import("one-map-react/mapbox-native") =>
  require("one-map-react/mapbox-native") as typeof import("one-map-react/mapbox-native");
