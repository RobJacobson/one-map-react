import type { Adapter } from "./adapter.js";

/** Selects maplibre-native; renderer integration begins in TF02. */
export const adapter = {
  backend: "maplibre-native",
} as const satisfies Adapter;
