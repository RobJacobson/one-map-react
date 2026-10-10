/** Explicit engine and host selection; native covers both iOS and Android. */
export type Backend =
  | "mapbox-web"
  | "maplibre-web"
  | "mapbox-native"
  | "maplibre-native";

/**
 * Backend selection exported by an adapter entry.
 *
 * @remarks TF01 provides selection only. Rendering components are added in TF02;
 * this descriptor does not load a wrapper or create a map.
 */
export interface Adapter {
  /** Backend chosen by application setup, independently of installed packages. */
  readonly backend: Backend;
}
