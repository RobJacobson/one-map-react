import type { Adapter } from "./adapter.js";

/** Selects mapbox-web; renderer integration begins in TF02. */
export const adapter = { backend: "mapbox-web" } as const satisfies Adapter;
