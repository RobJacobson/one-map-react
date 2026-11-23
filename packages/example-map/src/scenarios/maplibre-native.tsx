import {
  Layer,
  Map as NativeMap,
  MapProvider,
  Marker,
  Source,
  useMap,
  type NativeMapProps,
  WrapperLocationManager,
  WrapperOfflineManager,
  NativeUserLocation,
} from "one-map-react/maplibre-native";

import type { AcceptanceScenario } from "../acceptance-selection.js";
import { createMaplibreOfflineCommands } from "./maplibre-offline-commands.js";
import { createMaplibreSnapshot } from "./maplibre-snapshot.js";
import {
  acquireNativeLocation,
  requestNativeLocationPermission,
} from "./native-location.js";
import { createNativeSceneComponents } from "./native-scene-components.js";
import { NativeAcceptanceScene } from "./NativeAcceptanceScene.js";

// Destructive operations are only invoked by the isolated pending acceptance scope.
const offlineOperations = {
  "ambient-invalidate": () => WrapperOfflineManager.invalidateAmbientCache(),
  "ambient-clear": () => WrapperOfflineManager.clearAmbientCache(),
  "ambient-size": () =>
    WrapperOfflineManager.setMaximumAmbientCacheSize(16 * 1024 * 1024),
  "merge-missing": () =>
    WrapperOfflineManager.mergeOfflineRegions("/tf08-missing.db"),
  "merge-valid": (value: Record<string, unknown>) =>
    WrapperOfflineManager.mergeOfflineRegions(String(value.path)),
  "storage-packs": async () =>
    (await WrapperOfflineManager.getPacks()).map(
      (pack: { id: string; metadata: unknown }) => ({
        id: pack.id,
        metadata: pack.metadata,
      })
    ),
  "tile-limit": () => WrapperOfflineManager.setTileCountLimit(1000),
  throttle: () => WrapperOfflineManager.setProgressEventThrottle(300),
  reset: () => WrapperOfflineManager.resetDatabase(),
  packs: async () => (await WrapperOfflineManager.getPacks()).length,
};

const getCurrentPosition = (signal?: AbortSignal, timeoutMs?: number) =>
  acquireNativeLocation(WrapperLocationManager, "maplibre", signal, timeoutMs);
const requestLocationPermission = () =>
  requestNativeLocationPermission(() =>
    WrapperLocationManager.requestPermissions()
  );

const components = createNativeSceneComponents("maplibre-native", {
  Map: NativeMap,
  Source,
  Layer,
  Marker,
  MapProvider,
  useMap,
});

const App = ({ scenario }: { readonly scenario: AcceptanceScenario }) => (
  <NativeAcceptanceScene
    scenario={scenario}
    components={components}
    doubleTap={true}
    ornaments={tf07Ornaments}
    services={services}
  />
);

const services = {
  createSnapshot: createMaplibreSnapshot,
  getCurrentPosition,
  requestLocationPermission,
  getLocationDiagnostic: () => WrapperLocationManager.getCurrentPosition(),
  offlineOperations,
  createOfflineCommands: createMaplibreOfflineCommands,
  nativePuck: <NativeUserLocation />,
};

export default App;

// Native scale units and appearance belong to the selected SDK.
// Leave the top-left corner clear for the application location button.
const tf07Ornaments = {
  scaleBar: true,
  scaleBarPosition: { top: 64, left: 8 },
  compassPosition: { top: 148, right: 8 },
} satisfies NativeMapProps["options"];
