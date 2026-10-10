import type { Adapter } from "./adapter.js";

/** Selects maplibre-web; renderer integration begins in TF02. */
export const adapter = { backend: "maplibre-web" } as const satisfies Adapter;
