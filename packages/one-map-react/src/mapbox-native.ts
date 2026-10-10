import type { Adapter } from "./adapter.js";

/** Selects mapbox-native; renderer integration begins in TF02. */
export const adapter = { backend: "mapbox-native" } as const satisfies Adapter;
