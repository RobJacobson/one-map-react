import { LocationManager } from "@maplibre/maplibre-react-native";

import type { MapServices } from "../../contracts/adapter.js";
import { createNativeLocation } from "../shared/native-location.js";

/** MapLibre public services, accessed only by explicit operations. */
export const maplibreNativeServices: MapServices = {
  location: createNativeLocation(
    () => LocationManager,
    "maplibre",
    () => LocationManager.requestPermissions()
  ),
};
