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
  offlineManagerLegacy,
  TileStore,
  CustomLocationProvider,
  LocationPuck,
} from "one-map-react/mapbox-native";
import { NativeModules } from "react-native";

import type { AcceptanceScenario } from "../acceptance-selection.js";
import { createMapboxOfflineCommands } from "./mapbox-offline-commands.js";
import { createMapboxSnapshot } from "./mapbox-snapshot.js";
import {
  acquireNativeLocation,
  requestNativeLocationPermission,
} from "./native-location.js";
import { NativeModelScene } from "./native-model-scene.js";
import { createNativeSceneComponents } from "./native-scene-components.js";
import { NativeAcceptanceScene } from "./NativeAcceptanceScene.js";

/** Uses the wrapper's SDK network switch while keeping test transport available. */
const setNetworkConnected = (connected: boolean): Promise<boolean> =>
  (
    NativeModules.RNMBXModule as {
      setConnected: (connected: boolean) => Promise<boolean>;
    }
  ).setConnected(connected);

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
    (await offlineManagerLegacy.getPacks()).map(
      (pack: { name: string; metadata: unknown }) => ({
        name: pack.name,
        metadata: pack.metadata,
      })
    ),
  migrate: () => WrapperOfflineManager.migrateOfflineCache(),
  "tile-limit": () => WrapperOfflineManager.setTileCountLimit(1000),
  throttle: () => WrapperOfflineManager.setProgressEventThrottle(300),
  reset: () => WrapperOfflineManager.resetDatabase(),
  packs: async () => (await WrapperOfflineManager.getPacks()).length,
  quota: async () =>
    (await TileStore.shared()).setOption("disk-quota", "Maps", 8 * 1024 * 1024),
  "legacy-list": async () => (await offlineManagerLegacy.getPacks()).length,
  "legacy-migrate": () => offlineManagerLegacy.migrateOfflineCache(),
  "legacy-limit": () => offlineManagerLegacy.setTileCountLimit(1000),
  "legacy-reset": () => offlineManagerLegacy.resetDatabase(),
  "legacy-create": async () => {
    await offlineManagerLegacy.createPack({
      name: "tf08-legacy-pending",
      styleURL: "http://127.0.0.1:8798/style.json",
      bounds: [
        [10, 10],
        [-10, -10],
      ],
      minZoom: 0,
      maxZoom: 0,
    });
    return (await offlineManagerLegacy.getPack("tf08-legacy-pending"))?.name;
  },
  "legacy-status": async () =>
    (await offlineManagerLegacy.getPack("tf08-legacy-pending"))?.status(),
  "legacy-pause": async () =>
    (await offlineManagerLegacy.getPack("tf08-legacy-pending"))?.pause(),
  "legacy-resume": async () =>
    (await offlineManagerLegacy.getPack("tf08-legacy-pending"))?.resume(),
  "legacy-invalidate": () =>
    offlineManagerLegacy.invalidatePack("tf08-legacy-pending"),
  "legacy-delete": async () => {
    await offlineManagerLegacy.deletePack("tf08-legacy-pending");
    return (
      (await offlineManagerLegacy.getPack("tf08-legacy-pending"))?.name ?? null
    );
  },
};

const getCurrentPosition = (signal?: AbortSignal, timeoutMs?: number) =>
  acquireNativeLocation(WrapperLocationManager, "mapbox", signal, timeoutMs);
const requestLocationPermission = () => requestNativeLocationPermission();

const components = createNativeSceneComponents("mapbox-native", {
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
    doubleTap={false}
    ornaments={tf07Ornaments}
    services={services}
    modelScene={NativeModelScene}
  />
);

const services = {
  createSnapshot: createMapboxSnapshot,
  getCurrentPosition,
  requestLocationPermission,
  getLocationDiagnostic: () => WrapperLocationManager.getLastKnownLocation(),
  setNetworkConnected,
  offlineOperations,
  createOfflineCommands: createMapboxOfflineCommands,
  nativePuck: (
    <>
      <CustomLocationProvider coordinate={[-122.34, 47.615]} />
      <LocationPuck puckBearingEnabled={false} />
    </>
  ),
};

export default App;

// Native scale units and appearance belong to the selected SDK.
const tf07Ornaments = {
  scaleBarEnabled: true,
  scaleBarPosition: { top: 64, left: 8 },
  compassPosition: { top: 148, right: 8 },
} satisfies NativeMapProps["options"];
