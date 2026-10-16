import { adapter as mapbox, setAccessToken } from "one-map-react/mapbox-native";
import { adapter as maplibre } from "one-map-react/maplibre-native";

/** Both native engines, isolated from browser dependencies. */
export const adapters = { mapbox, maplibre };

/** Configures the public token before a Mapbox map is mounted. */
export const configureMapbox = (token: string): void => {
  if (token) setAccessToken(token);
};
