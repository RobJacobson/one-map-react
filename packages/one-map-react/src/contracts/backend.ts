/** Engine and host choices used by applications. */
export type Backend =
  | "mapbox-web"
  | "maplibre-web"
  | "mapbox-native"
  | "maplibre-native";

/** Engines bound by the native entry points. */
export type NativeBackend = Extract<
  Backend,
  "mapbox-native" | "maplibre-native"
>;
