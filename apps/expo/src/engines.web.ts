import "mapbox-gl/dist/mapbox-gl.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";

// Metro serves the pinned worker from public instead of rewriting its dynamic sibling URL.
setWorkerUrl("/maplibre-gl-worker.mjs");

export { adapters, configureMapbox } from "@one-map/example-map/web";
