import { locationManager } from "@rnmapbox/maps";

import type { MapServices } from "../../contracts/adapter.js";
import { createNativeLocation } from "../shared/native-location.js";

/** RNMapbox public services; no sensor, download, or renderer starts on import. */
export const mapboxNativeServices: MapServices = {
  location: createNativeLocation(() => locationManager, "mapbox"),
};
